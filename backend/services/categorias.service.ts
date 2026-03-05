import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { addToOutbox } from '../../sync/outbox'

export type Categoria = {
  id: string
  empresa_id: string
  nome: string
  parent_id: string | null
  nivel: number
  ordem: number
  ativo: number
  created_at: string
}

export type CategoriaTreeNode = Categoria & {
  children: CategoriaTreeNode[]
}

const COLS = 'id, empresa_id, nome, parent_id, nivel, ordem, ativo, created_at'
const MAX_NIVEL = 3

function rowToCategoria(r: Record<string, unknown>): Categoria {
  return {
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    nome: r.nome as string,
    parent_id: (r.parent_id as string) ?? null,
    nivel: (r.nivel as number) ?? 1,
    ordem: (r.ordem as number) ?? 0,
    ativo: (r.ativo as number) ?? 1,
    created_at: r.created_at as string
  }
}

/** Lista todas as categorias da empresa (flat), ordenadas por parent_id e ordem */
export function listCategorias(empresaId: string): Categoria[] {
  const db = getDb()
  if (!db) return []
  const rows = db.prepare(`
    SELECT ${COLS} FROM categorias
    WHERE empresa_id = ?
    ORDER BY COALESCE(parent_id, ''), ordem, nome
  `).all(empresaId) as Record<string, unknown>[]
  return rows.map(rowToCategoria)
}

/** Lista categorias em formato de árvore (grupos com children) */
export function listCategoriasTree(empresaId: string): CategoriaTreeNode[] {
  const flat = listCategorias(empresaId)
  const byId = new Map<string, CategoriaTreeNode>()
  flat.forEach((c) => byId.set(c.id, { ...c, children: [] }))
  const roots: CategoriaTreeNode[] = []
  flat.forEach((c) => {
    const node = byId.get(c.id)!
    if (!c.parent_id) {
      roots.push(node)
    } else {
      const parent = byId.get(c.parent_id)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
  })
  roots.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
  roots.forEach((r) => sortChildren(r))
  return roots
}

function sortChildren(node: CategoriaTreeNode): void {
  node.children.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
  node.children.forEach(sortChildren)
}

/** Retorna apenas categorias folha (sem filhos) para associar a produtos */
export function listCategoriasFolha(empresaId: string): Categoria[] {
  const all = listCategorias(empresaId)
  const parentIds = new Set(all.map((c) => c.parent_id).filter(Boolean) as string[])
  return all.filter((c) => !parentIds.has(c.id))
}

export function getCategoriaById(id: string): Categoria | null {
  const db = getDb()
  if (!db) return null
  const row = db.prepare(`SELECT ${COLS} FROM categorias WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  return row ? rowToCategoria(row) : null
}

/** Retorna o caminho da categoria até a raiz (raiz primeiro, folha por último) para sync. */
export function getCategoriaPathForSync(id: string): Categoria[] {
  const path: Categoria[] = []
  let current: Categoria | null = getCategoriaById(id)
  while (current) {
    path.unshift(current)
    current = current.parent_id ? getCategoriaById(current.parent_id) : null
  }
  return path
}

export type CreateCategoriaInput = {
  empresa_id: string
  nome: string
  parent_id?: string | null
  ordem?: number
  ativo?: number
}

export function createCategoria(data: CreateCategoriaInput): Categoria {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  let nivel = 1
  let ordem = data.ordem ?? 0
  if (data.parent_id) {
    const parent = getCategoriaById(data.parent_id)
    if (!parent) throw new Error('Categoria pai não encontrada')
    if (parent.empresa_id !== data.empresa_id) throw new Error('Categoria pai de outra empresa')
    nivel = parent.nivel + 1
    if (nivel > MAX_NIVEL) throw new Error(`Máximo de ${MAX_NIVEL} níveis (grupo → categoria → subcategoria)`)
    if (ordem === 0) {
      const siblings = db.prepare(`
        SELECT COALESCE(MAX(ordem), 0) + 1 AS next FROM categorias WHERE parent_id = ? AND empresa_id = ?
      `).get(data.parent_id, data.empresa_id) as { next: number }
      ordem = siblings?.next ?? 1
    }
  } else {
    if (ordem === 0) {
      const roots = db.prepare(`
        SELECT COALESCE(MAX(ordem), 0) + 1 AS next FROM categorias WHERE empresa_id = ? AND parent_id IS NULL
      `).get(data.empresa_id) as { next: number }
      ordem = roots?.next ?? 1
    }
  }
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO categorias (id, empresa_id, nome, parent_id, nivel, ordem, ativo, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.empresa_id,
    data.nome.trim(),
    data.parent_id?.trim() || null,
    nivel,
    ordem,
    data.ativo ?? 1,
    now
  )
  const row = db.prepare(`SELECT ${COLS} FROM categorias WHERE id = ?`).get(id) as Record<string, unknown>
  const categoria = rowToCategoria(row)
  addToOutbox('categorias', id, 'CREATE', categoria as unknown as Record<string, unknown>)
  return categoria
}

export type UpdateCategoriaInput = {
  nome?: string
  ordem?: number
  ativo?: number
}

export function updateCategoria(id: string, data: UpdateCategoriaInput): Categoria | null {
  const db = getDb()
  if (!db) return null
  const current = getCategoriaById(id)
  if (!current) return null
  db.prepare(`
    UPDATE categorias SET
      nome = COALESCE(?, nome),
      ordem = COALESCE(?, ordem),
      ativo = COALESCE(?, ativo)
    WHERE id = ?
  `).run(
    data.nome !== undefined ? data.nome.trim() : null,
    data.ordem !== undefined ? data.ordem : null,
    data.ativo !== undefined ? data.ativo : null,
    id
  )
  const updated = getCategoriaById(id)
  if (updated) addToOutbox('categorias', id, 'UPDATE', updated as unknown as Record<string, unknown>)
  return updated
}

/** Remove categoria. Falha se tiver filhos ou produtos associados. */
export function deleteCategoria(id: string): boolean {
  const db = getDb()
  if (!db) return false
  const hasChildren = db.prepare('SELECT 1 FROM categorias WHERE parent_id = ? LIMIT 1').get(id)
  if (hasChildren) return false
  const hasProdutos = db.prepare('SELECT 1 FROM produtos WHERE categoria_id = ? LIMIT 1').get(id)
  if (hasProdutos) return false
  const result = db.prepare('DELETE FROM categorias WHERE id = ?').run(id)
  if (result.changes > 0) addToOutbox('categorias', id, 'DELETE', { id })
  return result.changes > 0
}

/** Retorna o caminho completo da categoria (ex: "Eletrônicos > Celulares > iPhone") */
export function getCategoriaPath(id: string): string {
  const parts: string[] = []
  let current: Categoria | null = getCategoriaById(id)
  while (current) {
    parts.unshift(current.nome)
    current = current.parent_id ? getCategoriaById(current.parent_id) : null
  }
  return parts.join(' → ')
}
