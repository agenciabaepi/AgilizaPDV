import { createHmac, timingSafeEqual } from 'crypto'
import type { VercelRequest } from '@vercel/node'
import { getSupabaseAdmin } from './supabase'
import type { OpcaoFreteCorreios } from './frete-types'

export const MELHOR_ENVIO_PAC_ID = 1
export const MELHOR_ENVIO_SEDEX_ID = 2
const MELHOR_ENVIO_SERVICES = `${MELHOR_ENVIO_PAC_ID},${MELHOR_ENVIO_SEDEX_ID}`
const STATE_MAX_AGE_MS = 15 * 60 * 1000
const OAUTH_SCOPE = 'shipping-calculate'

export type MelhorEnvioStoredAuth = {
  access_token: string
  refresh_token?: string
  expires_at?: number
}

type MelhorEnvioQuote = {
  id?: number
  name?: string
  price?: string | number
  custom_price?: string | number
  delivery_time?: number
  custom_delivery_time?: number
  company?: { name?: string }
  error?: string
  message?: string
}

export type MelhorEnvioProductInput = {
  id?: string
  width?: number
  height?: number
  length?: number
  weight: number
  insurance_value: number
  quantity: number
}

type OAuthState = {
  empresaId: string
  sandbox: boolean
  ts: number
  origin?: string
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '')
}

function userAgent(): string {
  return process.env.MELHOR_ENVIO_USER_AGENT?.trim() || 'AgilizaPDV (contato@agilizapdv.app)'
}

export const MELHOR_ENVIO_DEFAULT_CALLBACK =
  'https://agilizapdv.app/api/loja-online/melhor-envio-callback'

export function melhorEnvioBaseUrl(sandbox?: boolean): string {
  return sandbox ? 'https://sandbox.melhorenvio.com.br' : 'https://melhorenvio.com.br'
}

export function getMelhorEnvioClientId(): string {
  return process.env.MELHOR_ENVIO_CLIENT_ID?.trim() || ''
}

export function getMelhorEnvioClientSecret(): string {
  return process.env.MELHOR_ENVIO_CLIENT_SECRET?.trim() || ''
}

export function melhorEnvioOAuthConfigured(): boolean {
  return Boolean(getMelhorEnvioClientId() && getMelhorEnvioClientSecret())
}

