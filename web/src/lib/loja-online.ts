export const LOJA_ONLINE_DOMAIN =
  import.meta.env.VITE_LOJA_ONLINE_DOMAIN?.trim() || 'agilizapdv.app'

export const LOJA_ONLINE_RESERVED_SLUGS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'suporte',
  'login',
  'cadastro',
  'loja',
  'dashboard',
  'pdv',
  'static',
  'assets',
])

/** Normaliza texto digitado para slug URL (minúsculas, hífens). */
export function normalizeLojaOnlineSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Retorna mensagem de erro ou null se válido. Slug vazio é permitido (loja desativada). */
export function validateLojaOnlineSlug(slug: string): string | null {
  if (!slug) return null
  if (slug.length < 3) return 'Use pelo menos 3 caracteres.'
  if (slug.length > 40) return 'Use no máximo 40 caracteres.'
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return 'Use apenas letras minúsculas, números e hífens (sem hífen no início ou fim).'
  }
  if (LOJA_ONLINE_RESERVED_SLUGS.has(slug)) return 'Este endereço está reservado pelo sistema.'
  return null
}

export const LOJA_ONLINE_CNAME_TARGET = 'cname.vercel-dns.com'
export const LOJA_ONLINE_APEX_A_RECORD = '76.76.21.21'

const CUSTOM_DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const MULTI_PART_PUBLIC_SUFFIXES = new Set(['com', 'org', 'net', 'gov', 'edu', 'co'])

/** Remove protocolo, caminho, porta e www extra; devolve hostname em minúsculas. */
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

export function isLojaOnlineApexDomain(host: string): boolean {
  const normalized = normalizeLojaOnlineCustomDomain(host)
  if (!normalized || normalized.startsWith('www.')) return false
  const parts = normalized.split('.')
  if (parts.length < 2) return false
  const multiTld =
    parts.length >= 3 && MULTI_PART_PUBLIC_SUFFIXES.has(parts[parts.length - 2] ?? '')
  return multiTld ? parts.length === 3 : parts.length === 2
}

export function validateLojaOnlineCustomDomain(raw: string): string | null {
  if (!raw.trim()) return null
  const host = normalizeLojaOnlineCustomDomain(raw)
  if (!host) return 'Informe um domínio válido, como www.sualoja.com.br.'
  if (host.length > 253) return 'O domínio é longo demais.'
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return 'Use um nome de domínio, não um IP.'
  const labels = host.split('.')
  if (labels.length < 2) return 'Informe um domínio completo, como www.sualoja.com.br.'
  if (labels.some((label) => !CUSTOM_DOMAIN_LABEL.test(label))) {
    return 'Use apenas letras, números e hífens em cada parte do domínio.'
  }
  const tld = labels[labels.length - 1] ?? ''
  if (tld.length < 2) return 'Informe um domínio completo, como www.sualoja.com.br.'

  const platform = LOJA_ONLINE_DOMAIN.toLowerCase()
  if (host === platform || host === `www.${platform}` || host.endsWith(`.${platform}`)) {
    return 'Este já é o domínio da plataforma. Use o subdomínio acima.'
  }
  if (host.endsWith('.vercel.app') || host.endsWith('.localhost')) {
    return 'Este endereço não pode ser usado como domínio próprio.'
  }
  return null
}

export function getLojaOnlineCustomDomainUrl(domain: string): string {
  const host = normalizeLojaOnlineCustomDomain(domain)
  return host ? `https://${host}` : ''
}

export function getLojaOnlineCustomDomainDns(domain: string): {
  type: 'CNAME' | 'A'
  name: string
  value: string
  apex?: { type: 'A'; name: '@'; value: string }
} {
  const host = normalizeLojaOnlineCustomDomain(domain) || domain.trim().toLowerCase()
  if (isLojaOnlineApexDomain(host)) {
    return {
      type: 'A',
      name: '@',
      value: LOJA_ONLINE_APEX_A_RECORD,
      apex: { type: 'A', name: '@', value: LOJA_ONLINE_APEX_A_RECORD },
    }
  }
  const name = host.startsWith('www.') ? 'www' : (host.split('.')[0] || 'www')
  return {
    type: 'CNAME',
    name,
    value: LOJA_ONLINE_CNAME_TARGET,
    apex: { type: 'A', name: '@', value: LOJA_ONLINE_APEX_A_RECORD },
  }
}

export function getLojaOnlineSubdomainUrl(slug: string): string {
  return `https://${slug}.${LOJA_ONLINE_DOMAIN}`
}

