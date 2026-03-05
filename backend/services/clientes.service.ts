import { randomUUID } from 'crypto'
import { getDb } from '../db'

export type Cliente = {
  id: string
  empresa_id: string
  nome: string
  cpf_cnpj: string | null
  telefone: string | null
  email: string | null
  endereco: string | null
  observacoes: string | null
  created_at: string
}

function rowToCliente(r: Record<string, unknown>): Cliente {
  return {
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    nome: r.nome as string,
    cpf_cnpj: (r.cpf_cnpj as string) ?? null,
    telefone: (r.telefone as string) ?? null,
    email: (r.email as string) ?? null,
    endereco: (r.endereco as string) ?? null,
    observacoes: (r.observacoes as string) ?? null,
    created_at: r.created_at as string
  }
}

export function listClientes(empresaId: string): Cliente[] {
  const db = getDb()
  if (!db) return []
  const rows = db.prepare(`
    SELECT id, empresa_id, nome, cpf_cnpj, telefone, email, endereco, observacoes, created_at
    FROM clientes WHERE empresa_id = ? ORDER BY nome
  `).all(empresaId) as Record<string, unknown>[]
  return rows.map(rowToCliente)
}

export function getClienteById(id: string): Cliente | null {
  const db = getDb()
  if (!db) return null
  const row = db.prepare(`
    SELECT id, empresa_id, nome, cpf_cnpj, telefone, email, endereco, observacoes, created_at
    FROM clientes WHERE id = ?
  `).get(id) as Record<string, unknown> | undefined
  return row ? rowToCliente(row) : null
}
