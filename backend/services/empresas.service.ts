import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { addToOutbox } from '../../sync/outbox'

export type Empresa = {
  id: string
  nome: string
  cnpj: string | null
  created_at: string
}

export function listEmpresas(): Empresa[] {
  const db = getDb()
  if (!db) return []
  const rows = db.prepare('SELECT id, nome, cnpj, created_at FROM empresas ORDER BY nome').all() as Empresa[]
  return rows
}

export function createEmpresa(data: { nome: string; cnpj?: string }): Empresa {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const id = randomUUID()
  db.prepare('INSERT INTO empresas (id, nome, cnpj) VALUES (?, ?, ?)').run(
    id,
    data.nome,
    data.cnpj ?? null
  )
  const row = db.prepare('SELECT id, nome, cnpj, created_at FROM empresas WHERE id = ?').get(id) as Empresa
  addToOutbox('empresas', id, 'CREATE', row)
  return row
}

export function getEmpresaById(id: string): Empresa | null {
  const db = getDb()
  if (!db) return null
  const row = db.prepare('SELECT id, nome, cnpj, created_at FROM empresas WHERE id = ?').get(id) as Empresa | undefined
  return row ?? null
}
