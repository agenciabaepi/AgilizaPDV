/** Atribuição de marketing (UTM + fbclid + ref UGC) para loja online. */

const ATTR_KEY = 'agiliza:loja-attr'
const SESSION_KEY = 'agiliza:loja-session'
const DEFAULT_ATTR_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
let attrMaxAgeMs = DEFAULT_ATTR_MAX_AGE_MS
const CLICK_DEDUP_KEY = 'agiliza:loja-ugc-click'

/** Atualiza a janela do cookie de atribuição (dias), ex.: config da loja UGC. */
export function setLojaOnlineAttributionMaxAgeDays(days: number) {
  const d = Math.max(1, Math.min(365, Math.round(Number(days) || 30)))
  attrMaxAgeMs = d * 24 * 60 * 60 * 1000
}

export type LojaOnlineAttribution = {
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  fbclid?: string | null
  /** Código do parceiro UGC (?ref= / ?ugc=) — last-touch */
  ugc_ref?: string | null
  captured_at: number
}

export function getOrCreateLojaOnlineSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

function readStoredAttr(): LojaOnlineAttribution | null {
  try {
    const raw = localStorage.getItem(ATTR_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LojaOnlineAttribution
    if (!parsed?.captured_at || Date.now() - parsed.captured_at > attrMaxAgeMs) {
      localStorage.removeItem(ATTR_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStoredAttr(attr: LojaOnlineAttribution) {
  try {
    localStorage.setItem(ATTR_KEY, JSON.stringify(attr))
  } catch {
    /* ignore */
  }
}

function normalizeRef(raw: string | null | undefined): string | null {
  if (!raw) return null
  const code = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16)
  return code || null
}

/** Captura UTMs, fbclid e ref/ugc da URL atual e persiste (ref = last-touch). */
export function captureLojaOnlineAttributionFromUrl(search?: string): LojaOnlineAttribution | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(search ?? window.location.search)
  const utm_source = params.get('utm_source')?.trim() || null
  const utm_medium = params.get('utm_medium')?.trim() || null
  const utm_campaign = params.get('utm_campaign')?.trim() || null
  const fbclid = params.get('fbclid')?.trim() || null
  const ugc_ref = normalizeRef(params.get('ref') || params.get('ugc'))

  const prev = readStoredAttr()
  if (!utm_source && !utm_medium && !utm_campaign && !fbclid && !ugc_ref) return prev

  const next: LojaOnlineAttribution = {
    utm_source: utm_source || prev?.utm_source || null,
    utm_medium: utm_medium || prev?.utm_medium || null,
    utm_campaign: utm_campaign || prev?.utm_campaign || null,
    fbclid: fbclid || prev?.fbclid || null,
    // last-touch: novo ref sobrescreve e renova janela
    ugc_ref: ugc_ref || prev?.ugc_ref || null,
    captured_at: Date.now(),
  }
  writeStoredAttr(next)
  return next
}

export function getLojaOnlineAttribution(): LojaOnlineAttribution | null {
  return readStoredAttr()
}

export function getLojaOnlineUgcRef(): string | null {
  return normalizeRef(readStoredAttr()?.ugc_ref)
}

/** Evita registrar o mesmo clique várias vezes na mesma sessão (mesmo ref+produto). */
export function shouldRegisterUgcClick(codigo: string, produtoId: string | null): boolean {
  const key = `${normalizeRef(codigo) ?? ''}:${produtoId ?? ''}`
  if (!key || key === ':') return false
  try {
    const raw = sessionStorage.getItem(CLICK_DEDUP_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    const last = map[key] ?? 0
    if (Date.now() - last < 30_000) return false
    map[key] = Date.now()
    sessionStorage.setItem(CLICK_DEDUP_KEY, JSON.stringify(map))
    return true
  } catch {
    return true
  }
}

export function detectLojaOnlineDevice(): { device: string; browser: string; os: string } {
  if (typeof navigator === 'undefined') {
    return { device: 'unknown', browser: 'unknown', os: 'unknown' }
  }
  const ua = navigator.userAgent
  let device = 'desktop'
  if (/iPad|Tablet/i.test(ua)) device = 'tablet'
  else if (/Mobi|Android|iPhone|iPod/i.test(ua)) device = 'mobile'

  let browser = 'other'
  if (/Edg\//i.test(ua)) browser = 'edge'
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'chrome'
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'safari'
  else if (/Firefox\//i.test(ua)) browser = 'firefox'

  let os = 'other'
  if (/Windows/i.test(ua)) os = 'windows'
  else if (/Mac OS|Macintosh/i.test(ua)) os = 'macos'
  else if (/Android/i.test(ua)) os = 'android'
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'ios'
  else if (/Linux/i.test(ua)) os = 'linux'

  return { device, browser, os }
}
