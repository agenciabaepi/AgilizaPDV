import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { hashSenha, verificarSenha } from '../lib/senha'

export type Role = 'admin' | 'gerente' | 'caixa' | 'estoque'

export type Usuario = {
  id: string
  empresa_id: string
  nome: string
  login: string
  role: Role
  created_at: string
}

export type UsuarioCompleto = Usuario & { senha_hash: string }

function rowToUsuario(r: Record<string, unknown>): Usuario {
  return {
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    nome: r.nome as string,
    login: r.login as string,
    role: r.role as Role,
    created_at: r.created_at as string
  }
}

export function listUsuariosByEmpresa(empresaId: string): Usuario[] {
  const db = getDb()
  if (!db) return []
  const rows = db.prepare(
    'SELECT id, empresa_id, nome, login, role, created_at FROM usuarios WHERE empresa_id = ? ORDER BY nome'
  ).all(empresaId) as Record<string, unknown>[]
  return rows.map(rowToUsuario)
}

export function createUsuario(data: {
  empresa_id: string
  nome: string
  login: string
  senha: string
  role: Role
}): Usuario {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const id = randomUUID()
  const senha_hash = hashSenha(data.senha)
  db.prepare(
    'INSERT INTO usuarios (id, empresa_id, nome, login, senha_hash, role) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, data.empresa_id, data.nome, data.login, senha_hash, data.role)
  const row = db.prepare(
    'SELECT id, empresa_id, nome, login, role, created_at FROM usuarios WHERE id = ?'
  ).get(id) as Record<string, unknown>
  return rowToUsuario(row)
}

export function findByLogin(empresaId: string, login: string): UsuarioCompleto | null {
  const db = getDb()
  if (!db) return null
  const row = db.prepare(
    'SELECT id, empresa_id, nome, login, senha_hash, role, created_at FROM usuarios WHERE empresa_id = ? AND login = ?'
  ).get(empresaId, login) as Record<string, unknown> | undefined
  if (!row) return null
  return {
    ...rowToUsuario(row),
    senha_hash: row.senha_hash as string
  }
}

export function login(empresaId: string, login: string, senha: string): Usuario | null {
  const user = findByLogin(empresaId, login)
  if (!user || !verificarSenha(senha, user.senha_hash)) return null
  const { senha_hash: _, ...safe } = user
  return safe
}
