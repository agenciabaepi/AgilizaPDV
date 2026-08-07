import type { LojaOnlineCategoria, LojaOnlineProduto } from './loja-online-types'

export const LOJA_ONLINE_SEM_CATEGORIA = '__sem__'

export type LojaOnlineMenuCategoria = {
  id: string
  nome: string
  ordem: number
}

export function isProdutoNaCategoriaMenu(
  produto: LojaOnlineProduto,
  categoriaId: string,
  categorias: LojaOnlineCategoria[]
): boolean {
  if (categoriaId === LOJA_ONLINE_SEM_CATEGORIA) return !produto.categoria_id
  if (!produto.categoria_id) return false
  const byId = new Map(categorias.map((c) => [c.id, c]))
  let currentId: string | null = produto.categoria_id
  const seen = new Set<string>()
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId)
    if (currentId === categoriaId) return true
    currentId = byId.get(currentId)?.parent_id ?? null
  }
  return false
}

export function buildLojaOnlineMenuCategorias(
  categorias: LojaOnlineCategoria[],
  produtoCategoriaIds: (string | null)[]
): LojaOnlineMenuCategoria[] {
  const byId = new Map(categorias.map((c) => [c.id, c]))
  const rootIds = new Set<string>()

  for (const catId of produtoCategoriaIds) {
    if (!catId) continue
    let currentId: string | null = catId
    let rootId = catId
    const seen = new Set<string>()
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId)
      const cat = byId.get(currentId)
      if (!cat) break
      rootId = currentId
      currentId = cat.parent_id
    }
    rootIds.add(rootId)
  }

  return categorias
    .filter((c) => rootIds.has(c.id))
    .map((c) => ({ id: c.id, nome: c.nome, ordem: c.ordem }))
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function filterProdutosPorCategoriaMenu(
  produtos: LojaOnlineProduto[],
  categoriaId: string | null,
  categorias: LojaOnlineCategoria[]
): LojaOnlineProduto[] {
  if (!categoriaId) return produtos
  return produtos.filter((p) => isProdutoNaCategoriaMenu(p, categoriaId, categorias))
}
