import { supabase } from './supabase'
import { filterPedidosPorPeriodo } from './loja-online-pedidos-utils'
import type { LojaOnlinePedido, LojaOnlinePedidoItem, LojaOnlineStoreConfig } from './loja-online-types'
import {
  getDashboardPeriodoRange,
  type DashboardPeriodo,
} from './dashboard-utils'

export type LojaOnlineDashNamedCount = { name: string; value: number }

export type LojaOnlineDashTopPage = { path: string; views: number }
export type LojaOnlineDashTopProduto = { id: string; nome: string; quantidade: number; receita: number }

export type LojaOnlineDashSeoItem = {
  id: string
  label: string
  ok: boolean
  hint?: string
}

export type LojaOnlineDashboardData = {
  kpis: {
    visitas: number
    sessoes: number
    pedidos: number
    receita: number
    ticketMedio: number
    conversao: number
    pendentes: number
  }
  visitasPorDia: { label: string; visitas: number; pedidos: number; receita: number }[]
  topPages: LojaOnlineDashTopPage[]
  devices: LojaOnlineDashNamedCount[]
  browsers: LojaOnlineDashNamedCount[]
  regions: LojaOnlineDashNamedCount[]
  topProdutos: LojaOnlineDashTopProduto[]
  seo: LojaOnlineDashSeoItem[]
}

