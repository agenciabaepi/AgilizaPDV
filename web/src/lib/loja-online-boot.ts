import type { LojaOnlineStoreConfig } from './loja-online-types'
import {
  lojaStoreCacheKey,
  peekLojaOnlineStoreCache,
  writeLojaOnlineStoreCache,
} from './loja-online-catalog-cache'
import { rememberLojaOnlineBrand } from './loja-online-brand-boot'
import {
  parseLojaOnlineCategoriasCarrossel,
  parseLojaOnlineCategoriasCarrosselIds,
} from './loja-online'

type BootKey = { kind: 'slug'; value: string } | { kind: 'domain'; value: string }

type BootEntry = {
  key: BootKey
  promise: Promise<LojaOnlineStoreConfig | null>
}

let entry: BootEntry | null = null

function matches(a: BootKey, b: BootKey) {
  return a.kind === b.kind && a.value === b.value
}

function resolveKey(slug?: string | null, hostname?: string | null): BootKey | null {
  const host = hostname?.trim().toLowerCase()
  const s = slug?.trim().toLowerCase()
  if (host) return { kind: 'domain', value: host }
  if (s) return { kind: 'slug', value: s }
  return null
}

function kickPrefetch(store: LojaOnlineStoreConfig) {
  if (!store.empresa_id) return
  void import('./loja-online-api').then((api) => {
    api.prefetchLojaOnlineCatalog(store.empresa_id, !!store.loja_online_ocultar_sem_estoque, {
      carrossel: parseLojaOnlineCategoriasCarrossel(store.loja_online_categorias_carrossel),
      carrosselIds: parseLojaOnlineCategoriasCarrosselIds(store.loja_online_categorias_carrossel_ids),
    })
  })
}

/** Dispara o fetch da loja em paralelo com o download do chunk React. */
export function startLojaOnlineStoreBoot(opts: {
  slug?: string | null
  hostname?: string | null
}): Promise<LojaOnlineStoreConfig | null> | null {
  const key = resolveKey(opts.slug, opts.hostname)
  if (!key) return null
  if (entry && matches(entry.key, key)) return entry.promise

  const cacheKey = lojaStoreCacheKey(key.kind, key.value)
  const warm = peekLojaOnlineStoreCache(cacheKey)
  if (warm?.empresa_id) {
    rememberLojaOnlineBrand(warm, { slug: opts.slug, hostname: opts.hostname })
    kickPrefetch(warm)
  }

  const promise = import('./loja-online-api')
    .then((api) =>
      key.kind === 'domain'
        ? api.fetchLojaOnlineStoreByDomain(key.value)
        : api.fetchLojaOnlineStore(key.value)
    )
    .then((data) => {
      if (data?.empresa_id) {
        writeLojaOnlineStoreCache(cacheKey, data)
        rememberLojaOnlineBrand(data, {
          slug: opts.slug || data.loja_online_slug,
          hostname: opts.hostname || data.loja_online_dominio_custom,
        })
        kickPrefetch(data)
      }
      return data
    })
    .catch(() => warm ?? null)

  entry = { key, promise }
  return promise
}

/** Reaproveita o promise iniciado no boot (evita fetch duplicado no provider). */
export function takeLojaOnlineStoreBoot(opts: {
  slug?: string | null
  hostname?: string | null
}): Promise<LojaOnlineStoreConfig | null> | null {
  const key = resolveKey(opts.slug, opts.hostname)
  if (!key || !entry || !matches(entry.key, key)) return null
  const p = entry.promise
  entry = null
  return p
}
