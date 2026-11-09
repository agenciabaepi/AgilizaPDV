import type {
  LojaOnlineCategoria,
  LojaOnlineColecao,
  LojaOnlineProduto,
  LojaOnlineStoreConfig,
} from './loja-online-types'
import { createTtlCache } from './ttl-cache'

const LOJA_CATALOG_TTL_MS = 5 * 60_000
/** Persistência local mais longa: clique de anúncio em outro dia ainda pinta a loja na hora. */
const LOJA_CATALOG_LOCAL_TTL_MS = 30 * 60_000
const LOJA_STORE_TTL_MS = 10 * 60_000
const LOJA_STORE_LOCAL_TTL_MS = 24 * 60 * 60_000
const SESSION_PREFIX = 'agiliza:loja-cache:v1:'
const LOCAL_PREFIX = 'agiliza:loja-cache:v1:'

export const lojaProdutosCache = createTtlCache<LojaOnlineProduto[]>(LOJA_CATALOG_TTL_MS)
export const lojaCategoriasCache = createTtlCache<LojaOnlineCategoria[]>(LOJA_CATALOG_TTL_MS)
export const lojaVitrineCache = createTtlCache<LojaOnlineCategoria[]>(LOJA_CATALOG_TTL_MS)
export const lojaColecoesCache = createTtlCache<LojaOnlineColecao[]>(LOJA_CATALOG_TTL_MS)
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

export function lojaVitrineCacheKey(
  empresaId: string,
  carrossel: string,
  selectedIds: string[] = []
) {
  return `${empresaId}:v:${carrossel}:${selectedIds.join(',')}`
}

export function lojaColecoesCacheKey(empresaId: string, somenteAtivas: boolean) {
  return `${empresaId}:col:${somenteAtivas ? '1' : '0'}`
}

type Stored<T> = { at: number; ttl: number; data: T }

function readStored<T>(storage: Storage | undefined, prefix: string, key: string): T | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(prefix + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Stored<T>
    if (!parsed?.at || Date.now() - parsed.at > parsed.ttl) {
      storage.removeItem(prefix + key)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

function writeStored<T>(storage: Storage | undefined, prefix: string, key: string, data: T, ttl: number) {
  if (!storage) return
  try {
    storage.setItem(prefix + key, JSON.stringify({ at: Date.now(), ttl, data } satisfies Stored<T>))
  } catch {
    /* quota / private mode */
  }
}

function persistGet<T>(key: string): T | null {
  return (
    readStored<T>(typeof sessionStorage !== 'undefined' ? sessionStorage : undefined, SESSION_PREFIX, key) ??
    readStored<T>(typeof localStorage !== 'undefined' ? localStorage : undefined, LOCAL_PREFIX, key)
  )
}

function persistSet<T>(key: string, data: T, sessionTtl: number, localTtl: number) {
  writeStored(
    typeof sessionStorage !== 'undefined' ? sessionStorage : undefined,
    SESSION_PREFIX,
    key,
    data,
    sessionTtl
  )
  writeStored(
    typeof localStorage !== 'undefined' ? localStorage : undefined,
    LOCAL_PREFIX,
    key,
    data,
    localTtl
  )
}

function clearPersisted(predicate: (innerKey: string) => boolean) {
  for (const storage of [
    typeof sessionStorage !== 'undefined' ? sessionStorage : null,
    typeof localStorage !== 'undefined' ? localStorage : null,
  ]) {
    if (!storage) continue
    try {
      const keys: string[] = []
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i)
        if (!k?.startsWith(SESSION_PREFIX)) continue
        const inner = k.slice(SESSION_PREFIX.length)
        if (predicate(inner)) keys.push(k)
      }
      for (const k of keys) storage.removeItem(k)
    } catch {
      /* ignore */
    }
  }
}

export function peekLojaOnlineStoreCache(key: string): LojaOnlineStoreConfig | null {
  return lojaStoreCache.peek(key) ?? persistGet<LojaOnlineStoreConfig>(key)
}

export function writeLojaOnlineStoreCache(key: string, data: LojaOnlineStoreConfig) {
  lojaStoreCache.set(key, data)
  persistSet(key, data, LOJA_STORE_TTL_MS, LOJA_STORE_LOCAL_TTL_MS)
}

export function peekLojaOnlineProdutosCache(key: string): LojaOnlineProduto[] | null {
  return lojaProdutosCache.peek(key) ?? persistGet<LojaOnlineProduto[]>(key)
}

export function writeLojaOnlineProdutosCache(key: string, data: LojaOnlineProduto[]) {
  lojaProdutosCache.set(key, data)
  persistSet(key, data, LOJA_CATALOG_TTL_MS, LOJA_CATALOG_LOCAL_TTL_MS)
}

export function peekLojaOnlineCategoriasCache(key: string): LojaOnlineCategoria[] | null {
  return lojaCategoriasCache.peek(key) ?? persistGet<LojaOnlineCategoria[]>(key)
}

export function writeLojaOnlineCategoriasCache(key: string, data: LojaOnlineCategoria[]) {
  lojaCategoriasCache.set(key, data)
  persistSet(key, data, LOJA_CATALOG_TTL_MS, LOJA_CATALOG_LOCAL_TTL_MS)
}

export function peekLojaOnlineVitrineCache(key: string): LojaOnlineCategoria[] | null {
  return lojaVitrineCache.peek(key) ?? persistGet<LojaOnlineCategoria[]>(key)
}

export function writeLojaOnlineVitrineCache(key: string, data: LojaOnlineCategoria[]) {
  lojaVitrineCache.set(key, data)
  persistSet(key, data, LOJA_CATALOG_TTL_MS, LOJA_CATALOG_LOCAL_TTL_MS)
}

export function peekLojaOnlineColecoesCache(key: string): LojaOnlineColecao[] | null {
  return lojaColecoesCache.peek(key) ?? persistGet<LojaOnlineColecao[]>(key)
}

export function writeLojaOnlineColecoesCache(key: string, data: LojaOnlineColecao[]) {
  lojaColecoesCache.set(key, data)
  persistSet(key, data, LOJA_CATALOG_TTL_MS, LOJA_CATALOG_LOCAL_TTL_MS)
}

export function invalidateLojaOnlineStoreCache() {
  lojaStoreCache.invalidate()
  clearPersisted((inner) => inner.startsWith('store:'))
}

export function invalidateLojaOnlineCatalogCache(empresaId?: string) {
  const prefix = empresaId ? `${empresaId}:` : undefined
  lojaProdutosCache.invalidate(prefix)
  lojaCategoriasCache.invalidate(prefix)
  lojaVitrineCache.invalidate(prefix)
  lojaColecoesCache.invalidate(prefix)
  invalidateLojaOnlineStoreCache()
  clearPersisted((inner) => {
    if (inner.startsWith('store:')) return true
    if (!prefix) return true
    return inner.startsWith(prefix) || inner.includes(`:${empresaId}:`)
  })
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
