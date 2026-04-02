import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

function parseEnvLine(text: string, key: string): string | null {
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const m = t.match(new RegExp(`^${key}\\s*=\\s*(.*)$`, 'i'))
    if (!m) continue
    let v = m[1].trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    return v || null
  }
  return null
}

function readDatabaseUrlFromFile(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null
    return parseEnvLine(readFileSync(filePath, 'utf-8'), 'DATABASE_URL')
  } catch {
    return null
  }
}

/**
 * Mesma precedência de `store-server.env` que em `main.ts` (modo --store-server):
 * Windows empacotado: ProgramData sobrescreve userData; caso contrário userData sobrescreve ProgramData.
 * Também honra `process.env.DATABASE_URL` (ex.: dev).
 */
export function getStoreServerDatabaseUrl(): string | null {
  const fromProcess = process.env.DATABASE_URL?.trim()
  if (fromProcess) return fromProcess

  const programData =
    process.platform === 'win32'
      ? join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'AgilizaPDV', 'store-server.env')
      : null
  const userData = join(app.getPath('userData'), 'store-server.env')

  const u = readDatabaseUrlFromFile(userData)
  const p = programData ? readDatabaseUrlFromFile(programData) : null

  if (app.isPackaged && process.platform === 'win32') {
    return p || u
  }
  return u || p
}

/** Fallback alinhado ao default do store-server (`db.ts`). */
export function resolvePostgresConnectionString(): string {
  return (
    getStoreServerDatabaseUrl()?.trim() ||
    'postgresql://postgres:postgres@localhost:5432/agiliza_pdv'
  )
}
