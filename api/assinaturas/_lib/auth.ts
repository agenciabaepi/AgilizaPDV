import type { VercelRequest } from '@vercel/node'

export type SessionPayload = {
  id: string
  empresa_id: string
  role?: string
  suporte?: boolean
}

export function parseSession(req: VercelRequest): SessionPayload | null {
  const raw = req.headers['x-agiliza-session']
  if (!raw || typeof raw !== 'string') return null
  try {
    const json = Buffer.from(raw, 'base64').toString('utf8')
    const s = JSON.parse(json) as SessionPayload
    if (!s?.id || !s?.empresa_id) return null
    return s
  } catch {
    return null
  }
}

export function requireTenantSession(req: VercelRequest, empresaId: string): SessionPayload | string {
  const session = parseSession(req)
  if (!session) return 'Sessão inválida. Faça login novamente.'
  if (session.suporte) return 'Acesso de suporte não permitido neste endpoint.'
  if (session.empresa_id !== empresaId) return 'Empresa não autorizada para esta sessão.'
  return session
}

export function requireAdminSession(req: VercelRequest, empresaId: string): SessionPayload | string {
  const session = requireTenantSession(req, empresaId)
  if (typeof session === 'string') return session
  const role = (session.role ?? '').toLowerCase()
  if (role !== 'admin' && role !== 'gerente') {
    return 'Apenas administradores ou gerentes podem gerenciar a assinatura.'
  }
  return session
}
