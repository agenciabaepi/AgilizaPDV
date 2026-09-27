import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from '../_lib/supabase'
import { parsePeriodo, requireIaAdmin } from '../_lib/ia-request'
import { loadCapaPersonalizada } from '../_lib/capa-funil'

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
    const capa = await loadCapaPersonalizada(getSupabaseAdmin(), auth.empresaId, periodo.inicio, periodo.fim)
    res.status(200).json({ ok: true, capa })
  } catch (err) {
    console.error('[loja-online/capa-metricas]', err)
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Falha ao calcular métricas da capa.' })
  }
}
