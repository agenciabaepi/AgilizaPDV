import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminSession } from '../../assinaturas/_lib/auth'
import {
  assertMelhorEnvioClientCredentials,
  buildMelhorEnvioAuthorizeUrl,
  getMelhorEnvioRedirectUri,
  getPublicAppOrigin,
  melhorEnvioOAuthConfigured,
} from '../_lib/melhor-envio'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const body = (req.body ?? {}) as { empresaId?: string; sandbox?: boolean }
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

  if (!melhorEnvioOAuthConfigured()) {
    res.status(400).json({
      ok: false,
      error:
        'Client ID e Secret do Melhor Envio não estão no servidor. Cadastre MELHOR_ENVIO_CLIENT_ID e MELHOR_ENVIO_CLIENT_SECRET.',
    })
    return
  }

  try {
    await assertMelhorEnvioClientCredentials(Boolean(body.sandbox))
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Falha ao validar credenciais do Melhor Envio.',
    })
    return
  }

  const redirectUri = getMelhorEnvioRedirectUri(req)
  const url = buildMelhorEnvioAuthorizeUrl({
    empresaId,
    sandbox: Boolean(body.sandbox),
    origin: getPublicAppOrigin(req),
    redirectUri,
  })

  res.status(200).json({ ok: true, url, redirectUri })
}
