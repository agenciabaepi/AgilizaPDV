import { Router } from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, run, withTransaction } from '../db'
import { addToOutbox } from '../outbox'
import { emitVenda, emitEstoque } from '../ws'
import { syncProdutoEstoqueAtual } from '../services/estoque'
import { assertPodeVenderAPrazo, createContaReceberVenda, cancelarContaReceberVenda } from '../services/contas-receber'
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
    cashback_gerado: Number(r.cashback_gerado) || 0,
    cashback_usado: Number(r.cashback_usado) || 0,
    venda_a_prazo: Number(r.venda_a_prazo) || 0,
    data_vencimento: r.data_vencimento ?? null,
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
    data_vencimento?: string
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
  if (body.pagamentos.some((p) => p.forma === 'CASHBACK')) {
    res.status(400).json({
      error:
        'Pagamento com cashback exige o PDV no modo local (banco SQLite). No terminal remoto conectado ao servidor, use outras formas de pagamento ou finalize no caixa local.'
    })
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
  const temPrazo = body.pagamentos.some((p) => p.forma === 'A_PRAZO')
  if (temPrazo) {
    try {
      if (body.pagamentos.some((p) => p.forma === 'CASHBACK')) {
        res.status(400).json({ error: 'Não é possível usar cashback em venda a prazo.' })
        return
      }
      if (body.pagamentos.length !== 1 || body.pagamentos[0].forma !== 'A_PRAZO') {
        res.status(400).json({ error: 'Venda a prazo deve ser quitada em uma única forma de pagamento (A prazo) pelo valor total.' })
        return
      }
      if (!body.cliente_id) {
        res.status(400).json({ error: 'Selecione o cliente para venda a prazo.' })
        return
      }
      const dv = body.data_vencimento?.trim()
      if (!dv || !/^\d{4}-\d{2}-\d{2}$/.test(dv)) {
        res.status(400).json({ error: 'Informe a data de vencimento (venda a prazo).' })
        return
      }
      if (troco > 0.01) {
        res.status(400).json({ error: 'Venda a prazo não gera troco.' })
        return
      }
      await assertPodeVenderAPrazo(empresa_id, body.cliente_id, total)
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) })
      return
    }
  }

  const vendaId = randomUUID()
  const numeroRow = await queryOne<{ n: string }>('SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM vendas WHERE empresa_id = $1', [empresa_id])
  const numero = Number(numeroRow?.n ?? 1)

  const vendaAPrazoFlag = temPrazo ? 1 : 0
  const dataVencimentoSql = temPrazo ? body.data_vencimento!.trim() : null

  const produtosEstoqueAfetados = new Set<string>()
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO vendas (id, empresa_id, caixa_id, usuario_id, cliente_id, numero, status, subtotal, desconto_total, total, troco, venda_a_prazo, data_vencimento)
       VALUES ($1, $2, $3, $4, $5, $6, 'CONCLUIDA', $7, $8, $9, $10, $11, $12)`,
      [vendaId, empresa_id, caixa.id, usuario_id, body.cliente_id ?? null, numero, subtotal, descontoTotal, total, troco, vendaAPrazoFlag, dataVencimentoSql]
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
        produtosEstoqueAfetados.add(item.produto_id)
      }
    }
    for (const pag of body.pagamentos) {
      const pagId = randomUUID()
      await client.query(
        'INSERT INTO pagamentos (id, empresa_id, venda_id, forma, valor) VALUES ($1, $2, $3, $4, $5)',
        [pagId, empresa_id, vendaId, pag.forma, pag.valor]
      )
    }
    if (temPrazo && body.cliente_id && dataVencimentoSql) {
      await createContaReceberVenda(client, {
        empresa_id,
        venda_id: vendaId,
        cliente_id: body.cliente_id,
        valor: total,
        vencimento: dataVencimentoSql
      })
    }
  })

  for (const pid of produtosEstoqueAfetados) {
    await syncProdutoEstoqueAtual(empresa_id, pid)
  }

  const vendaRow = await queryOne<Record<string, unknown>>(
    `SELECT id, empresa_id, caixa_id, usuario_id, cliente_id, numero, status, subtotal, desconto_total, total, troco,
     COALESCE(cashback_gerado, 0) AS cashback_gerado, COALESCE(cashback_usado, 0) AS cashback_usado,
     COALESCE(venda_a_prazo, 0) AS venda_a_prazo, data_vencimento, created_at
     FROM vendas WHERE id = $1`,
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
  const rawLimit = req.query.limit != null ? Number(req.query.limit) : 2000
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 2000, 1), 50_000)
  const periodo = req.query.periodo as string | undefined
  const dataInicio = req.query.dataInicio as string | undefined
  const dataFim = req.query.dataFim as string | undefined

  let sql = `SELECT v.id, v.empresa_id, v.caixa_id, v.usuario_id, v.cliente_id, v.numero, v.status, v.subtotal, v.desconto_total, v.total, v.troco,
    COALESCE(v.cashback_gerado, 0) AS cashback_gerado, COALESCE(v.cashback_usado, 0) AS cashback_usado,
    COALESCE(v.venda_a_prazo, 0) AS venda_a_prazo, v.data_vencimento, v.created_at,
    n.chave AS nfce_chave,
    (n.venda_id IS NOT NULL AND n.status = 'AUTORIZADA') AS nfce_emitida,
    ne.chave AS nfe_chave,
    (ne.venda_id IS NOT NULL AND ne.status = 'AUTORIZADA') AS nfe_emitida
    FROM vendas v
    LEFT JOIN venda_nfce n ON n.venda_id = v.id AND n.status = 'AUTORIZADA'
    LEFT JOIN venda_nfe ne ON ne.venda_id = v.id AND ne.status = 'AUTORIZADA'
    WHERE v.empresa_id = $1`
  const params: unknown[] = [empresaId]

  if (periodo === 'hoje') {
    sql += ` AND v.created_at::date = CURRENT_DATE`
  } else {
    if (dataInicio) {
      sql += ` AND v.created_at >= $${params.length + 1}`
      params.push(dataInicio)
    }
    if (dataFim) {
      sql += ` AND v.created_at <= $${params.length + 1}`
      params.push(dataFim)
    }
  }
  sql += ` ORDER BY v.created_at DESC LIMIT $${params.length + 1}`
  params.push(limit)

  const rows = await query<Record<string, unknown>>(sql, params)
  const ids = rows.map((r) => r.id as string)
  let prazoPorVenda = new Set<string>()
  if (ids.length > 0) {
    const prazoRows = await query<{ venda_id: string }>(
      `SELECT DISTINCT venda_id FROM pagamentos WHERE forma = 'A_PRAZO' AND venda_id = ANY($1::text[])`,
      [ids]
    )
    prazoPorVenda = new Set(prazoRows.map((r) => r.venda_id))
  }
  res.json(
    rows.map((r) => {
      const v = rowToVenda(r)
      if (prazoPorVenda.has(String(v.id))) v.venda_a_prazo = 1
      return {
        ...v,
        nfce_emitida: Boolean(r.nfce_emitida),
        nfce_chave: r.nfce_chave != null ? String(r.nfce_chave) : null,
        nfe_emitida: Boolean(r.nfe_emitida),
        nfe_chave: r.nfe_chave != null ? String(r.nfe_chave) : null,
      }
    })
  )
})

r.get('/:id', async (req, res) => {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT id, empresa_id, caixa_id, usuario_id, cliente_id, numero, status, subtotal, desconto_total, total, troco,
     COALESCE(cashback_gerado, 0) AS cashback_gerado, COALESCE(cashback_usado, 0) AS cashback_usado,
     COALESCE(venda_a_prazo, 0) AS venda_a_prazo, data_vencimento, created_at
     FROM vendas WHERE id = $1`,
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
    `SELECT id, empresa_id, caixa_id, usuario_id, cliente_id, numero, status, subtotal, desconto_total, total, troco,
     COALESCE(cashback_gerado, 0) AS cashback_gerado, COALESCE(cashback_usado, 0) AS cashback_usado,
     COALESCE(venda_a_prazo, 0) AS venda_a_prazo, data_vencimento, created_at
     FROM vendas WHERE id = $1`,
    [req.params.id]
  )
  if (!vendaRow) {
    res.status(404).json({ error: 'Venda não encontrada' })
    return
  }
  let venda = rowToVenda(vendaRow)
  const parseDv = (raw: string | null | undefined): string | null => {
    if (raw == null) return null
    const s = String(raw).trim()
    if (!s) return null
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
    return m ? m[1] : s.slice(0, 10)
  }
  let dataVenc = parseDv(venda.data_vencimento as string | null | undefined)
  if (!dataVenc) {
    const cr = await queryOne<{ vencimento: string }>(
      'SELECT vencimento::text AS vencimento FROM contas_receber WHERE venda_id = $1 LIMIT 1',
      [req.params.id]
    )
    if (cr?.vencimento != null) dataVenc = parseDv(cr.vencimento)
  }
  venda = { ...venda, data_vencimento: dataVenc ?? (venda.data_vencimento as string | null) }

  let clienteNomeCupom: string | null = null
  let clienteDocCupom: string | null = null
  if (venda.cliente_id) {
    const c = await queryOne<{ nome: string; cpf_cnpj: string | null }>(
      'SELECT nome, cpf_cnpj FROM clientes WHERE id = $1',
      [venda.cliente_id]
    )
    if (c) {
      clienteNomeCupom = c.nome?.trim() || null
      clienteDocCupom = c.cpf_cnpj?.trim() || null
    }
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
    venda,
    empresa_nome: empresa?.nome ?? 'Empresa',
    itens: itens.map((i) => ({
      descricao: i.descricao,
      preco_unitario: Number(i.preco_unitario),
      quantidade: Number(i.quantidade),
      desconto: Number(i.desconto),
      total: Number(i.total)
    })),
    pagamentos: pagamentos.map((p) => ({ forma: p.forma, valor: Number(p.valor) })),
    cashback_cupom: null,
    cliente_nome_cupom: clienteNomeCupom,
    cliente_documento_cupom: clienteDocCupom
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

  const produtosEstoqueAfetados = new Set<string>()
  await withTransaction(async (client) => {
    await cancelarContaReceberVenda(client, vendaId)
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
        produtosEstoqueAfetados.add(item.produto_id)
      }
    }
  })

  for (const pid of produtosEstoqueAfetados) {
    await syncProdutoEstoqueAtual(empresa_id, pid)
  }

  const updated = await queryOne<Record<string, unknown>>(
    `SELECT id, empresa_id, caixa_id, usuario_id, cliente_id, numero, status, subtotal, desconto_total, total, troco,
     COALESCE(cashback_gerado, 0) AS cashback_gerado, COALESCE(cashback_usado, 0) AS cashback_usado,
     COALESCE(venda_a_prazo, 0) AS venda_a_prazo, data_vencimento, created_at
     FROM vendas WHERE id = $1`,
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
