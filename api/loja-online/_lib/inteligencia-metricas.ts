import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_ROWS = 120_000
const PAGE = 1000
const TZ = 'America/Sao_Paulo'

type EventoRow = {
  session_id: string
  event_name: string
  path: string | null
  produto_id: string | null
  pedido_id: string | null
  device: string | null
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  region: string | null
  city: string | null
  created_at: string
}

type ComportamentoRow = {
  session_id: string
  visitor_id: string | null
  cliente_id: string | null
  event_type: string
  path: string | null
  produto_id: string | null
  props: Record<string, unknown> | null
  device: string | null
  region: string | null
  city: string | null
  created_at: string
}

type PedidoRow = {
  id: string
  cliente_id: string | null
  status: string
  total: number | null
  subtotal: number | null
  valor_frete: number | null
  valor_desconto: number | null
  forma_pagamento: string | null
  forma_entrega: string | null
  cupom_codigo: string | null
  created_at: string
}

type CotacaoRow = {
  session_id: string | null
  origem: string
  uf: string | null
  tipo: string | null
  subtotal: number | null
  produto_ids: string[] | null
  frete_min: number | null
  prazo_min: number | null
  frete_gratis: boolean
  erro: string | null
  created_at: string
}

type Sess = {
  id: string
  visitorId: string | null
  clienteId: string | null
  first: number
  last: number
  device: string | null
  region: string | null
  city: string | null
  source: string
  returning: boolean
  pageViews: number
  lastPath: string | null
  clicks: number
  viewedProducts: Set<string>
  addedProducts: Set<string>
  beganCheckout: boolean
  purchased: boolean
  steps: Set<string>
  deliveryMode: string | null
  shippingQuoted: boolean
  freteMin: number | null
  quoteSubtotal: number | null
  quoteUf: string | null
  paymentMethod: string | null
  submitted: boolean
  cartValue: number | null
  activeMs: number
  advanced: boolean
}

export type InteligenciaMetricas = ReturnType<typeof buildMetricas>

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE) return { rows, truncated: false }
  }
  return { rows, truncated: true }
}

export function normalizeLojaPath(path: string | null | undefined): string {
  const p = (path || '/').split('?')[0].replace(/^\/loja\/[^/]+/, '') || '/'
  return p.length > 1 ? p.replace(/\/+$/, '') : p
}

export function lojaPageType(path: string | null | undefined): string {
  const p = normalizeLojaPath(path)
  if (p === '/') return 'home'
  if (p.startsWith('/produto/')) return 'produto'
  if (p === '/carrinho') return 'carrinho'
  if (p === '/checkout') return 'checkout'
  if (p === '/busca') return 'busca'
  if (p.startsWith('/colecao/')) return 'colecao'
  if (p.startsWith('/conta/pedido')) return 'pedido'
  if (p === '/conta') return 'conta'
  if (p === '/entrar' || p === '/cadastro') return 'login_cadastro'
  if (p.startsWith('/legal/')) return 'legal'
  return 'outra'
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100
const pct = (part: number, total: number) => (total > 0 ? r1((part / total) * 100) : 0)
const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)

function median(arr: number[]): number {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function sourceOf(e: Pick<EventoRow, 'utm_source' | 'referrer'>): string {
  if (e.utm_source) return e.utm_source.toLowerCase()
  if (!e.referrer) return 'direto'
  try {
    const host = new URL(e.referrer).hostname.replace(/^www\./, '')
    if (/google\./.test(host)) return 'google'
    if (/instagram/.test(host)) return 'instagram'
    if (/facebook|fb\.|m\.facebook/.test(host)) return 'facebook'
    if (/tiktok/.test(host)) return 'tiktok'
    if (/whatsapp|wa\.me/.test(host)) return 'whatsapp'
    if (/bing\./.test(host)) return 'bing'
    if (/youtube/.test(host)) return 'youtube'
    return host
  } catch {
    return 'outro'
  }
}

const hourFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', hour12: false })
const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short' })

function ageBucket(birth: string | null | undefined, ref: Date): string | null {
  if (!birth) return null
  const d = new Date(birth)
  if (Number.isNaN(d.getTime())) return null
  let age = ref.getFullYear() - d.getFullYear()
  const m = ref.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) age--
  if (age < 13 || age > 110) return null
  if (age < 18) return '13-17'
  if (age < 25) return '18-24'
  if (age < 35) return '25-34'
  if (age < 45) return '35-44'
  if (age < 55) return '45-54'
  if (age < 65) return '55-64'
  return '65+'
}

function priceBand(preco: number): string {
  if (preco < 50) return 'até R$50'
  if (preco < 100) return 'R$50-100'
  if (preco < 200) return 'R$100-200'
  if (preco < 500) return 'R$200-500'
  return 'acima de R$500'
}

function freteBand(valor: number): string {
  if (valor <= 0) return 'grátis'
  if (valor <= 15) return 'até R$15'
  if (valor <= 30) return 'R$15-30'
  if (valor <= 50) return 'R$30-50'
  return 'acima de R$50'
}

function freteRatioBand(ratio: number): string {
  if (ratio <= 0) return '0% (grátis)'
  if (ratio < 0.1) return 'menos de 10% do carrinho'
  if (ratio < 0.2) return '10-20% do carrinho'
  if (ratio < 0.35) return '20-35% do carrinho'
  return 'mais de 35% do carrinho'
}

