import { promises as dns } from 'node:dns'
import { getSupabaseAdmin } from './supabase'

export const LOJA_ONLINE_CNAME_TARGET = 'cname.vercel-dns.com'
export const LOJA_ONLINE_APEX_A_RECORD = '76.76.21.21'

export function normalizeLojaOnlineCustomDomain(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  let value = raw.trim().toLowerCase()
  value = value.replace(/^\s*https?:\/\//, '')
  value = value.replace(/\/.*$/, '')
  value = value.replace(/:\d+$/, '')
  value = value.replace(/\.$/, '')
  if (!value || value.includes(' ') || value.includes('@')) return null
  return value
}

export function lojaOnlineCustomDomainVariants(host: string): string[] {
  const normalized = normalizeLojaOnlineCustomDomain(host)
  if (!normalized) return []
  const variants = new Set([normalized])
  if (normalized.startsWith('www.')) variants.add(normalized.slice(4))
  else variants.add(`www.${normalized}`)
  return [...variants]
}

function vercelConfig() {
  const token = process.env.VERCEL_TOKEN?.trim() || process.env.VERCEL_API_TOKEN?.trim() || ''
  const projectId = process.env.VERCEL_PROJECT_ID?.trim() || ''
  const teamId = process.env.VERCEL_TEAM_ID?.trim() || process.env.VERCEL_ORG_ID?.trim() || ''
  return { token, projectId, teamId, enabled: Boolean(token && projectId) }
}

function vercelUrl(path: string, teamId: string): string {
  const qs = teamId ? `${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(teamId)}` : ''
  return `https://api.vercel.com${path}${qs}`
}

async function vercelFetch(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const { token, teamId } = vercelConfig()
  const res = await fetch(vercelUrl(path, teamId), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  let data: Record<string, unknown> = {}
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    data = {}
  }
  return { ok: res.ok, status: res.status, data }
}

export async function addVercelProjectDomain(domain: string): Promise<{ ok: boolean; error?: string }> {
  const { enabled, projectId } = vercelConfig()
  if (!enabled) return { ok: false, error: 'vercel_not_configured' }
  const result = await vercelFetch(`/v10/projects/${encodeURIComponent(projectId)}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  })
  if (result.ok || result.status === 409) return { ok: true }
  const error =
    typeof result.data.error === 'object' && result.data.error && 'message' in result.data.error
      ? String((result.data.error as { message?: string }).message ?? '')
      : typeof result.data.error === 'string'
        ? result.data.error
        : `Falha ao cadastrar o domínio (${result.status}).`
  return { ok: false, error }
}

export async function removeVercelProjectDomain(domain: string): Promise<void> {
  const { enabled, projectId } = vercelConfig()
  if (!enabled) return
  await vercelFetch(`/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`, {
    method: 'DELETE',
  })
}

export async function getVercelDomainStatus(domain: string): Promise<{
  assigned: boolean
  verified: boolean
  misconfigured: boolean | null
}> {
  const { enabled, projectId } = vercelConfig()
  if (!enabled) return { assigned: false, verified: false, misconfigured: null }
  const project = await vercelFetch(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`
  )
  const config = await vercelFetch(`/v6/domains/${encodeURIComponent(domain)}/config`)
  const verified = Boolean((project.data as { verified?: boolean }).verified)
  const misconfigured =
    typeof (config.data as { misconfigured?: boolean }).misconfigured === 'boolean'
      ? Boolean((config.data as { misconfigured?: boolean }).misconfigured)
      : null
  return {
    assigned: project.ok,
    verified,
    misconfigured,
  }
}

export async function inspectCustomDomainDns(domain: string): Promise<{
  cname: string[]
  a: string[]
  pointsToPlatform: boolean
}> {
  const host = normalizeLojaOnlineCustomDomain(domain)
  if (!host) return { cname: [], a: [], pointsToPlatform: false }
  const [cnameResult, aResult] = await Promise.allSettled([
    dns.resolveCname(host),
    dns.resolve4(host),
  ])
  const cname = cnameResult.status === 'fulfilled' ? cnameResult.value.map((v) => v.toLowerCase()) : []
  const a = aResult.status === 'fulfilled' ? aResult.value : []
  const pointsToPlatform =
    cname.some(
      (value) =>
        value === LOJA_ONLINE_CNAME_TARGET ||
        value.endsWith(`.${LOJA_ONLINE_CNAME_TARGET}`) ||
        value === 'agilizapdv.app' ||
        value.endsWith('.agilizapdv.app')
    ) || a.includes(LOJA_ONLINE_APEX_A_RECORD)
  return { cname, a, pointsToPlatform }
}

export async function getEmpresaCustomDomain(empresaId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('empresas_config')
    .select('loja_online_dominio_custom')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (error) throw error
  return normalizeLojaOnlineCustomDomain(
    (data as { loja_online_dominio_custom?: string | null } | null)?.loja_online_dominio_custom
  )
}

export function vercelProvisioningEnabled(): boolean {
  return vercelConfig().enabled
}
