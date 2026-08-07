import type { LojaOnlinePedido } from './loja-online-types'
import { pedidoStatusEmAberto, PEDIDO_STATUS_LABEL } from './loja-online-pedido-status'

export { PEDIDO_STATUS_LABEL }

export type PedidosPeriodo = 'hoje' | 'semana' | 'mes' | 'todos'

export const PEDIDOS_PERIODOS: { id: PedidosPeriodo; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mês' },
  { id: 'todos', label: 'Todos' },
]

export function getPedidosPeriodoRange(periodo: PedidosPeriodo): { dataInicio: string | null; dataFim: string | null } {
  if (periodo === 'todos') return { dataInicio: null, dataFim: null }

  const now = new Date()
  const dataFim = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (periodo === 'hoje') {
    const dataInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    return { dataInicio: dataInicio.toISOString(), dataFim: dataFim.toISOString() }
  }

  if (periodo === 'semana') {
    const dataInicio = new Date(now)
    dataInicio.setDate(now.getDate() - now.getDay())
    dataInicio.setHours(0, 0, 0, 0)
    return { dataInicio: dataInicio.toISOString(), dataFim: dataFim.toISOString() }
  }

  const dataInicio = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  return { dataInicio: dataInicio.toISOString(), dataFim: dataFim.toISOString() }
}

export function filterPedidosPorPeriodo(pedidos: LojaOnlinePedido[], periodo: PedidosPeriodo): LojaOnlinePedido[] {
  const { dataInicio, dataFim } = getPedidosPeriodoRange(periodo)
  if (!dataInicio || !dataFim) return pedidos
  const start = new Date(dataInicio).getTime()
  const end = new Date(dataFim).getTime()
  return pedidos.filter((p) => {
    const t = new Date(p.created_at).getTime()
    return t >= start && t <= end
  })
}

function dateKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateGroupLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  if (sameDay(d, today)) return 'Hoje'
  if (sameDay(d, yesterday)) return 'Ontem'

  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

export type PedidosDateGroup = {
  key: string
  label: string
  pedidos: LojaOnlinePedido[]
  total: number
  pendentes: number
}

export function groupPedidosPorData(pedidos: LojaOnlinePedido[]): PedidosDateGroup[] {
  const map = new Map<string, LojaOnlinePedido[]>()
  for (const p of pedidos) {
    const key = dateKey(p.created_at)
    const list = map.get(key) ?? []
    list.push(p)
    map.set(key, list)
  }

  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, list]) => ({
      key,
      label: formatDateGroupLabel(list[0].created_at),
      pedidos: list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      total: list.reduce((s, p) => s + p.total, 0),
      pendentes: list.filter((p) => pedidoStatusEmAberto(p)).length,
    }))
}

export function sumPedidosTotal(pedidos: LojaOnlinePedido[]): number {
  return pedidos.reduce((s, p) => s + p.total, 0)
}
