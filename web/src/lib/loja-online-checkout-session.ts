const TTL_MS = 24 * 60 * 60 * 1000

function storageKey(empresaId: string): string {
  return `agiliza:lojaCheckoutPedido:${empresaId}`
}

/** Guarda o pedido em andamento para recuperar após refresh ou fechar aba. */
export function saveCheckoutPedidoId(empresaId: string, pedidoId: string): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(storageKey(empresaId), JSON.stringify({ pedidoId, at: Date.now() }))
}

export function getCheckoutPedidoId(empresaId: string): string | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(storageKey(empresaId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { pedidoId?: string; at?: number }
    if (!parsed.pedidoId || !parsed.at || Date.now() - parsed.at > TTL_MS) {
      sessionStorage.removeItem(storageKey(empresaId))
      return null
    }
    return parsed.pedidoId
  } catch {
    return null
  }
}

export function clearCheckoutPedidoId(empresaId: string): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(storageKey(empresaId))
}
