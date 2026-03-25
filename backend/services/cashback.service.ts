import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3'
import { getDb } from '../db'
import { getClienteById } from './clientes.service'
import type { ItemVendaInput, PagamentoInput } from './vendas.service'

/** Documento do cliente lido na mesma conexão SQLite da transação da venda (e da empresa correta). */
function getClienteCashbackDocSource(
  db: Database.Database,
  empresaId: string,
  clienteId: string
): { cpf_cnpj: string | null } | null {
  const row = db
    .prepare(`SELECT cpf_cnpj FROM clientes WHERE id = ? AND empresa_id = ? LIMIT 1`)
    .get(clienteId, empresaId) as { cpf_cnpj: string | null } | undefined
  return row ?? null
}

export type CashbackModoValidade = 'DIAS' | 'FIXA' | 'NUNCA'
export type CashbackCalcularSobre = 'BRUTO' | 'LIQUIDO' | 'ELEGIVEL'
export type CashbackModoLista = 'TODOS_EXCETO_EXCLUIDOS' | 'APENAS_INCLUIDOS'
export type CashbackArredondamento = 'PADRAO' | 'PARA_BAIXO'

export type CashbackConfig = {
  id: string
  empresa_id: string
  ativo: number
  percentual_padrao: number
  modo_validade: CashbackModoValidade
  dias_validade: number | null
  data_validade_fixa: string | null
  valor_minimo_compra_gerar: number
  valor_minimo_compra_usar: number
  valor_maximo_uso_por_venda: number | null
  permitir_quitar_total: number
  permitir_uso_mesma_compra: number
  calcular_sobre: CashbackCalcularSobre
  excluir_itens_com_desconto: number
  excluir_itens_promocionais: number
  gerar_sobre_valor_apos_cashback: number
  modo_lista: CashbackModoLista
  arredondamento: CashbackArredondamento
  dias_alerta_expiracao: number
  updated_at: string | null
}

export type CashbackRegra = {
  id: string
  empresa_id: string
  tipo: 'EXCLUIR_PRODUTO' | 'INCLUIR_PRODUTO' | 'PERCENTUAL_PRODUTO' | 'PERCENTUAL_CATEGORIA'
  produto_id: string | null
  categoria_id: string | null
  percentual: number | null
  ativo: number
  valido_de: string | null
  valido_ate: string | null
}

export type CashbackSaldoResumo = {
  cliente_id: string
  cpf_normalizado: string
  saldo_disponivel: number
  saldo_expirado_acumulado: number
  total_gerado: number
  total_utilizado: number
  bloqueado: boolean
  prestes_expirar: number
  proxima_expiracao: string | null
}

export type CashbackMovRow = {
  id: string
  tipo: string
  origem: string
  venda_id: string | null
  valor: number
  saldo_disponivel_apos: number | null
  observacao: string | null
  created_by: string | null
  created_at: string
}

export type CashbackCreditoRow = {
  id: string
  venda_id_origem: string | null
  valor_inicial: number
  valor_restante: number
  expira_em: string | null
  status: string
  created_at: string
}

/** Apenas dígitos; CPF 11 ou CNPJ 14 para identificação no programa. */
export function normalizeDocDigits(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const d = raw.replace(/\D/g, '')
  if (d.length === 11 || d.length === 14) return d
  return null
}

export function isCpf11(digits: string): boolean {
  return digits.length === 11 && validarCpf(digits)
}

function validarCpf(cpf: string): boolean {
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false
  let s = 0
  for (let i = 0; i < 9; i++) s += parseInt(cpf[i]!, 10) * (10 - i)
  let d1 = (s * 10) % 11
  if (d1 === 10) d1 = 0
  if (d1 !== parseInt(cpf[9]!, 10)) return false
  s = 0
  for (let i = 0; i < 10; i++) s += parseInt(cpf[i]!, 10) * (11 - i)
  let d2 = (s * 10) % 11
  if (d2 === 10) d2 = 0
  return d2 === parseInt(cpf[10]!, 10)
}

function roundMoney(n: number, ar: CashbackArredondamento): number {
  if (ar === 'PARA_BAIXO') return Math.floor(n * 100) / 100
  return Math.round(n * 100) / 100
}

function rowConfig(r: Record<string, unknown>): CashbackConfig {
  return {
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    ativo: Number(r.ativo) || 0,
    percentual_padrao: Number(r.percentual_padrao) || 0,
    modo_validade: (r.modo_validade as CashbackModoValidade) || 'NUNCA',
    dias_validade: r.dias_validade != null ? Number(r.dias_validade) : null,
    data_validade_fixa: (r.data_validade_fixa as string) ?? null,
    valor_minimo_compra_gerar: Number(r.valor_minimo_compra_gerar) || 0,
    valor_minimo_compra_usar: Number(r.valor_minimo_compra_usar) || 0,
    valor_maximo_uso_por_venda: r.valor_maximo_uso_por_venda != null ? Number(r.valor_maximo_uso_por_venda) : null,
    permitir_quitar_total: Number(r.permitir_quitar_total) !== 0 ? 1 : 0,
    permitir_uso_mesma_compra: Number(r.permitir_uso_mesma_compra) !== 0 ? 1 : 0,
    calcular_sobre: (r.calcular_sobre as CashbackCalcularSobre) || 'ELEGIVEL',
    excluir_itens_com_desconto: Number(r.excluir_itens_com_desconto) || 0,
    excluir_itens_promocionais: Number(r.excluir_itens_promocionais) || 0,
    gerar_sobre_valor_apos_cashback: Number(r.gerar_sobre_valor_apos_cashback) || 0,
    modo_lista: (r.modo_lista as CashbackModoLista) || 'TODOS_EXCETO_EXCLUIDOS',
    arredondamento: (r.arredondamento as CashbackArredondamento) || 'PADRAO',
    dias_alerta_expiracao: Number(r.dias_alerta_expiracao) || 7,
    updated_at: (r.updated_at as string) ?? null
  }
}

