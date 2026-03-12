import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type { FormaPagamento } from './vendas.service'
import { addToOutbox } from '../../sync/outbox'
import { updateSyncClock } from '../sync-clock'

export type StatusCaixa = 'ABERTO' | 'FECHADO'
export type TipoMovimentoCaixa = 'SANGRIA' | 'SUPRIMENTO'

export type Caixa = {
  id: string
  empresa_id: string
  usuario_id: string
  status: StatusCaixa
  valor_inicial: number
  aberto_em: string
  fechado_em: string | null
}

export type CaixaMovimento = {
  id: string
  empresa_id: string
  caixa_id: string
  tipo: TipoMovimentoCaixa
  valor: number
  motivo: string | null
  usuario_id: string
  created_at: string
}

export type ResumoFechamentoCaixa = {
  /** Quanto o sistema espera que haja fisicamente no caixa (dinheiro em espécie), considerando abertura, sangrias/suprimentos, vendas em dinheiro e troco. */
  saldo_atual: number
  totais_por_forma: { forma: FormaPagamento; total: number }[]
}

function rowToCaixa(r: Record<string, unknown>): Caixa {
  return {
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    usuario_id: r.usuario_id as string,
    status: r.status as StatusCaixa,
    valor_inicial: (r.valor_inicial as number) ?? 0,
    aberto_em: r.aberto_em as string,
    fechado_em: (r.fechado_em as string) ?? null
  }
}

function rowToMovimento(r: Record<string, unknown>): CaixaMovimento {
  return {
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    caixa_id: r.caixa_id as string,
    tipo: r.tipo as TipoMovimentoCaixa,
    valor: r.valor as number,
    motivo: (r.motivo as string) ?? null,
    usuario_id: r.usuario_id as string,
    created_at: r.created_at as string
  }
}

/** Retorna o caixa aberto da empresa, se existir. Apenas um caixa ABERTO por empresa. */
export function getCaixaAberto(empresaId: string): Caixa | null {
  const db = getDb()
  if (!db) return null
  const row = db.prepare(`
    SELECT id, empresa_id, usuario_id, status, valor_inicial, aberto_em, fechado_em
    FROM caixas WHERE empresa_id = ? AND status = 'ABERTO' ORDER BY aberto_em DESC LIMIT 1
  `).get(empresaId) as Record<string, unknown> | undefined
  return row ? rowToCaixa(row) : null
}

export function abrirCaixa(empresaId: string, usuarioId: string, valorInicial: number): Caixa {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  if (valorInicial <= 0) throw new Error('Informe um valor maior que zero para abrir o caixa.')
  const aberto = getCaixaAberto(empresaId)
  if (aberto) throw new Error('Já existe um caixa aberto. Feche-o antes de abrir outro.')
  const id = randomUUID()
  db.prepare(`
    INSERT INTO caixas (id, empresa_id, usuario_id, status, valor_inicial)
    VALUES (?, ?, ?, 'ABERTO', ?)
  `).run(id, empresaId, usuarioId, valorInicial)
  // Garante que a abertura do caixa foi persistida no disco (modo WAL).
  try {
    db.pragma('wal_checkpoint(TRUNCATE)')
  } catch {
    // ignora se o pragma falhar (ex.: modo não-WAL)
  }
  const row = db.prepare('SELECT id, empresa_id, usuario_id, status, valor_inicial, aberto_em, fechado_em FROM caixas WHERE id = ?').get(id) as Record<string, unknown>
  const caixa = rowToCaixa(row)
  updateSyncClock()
  addToOutbox('caixas', caixa.id, 'CREATE', caixa as unknown as Record<string, unknown>)
  return caixa
}

export function fecharCaixa(caixaId: string): Caixa {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const current = db.prepare('SELECT id, status FROM caixas WHERE id = ?').get(caixaId) as { id: string; status: string } | undefined
  if (!current) throw new Error('Caixa não encontrado.')
  if (current.status !== 'ABERTO') throw new Error('Este caixa já está fechado.')
  const now = new Date().toISOString()
  db.prepare('UPDATE caixas SET status = ?, fechado_em = ? WHERE id = ?').run('FECHADO', now, caixaId)
  const row = db.prepare('SELECT id, empresa_id, usuario_id, status, valor_inicial, aberto_em, fechado_em FROM caixas WHERE id = ?').get(caixaId) as Record<string, unknown>
  const caixa = rowToCaixa(row)
  updateSyncClock()
  addToOutbox('caixas', caixa.id, 'UPDATE', caixa as unknown as Record<string, unknown>)
  return caixa
}

export function listCaixas(empresaId: string, limit = 50): Caixa[] {
  const db = getDb()
  if (!db) return []
  const rows = db.prepare(`
    SELECT id, empresa_id, usuario_id, status, valor_inicial, aberto_em, fechado_em
    FROM caixas WHERE empresa_id = ? ORDER BY aberto_em DESC LIMIT ?
  `).all(empresaId, limit) as Record<string, unknown>[]
  return rows.map(rowToCaixa)
}

