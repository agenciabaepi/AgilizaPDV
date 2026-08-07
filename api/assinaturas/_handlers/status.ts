import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireTenantSession } from '../_lib/auth'
import { assertAsaasConfigured } from '../_lib/config'
import { refreshAssinaturaStatus } from '../_lib/subscription'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const { empresaId } = req.body ?? {}
  if (!empresaId) {
    res.status(400).json({ ok: false, error: 'empresaId é obrigatório.' })
    return
  }

  const auth = requireTenantSession(req, String(empresaId))
  if (typeof auth === 'string') {
    res.status(401).json({ ok: false, error: auth })
    return
  }

  try {
    assertAsaasConfigured()
    const status = await refreshAssinaturaStatus(String(empresaId))
    res.status(200).json({ ok: true, status })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: msg })
  }
}