export function getCashbackConfig(empresaId: string): CashbackConfig {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  let row = db.prepare('SELECT * FROM cashback_configuracoes WHERE empresa_id = ?').get(empresaId) as Record<string, unknown> | undefined
  if (!row) {
    const id = randomUUID()
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO cashback_configuracoes (id, empresa_id, ativo, percentual_padrao, modo_validade, updated_at)
       VALUES (?, ?, 0, 0, 'NUNCA', ?)`
    ).run(id, empresaId, now)
    row = db.prepare('SELECT * FROM cashback_configuracoes WHERE empresa_id = ?').get(empresaId) as Record<string, unknown>
  }
  return rowConfig(row)
}

export function updateCashbackConfig(
  empresaId: string,
  data: Partial<{
    ativo: boolean
    percentual_padrao: number
    modo_validade: CashbackModoValidade
    dias_validade: number | null
    data_validade_fixa: string | null
    valor_minimo_compra_gerar: number
    valor_minimo_compra_usar: number
    valor_maximo_uso_por_venda: number | null
    permitir_quitar_total: boolean
    permitir_uso_mesma_compra: boolean
    calcular_sobre: CashbackCalcularSobre
    excluir_itens_com_desconto: boolean
    excluir_itens_promocionais: boolean
    gerar_sobre_valor_apos_cashback: boolean
    modo_lista: CashbackModoLista
    arredondamento: CashbackArredondamento
    dias_alerta_expiracao: number
  }>
): CashbackConfig {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  getCashbackConfig(empresaId)
  const cur = getCashbackConfig(empresaId)
  const now = new Date().toISOString()
  const next = {
    ativo: data.ativo !== undefined ? (data.ativo ? 1 : 0) : cur.ativo,
    percentual_padrao: data.percentual_padrao ?? cur.percentual_padrao,
    modo_validade: data.modo_validade ?? cur.modo_validade,
    dias_validade: data.dias_validade !== undefined ? data.dias_validade : cur.dias_validade,
    data_validade_fixa: data.data_validade_fixa !== undefined ? data.data_validade_fixa : cur.data_validade_fixa,
    valor_minimo_compra_gerar: data.valor_minimo_compra_gerar ?? cur.valor_minimo_compra_gerar,
    valor_minimo_compra_usar: data.valor_minimo_compra_usar ?? cur.valor_minimo_compra_usar,
    valor_maximo_uso_por_venda:
      data.valor_maximo_uso_por_venda !== undefined ? data.valor_maximo_uso_por_venda : cur.valor_maximo_uso_por_venda,
    permitir_quitar_total: data.permitir_quitar_total !== undefined ? (data.permitir_quitar_total ? 1 : 0) : cur.permitir_quitar_total,
    permitir_uso_mesma_compra:
      data.permitir_uso_mesma_compra !== undefined ? (data.permitir_uso_mesma_compra ? 1 : 0) : cur.permitir_uso_mesma_compra,
    calcular_sobre: data.calcular_sobre ?? cur.calcular_sobre,
    excluir_itens_com_desconto:
      data.excluir_itens_com_desconto !== undefined ? (data.excluir_itens_com_desconto ? 1 : 0) : cur.excluir_itens_com_desconto,
    excluir_itens_promocionais:
      data.excluir_itens_promocionais !== undefined ? (data.excluir_itens_promocionais ? 1 : 0) : cur.excluir_itens_promocionais,
    gerar_sobre_valor_apos_cashback:
      data.gerar_sobre_valor_apos_cashback !== undefined
        ? data.gerar_sobre_valor_apos_cashback
          ? 1
          : 0
        : cur.gerar_sobre_valor_apos_cashback,
    modo_lista: data.modo_lista ?? cur.modo_lista,
    arredondamento: data.arredondamento ?? cur.arredondamento,
    dias_alerta_expiracao: data.dias_alerta_expiracao ?? cur.dias_alerta_expiracao
  }
  db.prepare(
    `UPDATE cashback_configuracoes SET
      ativo = ?, percentual_padrao = ?, modo_validade = ?, dias_validade = ?, data_validade_fixa = ?,
      valor_minimo_compra_gerar = ?, valor_minimo_compra_usar = ?, valor_maximo_uso_por_venda = ?,
      permitir_quitar_total = ?, permitir_uso_mesma_compra = ?, calcular_sobre = ?,
      excluir_itens_com_desconto = ?, excluir_itens_promocionais = ?, gerar_sobre_valor_apos_cashback = ?,
      modo_lista = ?, arredondamento = ?, dias_alerta_expiracao = ?, updated_at = ?
     WHERE empresa_id = ?`
  ).run(
    next.ativo,
    next.percentual_padrao,
    next.modo_validade,
    next.dias_validade,
    next.data_validade_fixa,
    next.valor_minimo_compra_gerar,
    next.valor_minimo_compra_usar,
    next.valor_maximo_uso_por_venda,
    next.permitir_quitar_total,
    next.permitir_uso_mesma_compra,
    next.calcular_sobre,
    next.excluir_itens_com_desconto,
    next.excluir_itens_promocionais,
    next.gerar_sobre_valor_apos_cashback,
    next.modo_lista,
    next.arredondamento,
    next.dias_alerta_expiracao,
    now,
    empresaId
  )
  return getCashbackConfig(empresaId)
}

function regraVigente(r: CashbackRegra, now: string): boolean {
  if (!r.ativo) return false
  if (r.valido_de && r.valido_de > now) return false
  if (r.valido_ate && r.valido_ate < now) return false
  return true
}

function loadRegras(db: Database.Database, empresaId: string): CashbackRegra[] {
  const rows = db
    .prepare('SELECT * FROM cashback_regras WHERE empresa_id = ?')
    .all(empresaId) as Record<string, unknown>[]
  return rows.map((x) => ({
    id: x.id as string,
    empresa_id: x.empresa_id as string,
    tipo: x.tipo as CashbackRegra['tipo'],
    produto_id: (x.produto_id as string) ?? null,
    categoria_id: (x.categoria_id as string) ?? null,
    percentual: x.percentual != null ? Number(x.percentual) : null,
    ativo: Number(x.ativo) || 0,
    valido_de: (x.valido_de as string) ?? null,
    valido_ate: (x.valido_ate as string) ?? null
  }))
}

function computeExpiryIso(config: CashbackConfig, purchaseAt: Date): string | null {
  if (config.modo_validade === 'NUNCA') return null
  if (config.modo_validade === 'DIAS') {
    const d = config.dias_validade
    if (d == null || d <= 0) return null
    const end = new Date(purchaseAt.getTime() + d * 24 * 60 * 60 * 1000)
    return end.toISOString()
  }
  if (config.modo_validade === 'FIXA' && config.data_validade_fixa) {
    const [y, m, day] = config.data_validade_fixa.split('-').map(Number)
    if (!y || !m || !day) return null
    const end = new Date(Date.UTC(y, m - 1, day, 23, 59, 59, 999))
    return end.toISOString()
  }
  return null
}

function saldoDisponivelFromCreditos(
  db: Database.Database,
  empresaId: string,
  cpf: string,
  agora: string
): number {
  const rows = db
    .prepare(
      `SELECT COALESCE(SUM(valor_restante), 0) AS s FROM cashback_creditos
       WHERE empresa_id = ? AND cpf_normalizado = ? AND status = 'ATIVO'
         AND valor_restante > 0
         AND (expira_em IS NULL OR expira_em > ?)`
    )
    .get(empresaId, cpf, agora) as { s: number }
  return Number(rows.s) || 0
}

/** Expira créditos vencidos e grava movimentações (idempotente por crédito). */
export function processarExpiracoesCashback(empresaId: string, cpfNormalizado?: string): void {
  const db = getDb()
  if (!db) return
  const agora = new Date().toISOString()
  const sqlExtra = cpfNormalizado ? ' AND cpf_normalizado = ?' : ''
  const params: string[] = [agora, empresaId]
  if (cpfNormalizado) params.push(cpfNormalizado)
  const vencidos = db
    .prepare(
      `SELECT * FROM cashback_creditos
       WHERE status = 'ATIVO' AND valor_restante > 0 AND expira_em IS NOT NULL AND expira_em <= ? AND empresa_id = ?${sqlExtra}`
    )
    .all(...params) as Record<string, unknown>[]

  for (const c of vencidos) {
    const creditoId = c.id as string
    const restante = Number(c.valor_restante) || 0
    if (restante <= 0) continue
    const clienteId = c.cliente_id as string
    const cpf = c.cpf_normalizado as string
    const emp = c.empresa_id as string
    const exists = db
      .prepare(`SELECT 1 FROM cashback_movimentacoes WHERE tipo = 'EXPIRACAO' AND credito_id = ? LIMIT 1`)
      .get(creditoId)
    if (exists) continue

    db.transaction(() => {
      db.prepare(`UPDATE cashback_creditos SET status = 'EXPIRADO', valor_restante = 0 WHERE id = ?`).run(creditoId)
      const movId = randomUUID()
      const saldoApos = saldoDisponivelFromCreditos(db, emp, cpf, agora)
      db.prepare(
        `INSERT INTO cashback_movimentacoes (id, empresa_id, cliente_id, cpf_normalizado, tipo, origem, venda_id, credito_id, valor, saldo_disponivel_apos, idempotency_key, observacao, created_at)
         VALUES (?, ?, ?, ?, 'EXPIRACAO', 'JOB', NULL, ?, ?, ?, ?, ?, ?)`
      ).run(movId, emp, clienteId, cpf, creditoId, restante, saldoApos, `exp:${creditoId}`, 'Expiração automática', agora)

      ensureSaldoRow(db, emp, clienteId, cpf)
      db.prepare(
        `UPDATE cashback_saldos SET saldo_disponivel = saldo_disponivel - ?, saldo_expirado_acumulado = saldo_expirado_acumulado + ?, updated_at = ?
         WHERE empresa_id = ? AND cliente_id = ?`
      ).run(restante, restante, agora, emp, clienteId)
    })()
  }
}

function ensureSaldoRow(db: Database.Database, empresaId: string, clienteId: string, cpfNorm: string): void {
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO cashback_saldos (empresa_id, cliente_id, cpf_normalizado, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(empresa_id, cliente_id) DO UPDATE SET cpf_normalizado = excluded.cpf_normalizado, updated_at = excluded.updated_at`
  ).run(empresaId, clienteId, cpfNorm, now)
}

