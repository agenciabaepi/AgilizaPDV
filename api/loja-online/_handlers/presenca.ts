import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from '../_lib/supabase'
import { clip, isBotRequest, resolveVisitorGeo } from '../_lib/visitor'
import { requireIaAdmin } from '../_lib/ia-request'

/** Sem sinal de vida por mais que isso, o visitante sai do "Ao vivo". */
const EXPIRA_MS = 75_000
const LOJA_ATIVA_TTL_MS = 5 * 60_000
const lojaAtivaCache = new Map<string, { ativa: boolean; ate: number }>()

async function lojaAtiva(supabase: ReturnType<typeof getSupabaseAdmin>, empresaId: string): Promise<boolean> {
  const hit = lojaAtivaCache.get(empresaId)
  if (hit && hit.ate > Date.now()) return hit.ativa
  const { data } = await supabase
    .from('empresas_config')
    .select('loja_online_ativa')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  const ativa = Number(data?.loja_online_ativa) === 1
  lojaAtivaCache.set(empresaId, { ativa, ate: Date.now() + LOJA_ATIVA_TTL_MS })
  return ativa
}

function isoOuAgora(v: unknown): string {
  const n = typeof v === 'number' ? v : NaN
  const agora = Date.now()
  return Number.isFinite(n) && n > agora - 24 * 3600_000 && n <= agora + 60_000 ? new Date(n).toISOString() : new Date(agora).toISOString()
}

async function registrar(req: VercelRequest, res: VercelResponse) {
  let body = req.body as unknown
  // sendBeacon envia text/plain
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = null
    }
  }
  const b = (body ?? {}) as Record<string, unknown>
  const empresaId = clip(b.empresaId, 80)
  const sessionId = clip(b.sessionId, 80)
  if (!empresaId || !sessionId) {
    res.status(400).json({ ok: false, error: 'Payload inválido.' })
    return
  }
  if (isBotRequest(req)) {
    res.status(204).end()
    return
  }

  const supabase = getSupabaseAdmin()
  if (!(await lojaAtiva(supabase, empresaId))) {
    res.status(404).json({ ok: false, error: 'Loja não encontrada.' })
    return
  }

  if (b.saindo === true) {
    await supabase.from('loja_online_presenca').delete().eq('empresa_id', empresaId).eq('session_id', sessionId)
    res.status(204).end()
    return
  }

  const row: Record<string, unknown> = {
    empresa_id: empresaId,
    session_id: sessionId,
    path: clip(b.path, 500),
    titulo: clip(b.titulo, 200),
    device: clip(b.device, 40),
    carrinho: b.carrinho === true,
    checkout: b.checkout === true,
    oculto: b.oculto === true,
    desde: isoOuAgora(b.desde),
    pagina_desde: isoOuAgora(b.paginaDesde),
    last_seen: new Date().toISOString(),
  }
  if (b.primeiro === true) Object.assign(row, await resolveVisitorGeo(req))

  const { error } = await supabase.from('loja_online_presenca').upsert(row, { onConflict: 'empresa_id,session_id' })
  if (error) {
    console.error('[loja-online/presenca]', error.message)
    res.status(500).json({ ok: false, error: 'Falha ao registrar presença.' })
    return
  }
  res.status(204).end()
}

async function listar(req: VercelRequest, res: VercelResponse) {
  const auth = requireIaAdmin(req, res)
  if (!auth) return
  const supabase = getSupabaseAdmin()
  const limite = new Date(Date.now() - EXPIRA_MS).toISOString()
  const { data, error } = await supabase
    .from('loja_online_presenca')
    .select('session_id, path, titulo, device, country, region, city, carrinho, checkout, oculto, desde, pagina_desde, last_seen')
    .eq('empresa_id', auth.empresaId)
    .gte('last_seen', limite)
    .order('desde', { ascending: true })
    .limit(500)
  if (error) {
    res.status(500).json({ ok: false, error: error.message })
    return
  }
  void supabase
    .from('loja_online_presenca')
    .delete()
    .eq('empresa_id', auth.empresaId)
    .lt('last_seen', new Date(Date.now() - 24 * 3600_000).toISOString())
    .then(() => undefined)
  res.status(200).json({ ok: true, agora: Date.now(), visitantes: data ?? [] })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method === 'POST') return registrar(req, res)
  if (req.method === 'GET') return listar(req, res)
  res.status(405).json({ ok: false, error: 'Método não permitido.' })
}
