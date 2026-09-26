import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminSession } from '../../assinaturas/_lib/auth'
import { saveMetaAdAccount } from '../_lib/meta-ads'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const body = (req.body ?? {}) as { empresaId?: string; adAccountId?: string }
  const empresaId = String(body.empresaId ?? '').trim()
  const adAccountId = String(body.adAccountId ?? '').trim()
  if (!empresaId || !adAccountId) {
    res.status(400).json({ ok: false, error: 'empresaId e adAccountId são obrigatórios.' })
    return
  }

  const session = requireAdminSession(req, empresaId)
  if (typeof session === 'string') {
    res.status(401).json({ ok: false, error: session })
    return
  }

  try {
    await saveMetaAdAccount(empresaId, adAccountId)
    res.status(200).json({ ok: true, adAccountId })
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Falha ao salvar conta.',
    })
  }
}
