import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }
  const { vendaId, empresaId } = req.body ?? {}
  if (!vendaId || !empresaId) {
    res.status(400).json({ ok: false, error: 'vendaId e empresaId são obrigatórios.' })
    return
  }
  try {
    const { requireAdminSession } = await import('./_lib/auth')
    const auth = requireAdminSession(req, String(empresaId))
    if (typeof auth === 'string') {
      res.status(401).json({ ok: false, error: auth })
      return
    }
    const { emitirNfceWeb } = await import('./_lib/emit')
    const result = await emitirNfceWeb(String(vendaId), String(empresaId))
    res.status(result.ok ? 200 : 422).json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: msg })
  }
}
