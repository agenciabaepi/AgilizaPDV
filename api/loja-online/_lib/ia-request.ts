import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdminSession, type SessionPayload } from '../../assinaturas/_lib/auth'

const MAX_PERIODO_DIAS = 180

export function param(req: VercelRequest, name: string): string {
  const fromBody = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>)[name] : undefined
  if (typeof fromBody === 'string') return fromBody.trim()
  const q = req.query[name]
  return String(Array.isArray(q) ? q[0] : q ?? '').trim()
}

/** Valida sessão de admin/gerente da empresa; responde 400/401 e retorna null em caso de erro. */
export function requireIaAdmin(
  req: VercelRequest,
  res: VercelResponse
): { empresaId: string; session: SessionPayload } | null {
  const empresaId = param(req, 'empresaId')
  if (!empresaId) {
    res.status(400).json({ ok: false, error: 'empresaId é obrigatório.' })
    return null
  }
  const session = requireAdminSession(req, empresaId)
  if (typeof session === 'string') {
    res.status(401).json({ ok: false, error: session })
    return null
  }
  return { empresaId, session }
}

export function parsePeriodo(req: VercelRequest): { inicio: string; fim: string } | string {
  const now = new Date()
  const fimRaw = param(req, 'fim')
  const inicioRaw = param(req, 'inicio')
  const fim = fimRaw ? new Date(fimRaw) : now
  const inicio = inicioRaw ? new Date(inicioRaw) : new Date(fim.getTime() - 30 * 86_400_000)
  if (Number.isNaN(fim.getTime()) || Number.isNaN(inicio.getTime())) return 'Período inválido.'
  if (inicio >= fim) return 'A data inicial deve ser anterior à final.'
  if (fim.getTime() - inicio.getTime() > MAX_PERIODO_DIAS * 86_400_000) {
    return `Período máximo de ${MAX_PERIODO_DIAS} dias.`
  }
  return { inicio: inicio.toISOString(), fim: fim.toISOString() }
}
