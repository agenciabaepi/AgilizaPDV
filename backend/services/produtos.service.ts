import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { addToOutbox } from '../../sync/outbox'

export type Produto = {
  id: string
  empresa_id: string
  codigo: number | null
  nome: string
  sku: string | null
  codigo_barras: string | null
  fornecedor_id: string | null
  categoria_id: string | null
  descricao: string | null
  imagem: string | null
  custo: number
  markup: number
  preco: number
  unidade: string
  controla_estoque: number
  estoque_minimo: number
  ativo: number
  ncm: string | null
  cfop: string | null
  created_at: string
  updated_at: string
}

const COLS = `id, empresa_id, codigo, nome, sku, codigo_barras, fornecedor_id, categoria_id, descricao, imagem, custo, markup, preco, unidade, controla_estoque, estoque_minimo, ativo, ncm, cfop, created_at, updated_at`

function rowToProduto(r: Record<string, unknown>): Produto {
  return {
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    codigo: r.codigo != null ? (r.codigo as number) : null,
    nome: r.nome as string,
    sku: (r.sku as string) ?? null,
    codigo_barras: (r.codigo_barras as string) ?? null,
    fornecedor_id: (r.fornecedor_id as string) ?? null,
    categoria_id: (r.categoria_id as string) ?? null,
    descricao: (r.descricao as string) ?? null,
    imagem: (r.imagem as string) ?? null,
    custo: (r.custo as number) ?? 0,
    markup: (r.markup as number) ?? 0,
    preco: (r.preco as number) ?? 0,
    unidade: (r.unidade as string) ?? 'UN',
    controla_estoque: (r.controla_estoque as number) ?? 1,
    estoque_minimo: (r.estoque_minimo as number) ?? 0,
    ativo: (r.ativo as number) ?? 1,
    ncm: (r.ncm as string) ?? null,
    cfop: (r.cfop as string) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string
  }
}

/** Retorna o próximo código sequencial para a empresa (apenas para novos produtos). */
export function getNextCodigo(empresaId: string): number {
  const db = getDb()
  if (!db) return 1
  const row = db.prepare(`
    SELECT COALESCE(MAX(codigo), 0) + 1 AS next FROM produtos WHERE empresa_id = ?
  `).get(empresaId) as { next: number } | undefined
  return row?.next ?? 1
}

export function listProdutos(
  empresaId: string,
  options?: { search?: string; apenasAtivos?: boolean; ordenarPorMaisVendidos?: boolean }
): Produto[] {
  const db = getDb()
  if (!db) return []
  const params: (string | number)[] = [empresaId]
  let sql: string
  if (options?.ordenarPorMaisVendidos) {
    sql = `
      SELECT p.id, p.empresa_id, p.codigo, p.nome, p.sku, p.codigo_barras, p.fornecedor_id, p.categoria_id, p.descricao, p.imagem, p.custo, p.markup, p.preco, p.unidade, p.controla_estoque, p.estoque_minimo, p.ativo, p.ncm, p.cfop, p.created_at, p.updated_at
      FROM produtos p
      LEFT JOIN (
        SELECT vi.produto_id, SUM(vi.quantidade) AS qty
        FROM venda_itens vi
        INNER JOIN vendas v ON v.id = vi.venda_id AND v.empresa_id = ? AND v.status = 'CONCLUIDA'
        GROUP BY vi.produto_id
      ) s ON s.produto_id = p.id
      WHERE p.empresa_id = ?
    `
    params.push(empresaId)
    if (options?.search?.trim()) {
      sql += ` AND (p.nome LIKE ? OR p.sku LIKE ? OR p.codigo_barras LIKE ? OR p.descricao LIKE ? OR EXISTS (SELECT 1 FROM categorias c WHERE c.id = p.categoria_id AND c.empresa_id = p.empresa_id AND c.nome LIKE ?))`
      const term = `%${options.search.trim()}%`
      params.push(term, term, term, term, term)
    }
    if (options?.apenasAtivos) {
      sql += ` AND p.ativo = 1`
    }
    sql += ` ORDER BY COALESCE(s.qty, 0) DESC, p.nome`
  } else {
    sql = `
      SELECT ${COLS} FROM produtos WHERE empresa_id = ?
    `
    if (options?.search?.trim()) {
      sql += ` AND (nome LIKE ? OR sku LIKE ? OR codigo_barras LIKE ? OR descricao LIKE ? OR EXISTS (SELECT 1 FROM categorias c WHERE c.id = produtos.categoria_id AND c.empresa_id = produtos.empresa_id AND c.nome LIKE ?))`
      const term = `%${options.search.trim()}%`
      params.push(term, term, term, term, term)
    }
    if (options?.apenasAtivos) {
      sql += ` AND ativo = 1`
    }
    sql += ` ORDER BY nome`
  }
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map(rowToProduto)
}

