import { WEB_SESSION_KEY } from './auth-session'

function sessionHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem(WEB_SESSION_KEY)
    if (!raw) return {}
    return { 'X-Agiliza-Session': btoa(raw) }
  } catch {
    return {}
  }
}

export type MetaAdAccountOption = {
  id: string
  account_id: string
  name: string
  currency?: string
  read_only?: boolean
}

export type MetaStatusResponse = {
  ok: boolean
  connected: boolean
  configured: boolean
  adAccountId: string | null
  accounts: MetaAdAccountOption[]
  filtered?: boolean
  warning?: string
  error?: string
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

export type MetaInsights = {
  spend: number
  impressions: number
  clicks: number
  ctr: number
  purchases: number
  purchase_value: number
  roas: number
  campaigns: MetaCampaignInsight[]
  age: { name: string; value: number }[]
  gender: { name: string; value: number }[]
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text.trim()) {
    throw new Error(`Servidor retornou resposta vazia (HTTP ${res.status}).`)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Resposta inválida da API Meta.')
  }
}

export async function metaAuthStart(empresaId: string): Promise<{ url: string }> {
  const res = await fetch('/api/loja-online/meta-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({ empresaId }),
  })
  const data = await parseJson<{ ok: boolean; url?: string; error?: string }>(res)
  if (!res.ok || !data.ok || !data.url) throw new Error(data.error || 'Falha ao iniciar OAuth Meta.')
  return { url: data.url }
}

export async function metaStatus(
  empresaId: string,
  opts?: { includeAll?: boolean }
): Promise<MetaStatusResponse> {
  const qs = new URLSearchParams({ empresaId })
  if (opts?.includeAll) qs.set('all', '1')
  const res = await fetch(`/api/loja-online/meta-status?${qs}`, {
    headers: { ...sessionHeaders() },
  })
  const data = await parseJson<MetaStatusResponse>(res)
  if (!res.ok || data.ok === false) throw new Error(data.error || 'Falha ao consultar status Meta.')
  return data
}

export async function metaSelectAccount(empresaId: string, adAccountId: string): Promise<void> {
  const res = await fetch('/api/loja-online/meta-select-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({ empresaId, adAccountId }),
  })
  const data = await parseJson<{ ok: boolean; error?: string }>(res)
  if (!res.ok || !data.ok) throw new Error(data.error || 'Falha ao selecionar conta.')
}

export async function metaDisconnect(empresaId: string): Promise<void> {
  const res = await fetch('/api/loja-online/meta-disconnect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({ empresaId }),
  })
  const data = await parseJson<{ ok: boolean; error?: string }>(res)
  if (!res.ok || !data.ok) throw new Error(data.error || 'Falha ao desconectar.')
}

export async function metaInsights(
  empresaId: string,
  since: string,
  until: string
): Promise<{ connected: boolean; needsAccount?: boolean; insights: MetaInsights | null; error?: string }> {
  const qs = new URLSearchParams({
    empresaId,
    since: since.slice(0, 10),
    until: until.slice(0, 10),
  })
  const res = await fetch(`/api/loja-online/meta-insights?${qs}`, {
    headers: { ...sessionHeaders() },
  })
  const data = await parseJson<{
    ok: boolean
    connected: boolean
    needsAccount?: boolean
    insights: MetaInsights | null
    error?: string
  }>(res)
  if (!res.ok || data.ok === false) throw new Error(data.error || 'Falha ao buscar insights.')
  return data
}
