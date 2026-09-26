import type { LojaOnlineCategoria, LojaOnlineProduto, LojaOnlineStoreConfig } from './loja-online-types'
import { createTtlCache } from './ttl-cache'

const LOJA_CATALOG_TTL_MS = 5 * 60_000
const LOJA_STORE_TTL_MS = 10 * 60_000
const SESSION_PREFIX = 'agiliza:loja-cache:v1:'

export const lojaProdutosCache = createTtlCache<LojaOnlineProduto[]>(LOJA_CATALOG_TTL_MS)
export const lojaCategoriasCache = createTtlCache<LojaOnlineCategoria[]>(LOJA_CATALOG_TTL_MS)
export const lojaStoreCache = createTtlCache<LojaOnlineStoreConfig>(LOJA_STORE_TTL_MS)

export function lojaProdutosCacheKey(
  empresaId: string,
  ocultarSemEstoque: boolean,
  destaqueOnly: boolean
) {
  return `${empresaId}:p:${ocultarSemEstoque ? '1' : '0'}:${destaqueOnly ? 'd' : 'a'}`
}

export function lojaStoreCacheKey(kind: 'slug' | 'domain', value: string) {
  return `store:${kind}:${value.toLowerCase().trim()}`
}

function sessionGet<T>(key: string): T | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; ttl: number; data: T }
    if (!parsed?.at || Date.now() - parsed.at > parsed.ttl) {
      sessionStorage.removeItem(SESSION_PREFIX + key)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

function sessionSet<T>(key: string, data: T, ttl: number) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(
      SESSION_PREFIX + key,
      JSON.stringify({ at: Date.now(), ttl, data })
    )
  } catch {
    /* quota / private mode */
  }
}

export function peekLojaOnlineStoreCache(key: string): LojaOnlineStoreConfig | null {
  return lojaStoreCache.peek(key) ?? sessionGet<LojaOnlineStoreConfig>(key)
}

export function writeLojaOnlineStoreCache(key: string, data: LojaOnlineStoreConfig) {
  lojaStoreCache.set(key, data)
  sessionSet(key, data, LOJA_STORE_TTL_MS)
}

export function peekLojaOnlineProdutosCache(key: string): LojaOnlineProduto[] | null {
  return lojaProdutosCache.peek(key) ?? sessionGet<LojaOnlineProduto[]>(key)
}

export function writeLojaOnlineProdutosCache(key: string, data: LojaOnlineProduto[]) {
  lojaProdutosCache.set(key, data)
  sessionSet(key, data, LOJA_CATALOG_TTL_MS)
}

export function peekLojaOnlineCategoriasCache(key: string): LojaOnlineCategoria[] | null {
  return lojaCategoriasCache.peek(key) ?? sessionGet<LojaOnlineCategoria[]>(key)
}

export function writeLojaOnlineCategoriasCache(key: string, data: LojaOnlineCategoria[]) {
  lojaCategoriasCache.set(key, data)
  sessionSet(key, data, LOJA_CATALOG_TTL_MS)
}

export function invalidateLojaOnlineCatalogCache(empresaId?: string) {
  const prefix = empresaId ? `${empresaId}:` : undefined
  lojaProdutosCache.invalidate(prefix)
  lojaCategoriasCache.invalidate(prefix)
  if (typeof sessionStorage === 'undefined') return
  try {
    const keys: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (!k?.startsWith(SESSION_PREFIX)) continue
      const inner = k.slice(SESSION_PREFIX.length)
      if (!prefix || inner.startsWith(prefix) || inner.includes(`:${empresaId}:`)) keys.push(k)
    }
    for (const k of keys) sessionStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}

/** Agenda trabalho pesado depois da primeira pintura. */
export function scheduleLojaOnlineIdle(task: () => void, timeout = 2500) {
  if (typeof window === 'undefined') {
    task()
    return () => {}
  }
  const ric = window.requestIdleCallback?.bind(window)
  if (ric) {
    const id = ric(() => task(), { timeout })
    return () => window.cancelIdleCallback?.(id)
  }
  const t = window.setTimeout(task, 400)
  return () => window.clearTimeout(t)
}
