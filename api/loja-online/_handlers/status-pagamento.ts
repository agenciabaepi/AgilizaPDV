import type { VercelRequest, VercelResponse } from '@vercel/node'
import { assertSupabaseConfigured } from '../_lib/supabase'
import { consultarStatusPagamento } from '../_lib/pagamentos'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const pedidoId = String(req.query.pedidoId ?? '').trim()
  const slug = String(req.query.slug ?? '').trim()
  if (!pedidoId || !slug) {
    res.status(400).json({ ok: false, error: 'pedidoId e slug são obrigatórios.' })
    return
  }

  try {
    assertSupabaseConfigured()
    const result = await consultarStatusPagamento(pedidoId, slug)
    res.status(200).json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: msg })
  }
}
