/** Tracking comportamental first-party (cliques, rolagem, tempo por página, checkout…) em lotes. */

import { detectLojaOnlineDevice, getOrCreateLojaOnlineSessionId } from './loja-online-attribution'
import { shouldSkipLojaOnlineAnalytics } from './loja-online-internal-analytics'

export type LojaOnlineBehaviorEvent =
  | 'click'
  | 'rage_click'
  | 'page_leave'
  | 'product_view'
  | 'gallery_view'
  | 'variation_select'
  | 'remove_from_cart'
  | 'cart_update'
  | 'cart_view'
  | 'checkout_step'
  | 'delivery_mode'
  | 'shipping_quote'
  | 'shipping_error'
  | 'shipping_select'
  | 'coupon_apply'
  | 'payment_select'
  | 'checkout_submit'
  | 'checkout_error'
  | 'js_error'
  | 'search'

type Props = Record<string, string | number | boolean | null | undefined>
type QueuedEvent = { type: string; path: string; produtoId: string | null; props: Props; ts: number }

const ENDPOINT = '/api/loja-online/comportamento'
const VISITOR_KEY = 'agiliza:loja-visitor'
const SESSION_STARTED_KEY = 'agiliza:loja-behavior-started'
const FLUSH_MS = 5000
const MAX_QUEUE = 25
const MAX_JS_ERRORS = 5

let empresaAtiva: string | null = null
let queue: QueuedEvent[] = []
let flushTimer: number | undefined
let produtoAtual: string | null = null
let jsErrors = 0

const page = { path: '', start: 0, activeMs: 0, visibleSince: 0, maxScroll: 0 }
const recentClicks: { x: number; y: number; t: number }[] = []

/** Caminho da rota da loja (vem do router: no modo /#/loja/:slug o pathname da janela é sempre "/"). */
let rotaAtual = ''

function currentPath(): string {
  return rotaAtual || (typeof window === 'undefined' ? '' : window.location.pathname)
}

function isEnabled(): boolean {
  if (!empresaAtiva || typeof window === 'undefined') return false
  if (navigator.webdriver) return false
  if (window.self !== window.top) return false
  return !shouldSkipLojaOnlineAnalytics(empresaAtiva)
}

function getVisitor(): { id: string; visits: number; isNewSession: boolean } {
  let isNewSession = false
  try {
    isNewSession = sessionStorage.getItem(SESSION_STARTED_KEY) !== '1'
    const raw = localStorage.getItem(VISITOR_KEY)
    const parsed = raw ? (JSON.parse(raw) as { id?: string; visits?: number }) : null
    const v = { id: parsed?.id || crypto.randomUUID(), visits: parsed?.visits ?? 0 }
    if (isNewSession) {
      v.visits += 1
      localStorage.setItem(VISITOR_KEY, JSON.stringify(v))
      sessionStorage.setItem(SESSION_STARTED_KEY, '1')
    }
    return { ...v, isNewSession }
  } catch {
    return { id: 'anon', visits: 1, isNewSession }
  }
}

function clienteId(): string | null {
  if (!empresaAtiva) return null
  try {
    const raw = localStorage.getItem(`agiliza:loja-cliente:${empresaAtiva}`)
    return raw ? ((JSON.parse(raw) as { id?: string }).id ?? null) : null
  } catch {
    return null
  }
}

function flush(useBeacon = false) {
  window.clearTimeout(flushTimer)
  flushTimer = undefined
  if (!empresaAtiva || queue.length === 0) return
  const events = queue.splice(0, 60)
  const body = JSON.stringify({
    empresaId: empresaAtiva,
    sessionId: getOrCreateLojaOnlineSessionId(),
    visitorId: getVisitor().id,
    clienteId: clienteId(),
    device: detectLojaOnlineDevice().device,
    events,
  })
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
    } else {
      void fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    /* analytics nunca quebra a loja */
  }
  if (queue.length) scheduleFlush()
}

function scheduleFlush() {
  if (flushTimer !== undefined) return
  flushTimer = window.setTimeout(() => flush(), FLUSH_MS)
}

