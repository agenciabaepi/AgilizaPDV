import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { getCaixaAberto } from './caixa.service'
import { getClienteById } from './clientes.service'
import { updateSyncClock } from '../sync-clock'
import { addToOutbox } from '../../sync/outbox'
import type { FormaPagamento } from './vendas.service'

export type StatusContaReceber = 'PENDENTE' | 'RECEBIDA' | 'CANCELADA'

export type ContaReceber = {
  id: string
  empresa_id: string
  venda_id: string
  cliente_id: string
  valor: number
  vencimento: string
  status: StatusContaReceber
  recebido_em: string | null
  recebimento_caixa_id: string | null
  forma_recebimento: FormaPagamento | null
  usuario_recebimento_id: string | null
  created_at: string
}

export type VendaPrazoConfig = {
  usar_limite_credito: boolean
  bloquear_inadimplente: boolean
}

function rowToConta(r: Record<string, unknown>): ContaReceber {
  return {
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    venda_id: r.venda_id as string,
    cliente_id: r.cliente_id as string,
    valor: Number(r.valor) || 0,
    vencimento: r.vencimento as string,
    status: r.status as StatusContaReceber,
    recebido_em: (r.recebido_em as string) ?? null,
    recebimento_caixa_id: (r.recebimento_caixa_id as string) ?? null,
    forma_recebimento: (r.forma_recebimento as FormaPagamento) ?? null,
    usuario_recebimento_id: (r.usuario_recebimento_id as string) ?? null,
    created_at: r.created_at as string
  }
}

export function getVendaPrazoConfig(empresaId: string): VendaPrazoConfig {
  const db = getDb()
  if (!db) return { usar_limite_credito: false, bloquear_inadimplente: false }
  const row = db
    .prepare(
      `SELECT venda_prazo_usar_limite_credito, venda_prazo_bloquear_inadimplente FROM empresas_config WHERE empresa_id = ?`
    )
    .get(empresaId) as { venda_prazo_usar_limite_credito?: number; venda_prazo_bloquear_inadimplente?: number } | undefined
  return {
    usar_limite_credito: Number(row?.venda_prazo_usar_limite_credito) === 1,
    bloquear_inadimplente: Number(row?.venda_prazo_bloquear_inadimplente) === 1
  }
}

export function updateVendaPrazoConfig(empresaId: string, data: Partial<VendaPrazoConfig>): VendaPrazoConfig {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const cur = getVendaPrazoConfig(empresaId)
  const usar = data.usar_limite_credito !== undefined ? data.usar_limite_credito : cur.usar_limite_credito
  const bloq = data.bloquear_inadimplente !== undefined ? data.bloquear_inadimplente : cur.bloquear_inadimplente
  const exists = db.prepare('SELECT 1 FROM empresas_config WHERE empresa_id = ?').get(empresaId)
  if (!exists) {
    db.prepare(
      `INSERT INTO empresas_config (empresa_id, venda_prazo_usar_limite_credito, venda_prazo_bloquear_inadimplente, updated_at)
       VALUES (?, ?, ?, datetime('now'))`
    ).run(empresaId, usar ? 1 : 0, bloq ? 1 : 0)
  } else {
    db.prepare(
      `UPDATE empresas_config SET venda_prazo_usar_limite_credito = ?, venda_prazo_bloquear_inadimplente = ?, updated_at = datetime('now') WHERE empresa_id = ?`
    ).run(usar ? 1 : 0, bloq ? 1 : 0, empresaId)
  }
  updateSyncClock()
  return getVendaPrazoConfig(empresaId)
}

/** Soma contas a receber em aberto do cliente (exclui a venda em andamento, se informada). */
export function getTotalAbertoCliente(empresaId: string, clienteId: string, excludeVendaId?: string): number {
  const db = getDb()
  if (!db) return 0
  const row = excludeVendaId
    ? db
        .prepare(
          `SELECT COALESCE(SUM(valor), 0) AS s FROM contas_receber
           WHERE empresa_id = ? AND cliente_id = ? AND status = 'PENDENTE' AND venda_id != ?`
        )
        .get(empresaId, clienteId, excludeVendaId) as { s: number }
    : db
        .prepare(
          `SELECT COALESCE(SUM(valor), 0) AS s FROM contas_receber
           WHERE empresa_id = ? AND cliente_id = ? AND status = 'PENDENTE'`
        )
        .get(empresaId, clienteId) as { s: number }
  return Number(row?.s) || 0
}

