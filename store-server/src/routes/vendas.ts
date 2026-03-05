import { Router } from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, run, withTransaction } from '../db'
import { addToOutbox } from '../outbox'
import { emitVenda, emitEstoque } from '../ws'
import { getSaldo } from '../services/estoque'
import { requireAuth } from '../auth'

const r = Router()

r.use((_req, _res, next) => {
  requireAuth(_req)
  next()
})

function rowToVenda(r: Record<string, unknown>) {
  return {
    id: r.id,
    empresa_id: r.empresa_id,
    caixa_id: r.caixa_id,
    usuario_id: r.usuario_id,
    cliente_id: r.cliente_id ?? null,
    numero: Number(r.numero),
    status: r.status,
    subtotal: Number(r.subtotal),
    desconto_total: Number(r.desconto_total),
    total: Number(r.total),
    troco: Number(r.troco),
    created_at: r.created_at
  }
}

r.post('/finalizar', async (req, res) => {
  const user = requireAuth(req)
  const body = req.body as {
    empresa_id: string
    usuario_id: string
    cliente_id?: string
    itens: { produto_id: string; descricao: string; preco_unitario: number; quantidade: number; desconto?: number }[]
    pagamentos: { forma: string; valor: number }[]
    desconto_total?: number
    troco?: number
  }
  const empresa_id = body.empresa_id || user.empresa_id
  const usuario_id = body.usuario_id || user.id

  const caixa = await queryOne<Record<string, unknown>>(
    `SELECT id FROM caixas WHERE empresa_id = $1 AND status = 'ABERTO' ORDER BY aberto_em DESC LIMIT 1`,
    [empresa_id]
  )
  if (!caixa) {
    res.status(400).json({ error: 'Não há caixa aberto. Abra o caixa antes de vender.' })
    return
  }
  if (!body.itens?.length) {
    res.status(400).json({ error: 'Adicione ao menos um item à venda.' })
    return
  }
  if (!body.pagamentos?.length) {
    res.status(400).json({ error: 'Adicione ao menos uma forma de pagamento.' })
    return
  }

  const subtotal = body.itens.reduce((acc, i) => acc + i.preco_unitario * i.quantidade - (i.desconto ?? 0), 0)
  const descontoTotal = body.desconto_total ?? 0
  const total = subtotal - descontoTotal
  const totalPagamentos = body.pagamentos.reduce((acc, p) => acc + p.valor, 0)
  if (Math.abs(totalPagamentos - total) > 0.01) {
    res.status(400).json({
      error: `Total dos pagamentos (R$ ${totalPagamentos.toFixed(2)}) deve ser igual ao total da venda (R$ ${total.toFixed(2)}).`
    })
    return
  }

  const troco = body.troco ?? 0
  const vendaId = randomUUID()
  const numeroRow = await queryOne<{ n: string }>('SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM vendas WHERE empresa_id = $1', [empresa_id])
  const numero = Number(numeroRow?.n ?? 1)

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO vendas (id, empresa_id, caixa_id, usuario_id, cliente_id, numero, status, subtotal, desconto_total, total, troco)
       VALUES ($1, $2, $3, $4, $5, $6, 'CONCLUIDA', $7, $8, $9, $10)`,
      [vendaId, empresa_id, caixa.id, usuario_id, body.cliente_id ?? null, numero, subtotal, descontoTotal, total, troco]
    )
    for (const item of body.itens) {
      const totalItem = item.preco_unitario * item.quantidade - (item.desconto ?? 0)
      const itemId = randomUUID()
      await client.query(
        `INSERT INTO venda_itens (id, empresa_id, venda_id, produto_id, descricao, preco_unitario, quantidade, desconto, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [itemId, empresa_id, vendaId, item.produto_id, item.descricao, item.preco_unitario, item.quantidade, item.desconto ?? 0, totalItem]
      )
      const produto = await queryOne<Record<string, unknown>>(
        'SELECT id, controla_estoque, custo FROM produtos WHERE id = $1',
        [item.produto_id]
      )
      if (produto && Number(produto.controla_estoque) === 1) {
        const movId = randomUUID()
        await client.query(
          `INSERT INTO estoque_movimentos (id, empresa_id, produto_id, tipo, quantidade, custo_unitario, referencia_tipo, referencia_id, usuario_id)
           VALUES ($1, $2, $3, 'SAIDA', $4, $5, 'VENDA', $6, $7)`,
          [movId, empresa_id, item.produto_id, item.quantidade, produto.custo, vendaId, usuario_id]
        )
      }
    }
    for (const pag of body.pagamentos) {
      const pagId = randomUUID()
      await client.query(
        'INSERT INTO pagamentos (id, empresa_id, venda_id, forma, valor) VALUES ($1, $2, $3, $4, $5)',
        [pagId, empresa_id, vendaId, pag.forma, pag.valor]
      )
    }
  })

  const vendaRow = await queryOne<Record<string, unknown>>(
    'SELECT id, empresa_id, caixa_id, usuario_id, cliente_id, numero, status, subtotal, desconto_total, total, troco, created_at FROM vendas WHERE id = $1',
    [vendaId]
  )
  const venda = vendaRow ? rowToVenda(vendaRow) : null
  if (venda) {
    await addToOutbox('vendas', vendaId, 'CREATE', venda as Record<string, unknown>)
    emitVenda(empresa_id, vendaId, 'CREATE')
    for (const item of body.itens) {
      emitEstoque(empresa_id, item.produto_id)
    }
  }
  res.status(201).json(venda)
})

