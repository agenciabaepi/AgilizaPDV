import type { VercelRequest, VercelResponse } from '@vercel/node'
import { assertSupabaseConfigured } from '../_lib/supabase'
import { getLojaConfigBySlug, toPagamentosPublicos } from '../_lib/config'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const slug = String(req.query.slug ?? '').trim()
  if (!slug) {
    res.status(400).json({ ok: false, error: 'slug é obrigatório.' })
    return
  }

  try {
    assertSupabaseConfigured()
    const cfg = await getLojaConfigBySlug(slug)
    if (!cfg) {
      res.status(404).json({ ok: false, error: 'Loja não encontrada.' })
      return
    }
    res.status(200).json({ ok: true, pagamentos: toPagamentosPublicos(cfg) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: msg })
  }
}
