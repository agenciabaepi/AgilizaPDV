import { Router } from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, run } from '../db'
import { addToOutbox } from '../outbox'
import { emitProduto } from '../ws'
import { requireAuth } from '../auth'

const r = Router()

r.use((_req, _res, next) => {
  requireAuth(_req)
  next()
})

const COLS = 'id, empresa_id, codigo, nome, sku, codigo_barras, fornecedor_id, categoria_id, marca_id, descricao, imagem, custo, markup, preco, unidade, controla_estoque, estoque_minimo, ativo, ncm, cfop, created_at, updated_at'

function rowToProduto(r: Record<string, unknown>) {
  return {
    id: r.id,
    empresa_id: r.empresa_id,
    codigo: r.codigo != null ? Number(r.codigo) : null,
    nome: r.nome,
    sku: r.sku ?? null,
    codigo_barras: r.codigo_barras ?? null,
    fornecedor_id: r.fornecedor_id ?? null,
    categoria_id: r.categoria_id ?? null,
    marca_id: r.marca_id ?? null,
    descricao: r.descricao ?? null,
    imagem: r.imagem ?? null,
    custo: Number(r.custo ?? 0),
    markup: Number(r.markup ?? 0),
    preco: Number(r.preco ?? 0),
    unidade: r.unidade ?? 'UN',
    controla_estoque: Number(r.controla_estoque ?? 1),
    estoque_minimo: Number(r.estoque_minimo ?? 0),
    ativo: Number(r.ativo ?? 1),
    ncm: r.ncm ?? null,
    cfop: r.cfop ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at
  }
}

r.get('/next-codigo', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const row = await queryOne<{ next: string }>(
    'SELECT COALESCE(MAX(codigo), 0) + 1 AS next FROM produtos WHERE empresa_id = $1',
    [empresaId]
  )
  res.json(Number(row?.next ?? 1))
})

r.get('/', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const search = req.query.search as string | undefined
  const apenasAtivos = String(req.query.apenasAtivos) === 'true'
  const ordenarPorMaisVendidos = String(req.query.ordenarPorMaisVendidos) === 'true'

  let sql: string
  const params: unknown[] = [empresaId]
  if (ordenarPorMaisVendidos) {
    sql = `
      SELECT p.id, p.empresa_id, p.codigo, p.nome, p.sku, p.codigo_barras, p.fornecedor_id, p.categoria_id, p.marca_id, p.descricao, p.imagem, p.custo, p.markup, p.preco, p.unidade, p.controla_estoque, p.estoque_minimo, p.ativo, p.ncm, p.cfop, p.created_at, p.updated_at
      FROM produtos p
      LEFT JOIN (
        SELECT vi.produto_id, SUM(vi.quantidade) AS qty
        FROM venda_itens vi
        INNER JOIN vendas v ON v.id = vi.venda_id AND v.empresa_id = $1 AND v.status = 'CONCLUIDA'
        GROUP BY vi.produto_id
      ) s ON s.produto_id = p.id
      WHERE p.empresa_id = $2
    `
    params.push(empresaId)
    let idx = 3
    if (search?.trim()) {
      const term = `%${search.trim()}%`
      sql += ` AND (p.nome LIKE $${idx} OR p.sku LIKE $${idx + 1} OR p.codigo_barras LIKE $${idx + 2} OR p.descricao LIKE $${idx + 3} OR EXISTS (SELECT 1 FROM categorias c WHERE c.id = p.categoria_id AND c.empresa_id = p.empresa_id AND c.nome LIKE $${idx + 4}) OR EXISTS (SELECT 1 FROM marcas m WHERE m.id = p.marca_id AND m.empresa_id = p.empresa_id AND m.nome LIKE $${idx + 5}))`
      params.push(term, term, term, term, term, term)
      idx += 6
    }
    if (apenasAtivos) sql += ' AND p.ativo = 1'
    sql += ' ORDER BY COALESCE(s.qty, 0) DESC, p.nome'
  } else {
    sql = `SELECT ${COLS} FROM produtos WHERE empresa_id = $1`
    if (search?.trim()) {
      const term = `%${search.trim()}%`
      sql += ` AND (nome LIKE $2 OR sku LIKE $2 OR codigo_barras LIKE $2 OR descricao LIKE $2 OR EXISTS (SELECT 1 FROM categorias c WHERE c.id = produtos.categoria_id AND c.empresa_id = produtos.empresa_id AND c.nome LIKE $2) OR EXISTS (SELECT 1 FROM marcas m WHERE m.id = produtos.marca_id AND m.empresa_id = produtos.empresa_id AND m.nome LIKE $2))`
      params.push(term)
    }
    if (apenasAtivos) sql += ' AND ativo = 1'
    sql += ' ORDER BY nome'
  }
  const rows = await query<Record<string, unknown>>(sql, params)
  res.json(rows.map(rowToProduto))
})

