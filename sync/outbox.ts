import { randomUUID } from 'crypto'
import { getDb } from '../backend/db'

export type OutboxEntry = {
  id: string
  entity: string
  entity_id: string
  operation: string
  payload_json: string
  status: 'PENDING' | 'SENT' | 'ERROR'
  attempts: number
  created_at: string
}

export function addToOutbox(
  entity: string,
  entityId: string,
  operation: string,
  payload: Record<string, unknown>
): void {
  const db = getDb()
  if (!db) return
  const id = randomUUID()
  db.prepare(`
    INSERT INTO sync_outbox (id, entity, entity_id, operation, payload_json, status, attempts)
    VALUES (?, ?, ?, ?, ?, 'PENDING', 0)
  `).run(id, entity, entityId, operation, JSON.stringify(payload))
}

export function getPending(limit = 100): OutboxEntry[] {
  const db = getDb()
  if (!db) return []
  const rows = db.prepare(`
    SELECT id, entity, entity_id, operation, payload_json, status, attempts, created_at
    FROM sync_outbox WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT ?
  `).all(limit) as Record<string, unknown>[]
  return rows.map((r) => ({
    id: r.id as string,
    entity: r.entity as string,
    entity_id: r.entity_id as string,
    operation: r.operation as string,
    payload_json: r.payload_json as string,
    status: r.status as OutboxEntry['status'],
    attempts: (r.attempts as number) ?? 0,
    created_at: r.created_at as string
  }))
}

export function markSent(id: string): void {
  const db = getDb()
  if (!db) return
  db.prepare('UPDATE sync_outbox SET status = ?, attempts = attempts + 1 WHERE id = ?').run('SENT', id)
}

export function markError(id: string): void {
  const db = getDb()
  if (!db) return
  db.prepare('UPDATE sync_outbox SET status = ?, attempts = attempts + 1 WHERE id = ?').run('ERROR', id)
}

/** Incrementa tentativas mas mantém PENDING (para retry depois); use quando falhar mas quiser tentar de novo. */
export function incrementAttempts(id: string): void {
  const db = getDb()
  if (!db) return
  db.prepare('UPDATE sync_outbox SET attempts = attempts + 1 WHERE id = ?').run(id)
}

export function getPendingCount(): number {
  const db = getDb()
  if (!db) return 0
  const row = db.prepare('SELECT COUNT(*) AS c FROM sync_outbox WHERE status = ?').get('PENDING') as { c: number }
  return row.c
}

export function getErrorCount(): number {
  const db = getDb()
  if (!db) return 0
  const row = db.prepare('SELECT COUNT(*) AS c FROM sync_outbox WHERE status = ?').get('ERROR') as { c: number }
  return row.c
}

/** Marca todos os eventos com erro como PENDING e zera tentativas, para tentar enviar de novo. */
export function resetErrorsToPending(): void {
  const db = getDb()
  if (!db) return
  db.prepare('UPDATE sync_outbox SET status = ?, attempts = 0 WHERE status = ?').run('PENDING', 'ERROR')
}
