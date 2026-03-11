import { randomUUID } from 'crypto'
import { Request } from 'express'

export type SessionUser = {
  empresa_id: string
  id: string
  nome: string
  login: string
  role: string
  modulos_json?: string | null
}

const sessions = new Map<string, SessionUser>()

export function createSession(user: SessionUser): string {
  const sessionId = randomUUID()
  sessions.set(sessionId, user)
  return sessionId
}

export function getSession(sessionId: string | undefined): SessionUser | null {
  if (!sessionId) return null
  return sessions.get(sessionId) ?? null
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId)
}

export function getBearerToken(req: Request): string | undefined {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return undefined
  return auth.slice(7).trim() || undefined
}

export function requireAuth(req: Request): SessionUser {
  const token = getBearerToken(req)
  const user = getSession(token)
  if (!user) {
    const err = new Error('Não autorizado')
    ;(err as unknown as { statusCode: number }).statusCode = 401
    throw err
  }
  return user
}