/** Itens enriquecidos no fechamento da venda (resgate por produto). */
export type ItemVendaParaCashback = ItemVendaInput & {
  categoria_id: string | null
  cashback_ativo: number
  cashback_percentual: number | null
  permitir_resgate_cashback_no_produto: number
}

/**
 * Cashback gerado: percentual global (config) sobre o valor total da compra.
 * Opcionalmente exclui do cálculo o valor pago com cashback (config gerar_sobre_valor_apos_cashback).
 */
export function calcularCashbackGeradoNaVenda(config: CashbackConfig, total: number, cashbackUsado: number): number {
  if (!config.ativo) return 0
  if (config.percentual_padrao <= 0 || total <= 0) return 0
  let base = total
  if (!config.gerar_sobre_valor_apos_cashback && cashbackUsado > 0) {
    base = Math.max(0, total - cashbackUsado)
  }
  const earned = roundMoney((base * config.percentual_padrao) / 100, config.arredondamento)
  return Math.max(0, earned)
}

/** Dados para impressão do cupom (somente com cliente na venda). */
export type CashbackCupomExtras = {
  cliente_nome: string
  gerado: number
  usado: number
  /** null se cliente sem CPF/CNPJ válido no programa */
  saldo_disponivel: number | null
  /** Expiração do crédito originado nesta venda; null se não expira ou não houve geração */
  validade_credito_iso: string | null
  /** Motivo para não ter gerado cashback nesta venda (quando aplicável). */
  motivo_nao_gerado?: string
}

export function getCashbackCupomExtras(
  empresaId: string,
  venda: { id: string; cliente_id: string | null; cashback_gerado: number; cashback_usado: number; total?: number }
): CashbackCupomExtras | null {
  if (!venda.cliente_id) return null
  const db = getDb()
  if (!db) return null
  const cliente = getClienteById(venda.cliente_id)
  if (!cliente || cliente.empresa_id !== empresaId) return null
  const cfg = getCashbackConfig(empresaId)
  const doc = normalizeDocDigits(cliente.cpf_cnpj)

  let validade: string | null = null
  if ((venda.cashback_gerado ?? 0) > 0) {
    const row = db
      .prepare(`SELECT expira_em FROM cashback_creditos WHERE venda_id_origem = ? ORDER BY created_at DESC LIMIT 1`)
      .get(venda.id) as { expira_em: string | null } | undefined
    validade = row?.expira_em ?? null
  }

  let motivo: string | undefined
  if ((venda.cashback_gerado ?? 0) <= 0 && (venda.cashback_usado ?? 0) <= 0) {
    if (!cfg.ativo) motivo = 'Programa de cashback desativado no painel administrativo.'
    else if (cfg.percentual_padrao <= 0) motivo = 'Percentual de cashback está zerado nas configurações.'
    else if (!doc || (doc.length !== 11 && doc.length !== 14)) motivo = 'Cliente sem CPF/CNPJ válido (11 ou 14 dígitos).'
    else if (cfg.valor_minimo_compra_gerar > 0 && (venda.total ?? 0) < cfg.valor_minimo_compra_gerar) {
      motivo = `Compra abaixo do mínimo para gerar cashback (R$ ${cfg.valor_minimo_compra_gerar.toFixed(2)}).`
    }
  }

  const saldoRes = getSaldoCashbackCliente(empresaId, venda.cliente_id)
  return {
    cliente_nome: cliente.nome,
    gerado: venda.cashback_gerado ?? 0,
    usado: venda.cashback_usado ?? 0,
    saldo_disponivel: saldoRes?.saldo_disponivel ?? null,
    validade_credito_iso: validade,
    motivo_nao_gerado: motivo
  }
}

