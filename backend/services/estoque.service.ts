import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { addToOutbox } from '../../sync/outbox'

export type TipoMovimento = 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'DEVOLUCAO'

export type EstoqueMovimento = {
  id: string
  empresa_id: string
  produto_id: string
  tipo: TipoMovimento
  quantidade: number
  custo_unitario: number | null
  referencia_tipo: string | null
  referencia_id: string | null
  usuario_id: string | null
  created_at: string
}

function rowToMovimento(r: Record<string, unknown>): EstoqueMovimento {
  return {
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    produto_id: r.produto_id as string,
    tipo: r.tipo as TipoMovimento,
    quantidade: r.quantidade as number,
    custo_unitario: (r.custo_unitario as number) ?? null,
    referencia_tipo: (r.referencia_tipo as string) ?? null,
    referencia_id: (r.referencia_id as string) ?? null,
    usuario_id: (r.usuario_id as string) ?? null,
    created_at: r.created_at as string
  }
}

/** Contribuição do movimento para o saldo: ENTRADA/DEVOLUCAO +qty, SAIDA -qty, AJUSTE +qty (qty pode ser negativo) */
function contribuicaoSaldo(tipo: TipoMovimento, quantidade: number): number {
  switch (tipo) {
    case 'ENTRADA':
    case 'DEVOLUCAO':
      return quantidade
    case 'SAIDA':
      return -quantidade
    case 'AJUSTE':
      return quantidade
    default:
      return 0
  }
}

export function listMovimentos(
  empresaId: string,
  options?: { produtoId?: string; limit?: number }
): EstoqueMovimento[] {
  const db = getDb()
  if (!db) return []
  let sql = `
    SELECT id, empresa_id, produto_id, tipo, quantidade, custo_unitario, referencia_tipo, referencia_id, usuario_id, created_at
    FROM estoque_movimentos WHERE empresa_id = ?
  `
  const params: (string | number)[] = [empresaId]
  if (options?.produtoId) {
    sql += ` AND produto_id = ?`
    params.push(options.produtoId)
  }
  sql += ` ORDER BY created_at DESC`
  if (options?.limit) {
    sql += ` LIMIT ?`
    params.push(options.limit)
  }
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map(rowToMovimento)
}

/** Saldo atual do produto (soma dos movimentos). */
export function getSaldo(empresaId: string, produtoId: string): number {
  const db = getDb()
  if (!db) return 0
  const rows = db.prepare(`
    SELECT tipo, quantidade FROM estoque_movimentos
    WHERE empresa_id = ? AND produto_id = ?
  `).all(empresaId, produtoId) as { tipo: TipoMovimento; quantidade: number }[]
  return rows.reduce((acc, r) => acc + contribuicaoSaldo(r.tipo, r.quantidade), 0)
}

/** Lista produtos da empresa com saldo atual (apenas produtos que controlam estoque, ou todos). */
export type ProdutoSaldo = {
  produto_id: string
  nome: string
  unidade: string
  saldo: number
  estoque_minimo: number
}

export function listSaldosPorProduto(empresaId: string): ProdutoSaldo[] {
  const db = getDb()
  if (!db) return []
  const produtos = db.prepare(`
    SELECT id, nome, unidade, estoque_minimo, estoque_atual FROM produtos
    WHERE empresa_id = ? AND ativo = 1 AND controla_estoque = 1
    ORDER BY nome
  `).all(empresaId) as { id: string; nome: string; unidade: string; estoque_minimo: number; estoque_atual: number | null }[]
  return produtos.map((p) => {
    const saldo = p.estoque_atual != null ? p.estoque_atual : getSaldo(empresaId, p.id)
    return {
      produto_id: p.id,
      nome: p.nome,
      unidade: p.unidade,
      saldo,
      estoque_minimo: p.estoque_minimo
    }
  })
}

export type RegistrarMovimentoInput = {
  empresa_id: string
  produto_id: string
  tipo: TipoMovimento
  quantidade: number
  custo_unitario?: number
  referencia_tipo?: string
  referencia_id?: string
  usuario_id?: string
  /** Se true, não bloqueia quando o saldo ficaria negativo (ex.: venda à revelia). */
  permitir_saldo_negativo?: boolean
}

export function registrarMovimento(data: RegistrarMovimentoInput): EstoqueMovimento {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  if (data.quantidade === 0) throw new Error('Quantidade deve ser diferente de zero')
  if (data.tipo === 'SAIDA' && data.quantidade < 0) throw new Error('Para SAIDA use quantidade positiva')
  const saldoAtual = getSaldo(data.empresa_id, data.produto_id)
  const variacao = contribuicaoSaldo(data.tipo, data.quantidade)
  if (saldoAtual + variacao < 0 && !data.permitir_saldo_negativo) {
    throw new Error(`Saldo insuficiente. Atual: ${saldoAtual}`)
  }
  const id = randomUUID()
  db.prepare(`
    INSERT INTO estoque_movimentos (id, empresa_id, produto_id, tipo, quantidade, custo_unitario, referencia_tipo, referencia_id, usuario_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.empresa_id,
    data.produto_id,
    data.tipo,
    data.tipo === 'AJUSTE' ? data.quantidade : Math.abs(data.quantidade),
    data.custo_unitario ?? null,
    data.referencia_tipo ?? null,
    data.referencia_id ?? null,
    data.usuario_id ?? null
  )
  const novoSaldo = getSaldo(data.empresa_id, data.produto_id)
  db.prepare('UPDATE produtos SET estoque_atual = ? WHERE id = ?').run(novoSaldo, data.produto_id)
  const row = db.prepare('SELECT id, empresa_id, produto_id, tipo, quantidade, custo_unitario, referencia_tipo, referencia_id, usuario_id, created_at FROM estoque_movimentos WHERE id = ?').get(id) as Record<string, unknown>
  const movimento = rowToMovimento(row)
  addToOutbox('estoque_movimentos', id, 'CREATE', movimento as unknown as Record<string, unknown>)
  return movimento
}

/** Ajusta o saldo do produto para o valor informado (cria movimento AJUSTE se necessário). */
export function ajustarSaldoPara(empresaId: string, produtoId: string, novoSaldo: number): void {
  const saldoAtual = getSaldo(empresaId, produtoId)
  const delta = novoSaldo - saldoAtual
  if (delta === 0) return
  registrarMovimento({
    empresa_id: empresaId,
    produto_id: produtoId,
    tipo: 'AJUSTE',
    quantidade: delta,
    permitir_saldo_negativo: true
  })
}
