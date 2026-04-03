import Database from 'better-sqlite3'
import { existsSync } from 'fs'
import type { PoolClient } from 'pg'
import { Pool } from 'pg'

const ALLOWED_TABLES = new Set([
  'empresas',
  'empresas_config',
  'usuarios',
  'categorias',
  'fornecedores',
  'marcas',
  'produtos',
  'clientes',
  'estoque_movimentos',
  'caixas',
  'caixa_movimentos',
  'vendas',
  'venda_itens',
  'pagamentos',
  'contas_receber',
])

type TableStep = {
  table: string
  /** Colunas usadas em ON CONFLICT */
  conflictTarget: string[]
  /** Como filtrar linhas no SQLite */
  filterMode: 'empresa_id' | 'empresa_pk'
  orderBy?: string
}

/** Tabelas cujo import pode referenciar usuarios.id (órfãos no SQLite quebram FK no Postgres). */
const TABLES_WITH_USUARIO_FK = new Set([
  'estoque_movimentos',
  'caixas',
  'caixa_movimentos',
  'vendas',
  'contas_receber',
])

type UsuarioFkCache = { validIds: Set<string>; fallbackUsuarioId: string | null }

async function loadUsuarioFkCache(client: PoolClient, empresaId: string): Promise<UsuarioFkCache> {
  const { rows } = await client.query<{ id: string; role: string }>(
    `SELECT id, role FROM usuarios WHERE empresa_id = $1`,
    [empresaId]
  )
  const validIds = new Set(rows.map((r) => r.id))
  const admin = rows.find((r) => r.role === 'admin')
  const fallbackUsuarioId = admin?.id ?? rows[0]?.id ?? null
  return { validIds, fallbackUsuarioId }
}

/**
 * Ajusta usuario_id (e similares) quando o SQLite guarda movimento de usuário já excluído ou inconsistente.
 * - estoque_movimentos.usuario_id é nullable → NULL se inválido
 * - caixas / caixa_movimentos / vendas → NOT NULL: usa primeiro admin (ou qualquer usuário da empresa)
 * - contas_receber.usuario_recebimento_id nullable → NULL se inválido
 */
function sanitizeUsuarioFksForImportRow(
  table: string,
  row: Record<string, unknown>,
  cache: UsuarioFkCache,
  pgCols: Set<string>
): void {
  const idOk = (id: unknown): boolean => {
    if (id == null || id === '') return false
    return cache.validIds.has(String(id))
  }

  if (table === 'estoque_movimentos' && pgCols.has('usuario_id')) {
    const u = row.usuario_id
    if (u != null && u !== '' && !idOk(u)) row.usuario_id = null
    return
  }

  const coerceRequiredUsuario = (col: string) => {
    if (!pgCols.has(col)) return
    if (idOk(row[col])) return
    if (cache.fallbackUsuarioId) row[col] = cache.fallbackUsuarioId
  }

  if (table === 'caixas') coerceRequiredUsuario('usuario_id')
  else if (table === 'caixa_movimentos') coerceRequiredUsuario('usuario_id')
  else if (table === 'vendas') coerceRequiredUsuario('usuario_id')
  else if (table === 'contas_receber' && pgCols.has('usuario_recebimento_id')) {
    const u = row.usuario_recebimento_id
    if (u != null && u !== '' && !idOk(u)) row.usuario_recebimento_id = null
  }
}