r.get('/', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const limit = req.query.limit != null ? Number(req.query.limit) : 500
  const periodo = req.query.periodo as string | undefined
  const dataInicio = req.query.dataInicio as string | undefined
  const dataFim = req.query.dataFim as string | undefined

  let sql = `SELECT id, empresa_id, caixa_id, usuario_id, cliente_id, numero, status, subtotal, desconto_total, total, troco, created_at
    FROM vendas WHERE empresa_id = $1`
  const params: unknown[] = [empresaId]

  if (periodo === 'hoje') {
    sql += ` AND created_at::date = CURRENT_DATE`
  } else {
    if (dataInicio) {
      sql += ` AND created_at >= $${params.length + 1}`
      params.push(dataInicio)
    }
    if (dataFim) {
      sql += ` AND created_at <= $${params.length + 1}`
      params.push(dataFim)
    }
  }
  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`
  params.push(limit)

  const rows = await query<Record<string, unknown>>(sql, params)
  res.json(rows.map(rowToVenda))
})

r.get('/:id', async (req, res) => {
  const row = await queryOne<Record<string, unknown>>(
    'SELECT id, empresa_id, caixa_id, usuario_id, cliente_id, numero, status, subtotal, desconto_total, total, troco, created_at FROM vendas WHERE id = $1',
    [req.params.id]
  )
  if (!row) {
    res.status(404).json({ error: 'Venda não encontrada' })
    return
  }
  res.json(rowToVenda(row))
})

r.get('/:id/detalhes', async (req, res) => {
  const vendaRow = await queryOne<Record<string, unknown>>(
    'SELECT id, empresa_id, caixa_id, usuario_id, cliente_id, numero, status, subtotal, desconto_total, total, troco, created_at FROM vendas WHERE id = $1',
    [req.params.id]
  )
  if (!vendaRow) {
    res.status(404).json({ error: 'Venda não encontrada' })
    return
  }
  const empresa = await queryOne<{ nome: string }>('SELECT nome FROM empresas WHERE id = $1', [vendaRow.empresa_id as string])
  const itens = await query<Record<string, unknown>>(
    'SELECT descricao, preco_unitario, quantidade, desconto, total FROM venda_itens WHERE venda_id = $1',
    [req.params.id]
  )
  const pagamentos = await query<Record<string, unknown>>(
    'SELECT forma, valor FROM pagamentos WHERE venda_id = $1',
    [req.params.id]
  )
  res.json({
    venda: rowToVenda(vendaRow),
    empresa_nome: empresa?.nome ?? 'Empresa',
    itens: itens.map((i) => ({
      descricao: i.descricao,
      preco_unitario: Number(i.preco_unitario),
      quantidade: Number(i.quantidade),
      desconto: Number(i.desconto),
      total: Number(i.total)
    })),
    pagamentos: pagamentos.map((p) => ({ forma: p.forma, valor: Number(p.valor) }))
  })
})

r.post('/:id/cancelar', async (req, res) => {
  const user = requireAuth(req)
  const vendaId = req.params.id
  const vendaRow = await queryOne<Record<string, unknown>>(
    'SELECT id, empresa_id, status FROM vendas WHERE id = $1',
    [vendaId]
  )
  if (!vendaRow) {
    res.status(404).json({ error: 'Venda não encontrada.' })
    return
  }
  if (vendaRow.status !== 'CONCLUIDA') {
    res.status(400).json({ error: 'Apenas vendas concluídas podem ser canceladas.' })
    return
  }
  const itens = await query<{ produto_id: string; quantidade: string }>(
    'SELECT produto_id, quantidade FROM venda_itens WHERE venda_id = $1',
    [vendaId]
  )
  const empresa_id = vendaRow.empresa_id as string

  await withTransaction(async (client) => {
    await client.query('UPDATE vendas SET status = $1 WHERE id = $2', ['CANCELADA', vendaId])
    for (const item of itens) {
      const produto = await queryOne<Record<string, unknown>>(
        'SELECT id, controla_estoque, custo FROM produtos WHERE id = $1',
        [item.produto_id]
      )
      if (produto && Number(produto.controla_estoque) === 1) {
        const movId = randomUUID()
        await client.query(
          `INSERT INTO estoque_movimentos (id, empresa_id, produto_id, tipo, quantidade, custo_unitario, referencia_tipo, referencia_id, usuario_id)
           VALUES ($1, $2, $3, 'DEVOLUCAO', $4, $5, 'CANCELAMENTO_VENDA', $6, $7)`,
          [movId, empresa_id, item.produto_id, item.quantidade, produto.custo, vendaId, user.id]
        )
      }
    }
  })

  const updated = await queryOne<Record<string, unknown>>(
    'SELECT id, empresa_id, caixa_id, usuario_id, cliente_id, numero, status, subtotal, desconto_total, total, troco, created_at FROM vendas WHERE id = $1',
    [vendaId]
  )
  if (updated) {
    await addToOutbox('vendas', vendaId, 'CANCEL', rowToVenda(updated) as Record<string, unknown>)
    emitVenda(empresa_id, vendaId, 'CANCEL')
    for (const item of itens) {
      emitEstoque(empresa_id, item.produto_id)
    }
  }
  res.json(updated ? rowToVenda(updated) : null)
})

export default r
