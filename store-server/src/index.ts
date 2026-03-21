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
import clientesRoutes from './routes/clientes'
import fornecedoresRoutes from './routes/fornecedores'
import estoqueRoutes from './routes/estoque'
import caixaRoutes from './routes/caixa'
import vendasRoutes from './routes/vendas'
import syncRoutes from './routes/sync'
import { registerClient } from './ws'
import { runSync } from './sync-supabase'

const SYNC_INTERVAL_MS = 60 * 1000 // 1 minuto

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
  await runSchema()

  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/ping', (_req, res) => {
    res.status(200).send('ok')
  })

  app.use('/auth', authRoutes)
  app.use('/empresas', empresasRoutes)
  app.use('/usuarios', usuariosRoutes)
  app.use('/produtos', produtosRoutes)
  app.use('/categorias', categoriasRoutes)
  app.use('/clientes', clientesRoutes)
  app.use('/fornecedores', fornecedoresRoutes)
  app.use('/estoque', estoqueRoutes)
  app.use('/caixa', caixaRoutes)
  app.use('/vendas', vendasRoutes)
  app.use('/sync', syncRoutes)

  const server = createServer(app)

  const wss = new WebSocketServer({ server, path: '/ws' })
  wss.on('connection', (ws) => {
    registerClient(ws)
  })

  const port = Number(process.env.PORT || 3000)
  const discoveryUdpPort = Number(process.env.AGILIZA_DISCOVERY_UDP_PORT || 41234)

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

  discoverUdp.bind(discoveryUdpPort, '0.0.0.0', () => {
    console.log(`[agiliza-discovery-udp] ouvindo 0.0.0.0:${discoveryUdpPort} (firewall: permitir UDP ${discoveryUdpPort})`)
  })

  server.listen(port, '0.0.0.0', () => {
    console.log(`[agiliza-store] HTTP ouvindo 0.0.0.0:${port} (firewall: permitir TCP ${port})`)
    logListeningAddresses(port)
  })

  const bonjour = new Bonjour()
  const service = bonjour.publish({
    name: process.env.AGILIZA_SERVER_NAME || 'AGILIZA-SERVER',
    type: 'agilizapdv',
    port
  })

  const cleanup = (): void => {
    try {
      discoverUdp.close()
    } catch {
      // ignore
    }
    try {
      service?.stop?.()
      bonjour.destroy()
    } catch {
      // ignore
    }
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

