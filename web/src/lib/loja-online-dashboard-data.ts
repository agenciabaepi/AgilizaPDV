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
export type LojaOnlineDashProdutoViews = { id: string; nome: string; visualizacoes: number }

export type LojaOnlineDashSeoItem = {
  id: string
  label: string
  ok: boolean
  hint?: string
}

export type LojaOnlineDashFunilEtapa = { id: string; label: string; sessoes: number }

export type LojaOnlineDashProdutoAbandonado = {
  id: string
  nome: string
  adicionados: number
  abandonados: number
}

export type LojaOnlineDashAbandono = {
  sessoesCarrinho: number
  carrinhosAbandonados: number
  checkoutsAbandonados: number
  taxaAbandono: number
  valorEstimado: number
  produtos: LojaOnlineDashProdutoAbandonado[]
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
  produtosVisualizados: LojaOnlineDashProdutoViews[]
  funil: LojaOnlineDashFunilEtapa[]
  abandono: LojaOnlineDashAbandono
  seo: LojaOnlineDashSeoItem[]
}

type EventoRow = {
  id: string
  session_id: string
  event_name: string
  path: string | null
  produto_id: string | null
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

/** PostgREST devolve no máximo ~1000 linhas por requisição; pagina para não perder os eventos mais recentes. */
const EVENTOS_PAGE_SIZE = 1000
const EVENTOS_MAX = 20000

async function fetchEventosPeriodo(
  empresaId: string,
  dataInicio: string,
  dataFim: string
): Promise<{ data: EventoRow[]; error: { message: string } | null }> {
  const rows: EventoRow[] = []
  for (let from = 0; from < EVENTOS_MAX; from += EVENTOS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('loja_online_eventos')
      .select('id, session_id, event_name, path, produto_id, device, browser, country, region, city, created_at')
      .eq('empresa_id', empresaId)
      .gte('created_at', dataInicio)
      .lte('created_at', dataFim)
      .order('created_at', { ascending: false })
      .range(from, from + EVENTOS_PAGE_SIZE - 1)
    if (error) return { data: rows, error }
    const page = (data ?? []) as EventoRow[]
    rows.push(...page)
    if (page.length < EVENTOS_PAGE_SIZE) break
  }
  return { data: rows.reverse(), error: null }
}

/** Data centers da Meta (robôs de revisão de anúncios / pré-visualização de links). */
const DATACENTER_CIDADES = new Set(
  ['prineville', 'forest city', 'luleå', 'lulea', 'altoona', 'papillion', 'clonee', 'odense', 'los lunas', 'new albany', 'henrico', 'eagle mountain', 'dekalb', 'gallatin', 'huntsville', 'stanton springs']
)

function isDatacenterEvento(e: EventoRow): boolean {
  const city = (e.city || '').trim().toLowerCase()
  if (!city || !DATACENTER_CIDADES.has(city)) return false
  return (e.country || '').toUpperCase() !== 'BR'
}

function regionLabel(e: EventoRow): string | null {
  const city = e.city?.trim()
  const region = e.region?.trim()
  const country = e.country?.trim().toUpperCase()
  if (city && region) return `${city}, ${region}`
  if (city) return city
  if (region) return country && country !== 'BR' ? `${region}, ${country}` : region
  if (country) return country === 'BR' ? 'Brasil' : country
  return null
}

export async function loadLojaOnlineDashboardData(
  empresaId: string,
  periodo: DashboardPeriodo,
  config: LojaOnlineStoreConfig | null
): Promise<LojaOnlineDashboardData> {
  const { dataInicio, dataFim } = getDashboardPeriodoRange(periodo)

  const [eventosRes, pedidosRes] = await Promise.all([
    fetchEventosPeriodo(empresaId, dataInicio, dataFim),
    supabase
      .from('loja_online_pedidos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(2000),
  ])

  const eventos = eventosRes.data.filter((e) => !isDatacenterEvento(e))
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

  const regionPorSessao = new Map<string, string | null>()
  for (const e of eventos) {
    const label = regionLabel(e)
    if (!regionPorSessao.has(e.session_id) || (label && !regionPorSessao.get(e.session_id))) {
      regionPorSessao.set(e.session_id, label)
    }
  }
  const regions = countBy([...regionPorSessao.values()], 'Não identificado')

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

  const viewsPorProduto = new Map<string, number>()
  for (const e of eventos) {
    if (e.event_name !== 'view_content' || !e.produto_id) continue
    viewsPorProduto.set(e.produto_id, (viewsPorProduto.get(e.produto_id) ?? 0) + 1)
  }

  const nomesProduto = new Map<string, string>()
  const { data: publicados } = await supabase
    .from('produtos')
    .select('id, nome')
    .eq('empresa_id', empresaId)
    .eq('ativo', 1)
    .eq('loja_online', 1)
    .is('produto_pai_id', null)
  for (const p of (publicados ?? []) as { id: string; nome: string }[]) {
    nomesProduto.set(p.id, p.nome)
  }
  const idsSemNome = [...viewsPorProduto.keys()].filter((id) => !nomesProduto.has(id))
  if (idsSemNome.length > 0) {
    const { data: extras } = await supabase
      .from('produtos')
      .select('id, nome')
      .in('id', idsSemNome.slice(0, 300))
    for (const p of (extras ?? []) as { id: string; nome: string }[]) {
      nomesProduto.set(p.id, p.nome)
    }
  }

  const produtosVisualizados: LojaOnlineDashProdutoViews[] = [...nomesProduto.entries()]
    .map(([id, nome]) => ({ id, nome, visualizacoes: viewsPorProduto.get(id) ?? 0 }))
    .sort((a, b) => b.visualizacoes - a.visualizacoes || a.nome.localeCompare(b.nome, 'pt-BR'))

  const sessoesCom = (eventName: string) =>
    new Set(eventos.filter((e) => e.event_name === eventName).map((e) => e.session_id))
  const sessoesVisita = sessoesCom('page_view')
  const sessoesProduto = sessoesCom('view_content')
  const sessoesCarrinho = sessoesCom('add_to_cart')
  const sessoesCheckout = sessoesCom('begin_checkout')
  const sessoesCompra = sessoesCom('purchase')

  const funil: LojaOnlineDashFunilEtapa[] = [
    { id: 'visita', label: 'Visitaram a loja', sessoes: sessoesVisita.size },
    { id: 'produto', label: 'Viram um produto', sessoes: sessoesProduto.size },
    { id: 'carrinho', label: 'Clicaram em Comprar agora', sessoes: sessoesCarrinho.size },
    { id: 'checkout', label: 'Iniciaram o checkout', sessoes: sessoesCheckout.size },
    { id: 'compra', label: 'Finalizaram a compra', sessoes: sessoesCompra.size },
  ]

  const abandonadas = new Set([...sessoesCarrinho].filter((s) => !sessoesCompra.has(s)))
  const checkoutsAbandonados = [...sessoesCheckout].filter((s) => !sessoesCompra.has(s)).length

  // Produtos adicionados por sessão (sem repetir o mesmo produto na mesma sessão)
  const addPorProduto = new Map<string, { adicionados: Set<string>; abandonados: Set<string> }>()
  for (const e of eventos) {
    if (e.event_name !== 'add_to_cart' || !e.produto_id) continue
    const cur = addPorProduto.get(e.produto_id) ?? { adicionados: new Set(), abandonados: new Set() }
    cur.adicionados.add(e.session_id)
    if (abandonadas.has(e.session_id)) cur.abandonados.add(e.session_id)
    addPorProduto.set(e.produto_id, cur)
  }

  const produtoInfo = new Map<string, { nome: string; preco: number }>()
  const produtoIds = [...addPorProduto.keys()]
  if (produtoIds.length > 0) {
    const { data: prods } = await supabase
      .from('produtos')
      .select('id, nome, preco')
      .in('id', produtoIds.slice(0, 300))
    for (const p of (prods ?? []) as { id: string; nome: string; preco: number }[]) {
      produtoInfo.set(p.id, { nome: p.nome, preco: Number(p.preco) || 0 })
    }
  }

  let valorEstimado = 0
  const produtosAbandono: LojaOnlineDashProdutoAbandonado[] = []
  for (const [id, v] of addPorProduto) {
    const info = produtoInfo.get(id)
    valorEstimado += (info?.preco ?? 0) * v.abandonados.size
    produtosAbandono.push({
      id,
      nome: info?.nome ?? 'Produto removido',
      adicionados: v.adicionados.size,
      abandonados: v.abandonados.size,
    })
  }
  produtosAbandono.sort((a, b) => b.abandonados - a.abandonados || b.adicionados - a.adicionados)

  const abandono: LojaOnlineDashAbandono = {
    sessoesCarrinho: sessoesCarrinho.size,
    carrinhosAbandonados: abandonadas.size,
    checkoutsAbandonados,
    taxaAbandono: sessoesCarrinho.size > 0 ? (abandonadas.size / sessoesCarrinho.size) * 100 : 0,
    valorEstimado,
    produtos: produtosAbandono.slice(0, 8),
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
    produtosVisualizados,
    funil,
    abandono,
    seo: buildSeoChecklist(config, config?.loja_online_slug ?? null),
  }
}
