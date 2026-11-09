import type { LojaOnlineStoreConfig } from './loja-online-types'
import { parseLojaOnlineBanners } from './loja-online-types'
import {
  resolveLojaOnlineCorFundo,
  resolveLojaOnlineCorHeader,
  resolveLojaOnlineCorPrimaria,
  resolveLojaOnlineLogoHeader,
} from './loja-online'

const BRAND_PREFIX = 'agiliza:loja-brand:v1:'
const SESSION_STORE_PREFIX = 'agiliza:loja-cache:v1:'

export type LojaOnlineBrandBoot = {
  title: string
  icon: string | null
  corPrimaria?: string
  corFundo?: string
  corHeader?: string
  banner?: string | null
}

function brandKey(kind: 'slug' | 'domain', value: string) {
  return `${BRAND_PREFIX}${kind}:${value.toLowerCase().trim()}`
}

function readJson<T>(storage: Storage | undefined, key: string): T | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(storage: Storage | undefined, key: string, data: unknown) {
  if (!storage) return
  try {
    storage.setItem(key, JSON.stringify(data))
  } catch {
    /* quota / private mode */
  }
}

function firstBannerUrl(store: LojaOnlineStoreConfig): string | null {
  const banners = parseLojaOnlineBanners(store.loja_online_banners_json, store.loja_online_banner)
  const first = banners[0]
  if (!first) return null
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  const url = (mobile ? first.imagemMobile || first.imagem : first.imagem)?.trim()
  return url || null
}

function brandFromStore(store: LojaOnlineStoreConfig | null | undefined): LojaOnlineBrandBoot | null {
  if (!store) return null
  const title =
    store.loja_online_seo_titulo?.trim() ||
    store.loja_online_titulo?.trim() ||
    store.loja_online_slug?.trim() ||
    ''
  if (!title) return null
  return {
    title,
    icon: resolveLojaOnlineLogoHeader(store) || null,
    corPrimaria: resolveLojaOnlineCorPrimaria(store),
    corFundo: resolveLojaOnlineCorFundo(store),
    corHeader: resolveLojaOnlineCorHeader(store),
    banner: firstBannerUrl(store),
  }
}

function brandFromSessionStore(kind: 'slug' | 'domain', value: string): LojaOnlineBrandBoot | null {
  if (typeof sessionStorage === 'undefined' && typeof localStorage === 'undefined') return null
  try {
    const key = `${SESSION_STORE_PREFIX}store:${kind}:${value.toLowerCase().trim()}`
    const raw =
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null) ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data?: LojaOnlineStoreConfig }
    return brandFromStore(parsed?.data)
  } catch {
    return null
  }
}

/** Persiste título/ícone/cores/banner para o próximo carregamento (anúncio / retorno). */
export function rememberLojaOnlineBrand(
  store: LojaOnlineStoreConfig,
  opts?: { slug?: string | null; hostname?: string | null }
) {
  const brand = brandFromStore(store)
  if (!brand) return
  const slug = (opts?.slug || store.loja_online_slug || '').trim()
  const host = (opts?.hostname || store.loja_online_dominio_custom || '').trim()
  if (slug) writeJson(localStorage, brandKey('slug', slug), brand)
  if (host) writeJson(localStorage, brandKey('domain', host), brand)
}

export function peekLojaOnlineBrand(opts: {
  slug?: string | null
  hostname?: string | null
}): LojaOnlineBrandBoot | null {
  const host = opts.hostname?.trim()
  const slug = opts.slug?.trim()
  if (host) {
    return (
      readJson<LojaOnlineBrandBoot>(localStorage, brandKey('domain', host)) ||
      brandFromSessionStore('domain', host)
    )
  }
  if (slug) {
    return (
      readJson<LojaOnlineBrandBoot>(localStorage, brandKey('slug', slug)) ||
      brandFromSessionStore('slug', slug)
    )
  }
  return null
}

function upsertFavicon(href: string | null | undefined) {
  const url = href?.trim()
  const selectors = ['link[rel="icon"]', 'link[rel="shortcut icon"]', 'link[rel="apple-touch-icon"]']
  if (!url) {
    selectors.forEach((sel) => document.querySelector(sel)?.remove())
    return
  }
  const ensure = (rel: string, sizes?: string) => {
    let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
    if (!el) {
      el = document.createElement('link')
      el.rel = rel
      document.head.appendChild(el)
    }
    el.href = url
    if (sizes) el.setAttribute('sizes', sizes)
    else el.removeAttribute('sizes')
    const lower = url.toLowerCase()
    if (lower.includes('.svg')) el.type = 'image/svg+xml'
    else if (lower.includes('.webp')) el.type = 'image/webp'
    else if (lower.includes('.jpg') || lower.includes('.jpeg')) el.type = 'image/jpeg'
    else if (lower.includes('.ico')) el.type = 'image/x-icon'
    else el.type = 'image/png'
  }
  ensure('icon')
  ensure('shortcut icon')
  ensure('apple-touch-icon', '180x180')
}

function ensureBannerPreload(url: string | null | undefined) {
  const href = url?.trim()
  if (!href || typeof document === 'undefined') return
  const existing = Array.from(document.querySelectorAll('link[rel="preload"][as="image"]')).some(
    (el) => (el as HTMLLinkElement).href === href || el.getAttribute('href') === href
  )
  if (existing) return
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = href
  link.setAttribute('fetchpriority', 'high')
  document.head.appendChild(link)
}

/** Aplica título + favicon + tema o mais cedo possível. */
export function applyLojaOnlineBrandBoot(brand: LojaOnlineBrandBoot | null | undefined) {
  if (!brand?.title) return
  document.title = brand.title
  upsertFavicon(brand.icon)
  const root = document.documentElement
  if (brand.corPrimaria) root.style.setProperty('--loja-cor', brand.corPrimaria)
  if (brand.corFundo) {
    root.style.setProperty('--loja-cor-fundo', brand.corFundo)
    document.body.style.background = brand.corFundo
  }
  if (brand.corHeader) root.style.setProperty('--loja-header-bg', brand.corHeader)
  ensureBannerPreload(brand.banner)
}

export function applyLojaOnlineFavicon(icon: string | null | undefined) {
  upsertFavicon(icon)
}
