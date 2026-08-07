import type { VercelRequest, VercelResponse } from '@vercel/node'
import { assertSupabaseConfigured } from '../_lib/supabase'
import { handleAsaasLojaWebhook } from '../_lib/pagamentos'

const PAYMENT_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const body = (req.body ?? {}) as { event?: string; payment?: { id?: string } }
  const event = body.event ?? ''
  const paymentId = body.payment?.id

  if (!paymentId || !PAYMENT_EVENTS.has(event)) {
    res.status(200).json({ ok: true, ignored: true })
    return
  }

  try {
    assertSupabaseConfigured()
    await handleAsaasLojaWebhook(paymentId)
    res.status(200).json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[loja-online/webhook-asaas]', paymentId, msg)
    res.status(500).json({ ok: false, error: msg })
  }
}
