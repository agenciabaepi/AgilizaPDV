import type { VercelRequest, VercelResponse } from '@vercel/node'

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void

const LOADERS: Record<string, () => Promise<{ default: Handler }>> = {
  'pagamentos-disponiveis': () => import('./_handlers/pagamentos-disponiveis'),
  'criar-pagamento': () => import('./_handlers/criar-pagamento'),
  'status-pagamento': () => import('./_handlers/status-pagamento'),
  'webhook-asaas': () => import('./_handlers/webhook-asaas'),
  'webhook-mercadopago': () => import('./_handlers/webhook-mercadopago'),
  'calcular-frete': () => import('./_handlers/calcular-frete'),
  'melhor-envio-auth': () => import('./_handlers/melhor-envio-auth'),
  'melhor-envio-callback': () => import('./_handlers/melhor-envio-callback'),
  'gerar-etiqueta': () => import('./_handlers/gerar-etiqueta'),
  'validar-cupom': () => import('./_handlers/validar-cupom'),
  'processar-pagamento-mp': () => import('./_handlers/processar-pagamento-mp'),
  'sincronizar-pagamentos': () => import('./_handlers/sincronizar-pagamentos'),
  sitemap: () => import('./_handlers/sitemap'),
  robots: () => import('./_handlers/robots'),
  'og-preview': () => import('./_handlers/og-preview'),
  'enviar-email-pedido': () => import('./_handlers/enviar-email-pedido'),
  dominio: () => import('./_handlers/dominio'),
  track: () => import('./_handlers/track'),
  'meta-auth': () => import('./_handlers/meta-auth'),
  'meta-callback': () => import('./_handlers/meta-callback'),
  'meta-status': () => import('./_handlers/meta-status'),
  'meta-select-account': () => import('./_handlers/meta-select-account'),
  'meta-insights': () => import('./_handlers/meta-insights'),
  'meta-disconnect': () => import('./_handlers/meta-disconnect'),
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
