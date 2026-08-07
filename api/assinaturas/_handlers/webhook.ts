import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAsaasWebhookToken } from '../_lib/config'
import { handlePaymentWebhook } from '../_lib/subscription'

type AsaasWebhookBody = {
  id?: string
  event?: string
  payment?: { id?: string }
}

const PAYMENT_EVENTS = new Set([
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_OVERDUE',
])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const webhookToken = getAsaasWebhookToken()
  if (webhookToken) {
    const token = req.headers['asaas-access-token']
    if (token !== webhookToken) {
      res.status(401).json({ ok: false, error: 'Token de webhook inválido.' })
      return
    }
  }

  const body = (req.body ?? {}) as AsaasWebhookBody
  const event = body.event ?? ''
  const paymentId = body.payment?.id

  if (!paymentId || !PAYMENT_EVENTS.has(event)) {
    res.status(200).json({ ok: true, ignored: true })
    return
  }

  try {
    await handlePaymentWebhook(paymentId, event)
    res.status(200).json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[assinaturas/webhook]', event, paymentId, msg)
    res.status(500).json({ ok: false, error: msg })
  }
}