const IMPORT_STEPS: TableStep[] = [
  { table: 'empresas', conflictTarget: ['id'], filterMode: 'empresa_pk' },
  { table: 'empresas_config', conflictTarget: ['empresa_id'], filterMode: 'empresa_id' },
  { table: 'usuarios', conflictTarget: ['id'], filterMode: 'empresa_id' },
  { table: 'categorias', conflictTarget: ['id'], filterMode: 'empresa_id', orderBy: 'nivel ASC, ordem ASC, id ASC' },
  { table: 'fornecedores', conflictTarget: ['id'], filterMode: 'empresa_id' },
  { table: 'marcas', conflictTarget: ['id'], filterMode: 'empresa_id' },
  { table: 'produtos', conflictTarget: ['id'], filterMode: 'empresa_id' },
  { table: 'clientes', conflictTarget: ['id'], filterMode: 'empresa_id' },
  { table: 'estoque_movimentos', conflictTarget: ['id'], filterMode: 'empresa_id' },
  { table: 'caixas', conflictTarget: ['id'], filterMode: 'empresa_id' },
  { table: 'caixa_movimentos', conflictTarget: ['id'], filterMode: 'empresa_id' },
  { table: 'vendas', conflictTarget: ['id'], filterMode: 'empresa_id' },
  { table: 'venda_itens', conflictTarget: ['id'], filterMode: 'empresa_id' },
  { table: 'pagamentos', conflictTarget: ['id'], filterMode: 'empresa_id' },
  { table: 'contas_receber', conflictTarget: ['id'], filterMode: 'empresa_id' },
]

export type SqliteEmpresaRow = { id: string; nome: string }

export type ImportSqliteResult = {
  ok: boolean
  error?: string
  databaseUrlPreview?: string
  imported?: Record<string, Record<string, number>>
  empresaErrors?: Record<string, string>
}

function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k.toLowerCase()] = v
  }
  return out
}

function sqliteHasTable(db: Database.Database, name: string): boolean {
  const r = db
    .prepare(`SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(name) as { x: number } | undefined
  return !!r
}

async function loadPgTableColumns(client: PoolClient, table: string): Promise<Set<string> | null> {
  if (!ALLOWED_TABLES.has(table)) return null
  const res = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  )
  if (res.rows.length === 0) return null
  return new Set(res.rows.map((r) => r.column_name.toLowerCase()))
}

async function pgTableExists(client: PoolClient, table: string): Promise<boolean> {
  const res = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [table]
  )
  return res.rows[0]?.exists === true
}

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Identificador inválido: ${name}`)
  }
  return `"${name}"`
}

