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
    database.exec(sql)
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
