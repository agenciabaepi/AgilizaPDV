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

export function getLojaOnlineSubdomainUrl(slug: string): string {
  return `https://${slug}.${LOJA_ONLINE_DOMAIN}`
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

export function isLojaOnlineSubdomain(
  hostname = typeof window !== 'undefined' ? window.location.hostname : ''
): boolean {
  return getLojaSlugFromHostname(hostname) !== null
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
