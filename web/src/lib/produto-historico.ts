import { supabase } from './supabase'
import type { EstoqueMovimento, TipoMovimento } from '../vite-env'

export type ProdutoPrecoHistorico = {
  id: string
  empresa_id: string
  produto_id: string
  preco_anterior: number | null
  preco_novo: number
  custo_anterior: number | null
  custo_novo: number | null
  markup_anterior: number | null
  markup_novo: number | null
  origem: string
  usuario_id: string | null
  created_at: string
  usuario_nome?: string | null
}

export type RegistrarPrecoHistoricoInput = {
  empresa_id: string
  produto_id: string
  preco_anterior: number | null
  preco_novo: number
  custo_anterior?: number | null
  custo_novo?: number | null
  markup_anterior?: number | null
  markup_novo?: number | null
  origem?: string
  usuario_id?: string | null
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function changed(a: number | null | undefined, b: number | null | undefined): boolean {
  const na = a == null ? null : Number(a)
  const nb = b == null ? null : Number(b)
  if (na == null && nb == null) return false
  if (na == null || nb == null) return true
  return Math.abs(na - nb) > 0.00005
}

export function precoCamposMudaram(antes: {
  preco?: number | null
  custo?: number | null
  markup?: number | null
}, depois: {
  preco?: number | null
  custo?: number | null
  markup?: number | null
}): boolean {
  return (
    changed(antes.preco, depois.preco) ||
    changed(antes.custo, depois.custo) ||
    changed(antes.markup, depois.markup)
  )
}

export async function registrarProdutoPrecoHistorico(
  input: RegistrarPrecoHistoricoInput
): Promise<void> {
  const row = {
    id: crypto.randomUUID(),
    empresa_id: input.empresa_id,
    produto_id: input.produto_id,
    preco_anterior: input.preco_anterior,
    preco_novo: Number(input.preco_novo) || 0,
    custo_anterior: input.custo_anterior ?? null,
    custo_novo: input.custo_novo ?? null,
    markup_anterior: input.markup_anterior ?? null,
    markup_novo: input.markup_novo ?? null,
    origem: input.origem || 'CADASTRO',
    usuario_id: input.usuario_id || null,
    created_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('produto_preco_historico').insert(row)
  if (error) {
    // Não bloqueia o save do produto se o histórico falhar (ex.: tabela ainda não criada).
    console.warn('[produto-historico] falha ao registrar preço:', error.message)
  }
}

export async function listProdutoPrecoHistorico(
  produtoId: string,
  options?: { limit?: number }
): Promise<ProdutoPrecoHistorico[]> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500)
  const { data, error } = await supabase
    .from('produto_preco_historico')
    .select('*')
    .eq('produto_id', produtoId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    return {
      id: String(row.id),
      empresa_id: String(row.empresa_id),
      produto_id: String(row.produto_id),
      preco_anterior: numOrNull(row.preco_anterior),
      preco_novo: Number(row.preco_novo) || 0,
      custo_anterior: numOrNull(row.custo_anterior),
      custo_novo: numOrNull(row.custo_novo),
      markup_anterior: numOrNull(row.markup_anterior),
      markup_novo: numOrNull(row.markup_novo),
      origem: String(row.origem || 'CADASTRO'),
      usuario_id: row.usuario_id != null ? String(row.usuario_id) : null,
      created_at: String(row.created_at ?? ''),
    } satisfies ProdutoPrecoHistorico
  })

  const userIds = [...new Set(rows.map((r) => r.usuario_id).filter(Boolean))] as string[]
  if (userIds.length > 0) {
    const { data: users } = await supabase.from('usuarios').select('id, nome').in('id', userIds)
    const nomeMap = new Map((users ?? []).map((u) => [String(u.id), String(u.nome || '')]))
    for (const r of rows) {
      if (r.usuario_id) r.usuario_nome = nomeMap.get(r.usuario_id) || null
    }
  }

  return rows
}

export async function listProdutoEstoqueMovimentos(
  empresaId: string,
  produtoId: string,
  options?: { limit?: number }
): Promise<EstoqueMovimento[]> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500)
  const { data, error } = await supabase
    .from('estoque_movimentos')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('produto_id', produtoId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    return {
      id: String(row.id),
      empresa_id: String(row.empresa_id ?? empresaId),
      produto_id: String(row.produto_id),
      tipo: String(row.tipo) as TipoMovimento,
      quantidade: Number(row.quantidade) || 0,
      custo_unitario: numOrNull(row.custo_unitario),
      referencia_tipo: row.referencia_tipo != null ? String(row.referencia_tipo) : null,
      referencia_id: row.referencia_id != null ? String(row.referencia_id) : null,
      usuario_id: row.usuario_id != null ? String(row.usuario_id) : null,
      created_at: String(row.created_at ?? ''),
    }
  })
}

export function labelTipoMovimento(tipo: string): string {
  switch (tipo) {
    case 'ENTRADA':
      return 'Entrada'
    case 'SAIDA':
      return 'Saída'
    case 'AJUSTE':
      return 'Ajuste'
    case 'DEVOLUCAO':
      return 'Devolução'
    default:
      return tipo
  }
}

export function labelOrigemPreco(origem: string): string {
  switch (origem) {
    case 'CADASTRO':
      return 'Cadastro'
    case 'CRIACAO':
      return 'Criação'
    case 'IMPORTACAO':
      return 'Importação'
    case 'SISTEMA':
      return 'Sistema'
    default:
      return origem
  }
}

export function labelReferenciaMovimento(tipo: string | null, id: string | null): string {
  if (!tipo) return '—'
  if (tipo === 'VENDA') return id ? `Venda ${id.slice(0, 8)}` : 'Venda'
  return id ? `${tipo} ${id.slice(0, 8)}` : tipo
}