/** Cliente com título vencido ainda em aberto. */
export function clienteTemInadimplencia(empresaId: string, clienteId: string): boolean {
  const db = getDb()
  if (!db) return false
  const hoje = new Date().toISOString().slice(0, 10)
  const row = db
    .prepare(
      `SELECT 1 FROM contas_receber WHERE empresa_id = ? AND cliente_id = ? AND status = 'PENDENTE' AND vencimento < ? LIMIT 1`
    )
    .get(empresaId, clienteId, hoje) as { 1?: number } | undefined
  return Boolean(row)
}

export function assertPodeVenderAPrazo(
  empresaId: string,
  clienteId: string,
  valorNovaVenda: number
): void {
  const cfg = getVendaPrazoConfig(empresaId)
  const cliente = getClienteById(clienteId)
  if (!cliente || cliente.empresa_id !== empresaId) throw new Error('Cliente inválido.')

  if (cfg.bloquear_inadimplente && clienteTemInadimplencia(empresaId, clienteId)) {
    throw new Error('Cliente com parcelas vencidas em aberto. Quite ou receba os títulos antes de nova venda a prazo.')
  }

  if (cfg.usar_limite_credito && cliente.limite_credito != null && Number.isFinite(cliente.limite_credito)) {
    const limite = Number(cliente.limite_credito)
    const aberto = getTotalAbertoCliente(empresaId, clienteId)
    if (aberto + valorNovaVenda > limite + 0.01) {
      throw new Error(
        `Limite de crédito excedido. Em aberto: R$ ${aberto.toFixed(2)}; limite: R$ ${limite.toFixed(2)}; esta venda: R$ ${valorNovaVenda.toFixed(2)}.`
      )
    }
  }
}

export function createContaReceberVenda(input: {
  empresa_id: string
  venda_id: string
  cliente_id: string
  valor: number
  vencimento: string
}): ContaReceber {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO contas_receber (id, empresa_id, venda_id, cliente_id, valor, vencimento, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDENTE', ?)`
  ).run(id, input.empresa_id, input.venda_id, input.cliente_id, input.valor, input.vencimento, now)
  const row = db.prepare('SELECT * FROM contas_receber WHERE id = ?').get(id) as Record<string, unknown>
  const conta = rowToConta(row)
  updateSyncClock()
  addToOutbox('contas_receber', id, 'CREATE', conta as unknown as Record<string, unknown>)
  return conta
}

export type ReceberContaInput = {
  conta_id: string
  empresa_id: string
  caixa_id: string
  usuario_id: string
  forma: Exclude<FormaPagamento, 'A_PRAZO' | 'CASHBACK'>
}

export function receberContaReceber(data: ReceberContaInput): ContaReceber {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const caixa = getCaixaAberto(data.empresa_id)
  if (!caixa || caixa.id !== data.caixa_id) throw new Error('Recebimento deve ser feito no caixa aberto atual.')
  const conta = db.prepare('SELECT * FROM contas_receber WHERE id = ?').get(data.conta_id) as Record<string, unknown> | undefined
  if (!conta) throw new Error('Conta a receber não encontrada.')
  if ((conta.empresa_id as string) !== data.empresa_id) throw new Error('Conta não pertence à empresa.')
  if ((conta.status as string) !== 'PENDENTE') throw new Error('Esta conta já foi recebida ou cancelada.')

  const now = new Date().toISOString()
  db.prepare(
    `UPDATE contas_receber SET status = 'RECEBIDA', recebido_em = ?, recebimento_caixa_id = ?, forma_recebimento = ?, usuario_recebimento_id = ?
     WHERE id = ?`
  ).run(now, data.caixa_id, data.forma, data.usuario_id, data.conta_id)

  const updated = db.prepare('SELECT * FROM contas_receber WHERE id = ?').get(data.conta_id) as Record<string, unknown>
  const out = rowToConta(updated)
  updateSyncClock()
  addToOutbox('contas_receber', data.conta_id, 'UPDATE', out as unknown as Record<string, unknown>)
  return JSON.parse(JSON.stringify(out)) as ContaReceber
}

export function cancelarContaReceberVenda(vendaId: string): void {
  const db = getDb()
  if (!db) return
  const row = db.prepare('SELECT id, status FROM contas_receber WHERE venda_id = ?').get(vendaId) as
    | { id: string; status: string }
    | undefined
  if (!row) return
  if (row.status === 'RECEBIDA') throw new Error('Não é possível cancelar: conta a receber já foi recebida.')
  db.prepare(`UPDATE contas_receber SET status = 'CANCELADA' WHERE venda_id = ?`).run(vendaId)
  updateSyncClock()
  addToOutbox('contas_receber', row.id, 'UPDATE', { id: row.id, venda_id: vendaId, status: 'CANCELADA' })
}

