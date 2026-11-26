import type { VercelRequest, VercelResponse } from '@vercel/node'

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void

/** Uma única função na Vercel para as rotas de produtos (economiza o limite de funções do plano). */
const LOADERS: Record<string, () => Promise<{ default: Handler }>> = {
  gtin: () => import('./_handlers/gtin'),
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