r.get('/:id', async (req, res) => {
  const row = await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM produtos WHERE id = $1`, [req.params.id])
  if (!row) {
    res.status(404).json({ error: 'Produto não encontrado' })
    return
  }
  res.json(rowToProduto(row))
})

r.post('/', async (req, res) => {
  const user = requireAuth(req)
  const body = req.body as Record<string, unknown>
  const empresa_id = (body.empresa_id as string) || user.empresa_id
  const nome = (body.nome as string)?.trim()
  if (!nome) {
    res.status(400).json({ error: 'Nome é obrigatório' })
    return
  }
  const codigoRow = await queryOne<{ next: string }>('SELECT COALESCE(MAX(codigo), 0) + 1 AS next FROM produtos WHERE empresa_id = $1', [empresa_id])
  const codigo = Number(codigoRow?.next ?? 1)
  const id = randomUUID()
  const now = new Date().toISOString()
  await run(
    `INSERT INTO produtos (id, empresa_id, codigo, nome, sku, codigo_barras, fornecedor_id, categoria_id, marca_id, descricao, imagem, custo, markup, preco, unidade, controla_estoque, estoque_minimo, ativo, ncm, cfop, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
    [
      id,
      empresa_id,
      codigo,
      nome,
      (body.sku as string)?.trim() ?? null,
      (body.codigo_barras as string)?.trim() ?? null,
      (body.fornecedor_id as string)?.trim() || null,
      (body.categoria_id as string)?.trim() || null,
      (body.marca_id as string)?.trim() || null,
      (body.descricao as string)?.trim() ?? null,
      (body.imagem as string)?.trim() ?? null,
      Number(body.custo ?? 0),
      Number(body.markup ?? 0),
      Number(body.preco ?? 0),
      (body.unidade as string)?.trim() ?? 'UN',
      Number(body.controla_estoque ?? 1),
      Number(body.estoque_minimo ?? 0),
      Number(body.ativo ?? 1),
      (body.ncm as string)?.trim() ?? null,
      (body.cfop as string)?.trim() ?? null,
      now,
      now
    ]
  )
  const row = await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM produtos WHERE id = $1`, [id])
  const produto = row ? rowToProduto(row) : null
  if (produto) {
    await addToOutbox('produtos', id, 'CREATE', produto as Record<string, unknown>)
    emitProduto(empresa_id, id, 'CREATE')
  }
  res.status(201).json(produto)
})

r.patch('/:id', async (req, res) => {
  const current = await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM produtos WHERE id = $1`, [req.params.id])
  if (!current) {
    res.status(404).json({ error: 'Produto não encontrado' })
    return
  }
  const body = req.body as Record<string, unknown>
  const now = new Date().toISOString()
  await run(
    `UPDATE produtos SET
      nome = COALESCE($1, nome), sku = COALESCE($2, sku), codigo_barras = COALESCE($3, codigo_barras),
      fornecedor_id = COALESCE($4, fornecedor_id), categoria_id = COALESCE($5, categoria_id), marca_id = COALESCE($6, marca_id),
      descricao = COALESCE($7, descricao), imagem = COALESCE($8, imagem),
      custo = COALESCE($9, custo), markup = COALESCE($10, markup), preco = COALESCE($11, preco),
      unidade = COALESCE($12, unidade), controla_estoque = COALESCE($13, controla_estoque),
      estoque_minimo = COALESCE($14, estoque_minimo), ativo = COALESCE($15, ativo),
      ncm = COALESCE($16, ncm), cfop = COALESCE($17, cfop), updated_at = $18
     WHERE id = $19`,
    [
      body.nome !== undefined ? (body.nome as string).trim() : null,
      body.sku !== undefined ? ((body.sku as string).trim() || null) : null,
      body.codigo_barras !== undefined ? ((body.codigo_barras as string).trim() || null) : null,
      body.fornecedor_id !== undefined ? ((body.fornecedor_id as string).trim() || null) : null,
      body.categoria_id !== undefined ? ((body.categoria_id as string).trim() || null) : null,
      body.marca_id !== undefined ? ((body.marca_id as string).trim() || null) : null,
      body.descricao !== undefined ? (body.descricao as string).trim() : null,
      body.imagem !== undefined ? (body.imagem as string).trim() : null,
      body.custo !== undefined ? body.custo : null,
      body.markup !== undefined ? body.markup : null,
      body.preco !== undefined ? body.preco : null,
      body.unidade !== undefined ? (body.unidade as string).trim() : null,
      body.controla_estoque !== undefined ? body.controla_estoque : null,
      body.estoque_minimo !== undefined ? body.estoque_minimo : null,
      body.ativo !== undefined ? body.ativo : null,
      body.ncm !== undefined ? ((body.ncm as string).trim() || null) : null,
      body.cfop !== undefined ? ((body.cfop as string).trim() || null) : null,
      now,
      req.params.id
    ]
  )
  const row = await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM produtos WHERE id = $1`, [req.params.id])
  const produto = row ? rowToProduto(row) : null
  if (produto) {
    await addToOutbox('produtos', req.params.id, 'UPDATE', produto as Record<string, unknown>)
    emitProduto(current.empresa_id as string, req.params.id, 'UPDATE')
  }
  res.json(produto)
})

export default r