function enqueue(type: string, props: Props = {}, produtoId?: string | null) {
  if (!isEnabled()) return
  queue.push({ type, path: currentPath(), produtoId: produtoId ?? produtoAtual, props, ts: Date.now() })
  if (queue.length >= MAX_QUEUE) flush()
  else scheduleFlush()
}

export function trackLojaOnlineBehavior(
  type: LojaOnlineBehaviorEvent,
  props?: Props,
  opts?: { produtoId?: string | null }
) {
  enqueue(type, props, opts?.produtoId)
}

const CEP_UF_FAIXAS: [number, number, string][] = [
  [1000, 19999, 'SP'], [20000, 28999, 'RJ'], [29000, 29999, 'ES'], [30000, 39999, 'MG'],
  [40000, 48999, 'BA'], [49000, 49999, 'SE'], [50000, 56999, 'PE'], [57000, 57999, 'AL'],
  [58000, 58999, 'PB'], [59000, 59999, 'RN'], [60000, 63999, 'CE'], [64000, 64999, 'PI'],
  [65000, 65999, 'MA'], [66000, 68899, 'PA'], [68900, 68999, 'AP'], [69000, 69299, 'AM'],
  [69300, 69399, 'RR'], [69400, 69899, 'AM'], [69900, 69999, 'AC'], [70000, 72799, 'DF'],
  [72800, 72999, 'GO'], [73000, 73699, 'DF'], [73700, 76799, 'GO'], [76800, 76999, 'RO'],
  [77000, 77999, 'TO'], [78000, 78899, 'MT'], [79000, 79999, 'MS'], [80000, 87999, 'PR'],
  [88000, 89999, 'SC'], [90000, 99999, 'RS'],
]

export function cepParaUf(cep: string | null | undefined): string | null {
  const digits = (cep ?? '').replace(/\D/g, '')
  if (digits.length < 5) return null
  const prefix = Number(digits.slice(0, 5))
  return CEP_UF_FAIXAS.find(([min, max]) => prefix >= min && prefix <= max)?.[2] ?? null
}

export type LojaOnlineFreteContexto = { sessionId: string; origem: 'produto' | 'carrinho' | 'checkout'; interno: boolean }

/** Contexto enviado junto ao cálculo de frete para o servidor registrar a cotação. */
export function lojaOnlineFreteContexto(origem: LojaOnlineFreteContexto['origem']): LojaOnlineFreteContexto {
  let interno = false
  try {
    interno =
      navigator.webdriver ||
      window.self !== window.top ||
      (empresaAtiva ? shouldSkipLojaOnlineAnalytics(empresaAtiva) : false)
  } catch {
    interno = true
  }
  return { sessionId: getOrCreateLojaOnlineSessionId(), origem, interno }
}

/** Produto aberto na página atual (associa tempo/rolagem/cliques ao produto). */
export function setLojaOnlineBehaviorProduto(produtoId: string | null) {
  produtoAtual = produtoId
}

function scrollPct(): number {
  const doc = document.documentElement
  const h = Math.max(doc.scrollHeight, 1)
  return Math.min(100, Math.round(((window.scrollY + window.innerHeight) / h) * 100))
}

function startPage(path: string) {
  const now = Date.now()
  page.path = path
  page.start = now
  page.activeMs = 0
  page.visibleSince = document.hidden ? 0 : now
  page.maxScroll = scrollPct()
}

function endPage() {
  if (!page.path) return
  const now = Date.now()
  const active = page.activeMs + (page.visibleSince ? now - page.visibleSince : 0)
  if (isEnabled() && now - page.start > 300) {
    queue.push({
      type: 'page_leave',
      path: page.path,
      produtoId: produtoAtual,
      props: { ms_total: now - page.start, ms_active: active, max_scroll: page.maxScroll },
      ts: now,
    })
  }
  page.path = ''
}

/** Chamado a cada troca de rota da SPA. */
export function notifyLojaOnlineBehaviorRoute(path: string) {
  rotaAtual = path
  if (!empresaAtiva || page.path === path) return
  endPage()
  produtoAtual = null
  startPage(path)
  scheduleFlush()
}