export type ListContasReceberOptions = {
  cliente_id?: string
  status?: StatusContaReceber | 'aberto'
  limit?: number
}

export type ContaReceberComCliente = ContaReceber & { cliente_nome: string; venda_numero: number }

/** Dados para cupom de comprovante de recebimento (contas a receber). */
export type ReciboRecebimentoCupomData = {
  empresa_id: string
  empresa_nome: string
  cliente_nome: string
  cliente_doc: string | null
  venda_numero: number
  valor: number
  forma_recebimento: string
  recebido_em: string
  conta_id: string
}

export function getReciboRecebimentoCupomData(contaId: string): ReciboRecebimentoCupomData | null {
  const db = getDb()
  if (!db) return null
  const row = db
    .prepare(
      `
    SELECT c.id AS conta_id, c.empresa_id, c.valor, c.forma_recebimento, c.recebido_em,
      cl.nome AS cliente_nome, cl.cpf_cnpj AS cliente_doc,
      v.numero AS venda_numero,
      e.nome AS empresa_nome
    FROM contas_receber c
    JOIN clientes cl ON cl.id = c.cliente_id
    JOIN vendas v ON v.id = c.venda_id
    JOIN empresas e ON e.id = c.empresa_id
    WHERE c.id = ? AND c.status = 'RECEBIDA'
  `
    )
    .get(contaId) as Record<string, unknown> | undefined
  if (!row) return null
  return {
    empresa_id: String(row.empresa_id ?? ''),
    empresa_nome: String(row.empresa_nome ?? 'Empresa'),
    cliente_nome: String(row.cliente_nome ?? ''),
    cliente_doc: row.cliente_doc ? String(row.cliente_doc).trim() || null : null,
    venda_numero: Number(row.venda_numero) || 0,
    valor: Number(row.valor) || 0,
    forma_recebimento: String(row.forma_recebimento ?? ''),
    recebido_em: String(row.recebido_em ?? ''),
    conta_id: String(row.conta_id),
  }
}

export function listContasReceber(empresaId: string, options?: ListContasReceberOptions): ContaReceberComCliente[] {
  const db = getDb()
  if (!db) return []
  const limit = options?.limit ?? 500
  let sql = `
    SELECT c.*, cl.nome AS cliente_nome, v.numero AS venda_numero
    FROM contas_receber c
    JOIN clientes cl ON cl.id = c.cliente_id
    JOIN vendas v ON v.id = c.venda_id
    WHERE c.empresa_id = ?
  `
  const params: (string | number)[] = [empresaId]
  if (options?.cliente_id) {
    sql += ' AND c.cliente_id = ?'
    params.push(options.cliente_id)
  }
  if (options?.status === 'aberto') {
    sql += " AND c.status = 'PENDENTE'"
  } else if (options?.status) {
    sql += ' AND c.status = ?'
    params.push(options.status)
  }
  sql += ' ORDER BY c.vencimento ASC, c.created_at DESC LIMIT ?'
  params.push(limit)
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map((r) => ({
    ...rowToConta(r),
    cliente_nome: r.cliente_nome as string,
    venda_numero: Number(r.venda_numero) || 0
  }))
}

export type VendaPrazoHistoricoItem = {
  venda_id: string
  numero: number
  total: number
  data_vencimento: string | null
  created_at: string
  conta_status: StatusContaReceber
  valor_conta: number
}

export function listHistoricoVendasPrazoCliente(empresaId: string, clienteId: string, limit = 200): VendaPrazoHistoricoItem[] {
  const db = getDb()
  if (!db) return []
  const rows = db
    .prepare(
      `
    SELECT v.id AS venda_id, v.numero, v.total, v.data_vencimento, v.created_at,
           cr.status AS conta_status, cr.valor AS valor_conta
    FROM vendas v
    JOIN contas_receber cr ON cr.venda_id = v.id
    WHERE v.empresa_id = ? AND v.cliente_id = ? AND COALESCE(v.venda_a_prazo, 0) = 1
    ORDER BY v.created_at DESC
    LIMIT ?
  `
    )
    .all(empresaId, clienteId, limit) as Record<string, unknown>[]
  return rows.map((r) => ({
    venda_id: r.venda_id as string,
    numero: Number(r.numero) || 0,
    total: Number(r.total) || 0,
    data_vencimento: (r.data_vencimento as string) ?? null,
    created_at: r.created_at as string,
    conta_status: r.conta_status as StatusContaReceber,
    valor_conta: Number(r.valor_conta) || 0
  }))
}