function countTop(map: Map<string, number>, limit: number) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([nome, total]) => ({ nome, total }))
}

function bump(map: Map<string, number>, key: string | null | undefined, by = 1) {
  if (!key) return
  map.set(key, (map.get(key) ?? 0) + by)
}

function resultadoSessao(s: Sess | undefined, produtoIds: string[] | null): string {
  if (!s) return 'saiu'
  if (s.purchased) return 'comprou'
  if (s.submitted) return 'enviou pedido'
  if (s.beganCheckout) return 'abandonou no checkout'
  if (produtoIds?.some((id) => s.addedProducts.has(id)) || s.addedProducts.size > 0) return 'abandonou o carrinho'
  return 'saiu sem adicionar'
}

/** Resumo das consultas de frete gravadas pelo servidor (tabela loja_online_frete_cotacoes). */
function resumirConsultasFrete(cotacoes: CotacaoRow[], sessions: Map<string, Sess>) {
  const ok = cotacoes.filter((c) => !c.erro && c.frete_min !== null)
  const erros = new Map<string, number>()
  for (const c of cotacoes) if (c.erro) bump(erros, c.erro.slice(0, 120))

  const porSessao = new Map<string, CotacaoRow[]>()
  for (const c of ok) {
    if (!c.session_id) continue
    const arr = porSessao.get(c.session_id) ?? []
    arr.push(c)
    porSessao.set(c.session_id, arr)
  }

  const porOrigem = new Map<string, { consultas: number; sessoes: Set<string>; compras: Set<string>; fretes: number[] }>()
  for (const c of ok) {
    const row = porOrigem.get(c.origem) ?? { consultas: 0, sessoes: new Set(), compras: new Set(), fretes: [] }
    row.consultas++
    row.fretes.push(Number(c.frete_min))
    if (c.session_id) {
      row.sessoes.add(c.session_id)
      if (sessions.get(c.session_id)?.purchased) row.compras.add(c.session_id)
    }
    porOrigem.set(c.origem, row)
  }

  // Página do produto: consultou o frete → adicionou esse produto ao carrinho?
  const pdp = new Map<string, { frete: number; adicionou: boolean; comprou: boolean }>()
  for (const c of ok) {
    if (c.origem !== 'produto' || !c.session_id) continue
    const s = sessions.get(c.session_id)
    const adicionou = !!s && (c.produto_ids ?? []).some((id) => s.addedProducts.has(id))
    pdp.set(`${c.session_id}|${(c.produto_ids ?? []).join(',')}`, { frete: Number(c.frete_min), adicionou, comprou: !!s?.purchased })
  }
  const pdpRows = [...pdp.values()]
  const pdpAdd = pdpRows.filter((r) => r.adicionou)
  const pdpNaoAdd = pdpRows.filter((r) => !r.adicionou)
  const pdpFaixas = new Map<string, { consultas: number; adicionaram: number; compraram: number }>()
  for (const r of pdpRows) {
    const k = freteBand(r.frete)
    const row = pdpFaixas.get(k) ?? { consultas: 0, adicionaram: 0, compraram: 0 }
    row.consultas++
    if (r.adicionou) row.adicionaram++
    if (r.comprou) row.compraram++
    pdpFaixas.set(k, row)
  }

  const multiplas = [...porSessao.values()].filter((arr) => new Set(arr.map((c) => `${c.uf}|${c.subtotal}`)).size > 1 || arr.length > 2)
  const fretesOk = ok.map((c) => Number(c.frete_min))

  return {
    total_consultas: cotacoes.length,
    consultas_com_sucesso: ok.length,
    consultas_com_erro: cotacoes.length - ok.length,
    sessoes_que_consultaram: porSessao.size,
    consultas_por_sessao_media: porSessao.size ? r1(ok.filter((c) => c.session_id).length / porSessao.size) : 0,
    sessoes_que_recalcularam_varias_vezes: multiplas.length,
    frete_cotado_medio: fretesOk.length ? r2(avg(fretesOk)) : null,
    frete_cotado_mediana: fretesOk.length ? r2(median(fretesOk)) : null,
    frete_gratis_pct_das_consultas: pct(ok.filter((c) => c.frete_gratis || Number(c.frete_min) <= 0).length, ok.length),
    por_origem: [...porOrigem.entries()].map(([origem, v]) => ({
      origem,
      consultas: v.consultas,
      sessoes: v.sessoes.size,
      compras: v.compras.size,
      conversao_pct: pct(v.compras.size, v.sessoes.size),
      frete_medio: r2(avg(v.fretes)),
    })),
    pagina_produto: {
      consultas: pdpRows.length,
      adicionaram_ao_carrinho_pct: pct(pdpAdd.length, pdpRows.length),
      compraram_pct: pct(pdpRows.filter((r) => r.comprou).length, pdpRows.length),
      frete_medio_quem_adicionou: pdpAdd.length ? r2(avg(pdpAdd.map((r) => r.frete))) : null,
      frete_medio_quem_nao_adicionou: pdpNaoAdd.length ? r2(avg(pdpNaoAdd.map((r) => r.frete))) : null,
      por_faixa_frete: [...pdpFaixas.entries()].map(([faixa, v]) => ({
        faixa,
        ...v,
        desistiram_pct: pct(v.consultas - v.adicionaram, v.consultas),
      })),
    },
    erros_top: countTop(erros, 6),
    ultimas: cotacoes
      .slice(-40)
      .reverse()
      .map((c) => ({
        quando: c.created_at,
        origem: c.origem,
        uf: c.uf,
        subtotal: c.subtotal,
        frete: c.frete_min,
        prazo: c.prazo_min,
        tipo: c.tipo,
        erro: c.erro,
        resultado: c.erro ? 'erro no cálculo' : resultadoSessao(c.session_id ? sessions.get(c.session_id) : undefined, c.produto_ids),
      })),
  }
}

