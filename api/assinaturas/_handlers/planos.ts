import type { VercelRequest, VercelResponse } from '@vercel/node'
import { loadPlanosPublic } from '../_lib/planos-service'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  try {
    const planos = await loadPlanosPublic()
    res.status(200).json({ ok: true, planos })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: msg })
  }
}