export function getCaixaById(caixaId: string): Caixa | null {
  const db = getDb()
  if (!db) return null
  const row = db
    .prepare(
      'SELECT id, empresa_id, usuario_id, status, valor_inicial, aberto_em, fechado_em FROM caixas WHERE id = ? LIMIT 1'
    )
    .get(caixaId) as Record<string, unknown> | undefined
  return row ? rowToCaixa(row) : null
}

/** Saldo do caixa: valor_inicial + SUPRIMENTO - SANGRIA */
export function getSaldoCaixa(caixaId: string): number {
  const db = getDb()
  if (!db) return 0
  const caixa = db.prepare('SELECT valor_inicial FROM caixas WHERE id = ?').get(caixaId) as { valor_inicial: number } | undefined
  if (!caixa) return 0
  const movimentos = db.prepare(`
    SELECT tipo, valor FROM caixa_movimentos WHERE caixa_id = ?
  `).all(caixaId) as { tipo: TipoMovimentoCaixa; valor: number }[]
  const soma = movimentos.reduce((acc, m) => acc + (m.tipo === 'SUPRIMENTO' ? m.valor : -m.valor), 0)
  return caixa.valor_inicial + soma
}

export function listMovimentosCaixa(caixaId: string): CaixaMovimento[] {
  const db = getDb()
  if (!db) return []
  const rows = db.prepare(`
    SELECT id, empresa_id, caixa_id, tipo, valor, motivo, usuario_id, created_at
    FROM caixa_movimentos WHERE caixa_id = ? ORDER BY created_at DESC
  `).all(caixaId) as Record<string, unknown>[]
  return rows.map(rowToMovimento)
}

/** Resumo para fechamento do caixa: saldo atual e totais por forma de pagamento das vendas concluídas vinculadas ao caixa. */
export function getResumoFechamentoCaixa(caixaId: string): ResumoFechamentoCaixa {
  const db = getDb()
  if (!db) {
    return { saldo_atual: 0, totais_por_forma: [] }
  }

  // Base: valor inicial + SUPRIMENTO - SANGRIA (movimentos de caixa)
  const saldo_base = getSaldoCaixa(caixaId)

  // Total em vendas (todas as formas) deste caixa
  const rowTotais = db
    .prepare(
      `
      SELECT COALESCE(SUM(v.total), 0) AS total_vendas
      FROM vendas v
      WHERE v.caixa_id = ?
        AND v.status = 'CONCLUIDA'
    `
    )
    .get(caixaId) as { total_vendas: number } | undefined

  const total_vendas = rowTotais?.total_vendas ?? 0

  // Saldo esperado no caixa: abertura + movimentos + total em vendas
  const saldo_atual = saldo_base + total_vendas

  const rows = db
    .prepare(
      `
      SELECT p.forma AS forma, SUM(p.valor) AS total
      FROM pagamentos p
      JOIN vendas v ON v.id = p.venda_id
      WHERE v.caixa_id = ?
        AND v.status = 'CONCLUIDA'
      GROUP BY p.forma
      ORDER BY p.forma
    `
    )
    .all(caixaId) as { forma: FormaPagamento; total: number }[]

  const totais_por_forma = rows.map((r) => ({
    forma: r.forma,
    total: r.total ?? 0
  }))

  return { saldo_atual, totais_por_forma }
}

export type RegistrarMovimentoCaixaInput = {
  caixa_id: string
  empresa_id: string
  tipo: TipoMovimentoCaixa
  valor: number
  motivo?: string
  usuario_id: string
}

export function registrarMovimentoCaixa(data: RegistrarMovimentoCaixaInput): CaixaMovimento {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const caixa = db.prepare('SELECT id, status FROM caixas WHERE id = ?').get(data.caixa_id) as { id: string; status: string } | undefined
  if (!caixa || caixa.status !== 'ABERTO') throw new Error('Caixa não está aberto.')
  if (data.valor <= 0) throw new Error('Valor deve ser positivo.')
  if (data.tipo === 'SANGRIA') {
    const saldo = getSaldoCaixa(data.caixa_id)
    if (saldo < data.valor) throw new Error(`Saldo insuficiente no caixa (R$ ${saldo.toFixed(2)}).`)
  }
  const id = randomUUID()
  db.prepare(`
    INSERT INTO caixa_movimentos (id, empresa_id, caixa_id, tipo, valor, motivo, usuario_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.empresa_id, data.caixa_id, data.tipo, data.valor, data.motivo ?? null, data.usuario_id)
  const row = db.prepare('SELECT id, empresa_id, caixa_id, tipo, valor, motivo, usuario_id, created_at FROM caixa_movimentos WHERE id = ?').get(id) as Record<string, unknown>
  const movimento = rowToMovimento(row)
  updateSyncClock()
  addToOutbox('caixa_movimentos', movimento.id, 'CREATE', movimento as unknown as Record<string, unknown>)
  return movimento
}
