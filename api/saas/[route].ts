import type { VercelRequest, VercelResponse } from '@vercel/node'

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void

const LOADERS: Record<string, () => Promise<{ default: Handler }>> = {
  login: () => import('./_handlers/login'),
  empresas: () => import('./_handlers/empresas'),
  empresa: () => import('./_handlers/empresa'),
  'assinatura-update': () => import('./_handlers/assinatura-update'),
  'recursos-update': () => import('./_handlers/recursos-update'),
  planos: () => import('./_handlers/planos'),
  'planos-update': () => import('./_handlers/planos-update'),
  'empresa-excluir': () => import('./_handlers/empresa-excluir'),
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
