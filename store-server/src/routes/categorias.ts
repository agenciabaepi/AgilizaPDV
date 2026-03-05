import { Router } from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, run } from '../db'
import { addToOutbox } from '../outbox'
import { emitCategoria } from '../ws'
import { requireAuth } from '../auth'

const r = Router()
const COLS = 'id, empresa_id, nome, parent_id, nivel, ordem, ativo, created_at'
const MAX_NIVEL = 3

r.use((_req, _res, next) => {
  requireAuth(_req)
  next()
})

function rowToCategoria(r: Record<string, unknown>) {
  return {
    id: r.id,
    empresa_id: r.empresa_id,
    nome: r.nome,
    parent_id: r.parent_id ?? null,
    nivel: Number(r.nivel ?? 1),
    ordem: Number(r.ordem ?? 0),
    ativo: Number(r.ativo ?? 1),
    created_at: r.created_at
  }
}

r.get('/', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const rows = await query<Record<string, unknown>>(
    `SELECT ${COLS} FROM categorias WHERE empresa_id = $1 ORDER BY COALESCE(parent_id, ''), ordem, nome`,
    [empresaId]
  )
  res.json(rows.map(rowToCategoria))
})

r.get('/tree', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const flat = await query<Record<string, unknown>>(
    `SELECT ${COLS} FROM categorias WHERE empresa_id = $1 ORDER BY COALESCE(parent_id, ''), ordem, nome`,
    [empresaId]
  )
  type Node = ReturnType<typeof rowToCategoria> & { children: Node[] }
  const byId = new Map<string, Node>()
  flat.forEach((c) => byId.set(c.id as string, { ...rowToCategoria(c), children: [] }))
  const roots: Node[] = []
  flat.forEach((c) => {
    const node = byId.get(c.id as string)!
    const parentId = c.parent_id as string | null
    if (!parentId) {
      roots.push(node)
    } else {
      const parent = byId.get(parentId)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
  })
  roots.sort((a, b) => a.ordem - b.ordem || String(a.nome).localeCompare(String(b.nome)))
  res.json(roots)
})

r.get('/folha', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const all = await query<Record<string, unknown>>(
    `SELECT ${COLS} FROM categorias WHERE empresa_id = $1 ORDER BY ordem, nome`,
    [empresaId]
  )
  const parentIds = new Set(all.map((c) => c.parent_id).filter(Boolean) as string[])
  const folha = all.filter((c) => !parentIds.has(c.id as string)).map(rowToCategoria)
  res.json(folha)
})

r.get('/path/:id', async (req, res) => {
  const row = await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM categorias WHERE id = $1`, [req.params.id])
  if (!row) {
    res.status(404).json({ error: 'Categoria não encontrada' })
    return
  }
  const parts: string[] = []
  let current: Record<string, unknown> | null = row
  while (current) {
    parts.unshift(current.nome as string)
    const pid = current.parent_id as string | null
    current = pid ? (await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM categorias WHERE id = $1`, [pid])) : null
  }
  res.json(parts.join(' → '))
})

r.get('/:id', async (req, res) => {
  const row = await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM categorias WHERE id = $1`, [req.params.id])
  if (!row) {
    res.status(404).json({ error: 'Categoria não encontrada' })
    return
  }
  res.json(rowToCategoria(row))
})

r.post('/', async (req, res) => {
  const user = requireAuth(req)
  const body = req.body as { empresa_id?: string; nome: string; parent_id?: string | null; ordem?: number; ativo?: number }
  const empresa_id = body.empresa_id || user.empresa_id
  const nome = body.nome?.trim()
  if (!nome) {
    res.status(400).json({ error: 'Nome é obrigatório' })
    return
  }
  let nivel = 1
  let ordem = body.ordem ?? 0
  if (body.parent_id) {
    const parent = await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM categorias WHERE id = $1`, [body.parent_id])
    if (!parent) {
      res.status(400).json({ error: 'Categoria pai não encontrada' })
      return
    }
    if (parent.empresa_id !== empresa_id) {
      res.status(400).json({ error: 'Categoria pai de outra empresa' })
      return
    }
    nivel = Number(parent.nivel) + 1
    if (nivel > MAX_NIVEL) {
      res.status(400).json({ error: `Máximo de ${MAX_NIVEL} níveis` })
      return
    }
    if (ordem === 0) {
      const next = await queryOne<{ next: string }>(
        'SELECT COALESCE(MAX(ordem), 0) + 1 AS next FROM categorias WHERE parent_id = $1 AND empresa_id = $2',
        [body.parent_id, empresa_id]
      )
      ordem = Number(next?.next ?? 1)
    }
  } else {
    if (ordem === 0) {
      const next = await queryOne<{ next: string }>(
        'SELECT COALESCE(MAX(ordem), 0) + 1 AS next FROM categorias WHERE empresa_id = $1 AND parent_id IS NULL',
        [empresa_id]
      )
      ordem = Number(next?.next ?? 1)
    }
  }
  const id = randomUUID()
  const now = new Date().toISOString()
  await run(
    `INSERT INTO categorias (id, empresa_id, nome, parent_id, nivel, ordem, ativo, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, empresa_id, nome, body.parent_id?.trim() || null, nivel, ordem, body.ativo ?? 1, now]
  )
  const row = await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM categorias WHERE id = $1`, [id])
  const cat = row ? rowToCategoria(row) : null
  if (cat) {
    await addToOutbox('categorias', id, 'CREATE', cat as Record<string, unknown>)
    emitCategoria(empresa_id, id, 'CREATE')
  }
  res.status(201).json(cat)
})

r.patch('/:id', async (req, res) => {
  const current = await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM categorias WHERE id = $1`, [req.params.id])
  if (!current) {
    res.status(404).json({ error: 'Categoria não encontrada' })
    return
  }
  const body = req.body as { nome?: string; ordem?: number; ativo?: number }
  await run(
    `UPDATE categorias SET nome = COALESCE($1, nome), ordem = COALESCE($2, ordem), ativo = COALESCE($3, ativo) WHERE id = $4`,
    [
      body.nome !== undefined ? body.nome.trim() : null,
      body.ordem !== undefined ? body.ordem : null,
      body.ativo !== undefined ? body.ativo : null,
      req.params.id
    ]
  )
  const row = await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM categorias WHERE id = $1`, [req.params.id])
  const cat = row ? rowToCategoria(row) : null
  if (cat) {
    await addToOutbox('categorias', req.params.id, 'UPDATE', cat as Record<string, unknown>)
    emitCategoria(current.empresa_id as string, req.params.id, 'UPDATE')
  }
  res.json(cat)
})

r.delete('/:id', async (req, res) => {
  const hasChildren = await queryOne('SELECT 1 FROM categorias WHERE parent_id = $1 LIMIT 1', [req.params.id])
  if (hasChildren) {
    res.status(400).json({ error: 'Categoria possui subcategorias' })
    return
  }
  const hasProdutos = await queryOne('SELECT 1 FROM produtos WHERE categoria_id = $1 LIMIT 1', [req.params.id])
  if (hasProdutos) {
    res.status(400).json({ error: 'Existem produtos nesta categoria' })
    return
  }
  const current = await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM categorias WHERE id = $1`, [req.params.id])
  if (!current) {
    res.status(404).json({ error: 'Categoria não encontrada' })
    return
  }
  await run('DELETE FROM categorias WHERE id = $1', [req.params.id])
  await addToOutbox('categorias', req.params.id, 'DELETE', { id: req.params.id })
  emitCategoria(current.empresa_id as string, req.params.id, 'DELETE')
  res.json({ ok: true })
})

export default r
