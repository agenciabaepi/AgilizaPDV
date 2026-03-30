import { Router } from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, run } from '../db'
import { addToOutbox } from '../outbox'
import { emitMarca } from '../ws'
import { requireAuth } from '../auth'

const r = Router()
const COLS = 'id, empresa_id, nome, ativo, created_at, updated_at'

r.use((_req, _res, next) => {
  requireAuth(_req)
  next()
})

function rowToMarca(r: Record<string, unknown>) {
  return {
    id: r.id,
    empresa_id: r.empresa_id,
    nome: r.nome,
    ativo: Number(r.ativo ?? 1),
    created_at: r.created_at,
    updated_at: r.updated_at
  }
}

r.get('/', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const rows = await query<Record<string, unknown>>(
    `SELECT ${COLS} FROM marcas WHERE empresa_id = $1 ORDER BY nome`,
    [empresaId]
  )
  res.json(rows.map(rowToMarca))
})

r.get('/:id', async (req, res) => {
  const row = await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM marcas WHERE id = $1`, [req.params.id])
  if (!row) {
    res.status(404).json({ error: 'Marca não encontrada' })
    return
  }
  res.json(rowToMarca(row))
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
  const dup = await queryOne('SELECT id FROM marcas WHERE empresa_id = $1 AND nome = $2', [empresa_id, nome])
  if (dup) {
    res.status(400).json({ error: 'Já existe uma marca com este nome' })
    return
  }
  const id = randomUUID()
  const now = new Date().toISOString()
  const ativo = body.ativo !== undefined ? Number(body.ativo) : 1
  await run(
    `INSERT INTO marcas (id, empresa_id, nome, ativo, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, empresa_id, nome, ativo, now, now]
  )
  const row = await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM marcas WHERE id = $1`, [id])
  const marca = row ? rowToMarca(row) : null
  if (marca) {
    await addToOutbox('marcas', id, 'CREATE', marca as Record<string, unknown>)
    emitMarca(empresa_id, id, 'CREATE')
  }
  res.status(201).json(marca)
})

r.patch('/:id', async (req, res) => {
  const current = await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM marcas WHERE id = $1`, [req.params.id])
  if (!current) {
    res.status(404).json({ error: 'Marca não encontrada' })
    return
  }
  const body = req.body as Record<string, unknown>
  const nomeNext = body.nome !== undefined ? (body.nome as string).trim() : (current.nome as string)
  if (!nomeNext) {
    res.status(400).json({ error: 'Nome é obrigatório' })
    return
  }
  if (nomeNext !== current.nome) {
    const dup = await queryOne('SELECT id FROM marcas WHERE empresa_id = $1 AND nome = $2 AND id != $3', [
      current.empresa_id,
      nomeNext,
      req.params.id
    ])
    if (dup) {
      res.status(400).json({ error: 'Já existe uma marca com este nome' })
      return
    }
  }
  const ativoNext = body.ativo !== undefined ? Number(body.ativo) : Number(current.ativo ?? 1)
  const now = new Date().toISOString()
  await run(`UPDATE marcas SET nome = $1, ativo = $2, updated_at = $3 WHERE id = $4`, [nomeNext, ativoNext, now, req.params.id])
  const row = await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM marcas WHERE id = $1`, [req.params.id])
  const marca = row ? rowToMarca(row) : null
  if (marca) {
    await addToOutbox('marcas', req.params.id, 'UPDATE', marca as Record<string, unknown>)
    emitMarca(current.empresa_id as string, req.params.id, 'UPDATE')
  }
  res.json(marca)
})

r.delete('/:id', async (req, res) => {
  const hasProdutos = await queryOne('SELECT 1 FROM produtos WHERE marca_id = $1 LIMIT 1', [req.params.id])
  if (hasProdutos) {
    res.status(400).json({ error: 'Existem produtos vinculados a esta marca' })
    return
  }
  const current = await queryOne<Record<string, unknown>>(`SELECT ${COLS} FROM marcas WHERE id = $1`, [req.params.id])
  if (!current) {
    res.status(404).json({ error: 'Marca não encontrada' })
    return
  }
  await run('DELETE FROM marcas WHERE id = $1', [req.params.id])
  await addToOutbox('marcas', req.params.id, 'DELETE', { id: req.params.id })
  emitMarca(current.empresa_id as string, req.params.id, 'DELETE')
  res.json({ ok: true })
})

export default r
