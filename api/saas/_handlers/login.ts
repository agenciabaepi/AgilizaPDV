import type { VercelRequest, VercelResponse } from '@vercel/node'
import { assertSaasConfigured, getSaasAdminEmail, getSaasAdminPassword, getSaasAdminToken } from '../_lib/config'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  try {
    assertSaasConfigured()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: msg })
    return
  }

  const { email, password } = req.body ?? {}
  const normalizedEmail = String(email ?? '').trim().toLowerCase()
  const normalizedPassword = String(password ?? '')

  if (!normalizedEmail || !normalizedPassword) {
    res.status(400).json({ ok: false, error: 'E-mail e senha são obrigatórios.' })
    return
  }

  if (normalizedEmail !== getSaasAdminEmail() || normalizedPassword !== getSaasAdminPassword()) {
    res.status(401).json({ ok: false, error: 'Credenciais inválidas.' })
    return
  }

  res.status(200).json({
    ok: true,
    token: getSaasAdminToken(),
    email: getSaasAdminEmail(),
  })
}
