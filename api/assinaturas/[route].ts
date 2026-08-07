import type { VercelRequest, VercelResponse } from '@vercel/node'

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void

const LOADERS: Record<string, () => Promise<{ default: Handler }>> = {
  status: () => import('./_handlers/status'),
  checkout: () => import('./_handlers/checkout'),
  webhook: () => import('./_handlers/webhook'),
  planos: () => import('./_handlers/planos'),
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const routeParam = req.query.route
  const route = (Array.isArray(routeParam) ? routeParam[0] : routeParam) ?? ''
  const load = LOADERS[route]
  if (!load) {
    res.status(404).json({ ok: false, error: 'Rota não encontrada.' })
    return
  }
  const mod = await load()
  return mod.default(req, res)
}
