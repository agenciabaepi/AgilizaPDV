import type { VercelRequest } from '@vercel/node'
import { createHmac, timingSafeEqual } from 'crypto'
import { getSupabaseAdmin } from './supabase'

const GRAPH_VERSION = 'v21.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`
const STATE_MAX_AGE_MS = 15 * 60 * 1000
const OAUTH_SCOPES = ['ads_read', 'ads_management', 'business_management'].join(',')

export type MetaOAuthStored = {
  access_token: string
  token_type?: string
  expires_at?: number
  user_id?: string
  ad_account_id?: string
}

type OAuthState = {
  empresaId: string
  ts: number
  origin?: string
}

export const META_DEFAULT_CALLBACK = 'https://agilizapdv.app/api/loja-online/meta-callback'

export function getMetaAppId(): string {
  return process.env.META_APP_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim() || ''
}

export function getMetaAppSecret(): string {
  return process.env.META_APP_SECRET?.trim() || process.env.FACEBOOK_APP_SECRET?.trim() || ''
}

export function metaOAuthConfigured(): boolean {
  return Boolean(getMetaAppId() && getMetaAppSecret())
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

export function getMetaRedirectUri(_req?: VercelRequest): string {
  const fromEnv = process.env.META_REDIRECT_URI?.trim()
  if (fromEnv) return fromEnv
  return META_DEFAULT_CALLBACK
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
  return getMetaAppSecret() || process.env.SAAS_ADMIN_TOKEN?.trim() || 'agiliza-meta-ads'
}

export function signMetaState(payload: OAuthState): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', stateSecret()).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifyMetaState(raw: string): OAuthState | null {
  const [data, sig] = raw.split('.')
  if (!data || !sig) return null
  const expected = createHmac('sha256', stateSecret()).update(data).digest('base64url')
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as OAuthState
    if (!payload?.empresaId || !payload.ts) return null
    if (Date.now() - payload.ts > STATE_MAX_AGE_MS) return null
    return payload
  } catch {
    return null
  }
}

export function parseStoredMetaAuth(raw: string | null | undefined): MetaOAuthStored | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as MetaOAuthStored
    if (!parsed?.access_token) return null
    return parsed
  } catch {
    // token plain
    return { access_token: raw.trim() }
  }
}

export function serializeMetaAuth(auth: MetaOAuthStored): string {
  return JSON.stringify(auth)
}

export async function loadMetaAuth(empresaId: string): Promise<{
  auth: MetaOAuthStored | null
  adAccountId: string | null
}> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('empresas_config')
    .select('loja_online_meta_oauth_token, loja_online_meta_ad_account_id')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  return {
    auth: parseStoredMetaAuth(data?.loja_online_meta_oauth_token),
    adAccountId: data?.loja_online_meta_ad_account_id?.trim() || null,
  }
}

export async function saveMetaAuth(empresaId: string, auth: MetaOAuthStored): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('empresas_config')
    .update({ loja_online_meta_oauth_token: serializeMetaAuth(auth) })
    .eq('empresa_id', empresaId)
  if (error) throw new Error(error.message)
}

export async function saveMetaAdAccount(empresaId: string, adAccountId: string | null): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { auth } = await loadMetaAuth(empresaId)
  const nextAuth = auth
    ? { ...auth, ad_account_id: adAccountId || undefined }
    : null
  const { error } = await supabase
    .from('empresas_config')
    .update({
      loja_online_meta_ad_account_id: adAccountId,
      ...(nextAuth ? { loja_online_meta_oauth_token: serializeMetaAuth(nextAuth) } : {}),
    })
    .eq('empresa_id', empresaId)
  if (error) throw new Error(error.message)
}

export async function clearMetaAuth(empresaId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('empresas_config')
    .update({
      loja_online_meta_oauth_token: null,
      loja_online_meta_ad_account_id: null,
    })
    .eq('empresa_id', empresaId)
  if (error) throw new Error(error.message)
}

