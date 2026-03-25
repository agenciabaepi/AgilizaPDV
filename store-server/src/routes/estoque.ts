import { Router } from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, run } from '../db'
import { addToOutbox } from '../outbox'
import { emitEstoque } from '../ws'
import { getSaldo, syncProdutoEstoqueAtual } from '../services/estoque'
import { requireAuth } from '../auth'

const r = Router()
type TipoMovimento = 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'DEVOLUCAO'

r.use((_req, _res, next) => {
  requireAuth(_req)
  next()
})

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

r.get('/movimentos', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const produtoId = req.query.produtoId as string | undefined
  const limit = req.query.limit != null ? Number(req.query.limit) : undefined
  let sql = `SELECT id, empresa_id, produto_id, tipo, quantidade, custo_unitario, referencia_tipo, referencia_id, usuario_id, created_at
    FROM estoque_movimentos WHERE empresa_id = $1`
  const params: unknown[] = [empresaId]
  if (produtoId) {
    sql += ' AND produto_id = $2'
    params.push(produtoId)
  }
  sql += ' ORDER BY created_at DESC'
  if (limit) {
    sql += ` LIMIT $${params.length + 1}`
    params.push(limit)
  }
  const rows = await query<Record<string, unknown>>(sql, params)
  res.json(rows)
})

r.get('/saldo', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const produtoId = req.query.produtoId as string
  if (!produtoId) {
    res.status(400).json({ error: 'produtoId é obrigatório' })
    return
  }
  const saldo = await getSaldo(empresaId, produtoId)
  res.json(saldo)
})

r.get('/saldos', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const produtos = await query<{ id: string; nome: string; unidade: string; estoque_minimo: string }>(
    `SELECT id, nome, unidade, estoque_minimo FROM produtos
     WHERE empresa_id = $1 AND ativo = 1 AND controla_estoque = 1 ORDER BY nome`,
    [empresaId]
  )
  const result = await Promise.all(
    produtos.map(async (p) => ({
      produto_id: p.id,
      nome: p.nome,
      unidade: p.unidade,
      saldo: await getSaldo(empresaId, p.id),
      estoque_minimo: Number(p.estoque_minimo)
    }))
  )
  res.json(result)
})

r.post('/movimento', async (req, res) => {
  const user = requireAuth(req)
  const body = req.body as {
    empresa_id: string
    produto_id: string
    tipo: TipoMovimento
    quantidade: number
    custo_unitario?: number
    referencia_tipo?: string
    referencia_id?: string
    usuario_id?: string
    permitir_saldo_negativo?: boolean
  }
  const empresa_id = body.empresa_id || user.empresa_id
  if (!body.produto_id || body.quantidade === 0) {
    res.status(400).json({ error: 'produto_id e quantidade (diferente de zero) são obrigatórios' })
    return
  }
  if (body.tipo === 'SAIDA' && body.quantidade < 0) {
    res.status(400).json({ error: 'Para SAIDA use quantidade positiva' })
    return
  }
  const saldoAtual = await getSaldo(empresa_id, body.produto_id)
  const variacao = contribuicaoSaldo(body.tipo, body.quantidade)
  if (saldoAtual + variacao < 0 && !body.permitir_saldo_negativo) {
    res.status(400).json({ error: `Saldo insuficiente. Atual: ${saldoAtual}` })
    return
  }
  const id = randomUUID()
  const qty = body.tipo === 'AJUSTE' ? body.quantidade : Math.abs(body.quantidade)
  await run(
    `INSERT INTO estoque_movimentos (id, empresa_id, produto_id, tipo, quantidade, custo_unitario, referencia_tipo, referencia_id, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      empresa_id,
      body.produto_id,
      body.tipo,
      qty,
      body.custo_unitario ?? null,
      body.referencia_tipo ?? null,
      body.referencia_id ?? null,
      body.usuario_id ?? null
    ]
  )
  const row = await queryOne<Record<string, unknown>>(
    'SELECT id, empresa_id, produto_id, tipo, quantidade, custo_unitario, referencia_tipo, referencia_id, usuario_id, created_at FROM estoque_movimentos WHERE id = $1',
    [id]
  )
  if (row) {
    await addToOutbox('estoque_movimentos', id, 'CREATE', row)
    emitEstoque(empresa_id, body.produto_id)
  }
  await syncProdutoEstoqueAtual(empresa_id, body.produto_id)
  res.status(201).json(row)
})

r.post('/ajustar', async (req, res) => {
  const user = requireAuth(req)
  const { empresaId, produtoId, novoSaldo } = req.body as { empresaId: string; produtoId: string; novoSaldo: number }
  const empresa_id = empresaId || user.empresa_id
  if (!produtoId || novoSaldo == null) {
    res.status(400).json({ error: 'produtoId e novoSaldo são obrigatórios' })
    return
  }
  const saldoAtual = await getSaldo(empresa_id, produtoId)
  const delta = novoSaldo - saldoAtual
  if (delta === 0) {
    res.json({ ok: true })
    return
  }
  const id = randomUUID()
  await run(
    `INSERT INTO estoque_movimentos (id, empresa_id, produto_id, tipo, quantidade, custo_unitario, referencia_tipo, referencia_id, usuario_id)
     VALUES ($1, $2, $3, 'AJUSTE', $4, NULL, NULL, NULL, NULL)`,
    [id, empresa_id, produtoId, delta]
  )
  const row = await queryOne<Record<string, unknown>>(
    'SELECT id, empresa_id, produto_id, tipo, quantidade, custo_unitario, referencia_tipo, referencia_id, usuario_id, created_at FROM estoque_movimentos WHERE id = $1',
    [id]
  )
  if (row) {
    await addToOutbox('estoque_movimentos', id, 'CREATE', row)
    emitEstoque(empresa_id, produtoId)
  }
  await syncProdutoEstoqueAtual(empresa_id, produtoId)
  res.json({ ok: true })
})

export default r
