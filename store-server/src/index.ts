import 'dotenv/config'
import dgram from 'dgram'
import os from 'os'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import Bonjour from 'bonjour-service'
import { runSchema } from './db'
import empresasRoutes from './routes/empresas'
import authRoutes from './routes/auth'
import usuariosRoutes from './routes/usuarios'
import produtosRoutes from './routes/produtos'
import categoriasRoutes from './routes/categorias'
import marcasRoutes from './routes/marcas'
import clientesRoutes from './routes/clientes'
import fornecedoresRoutes from './routes/fornecedores'
import estoqueRoutes from './routes/estoque'
import caixaRoutes from './routes/caixa'
import vendasRoutes from './routes/vendas'
import contasReceberRoutes from './routes/contas-receber'
import syncRoutes from './routes/sync'
import terminaisRoutes from './routes/terminais'
import { registerClient } from './ws'
import { runSync } from './sync-supabase'

const SYNC_INTERVAL_MS = 60 * 1000 // 1 min

/** Mesmo valor que o app Electron envia em broadcast UDP (electron/discovery-constants.ts). */
const AGILIZA_DISCOVER_MESSAGE_V1 = 'AGILIZA_DISCOVER_V1'

function logListeningAddresses(httpPort: number): void {
  const nets = os.networkInterfaces()
  const ips: string[] = []
  for (const addrs of Object.values(nets)) {
    for (const a of addrs || []) {
      const fam = a.family as string | number
      if ((fam !== 'IPv4' && fam !== 4) || a.internal) continue
      if (a.address) ips.push(a.address)
    }
  }
  if (ips.length === 0) {
    console.log(`[agiliza-store] HTTP acessível na LAN em http://0.0.0.0:${httpPort} (nenhum IPv4 encontrado para log)`)
    return
  }
  for (const ip of ips) {
    console.log(`[agiliza-store] HTTP na rede: http://${ip}:${httpPort}`)
  }
}

async function main(): Promise<void> {
  const port = Number(process.env.PORT || 3000)
  const discoveryUdpPort = Number(process.env.AGILIZA_DISCOVERY_UDP_PORT || 41234)

  const ex = express()
  ex.use(cors())

  let schemaOk = false
  let schemaErr: string | null = null

  ex.get('/health', (_req, res) => {
    res.json({ ok: true, db: schemaOk })
  })
  ex.get('/ping', (_req, res) => {
    res.status(200).send('ok')
  })
  ex.get('/status', (_req, res) => {
    res.json({
      listening: true,
      db: schemaOk,
      error: schemaErr,
      port,
      databaseUrlSet: Boolean(process.env.DATABASE_URL?.trim())
    })
  })

  const server = createServer(ex)

  await new Promise<void>((resolve, reject) => {
    server.listen(port, '0.0.0.0', () => resolve()).on('error', reject)
  })
  console.log(`[agiliza-store] HTTP no ar em 0.0.0.0:${port} — teste http://127.0.0.1:${port}/health`)
  logListeningAddresses(port)

  try {
    await runSchema()
    schemaOk = true
    schemaErr = null
    console.log('[agiliza-store] Postgres/schema OK; montando rotas da API.')
  } catch (e) {
    schemaErr = e instanceof Error ? e.message : String(e)
    console.error('[agiliza-store] ERRO ao conectar ou aplicar schema SQL:', schemaErr)
    console.error(
      '[agiliza-store] Verifique PostgreSQL (serviço ou embarcado), DATABASE_URL em store-server.env e firewall. ' +
        'Este processo continua ativo: /health e /status respondem para diagnóstico.'
    )
  }

  if (!schemaOk) {
    process.on('SIGINT', () => process.exit(0))
    process.on('SIGTERM', () => process.exit(0))
    return
  }

  ex.use(express.json())
  ex.use('/auth', authRoutes)
  ex.use('/empresas', empresasRoutes)
  ex.use('/usuarios', usuariosRoutes)
  ex.use('/produtos', produtosRoutes)
  ex.use('/categorias', categoriasRoutes)
  ex.use('/marcas', marcasRoutes)
  ex.use('/clientes', clientesRoutes)
  ex.use('/fornecedores', fornecedoresRoutes)
  ex.use('/estoque', estoqueRoutes)
  ex.use('/caixa', caixaRoutes)
  ex.use('/vendas', vendasRoutes)
  ex.use('/contas-receber', contasReceberRoutes)
  ex.use('/sync', syncRoutes)
  ex.use('/terminais', terminaisRoutes)

  const wss = new WebSocketServer({ server, path: '/ws' })
  wss.on('connection', (ws, req) => {
    registerClient(ws, req)
  })

  const discoverUdp = dgram.createSocket('udp4')
  discoverUdp.on('message', (msg, rinfo) => {
    if (msg.toString('utf8').trim() !== AGILIZA_DISCOVER_MESSAGE_V1) return
    const payload = Buffer.from(
      JSON.stringify({
        name: process.env.AGILIZA_SERVER_NAME || 'AGILIZA-SERVER',
        port
      }),
      'utf8'
    )
    discoverUdp.send(payload, rinfo.port, rinfo.address, (err) => {
      if (err) console.error('[agiliza-discovery-udp] falha ao responder:', err.message)
    })
  })
  discoverUdp.on('error', (err) => {
    console.error('[agiliza-discovery-udp] socket inativo:', err.message)
  })

  try {
    discoverUdp.bind(discoveryUdpPort, '0.0.0.0', () => {
      console.log(`[agiliza-discovery-udp] ouvindo 0.0.0.0:${discoveryUdpPort}`)
    })
  } catch (e) {
    console.error('[agiliza-discovery-udp] bind falhou:', e instanceof Error ? e.message : e)
  }

  let bonjourCleanup: (() => void) | null = null
  try {
    const bonjour = new Bonjour()
    const service = bonjour.publish({
      name: process.env.AGILIZA_SERVER_NAME || 'AGILIZA-SERVER',
      type: 'agilizapdv',
      port
    })
    bonjourCleanup = (): void => {
      try {
        service?.stop?.()
        bonjour.destroy()
      } catch {
        // ignore
      }
    }
  } catch (e) {
    console.error('[agiliza-store] Bonjour/mDNS indisponível (comum no Windows; LAN discovery UDP ainda funciona):', e)
  }

  const cleanup = (): void => {
    try {
      discoverUdp.close()
    } catch {
      // ignore
    }
    bonjourCleanup?.()
  }

  process.on('exit', cleanup)
  process.on('SIGINT', () => {
    cleanup()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    cleanup()
    process.exit(0)
  })

  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    setInterval(() => {
      runSync().catch((err) => {
        console.error('Sync Supabase:', err)
      })
    }, SYNC_INTERVAL_MS)
  }
}

main().catch((err) => {
  console.error('Erro ao iniciar store-server', err)
  process.exit(1)
})
