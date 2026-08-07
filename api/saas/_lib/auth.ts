import type { VercelRequest } from '@vercel/node'
import { getSaasAdminToken } from './config'

export function requireSaasAdmin(req: VercelRequest): boolean {
  const token = req.headers['x-saas-admin-token']
  if (!token || typeof token !== 'string') return false
  const expected = getSaasAdminToken()
  if (!expected) return false
  return token === expected
}
