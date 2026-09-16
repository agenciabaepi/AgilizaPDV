import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  exchangeMelhorEnvioCode,
  getMelhorEnvioRedirectUri,
  getPublicAppOrigin,
  originHost,
  saveMelhorEnvioAuth,
  verifyMelhorEnvioState,
} from '../_lib/melhor-envio'

function redirect(res: VercelResponse, url: string) {
  res.status(302)
  res.setHeader('Location', url)
  res.end()
}

function redirectToEntrega(res: VercelResponse, origin: string, query: Record<string, string>) {
  const qs = new URLSearchParams(query).toString()
  redirect(res, `${origin.replace(/\/$/, '')}/#/loja-online/entrega${qs ? `?${qs}` : ''}`)
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
    redirectToEntrega(res, here, {
      melhor_envio: 'error',
      melhor_envio_msg: 'Autorização cancelada no Melhor Envio.',
    })
    return
  }

  const state = verifyMelhorEnvioState(stateRaw)
  if (!state) {
    redirectToEntrega(res, here, {
      melhor_envio: 'error',
      melhor_envio_msg: 'Sessão de autorização expirada. Tente conectar de novo.',
    })
    return
  }

  const origin = state.origin || here

  // Melhor Envio só devolve o code na URL pública. Se o login começou no localhost,
  // encaminha o code para o painel local trocar o token (lá estão as credenciais).
  if (code && originHost(origin) && originHost(origin) !== originHost(here)) {
    const bounce = new URL('/api/loja-online/melhor-envio-callback', `${origin.replace(/\/$/, '')}/`)
    bounce.searchParams.set('code', code)
    bounce.searchParams.set('state', stateRaw)
    redirect(res, bounce.toString())
    return
  }

  if (!code) {
    redirectToEntrega(res, origin, {
      melhor_envio: 'error',
      melhor_envio_msg: 'Código de autorização não recebido.',
    })
    return
  }

  try {
    const auth = await exchangeMelhorEnvioCode({
      code,
      redirectUri: getMelhorEnvioRedirectUri(req),
      sandbox: state.sandbox,
    })
    await saveMelhorEnvioAuth(state.empresaId, auth, state.sandbox)
    redirectToEntrega(res, origin, { melhor_envio: 'ok' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falha ao conectar Melhor Envio.'
    redirectToEntrega(res, origin, {
      melhor_envio: 'error',
      melhor_envio_msg: msg.slice(0, 180),
    })
  }
}
