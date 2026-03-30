import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { updateSyncClock } from '../sync-clock'
import { addToOutbox } from '../../sync/outbox'

export type Marca = {
  id: string
  empresa_id: string
  nome: string
  ativo: number
  created_at: string
  updated_at: string
}

const COLS = 'id, empresa_id, nome, ativo, created_at, updated_at'

function rowToMarca(r: Record<string, unknown>): Marca {
  return {
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    nome: r.nome as string,
    ativo: (r.ativo as number) ?? 1,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string
  }
}

export function listMarcas(empresaId: string): Marca[] {
  const db = getDb()
  if (!db) return []
  const rows = db.prepare(`
    SELECT ${COLS} FROM marcas WHERE empresa_id = ? ORDER BY nome COLLATE NOCASE
  `).all(empresaId) as Record<string, unknown>[]
  return rows.map(rowToMarca)
}

export function getMarcaById(id: string): Marca | null {
  const db = getDb()
  if (!db) return null
  const row = db.prepare(`SELECT ${COLS} FROM marcas WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  return row ? rowToMarca(row) : null
}

export type CreateMarcaInput = {
  empresa_id: string
  nome: string
  ativo?: number
}

export function createMarca(data: CreateMarcaInput): Marca {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const nome = data.nome.trim()
  if (!nome) throw new Error('Nome é obrigatório')
  const dup = db.prepare(`SELECT id FROM marcas WHERE empresa_id = ? AND nome = ?`).get(data.empresa_id, nome) as { id: string } | undefined
  if (dup) throw new Error('Já existe uma marca com este nome.')
  const id = randomUUID()
  const now = new Date().toISOString()
  const ativo = data.ativo !== undefined ? (data.ativo ? 1 : 0) : 1
  db.prepare(`
    INSERT INTO marcas (id, empresa_id, nome, ativo, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.empresa_id, nome, ativo, now, now)
  const row = db.prepare(`SELECT ${COLS} FROM marcas WHERE id = ?`).get(id) as Record<string, unknown>
  const marca = rowToMarca(row)
  updateSyncClock()
  addToOutbox('marcas', id, 'CREATE', marca as unknown as Record<string, unknown>)
  return marca
}

export type UpdateMarcaInput = { nome?: string; ativo?: number }

export function updateMarca(id: string, data: UpdateMarcaInput): Marca | null {
  const db = getDb()
  if (!db) return null
  const current = getMarcaById(id)
  if (!current) return null
  const nomeNext = data.nome !== undefined ? data.nome.trim() : current.nome
  if (!nomeNext) throw new Error('Nome é obrigatório')
  if (nomeNext !== current.nome) {
    const dup = db
      .prepare(`SELECT id FROM marcas WHERE empresa_id = ? AND nome = ? AND id != ?`)
      .get(current.empresa_id, nomeNext, id) as { id: string } | undefined
    if (dup) throw new Error('Já existe uma marca com este nome.')
  }
  const ativoNext = data.ativo !== undefined ? (data.ativo ? 1 : 0) : current.ativo
  const now = new Date().toISOString()
  db.prepare(`
    UPDATE marcas SET nome = ?, ativo = ?, updated_at = ? WHERE id = ?
  `).run(nomeNext, ativoNext, now, id)
  const updated = getMarcaById(id)
  if (updated) {
    updateSyncClock()
    addToOutbox('marcas', id, 'UPDATE', updated as unknown as Record<string, unknown>)
  }
  return updated
}

export function deleteMarca(id: string): boolean {
  const db = getDb()
  if (!db) return false
  const current = getMarcaById(id)
  if (!current) return false
  const row = db.prepare(`SELECT 1 FROM produtos WHERE marca_id = ? LIMIT 1`).get(id) as { 1: number } | undefined
  if (row) return false
  db.prepare(`DELETE FROM marcas WHERE id = ?`).run(id)
  updateSyncClock()
  addToOutbox('marcas', id, 'DELETE', { id })
  return true
}
