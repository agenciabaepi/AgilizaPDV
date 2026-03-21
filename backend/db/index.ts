import Database from 'better-sqlite3'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

let db: Database.Database | null = null
let dbFilePath: string | null = null

/**
 * Inicializa o banco SQLite e executa migrations pendentes.
 * @param dbPath - Pasta onde criar pdv.db (ex.: app.getPath('userData'))
 * @param migrationsDir - Pasta das migrations (ex.: join(app.getAppPath(), 'backend', 'db', 'migrations'))
 */
export function initDb(dbPath: string, migrationsDir?: string): Database.Database {
  if (db) {
    return db
  }
  const fullPath = join(dbPath, 'pdv.db')
  dbFilePath = fullPath
  db = new Database(fullPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  const dir = migrationsDir ?? join(__dirname, 'migrations')
  runMigrations(db, dir)
  return db
}

/** Quebra script SQL em statements (uma linha pode terminar com `;`). */
function splitSqlStatements(sql: string): string[] {
  const lines = sql.split(/\r?\n/)
  let chunk = ''
  const statements: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('--')) continue
    chunk += (chunk ? '\n' : '') + line
    if (trimmed.endsWith(';')) {
      const stmt = chunk.trim()
      chunk = ''
      if (stmt) statements.push(stmt)
    }
  }
  if (chunk.trim()) statements.push(chunk.trim())
  return statements
}

function fornecedoresColumnNames(database: Database.Database): Set<string> {
  const rows = database.prepare('PRAGMA table_info(fornecedores)').all() as { name: string }[]
  return new Set(rows.map((r) => r.name.toLowerCase()))
}

/**
 * Migração 020: evita 100% "duplicate column" no Windows/Mac consultando PRAGMA antes de cada ADD.
 * Mantém fallback por mensagem para qualquer ADD que escape do padrão.
 */
function execFornecedores020Migration(database: Database.Database, sql: string): void {
  const existing = fornecedoresColumnNames(database)
  const statements = splitSqlStatements(sql)
  const addCol = /^ALTER\s+TABLE\s+fornecedores\s+ADD\s+COLUMN\s+(\w+)/i

  for (const stmt of statements) {
    const m = stmt.match(addCol)
    if (m) {
      const col = m[1].toLowerCase()
      if (existing.has(col)) continue
      database.exec(stmt)
      existing.add(col)
      continue
    }
    try {
      database.exec(stmt)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/duplicate column/i.test(msg)) continue
      throw e
    }
  }
}

function runMigrations(database: Database.Database, migrationsDir: string): void {
  if (!existsSync(migrationsDir)) return
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `)
  const applied = new Set(
    (database.prepare('SELECT filename FROM _migrations').all() as { filename: string }[]).map((r) => r.filename)
  )
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  const insert = database.prepare('INSERT INTO _migrations (filename) VALUES (?)')
  for (const filename of files) {
    if (applied.has(filename)) continue
    const sql = readFileSync(join(migrationsDir, filename), 'utf-8')
    if (filename === '020_fornecedores_completo.sql') {
      execFornecedores020Migration(database, sql)
    } else {
      database.exec(sql)
    }
    insert.run(filename)
  }
}

/**
 * Retorna a instância do banco (após initDb). Null se não inicializado.
 */
export function getDb(): Database.Database | null {
  return db
}

/**
 * Fecha a conexão. Chamar ao encerrar o app.
 */
export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
  dbFilePath = null
}

/**
 * Retorna o caminho completo do arquivo pdv.db (após initDb). Null se não inicializado.
 */
export function getDbPath(): string | null {
  return dbFilePath
}

export type { Database }
