import { Router } from 'express'
import { queryOne } from '../db'
import { verificarSenha } from '../lib/senha'
import { createSession, requireAuth, destroySession, getBearerToken, setSessionUser } from '../auth'

const r = Router()

r.post('/login', async (req, res) => {
  const body = req.body as {
    empresaId?: string
    empresaCodigo?: number | string
    login: string
    senha: string
  }
  const { login, senha } = body
  let empresaId = typeof body.empresaId === 'string' ? body.empresaId.trim() : ''
  if (!empresaId && body.empresaCodigo != null && String(body.empresaCodigo).trim() !== '') {
    const num =
      typeof body.empresaCodigo === 'number'
        ? body.empresaCodigo
        : parseInt(String(body.empresaCodigo).replace(/\D/g, ''), 10)
    if (!Number.isFinite(num) || num < 1) {
      res.status(400).json({ error: 'Código da empresa inválido' })
      return
    }
    const emp = await queryOne<{ id: string }>('SELECT id FROM empresas WHERE codigo_acesso = $1', [num])
    empresaId = emp?.id ?? ''
  }
  if (!empresaId || !login || !senha) {
    res.status(400).json({ error: 'Código da empresa (número), login e senha são obrigatórios' })
    return
  }
  const row = await queryOne<{
    id: string
    empresa_id: string
    nome: string
    login: string
    role: string
    senha_hash: string
    modulos_json: string | null
    created_at: string
  }>(
    'SELECT id, empresa_id, nome, login, role, senha_hash, modulos_json, created_at FROM usuarios WHERE empresa_id = $1 AND login = $2',
    [empresaId, login]
  )
  if (!row || !verificarSenha(senha, row.senha_hash)) {
    res.status(401).json({ error: 'Login ou senha inválidos' })
    return
  }
  const user = {
    id: row.id,
    empresa_id: row.empresa_id,
    nome: row.nome,
    login: row.login,
    role: row.role,
    modulos_json: row.modulos_json ?? null,
    created_at: row.created_at,
  }
  const sessionId = createSession(user)
  res.json({ user, sessionId })
})

r.post('/logout', (req, res) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim()
    if (token) destroySession(token)
  } catch {
    // ignore
  }
  res.json({ ok: true })
})

r.get('/session', async (req, res) => {
  try {
    const token = getBearerToken(req)
    const cached = requireAuth(req)
    const row = await queryOne<{
      id: string
      empresa_id: string
      nome: string
      login: string
      role: string
      modulos_json: string | null
      created_at: string
    }>('SELECT id, empresa_id, nome, login, role, modulos_json, created_at FROM usuarios WHERE id = $1', [cached.id])
    if (!row) {
      if (token) destroySession(token)
      res.status(401).json({ error: 'Não autorizado' })
      return
    }
    const user = {
      id: row.id,
      empresa_id: row.empresa_id,
      nome: row.nome,
      login: row.login,
      role: row.role,
      modulos_json: row.modulos_json ?? null,
      created_at: row.created_at,
    }
    if (token) setSessionUser(token, user)
    res.json({ user })
  } catch (e: unknown) {
    const err = e as { statusCode?: number }
    res.status(err?.statusCode === 401 ? 401 : 500).json({ error: 'Não autorizado' })
  }
})

export default r