export function getPublicAppOrigin(req?: VercelRequest): string {
  const fromEnv = process.env.VITE_APP_URL?.trim() || process.env.APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  const forwardedHost = req?.headers['x-forwarded-host']
  const hostHeader = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req?.headers.host
  const host = typeof hostHeader === 'string' ? hostHeader.split(',')[0]?.trim() : ''
  if (host) {
    const protoHeader = req?.headers['x-forwarded-proto']
    const protoRaw = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader
    const proto = protoRaw || (host.includes('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  }

  return 'https://agilizapdv.app'
}

export function getMelhorEnvioRedirectUri(_req?: VercelRequest): string {
  const fromEnv = process.env.MELHOR_ENVIO_REDIRECT_URI?.trim()
  if (fromEnv) return fromEnv
  // O Melhor Envio (WAF) responde 403 se o callback for localhost/http.
  // A URL precisa ser HTTPS pública e idêntica à cadastrada no app.
  return MELHOR_ENVIO_DEFAULT_CALLBACK
}

export function originHost(origin: string | undefined): string {
  if (!origin) return ''
  try {
    return new URL(origin).host
  } catch {
    return ''
  }
}

function stateSecret(): string {
  return getMelhorEnvioClientSecret() || process.env.SAAS_ADMIN_TOKEN?.trim() || 'agiliza-melhor-envio'
}

export function signMelhorEnvioState(payload: OAuthState): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', stateSecret()).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifyMelhorEnvioState(raw: string): OAuthState | null {
  const [data, sig] = raw.split('.')
  if (!data || !sig) return null
  const expected = createHmac('sha256', stateSecret()).update(data).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as OAuthState
    if (!payload?.empresaId || typeof payload.ts !== 'number') return null
    if (Date.now() - payload.ts > STATE_MAX_AGE_MS) return null
    return payload
  } catch {
    return null
  }
}

export function parseStoredMelhorEnvioAuth(raw: string | null | undefined): MelhorEnvioStoredAuth | null {
  const v = raw?.trim()
  if (!v) return null
  if (v.startsWith('{')) {
    try {
      const parsed = JSON.parse(v) as MelhorEnvioStoredAuth
      if (parsed?.access_token?.trim()) {
        return {
          access_token: parsed.access_token.trim(),
          refresh_token: parsed.refresh_token?.trim() || undefined,
          expires_at: typeof parsed.expires_at === 'number' ? parsed.expires_at : undefined,
        }
      }
    } catch {
      return null
    }
  }
  return { access_token: v }
}

export function serializeMelhorEnvioAuth(auth: MelhorEnvioStoredAuth): string {
  if (!auth.refresh_token) return auth.access_token
  return JSON.stringify({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
    expires_at: auth.expires_at ?? undefined,
  })
}

export function resolveMelhorEnvioAuth(
  storeToken: string | null | undefined,
  sandbox?: boolean
): { auth: MelhorEnvioStoredAuth | null; sandbox: boolean } {
  const fromStore = parseStoredMelhorEnvioAuth(storeToken)
  const fromEnv = parseStoredMelhorEnvioAuth(process.env.MELHOR_ENVIO_TOKEN)
  const envRefresh = process.env.MELHOR_ENVIO_REFRESH_TOKEN?.trim()
  const envAuth =
    fromEnv && !fromEnv.refresh_token && envRefresh
      ? { ...fromEnv, refresh_token: envRefresh }
      : fromEnv
  const sandboxFromEnv =
    process.env.MELHOR_ENVIO_SANDBOX === '1' || process.env.MELHOR_ENVIO_SANDBOX === 'true'
  return {
    auth: fromStore ?? envAuth ?? null,
    sandbox: sandbox === true || (sandbox !== false && sandboxFromEnv),
  }
}

export function buildMelhorEnvioAuthorizeUrl(input: {
  empresaId: string
  sandbox?: boolean
  origin?: string
  redirectUri: string
}): string {
  const clientId = getMelhorEnvioClientId()
  if (!clientId) throw new Error('MELHOR_ENVIO_CLIENT_ID não configurado no servidor.')
  const state = signMelhorEnvioState({
    empresaId: input.empresaId,
    sandbox: Boolean(input.sandbox),
    ts: Date.now(),
    origin: input.origin,
  })
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    state,
    scope: OAUTH_SCOPE,
  })
  return `${melhorEnvioBaseUrl(input.sandbox)}/oauth/authorize?${params.toString()}`
}

type TokenResponse = {
  token_type?: string
  expires_in?: number
  access_token?: string
  refresh_token?: string
  error?: string
  error_description?: string
  message?: string
}

async function requestMelhorEnvioToken(
  fields: Record<string, string>,
  sandbox?: boolean
): Promise<MelhorEnvioStoredAuth> {
  const res = await fetch(`${melhorEnvioBaseUrl(sandbox)}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent(),
    },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(20000),
  })
  const json = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok || !json.access_token) {
    const detail = json.error_description || json.message || json.error || `HTTP ${res.status}`
    throw new Error(`Melhor Envio: falha ao obter token (${detail}).`)
  }
  const expiresIn = Number(json.expires_in) || 30 * 24 * 60 * 60
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + expiresIn * 1000,
  }
}

export async function assertMelhorEnvioClientCredentials(sandbox?: boolean): Promise<void> {
  const clientId = getMelhorEnvioClientId()
  const clientSecret = getMelhorEnvioClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error('Credenciais Melhor Envio não configuradas no servidor.')
  }

  const res = await fetch(`${melhorEnvioBaseUrl(sandbox)}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': userAgent(),
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: Number.isFinite(Number(clientId)) ? Number(clientId) : clientId,
      client_secret: clientSecret,
      redirect_uri: getMelhorEnvioRedirectUri(),
      code: 'agiliza-credential-probe',
    }),
    signal: AbortSignal.timeout(15000),
  })
  const json = (await res.json().catch(() => ({}))) as TokenResponse
  if (json.error === 'invalid_client') {
    throw new Error(
      'O Melhor Envio recusou o Client ID/Secret. No painel, abra o app Agilizapdv (lápis), copie o Secret de novo e atualize MELHOR_ENVIO_CLIENT_SECRET. Enquanto isso, use Área Dev → Gerar token e cole no campo abaixo.'
    )
  }
}

