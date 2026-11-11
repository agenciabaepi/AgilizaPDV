import { getSupabase } from './supabase'

export type Produto = {
  id: string
  empresa_id: string
  codigo: number | null
  nome: string
  sku: string | null
  codigo_barras: string | null
  preco: number
  unidade: string | null
  ativo: number
  produto_pai_id?: string | null
  variacao_valores_json?: string | null
}

export type ListProdutosResult = {
  items: Produto[]
  /** Quando a busca bateu numa variação (SKU/código de barras), pré-seleciona esse filho. */
  preferredVariacaoByPai: Record<string, string>
}

const PRODUTO_SELECT =
  'id, empresa_id, codigo, nome, sku, codigo_barras, preco, unidade, ativo, produto_pai_id, variacao_valores_json'

function asProdutos(data: unknown): Produto[] {
  return (data ?? []) as Produto[]
}

function searchOrFilter(term: string): string {
  return `nome.ilike.%${term}%,sku.ilike.%${term}%,codigo_barras.ilike.%${term}%`
}

export async function listProdutos(
  empresaId: string,
  options?: { search?: string; apenasAtivos?: boolean }
): Promise<ListProdutosResult> {
  const supabase = getSupabase()
  const apenasAtivos = options?.apenasAtivos !== false
  const term = options?.search?.trim() ?? ''
  const preferredVariacaoByPai: Record<string, string> = {}

  let parentQuery = supabase
    .from('produtos')
    .select(PRODUTO_SELECT)
    .eq('empresa_id', empresaId)
    .is('produto_pai_id', null)

  if (apenasAtivos) parentQuery = parentQuery.eq('ativo', 1)
  if (term) parentQuery = parentQuery.or(searchOrFilter(term))
  parentQuery = parentQuery.order('nome')

  const { data: parentData, error: parentError } = await parentQuery
  if (parentError) throw new Error(`Falha ao listar produtos: ${parentError.message}`)

  const parents = asProdutos(parentData)
  const byId = new Map(parents.map((p) => [p.id, p]))

  if (term) {
    let childQuery = supabase
      .from('produtos')
      .select(PRODUTO_SELECT)
      .eq('empresa_id', empresaId)
      .not('produto_pai_id', 'is', null)

    if (apenasAtivos) childQuery = childQuery.eq('ativo', 1)
    childQuery = childQuery.or(searchOrFilter(term)).limit(80)

    const { data: childData, error: childError } = await childQuery
    if (childError) throw new Error(`Falha ao buscar variações: ${childError.message}`)

    const children = asProdutos(childData)
    const missingParentIds = [
      ...new Set(
        children
          .map((c) => c.produto_pai_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0 && !byId.has(id))
      )
    ]

    if (missingParentIds.length > 0) {
      let extraQuery = supabase
        .from('produtos')
        .select(PRODUTO_SELECT)
        .eq('empresa_id', empresaId)
        .in('id', missingParentIds)
        .is('produto_pai_id', null)
      if (apenasAtivos) extraQuery = extraQuery.eq('ativo', 1)
      const { data: extraData, error: extraError } = await extraQuery
      if (extraError) throw new Error(`Falha ao buscar produtos pai: ${extraError.message}`)
      for (const p of asProdutos(extraData)) byId.set(p.id, p)
    }

    for (const child of children) {
      const paiId = child.produto_pai_id
      if (!paiId || !byId.has(paiId)) continue
      if (!preferredVariacaoByPai[paiId]) preferredVariacaoByPai[paiId] = child.id
    }
  }

  const items = [...byId.values()].sort((a, b) =>
    (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })
  )

  return { items, preferredVariacaoByPai }
}

export async function listVariacoes(empresaId: string, produtoPaiId: string): Promise<Produto[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('produtos')
    .select(PRODUTO_SELECT)
    .eq('empresa_id', empresaId)
    .eq('produto_pai_id', produtoPaiId)
    .eq('ativo', 1)
    .order('nome')
  if (error) throw new Error(`Falha ao listar variações: ${error.message}`)
  return asProdutos(data)
}

export async function getProdutosByIds(empresaId: string, ids: string[]): Promise<Produto[]> {
  if (ids.length === 0) return []
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('produtos')
    .select(PRODUTO_SELECT)
    .eq('empresa_id', empresaId)
    .in('id', ids)
  if (error) throw new Error(`Falha ao buscar produtos: ${error.message}`)
  return asProdutos(data)
}

export function labelVariacao(p: Produto): string {
  const raw = p.variacao_valores_json?.trim()
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const parts = Object.values(parsed)
        .map((v) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : ''))
        .filter(Boolean)
      if (parts.length > 0) return parts.join(' / ')
    } catch {
      // ignore JSON inválido
    }
  }
  if (p.sku?.trim()) return p.sku.trim()
  if (p.codigo != null) return `Cód. ${p.codigo}`
  return p.nome
}
