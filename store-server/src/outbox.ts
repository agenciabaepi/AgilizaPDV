import { randomUUID } from 'crypto'
import { query, queryOne, run } from './db'

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

export async function addToOutbox(
  entity: string,
  entityId: string,
  operation: string,
  payload: Record<string, unknown>
): Promise<void> {
  const id = randomUUID()
  await run(
    `INSERT INTO sync_outbox (id, entity, entity_id, operation, payload_json, status, attempts)
     VALUES ($1, $2, $3, $4, $5, 'PENDING', 0)`,
    [id, entity, entityId, operation, JSON.stringify(payload)]
  )
}

export async function getPending(limit = 100): Promise<OutboxEntry[]> {
  const rows = await query<OutboxEntry>(
    `SELECT id, entity, entity_id, operation, payload_json, status, attempts, created_at
     FROM sync_outbox WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT $1`,
    [limit]
  )
  return rows
}

export async function markSent(id: string): Promise<void> {
  await run(
    `UPDATE sync_outbox SET status = 'SENT', attempts = attempts + 1 WHERE id = $1`,
    [id]
  )
}

export async function markError(id: string): Promise<void> {
  await run(
    `UPDATE sync_outbox SET status = 'ERROR', attempts = attempts + 1 WHERE id = $1`,
    [id]
  )
}

export async function incrementAttempts(id: string): Promise<void> {
  await run(`UPDATE sync_outbox SET attempts = attempts + 1 WHERE id = $1`, [id])
}

export async function getPendingCount(): Promise<number> {
  const row = await queryOne<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM sync_outbox WHERE status = 'PENDING'`
  )
  return row ? parseInt(row.c, 10) : 0
}

export async function getErrorCount(): Promise<number> {
  const row = await queryOne<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM sync_outbox WHERE status = 'ERROR'`
  )
  return row ? parseInt(row.c, 10) : 0
}

export async function resetErrorsToPending(): Promise<void> {
  await run(`UPDATE sync_outbox SET status = 'PENDING', attempts = 0 WHERE status = 'ERROR'`)
}