export async function exchangeMelhorEnvioCode(input: {
  code: string
  redirectUri: string
  sandbox?: boolean
}): Promise<MelhorEnvioStoredAuth> {
  const clientId = getMelhorEnvioClientId()
  const clientSecret = getMelhorEnvioClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error('Credenciais Melhor Envio não configuradas no servidor.')
  }
  return requestMelhorEnvioToken(
    {
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
    },
    input.sandbox
  )
}

export async function refreshMelhorEnvioToken(
  refreshToken: string,
  sandbox?: boolean
): Promise<MelhorEnvioStoredAuth> {
  const clientId = getMelhorEnvioClientId()
  const clientSecret = getMelhorEnvioClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error('Credenciais Melhor Envio não configuradas para renovar o token.')
  }
  return requestMelhorEnvioToken(
    {
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    },
    sandbox
  )
}

export async function saveMelhorEnvioAuth(
  empresaId: string,
  auth: MelhorEnvioStoredAuth,
  sandbox?: boolean
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const payload: Record<string, unknown> = {
    loja_online_melhor_envio_token: serializeMelhorEnvioAuth(auth),
  }
  if (sandbox !== undefined) {
    payload.loja_online_melhor_envio_sandbox = sandbox ? 1 : 0
  }
  const { error } = await supabase.from('empresas_config').update(payload).eq('empresa_id', empresaId)
  if (error) throw error
}

function parseQuoteValue(q: MelhorEnvioQuote): number {
  return Number(q.custom_price ?? q.price)
}

function parseQuotePrazo(q: MelhorEnvioQuote): number {
  return Number(q.custom_delivery_time ?? q.delivery_time) || 0
}

function isPacQuote(q: MelhorEnvioQuote): boolean {
  if (q.id === MELHOR_ENVIO_PAC_ID) return true
  return /pac/i.test(q.name ?? '') && !/mini|gf/i.test(q.name ?? '')
}

function isSedexQuote(q: MelhorEnvioQuote): boolean {
  if (q.id === MELHOR_ENVIO_SEDEX_ID) return true
  return /sedex/i.test(q.name ?? '') && !/10|12|hoje|gf/i.test(q.name ?? '')
}

function usableQuote(q: MelhorEnvioQuote): boolean {
  if (q.error || (q.message && !q.price && !q.custom_price)) return false
  const valor = parseQuoteValue(q)
  return Number.isFinite(valor) && valor > 0
}

function defaultProducts(pesoKg: number, insuranceValue: number): MelhorEnvioProductInput[] {
  return [
    {
      id: 'pacote',
      width: 15,
      height: 5,
      length: 20,
      weight: Math.max(0.1, Math.min(pesoKg || 0.3, 30)),
      insurance_value: Math.max(1, Math.round((insuranceValue || 50) * 100) / 100),
      quantity: 1,
    },
  ]
}

