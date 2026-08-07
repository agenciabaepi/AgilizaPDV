import type { VercelRequest, VercelResponse } from '@vercel/node'
import { assertSupabaseConfigured } from '../_lib/supabase'
import { processarPagamentoMercadoPagoTransparente } from '../_lib/pagamentos'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const body = (req.body ?? {}) as {
    pedidoId?: string
    slug?: string
    formData?: Record<string, unknown>
  }

  const pedidoId = String(body.pedidoId ?? '').trim()
  const slug = String(body.slug ?? '').trim()
  const formData = body.formData

  if (!pedidoId || !slug || !formData) {
    res.status(400).json({ ok: false, error: 'pedidoId, slug e formData são obrigatórios.' })
    return
  }

  try {
    assertSupabaseConfigured()
    const result = await processarPagamentoMercadoPagoTransparente(pedidoId, slug, formData)
    res.status(200).json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: msg })
  }
}
