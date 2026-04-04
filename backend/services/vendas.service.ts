import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { updateSyncClock } from '../sync-clock'
import { getCaixaAberto } from './caixa.service'
import { getProdutoById } from './produtos.service'
import { registrarMovimento } from './estoque.service'
import { addToOutbox } from '../../sync/outbox'
import { processarCashbackAposInserirVenda, reverterCashbackAoCancelarVenda, getCashbackCupomExtras } from './cashback.service'
import type { CashbackCupomExtras } from './cashback.service'
import {
  assertPodeVenderAPrazo,
  createContaReceberVenda,
  cancelarContaReceberVenda
} from './contas-receber.service'

export type FormaPagamento =
  | 'DINHEIRO'
  | 'PIX'
  | 'DEBITO'
  | 'CREDITO'
  | 'OUTROS'
  | 'CASHBACK'
  | 'A_PRAZO'

export type ItemVendaInput = {
  produto_id: string
  descricao: string
  preco_unitario: number
  quantidade: number
  desconto?: number
}

export type PagamentoInput = {
  forma: FormaPagamento
  valor: number
}

export type FinalizarVendaInput = {
  empresa_id: string
  usuario_id: string
  cliente_id?: string
  itens: ItemVendaInput[]
  pagamentos: PagamentoInput[]
  desconto_total?: number
  troco?: number
  /** Obrigatório quando houver pagamento em A_PRAZO (YYYY-MM-DD). */
  data_vencimento?: string
}

export type Venda = {
  id: string
  empresa_id: string
  caixa_id: string
  usuario_id: string
  cliente_id: string | null
  numero: number
  status: string
  subtotal: number
  desconto_total: number
  total: number
  troco: number
  cashback_gerado: number
  cashback_usado: number
  created_at: string
  venda_a_prazo?: number
  data_vencimento?: string | null
}

/** Venda com flags de NFC-e (retornado por listVendas quando há join com venda_nfce). */
export type VendaComNfce = Venda & {
  nfce_emitida?: boolean
  nfce_chave?: string | null
  nfe_emitida?: boolean
  nfe_chave?: string | null
}

function nextNumero(empresaId: string): number {
  const db = getDb()
  if (!db) return 1
  const row = db.prepare('SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM vendas WHERE empresa_id = ?').get(empresaId) as { n: number }
  return row.n
}

