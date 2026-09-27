import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from '../_lib/supabase'
import { parsePeriodo, requireIaAdmin } from '../_lib/ia-request'
import { loadInteligenciaMetricas } from '../_lib/inteligencia-metricas'

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
  try {
    const metricas = await loadInteligenciaMetricas(getSupabaseAdmin(), auth.empresaId, periodo.inicio, periodo.fim)
    res.status(200).json({ ok: true, metricas })
  } catch (err) {
    console.error('[loja-online/ia-metricas]', err)
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Falha ao calcular métricas.' })
  }
}
