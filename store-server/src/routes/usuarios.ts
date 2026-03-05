import { Router } from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, run } from '../db'
import { hashSenha } from '../lib/senha'
import { requireAuth } from '../auth'

const r = Router()

r.use((req, _res, next) => {
  requireAuth(req)
  next()
})

r.get('/', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const rows = await query<{ id: string; empresa_id: string; nome: string; login: string; role: string; created_at: string }>(
    'SELECT id, empresa_id, nome, login, role, created_at FROM usuarios WHERE empresa_id = $1 ORDER BY nome',
    [empresaId]
  )
  res.json(rows)
})

r.post('/', async (req, res) => {
  const user = requireAuth(req)
  const { empresa_id, nome, login, senha, role } = req.body as {
    empresa_id: string
    nome: string
    login: string
    senha: string
    role: 'admin' | 'gerente' | 'caixa' | 'estoque'
  }
  if (!nome?.trim() || !login?.trim() || !senha || !role) {
    res.status(400).json({ error: 'nome, login, senha e role são obrigatórios' })
    return
  }
  const eid = empresa_id || user.empresa_id
  const id = randomUUID()
  const senha_hash = hashSenha(senha)
  await run(
    'INSERT INTO usuarios (id, empresa_id, nome, login, senha_hash, role) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, eid, nome.trim(), login.trim(), senha_hash, role]
  )
  const row = await queryOne<{ id: string; empresa_id: string; nome: string; login: string; role: string; created_at: string }>(
    'SELECT id, empresa_id, nome, login, role, created_at FROM usuarios WHERE id = $1',
    [id]
  )
  res.status(201).json(row)
})

export default r
