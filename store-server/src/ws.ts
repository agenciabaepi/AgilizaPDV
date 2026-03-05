import { WebSocket } from 'ws'

export type WsEvent = {
  type: string
  payload?: Record<string, unknown>
}

const clients = new Set<WebSocket>()

export function broadcast(event: WsEvent): void {
  const data = JSON.stringify(event)
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  })
}

export function registerClient(ws: WebSocket): void {
  clients.add(ws)
  ws.on('close', () => clients.delete(ws))
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
