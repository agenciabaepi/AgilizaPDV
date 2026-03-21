import { randomUUID } from 'crypto'
import type { IncomingMessage } from 'http'
import { WebSocket } from 'ws'

export type WsEvent = {
  type: string
  payload?: Record<string, unknown>
}

/** Cliente PDV conectado ao WebSocket do store-server (painel Terminais). */
export type TerminaiRegistro = {
  id: string
  connectedAt: string
  remoteAddress: string | null
  remotePort: number | null
  appVersion?: string
  installMode?: string
  hostname?: string
  platform?: string
  lastHelloAt?: string
}

const clients = new Map<WebSocket, TerminaiRegistro>()

function peerAddr(req?: IncomingMessage): { address: string | null; port: number | null } {
  if (!req?.socket) return { address: null, port: null }
  return {
    address: req.socket.remoteAddress ?? null,
    port: req.socket.remotePort ?? null
  }
}

export function registerClient(ws: WebSocket, req?: IncomingMessage): void {
  const { address, port } = peerAddr(req)
  const id = randomUUID()
  const connectedAt = new Date().toISOString()
  clients.set(ws, {
    id,
    connectedAt,
    remoteAddress: address,
    remotePort: port
  })
  ws.on('close', () => {
    clients.delete(ws)
  })
  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(String(raw)) as {
        type?: string
        appVersion?: string
        installMode?: string
        hostname?: string
        platform?: string
      }
      if (data.type !== 'hello') return
      const row = clients.get(ws)
      if (!row) return
      if (typeof data.appVersion === 'string') row.appVersion = data.appVersion
      if (typeof data.installMode === 'string') row.installMode = data.installMode
      if (typeof data.hostname === 'string') row.hostname = data.hostname
      if (typeof data.platform === 'string') row.platform = data.platform
      row.lastHelloAt = new Date().toISOString()
    } catch {
      // ignora mensagens não-JSON (ex.: pings futuros)
    }
  })
}

export function listTerminaisConectados(): TerminaiRegistro[] {
  return Array.from(clients.values())
}

export function broadcast(event: WsEvent): void {
  const data = JSON.stringify(event)
  clients.forEach((_, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  })
}

export function emitProduto(empresaId: string, produtoId: string, op: 'CREATE' | 'UPDATE' | 'DELETE'): void {
  broadcast({ type: 'produto', payload: { empresa_id: empresaId, produto_id: produtoId, operation: op } })
}

export function emitCategoria(empresaId: string, categoriaId: string, op: 'CREATE' | 'UPDATE' | 'DELETE'): void {
  broadcast({ type: 'categoria', payload: { empresa_id: empresaId, categoria_id: categoriaId, operation: op } })
}

export function emitVenda(empresaId: string, vendaId: string, op: 'CREATE' | 'CANCEL'): void {
  broadcast({ type: 'venda', payload: { empresa_id: empresaId, venda_id: vendaId, operation: op } })
}

export function emitEstoque(empresaId: string, produtoId: string): void {
  broadcast({ type: 'estoque', payload: { empresa_id: empresaId, produto_id: produtoId } })
}

export function emitCaixa(empresaId: string, op: 'abrir' | 'fechar' | 'movimento'): void {
  broadcast({ type: 'caixa', payload: { empresa_id: empresaId, operation: op } })
}