export function getProdutoById(id: string): Produto | null {
  const db = getDb()
  if (!db) return null
  const row = db.prepare(`SELECT ${COLS} FROM produtos WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  return row ? rowToProduto(row) : null
}

export type CreateProdutoInput = {
  empresa_id: string
  nome: string
  sku?: string
  codigo_barras?: string
  fornecedor_id?: string
  categoria_id?: string | null
  descricao?: string
  imagem?: string
  custo?: number
  markup?: number
  preco?: number
  unidade?: string
  controla_estoque?: number
  estoque_minimo?: number
  ativo?: number
  ncm?: string
  cfop?: string
}

export function createProduto(data: CreateProdutoInput): Produto {
  const db = getDb()
  if (!db) throw new Error('Banco não inicializado')
  const id = randomUUID()
  const now = new Date().toISOString()
  const codigo = getNextCodigo(data.empresa_id)
  db.prepare(`
    INSERT INTO produtos (id, empresa_id, codigo, nome, sku, codigo_barras, fornecedor_id, categoria_id, descricao, imagem, custo, markup, preco, unidade, controla_estoque, estoque_minimo, ativo, ncm, cfop, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.empresa_id,
    codigo,
    data.nome.trim(),
    data.sku?.trim() ?? null,
    data.codigo_barras?.trim() ?? null,
    data.fornecedor_id?.trim() || null,
    data.categoria_id?.trim() || null,
    data.descricao?.trim() ?? null,
    data.imagem?.trim() ?? null,
    data.custo ?? 0,
    data.markup ?? 0,
    data.preco ?? 0,
    data.unidade?.trim() ?? 'UN',
    data.controla_estoque ?? 1,
    data.estoque_minimo ?? 0,
    data.ativo ?? 1,
    data.ncm?.trim() ?? null,
    data.cfop?.trim() ?? null,
    now,
    now
  )
  const row = db.prepare(`SELECT ${COLS} FROM produtos WHERE id = ?`).get(id) as Record<string, unknown>
  const produto = rowToProduto(row)
  addToOutbox('produtos', id, 'CREATE', produto)
  return produto
}

export type UpdateProdutoInput = Partial<Omit<CreateProdutoInput, 'empresa_id'>>

export function updateProduto(id: string, data: UpdateProdutoInput): Produto | null {
  const db = getDb()
  if (!db) return null
  const current = getProdutoById(id)
  if (!current) return null
  const now = new Date().toISOString()
  db.prepare(`
    UPDATE produtos SET
      nome = ?, sku = ?, codigo_barras = ?, fornecedor_id = ?, categoria_id = ?, descricao = ?, imagem = ?,
      custo = ?, markup = ?, preco = ?, unidade = ?, controla_estoque = ?, estoque_minimo = ?, ativo = ?,
      ncm = ?, cfop = ?, updated_at = ?
    WHERE id = ?
  `).run(
    data.nome !== undefined ? data.nome.trim() : current.nome,
    data.sku !== undefined ? (data.sku.trim() || null) : current.sku,
    data.codigo_barras !== undefined ? (data.codigo_barras.trim() || null) : current.codigo_barras,
    data.fornecedor_id !== undefined ? (data.fornecedor_id.trim() || null) : current.fornecedor_id,
    data.categoria_id !== undefined ? (data.categoria_id?.trim() || null) : current.categoria_id,
    data.descricao !== undefined ? (data.descricao.trim() || null) : current.descricao,
    data.imagem !== undefined ? (data.imagem.trim() || null) : current.imagem,
    data.custo ?? current.custo,
    data.markup ?? current.markup,
    data.preco ?? current.preco,
    data.unidade?.trim() ?? current.unidade,
    data.controla_estoque ?? current.controla_estoque,
    data.estoque_minimo ?? current.estoque_minimo,
    data.ativo ?? current.ativo,
    data.ncm !== undefined ? (data.ncm.trim() || null) : current.ncm,
    data.cfop !== undefined ? (data.cfop.trim() || null) : current.cfop,
    now,
    id
  )
  const updated = getProdutoById(id)
  if (updated) addToOutbox('produtos', id, 'UPDATE', updated)
  return updated
}
