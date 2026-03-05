import 'dotenv/config'
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

async function main(): Promise<void> {
  await runSchema()

  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ ok: true })
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
  server.listen(port, () => {
    console.log(`Agiliza store-server ouvindo em http://localhost:${port}`)
  })

  // Anuncia serviço mDNS para descoberta automática pelos terminais
  const bonjour = new Bonjour()
  const service = bonjour.publish({
    name: process.env.AGILIZA_SERVER_NAME || 'AGILIZA-SERVER',
    type: 'agilizapdv',
    port
  })

  const cleanup = (): void => {
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

