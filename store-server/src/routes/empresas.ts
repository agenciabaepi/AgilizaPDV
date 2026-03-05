import { Router } from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, run } from '../db'
import { addToOutbox } from '../outbox'

const r = Router()

r.get('/', async (_req, res) => {
  const rows = await query<{ id: string; nome: string; cnpj: string | null; created_at: string }>(
    'SELECT id, nome, cnpj, created_at FROM empresas ORDER BY nome'
  )
  res.json(rows)
})

r.post('/', async (req, res) => {
  const { nome, cnpj } = req.body as { nome: string; cnpj?: string }
  if (!nome?.trim()) {
    res.status(400).json({ error: 'Nome é obrigatório' })
    return
  }
  const id = randomUUID()
  await run(
    'INSERT INTO empresas (id, nome, cnpj) VALUES ($1, $2, $3)',
    [id, nome.trim(), cnpj?.trim() || null]
  )
  const row = await queryOne<{ id: string; nome: string; cnpj: string | null; created_at: string }>(
    'SELECT id, nome, cnpj, created_at FROM empresas WHERE id = $1',
    [id]
  )
  if (row) await addToOutbox('empresas', id, 'CREATE', row)
  res.status(201).json(row)
})

export default r
