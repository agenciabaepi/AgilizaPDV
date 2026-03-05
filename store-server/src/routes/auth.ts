import { Router } from 'express'
import { queryOne } from '../db'
import { verificarSenha } from '../lib/senha'
import { createSession, requireAuth, destroySession } from '../auth'

const r = Router()

r.post('/login', async (req, res) => {
  const { empresaId, login, senha } = req.body as { empresaId: string; login: string; senha: string }
  if (!empresaId || !login || !senha) {
    res.status(400).json({ error: 'empresaId, login e senha são obrigatórios' })
    return
  }
  const row = await queryOne<{ id: string; empresa_id: string; nome: string; login: string; role: string; senha_hash: string }>(
    'SELECT id, empresa_id, nome, login, role, senha_hash FROM usuarios WHERE empresa_id = $1 AND login = $2',
    [empresaId, login]
  )
  if (!row || !verificarSenha(senha, row.senha_hash)) {
    res.status(401).json({ error: 'Login ou senha inválidos' })
    return
  }
  const user = { id: row.id, empresa_id: row.empresa_id, nome: row.nome, login: row.login, role: row.role }
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

r.get('/session', (req, res) => {
  try {
    const user = requireAuth(req)
    res.json({ user })
  } catch (e: unknown) {
    const err = e as { statusCode?: number }
    res.status(err?.statusCode === 401 ? 401 : 500).json({ error: 'Não autorizado' })
  }
})

export default r