export function finalizarVenda(data: FinalizarVendaInput): Venda {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const caixa = getCaixaAberto(data.empresa_id)
  if (!caixa) throw new Error('Não há caixa aberto. Abra o caixa antes de vender.')

  if (!data.itens.length) throw new Error('Adicione ao menos um item à venda.')
  if (!data.pagamentos.length) throw new Error('Adicione ao menos uma forma de pagamento.')

  const subtotal = data.itens.reduce((acc, i) => {
    const totalItem = i.preco_unitario * i.quantidade - (i.desconto ?? 0)
    return acc + totalItem
  }, 0)
  const descontoTotal = data.desconto_total ?? 0
  const total = subtotal - descontoTotal
  const totalPagamentos = data.pagamentos.reduce((acc, p) => acc + p.valor, 0)
  if (Math.abs(totalPagamentos - total) > 0.01) {
    throw new Error(`Total dos pagamentos (R$ ${totalPagamentos.toFixed(2)}) deve ser igual ao total da venda (R$ ${total.toFixed(2)}).`)
  }

  const troco = data.troco ?? 0
  const vendaId = randomUUID()
  const numero = nextNumero(data.empresa_id)

  const temPrazo = data.pagamentos.some((p) => p.forma === 'A_PRAZO')
  if (temPrazo) {
    if (data.pagamentos.some((p) => p.forma === 'CASHBACK')) {
      throw new Error('Não é possível usar cashback em venda a prazo.')
    }
    if (data.pagamentos.length !== 1 || data.pagamentos[0].forma !== 'A_PRAZO') {
      throw new Error('Venda a prazo deve ser quitada em uma única forma de pagamento (A prazo) pelo valor total.')
    }
    if (Math.abs(data.pagamentos[0].valor - total) > 0.01) {
      throw new Error('O valor em A prazo deve ser igual ao total da venda.')
    }
    if (!data.cliente_id) {
      throw new Error('Selecione o cliente para venda a prazo.')
    }
    const dv = data.data_vencimento?.trim()
    if (!dv || !/^\d{4}-\d{2}-\d{2}$/.test(dv)) {
      throw new Error('Informe a data de vencimento (venda a prazo).')
    }
    if (troco > 0.01) {
      throw new Error('Venda a prazo não gera troco.')
    }
    assertPodeVenderAPrazo(data.empresa_id, data.cliente_id, total)
  }

  const vendaAPrazoFlag = temPrazo ? 1 : 0
  const dataVencimentoSql = temPrazo ? data.data_vencimento!.trim() : null

  db.transaction(() => {
    db.prepare(`
      INSERT INTO vendas (id, empresa_id, caixa_id, usuario_id, cliente_id, numero, status, subtotal, desconto_total, total, troco, venda_a_prazo, data_vencimento)
      VALUES (?, ?, ?, ?, ?, ?, 'CONCLUIDA', ?, ?, ?, ?, ?, ?)
    `).run(
      vendaId,
      data.empresa_id,
      caixa.id,
      data.usuario_id,
      data.cliente_id ?? null,
      numero,
      subtotal,
      descontoTotal,
      total,
      troco,
      vendaAPrazoFlag,
      dataVencimentoSql
    )

    for (const item of data.itens) {
      const totalItem = item.preco_unitario * item.quantidade - (item.desconto ?? 0)
      const itemId = randomUUID()
      db.prepare(`
        INSERT INTO venda_itens (id, empresa_id, venda_id, produto_id, descricao, preco_unitario, quantidade, desconto, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        itemId,
        data.empresa_id,
        vendaId,
        item.produto_id,
        item.descricao,
        item.preco_unitario,
        item.quantidade,
        item.desconto ?? 0,
        totalItem
      )

      const produto = getProdutoById(item.produto_id)
      if (produto?.controla_estoque === 1) {
        registrarMovimento({
          empresa_id: data.empresa_id,
          produto_id: item.produto_id,
          tipo: 'SAIDA',
          quantidade: item.quantidade,
          custo_unitario: produto.custo,
          referencia_tipo: 'VENDA',
          referencia_id: vendaId,
          usuario_id: data.usuario_id,
          permitir_saldo_negativo: true
        })
      }
    }

    for (const pag of data.pagamentos) {
      const pagId = randomUUID()
      db.prepare(`
        INSERT INTO pagamentos (id, empresa_id, venda_id, forma, valor)
        VALUES (?, ?, ?, ?, ?)
      `).run(pagId, data.empresa_id, vendaId, pag.forma, pag.valor)
    }

    if (temPrazo && data.cliente_id && dataVencimentoSql) {
      createContaReceberVenda({
        empresa_id: data.empresa_id,
        venda_id: vendaId,
        cliente_id: data.cliente_id,
        valor: total,
        vencimento: dataVencimentoSql
      })
    }

    const itensComCategoria = data.itens.map((i) => {
      const p = getProdutoById(i.produto_id)
      return {
        ...i,
        categoria_id: p?.categoria_id ?? null,
        cashback_ativo: p?.cashback_ativo ?? 0,
        cashback_percentual: p?.cashback_percentual ?? null,
        permitir_resgate_cashback_no_produto: p?.permitir_resgate_cashback_no_produto ?? 1,
      }
    })
    processarCashbackAposInserirVenda(db, {
      empresa_id: data.empresa_id,
      usuario_id: data.usuario_id,
      venda_id: vendaId,
      cliente_id: data.cliente_id ?? null,
      itens: itensComCategoria,
      subtotal,
      desconto_total: descontoTotal,
      total,
      pagamentos: data.pagamentos
    })
  })()

  const venda = getVendaById(vendaId)!
  updateSyncClock()
  addToOutbox('vendas', vendaId, 'CREATE', venda)
  return venda
}

/** Converte ISO (ex: 2026-03-04T03:00:00.000Z) para o formato do SQLite (YYYY-MM-DD HH:MM:SS) para comparação correta com created_at. */
function isoToSqliteDatetime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

export type ListVendasOptions = {
  limit?: number
  dataInicio?: string
  dataFim?: string
  /** Quando 'hoje', usa a data local do SQLite (mesmo relógio da máquina) em vez de intervalo UTC. */
  periodo?: 'hoje' | 'semana' | 'mes'
}

export function listVendas(empresaId: string, options?: ListVendasOptions): VendaComNfce[] {
  const db = getDb()
  if (!db) return []
  const rawLimit = options?.limit ?? 2000
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 2000, 1), 50_000)
  const sqlWithNfce = `
    SELECT v.id, v.empresa_id, v.caixa_id, v.usuario_id, v.cliente_id, v.numero, v.status,
           v.subtotal, v.desconto_total, v.total, v.troco,
           COALESCE(v.cashback_gerado, 0) AS cashback_gerado, COALESCE(v.cashback_usado, 0) AS cashback_usado,
           COALESCE(v.venda_a_prazo, 0) AS venda_a_prazo, v.data_vencimento,
           CASE WHEN EXISTS (SELECT 1 FROM pagamentos p WHERE p.venda_id = v.id AND p.forma = 'A_PRAZO') THEN 1 ELSE 0 END AS pagamento_a_prazo,
           v.created_at,
           n.chave AS nfce_chave, (n.status = 'AUTORIZADA') AS nfce_emitida,
           ne.chave AS nfe_chave, (ne.status = 'AUTORIZADA') AS nfe_emitida
    FROM vendas v
    LEFT JOIN venda_nfce n ON n.venda_id = v.id AND n.status = 'AUTORIZADA'
    LEFT JOIN venda_nfe ne ON ne.venda_id = v.id AND ne.status = 'AUTORIZADA'
    WHERE v.empresa_id = ?
    ${options?.periodo === 'hoje' ? ` AND date(v.created_at, 'localtime') = date('now', 'localtime')` : ''}
    ${!options?.periodo && options?.dataInicio ? ' AND v.created_at >= ?' : ''}
    ${!options?.periodo && options?.dataFim ? ' AND v.created_at <= ?' : ''}
    ORDER BY v.created_at DESC LIMIT ?
  `
  const paramsNfce: (string | number)[] = [empresaId]
  if (!options?.periodo) {
    if (options?.dataInicio) paramsNfce.push(isoToSqliteDatetime(options.dataInicio))
    if (options?.dataFim) paramsNfce.push(isoToSqliteDatetime(options.dataFim))
  }
  paramsNfce.push(limit)

  const rows = db.prepare(sqlWithNfce).all(...paramsNfce) as Record<string, unknown>[]
  return rows.map((r) => ({
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    caixa_id: r.caixa_id as string,
    usuario_id: r.usuario_id as string,
    cliente_id: (r.cliente_id as string) ?? null,
    numero: r.numero as number,
    status: r.status as string,
    subtotal: r.subtotal as number,
    desconto_total: r.desconto_total as number,
    total: r.total as number,
    troco: r.troco as number,
    cashback_gerado: Number(r.cashback_gerado) || 0,
    cashback_usado: Number(r.cashback_usado) || 0,
    venda_a_prazo: Number(r.venda_a_prazo) === 1 || Number(r.pagamento_a_prazo) === 1 ? 1 : 0,
    data_vencimento: (r.data_vencimento as string) ?? null,
    created_at: r.created_at as string,
    nfce_emitida: Boolean(r.nfce_emitida),
    nfce_chave: (r.nfce_chave as string) ?? null,
    nfe_emitida: Boolean(r.nfe_emitida),
    nfe_chave: (r.nfe_chave as string) ?? null,
  })) as VendaComNfce[]
}

export function getVendaById(id: string): Venda | null {
  const db = getDb()
  if (!db) return null
  const row = db.prepare(`
    SELECT v.id, v.empresa_id, v.caixa_id, v.usuario_id, v.cliente_id, v.numero, v.status, v.subtotal, v.desconto_total, v.total, v.troco,
           COALESCE(v.cashback_gerado, 0) AS cashback_gerado, COALESCE(v.cashback_usado, 0) AS cashback_usado,
           COALESCE(v.venda_a_prazo, 0) AS venda_a_prazo, v.data_vencimento, v.created_at,
           CASE WHEN EXISTS (SELECT 1 FROM pagamentos p WHERE p.venda_id = v.id AND p.forma = 'A_PRAZO') THEN 1 ELSE 0 END AS pagamento_a_prazo
    FROM vendas v WHERE v.id = ?
  `).get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return {
    id: row.id as string,
    empresa_id: row.empresa_id as string,
    caixa_id: row.caixa_id as string,
    usuario_id: row.usuario_id as string,
    cliente_id: (row.cliente_id as string) ?? null,
    numero: row.numero as number,
    status: row.status as string,
    subtotal: row.subtotal as number,
    desconto_total: row.desconto_total as number,
    total: row.total as number,
    troco: row.troco as number,
    cashback_gerado: Number(row.cashback_gerado) || 0,
    cashback_usado: Number(row.cashback_usado) || 0,
    venda_a_prazo: Number(row.venda_a_prazo) === 1 || Number(row.pagamento_a_prazo) === 1 ? 1 : 0,
    data_vencimento: (row.data_vencimento as string) ?? null,
    created_at: row.created_at as string
  }
}

export type VendaItemDetalhe = {
  produto_id?: string
  descricao: string
  preco_unitario: number
  quantidade: number
  desconto: number
  total: number
}

export type VendaPagamentoDetalhe = {
  forma: string
  valor: number
}

export type VendaDetalhes = {
  venda: Venda
  empresa_nome: string
  itens: VendaItemDetalhe[]
  pagamentos: VendaPagamentoDetalhe[]
  /** Só preenchido quando a venda tem cliente (não exibir benefício de cashback sem cliente). */
  cashback_cupom: CashbackCupomExtras | null
  /** Cupom a prazo: nome do cliente (quando há cliente na venda). */
  cliente_nome_cupom?: string | null
  /** Cupom a prazo: CPF/CNPJ quando cadastrado. */
  cliente_documento_cupom?: string | null
}

/** Normaliza data YYYY-MM-DD a partir de texto (venda ou contas a receber). */
function parseDataVencimentoCupom(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : s.slice(0, 10)
}

export function getVendaDetalhes(vendaId: string): VendaDetalhes | null {
  const vendaRaw = getVendaById(vendaId)
  if (!vendaRaw) return null
  const db = getDb()
  if (!db) return null

  let dataVenc = parseDataVencimentoCupom(vendaRaw.data_vencimento)
  if (!dataVenc) {
    const cr = db
      .prepare('SELECT vencimento FROM contas_receber WHERE venda_id = ? LIMIT 1')
      .get(vendaId) as { vencimento: string } | undefined
    if (cr?.vencimento != null) dataVenc = parseDataVencimentoCupom(cr.vencimento)
  }

  const venda: Venda = {
    ...vendaRaw,
    data_vencimento: dataVenc ?? vendaRaw.data_vencimento ?? null,
  }

  let clienteNomeCupom: string | null = null
  let clienteDocCupom: string | null = null
  if (venda.cliente_id) {
    const c = db
      .prepare('SELECT nome, cpf_cnpj FROM clientes WHERE id = ?')
      .get(venda.cliente_id) as { nome: string; cpf_cnpj: string | null } | undefined
    if (c) {
      clienteNomeCupom = c.nome?.trim() || null
      clienteDocCupom = c.cpf_cnpj?.trim() || null
    }
  }

  const empresa = db.prepare('SELECT nome FROM empresas WHERE id = ?').get(venda.empresa_id) as { nome: string } | undefined
  const itens = db.prepare(`
    SELECT produto_id, descricao, preco_unitario, quantidade, desconto, total
    FROM venda_itens WHERE venda_id = ?
  `).all(vendaId) as VendaItemDetalhe[]
  const pagamentos = db.prepare(`
    SELECT forma, valor FROM pagamentos WHERE venda_id = ?
  `).all(vendaId) as VendaPagamentoDetalhe[]
  return {
    venda,
    empresa_nome: empresa?.nome ?? 'Empresa',
    itens,
    pagamentos,
    cashback_cupom: getCashbackCupomExtras(venda.empresa_id, venda),
    cliente_nome_cupom: clienteNomeCupom,
    cliente_documento_cupom: clienteDocCupom,
  }
}

/** Atualiza o cliente da venda (ex.: na tela de NF-e antes de emitir). */
export function updateClienteVenda(vendaId: string, clienteId: string): Venda | null {
  const db = getDb()
  if (!db) return null
  const venda = getVendaById(vendaId)
  if (!venda) return null
  if (venda.status !== 'CONCLUIDA') return null
  db.prepare('UPDATE vendas SET cliente_id = ? WHERE id = ?').run(clienteId, vendaId)
  updateSyncClock()
  return getVendaById(vendaId)
}

/** Cancela uma venda (status CANCELADA) e estorna o estoque dos itens. */
export function cancelarVenda(vendaId: string, usuarioId: string): Venda | null {
  const db = getDb()
  if (!db) return null
  const venda = getVendaById(vendaId)
  if (!venda) throw new Error('Venda não encontrada.')
  if (venda.status !== 'CONCLUIDA') throw new Error('Apenas vendas concluídas podem ser canceladas.')

  const itens = db.prepare(`
    SELECT produto_id, quantidade FROM venda_itens WHERE venda_id = ?
  `).all(vendaId) as { produto_id: string; quantidade: number }[]

  db.transaction(() => {
    reverterCashbackAoCancelarVenda(vendaId, usuarioId)
    cancelarContaReceberVenda(vendaId)
    db.prepare('UPDATE vendas SET status = ? WHERE id = ?').run('CANCELADA', vendaId)

    for (const item of itens) {
      const produto = getProdutoById(item.produto_id)
      if (produto?.controla_estoque === 1) {
        registrarMovimento({
          empresa_id: venda.empresa_id,
          produto_id: item.produto_id,
          tipo: 'DEVOLUCAO',
          quantidade: item.quantidade,
          custo_unitario: produto.custo,
          referencia_tipo: 'CANCELAMENTO_VENDA',
          referencia_id: vendaId,
          usuario_id: usuarioId
        })
      }
    }
  })()

  const updated = getVendaById(vendaId)
  if (updated) {
    updateSyncClock()
    addToOutbox('vendas', vendaId, 'CANCEL', updated)
  }
  return updated
}
