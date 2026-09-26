import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminSession } from '../../assinaturas/_lib/auth'
import {
  buildMetaAuthorizeUrl,
  getMetaRedirectUri,
  getPublicAppOrigin,
  metaOAuthConfigured,
} from '../_lib/meta-ads'

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

  if (!metaOAuthConfigured()) {
    res.status(400).json({
      ok: false,
      error:
        'App da Meta não configurado no servidor. Cadastre META_APP_ID e META_APP_SECRET.',
    })
    return
  }

  const redirectUri = getMetaRedirectUri(req)
  const url = buildMetaAuthorizeUrl({
    empresaId,
    origin: getPublicAppOrigin(req),
    redirectUri,
  })

  res.status(200).json({ ok: true, url, redirectUri })
}
