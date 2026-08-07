import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminSession } from '../_lib/auth'
import { assertAsaasConfigured } from '../_lib/config'
import { createCheckout } from '../_lib/subscription'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const { empresaId, planoId } = req.body ?? {}
  if (!empresaId) {
    res.status(400).json({ ok: false, error: 'empresaId é obrigatório.' })
    return
  }

  const auth = requireAdminSession(req, String(empresaId))
  if (typeof auth === 'string') {
    res.status(401).json({ ok: false, error: auth })
    return
  }

  try {
    assertAsaasConfigured()
    const plano =
      planoId === 'basic' || planoId === 'pro' || planoId === 'ultra' ? planoId : undefined
    const checkout = await createCheckout(String(empresaId), plano)
    res.status(200).json({
      ok: true,
      status: checkout.status,
      paymentId: checkout.paymentId,
      valor: checkout.valor,
      pix: checkout.pix,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const status = msg.includes('já está ativa') ? 403 : 500
    res.status(status).json({ ok: false, error: msg })
  }
}