type EventoRow = {
  id: string
  session_id: string
  event_name: string
  path: string | null
  device: string | null
  browser: string | null
  country: string | null
  region: string | null
  city: string | null
  created_at: string
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

function countBy(values: (string | null | undefined)[], fallback = 'Outro'): LojaOnlineDashNamedCount[] {
  const map = new Map<string, number>()
  for (const v of values) {
    const key = (v || fallback).trim() || fallback
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}

const CEP_UF: Record<string, string> = {
  '01': 'SP', '02': 'SP', '03': 'SP', '04': 'SP', '05': 'SP', '06': 'SP', '07': 'SP', '08': 'SP', '09': 'SP',
  '10': 'SP', '11': 'SP', '12': 'SP', '13': 'SP', '14': 'SP', '15': 'SP', '16': 'SP', '17': 'SP', '18': 'SP', '19': 'SP',
  '20': 'RJ', '21': 'RJ', '22': 'RJ', '23': 'RJ', '24': 'RJ', '25': 'RJ', '26': 'RJ', '27': 'RJ', '28': 'RJ',
  '29': 'ES',
  '30': 'MG', '31': 'MG', '32': 'MG', '33': 'MG', '34': 'MG', '35': 'MG', '36': 'MG', '37': 'MG', '38': 'MG', '39': 'MG',
  '40': 'BA', '41': 'BA', '42': 'BA', '43': 'BA', '44': 'BA', '45': 'BA', '46': 'BA', '47': 'BA', '48': 'BA',
  '49': 'SE',
  '50': 'PE', '51': 'PE', '52': 'PE', '53': 'PE', '54': 'PE', '55': 'PE', '56': 'PE',
  '57': 'AL',
  '58': 'PB',
  '59': 'RN',
  '60': 'CE', '61': 'CE', '62': 'CE', '63': 'CE',
  '64': 'PI',
  '65': 'MA',
  '66': 'PA', '67': 'PA', '68': 'PA',
  '69': 'AM',
  '70': 'DF', '71': 'DF', '72': 'DF', '73': 'DF',
  '74': 'GO', '75': 'GO', '76': 'GO',
  '77': 'TO',
  '78': 'MT',
  '79': 'MS',
  '80': 'PR', '81': 'PR', '82': 'PR', '83': 'PR', '84': 'PR', '85': 'PR', '86': 'PR', '87': 'PR',
  '88': 'SC', '89': 'SC',
  '90': 'RS', '91': 'RS', '92': 'RS', '93': 'RS', '94': 'RS', '95': 'RS', '96': 'RS', '97': 'RS', '98': 'RS', '99': 'RS',
}

function ufFromCep(cep: string | null | undefined): string | null {
  const digits = (cep || '').replace(/\D/g, '')
  if (digits.length < 2) return null
  return CEP_UF[digits.slice(0, 2)] ?? null
}

function buildSeoChecklist(config: LojaOnlineStoreConfig | null, slug: string | null): LojaOnlineDashSeoItem[] {
  const seoTitulo = config?.loja_online_seo_titulo?.trim() || config?.loja_online_titulo?.trim()
  const seoDesc = config?.loja_online_seo_descricao?.trim() || config?.loja_online_descricao?.trim()
  return [
    {
      id: 'titulo',
      label: 'Título SEO',
      ok: Boolean(seoTitulo),
      hint: seoTitulo || 'Configure em SEO e marketing',
    },
    {
      id: 'descricao',
      label: 'Meta descrição',
      ok: Boolean(seoDesc && seoDesc.length >= 50),
      hint: seoDesc ? `${seoDesc.length} caracteres` : 'Recomendado 50–160 caracteres',
    },
    {
      id: 'slug',
      label: 'Slug publicado',
      ok: Boolean(slug),
      hint: slug || 'Defina o endereço da loja',
    },
    {
      id: 'ga4',
      label: 'Google Analytics 4',
      ok: Boolean(config?.loja_online_ga4_id?.trim()),
      hint: config?.loja_online_ga4_id?.trim() || 'Não configurado',
    },
    {
      id: 'pixel',
      label: 'Meta Pixel',
      ok: Boolean(config?.loja_online_meta_pixel_id?.trim()),
      hint: config?.loja_online_meta_pixel_id?.trim() || 'Não configurado',
    },
    {
      id: 'sitemap',
      label: 'Sitemap',
      ok: Boolean(slug),
      hint: slug ? `/api/loja-online/sitemap?slug=${slug}` : 'Disponível após publicar',
    },
  ]
}

export async function loadLojaOnlineDashboardData(
  empresaId: string,
  periodo: DashboardPeriodo,
  config: LojaOnlineStoreConfig | null
): Promise<LojaOnlineDashboardData> {
  const { dataInicio, dataFim } = getDashboardPeriodoRange(periodo)

  const [eventosRes, pedidosRes] = await Promise.all([
    supabase
      .from('loja_online_eventos')
      .select('id, session_id, event_name, path, device, browser, country, region, city, created_at')
      .eq('empresa_id', empresaId)
      .gte('created_at', dataInicio)
      .lte('created_at', dataFim)
      .order('created_at', { ascending: true })
      .limit(5000),
    supabase
      .from('loja_online_pedidos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(2000),
  ])

  const eventos = (eventosRes.data ?? []) as EventoRow[]
  if (eventosRes.error && !/does not exist|schema cache|relação|relation/i.test(eventosRes.error.message)) {
    console.warn('[loja-online-dashboard] eventos', eventosRes.error.message)
  }

  const allPedidos = (pedidosRes.data ?? []) as LojaOnlinePedido[]
  const pedidosPeriodo = filterPedidosPorPeriodo(allPedidos, periodo)
  const pedidosValidos = pedidosPeriodo.filter((p) => p.status !== 'cancelado')
  const pendentes = pedidosPeriodo.filter(
    (p) =>
      p.status === 'pedido_recebido' ||
      p.status === 'aguardando_pagamento' ||
      p.status === 'em_separacao' ||
      p.status === 'em_preparacao'
  ).length

  const receita = pedidosValidos.reduce((s, p) => s + (Number(p.total) || 0), 0)
  const pedidosCount = pedidosValidos.length
  const ticketMedio = pedidosCount > 0 ? receita / pedidosCount : 0

  const pageViews = eventos.filter((e) => e.event_name === 'page_view')
  const visitas = pageViews.length
  const sessoes = new Set(pageViews.map((e) => e.session_id)).size
  const conversao = sessoes > 0 ? (pedidosCount / sessoes) * 100 : 0

  const dayMap = new Map<string, { visitas: number; pedidos: number; receita: number }>()
  const start = new Date(dataInicio)
  const end = new Date(dataFim)
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cursor <= endDay) {
    dayMap.set(dateKey(cursor.toISOString()), { visitas: 0, pedidos: 0, receita: 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  for (const e of pageViews) {
    const key = dateKey(e.created_at)
    const entry = dayMap.get(key)
    if (entry) entry.visitas += 1
  }
  for (const p of pedidosValidos) {
    const key = dateKey(p.created_at)
    const entry = dayMap.get(key)
    if (entry) {
      entry.pedidos += 1
      entry.receita += Number(p.total) || 0
    }
  }
  const visitasPorDia = [...dayMap.entries()].map(([key, v]) => ({
    label: formatDayLabel(key),
    ...v,
  }))

  const pathMap = new Map<string, number>()
  for (const e of pageViews) {
    const path = e.path || '/'
    pathMap.set(path, (pathMap.get(path) ?? 0) + 1)
  }
  const topPages = [...pathMap.entries()]
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)

  const devices = countBy(pageViews.map((e) => e.device))
  const browsers = countBy(pageViews.map((e) => e.browser))

  const regionLabels = pageViews.map((e) => {
    if (e.city && e.region) return `${e.city}, ${e.region}`
    if (e.region) return e.region
    if (e.city) return e.city
    if (e.country) return e.country
    return null
  })
  for (const p of pedidosValidos) {
    const uf = ufFromCep(p.cep_destino)
    if (uf) regionLabels.push(uf)
  }
  const regions = countBy(regionLabels, 'Não identificado')

  let topProdutos: LojaOnlineDashTopProduto[] = []
  const pedidoIds = pedidosValidos.map((p) => p.id)
  if (pedidoIds.length > 0) {
    const { data: itens } = await supabase
      .from('loja_online_pedido_itens')
      .select('produto_id, nome, quantidade, subtotal, pedido_id')
      .in('pedido_id', pedidoIds.slice(0, 500))
    const map = new Map<string, LojaOnlineDashTopProduto>()
    for (const item of (itens ?? []) as LojaOnlinePedidoItem[]) {
      const cur = map.get(item.produto_id) ?? {
        id: item.produto_id,
        nome: item.nome,
        quantidade: 0,
        receita: 0,
      }
      cur.quantidade += Number(item.quantidade) || 0
      cur.receita += Number(item.subtotal) || 0
      map.set(item.produto_id, cur)
    }
    topProdutos = [...map.values()].sort((a, b) => b.receita - a.receita).slice(0, 8)
  }

  return {
    kpis: {
      visitas,
      sessoes,
      pedidos: pedidosCount,
      receita,
      ticketMedio,
      conversao,
      pendentes,
    },
    visitasPorDia,
    topPages,
    devices,
    browsers,
    regions,
    topProdutos,
    seo: buildSeoChecklist(config, config?.loja_online_slug ?? null),
  }
}