function describeClick(el: Element) {
  const interactive = el.closest('a, button, [role="button"], input, select, textarea, label, summary, [data-track]')
  const target = interactive ?? el
  const tag = target.tagName.toLowerCase()
  let label =
    target.getAttribute('data-track') ||
    target.getAttribute('aria-label') ||
    (interactive && tag !== 'input' && tag !== 'textarea' ? (target as HTMLElement).innerText : '') ||
    target.getAttribute('alt') ||
    target.getAttribute('placeholder') ||
    target.getAttribute('name') ||
    tag
  label = label.replace(/\s+/g, ' ').trim().slice(0, 60)
  if (!interactive) label = `(não clicável) ${label}`

  let zone: string | null = el.closest('[data-track-zone]')?.getAttribute('data-track-zone') ?? null
  for (let node: Element | null = el; node && !zone; node = node.parentElement) {
    const cls = [...node.classList].find((c) => /^loja-(store|galaxy)-[a-z-]+$/.test(c))
    if (cls) zone = cls.replace(/^loja-(store|galaxy)-/, '')
  }
  return { label, zone, tag, interactive: !!interactive }
}

function onClick(e: MouseEvent) {
  if (!isEnabled() || !(e.target instanceof Element)) return
  const d = describeClick(e.target)
  const x = Math.round((e.clientX / Math.max(window.innerWidth, 1)) * 1000) / 1000
  const y = Math.round(e.pageY)
  const dh = document.documentElement.scrollHeight
  enqueue('click', { x, y, vw: window.innerWidth, dh, label: d.label, zone: d.zone, tag: d.tag, dead: !d.interactive })

  const now = Date.now()
  recentClicks.push({ x: e.clientX, y: e.clientY, t: now })
  while (recentClicks.length && now - recentClicks[0].t > 800) recentClicks.shift()
  const near = recentClicks.filter((c) => Math.abs(c.x - e.clientX) < 30 && Math.abs(c.y - e.clientY) < 30)
  if (near.length >= 3) {
    recentClicks.length = 0
    enqueue('rage_click', { x, y, vw: window.innerWidth, dh, label: d.label, zone: d.zone, count: near.length })
  }
}

function onScroll() {
  if (!page.path) return
  const s = scrollPct()
  if (s > page.maxScroll) page.maxScroll = s
}

function onVisibility() {
  const now = Date.now()
  if (document.hidden) {
    if (page.visibleSince) page.activeMs += now - page.visibleSince
    page.visibleSince = 0
    flush(true)
  } else {
    page.visibleSince = now
  }
}

function onPageHide() {
  endPage()
  flush(true)
}

function onError(e: ErrorEvent | PromiseRejectionEvent) {
  if (jsErrors >= MAX_JS_ERRORS) return
  jsErrors++
  const msg =
    'message' in e
      ? e.message
      : e.reason instanceof Error
        ? e.reason.message
        : String(e.reason ?? 'unhandled rejection')
  enqueue('js_error', { msg: String(msg).slice(0, 140) })
}

/** Liga o tracking comportamental para a loja. Retorna função de limpeza. */
export function initLojaOnlineBehavior(empresaId: string, path?: string): () => void {
  empresaAtiva = empresaId
  if (path) rotaAtual = path
  if (!isEnabled()) {
    empresaAtiva = null
    return () => {}
  }

  const visitor = getVisitor()
  if (visitor.isNewSession) {
    enqueue('session_start', {
      returning: visitor.visits > 1,
      visitas: visitor.visits,
      landing: currentPath(),
      lang: navigator.language,
      screen_w: window.screen?.width ?? null,
    })
  }
  startPage(currentPath())

  const scrollListener = () => window.requestAnimationFrame(onScroll)
  document.addEventListener('click', onClick, { capture: true, passive: true })
  window.addEventListener('scroll', scrollListener, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onError)

  return () => {
    endPage()
    flush(true)
    document.removeEventListener('click', onClick, { capture: true })
    window.removeEventListener('scroll', scrollListener)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onError)
    empresaAtiva = null
  }
}
