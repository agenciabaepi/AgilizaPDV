import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminSession } from '../../assinaturas/_lib/auth'
import { listMetaAdAccounts, loadMetaAuth, metaOAuthConfigured } from '../_lib/meta-ads'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const empresaId = String(
    Array.isArray(req.query.empresaId) ? req.query.empresaId[0] : req.query.empresaId ?? ''
  ).trim()
  if (!empresaId) {
    res.status(400).json({ ok: false, error: 'empresaId é obrigatório.' })
    return
  }

  const includeAll =
    String(Array.isArray(req.query.all) ? req.query.all[0] : req.query.all ?? '') === '1'

  const session = requireAdminSession(req, empresaId)
  if (typeof session === 'string') {
    res.status(401).json({ ok: false, error: session })
    return
  }

  const configured = metaOAuthConfigured()
  const { auth, adAccountId } = await loadMetaAuth(empresaId)

  if (!auth?.access_token) {
    res.status(200).json({
      ok: true,
      connected: false,
      configured,
      adAccountId: null,
      accounts: [],
      filtered: !includeAll,
    })
    return
  }

  try {
    const accounts = await listMetaAdAccounts(auth.access_token, {
      includeReadOnly: includeAll,
    })
    res.status(200).json({
      ok: true,
      connected: true,
      configured,
      adAccountId,
      userId: auth.user_id ?? null,
      expiresAt: auth.expires_at ?? null,
      accounts,
      filtered: !includeAll,
    })
  } catch (err) {
    res.status(200).json({
      ok: true,
      connected: true,
      configured,
      adAccountId,
      accounts: [],
      filtered: !includeAll,
      warning: err instanceof Error ? err.message : 'Não foi possível listar contas.',
    })
  }
}
