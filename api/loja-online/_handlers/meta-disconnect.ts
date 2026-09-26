import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminSession } from '../../assinaturas/_lib/auth'
import { clearMetaAuth } from '../_lib/meta-ads'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const body = (req.body ?? {}) as { empresaId?: string }
  const empresaId = String(body.empresaId ?? '').trim()
  if (!empresaId) {
    res.status(400).json({ ok: false, error: 'empresaId é obrigatório.' })
    return
  }

  const session = requireAdminSession(req, empresaId)
  if (typeof session === 'string') {
    res.status(401).json({ ok: false, error: session })
    return
  }

  try {
    await clearMetaAuth(empresaId)
    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Falha ao desconectar.',
    })
  }
}
