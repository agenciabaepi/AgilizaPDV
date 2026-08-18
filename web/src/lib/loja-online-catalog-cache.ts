import { createTtlCache } from './ttl-cache'
import type { LojaOnlineCategoria, LojaOnlineProduto } from './loja-online-types'

const LOJA_CATALOG_TTL_MS = 90_000

export const lojaProdutosCache = createTtlCache<LojaOnlineProduto[]>(LOJA_CATALOG_TTL_MS)
export const lojaCategoriasCache = createTtlCache<LojaOnlineCategoria[]>(LOJA_CATALOG_TTL_MS)

export function lojaProdutosCacheKey(
  empresaId: string,
  ocultarSemEstoque: boolean,
  destaqueOnly: boolean
) {
  return `${empresaId}:p:${ocultarSemEstoque ? '1' : '0'}:${destaqueOnly ? 'd' : 'a'}`
}

export function invalidateLojaOnlineCatalogCache(empresaId?: string) {
  const prefix = empresaId ? `${empresaId}:` : undefined
  lojaProdutosCache.invalidate(prefix)
  lojaCategoriasCache.invalidate(prefix)
}
