import { getDb } from './db'

const SYNC_CLOCK_ID = 1

/** Retorna o timestamp da última alteração local (ISO) ou null se nunca foi setado. */
export function getLastLocalUpdate(): string | null {
  const db = getDb()
  if (!db) return null
  const row = db.prepare('SELECT last_local_update FROM sync_clock WHERE id = ?').get(SYNC_CLOCK_ID) as
    | { last_local_update: string | null }
    | undefined
  return row?.last_local_update ?? null
}

/** Define o relógio local (ex.: após um pull do Supabase). */
export function setLastLocalUpdate(isoTimestamp: string): void {
  const db = getDb()
  if (!db) return
  db.prepare('UPDATE sync_clock SET last_local_update = ? WHERE id = ?').run(isoTimestamp, SYNC_CLOCK_ID)
}

/** Atualiza o relógio local para "agora" — chamar após cada escrita em empresas, produtos, vendas, categorias. */
export function updateSyncClock(): void {
  const db = getDb()
  if (!db) return
  const now = new Date().toISOString()
  db.prepare('UPDATE sync_clock SET last_local_update = ? WHERE id = ?').run(now, SYNC_CLOCK_ID)
}