async function upsertRow(
  client: PoolClient,
  table: string,
  pgCols: Set<string>,
  conflictTarget: string[],
  raw: Record<string, unknown>
): Promise<void> {
  const row = normalizeRowKeys(raw)
  const cols: string[] = []
  for (const c of pgCols) {
    if (!Object.prototype.hasOwnProperty.call(row, c)) continue
    if (row[c] === undefined) continue
    cols.push(c)
  }
  for (const k of conflictTarget) {
    if (!cols.includes(k)) return
  }
  if (cols.length === 0) return
  const values = cols.map((c) => row[c])
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
  const colList = cols.map((c) => quoteIdent(c)).join(', ')
  const conflictCols = conflictTarget.map((c) => quoteIdent(c)).join(', ')
  const updateCols = cols.filter((c) => !conflictTarget.includes(c))
  const setClause =
    updateCols.length > 0
      ? updateCols.map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`).join(', ')
      : ''
  const sql =
    setClause.length > 0
      ? `INSERT INTO ${quoteIdent(table)} (${colList}) VALUES (${placeholders})
         ON CONFLICT (${conflictCols}) DO UPDATE SET ${setClause}`
      : `INSERT INTO ${quoteIdent(table)} (${colList}) VALUES (${placeholders})
         ON CONFLICT (${conflictCols}) DO NOTHING`
  await client.query(sql, values as unknown[])
}

export function listEmpresasFromSqliteFile(sqlitePath: string): { ok: true; empresas: SqliteEmpresaRow[] } | { ok: false; error: string } {
  try {
    if (!existsSync(sqlitePath)) {
      return { ok: false, error: `Arquivo não encontrado: ${sqlitePath}` }
    }
    const db = new Database(sqlitePath, { readonly: true, fileMustExist: true })
    try {
      if (!sqliteHasTable(db, 'empresas')) {
        return { ok: false, error: 'O arquivo não contém a tabela empresas.' }
      }
      const rows = db
        .prepare('SELECT id, nome FROM empresas ORDER BY nome COLLATE NOCASE')
        .all() as SqliteEmpresaRow[]
      return { ok: true, empresas: rows }
    } finally {
      db.close()
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

async function importOneEmpresa(
  sqlite: Database.Database,
  client: PoolClient,
  empresaId: string,
  colCache: Map<string, Set<string> | null>
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  let usuarioFkCache: UsuarioFkCache | undefined

  for (const step of IMPORT_STEPS) {
    const { table, conflictTarget, filterMode, orderBy } = step
    if (!ALLOWED_TABLES.has(table)) continue
    if (!sqliteHasTable(sqlite, table)) {
      counts[table] = 0
      continue
    }

    const pgExists = await pgTableExists(client, table)
    if (!pgExists) {
      counts[table] = 0
      continue
    }

    let pgCols = colCache.get(table)
    if (pgCols === undefined) {
      pgCols = await loadPgTableColumns(client, table)
      colCache.set(table, pgCols)
    }
    if (!pgCols || pgCols.size === 0) {
      counts[table] = 0
      continue
    }

    let rows: Record<string, unknown>[]
    if (filterMode === 'empresa_pk') {
      rows = sqlite.prepare('SELECT * FROM empresas WHERE id = ?').all(empresaId) as Record<string, unknown>[]
    } else {
      const ob = orderBy ? ` ORDER BY ${orderBy}` : ''
      rows = sqlite
        .prepare(`SELECT * FROM ${table} WHERE empresa_id = ?${ob}`)
        .all(empresaId) as Record<string, unknown>[]
    }

    if (TABLES_WITH_USUARIO_FK.has(table) && rows.length > 0) {
      if (!usuarioFkCache) usuarioFkCache = await loadUsuarioFkCache(client, empresaId)
    }

    let n = 0
    for (const raw of rows) {
      const lower = normalizeRowKeys(raw)
      const filtered: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(lower)) {
        if (pgCols!.has(k)) filtered[k] = v
      }
      if (TABLES_WITH_USUARIO_FK.has(table) && usuarioFkCache) {
        sanitizeUsuarioFksForImportRow(table, filtered, usuarioFkCache, pgCols!)
      }
      await upsertRow(client, table, pgCols, conflictTarget, filtered)
      n++
    }
    counts[table] = n
  }

  return counts
}

function maskDatabaseUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.password) u.password = '***'
    return u.toString()
  } catch {
    return '(url inválida)'
  }
}

export async function importPdvSqliteToPostgres(params: {
  sqlitePath: string
  empresaIds: string[]
  databaseUrl: string
}): Promise<ImportSqliteResult> {
  const { sqlitePath, empresaIds, databaseUrl } = params
  if (!empresaIds.length) {
    return { ok: false, error: 'Selecione ao menos uma empresa.' }
  }
  if (!existsSync(sqlitePath)) {
    return { ok: false, error: `Arquivo não encontrado: ${sqlitePath}` }
  }

  const preview = maskDatabaseUrl(databaseUrl)
  const pool = new Pool({ connectionString: databaseUrl, max: 2 })
  const imported: Record<string, Record<string, number>> = {}
  const empresaErrors: Record<string, string> = {}

  const sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true })
  try {
    for (const empresaId of empresaIds) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const colCache = new Map<string, Set<string> | null>()
        const counts = await importOneEmpresa(sqlite, client, empresaId, colCache)
        await client.query('COMMIT')
        imported[empresaId] = counts
      } catch (e) {
        try {
          await client.query('ROLLBACK')
        } catch {
          // ignore
        }
        empresaErrors[empresaId] = e instanceof Error ? e.message : String(e)
      } finally {
        client.release()
      }
    }
  } finally {
    sqlite.close()
    await pool.end()
  }

  const ok = Object.keys(empresaErrors).length === 0
  if (!ok && Object.keys(imported).length === 0) {
    const first = empresaIds.find((id) => empresaErrors[id])
    return {
      ok: false,
      error: first ? empresaErrors[first] : 'Falha na importação.',
      databaseUrlPreview: preview,
      empresaErrors,
    }
  }

  return {
    ok: Object.keys(empresaErrors).length === 0,
    databaseUrlPreview: preview,
    imported,
    empresaErrors: Object.keys(empresaErrors).length ? empresaErrors : undefined,
  }
}