export async function loadInteligenciaMetricas(
  supabase: SupabaseClient,
  empresaId: string,
  inicio: string,
  fim: string
) {
  const [eventosRes, compRes, pedidosRes, cotacoesRes] = await Promise.all([
    fetchAll<EventoRow>((from, to) =>
      supabase
        .from('loja_online_eventos')
        .select('session_id, event_name, path, produto_id, pedido_id, device, referrer, utm_source, utm_medium, region, city, created_at')
        .eq('empresa_id', empresaId)
        .gte('created_at', inicio)
        .lte('created_at', fim)
        .order('created_at', { ascending: true })
        .range(from, to)
    ),
    fetchAll<ComportamentoRow>((from, to) =>
      supabase
        .from('loja_online_comportamento')
        .select('session_id, visitor_id, cliente_id, event_type, path, produto_id, props, device, region, city, created_at')
        .eq('empresa_id', empresaId)
        .gte('created_at', inicio)
        .lte('created_at', fim)
        .order('created_at', { ascending: true })
        .range(from, to)
    ),
    fetchAll<PedidoRow>((from, to) =>
      supabase
        .from('loja_online_pedidos')
        .select('id, cliente_id, status, total, subtotal, valor_frete, valor_desconto, forma_pagamento, forma_entrega, cupom_codigo, created_at')
        .eq('empresa_id', empresaId)
        .gte('created_at', inicio)
        .lte('created_at', fim)
        .range(from, to)
    ),
    fetchAll<CotacaoRow>((from, to) =>
      supabase
        .from('loja_online_frete_cotacoes')
        .select('session_id, origem, uf, tipo, subtotal, produto_ids, frete_min, prazo_min, frete_gratis, erro, created_at')
        .eq('empresa_id', empresaId)
        .gte('created_at', inicio)
        .lte('created_at', fim)
        .order('created_at', { ascending: true })
        .range(from, to)
    ).catch(() => ({ rows: [] as CotacaoRow[], truncated: false })),
  ])

  const produtoIds = new Set<string>()
  for (const e of eventosRes.rows) if (e.produto_id) produtoIds.add(e.produto_id)
  for (const e of compRes.rows) if (e.produto_id) produtoIds.add(e.produto_id)

  const produtos = new Map<string, { nome: string; preco: number | null }>()
  const ids = [...produtoIds]
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from('produtos')
      .select('id, nome, preco')
      .eq('empresa_id', empresaId)
      .in('id', ids.slice(i, i + 200))
    for (const p of data ?? []) produtos.set(String(p.id), { nome: String(p.nome), preco: num(p.preco) })
  }

  const clienteIds = new Set<string>()
  for (const e of compRes.rows) if (e.cliente_id) clienteIds.add(e.cliente_id)
  for (const p of pedidosRes.rows) if (p.cliente_id) clienteIds.add(p.cliente_id)
  const nascimentos = new Map<string, string | null>()
  const cids = [...clienteIds]
  for (let i = 0; i < cids.length; i += 200) {
    const { data, error } = await supabase
      .from('loja_online_clientes')
      .select('id, data_nascimento')
      .eq('empresa_id', empresaId)
      .in('id', cids.slice(i, i + 200))
    if (error) break
    for (const c of data ?? []) nascimentos.set(String(c.id), (c as { data_nascimento?: string | null }).data_nascimento ?? null)
  }

  return buildMetricas({
    inicio,
    fim,
    eventos: eventosRes.rows,
    comportamento: compRes.rows,
    pedidos: pedidosRes.rows,
    cotacoes: cotacoesRes.rows,
    produtos,
    nascimentos,
    truncated: eventosRes.truncated || compRes.truncated,
  })
}

