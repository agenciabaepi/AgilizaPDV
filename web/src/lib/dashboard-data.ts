import { supabase } from './supabase'
import { labelFormaPagamento } from './forma-pagamento-labels'
import { filterPedidosPorPeriodo } from './loja-online-pedidos-utils'
import { pedidoPrecisaAcaoAdmin, normalizePedido } from './loja-online-pedido-status'
import type { LojaOnlinePedido } from './loja-online-types'
import type { VendaComNfce } from '../vite-env'
import {
  buildDailySeries,
  getDashboardPeriodoRange,
  type DashboardPeriodo,
} from './dashboard-utils'

export type DashboardKpis = {
  totalVendas: number
  receita: number
  ticketMedio: number
  vendasPdv: number
  vendasOnline: number
  receitaPdv: number
  receitaOnline: number
  canceladas: number
  estoqueBaixo: number
  caixaAberto: boolean
  saldoCaixa: number | null
}

export type DashboardChartPoint = { label: string; total: number; count: number }
export type DashboardOrigemPoint = { name: string; value: number; receita: number }
export type DashboardFormaPoint = { name: string; value: number }
export type DashboardTopProduto = { id: string; nome: string; quantidade: number; receita: number }
export type DashboardLojaOnline = {
  pedidos: number
  receita: number
  pendentes: number
  confirmados: number
  clientes: number
  produtosPublicados: number
  atividadePorDia: DashboardChartPoint[]
}

export type DashboardData = {
  kpis: DashboardKpis
  vendasPorDia: DashboardChartPoint[]
  origemVendas: DashboardOrigemPoint[]
  formasPagamento: DashboardFormaPoint[]
  topProdutos: DashboardTopProduto[]
  ultimasVendas: VendaComNfce[]
  lojaOnline: DashboardLojaOnline | null
}

function dateKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildPedidosDailySeries(pedidos: LojaOnlinePedido[]): DashboardChartPoint[] {
  const map = new Map<string, { total: number; count: number }>()
  for (const p of pedidos) {
    if (p.status === 'cancelado') continue
    const key = dateKey(p.created_at)
    const entry = map.get(key) ?? { total: 0, count: 0 }
    entry.total += p.total
    entry.count += 1
    map.set(key, entry)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { total, count }]) => {
      const [y, m, d] = key.split('-').map(Number)
      const date = new Date(y, m - 1, d)
      return {
        label: date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', ''),
        total,
        count,
      }
    })
}

async function aggregateTopProdutos(vendaIds: string[]): Promise<DashboardTopProduto[]> {
  if (vendaIds.length === 0) return []

  const qtyMap = new Map<string, { quantidade: number; receita: number }>()
  for (let i = 0; i < vendaIds.length; i += 200) {
    const chunk = vendaIds.slice(i, i + 200)
    const { data: itens } = await supabase
      .from('venda_itens')
      .select('produto_id, quantidade, total')
      .in('venda_id', chunk)
    for (const item of itens ?? []) {
      if (!item.produto_id) continue
      const pid = String(item.produto_id)
      const entry = qtyMap.get(pid) ?? { quantidade: 0, receita: 0 }
      entry.quantidade += Number(item.quantidade)
      entry.receita += Number(item.total)
      qtyMap.set(pid, entry)
    }
  }

  const topIds = [...qtyMap.entries()]
    .sort((a, b) => b[1].quantidade - a[1].quantidade)
    .slice(0, 8)
    .map(([id]) => id)

  if (topIds.length === 0) return []

  const { data: produtos } = await supabase.from('produtos').select('id, nome').in('id', topIds)
  const nomeMap = new Map((produtos ?? []).map((p) => [String(p.id), String(p.nome)]))

  return topIds.map((id) => {
    const stats = qtyMap.get(id)!
    return {
      id,
      nome: nomeMap.get(id) ?? 'Produto',
      quantidade: stats.quantidade,
      receita: stats.receita,
    }
  })
}

