import { getDb } from '../db'

export type Fornecedor = {
  id: string
  empresa_id: string
  razao_social: string
  cnpj: string | null
  contato: string | null
  observacoes: string | null
  created_at: string
}

function rowToFornecedor(r: Record<string, unknown>): Fornecedor {
  return {
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    razao_social: r.razao_social as string,
    cnpj: (r.cnpj as string) ?? null,
    contato: (r.contato as string) ?? null,
    observacoes: (r.observacoes as string) ?? null,
    created_at: r.created_at as string
  }
}

export function listFornecedores(empresaId: string): Fornecedor[] {
  const db = getDb()
  if (!db) return []
  const rows = db.prepare(`
    SELECT id, empresa_id, razao_social, cnpj, contato, observacoes, created_at
    FROM fornecedores WHERE empresa_id = ? ORDER BY razao_social
  `).all(empresaId) as Record<string, unknown>[]
  return rows.map(rowToFornecedor)
}

export function getFornecedorById(id: string): Fornecedor | null {
  const db = getDb()
  if (!db) return null
  const row = db.prepare(`
    SELECT id, empresa_id, razao_social, cnpj, contato, observacoes, created_at
    FROM fornecedores WHERE id = ?
  `).get(id) as Record<string, unknown> | undefined
  return row ? rowToFornecedor(row) : null
}
