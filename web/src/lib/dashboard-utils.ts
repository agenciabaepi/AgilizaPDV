import type { VendaComNfce } from '../vite-env'

export type DashboardPeriodo = 'hoje' | 'semana' | 'mes'

export const DASHBOARD_PERIODOS: { id: DashboardPeriodo; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mês' },
]

export function getDashboardPeriodoRange(periodo: DashboardPeriodo): { dataInicio: string; dataFim: string } {
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

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `R$ ${(value / 1_000).toFixed(1)}k`
  return formatCurrency(value)
}

function dateKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '')
}

export function buildDailySeries(
  vendas: VendaComNfce[],
  dataInicio: string,
  dataFim: string
): { key: string; label: string; total: number; count: number }[] {
  const start = new Date(dataInicio)
  const end = new Date(dataFim)
  const map = new Map<string, { total: number; count: number }>()

  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cursor <= endDay) {
    const key = dateKey(cursor.toISOString())
    map.set(key, { total: 0, count: 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  for (const v of vendas) {
    if (v.status !== 'CONCLUIDA') continue
    const key = dateKey(v.created_at)
    const entry = map.get(key)
    if (!entry) continue
    entry.total += v.total
    entry.count += 1
  }

  return [...map.entries()].map(([key, { total, count }]) => ({
    key,
    label: formatDayLabel(key),
    total,
    count,
  }))
}

export function isVendaPrazo(v: VendaComNfce): boolean {
  return Number(v.venda_a_prazo) === 1
}

export const DASHBOARD_CHART_COLORS = {
  primary: '#1d4ed8',
  primarySoft: 'rgba(29, 78, 216, 0.15)',
  success: '#50a773',
  successSoft: 'rgba(80, 167, 115, 0.15)',
  warning: '#e6a23c',
  info: '#409eff',
  purple: '#7c3aed',
  pink: '#db2777',
  slate: '#64748b',
  pdv: '#1d4ed8',
  online: '#50a773',
}