async function postCalculate(input: {
  token: string
  sandbox?: boolean
  cepOrigem: string
  cepDestino: string
  products: MelhorEnvioProductInput[]
}): Promise<{ ok: boolean; status: number; quotes: MelhorEnvioQuote[]; errText: string }> {
  const res = await fetch(`${melhorEnvioBaseUrl(input.sandbox)}/api/v2/me/shipment/calculate`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.token.trim()}`,
      'User-Agent': userAgent(),
    },
    body: JSON.stringify({
      from: { postal_code: input.cepOrigem },
      to: { postal_code: input.cepDestino },
      products: input.products.map((p, i) => ({
        id: p.id || `item-${i + 1}`,
        width: Math.max(1, Math.round(p.width ?? 15)),
        height: Math.max(1, Math.round(p.height ?? 5)),
        length: Math.max(1, Math.round(p.length ?? 20)),
        weight: Math.max(0.1, Math.min(p.weight || 0.3, 30)),
        insurance_value: Math.max(1, Math.round((p.insurance_value || 1) * 100) / 100),
        quantity: Math.max(1, Math.round(p.quantity || 1)),
      })),
      options: { receipt: false, own_hand: false },
      services: MELHOR_ENVIO_SERVICES,
    }),
    signal: AbortSignal.timeout(20000),
  })

  const errText = res.ok ? '' : await res.text().catch(() => '')
  const json = res.ok ? ((await res.json()) as MelhorEnvioQuote[] | Record<string, MelhorEnvioQuote>) : null
  const quotes = Array.isArray(json)
    ? json
    : json && typeof json === 'object'
      ? Object.values(json)
      : []

  return { ok: res.ok, status: res.status, quotes, errText }
}

function mapPacSedex(quotes: MelhorEnvioQuote[]): OpcaoFreteCorreios[] {
  const valid = quotes.filter(usableQuote)
  const opcoes: OpcaoFreteCorreios[] = []

  const pac = valid.find(isPacQuote)
  if (pac) {
    opcoes.push({
      servico: 'pac',
      codigo: String(pac.id ?? MELHOR_ENVIO_PAC_ID),
      nome: pac.name || 'PAC',
      valor: parseQuoteValue(pac),
      prazo: parseQuotePrazo(pac),
    })
  }

  const sedex = valid.find(isSedexQuote)
  if (sedex) {
    opcoes.push({
      servico: 'sedex',
      codigo: String(sedex.id ?? MELHOR_ENVIO_SEDEX_ID),
      nome: sedex.name || 'SEDEX',
      valor: parseQuoteValue(sedex),
      prazo: parseQuotePrazo(sedex),
    })
  }

  if (opcoes.length === 0) {
    const correios = valid
      .filter((q) => q.company?.name?.toLowerCase().includes('correios') || /pac|sedex/i.test(q.name ?? ''))
      .sort((a, b) => parseQuoteValue(a) - parseQuoteValue(b))

    for (const q of correios.slice(0, 2)) {
      opcoes.push({
        servico: isSedexQuote(q) ? 'sedex' : 'pac',
        codigo: String(q.id ?? ''),
        nome: q.name || 'Correios',
        valor: parseQuoteValue(q),
        prazo: parseQuotePrazo(q),
      })
    }
  }

  return opcoes
}

function friendlyMelhorEnvioFreteError(status: number, errText: string): string {
  const raw = (errText || '').toLowerCase()
  if (
    status === 422 ||
    raw.includes('postal_code') ||
    raw.includes('cep_destino') ||
    raw.includes('cep_origem') ||
    raw.includes('inválido') ||
    raw.includes('invalido')
  ) {
    return 'CEP inválido ou sem cobertura de frete. Confira o número e tente de novo.'
  }
  if (status === 401 || raw.includes('unauthenticated')) {
    return 'Não foi possível cotar o frete agora. Tente novamente em instantes.'
  }
  if (status === 429) {
    return 'Muitas consultas de frete. Aguarde um momento e tente de novo.'
  }
  return 'Não foi possível calcular o frete para este CEP. Tente outro CEP ou tente novamente.'
}

export async function calcularFreteMelhorEnvio(input: {
  token: string
  refreshToken?: string
  sandbox?: boolean
  cepOrigem: string
  cepDestino: string
  pesoKg: number
  valorSeguro?: number
  products?: MelhorEnvioProductInput[]
  onTokenRefreshed?: (auth: MelhorEnvioStoredAuth) => Promise<void> | void
}): Promise<OpcaoFreteCorreios[]> {
  const origem = onlyDigits(input.cepOrigem)
  const destino = onlyDigits(input.cepDestino)
  if (origem.length !== 8 || destino.length !== 8) {
    throw new Error('CEP de origem ou destino inválido.')
  }

  const products =
    input.products && input.products.length > 0
      ? input.products
      : defaultProducts(input.pesoKg, input.valorSeguro ?? 50)

  let token = input.token.trim()
  let result = await postCalculate({
    token,
    sandbox: input.sandbox,
    cepOrigem: origem,
    cepDestino: destino,
    products,
  })

  const unauthenticated = result.status === 401 || /unauthenticated/i.test(result.errText)
  if (unauthenticated && input.refreshToken && melhorEnvioOAuthConfigured()) {
    const fresh = await refreshMelhorEnvioToken(input.refreshToken, input.sandbox)
    token = fresh.access_token
    await input.onTokenRefreshed?.(fresh)
    result = await postCalculate({
      token,
      sandbox: input.sandbox,
      cepOrigem: origem,
      cepDestino: destino,
      products,
    })
  }

  if (!result.ok) {
    throw new Error(friendlyMelhorEnvioFreteError(result.status, result.errText))
  }

  const opcoes = mapPacSedex(result.quotes)
  if (opcoes.length === 0) {
    throw new Error('Nenhuma opção de PAC/SEDEX disponível para este CEP.')
  }
  return opcoes
}
