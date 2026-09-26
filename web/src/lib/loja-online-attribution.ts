/** Atribuição de marketing (UTM + fbclid) para loja online. */

const ATTR_KEY = 'agiliza:loja-attr'
const SESSION_KEY = 'agiliza:loja-session'
const ATTR_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export type LojaOnlineAttribution = {
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  fbclid?: string | null
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
    if (!parsed?.captured_at || Date.now() - parsed.captured_at > ATTR_MAX_AGE_MS) {
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

/** Captura UTMs e fbclid da URL atual e persiste. */
export function captureLojaOnlineAttributionFromUrl(search?: string): LojaOnlineAttribution | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(search ?? window.location.search)
  const utm_source = params.get('utm_source')?.trim() || null
  const utm_medium = params.get('utm_medium')?.trim() || null
  const utm_campaign = params.get('utm_campaign')?.trim() || null
  const fbclid = params.get('fbclid')?.trim() || null
  if (!utm_source && !utm_medium && !utm_campaign && !fbclid) return readStoredAttr()

  const next: LojaOnlineAttribution = {
    utm_source: utm_source || readStoredAttr()?.utm_source || null,
    utm_medium: utm_medium || readStoredAttr()?.utm_medium || null,
    utm_campaign: utm_campaign || readStoredAttr()?.utm_campaign || null,
    fbclid: fbclid || readStoredAttr()?.fbclid || null,
    captured_at: Date.now(),
  }
  writeStoredAttr(next)
  return next
}

export function getLojaOnlineAttribution(): LojaOnlineAttribution | null {
  return readStoredAttr()
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
