import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

const ROUTES = {
  assinaturas: ['status', 'checkout', 'webhook', 'planos'] as const,
  saas: ['login', 'empresas', 'empresa', 'assinatura-update', 'recursos-update', 'planos', 'planos-update', 'empresa-excluir'] as const,
  lojaOnline: ['pagamentos-disponiveis', 'criar-pagamento', 'status-pagamento', 'webhook-asaas', 'webhook-mercadopago', 'calcular-frete', 'validar-cupom', 'processar-pagamento-mp', 'sincronizar-pagamentos'] as const,
}

const LOJA_ONLINE_GET = new Set(['pagamentos-disponiveis', 'status-pagamento', 'webhook-mercadopago', 'sincronizar-pagamentos'])

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (!raw) {
        resolvePromise({})
        return
      }
      try {
        resolvePromise(JSON.parse(raw))
      } catch {
        reject(new Error('JSON inválido'))
      }
    })
    req.on('error', reject)
  })
}

function applyAssinaturasEnv(env: Record<string, string>): void {
  const keys = [
    'ASAAS_API_KEY',
    'ASAAS_API_BASE',
    'ASAAS_WEBHOOK_TOKEN',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'ASSINATURA_VALOR_MENSAL',
    'ASSINATURA_TRIAL_DIAS',
    'SAAS_ADMIN_EMAIL',
    'SAAS_ADMIN_PASSWORD',
    'SAAS_ADMIN_TOKEN',
    'MELHOR_ENVIO_TOKEN',
    'MELHOR_ENVIO_SANDBOX',
  ] as const

  for (const key of keys) {
    const value = env[key]
    if (!value) continue
    if (key === 'SUPABASE_SERVICE_ROLE_KEY' && isPlaceholderEnv(value)) continue
    process.env[key] = value
  }

  function isPlaceholderEnv(value: string): boolean {
    const v = value.trim().toLowerCase()
    return (
      v.includes('sua-service-role-key') ||
      v.includes('token-longo-aleatorio') ||
      v.includes('sua-chave-anon') ||
      v.includes('seu-projeto') ||
      v.length < 20
    )
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''
  }
  if (!process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = env.VITE_SUPABASE_URL || ''
  }
}

async function handleApiRequest(
  server: ViteDevServer,
  req: IncomingMessage,
  res: ServerResponse,
  apiGroup: 'assinaturas' | 'saas' | 'loja-online',
  route: string,
  env: Record<string, string>
): Promise<void> {
  const method = req.method ?? 'GET'
  const isGetOk = apiGroup === 'loja-online' && LOJA_ONLINE_GET.has(route) && method === 'GET'
  if (method !== 'POST' && !isGetOk) {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: false, error: 'Método não permitido.' }))
    return
  }

  applyAssinaturasEnv(env)

  try {
    const body = method === 'GET' ? {} : await readJsonBody(req)
    const apiRoot = resolve(server.config.root, `../api/${apiGroup}`)
    const mod = await server.ssrLoadModule(resolve(apiRoot, `_handlers/${route}.ts`))

    let statusCode = 200
    const vercelRes = {
      status(code: number) {
        statusCode = code
        return vercelRes
      },
      json(payload: unknown) {
        res.statusCode = statusCode
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(payload))
      },
    }

    const vercelReq = {
      method: req.method,
      headers: req.headers,
      body,
      query: Object.fromEntries(new URL(req.url ?? '', 'http://localhost').searchParams),
    }

    await mod.default(vercelReq, vercelRes)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[${apiGroup}-dev]`, route, msg)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: false, error: msg }))
  }
}

export function assinaturasDevApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'agiliza-assinaturas-dev-api',
    configureServer(server) {
      applyAssinaturasEnv(env)

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''

        if (url.startsWith('/api/assinaturas/')) {
          const route = url.replace('/api/assinaturas/', '').replace(/\?.*$/, '')
          if (!ROUTES.assinaturas.includes(route as (typeof ROUTES.assinaturas)[number])) return next()
          await handleApiRequest(server, req, res, 'assinaturas', route, env)
          return
        }

        if (url.startsWith('/api/saas/')) {
          const route = url.replace('/api/saas/', '').replace(/\?.*$/, '')
          if (!ROUTES.saas.includes(route as (typeof ROUTES.saas)[number])) return next()
          await handleApiRequest(server, req, res, 'saas', route, env)
          return
        }

        if (url.startsWith('/api/loja-online/')) {
          const route = url.replace('/api/loja-online/', '').replace(/\?.*$/, '')
          if (!ROUTES.lojaOnline.includes(route as (typeof ROUTES.lojaOnline)[number])) return next()
          await handleApiRequest(server, req, res, 'loja-online', route, env)
          return
        }

        return next()
      })
    },
  }
}