export function buildMetaAuthorizeUrl(input: {
  empresaId: string
  origin?: string
  redirectUri: string
}): string {
  const appId = getMetaAppId()
  if (!appId) throw new Error('META_APP_ID não configurado no servidor.')
  const state = signMetaState({
    empresaId: input.empresaId,
    ts: Date.now(),
    origin: input.origin,
  })
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: input.redirectUri,
    state,
    scope: OAUTH_SCOPES,
    response_type: 'code',
  })
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`
}

export async function exchangeMetaCode(input: {
  code: string
  redirectUri: string
}): Promise<MetaOAuthStored> {
  const appId = getMetaAppId()
  const secret = getMetaAppSecret()
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: secret,
    redirect_uri: input.redirectUri,
    code: input.code,
  })
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`)
  const data = (await res.json()) as {
    access_token?: string
    token_type?: string
    expires_in?: number
    error?: { message?: string }
  }
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message || 'Falha ao obter token da Meta.')
  }

  // Troca por long-lived token
  const llParams = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: secret,
    fb_exchange_token: data.access_token,
  })
  const llRes = await fetch(`${GRAPH_BASE}/oauth/access_token?${llParams.toString()}`)
  const llData = (await llRes.json()) as {
    access_token?: string
    token_type?: string
    expires_in?: number
  }
  const accessToken = llData.access_token || data.access_token
  const expiresIn = llData.expires_in ?? data.expires_in

  let userId: string | undefined
  try {
    const meRes = await fetch(`${GRAPH_BASE}/me?fields=id&access_token=${encodeURIComponent(accessToken)}`)
    const me = (await meRes.json()) as { id?: string }
    userId = me.id
  } catch {
    /* ignore */
  }

  return {
    access_token: accessToken,
    token_type: llData.token_type || data.token_type || 'bearer',
    expires_at: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
    user_id: userId,
  }
}

export type MetaAdAccount = {
  id: string
  account_id: string
  name: string
  currency?: string
  account_status?: number
  user_tasks?: string[]
  read_only?: boolean
}

