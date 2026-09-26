import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  exchangeMetaCode,
  getMetaRedirectUri,
  getPublicAppOrigin,
  originHost,
  saveMetaAuth,
  verifyMetaState,
} from '../_lib/meta-ads'

function redirect(res: VercelResponse, url: string) {
  res.status(302)
  res.setHeader('Location', url)
  res.end()
}

function redirectToDashboard(res: VercelResponse, origin: string, query: Record<string, string>) {
  const qs = new URLSearchParams(query).toString()
  redirect(res, `${origin.replace(/\/$/, '')}/#/loja-online/dashboard${qs ? `?${qs}` : ''}`)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const q = req.query
  const code = String(Array.isArray(q.code) ? q.code[0] : q.code ?? '').trim()
  const stateRaw = String(Array.isArray(q.state) ? q.state[0] : q.state ?? '').trim()
  const errorParam = String(Array.isArray(q.error) ? q.error[0] : q.error ?? '').trim()
  const here = getPublicAppOrigin(req)

  if (errorParam) {
    redirectToDashboard(res, here, {
      meta: 'error',
      meta_msg: 'Autorização cancelada na Meta.',
    })
    return
  }

  const state = verifyMetaState(stateRaw)
  if (!state) {
    redirectToDashboard(res, here, {
      meta: 'error',
      meta_msg: 'Sessão de autorização expirada. Tente conectar de novo.',
    })
    return
  }

  const origin = state.origin || here

  if (code && originHost(origin) && originHost(origin) !== originHost(here)) {
    const bounce = new URL('/api/loja-online/meta-callback', `${origin.replace(/\/$/, '')}/`)
    bounce.searchParams.set('code', code)
    bounce.searchParams.set('state', stateRaw)
    redirect(res, bounce.toString())
    return
  }

  if (!code) {
    redirectToDashboard(res, origin, {
      meta: 'error',
      meta_msg: 'Código de autorização não recebido.',
    })
    return
  }

  try {
    const auth = await exchangeMetaCode({
      code,
      redirectUri: getMetaRedirectUri(req),
    })
    await saveMetaAuth(state.empresaId, auth)
    redirectToDashboard(res, origin, { meta: 'ok' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falha ao conectar Meta Ads.'
    redirectToDashboard(res, origin, {
      meta: 'error',
      meta_msg: msg.slice(0, 180),
    })
  }
}
