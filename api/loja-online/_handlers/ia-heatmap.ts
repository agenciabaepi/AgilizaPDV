import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from '../_lib/supabase'
import { param, parsePeriodo, requireIaAdmin } from '../_lib/ia-request'
import { lojaPageType, normalizeLojaPath } from '../_lib/inteligencia-metricas'

const MAX_ROWS = 20_000

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
  const rows: Row[] = []
  for (let from = 0; from < MAX_ROWS; from += 1000) {
    const { data, error } = await supabase
      .from('loja_online_comportamento')
      .select('event_type, path, device, props')
      .eq('empresa_id', auth.empresaId)
      .in('event_type', ['click', 'page_leave', 'rage_click'])
      .gte('created_at', periodo.inicio)
      .lte('created_at', periodo.fim)
      .order('created_at', { ascending: false })
      .range(from, from + 999)
    if (error) {
      res.status(500).json({ ok: false, error: error.message })
      return
    }
    rows.push(...((data ?? []) as Row[]))
    if (!data || data.length < 1000) break
  }

  const matches = (path: string | null) =>
    alvo.startsWith('tipo:') ? lojaPageType(path) === alvo.slice(5) : normalizeLojaPath(path) === alvo
  const isMobile = (d: string | null) => d === 'mobile' || d === 'tablet'

  const paginas = new Map<string, number>()
  const tipos = new Map<string, number>()
  const pontos: { x: number; y: number; dh: number; rage: boolean }[] = []
  const labels = new Map<string, number>()
  const scrolls: number[] = []
  let vwSum = 0

  for (const r of rows) {
    if (r.event_type === 'click') {
      bump(paginas, normalizeLojaPath(r.path))
      bump(tipos, lojaPageType(r.path))
    }
    if (!matches(r.path) || isMobile(r.device) !== (deviceClass === 'mobile')) continue
    const p = r.props ?? {}
    if (r.event_type === 'page_leave') {
      const sc = Number(p.max_scroll)
      if (Number.isFinite(sc)) scrolls.push(sc)
      continue
    }
    const x = Number(p.x)
    const y = Number(p.y)
    const dh = Number(p.dh)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    if (r.event_type === 'click') {
      vwSum += Number(p.vw) || 0
      const label = typeof p.label === 'string' ? p.label : null
      if (label) bump(labels, label)
    }
    pontos.push({ x, y, dh: Number.isFinite(dh) ? dh : 0, rage: r.event_type === 'rage_click' })
  }

  const cliques = pontos.filter((p) => !p.rage).length
  res.status(200).json({
    ok: true,
    alvo,
    device: deviceClass,
    viewportMedio: cliques ? Math.round(vwSum / cliques) : deviceClass === 'mobile' ? 390 : 1280,
    pontos: pontos.slice(0, 6000),
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

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}
