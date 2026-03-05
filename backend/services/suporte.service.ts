import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { hashSenha, verificarSenha } from '../lib/senha'

export type SuporteUsuario = {
  id: string
  nome: string
  login: string
  created_at: string
}

function rowToSuporte(r: Record<string, unknown>): SuporteUsuario {
  return {
    id: r.id as string,
    nome: r.nome as string,
    login: r.login as string,
    created_at: r.created_at as string
  }
}

export function createSuporteUsuario(data: { nome: string; login: string; senha: string }): SuporteUsuario {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const id = randomUUID()
  const senha_hash = hashSenha(data.senha)
  db.prepare(
    'INSERT INTO suporte_usuarios (id, nome, login, senha_hash) VALUES (?, ?, ?, ?)'
  ).run(id, data.nome, data.login, senha_hash)
  const row = db.prepare('SELECT id, nome, login, created_at FROM suporte_usuarios WHERE id = ?').get(id) as Record<string, unknown>
  return rowToSuporte(row)
}

export function loginSuporte(login: string, senha: string): SuporteUsuario | null {
  const db = getDb()
  if (!db) return null
  const row = db.prepare(
    'SELECT id, nome, login, senha_hash, created_at FROM suporte_usuarios WHERE login = ?'
  ).get(login) as Record<string, unknown> | undefined
  if (!row || !verificarSenha(senha, row.senha_hash as string)) return null
  return rowToSuporte(row)
}

export function countSuporteUsuarios(): number {
  const db = getDb()
  if (!db) return 0
  const r = db.prepare('SELECT COUNT(*) AS c FROM suporte_usuarios').get() as { c: number }
  return r?.c ?? 0
}