function buildMetricas(input: {
  inicio: string
  fim: string
  eventos: EventoRow[]
  comportamento: ComportamentoRow[]
  pedidos: PedidoRow[]
  cotacoes: CotacaoRow[]
  produtos: Map<string, { nome: string; preco: number | null }>
  nascimentos: Map<string, string | null>
  truncated: boolean
}) {
  const { eventos, comportamento, pedidos, cotacoes, produtos, nascimentos } = input
  const sessions = new Map<string, Sess>()

  const getSess = (id: string, ts: number): Sess => {
    let s = sessions.get(id)
    if (!s) {
      s = {
        id,
        visitorId: null,
        clienteId: null,
        first: ts,
        last: ts,
        device: null,
        region: null,
        city: null,
        source: 'direto',
        returning: false,
        pageViews: 0,
        lastPath: null,
        clicks: 0,
        viewedProducts: new Set(),
        addedProducts: new Set(),
        beganCheckout: false,
        purchased: false,
        steps: new Set(),
        deliveryMode: null,
        shippingQuoted: false,
        freteMin: null,
        quoteSubtotal: null,
        quoteUf: null,
        paymentMethod: null,
        submitted: false,
        cartValue: null,
        activeMs: 0,
        advanced: false,
      }
      sessions.set(id, s)
    }
    if (ts < s.first) s.first = ts
    if (ts > s.last) s.last = ts
    return s
  }

  // Produto: métricas de visualização/carrinho/compra
  type ProdStat = {
    views: Set<string>
    adds: Set<string>
    buys: Set<string>
    activeMs: number[]
    fotosPct: number[]
    preco: number | null
    nome: string | null
  }
  const prodStats = new Map<string, ProdStat>()
  const prod = (id: string): ProdStat => {
    let p = prodStats.get(id)
    if (!p) {
      const cat = produtos.get(id)
      p = { views: new Set(), adds: new Set(), buys: new Set(), activeMs: [], fotosPct: [], preco: cat?.preco ?? null, nome: cat?.nome ?? null }
      prodStats.set(id, p)
    }
    return p
  }

  const pedidoSession = new Map<string, string>()

  for (const e of eventos) {
    const ts = Date.parse(e.created_at)
    const s = getSess(e.session_id, ts)
    s.device = s.device || e.device
    s.region = s.region || e.region
    s.city = s.city || e.city
    if (e.event_name === 'page_view') {
      if (s.pageViews === 0) s.source = sourceOf(e)
      s.pageViews++
      s.lastPath = e.path
    } else if (e.event_name === 'view_content' && e.produto_id) {
      s.viewedProducts.add(e.produto_id)
      prod(e.produto_id).views.add(s.id)
    } else if (e.event_name === 'add_to_cart' && e.produto_id) {
      s.addedProducts.add(e.produto_id)
      prod(e.produto_id).adds.add(s.id)
    } else if (e.event_name === 'begin_checkout') {
      s.beganCheckout = true
    } else if (e.event_name === 'purchase') {
      s.purchased = true
      if (e.pedido_id) pedidoSession.set(e.pedido_id, s.id)
    }
  }

  // Galeria: maior índice visto por sessão+produto
  const galleryMax = new Map<string, { seen: number; total: number }>()
  const clickMap = new Map<string, number>()
  const rageMap = new Map<string, number>()
  const jsErrors = new Map<string, number>()
  const checkoutErrors = new Map<string, number>()
  const shippingErrors = new Map<string, number>()
  const searchTerms = new Map<string, number>()
  const searchNoResults = new Map<string, number>()
  const variationSelects = new Map<string, number>()
  const removedProducts = new Map<string, number>()
  const pageTime = new Map<string, number[]>()
  const pageScroll = new Map<string, number[]>()
  const coupon = { tentativas: 0, sucesso: 0, falhas: new Map<string, number>() }
  const shippingQuotes: { sessao: string; uf: string | null; frete: number; subtotal: number; prazo: number | null }[] = []
  let advancedSince: number | null = null

  for (const e of comportamento) {
    const ts = Date.parse(e.created_at)
    if (advancedSince === null || ts < advancedSince) advancedSince = ts
    const s = getSess(e.session_id, ts)
    s.advanced = true
    s.visitorId = s.visitorId || e.visitor_id
    s.clienteId = s.clienteId || e.cliente_id
    s.device = s.device || e.device
    s.region = s.region || e.region
    s.city = s.city || e.city
    const p = e.props ?? {}
    const tipo = lojaPageType(e.path)

    switch (e.event_type) {
      case 'session_start':
        if (p.returning === true) s.returning = true
        break
      case 'click': {
        s.clicks++
        const label = str(p.label) ?? str(p.tag) ?? '?'
        bump(clickMap, `${tipo} › ${str(p.zone) ?? '-'} › ${label}`)
        break
      }
      case 'rage_click':
        bump(rageMap, `${tipo} › ${str(p.zone) ?? '-'} › ${str(p.label) ?? '?'}`)
        break
      case 'page_leave': {
        const ms = num(p.ms_active) ?? 0
        if (ms > 0 && ms < 30 * 60_000) {
          s.activeMs += ms
          const arr = pageTime.get(tipo) ?? []
          arr.push(ms / 1000)
          pageTime.set(tipo, arr)
          if (e.produto_id) prod(e.produto_id).activeMs.push(ms / 1000)
        }
        const sc = num(p.max_scroll)
        if (sc !== null) {
          const arr = pageScroll.get(tipo) ?? []
          arr.push(Math.min(100, Math.max(0, sc)))
          pageScroll.set(tipo, arr)
        }
        break
      }
      case 'product_view':
        if (e.produto_id) {
          s.viewedProducts.add(e.produto_id)
          const ps = prod(e.produto_id)
          ps.views.add(s.id)
          ps.preco = num(p.preco) ?? ps.preco
          ps.nome = str(p.nome) ?? ps.nome
          const key = `${s.id}|${e.produto_id}`
          const total = num(p.total_midias) ?? 1
          const cur = galleryMax.get(key)
          galleryMax.set(key, { seen: Math.max(cur?.seen ?? 1, 1), total: Math.max(total, 1) })
        }
        break
      case 'gallery_view':
        if (e.produto_id) {
          const key = `${s.id}|${e.produto_id}`
          const total = num(p.total) ?? 1
          const idx = (num(p.index) ?? 0) + 1
          const cur = galleryMax.get(key)
          galleryMax.set(key, {
            seen: Math.max(cur?.seen ?? 1, idx),
            total: Math.max(cur?.total ?? 1, total),
          })
        }
        break
      case 'variation_select':
        bump(variationSelects, str(p.label))
        break
      case 'remove_from_cart':
        bump(removedProducts, e.produto_id)
        break
      case 'cart_update':
      case 'cart_view': {
        const sub = num(p.subtotal)
        if (sub !== null) s.cartValue = sub
        break
      }
      case 'checkout_step':
        if (str(p.step)) s.steps.add(String(p.step))
        break
      case 'delivery_mode':
        s.deliveryMode = str(p.modo)
        break
      case 'shipping_quote': {
        const frete = num(p.frete_min)
        const subtotal = num(p.subtotal)
        s.shippingQuoted = true
        if (frete !== null) s.freteMin = frete
        if (subtotal !== null) {
          s.quoteSubtotal = subtotal
          s.cartValue = subtotal
        }
        s.quoteUf = str(p.uf) ?? s.quoteUf
        if (frete !== null && subtotal !== null) {
          shippingQuotes.push({ sessao: s.id, uf: str(p.uf), frete, subtotal, prazo: num(p.prazo_min) })
        }
        break
      }
      case 'shipping_error':
        bump(shippingErrors, str(p.msg)?.slice(0, 120))
        break
      case 'shipping_select':
        if (num(p.valor) !== null) s.freteMin = num(p.valor)
        break
      case 'coupon_apply':
        coupon.tentativas++
        if (p.ok === true) coupon.sucesso++
        else bump(coupon.falhas, str(p.msg)?.slice(0, 120) ?? 'inválido')
        break
      case 'payment_select':
        s.paymentMethod = str(p.metodo)
        break
      case 'checkout_submit':
        s.submitted = true
        s.paymentMethod = str(p.metodo) ?? s.paymentMethod
        break
      case 'checkout_error':
        bump(checkoutErrors, `${str(p.stage) ?? 'checkout'}: ${str(p.msg)?.slice(0, 140) ?? 'erro'}`)
        break
      case 'js_error':
        bump(jsErrors, str(p.msg)?.slice(0, 140))
        break
      case 'search': {
        const q = str(p.q)?.toLowerCase().slice(0, 60)
        bump(searchTerms, q)
        if (num(p.results) === 0) bump(searchNoResults, q)
        break
      }
    }
  }

  // Cotações registradas pelo servidor (produto e checkout)
  for (const c of cotacoes) {
    if (!c.session_id || c.erro || c.frete_min === null || c.origem === 'produto') continue
    const s = sessions.get(c.session_id)
    if (!s) continue
    const frete = Number(c.frete_min)
    const subtotal = num(c.subtotal)
    s.shippingQuoted = true
    s.freteMin = frete
    s.quoteUf = c.uf ?? s.quoteUf
    if (subtotal !== null) {
      s.quoteSubtotal = subtotal
      s.cartValue = subtotal
      shippingQuotes.push({ sessao: s.id, uf: c.uf, frete, subtotal, prazo: c.prazo_min })
    }
  }

  // Compras por produto (via sessão do purchase)
  for (const s of sessions.values()) {
    if (!s.purchased) continue
    for (const pid of s.addedProducts) prod(pid).buys.add(s.id)
  }

  const all = [...sessions.values()]
  const nSess = all.length
  const withCart = all.filter((s) => s.addedProducts.size > 0 || s.beganCheckout)
  const abandoned = withCart.filter((s) => !s.purchased)
  const buyers = all.filter((s) => s.purchased)
  const advanced = all.filter((s) => s.advanced)

  const pedidosValidos = pedidos.filter((p) => p.status !== 'cancelado')
  const receita = pedidosValidos.reduce((a, p) => a + (Number(p.total) || 0), 0)

  const durations = all.map((s) => Math.max((s.last - s.first) / 1000, s.activeMs / 1000)).map((d) => Math.min(d, 7200))
  const visitors = new Set(all.map((s) => s.visitorId).filter(Boolean))

  // Funil
  const funilDef: [string, (s: Sess) => boolean][] = [
    ['Visitaram a loja', () => true],
    ['Viram um produto', (s) => s.viewedProducts.size > 0],
    ['Adicionaram ao carrinho', (s) => s.addedProducts.size > 0],
    ['Iniciaram o checkout', (s) => s.beganCheckout],
    ['Definiram entrega/frete', (s) => s.shippingQuoted || s.deliveryMode === 'retirada' || s.steps.has('pagamento')],
    ['Chegaram ao pagamento', (s) => s.steps.has('pagamento') || !!s.paymentMethod || s.submitted],
    ['Enviaram o pedido', (s) => s.submitted || s.purchased],
    ['Compraram', (s) => s.purchased],
  ]
  let prev = nSess
  const funil = funilDef.map(([etapa, fn]) => {
    const n = all.filter(fn).length
    const row = { etapa, sessoes: n, pct_do_topo: pct(n, nSess), queda_da_etapa_anterior_pct: prev > 0 ? r1(100 - (n / prev) * 100) : 0 }
    prev = n
    return row
  })

  // Segmentos
  const segment = (keyFn: (s: Sess) => string | null, limit = 12) => {
    const m = new Map<string, { sessoes: number; carrinhos: number; compras: number }>()
    for (const s of all) {
      const k = keyFn(s) || 'desconhecido'
      const row = m.get(k) ?? { sessoes: 0, carrinhos: 0, compras: 0 }
      row.sessoes++
      if (s.addedProducts.size > 0 || s.beganCheckout) row.carrinhos++
      if (s.purchased) row.compras++
      m.set(k, row)
    }
    return [...m.entries()]
      .sort((a, b) => b[1].sessoes - a[1].sessoes)
      .slice(0, limit)
      .map(([nome, v]) => ({
        nome,
        ...v,
        conversao_pct: pct(v.compras, v.sessoes),
        abandono_carrinho_pct: v.carrinhos > 0 ? pct(v.carrinhos - v.compras, v.carrinhos) : null,
      }))
  }

  const refDate = new Date(input.fim)
  const idadeDaSessao = (s: Sess) => (s.clienteId ? ageBucket(nascimentos.get(s.clienteId), refDate) : null)
  const clientesComIdade = [...nascimentos.values()].filter(Boolean).length
  const compradoresPorIdade = new Map<string, number>()
  for (const p of pedidosValidos) {
    if (p.cliente_id) bump(compradoresPorIdade, ageBucket(nascimentos.get(p.cliente_id), refDate) ?? 'não informado')
    else bump(compradoresPorIdade, 'convidado (sem cadastro)')
  }

  // Frete
  const quoteBySession = new Map<string, (typeof shippingQuotes)[number]>()
  for (const q of shippingQuotes) quoteBySession.set(q.sessao, q)
  const quotes = [...quoteBySession.values()]
  const buyerSet = new Set(buyers.map((s) => s.id))
  const qBuy = quotes.filter((q) => buyerSet.has(q.sessao))
  const qAband = quotes.filter((q) => !buyerSet.has(q.sessao))
  const bandStats = (bandFn: (q: (typeof quotes)[number]) => string) => {
    const m = new Map<string, { sessoes: number; compras: number }>()
    for (const q of quotes) {
      const k = bandFn(q)
      const row = m.get(k) ?? { sessoes: 0, compras: 0 }
      row.sessoes++
      if (buyerSet.has(q.sessao)) row.compras++
      m.set(k, row)
    }
    return [...m.entries()].map(([faixa, v]) => ({ faixa, ...v, abandono_pct: pct(v.sessoes - v.compras, v.sessoes) }))
  }
  const consultas = resumirConsultasFrete(cotacoes, sessions)

  const ufStats = new Map<string, { cotacoes: number; compras: number; fretes: number[] }>()
  for (const q of quotes) {
    const k = q.uf || '??'
    const row = ufStats.get(k) ?? { cotacoes: 0, compras: 0, fretes: [] }
    row.cotacoes++
    row.fretes.push(q.frete)
    if (buyerSet.has(q.sessao)) row.compras++
    ufStats.set(k, row)
  }

  // Galeria
  const gal = [...galleryMax.entries()].map(([key, v]) => {
    const [sid, pid] = key.split('|')
    return { sid, pid, seen: v.seen, pct: Math.min(1, v.seen / v.total), all: v.seen >= v.total, multi: v.total > 1 }
  })
  const galMulti = gal.filter((g) => g.multi)
  const addRateOf = (rows: typeof gal) =>
    pct(rows.filter((g) => sessions.get(g.sid)?.addedProducts.has(g.pid)).length, rows.length)
  for (const g of galMulti) prod(g.pid).fotosPct.push(g.pct * 100)

  // Produtos
  const produtosRows = [...prodStats.entries()]
    .filter(([, p]) => p.views.size > 0 || p.adds.size > 0)
    .map(([id, p]) => ({
      produto_id: id,
      nome: p.nome ?? produtos.get(id)?.nome ?? id.slice(0, 8),
      preco: p.preco,
      visualizacoes: p.views.size,
      add_carrinho: p.adds.size,
      compras: p.buys.size,
      taxa_add_pct: pct(p.adds.size, p.views.size),
      taxa_compra_pct: pct(p.buys.size, p.views.size),
      abandono_carrinho_pct: p.adds.size > 0 ? pct(p.adds.size - p.buys.size, p.adds.size) : null,
      tempo_medio_pagina_s: p.activeMs.length ? r1(avg(p.activeMs)) : null,
      fotos_vistas_media_pct: p.fotosPct.length ? r1(avg(p.fotosPct)) : null,
      removido_do_carrinho: removedProducts.get(id) ?? 0,
    }))
    .sort((a, b) => b.visualizacoes - a.visualizacoes)

  const precoBands = new Map<string, { views: number; adds: number; compras: number }>()
  for (const p of produtosRows) {
    if (p.preco === null) continue
    const k = priceBand(p.preco)
    const row = precoBands.get(k) ?? { views: 0, adds: 0, compras: 0 }
    row.views += p.visualizacoes
    row.adds += p.add_carrinho
    row.compras += p.compras
    precoBands.set(k, row)
  }

  // Tempo / scroll por tipo de página
  const tempoPorPagina = [...pageTime.entries()]
    .map(([tipo, arr]) => ({ tipo, amostras: arr.length, media_s: r1(avg(arr)), mediana_s: r1(median(arr)) }))
    .sort((a, b) => b.amostras - a.amostras)
  const scrollPorPagina = [...pageScroll.entries()].map(([tipo, arr]) => ({
    tipo,
    amostras: arr.length,
    media_pct: r1(avg(arr)),
    chegaram_50_pct: pct(arr.filter((v) => v >= 50).length, arr.length),
    chegaram_ao_fim_pct: pct(arr.filter((v) => v >= 90).length, arr.length),
  }))

  const saidas = new Map<string, number>()
  for (const s of all) if (!s.purchased && s.lastPath) bump(saidas, lojaPageType(s.lastPath))

  const horas = new Map<string, { sessoes: number; compras: number }>()
  const dias = new Map<string, { sessoes: number; compras: number }>()
  for (const s of all) {
    const d = new Date(s.first)
    const h = hourFmt.format(d)
    const w = weekdayFmt.format(d).replace('.', '')
    const hr = horas.get(h) ?? { sessoes: 0, compras: 0 }
    hr.sessoes++
    if (s.purchased) hr.compras++
    horas.set(h, hr)
    const dr = dias.get(w) ?? { sessoes: 0, compras: 0 }
    dr.sessoes++
    if (s.purchased) dr.compras++
    dias.set(w, dr)
  }

  const pagamentos = new Map<string, { escolhas: number; compras: number }>()
  for (const s of advanced) {
    if (!s.paymentMethod) continue
    const row = pagamentos.get(s.paymentMethod) ?? { escolhas: 0, compras: 0 }
    row.escolhas++
    if (s.purchased) row.compras++
    pagamentos.set(s.paymentMethod, row)
  }

  const valorAbandonado = abandoned.reduce((a, s) => a + (s.cartValue ?? 0), 0)
  const abandonedWithValue = abandoned.filter((s) => s.cartValue !== null)

  return {
    periodo: {
      inicio: input.inicio,
      fim: input.fim,
      dias: Math.max(1, Math.round((Date.parse(input.fim) - Date.parse(input.inicio)) / 86_400_000)),
    },
    qualidade_dados: {
      sessoes_total: nSess,
      sessoes_com_tracking_avancado: advanced.length,
      tracking_avancado_desde: advancedSince ? new Date(advancedSince).toISOString() : null,
      eventos_funil: eventos.length,
      eventos_comportamento: comportamento.length,
      dados_truncados: input.truncated,
      clientes_com_data_nascimento: clientesComIdade,
    },
    visao_geral: {
      sessoes: nSess,
      visitantes_unicos: visitors.size || null,
      visitantes_recorrentes_pct: advanced.length ? pct(advanced.filter((s) => s.returning).length, advanced.length) : null,
      pedidos: pedidosValidos.length,
      pedidos_cancelados: pedidos.length - pedidosValidos.length,
      receita: r2(receita),
      ticket_medio: pedidosValidos.length ? r2(receita / pedidosValidos.length) : 0,
      conversao_pct: pct(buyers.length, nSess),
      tempo_medio_sessao_s: r1(avg(durations)),
      tempo_mediano_sessao_s: r1(median(durations)),
      paginas_por_sessao: r1(avg(all.map((s) => s.pageViews))),
      rejeicao_pct: pct(all.filter((s) => s.pageViews <= 1 && s.clicks === 0 && s.addedProducts.size === 0).length, nSess),
    },
    funil,
    carrinho: {
      sessoes_com_carrinho: withCart.length,
      sessoes_que_compraram: withCart.filter((s) => s.purchased).length,
      abandono_pct: pct(abandoned.length, withCart.length),
      valor_abandonado_estimado: r2(valorAbandonado),
      carrinho_medio_abandonado: abandonedWithValue.length ? r2(valorAbandonado / abandonedWithValue.length) : null,
      tempo_medio_sessao_abandono_s: r1(avg(abandoned.map((s) => Math.min((s.last - s.first) / 1000, 7200)))),
      abandonaram_em: countTop(
        (() => {
          const m = new Map<string, number>()
          for (const s of abandoned) {
            const etapa = s.submitted
              ? 'após enviar o pedido (pagamento não concluído)'
              : s.steps.has('pagamento') || s.paymentMethod
                ? 'na etapa de pagamento'
                : s.shippingQuoted
                  ? 'após ver o frete'
                  : s.beganCheckout
                    ? 'no início do checkout (dados/entrega)'
                    : 'no carrinho (nem iniciou checkout)'
            bump(m, etapa)
          }
          return m
        })(),
        10
      ),
      produtos_mais_removidos: countTop(
        new Map([...removedProducts.entries()].map(([id, n]) => [prodStats.get(id)?.nome ?? produtos.get(id)?.nome ?? id, n])),
        10
      ),
    },
    checkout: {
      etapas_abertas: ['dados', 'entrega', 'pagamento'].map((step) => ({
        etapa: step,
        sessoes: advanced.filter((s) => s.steps.has(step)).length,
      })),
      modo_entrega: countTop(
        (() => {
          const m = new Map<string, number>()
          for (const s of advanced) bump(m, s.deliveryMode)
          return m
        })(),
        5
      ),
      metodos_pagamento: [...pagamentos.entries()].map(([metodo, v]) => ({
        metodo,
        ...v,
        conclusao_pct: pct(v.compras, v.escolhas),
      })),
      cupons: {
        tentativas: coupon.tentativas,
        sucesso: coupon.sucesso,
        falhas_top: countTop(coupon.falhas, 5),
      },
      erros_checkout_top: countTop(checkoutErrors, 10),
      erros_frete_top: countTop(shippingErrors, 8),
    },
    frete: {
      sessoes_com_cotacao: quotes.length,
      conversao_apos_cotacao_pct: pct(qBuy.length, quotes.length),
      frete_medio_compradores: qBuy.length ? r2(avg(qBuy.map((q) => q.frete))) : null,
      frete_medio_abandonos: qAband.length ? r2(avg(qAband.map((q) => q.frete))) : null,
      frete_sobre_carrinho_compradores_pct: qBuy.length ? r1(avg(qBuy.map((q) => (q.subtotal > 0 ? (q.frete / q.subtotal) * 100 : 0)))) : null,
      frete_sobre_carrinho_abandonos_pct: qAband.length ? r1(avg(qAband.map((q) => (q.subtotal > 0 ? (q.frete / q.subtotal) * 100 : 0)))) : null,
      prazo_medio_compradores_dias: qBuy.filter((q) => q.prazo).length ? r1(avg(qBuy.filter((q) => q.prazo).map((q) => q.prazo!))) : null,
      prazo_medio_abandonos_dias: qAband.filter((q) => q.prazo).length ? r1(avg(qAband.filter((q) => q.prazo).map((q) => q.prazo!))) : null,
      abandono_por_valor_frete: bandStats((q) => freteBand(q.frete)),
      abandono_por_peso_no_carrinho: bandStats((q) => freteRatioBand(q.subtotal > 0 ? q.frete / q.subtotal : 0)),
      por_uf: [...ufStats.entries()]
        .sort((a, b) => b[1].cotacoes - a[1].cotacoes)
        .slice(0, 15)
        .map(([uf, v]) => ({
          uf,
          cotacoes: v.cotacoes,
          compras: v.compras,
          abandono_pct: pct(v.cotacoes - v.compras, v.cotacoes),
          frete_medio: r2(avg(v.fretes)),
        })),
      pedidos_frete_medio: pedidosValidos.length ? r2(avg(pedidosValidos.map((p) => Number(p.valor_frete) || 0))) : 0,
      consultas,
    },
    preco: {
      por_faixa: [...precoBands.entries()].map(([faixa, v]) => ({
        faixa,
        ...v,
        taxa_add_pct: pct(v.adds, v.views),
        taxa_compra_pct: pct(v.compras, v.views),
      })),
      pedidos_com_cupom_pct: pct(pedidosValidos.filter((p) => p.cupom_codigo).length, pedidosValidos.length),
    },
    galeria: {
      visualizacoes_produto_com_varias_midias: galMulti.length,
      media_midias_vistas_pct: galMulti.length ? r1(avg(galMulti.map((g) => g.pct * 100))) : null,
      viram_todas_pct: pct(galMulti.filter((g) => g.all).length, galMulti.length),
      viram_so_a_primeira_pct: pct(galMulti.filter((g) => g.seen <= 1).length, galMulti.length),
      taxa_add_quem_viu_todas_pct: addRateOf(galMulti.filter((g) => g.all)),
      taxa_add_quem_nao_viu_todas_pct: addRateOf(galMulti.filter((g) => !g.all)),
    },
    produtos: produtosRows.slice(0, 30),
    engajamento: {
      tempo_por_tipo_pagina: tempoPorPagina,
      scroll_por_tipo_pagina: scrollPorPagina,
      paginas_de_saida_sem_compra: countTop(saidas, 10),
      cliques_top: countTop(clickMap, 25),
      rage_clicks_top: countTop(rageMap, 12),
      erros_js_top: countTop(jsErrors, 8),
      buscas_top: countTop(searchTerms, 15),
      buscas_sem_resultado: countTop(searchNoResults, 10),
      variacoes_mais_escolhidas: countTop(variationSelects, 10),
    },
    segmentos: {
      dispositivo: segment((s) => s.device),
      origem: segment((s) => s.source),
      regiao_uf: segment((s) => s.quoteUf || s.region, 27),
      cidade: segment((s) => s.city, 15),
      novos_vs_recorrentes: advanced.length ? segment((s) => (s.advanced ? (s.returning ? 'recorrente' : 'novo') : null), 3) : [],
      faixa_etaria_sessoes: segment(idadeDaSessao, 10).filter((r) => r.nome !== 'desconhecido'),
      faixa_etaria_pedidos: countTop(compradoresPorIdade, 10),
      hora_do_dia: [...horas.entries()]
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([hora, v]) => ({ hora, ...v, conversao_pct: pct(v.compras, v.sessoes) })),
      dia_da_semana: [...dias.entries()].map(([dia, v]) => ({ dia, ...v, conversao_pct: pct(v.compras, v.sessoes) })),
    },
  }
}
