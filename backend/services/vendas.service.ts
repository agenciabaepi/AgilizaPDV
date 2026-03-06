import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { updateSyncClock } from '../sync-clock'
import { getCaixaAberto } from './caixa.service'
import { getProdutoById } from './produtos.service'
import { registrarMovimento } from './estoque.service'
import { addToOutbox } from '../../sync/outbox'

export type FormaPagamento = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'OUTROS'

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
  created_at: string
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

  db.transaction(() => {
    db.prepare(`
      INSERT INTO vendas (id, empresa_id, caixa_id, usuario_id, cliente_id, numero, status, subtotal, desconto_total, total, troco)
      VALUES (?, ?, ?, ?, ?, ?, 'CONCLUIDA', ?, ?, ?, ?)
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
      troco
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

export function listVendas(empresaId: string, options?: ListVendasOptions): Venda[] {
  const db = getDb()
  if (!db) return []
  const limit = options?.limit ?? 500
  let sql = `
    SELECT id, empresa_id, caixa_id, usuario_id, cliente_id, numero, status, subtotal, desconto_total, total, troco, created_at
    FROM vendas WHERE empresa_id = ?
  `
  const params: (string | number)[] = [empresaId]

  if (options?.periodo === 'hoje') {
    sql += ` AND date(created_at, 'localtime') = date('now', 'localtime')`
  } else {
    if (options?.dataInicio) {
      sql += ` AND created_at >= ?`
      params.push(isoToSqliteDatetime(options.dataInicio))
    }
    if (options?.dataFim) {
      sql += ` AND created_at <= ?`
      params.push(isoToSqliteDatetime(options.dataFim))
    }
  }

  sql += ` ORDER BY created_at DESC LIMIT ?`
  params.push(limit)
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
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
    created_at: r.created_at as string
  }))
}

export function getVendaById(id: string): Venda | null {
  const db = getDb()
  if (!db) return null
  const row = db.prepare(`
    SELECT id, empresa_id, caixa_id, usuario_id, cliente_id, numero, status, subtotal, desconto_total, total, troco, created_at
    FROM vendas WHERE id = ?
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
    created_at: row.created_at as string
  }
}

export type VendaItemDetalhe = {
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
}

export function getVendaDetalhes(vendaId: string): VendaDetalhes | null {
  const venda = getVendaById(vendaId)
  if (!venda) return null
  const db = getDb()
  if (!db) return null
  const empresa = db.prepare('SELECT nome FROM empresas WHERE id = ?').get(venda.empresa_id) as { nome: string } | undefined
  const itens = db.prepare(`
    SELECT descricao, preco_unitario, quantidade, desconto, total
    FROM venda_itens WHERE venda_id = ?
  `).all(vendaId) as VendaItemDetalhe[]
  const pagamentos = db.prepare(`
    SELECT forma, valor FROM pagamentos WHERE venda_id = ?
  `).all(vendaId) as VendaPagamentoDetalhe[]
  return {
    venda,
    empresa_nome: empresa?.nome ?? 'Empresa',
    itens,
    pagamentos
  }
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