export function getLojaOnlinePublicBaseUrl(store: {
  loja_online_slug?: string | null
  loja_online_dominio_custom?: string | null
}): string {
  const custom = normalizeLojaOnlineCustomDomain(store.loja_online_dominio_custom)
  if (custom) return `https://${custom}`
  const slug = store.loja_online_slug?.trim()
  if (slug) return getLojaOnlineSubdomainUrl(slug)
  if (typeof window !== 'undefined') return window.location.origin
  return `https://${LOJA_ONLINE_DOMAIN}`
}

export function getLojaOnlinePathUrl(slug: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/#/loja/${encodeURIComponent(slug)}`
}

/** URL do painel principal (domínio raiz). */
export function getMainAppUrl(path = '/'): string {
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
  return `${protocol}//${LOJA_ONLINE_DOMAIN}${path}`
}

/**
 * Extrai o slug da loja a partir do hostname (ex.: rhema.agilizapdv.app → rhema).
 * Retorna null no domínio principal ou subdomínios reservados.
 */
export function getLojaSlugFromHostname(
  hostname = typeof window !== 'undefined' ? window.location.hostname : ''
): string | null {
  const host = hostname.toLowerCase().trim()
  if (!host) return null

  const domain = LOJA_ONLINE_DOMAIN.toLowerCase()

  if (host === 'localhost' || host === '127.0.0.1') {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('loja')
      if (q?.trim()) {
        const normalized = normalizeLojaOnlineSlug(q)
        return normalized && !LOJA_ONLINE_RESERVED_SLUGS.has(normalized) ? normalized : null
      }
      if (host.endsWith('.localhost')) {
        const sub = host.replace(/\.localhost$/, '')
        if (sub && !LOJA_ONLINE_RESERVED_SLUGS.has(sub)) return sub
      }
    }
    return null
  }

  if (host === domain || host === `www.${domain}`) return null
  if (host.endsWith('.vercel.app')) return null

  if (host.endsWith(`.${domain}`)) {
    const sub = host.slice(0, -(domain.length + 1)).split('.')[0]
    if (!sub || LOJA_ONLINE_RESERVED_SLUGS.has(sub)) return null
    return sub
  }

  return null
}

export function isLojaOnlineCustomDomainHost(
  hostname = typeof window !== 'undefined' ? window.location.hostname : ''
): boolean {
  const host = hostname.toLowerCase().trim()
  if (!host) return false
  if (getLojaSlugFromHostname(host)) return false
  const domain = LOJA_ONLINE_DOMAIN.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false
  if (host === domain || host === `www.${domain}` || host.endsWith(`.${domain}`)) return false
  if (host.endsWith('.vercel.app')) return false
  return validateLojaOnlineCustomDomain(host) === null
}

export function isLojaOnlineSubdomain(
  hostname = typeof window !== 'undefined' ? window.location.hostname : ''
): boolean {
  return getLojaSlugFromHostname(hostname) !== null
}

export function isLojaOnlineStorefrontHost(
  hostname = typeof window !== 'undefined' ? window.location.hostname : ''
): boolean {
  return isLojaOnlineSubdomain(hostname) || isLojaOnlineCustomDomainHost(hostname)
}

export function formatWhatsAppLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  const text = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${digits}${text}`
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export const LOJA_ONLINE_CORES_PRESET = [
  '#1d4ed8', '#065f46', '#2563eb', '#7c3aed', '#db2777',
  '#ea580c', '#ca8a04', '#16a34a', '#0ea5e9', '#6366f1',
] as const

export const LOJA_ONLINE_CORES_FUNDO_PRESET = [
  '#ffffff', '#f7f7f7', '#f8fafc', '#fafafa', '#fffbeb',
  '#eff6ff', '#f0fdf4', '#faf5ff', '#18181b', '#0f172a',
] as const

export const LOJA_ONLINE_COR_FUNDO_PADRAO = '#f7f7f7'

export function normalizeLojaOnlineHexColor(value: string | null | undefined, fallback = '#1d4ed8'): string {
  const v = (value ?? '').trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toLowerCase()
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const h = v.slice(1)
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase()
  }
  return fallback
}

export function resolveLojaOnlineCorPrimaria(config: {
  loja_online_cor_primaria?: string | null
  cor_primaria?: string | null
}): string {
  const custom = config.loja_online_cor_primaria?.trim()
  if (custom && /^#[0-9A-Fa-f]{6}$/.test(custom)) return custom.toLowerCase()
  return normalizeLojaOnlineHexColor(config.cor_primaria)
}

export function resolveLojaOnlineCorFundo(config: {
  loja_online_cor_fundo?: string | null
}): string {
  const custom = config.loja_online_cor_fundo?.trim()
  if (custom && /^#[0-9A-Fa-f]{6}$/.test(custom)) return custom.toLowerCase()
  return LOJA_ONLINE_COR_FUNDO_PADRAO
}
