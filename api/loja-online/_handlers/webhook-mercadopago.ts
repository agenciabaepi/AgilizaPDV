import type { VercelRequest, VercelResponse } from '@vercel/node'
import { assertSupabaseConfigured } from '../_lib/supabase'
import { handleMercadoPagoWebhook } from '../_lib/pagamentos'

function extractPaymentId(req: VercelRequest): string | null {
  const q = req.query
  const id =
    q['data.id'] ||
    q.id ||
    (req.body as { data?: { id?: string }; id?: string })?.data?.id ||
    (req.body as { id?: string })?.id
  return id ? String(id) : null
}

function isPaymentNotification(req: VercelRequest): boolean {
  const topic = req.query.topic || (req.body as { type?: string; action?: string })?.type || (req.body as { action?: string })?.action
  const t = String(topic ?? '')
  return t === 'payment' || t.includes('payment')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  if (!isPaymentNotification(req)) {
    res.status(200).json({ ok: true, ignored: true })
    return
  }

  const paymentId = extractPaymentId(req)
  if (!paymentId) {
    res.status(200).json({ ok: true, ignored: true })
    return
  }

  try {
    assertSupabaseConfigured()
    await handleMercadoPagoWebhook(paymentId)
    res.status(200).json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[loja-online/webhook-mercadopago]', paymentId, msg)
    res.status(500).json({ ok: false, error: msg })
  }
}
