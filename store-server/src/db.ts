import { Pool, PoolClient } from 'pg'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    const conn = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/agiliza_pdv'
    pool = new Pool({ connectionString: conn, max: 10 })
  }
  return pool
}

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const res = await getPool().query(text, params)
  return (res.rows as T[]) || []
}

export async function queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}

export async function run(text: string, params?: unknown[]): Promise<void> {
  await getPool().query(text, params)
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

/** Run schema SQL (idempotent). Executa todos os arquivos *.sql em schema/ em ordem. */
export async function runSchema(): Promise<void> {
  const schemaDir = existsSync(join(__dirname, 'schema'))
    ? join(__dirname, 'schema')
    : join(__dirname, '..', 'schema')
  const files = readdirSync(schemaDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const filename of files) {
    const sql = readFileSync(join(schemaDir, filename), 'utf-8')
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.replace(/--[^\n]*/g, '').trim())
      .filter((s) => s.length > 0)
    for (const st of statements) {
      const statement = st.endsWith(';') ? st : st + ';'
      try {
        await getPool().query(statement)
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string }
        if (err?.code === '42P07') continue // relation already exists
        if (err?.code === '42710') continue // duplicate index
        if (err?.code === '42701') continue // duplicate column
        throw e
      }
    }
  }
}