export async function listMetaAdAccounts(
  accessToken: string,
  opts?: { includeReadOnly?: boolean }
): Promise<MetaAdAccount[]> {
  const includeReadOnly = opts?.includeReadOnly === true
  const accounts: MetaAdAccount[] = []
  let nextUrl: string | null =
    `${GRAPH_BASE}/me/adaccounts?fields=id,account_id,name,currency,account_status,user_tasks&limit=100&access_token=${encodeURIComponent(accessToken)}`

  while (nextUrl) {
    const res = await fetch(nextUrl)
    const data = (await res.json()) as {
      data?: Array<{
        id: string
        account_id?: string
        name?: string
        currency?: string
        account_status?: number
        user_tasks?: string[]
      }>
      paging?: { next?: string }
      error?: { message?: string }
    }
    if (!res.ok) throw new Error(data.error?.message || 'Falha ao listar contas de anúncio.')

    for (const a of data.data ?? []) {
      const name = a.name || a.id
      const tasks = a.user_tasks ?? []
      const readOnlyByName = /\(read-?only\)/i.test(name)
      const canAdvertise =
        tasks.includes('MANAGE') || tasks.includes('ADVERTISE')
      const isActive = a.account_status == null || a.account_status === 1
      const readOnly =
        readOnlyByName || (tasks.length > 0 && !canAdvertise)

      if (!includeReadOnly) {
        if (readOnlyByName) continue
        if (!isActive) continue
        // Sem user_tasks na resposta: mantém. Com tasks: só MANAGE/ADVERTISE.
        if (tasks.length > 0 && !canAdvertise) continue
      }

      accounts.push({
        id: a.id,
        account_id: a.account_id || a.id.replace(/^act_/, ''),
        name,
        currency: a.currency,
        account_status: a.account_status,
        user_tasks: tasks,
        read_only: readOnly,
      })
    }

    nextUrl = data.paging?.next ?? null
    if (accounts.length >= 200) break
  }

  return accounts.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

function normalizeActId(adAccountId: string): string {
  const id = adAccountId.trim()
  if (!id) return ''
  return id.startsWith('act_') ? id : `act_${id}`
}

export type MetaCampaignInsight = {
  campaign_id: string
  campaign_name: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  purchases: number
  purchase_value: number
  roas: number
}

export type MetaDemoPoint = { name: string; value: number }

export type MetaInsightsPayload = {
  spend: number
  impressions: number
  clicks: number
  ctr: number
  purchases: number
  purchase_value: number
  roas: number
  campaigns: MetaCampaignInsight[]
  age: MetaDemoPoint[]
  gender: MetaDemoPoint[]
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : 0
  return Number.isFinite(n) ? n : 0
}

function extractPurchases(actions: Array<{ action_type?: string; value?: string }> | undefined): {
  count: number
  value: number
} {
  if (!actions?.length) return { count: 0, value: 0 }
  const purchase =
    actions.find((a) => a.action_type === 'purchase') ||
    actions.find((a) => a.action_type === 'omni_purchase') ||
    actions.find((a) => a.action_type === 'offsite_conversion.fb_pixel_purchase')
  return { count: num(purchase?.value), value: 0 }
}

function extractPurchaseValue(
  actionValues: Array<{ action_type?: string; value?: string }> | undefined
): number {
  if (!actionValues?.length) return 0
  const purchase =
    actionValues.find((a) => a.action_type === 'purchase') ||
    actionValues.find((a) => a.action_type === 'omni_purchase') ||
    actionValues.find((a) => a.action_type === 'offsite_conversion.fb_pixel_purchase')
  return num(purchase?.value)
}

export async function fetchMetaInsights(input: {
  accessToken: string
  adAccountId: string
  since: string
  until: string
}): Promise<MetaInsightsPayload> {
  const act = normalizeActId(input.adAccountId)
  if (!act) throw new Error('Conta de anúncio não selecionada.')

  const timeRange = JSON.stringify({ since: input.since, until: input.until })
  const fields =
    'campaign_id,campaign_name,spend,impressions,clicks,ctr,actions,action_values'

  const campUrl = new URL(`${GRAPH_BASE}/${act}/insights`)
  campUrl.searchParams.set('level', 'campaign')
  campUrl.searchParams.set('fields', fields)
  campUrl.searchParams.set('time_range', timeRange)
  campUrl.searchParams.set('limit', '50')
  campUrl.searchParams.set('access_token', input.accessToken)

  const campRes = await fetch(campUrl.toString())
  const campData = (await campRes.json()) as {
    data?: Array<{
      campaign_id?: string
      campaign_name?: string
      spend?: string
      impressions?: string
      clicks?: string
      ctr?: string
      actions?: Array<{ action_type?: string; value?: string }>
      action_values?: Array<{ action_type?: string; value?: string }>
    }>
    error?: { message?: string }
  }
  if (!campRes.ok) throw new Error(campData.error?.message || 'Falha ao buscar insights.')

  const campaigns: MetaCampaignInsight[] = (campData.data ?? []).map((row) => {
    const purchases = extractPurchases(row.actions)
    const purchaseValue = extractPurchaseValue(row.action_values)
    const spend = num(row.spend)
    return {
      campaign_id: row.campaign_id || '',
      campaign_name: row.campaign_name || 'Campanha',
      spend,
      impressions: num(row.impressions),
      clicks: num(row.clicks),
      ctr: num(row.ctr),
      purchases: purchases.count,
      purchase_value: purchaseValue,
      roas: spend > 0 ? purchaseValue / spend : 0,
    }
  })

  let spend = 0
  let impressions = 0
  let clicks = 0
  let purchases = 0
  let purchaseValue = 0
  for (const c of campaigns) {
    spend += c.spend
    impressions += c.impressions
    clicks += c.clicks
    purchases += c.purchases
    purchaseValue += c.purchase_value
  }
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
  const roas = spend > 0 ? purchaseValue / spend : 0

  // Demografia
  const age = await fetchBreakdown(act, input.accessToken, timeRange, 'age')
  const gender = await fetchBreakdown(act, input.accessToken, timeRange, 'gender')

  return {
    spend,
    impressions,
    clicks,
    ctr,
    purchases,
    purchase_value: purchaseValue,
    roas,
    campaigns,
    age,
    gender,
  }
}

async function fetchBreakdown(
  act: string,
  accessToken: string,
  timeRange: string,
  breakdown: 'age' | 'gender'
): Promise<MetaDemoPoint[]> {
  try {
    const url = new URL(`${GRAPH_BASE}/${act}/insights`)
    url.searchParams.set('fields', 'impressions')
    url.searchParams.set('breakdowns', breakdown)
    url.searchParams.set('time_range', timeRange)
    url.searchParams.set('limit', '50')
    url.searchParams.set('access_token', accessToken)
    const res = await fetch(url.toString())
    const data = (await res.json()) as {
      data?: Array<{ age?: string; gender?: string; impressions?: string }>
    }
    if (!res.ok) return []
    return (data.data ?? [])
      .map((row) => ({
        name:
          breakdown === 'age'
            ? row.age || '—'
            : row.gender === 'male'
              ? 'Masculino'
              : row.gender === 'female'
                ? 'Feminino'
                : row.gender || 'Outro',
        value: num(row.impressions),
      }))
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value)
  } catch {
    return []
  }
}

export function toMetaDate(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