export type ProcessarCashbackVendaInput = {
  empresa_id: string
  usuario_id: string
  venda_id: string
  cliente_id: string | null
  itens: ItemVendaParaCashback[]
  subtotal: number
  desconto_total: number
  total: number
  pagamentos: PagamentoInput[]
}

/** Deve ser chamado dentro da mesma transação da venda (mesma conexão SQLite). */
export function processarCashbackAposInserirVenda(db: Database.Database, input: ProcessarCashbackVendaInput): {
  cashback_gerado: number
  cashback_usado: number
} {
  let cfgRaw = db.prepare('SELECT * FROM cashback_configuracoes WHERE empresa_id = ?').get(input.empresa_id) as Record<string, unknown> | undefined
  if (!cfgRaw) {
    const id = randomUUID()
    const nowIns = new Date().toISOString()
    db.prepare(
      `INSERT INTO cashback_configuracoes (id, empresa_id, ativo, percentual_padrao, modo_validade, updated_at)
       VALUES (?, ?, 0, 0, 'NUNCA', ?)`
    ).run(id, input.empresa_id, nowIns)
    cfgRaw = db.prepare('SELECT * FROM cashback_configuracoes WHERE empresa_id = ?').get(input.empresa_id) as Record<string, unknown>
  }
  const config = rowConfig(cfgRaw)
  const agora = new Date().toISOString()

  const cashbackUsado = input.pagamentos.filter((p) => p.forma === 'CASHBACK').reduce((a, p) => a + p.valor, 0)
  const vendaAPrazo = input.pagamentos.some((p) => p.forma === 'A_PRAZO')

  if (vendaAPrazo && cashbackUsado > 0) {
    throw new Error('Não é possível usar cashback em venda a prazo.')
  }

  if (cashbackUsado > 0 && !config.ativo) {
    throw new Error('Programa de cashback está desativado. Remova o pagamento em cashback.')
  }

  const clienteDocSrc =
    input.cliente_id != null ? getClienteCashbackDocSource(db, input.empresa_id, input.cliente_id) : null
  const docNorm = clienteDocSrc?.cpf_cnpj ? normalizeDocDigits(clienteDocSrc.cpf_cnpj) : null

  if (cashbackUsado > 0) {
    if (!input.cliente_id || !clienteDocSrc) throw new Error('Para usar cashback, selecione o cliente cadastrado.')
    if (!docNorm) throw new Error('Cliente sem CPF/CNPJ válido. Cadastre o documento para usar cashback.')
    if (docNorm.length === 11 && !isCpf11(docNorm)) throw new Error('CPF inválido para uso de cashback.')
    if (config.valor_minimo_compra_usar > 0 && input.total < config.valor_minimo_compra_usar) {
      throw new Error(`Valor mínimo da compra para usar cashback: R$ ${config.valor_minimo_compra_usar.toFixed(2)}.`)
    }
    if (!config.permitir_uso_mesma_compra) {
      throw new Error('Configuração não permite usar cashback na mesma compra.')
    }
    if (config.valor_maximo_uso_por_venda != null && cashbackUsado > config.valor_maximo_uso_por_venda + 0.001) {
      throw new Error(`Valor máximo de cashback por venda: R$ ${config.valor_maximo_uso_por_venda.toFixed(2)}.`)
    }
    if (!config.permitir_quitar_total && cashbackUsado >= input.total - 0.001) {
      throw new Error('Configuração não permite quitar 100% da venda com cashback.')
    }
    if (cashbackUsado > input.total + 0.01) throw new Error('Cashback não pode exceder o total da venda.')

    processarExpiracoesCashback(input.empresa_id, docNorm)
    const saldo = saldoDisponivelFromCreditos(db, input.empresa_id, docNorm, agora)
    const rowSaldo = db
      .prepare('SELECT bloqueado FROM cashback_saldos WHERE empresa_id = ? AND cliente_id = ?')
      .get(input.empresa_id, input.cliente_id) as { bloqueado: number } | undefined
    if (rowSaldo?.bloqueado) throw new Error('Cliente bloqueado no programa de cashback.')

    if (cashbackUsado > saldo + 0.01) {
      throw new Error(`Saldo de cashback insuficiente. Disponível: R$ ${saldo.toFixed(2)}.`)
    }

    let maxResgateItens = 0
    for (const it of input.itens) {
      const lineTotal = it.preco_unitario * it.quantidade - (it.desconto ?? 0)
      if (lineTotal <= 0) continue
      if (Number(it.permitir_resgate_cashback_no_produto) !== 0) maxResgateItens += lineTotal
    }
    if (cashbackUsado > maxResgateItens + 0.01) {
      throw new Error(
        `Cashback só pode abater itens que permitem resgate. Máximo nesta venda: R$ ${maxResgateItens.toFixed(2)}.`
      )
    }

    ensureSaldoRow(db, input.empresa_id, input.cliente_id!, docNorm)
    const allocations: { credito_id: string; valor: number }[] = []
    let falta = roundMoney(cashbackUsado, config.arredondamento)
    const creditos = db
      .prepare(
        `SELECT * FROM cashback_creditos
         WHERE empresa_id = ? AND cpf_normalizado = ? AND status = 'ATIVO' AND valor_restante > 0
           AND (expira_em IS NULL OR expira_em > ?)
         ORDER BY created_at ASC, id ASC`
      )
      .all(input.empresa_id, docNorm, agora) as Record<string, unknown>[]

    for (const cr of creditos) {
      if (falta <= 0) break
      const rest = Number(cr.valor_restante) || 0
      if (rest <= 0) continue
      const take = Math.min(rest, falta)
      if (take <= 0) continue
      const cid = cr.id as string
      db.prepare('UPDATE cashback_creditos SET valor_restante = valor_restante - ? WHERE id = ?').run(take, cid)
      allocations.push({ credito_id: cid, valor: take })
      falta -= take
    }
    if (falta > 0.01) throw new Error('Não foi possível alocar cashback (saldo concorrente?). Tente novamente.')

    const movDebito = randomUUID()
    const saldoApos = saldoDisponivelFromCreditos(db, input.empresa_id, docNorm, agora)
    db.prepare(
      `INSERT INTO cashback_movimentacoes (id, empresa_id, cliente_id, cpf_normalizado, tipo, origem, venda_id, credito_id, valor, saldo_disponivel_apos, idempotency_key, meta_json, created_by, created_at)
       VALUES (?, ?, ?, ?, 'DEBITO_USO', 'VENDA', ?, NULL, ?, ?, ?, ?, ?, ?)`
    ).run(
      movDebito,
      input.empresa_id,
      input.cliente_id,
      docNorm,
      input.venda_id,
      cashbackUsado,
      saldoApos,
      `use:${input.venda_id}`,
      JSON.stringify({ allocations }),
      input.usuario_id,
      agora
    )

    db.prepare(
      `UPDATE cashback_saldos SET saldo_disponivel = ?, total_utilizado = total_utilizado + ?, updated_at = ?
       WHERE empresa_id = ? AND cliente_id = ?`
    ).run(saldoApos, cashbackUsado, agora, input.empresa_id, input.cliente_id)
  }

  let gerado = 0
  if (!vendaAPrazo && config.ativo && input.cliente_id && clienteDocSrc) {
    const doc = normalizeDocDigits(clienteDocSrc.cpf_cnpj)
    if (doc && (doc.length === 11 || doc.length === 14)) {
      if (config.valor_minimo_compra_gerar <= 0 || input.total >= config.valor_minimo_compra_gerar) {
        gerado = calcularCashbackGeradoNaVenda(config, input.total, cashbackUsado)
        if (gerado > 0) {
          ensureSaldoRow(db, input.empresa_id, input.cliente_id, doc)
          const exp = computeExpiryIso(config, new Date(agora))
          const creditoId = randomUUID()
          db.prepare(
            `INSERT INTO cashback_creditos (id, empresa_id, cliente_id, cpf_normalizado, venda_id_origem, valor_inicial, valor_restante, expira_em, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ATIVO', ?)`
          ).run(creditoId, input.empresa_id, input.cliente_id, doc, input.venda_id, gerado, gerado, exp, agora)

          const saldoAposCred = saldoDisponivelFromCreditos(db, input.empresa_id, doc, agora)
          const movCred = randomUUID()
          db.prepare(
            `INSERT INTO cashback_movimentacoes (id, empresa_id, cliente_id, cpf_normalizado, tipo, origem, venda_id, credito_id, valor, saldo_disponivel_apos, idempotency_key, created_by, created_at)
             VALUES (?, ?, ?, ?, 'CREDITO_VENDA', 'VENDA', ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            movCred,
            input.empresa_id,
            input.cliente_id,
            doc,
            input.venda_id,
            creditoId,
            gerado,
            saldoAposCred,
            `earn:${input.venda_id}`,
            input.usuario_id,
            agora
          )
          db.prepare(
            `UPDATE cashback_saldos SET saldo_disponivel = ?, total_gerado = total_gerado + ?, updated_at = ?
             WHERE empresa_id = ? AND cliente_id = ?`
          ).run(saldoAposCred, gerado, agora, input.empresa_id, input.cliente_id)
        }
      }
    }
  }

  db.prepare('UPDATE vendas SET cashback_gerado = ?, cashback_usado = ? WHERE id = ?').run(gerado, cashbackUsado, input.venda_id)
  return { cashback_gerado: gerado, cashback_usado: cashbackUsado }
}

/** Reverte efeitos de cashback da venda. Deve ser chamado com a venda ainda CONCLUIDA, dentro da mesma transação do cancelamento. */
export function reverterCashbackAoCancelarVenda(vendaId: string, usuarioId: string): void {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const venda = db.prepare('SELECT id, empresa_id, cliente_id, status FROM vendas WHERE id = ?').get(vendaId) as
    | { id: string; empresa_id: string; cliente_id: string | null; status: string }
    | undefined
  if (!venda || venda.status !== 'CONCLUIDA') return

  const agora = new Date().toISOString()
  const movs = db
    .prepare(`SELECT * FROM cashback_movimentacoes WHERE venda_id = ? AND tipo IN ('DEBITO_USO','CREDITO_VENDA')`)
    .all(vendaId) as Record<string, unknown>[]
  movs.sort((a, b) => {
    const ta = a.tipo === 'DEBITO_USO' ? 0 : 1
    const tb = b.tipo === 'DEBITO_USO' ? 0 : 1
    return ta - tb
  })

  for (const m of movs) {
      const tipo = m.tipo as string
      const clienteId = m.cliente_id as string
      const cpf = m.cpf_normalizado as string
      const emp = m.empresa_id as string
      const valor = Number(m.valor) || 0

      if (tipo === 'DEBITO_USO') {
        const key = `estorno_use:${vendaId}`
        const dup = db.prepare('SELECT 1 FROM cashback_movimentacoes WHERE empresa_id = ? AND idempotency_key = ?').get(emp, key)
        if (dup) continue
        const meta = JSON.parse((m.meta_json as string) || '{}') as { allocations?: { credito_id: string; valor: number }[] }
        const allocations = meta.allocations ?? []
        for (const a of allocations) {
          db.prepare('UPDATE cashback_creditos SET valor_restante = valor_restante + ?, status = CASE WHEN status = \'EXPIRADO\' THEN \'ATIVO\' ELSE status END WHERE id = ?').run(
            a.valor,
            a.credito_id
          )
        }
        ensureSaldoRow(db, emp, clienteId, cpf)
        const saldoApos = saldoDisponivelFromCreditos(db, emp, cpf, agora)
        const movId = randomUUID()
        db.prepare(
          `INSERT INTO cashback_movimentacoes (id, empresa_id, cliente_id, cpf_normalizado, tipo, origem, venda_id, valor, saldo_disponivel_apos, idempotency_key, observacao, created_by, created_at)
           VALUES (?, ?, ?, ?, 'ESTORNO_DEBITO_USO', 'CANCELAMENTO_VENDA', ?, ?, ?, ?, ?, ?, ?)`
        ).run(movId, emp, clienteId, cpf, vendaId, valor, saldoApos, key, 'Cancelamento de venda', usuarioId, agora)
        db.prepare(
          `UPDATE cashback_saldos SET saldo_disponivel = ?, total_utilizado = total_utilizado - ?, updated_at = ?
           WHERE empresa_id = ? AND cliente_id = ?`
        ).run(saldoApos, valor, agora, emp, clienteId)
      }

      if (tipo === 'CREDITO_VENDA') {
        const key = `rev_earn:${vendaId}`
        const dup = db.prepare('SELECT 1 FROM cashback_movimentacoes WHERE empresa_id = ? AND idempotency_key = ?').get(emp, key)
        if (dup) continue
        const creditoId = m.credito_id as string | null
        if (!creditoId) continue
        const cr = db.prepare('SELECT * FROM cashback_creditos WHERE id = ?').get(creditoId) as Record<string, unknown> | undefined
        if (!cr) continue
        const inicial = Number(cr.valor_inicial) || 0
        const restante = Number(cr.valor_restante) || 0
        if (Math.abs(restante - inicial) > 0.02) {
          throw new Error(
            'Não é possível cancelar automaticamente o cashback desta venda: o crédito já foi parcialmente utilizado. Ajuste manualmente no painel de cashback.'
          )
        }
        db.prepare(`UPDATE cashback_creditos SET status = 'ESTORNADO', valor_restante = 0 WHERE id = ?`).run(creditoId)
        ensureSaldoRow(db, emp, clienteId, cpf)
        const saldoApos = saldoDisponivelFromCreditos(db, emp, cpf, agora)
        const movId = randomUUID()
        db.prepare(
          `INSERT INTO cashback_movimentacoes (id, empresa_id, cliente_id, cpf_normalizado, tipo, origem, venda_id, credito_id, valor, saldo_disponivel_apos, idempotency_key, observacao, created_by, created_at)
           VALUES (?, ?, ?, ?, 'REVERSAO_CREDITO_VENDA', 'CANCELAMENTO_VENDA', ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(movId, emp, clienteId, cpf, vendaId, creditoId, valor, saldoApos, key, 'Cancelamento de venda', usuarioId, agora)
        db.prepare(
          `UPDATE cashback_saldos SET saldo_disponivel = ?, total_gerado = total_gerado - ?, updated_at = ?
           WHERE empresa_id = ? AND cliente_id = ?`
        ).run(saldoApos, valor, agora, emp, clienteId)
      }
    }
  db.prepare('UPDATE vendas SET cashback_gerado = 0, cashback_usado = 0 WHERE id = ?').run(vendaId)
}

export function getSaldoCashbackCliente(empresaId: string, clienteId: string): CashbackSaldoResumo | null {
  const db = getDb()
  if (!db) return null
  const cliente = getClienteById(clienteId)
  if (!cliente || cliente.empresa_id !== empresaId) return null
  const doc = normalizeDocDigits(cliente.cpf_cnpj)
  if (!doc) return null
  processarExpiracoesCashback(empresaId, doc)
  const agora = new Date().toISOString()
  const cfg = getCashbackConfig(empresaId)
  const alertaDays = cfg.dias_alerta_expiracao || 7
  const limiteAlerta = new Date()
  limiteAlerta.setUTCDate(limiteAlerta.getUTCDate() + alertaDays)
  const limIso = limiteAlerta.toISOString()

  const row = db
    .prepare('SELECT * FROM cashback_saldos WHERE empresa_id = ? AND cliente_id = ?')
    .get(empresaId, clienteId) as Record<string, unknown> | undefined

  const prestes = db
    .prepare(
      `SELECT COALESCE(SUM(valor_restante),0) AS s FROM cashback_creditos
       WHERE empresa_id = ? AND cliente_id = ? AND status = 'ATIVO' AND valor_restante > 0
         AND expira_em IS NOT NULL AND expira_em > ? AND expira_em <= ?`
    )
    .get(empresaId, clienteId, agora, limIso) as { s: number }

  const prox = db
    .prepare(
      `SELECT MIN(expira_em) AS m FROM cashback_creditos
       WHERE empresa_id = ? AND cliente_id = ? AND status = 'ATIVO' AND valor_restante > 0 AND expira_em IS NOT NULL AND expira_em > ?`
    )
    .get(empresaId, clienteId, agora) as { m: string | null }

  const disponivel = saldoDisponivelFromCreditos(db, empresaId, doc, agora)

  return {
    cliente_id: clienteId,
    cpf_normalizado: doc,
    saldo_disponivel: disponivel,
    saldo_expirado_acumulado: Number(row?.saldo_expirado_acumulado) || 0,
    total_gerado: Number(row?.total_gerado) || 0,
    total_utilizado: Number(row?.total_utilizado) || 0,
    bloqueado: Number(row?.bloqueado) === 1,
    prestes_expirar: Number(prestes.s) || 0,
    proxima_expiracao: prox?.m ?? null
  }
}

export function getSaldoCashbackPorCpf(empresaId: string, cpfDigits: string): CashbackSaldoResumo | null {
  const db = getDb()
  if (!db) return null
  const norm = cpfDigits.replace(/\D/g, '')
  const row = db
    .prepare(
      `SELECT c.id FROM clientes c
       WHERE c.empresa_id = ? AND REPLACE(REPLACE(REPLACE(TRIM(IFNULL(c.cpf_cnpj,'')),'.',''),'-',''),'/','') = ?
       LIMIT 1`
    )
    .get(empresaId, norm) as { id: string } | undefined
  if (!row) return null
  return getSaldoCashbackCliente(empresaId, row.id)
}

export function listCashbackMovimentacoes(empresaId: string, clienteId: string, limit = 200): CashbackMovRow[] {
  const db = getDb()
  if (!db) return []
  const rows = db
    .prepare(
      `SELECT id, tipo, origem, venda_id, valor, saldo_disponivel_apos, observacao, created_by, created_at
       FROM cashback_movimentacoes WHERE empresa_id = ? AND cliente_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(empresaId, clienteId, limit) as Record<string, unknown>[]
  return rows.map((r) => ({
    id: r.id as string,
    tipo: r.tipo as string,
    origem: r.origem as string,
    venda_id: (r.venda_id as string) ?? null,
    valor: Number(r.valor) || 0,
    saldo_disponivel_apos: r.saldo_disponivel_apos != null ? Number(r.saldo_disponivel_apos) : null,
    observacao: (r.observacao as string) ?? null,
    created_by: (r.created_by as string) ?? null,
    created_at: r.created_at as string
  }))
}

export function listCashbackCreditosCliente(empresaId: string, clienteId: string, limit = 300): CashbackCreditoRow[] {
  const db = getDb()
  if (!db) return []
  const rows = db
    .prepare(
      `SELECT id, venda_id_origem, valor_inicial, valor_restante, expira_em, status, created_at
       FROM cashback_creditos
       WHERE empresa_id = ? AND cliente_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    )
    .all(empresaId, clienteId, Math.max(1, limit)) as Record<string, unknown>[]
  return rows.map((r) => ({
    id: r.id as string,
    venda_id_origem: (r.venda_id_origem as string) ?? null,
    valor_inicial: Number(r.valor_inicial) || 0,
    valor_restante: Number(r.valor_restante) || 0,
    expira_em: (r.expira_em as string) ?? null,
    status: (r.status as string) ?? 'ATIVO',
    created_at: (r.created_at as string) ?? new Date(0).toISOString()
  }))
}

export type CashbackClienteListRow = {
  cliente_id: string
  nome: string
  cpf_cnpj: string | null
  telefone: string | null
  saldo_disponivel: number
  saldo_expirado_acumulado: number
  total_gerado: number
  total_utilizado: number
  bloqueado: number
  ultima_mov: string | null
}

export function listCashbackClientes(
  empresaId: string,
  opts: {
    q?: string
    filtro?: 'com_saldo' | 'sem_saldo' | 'todos'
    ordem?: 'saldo_desc' | 'mov_desc' | 'nome' | 'cpf'
    limit?: number
  }
): CashbackClienteListRow[] {
  const db = getDb()
  if (!db) return []
  const limit = opts.limit ?? 300
  const q = opts.q?.trim().toLowerCase() ?? ''
  const filtro = opts.filtro ?? 'todos'
  const ordem = opts.ordem ?? 'nome'

  let sql = `
    SELECT c.id AS cliente_id, c.nome, c.cpf_cnpj, c.telefone,
           COALESCE(s.saldo_disponivel, 0) AS saldo_disponivel,
           COALESCE(s.saldo_expirado_acumulado, 0) AS saldo_expirado_acumulado,
           COALESCE(s.total_gerado, 0) AS total_gerado,
           COALESCE(s.total_utilizado, 0) AS total_utilizado,
           COALESCE(s.bloqueado, 0) AS bloqueado,
           (SELECT MAX(m.created_at) FROM cashback_movimentacoes m WHERE m.cliente_id = c.id AND m.empresa_id = c.empresa_id) AS ultima_mov
    FROM clientes c
    LEFT JOIN cashback_saldos s ON s.empresa_id = c.empresa_id AND s.cliente_id = c.id
    WHERE c.empresa_id = ?
  `
  const params: (string | number)[] = [empresaId]
  if (q) {
    sql += ` AND (
      LOWER(c.nome) LIKE ? OR
      LOWER(REPLACE(REPLACE(REPLACE(IFNULL(c.cpf_cnpj,''),'.',''),'-',''),'/','')) LIKE ? OR
      LOWER(IFNULL(c.telefone,'')) LIKE ?
    )`
    const like = `%${q}%`
    const qDigits = q.replace(/\D/g, '')
    params.push(like, `%${qDigits}%`, like)
  }
  if (filtro === 'com_saldo') sql += ' AND COALESCE(s.saldo_disponivel, 0) > 0.001'
  if (filtro === 'sem_saldo') sql += ' AND COALESCE(s.saldo_disponivel, 0) <= 0.001'

  if (ordem === 'saldo_desc') sql += ' ORDER BY saldo_disponivel DESC, c.nome'
  else if (ordem === 'mov_desc') sql += ' ORDER BY ultima_mov DESC, c.nome'
  else if (ordem === 'cpf') sql += ' ORDER BY c.cpf_cnpj, c.nome'
  else sql += ' ORDER BY c.nome'

  sql += ' LIMIT ?'
  params.push(limit)

  return db.prepare(sql).all(...params) as CashbackClienteListRow[]
}

export function ajusteManualCashback(input: {
  empresa_id: string
  cliente_id: string
  usuario_id: string
  tipo: 'credito' | 'debito'
  valor: number
  motivo: string
}): void {
  if (!input.motivo?.trim()) throw new Error('Informe o motivo do ajuste.')
  if (input.valor <= 0) throw new Error('Valor deve ser maior que zero.')
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const cliente = getClienteById(input.cliente_id)
  if (!cliente || cliente.empresa_id !== input.empresa_id) throw new Error('Cliente não encontrado.')
  const doc = normalizeDocDigits(cliente.cpf_cnpj)
  if (!doc) throw new Error('Cliente sem CPF/CNPJ. Cadastre o documento antes do ajuste.')

  const agora = new Date().toISOString()
  const config = getCashbackConfig(input.empresa_id)
  const v = roundMoney(input.valor, config.arredondamento)

  db.transaction(() => {
    ensureSaldoRow(db, input.empresa_id, input.cliente_id, doc)
    if (input.tipo === 'credito') {
      const exp = computeExpiryIso(config, new Date(agora))
      const creditoId = randomUUID()
      db.prepare(
        `INSERT INTO cashback_creditos (id, empresa_id, cliente_id, cpf_normalizado, venda_id_origem, valor_inicial, valor_restante, expira_em, status, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 'ATIVO', ?)`
      ).run(creditoId, input.empresa_id, input.cliente_id, doc, v, v, exp, agora)
      const saldoApos = saldoDisponivelFromCreditos(db, input.empresa_id, doc, agora)
      const movId = randomUUID()
      db.prepare(
        `INSERT INTO cashback_movimentacoes (id, empresa_id, cliente_id, cpf_normalizado, tipo, origem, venda_id, credito_id, valor, saldo_disponivel_apos, observacao, created_by, created_at)
         VALUES (?, ?, ?, ?, 'AJUSTE_CREDITO', 'MANUAL', NULL, ?, ?, ?, ?, ?, ?)`
      ).run(movId, input.empresa_id, input.cliente_id, doc, creditoId, v, saldoApos, input.motivo.trim(), input.usuario_id, agora)
      db.prepare(
        `UPDATE cashback_saldos SET saldo_disponivel = ?, total_ajuste_credito = total_ajuste_credito + ?, updated_at = ?
         WHERE empresa_id = ? AND cliente_id = ?`
      ).run(saldoApos, v, agora, input.empresa_id, input.cliente_id)
    } else {
      processarExpiracoesCashback(input.empresa_id, doc)
      const saldo = saldoDisponivelFromCreditos(db, input.empresa_id, doc, agora)
      if (v > saldo + 0.01) throw new Error(`Saldo insuficiente para débito. Disponível: R$ ${saldo.toFixed(2)}.`)
      let falta = v
      const creditos = db
        .prepare(
          `SELECT * FROM cashback_creditos
           WHERE empresa_id = ? AND cpf_normalizado = ? AND status = 'ATIVO' AND valor_restante > 0
             AND (expira_em IS NULL OR expira_em > ?)
           ORDER BY created_at ASC, id ASC`
        )
        .all(input.empresa_id, doc, agora) as Record<string, unknown>[]
      const allocations: { credito_id: string; valor: number }[] = []
      for (const cr of creditos) {
        if (falta <= 0) break
        const rest = Number(cr.valor_restante) || 0
        const take = Math.min(rest, falta)
        if (take <= 0) continue
        const cid = cr.id as string
        db.prepare('UPDATE cashback_creditos SET valor_restante = valor_restante - ? WHERE id = ?').run(take, cid)
        allocations.push({ credito_id: cid, valor: take })
        falta -= take
      }
      const saldoApos = saldoDisponivelFromCreditos(db, input.empresa_id, doc, agora)
      const movId = randomUUID()
      db.prepare(
        `INSERT INTO cashback_movimentacoes (id, empresa_id, cliente_id, cpf_normalizado, tipo, origem, venda_id, valor, saldo_disponivel_apos, observacao, meta_json, created_by, created_at)
         VALUES (?, ?, ?, ?, 'AJUSTE_DEBITO', 'MANUAL', NULL, ?, ?, ?, ?, ?, ?)`
      ).run(
        movId,
        input.empresa_id,
        input.cliente_id,
        doc,
        v,
        saldoApos,
        input.motivo.trim(),
        JSON.stringify({ allocations }),
        input.usuario_id,
        agora
      )
      db.prepare(
        `UPDATE cashback_saldos SET saldo_disponivel = ?, total_ajuste_debito = total_ajuste_debito + ?, updated_at = ?
         WHERE empresa_id = ? AND cliente_id = ?`
      ).run(saldoApos, v, agora, input.empresa_id, input.cliente_id)
    }
  })()
}

export function setBloqueioCashbackCliente(empresaId: string, clienteId: string, bloqueado: boolean): void {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const cliente = getClienteById(clienteId)
  if (!cliente || cliente.empresa_id !== empresaId) throw new Error('Cliente não encontrado.')
  const doc = normalizeDocDigits(cliente.cpf_cnpj) ?? ''
  if (!doc) throw new Error('Cliente sem documento.')
  ensureSaldoRow(db, empresaId, clienteId, doc)
  const now = new Date().toISOString()
  db.prepare('UPDATE cashback_saldos SET bloqueado = ?, updated_at = ? WHERE empresa_id = ? AND cliente_id = ?').run(
    bloqueado ? 1 : 0,
    now,
    empresaId,
    clienteId
  )
}

export function listCashbackRegras(empresaId: string): CashbackRegra[] {
  const db = getDb()
  if (!db) return []
  const rows = db.prepare('SELECT * FROM cashback_regras WHERE empresa_id = ? ORDER BY tipo, produto_id').all(empresaId) as Record<
    string,
    unknown
  >[]
  return rows.map((x) => ({
    id: x.id as string,
    empresa_id: x.empresa_id as string,
    tipo: x.tipo as CashbackRegra['tipo'],
    produto_id: (x.produto_id as string) ?? null,
    categoria_id: (x.categoria_id as string) ?? null,
    percentual: x.percentual != null ? Number(x.percentual) : null,
    ativo: Number(x.ativo) || 0,
    valido_de: (x.valido_de as string) ?? null,
    valido_ate: (x.valido_ate as string) ?? null
  }))
}

export function createCashbackRegra(
  data: Omit<CashbackRegra, 'id'> & { id?: string }
): CashbackRegra {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const id = data.id ?? randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO cashback_regras (id, empresa_id, tipo, produto_id, categoria_id, percentual, ativo, valido_de, valido_ate, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.empresa_id,
    data.tipo,
    data.produto_id,
    data.categoria_id,
    data.percentual,
    data.ativo ? 1 : 0,
    data.valido_de,
    data.valido_ate,
    now,
    now
  )
  const row = db.prepare('SELECT * FROM cashback_regras WHERE id = ?').get(id) as Record<string, unknown>
  return {
    id: row.id as string,
    empresa_id: row.empresa_id as string,
    tipo: row.tipo as CashbackRegra['tipo'],
    produto_id: (row.produto_id as string) ?? null,
    categoria_id: (row.categoria_id as string) ?? null,
    percentual: row.percentual != null ? Number(row.percentual) : null,
    ativo: Number(row.ativo) || 0,
    valido_de: (row.valido_de as string) ?? null,
    valido_ate: (row.valido_ate as string) ?? null
  }
}

export function deleteCashbackRegra(empresaId: string, regraId: string): boolean {
  const db = getDb()
  if (!db) return false
  const r = db.prepare('DELETE FROM cashback_regras WHERE id = ? AND empresa_id = ?').run(regraId, empresaId)
  return r.changes > 0
}

export type CashbackRelatorio = {
  total_gerado: number
  total_usado: number
  total_expirado: number
  total_ajuste_credito: number
  total_ajuste_debito: number
}

export function relatorioCashbackPeriodo(
  empresaId: string,
  dataInicio?: string,
  dataFim?: string
): CashbackRelatorio {
  const db = getDb()
  if (!db) {
    return { total_gerado: 0, total_usado: 0, total_expirado: 0, total_ajuste_credito: 0, total_ajuste_debito: 0 }
  }
  let wh = 'empresa_id = ?'
  const p: string[] = [empresaId]
  if (dataInicio) {
    wh += ' AND created_at >= ?'
    p.push(dataInicio)
  }
  if (dataFim) {
    wh += ' AND created_at <= ?'
    p.push(dataFim)
  }
  const row = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN tipo = 'CREDITO_VENDA' THEN valor ELSE 0 END),0) AS g,
        COALESCE(SUM(CASE WHEN tipo = 'DEBITO_USO' THEN valor ELSE 0 END),0) AS u,
        COALESCE(SUM(CASE WHEN tipo = 'EXPIRACAO' THEN valor ELSE 0 END),0) AS e,
        COALESCE(SUM(CASE WHEN tipo = 'AJUSTE_CREDITO' THEN valor ELSE 0 END),0) AS ac,
        COALESCE(SUM(CASE WHEN tipo = 'AJUSTE_DEBITO' THEN valor ELSE 0 END),0) AS ad
       FROM cashback_movimentacoes WHERE ${wh}`
    )
    .get(...p) as Record<string, number>
  return {
    total_gerado: Number(row.g) || 0,
    total_usado: Number(row.u) || 0,
    total_expirado: Number(row.e) || 0,
    total_ajuste_credito: Number(row.ac) || 0,
    total_ajuste_debito: Number(row.ad) || 0
  }
}