async function aggregateFormasPagamento(vendaIds: string[]): Promise<DashboardFormaPoint[]> {
  if (vendaIds.length === 0) return []

  const totais = new Map<string, number>()
  for (let i = 0; i < vendaIds.length; i += 200) {
    const chunk = vendaIds.slice(i, i + 200)
    const { data: pags } = await supabase
      .from('pagamentos')
      .select('forma, valor')
      .in('venda_id', chunk)
    for (const p of pags ?? []) {
      const forma = String(p.forma)
      if (forma === 'A_PRAZO') continue
      totais.set(forma, (totais.get(forma) ?? 0) + Number(p.valor))
    }
  }

  return [...totais.entries()]
    .map(([forma, value]) => ({ name: labelFormaPagamento(forma), value }))
    .sort((a, b) => b.value - a.value)
}

async function loadLojaOnlineStats(
  empresaId: string,
  periodo: DashboardPeriodo
): Promise<DashboardLojaOnline> {
  const [{ count: clientes }, { count: produtosPublicados }, { data: pedidosRaw }] = await Promise.all([
    supabase
      .from('loja_online_clientes')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresaId),
    supabase
      .from('produtos')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('loja_online', 1)
      .eq('ativo', 1),
    supabase
      .from('loja_online_pedidos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const pedidos = filterPedidosPorPeriodo(
    ((pedidosRaw ?? []) as LojaOnlinePedido[]).map(normalizePedido),
    periodo
  )
  const ativos = pedidos.filter((p) => p.status !== 'cancelado' && p.status !== 'reembolsado' && p.status !== 'pagamento_recusado')

  return {
    pedidos: ativos.length,
    receita: ativos.reduce((s, p) => s + p.total, 0),
    pendentes: pedidos.filter((p) => pedidoPrecisaAcaoAdmin(p)).length,
    confirmados: pedidos.filter((p) => p.status === 'pagamento_aprovado').length,
    clientes: clientes ?? 0,
    produtosPublicados: produtosPublicados ?? 0,
    atividadePorDia: buildPedidosDailySeries(ativos),
  }
}

export async function loadDashboardData(
  empresaId: string,
  periodo: DashboardPeriodo,
  comLojaOnline: boolean
): Promise<DashboardData> {
  const { dataInicio, dataFim } = getDashboardPeriodoRange(periodo)

  const [vendas, saldos, caixaAberto, lojaOnline] = await Promise.all([
    window.electronAPI.vendas.list(empresaId, { dataInicio, dataFim, limit: 10_000 }),
    window.electronAPI.estoque.listSaldos(empresaId),
    window.electronAPI.caixa.getAberto(empresaId),
    comLojaOnline ? loadLojaOnlineStats(empresaId, periodo) : Promise.resolve(null),
  ])

  let saldoCaixa: number | null = null
  if (caixaAberto) {
    try {
      saldoCaixa = await window.electronAPI.caixa.getSaldo(caixaAberto.id)
    } catch {
      saldoCaixa = null
    }
  }

  const concluidas = vendas.filter((v) => v.status === 'CONCLUIDA')
  const canceladas = vendas.filter((v) => v.status === 'CANCELADA').length
  const pdv = concluidas.filter((v) => v.venda_online !== 1)
  const online = concluidas.filter((v) => v.venda_online === 1)
  const receita = concluidas.reduce((s, v) => s + v.total, 0)
  const receitaPdv = pdv.reduce((s, v) => s + v.total, 0)
  const receitaOnline = online.reduce((s, v) => s + v.total, 0)

  const estoqueBaixo = saldos.filter((s) => s.saldo <= s.estoque_minimo).length

  const vendaIdsConcluidas = concluidas.map((v) => v.id)
  const [topProdutos, formasPagamento] = await Promise.all([
    aggregateTopProdutos(vendaIdsConcluidas),
    aggregateFormasPagamento(vendaIdsConcluidas),
  ])

  return {
    kpis: {
      totalVendas: concluidas.length,
      receita,
      ticketMedio: concluidas.length > 0 ? receita / concluidas.length : 0,
      vendasPdv: pdv.length,
      vendasOnline: online.length,
      receitaPdv,
      receitaOnline,
      canceladas,
      estoqueBaixo,
      caixaAberto: caixaAberto != null,
      saldoCaixa,
    },
    vendasPorDia: buildDailySeries(vendas, dataInicio, dataFim),
    origemVendas: [
      { name: 'PDV', value: pdv.length, receita: receitaPdv },
      { name: 'Online', value: online.length, receita: receitaOnline },
    ].filter((o) => o.value > 0 || o.receita > 0),
    formasPagamento,
    topProdutos,
    ultimasVendas: vendas.slice(0, 8),
    lojaOnline,
  }
}
