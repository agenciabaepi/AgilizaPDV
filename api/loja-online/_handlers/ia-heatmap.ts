import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from '../_lib/supabase'
import { param, parsePeriodo, requireIaAdmin } from '../_lib/ia-request'
import { lojaPageType, normalizeLojaPath } from '../_lib/inteligencia-metricas'

const MAX_ROWS = 20_000
/** Eventos anteriores mediam a janela (sempre 0 na loja): rolagem saía 100% e o Y dos cliques era da tela. */
const TRACKING_VERSION = 2

type Row = { event_type: string; path: string | null; device: string | null; props: Record<string, unknown> | null }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }
  const auth = requireIaAdmin(req, res)
  if (!auth) return
  const periodo = parsePeriodo(req)
  if (typeof periodo === 'string') {
    res.status(400).json({ ok: false, error: periodo })
    return
  }
  // alvo = "tipo:produto" (todas as páginas de produto) ou um caminho normalizado ("/carrinho")
  const alvo = param(req, 'alvo') || 'tipo:home'
  const deviceClass = param(req, 'device') === 'mobile' ? 'mobile' : 'desktop'

  const supabase = getSupabaseAdmin()
  const fetchRows = async (types: string[]): Promise<Row[] | string> => {
    const out: Row[] = []
    for (let from = 0; from < MAX_ROWS; from += 1000) {
      const { data, error } = await supabase
        .from('loja_online_comportamento')
        .select('event_type, path, device, props')
        .eq('empresa_id', auth.empresaId)
        .in('event_type', types)
        .gte('created_at', periodo.inicio)
        .lte('created_at', periodo.fim)
        .order('created_at', { ascending: false })
        .range(from, from + 999)
      if (error) return error.message
      out.push(...((data ?? []) as Row[]))
      if (!data || data.length < 1000) break
    }
    return out
  }

  // Separado: o volume de cliques não pode empurrar as amostras de rolagem para fora do limite
  const [clickRows, leaveRows] = await Promise.all([fetchRows(['click', 'rage_click']), fetchRows(['page_leave'])])
  if (typeof clickRows === 'string' || typeof leaveRows === 'string') {
    res.status(500).json({ ok: false, error: typeof clickRows === 'string' ? clickRows : leaveRows })
    return
  }

  const matches = (path: string | null) =>
    alvo.startsWith('tipo:') ? lojaPageType(path) === alvo.slice(5) : normalizeLojaPath(path) === alvo
  const isMobile = (d: string | null) => d === 'mobile' || d === 'tablet'
  const isAlvo = (r: Row) => matches(r.path) && isMobile(r.device) === (deviceClass === 'mobile')
  const isV2 = (p: Record<string, unknown>) => Number(p.sv) >= TRACKING_VERSION

  const paginas = new Map<string, number>()
  const tipos = new Map<string, number>()
  const pontos: { x: number; y: number; dh: number; rage: boolean; legado?: boolean }[] = []
  const pontosLegado: typeof pontos = []
  const labels = new Map<string, number>()
  const scrolls: number[] = []
  const alturas: number[] = []
  const vws: number[] = []

  for (const r of clickRows) {
    if (r.event_type === 'click') {
      bump(paginas, normalizeLojaPath(r.path))
      bump(tipos, lojaPageType(r.path))
    }
    if (!isAlvo(r)) continue
    const p = r.props ?? {}
    if (r.event_type === 'click') {
      const label = typeof p.label === 'string' ? p.label : null
      if (label) bump(labels, label)
    }
    const x = Number(p.x)
    const y = Number(p.y)
    const dh = Number(p.dh)
    if (!isV2(p)) {
      // X continua certo; Y é relativo à tela (sem a rolagem), então fica só como aproximação
      if (Number.isFinite(x) && Number.isFinite(y) && y >= 0) {
        if (r.event_type === 'click' && Number(p.vw) > 0) vws.push(Number(p.vw))
        pontosLegado.push({ x: Math.min(1, Math.max(0, x)), y, dh: 0, rage: r.event_type === 'rage_click', legado: true })
      }
      continue
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || !(dh > 0) || y < 0 || y > dh) continue
    if (r.event_type === 'click') {
      const vw = Number(p.vw)
      if (vw > 0) vws.push(vw)
      alturas.push(dh)
    }
    pontos.push({ x: Math.min(1, Math.max(0, x)), y, dh, rage: r.event_type === 'rage_click' })
  }

  for (const r of leaveRows) {
    if (!isAlvo(r)) continue
    const p = r.props ?? {}
    if (!isV2(p)) continue
    const sc = Number(p.max_scroll)
    if (!Number.isFinite(sc)) continue
    scrolls.push(Math.min(100, Math.max(0, sc)))
    const dh = Number(p.dh)
    if (dh > 0) alturas.push(dh)
  }

  const viewportPadrao = deviceClass === 'mobile' ? 390 : 1280
  res.status(200).json({
    ok: true,
    alvo,
    device: deviceClass,
    viewportMedio: Math.round(mediana(vws)) || viewportPadrao,
    alturaMediana: Math.round(mediana(alturas)),
    pontos: [...pontos, ...pontosLegado].slice(0, 6000),
    elementosTop: [...labels.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([nome, total]) => ({ nome, total })),
    scroll: {
      amostras: scrolls.length,
      faixas: [25, 50, 75, 90].map((limite) => ({
        limite,
        pct: scrolls.length ? Math.round((scrolls.filter((s) => s >= limite).length / scrolls.length) * 1000) / 10 : 0,
      })),
    },
    tipos: [...tipos.entries()].sort((a, b) => b[1] - a[1]).map(([nome, total]) => ({ nome, total })),
    paginas: [...paginas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([nome, total]) => ({ nome, total })),
  })
}

function mediana(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}
