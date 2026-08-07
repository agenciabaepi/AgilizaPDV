import type { LojaOnlineCategoria, LojaOnlineProduto } from './loja-online-types'
import {
  getLojaOnlineProdutoMarcaNome,
  parseLojaOnlineCardMeta,
} from './loja-online-types'
import { isProdutoNaCategoriaMenu } from './loja-online-categorias'

export type LojaOnlineProdutoSort = 'nome' | 'preco-asc' | 'preco-desc' | 'novos'

export type LojaOnlineFiltrosState = {
  subcategoria: string | null
  marca: string | null
  precoMin: number | null
  precoMax: number | null
  cor: string | null
  tamanho: string | null
  armazenamento: string | null
  variacao: string | null
  ordem: LojaOnlineProdutoSort
}

export type LojaOnlineFiltroOpcao = { value: string; label: string; count: number }

export type LojaOnlineFiltroCorOpcao = {
  value: string
  label: string
  hex: string
  count: number
}

export type LojaOnlineFiltrosOpcoes = {
  subcategorias: LojaOnlineFiltroOpcao[]
  marcas: LojaOnlineFiltroOpcao[]
  cores: LojaOnlineFiltroCorOpcao[]
  tamanhos: LojaOnlineFiltroOpcao[]
  armazenamentos: LojaOnlineFiltroOpcao[]
  variacoes: LojaOnlineFiltroOpcao[]
  precoMin: number
  precoMax: number
}

export const LOJA_ONLINE_ORDEM_OPCOES: { value: LojaOnlineProdutoSort; label: string }[] = [
  { value: 'nome', label: 'Nome A–Z' },
  { value: 'preco-asc', label: 'Menor preço' },
  { value: 'preco-desc', label: 'Maior preço' },
  { value: 'novos', label: 'Mais recentes' },
]

export const LOJA_ONLINE_FILTROS_VAZIOS: LojaOnlineFiltrosState = {
  subcategoria: null,
  marca: null,
  precoMin: null,
  precoMax: null,
  cor: null,
  tamanho: null,
  armazenamento: null,
  variacao: null,
  ordem: 'nome',
}

function parseNumberParam(raw: string | null): number | null {
  if (!raw?.trim()) return null
  const n = Number(raw.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function parseSortParam(raw: string | null): LojaOnlineProdutoSort {
  if (raw === 'preco-asc' || raw === 'preco-desc' || raw === 'novos') return raw
  return 'nome'
}

export function parseLojaOnlineFiltros(searchParams: URLSearchParams): LojaOnlineFiltrosState {
  return {
    subcategoria: searchParams.get('sub')?.trim() || null,
    marca: searchParams.get('marca')?.trim() || null,
    precoMin: parseNumberParam(searchParams.get('preco_min')),
    precoMax: parseNumberParam(searchParams.get('preco_max')),
    cor: searchParams.get('cor')?.trim() || null,
    tamanho: searchParams.get('tamanho')?.trim() || null,
    armazenamento: searchParams.get('armazenamento')?.trim() || null,
    variacao: searchParams.get('variacao')?.trim() || null,
    ordem: parseSortParam(searchParams.get('ordem')),
  }
}

export function countLojaOnlineFiltrosAtivos(filtros: LojaOnlineFiltrosState): number {
  let n = 0
  if (filtros.subcategoria) n++
  if (filtros.marca) n++
  if (filtros.precoMin != null) n++
  if (filtros.precoMax != null) n++
  if (filtros.cor) n++
  if (filtros.tamanho) n++
  if (filtros.armazenamento) n++
  if (filtros.variacao) n++
  if (filtros.ordem !== 'nome') n++
  return n
}

export function applyLojaOnlineFiltrosPatch(
  current: URLSearchParams,
  patch: Partial<LojaOnlineFiltrosState>
): URLSearchParams {
  const next = new URLSearchParams(current)
  const merged = { ...parseLojaOnlineFiltros(current), ...patch }

  const setOrDelete = (key: string, value: string | null | undefined) => {
    if (value?.trim()) next.set(key, value.trim())
    else next.delete(key)
  }

  setOrDelete('sub', merged.subcategoria)
  setOrDelete('marca', merged.marca)
  if (merged.precoMin != null) next.set('preco_min', String(merged.precoMin))
  else next.delete('preco_min')
  if (merged.precoMax != null) next.set('preco_max', String(merged.precoMax))
  else next.delete('preco_max')
  setOrDelete('cor', merged.cor)
  setOrDelete('tamanho', merged.tamanho)
  setOrDelete('armazenamento', merged.armazenamento)
  setOrDelete('variacao', merged.variacao)
  if (merged.ordem !== 'nome') next.set('ordem', merged.ordem)
  else next.delete('ordem')

  return next
}

function isCategoriaDescendenteDe(
  categoriaId: string,
  ancestorId: string,
  categorias: LojaOnlineCategoria[]
): boolean {
  if (categoriaId === ancestorId) return true
  const byId = new Map(categorias.map((c) => [c.id, c]))
  let currentId: string | null = categoriaId
  const seen = new Set<string>()
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId)
    if (currentId === ancestorId) return true
    currentId = byId.get(currentId)?.parent_id ?? null
  }
  return false
}

function produtoTemMetaValor(
  produto: LojaOnlineProduto,
  field: 'cores' | 'tamanhos' | 'armazenamentos' | 'variacoes',
  value: string
): boolean {
  const meta = parseLojaOnlineCardMeta(produto.loja_online_card_json)
  if (!meta) return false
  const needle = value.trim().toLowerCase()
  if (!needle) return true

  if (field === 'cores') {
    return (meta.cores ?? []).some((c) => c.nome.trim().toLowerCase() === needle)
  }
  const list = meta[field] ?? []
  return list.some((item) => item.trim().toLowerCase() === needle)
}

