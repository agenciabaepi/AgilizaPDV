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

type UsuarioRow = { id: string; empresa_id: string; nome: string; login: string; role: string; modulos_json: string | null; created_at: string }

r.get('/', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const rows = await query<UsuarioRow>(
    'SELECT id, empresa_id, nome, login, role, modulos_json, created_at FROM usuarios WHERE empresa_id = $1 ORDER BY nome',
    [empresaId]
  )
  res.json(rows)
})

r.get('/:id', async (req, res) => {
  requireAuth(req)
  const { id } = req.params
  const row = await queryOne<UsuarioRow>(
    'SELECT id, empresa_id, nome, login, role, modulos_json, created_at FROM usuarios WHERE id = $1',
    [id]
  )
  if (!row) {
    res.status(404).json({ error: 'Usuário não encontrado' })
    return
  }
  res.json(row)
})

r.post('/', async (req, res) => {
  const user = requireAuth(req)
  const { empresa_id, nome, login, senha, role, modulos_json } = req.body as {
    empresa_id: string
    nome: string
    login: string
    senha: string
    role: 'admin' | 'gerente' | 'caixa' | 'estoque'
    modulos_json?: string | null
  }
  if (!nome?.trim() || !login?.trim() || !senha || !role) {
    res.status(400).json({ error: 'nome, login, senha e role são obrigatórios' })
    return
  }
  const eid = empresa_id || user.empresa_id
  const id = randomUUID()
  const senha_hash = hashSenha(senha)
  await run(
    'INSERT INTO usuarios (id, empresa_id, nome, login, senha_hash, role, modulos_json) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, eid, nome.trim(), login.trim(), senha_hash, role, modulos_json ?? null]
  )
  const row = await queryOne<UsuarioRow>(
    'SELECT id, empresa_id, nome, login, role, modulos_json, created_at FROM usuarios WHERE id = $1',
    [id]
  )
  res.status(201).json(row)
})

r.patch('/:id', async (req, res) => {
  const user = requireAuth(req)
  const { id } = req.params
  const { nome, login, role, senha, modulos_json } = req.body as { nome?: string; login?: string; role?: string; senha?: string; modulos_json?: string | null }
  const current = await queryOne<UsuarioRow & { empresa_id: string }>(
    'SELECT id, empresa_id, nome, login, role, modulos_json, created_at FROM usuarios WHERE id = $1',
    [id]
  )
  if (!current) {
    res.status(404).json({ error: 'Usuário não encontrado' })
    return
  }
  if (current.empresa_id !== user.empresa_id) {
    res.status(403).json({ error: 'Sem permissão para editar este usuário' })
    return
  }
  const updates: string[] = []
  const params: unknown[] = []
  let pos = 1
  if (nome !== undefined && nome.trim() !== '') {
    updates.push(`nome = $${pos++}`)
    params.push(nome.trim())
  }
  if (login !== undefined && login.trim() !== '') {
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM usuarios WHERE empresa_id = $1 AND LOWER(TRIM(login)) = LOWER(TRIM($2)) AND id != $3',
      [current.empresa_id, login.trim(), id]
    )
    if (existing) {
      res.status(400).json({ error: 'Já existe um usuário com este login nesta empresa.' })
      return
    }
    updates.push(`login = $${pos++}`)
    params.push(login.trim())
  }
  if (role !== undefined && ['admin', 'gerente', 'caixa', 'estoque'].includes(role)) {
    updates.push(`role = $${pos++}`)
    params.push(role)
  }
  if (senha !== undefined && senha !== '') {
    updates.push(`senha_hash = $${pos++}`)
    params.push(hashSenha(senha))
  }
  if (modulos_json !== undefined) {
    updates.push(`modulos_json = $${pos++}`)
    params.push(modulos_json)
  }
  if (updates.length === 0) {
    res.json(current)
    return
  }
  params.push(id)
  await run(
    `UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${pos}`,
    params
  )
  const row = await queryOne<UsuarioRow>('SELECT id, empresa_id, nome, login, role, modulos_json, created_at FROM usuarios WHERE id = $1', [id])
  res.json(row)
})

export default r