export function sortLojaOnlineProdutos(
  produtos: LojaOnlineProduto[],
  ordem: LojaOnlineProdutoSort
): LojaOnlineProduto[] {
  const copy = [...produtos]
  switch (ordem) {
    case 'preco-asc':
      return copy.sort((a, b) => a.preco - b.preco)
    case 'preco-desc':
      return copy.sort((a, b) => b.preco - a.preco)
    case 'novos':
      return copy.sort((a, b) => (b.codigo ?? 0) - (a.codigo ?? 0))
    default:
      return copy.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }
}

export function applyLojaOnlineFiltros(
  produtos: LojaOnlineProduto[],
  filtros: LojaOnlineFiltrosState,
  categorias: LojaOnlineCategoria[],
  categoriaMenuId: string
): LojaOnlineProduto[] {
  let list = produtos.filter((p) => isProdutoNaCategoriaMenu(p, categoriaMenuId, categorias))

  if (filtros.subcategoria) {
    list = list.filter((p) => isProdutoNaCategoriaMenu(p, filtros.subcategoria!, categorias))
  }

  if (filtros.marca) {
    list = list.filter((p) => p.marca_id === filtros.marca)
  }

  if (filtros.precoMin != null) {
    list = list.filter((p) => p.preco >= filtros.precoMin!)
  }
  if (filtros.precoMax != null) {
    list = list.filter((p) => p.preco <= filtros.precoMax!)
  }

  if (filtros.cor) {
    list = list.filter((p) => produtoTemMetaValor(p, 'cores', filtros.cor!))
  }
  if (filtros.tamanho) {
    list = list.filter((p) => produtoTemMetaValor(p, 'tamanhos', filtros.tamanho!))
  }
  if (filtros.armazenamento) {
    list = list.filter((p) => produtoTemMetaValor(p, 'armazenamentos', filtros.armazenamento!))
  }
  if (filtros.variacao) {
    list = list.filter((p) => produtoTemMetaValor(p, 'variacoes', filtros.variacao!))
  }

  return sortLojaOnlineProdutos(list, filtros.ordem)
}

function countByKey(
  items: LojaOnlineProduto[],
  keyFn: (item: LojaOnlineProduto) => string | null | undefined,
  labelFn?: (value: string, item: LojaOnlineProduto) => string
): LojaOnlineFiltroOpcao[] {
  const map = new Map<string, { label: string; count: number }>()
  for (const item of items) {
    const key = keyFn(item)?.trim()
    if (!key) continue
    const label = labelFn ? labelFn(key, item) : key
    const prev = map.get(key)
    if (prev) prev.count++
    else map.set(key, { label, count: 1 })
  }
  return [...map.entries()]
    .map(([value, { label, count }]) => ({ value, label, count }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
}

function countMetaStrings(
  produtos: LojaOnlineProduto[],
  field: 'tamanhos' | 'armazenamentos' | 'variacoes'
): LojaOnlineFiltroOpcao[] {
  const map = new Map<string, number>()
  for (const p of produtos) {
    for (const value of parseLojaOnlineCardMeta(p.loja_online_card_json)?.[field] ?? []) {
      map.set(value, (map.get(value) ?? 0) + 1)
    }
  }
  return [...map.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
}

export function buildLojaOnlineFiltrosOpcoes(
  produtosBase: LojaOnlineProduto[],
  categorias: LojaOnlineCategoria[],
  categoriaMenuId: string
): LojaOnlineFiltrosOpcoes {
  const base = produtosBase.filter((p) =>
    isProdutoNaCategoriaMenu(p, categoriaMenuId, categorias)
  )

  const subcategorias = categorias
    .filter((c) => {
      if (c.id === categoriaMenuId) return false
      if (!isCategoriaDescendenteDe(c.id, categoriaMenuId, categorias)) return false
      return base.some((p) => p.categoria_id === c.id)
    })
    .map((c) => ({
      value: c.id,
      label: c.path.includes(' › ') ? c.path.split(' › ').slice(-1)[0] : c.nome,
      count: base.filter((p) => p.categoria_id === c.id).length,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

  const marcas = countByKey(
    base,
    (p) => p.marca_id ?? null,
    (id, p) => getLojaOnlineProdutoMarcaNome(p) ?? id
  )

  const corMap = new Map<string, LojaOnlineFiltroCorOpcao>()
  for (const p of base) {
    for (const cor of parseLojaOnlineCardMeta(p.loja_online_card_json)?.cores ?? []) {
      const value = cor.nome.trim()
      if (!value) continue
      const prev = corMap.get(value)
      if (prev) prev.count++
      else corMap.set(value, { value, label: value, hex: cor.hex, count: 1 })
    }
  }
  const cores = [...corMap.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

  const precos = base.map((p) => p.preco).filter((n) => Number.isFinite(n))
  const precoMin = precos.length ? Math.floor(Math.min(...precos)) : 0
  const precoMax = precos.length ? Math.ceil(Math.max(...precos)) : 0

  return {
    subcategorias,
    marcas,
    cores,
    tamanhos: countMetaStrings(base, 'tamanhos'),
    armazenamentos: countMetaStrings(base, 'armazenamentos'),
    variacoes: countMetaStrings(base, 'variacoes'),
    precoMin,
    precoMax,
  }
}
