import type { VercelRequest } from '@vercel/node'

export const BOT_UA =
  /bot|crawler|spider|crawling|facebookexternalhit|facebookcatalog|meta-externalagent|headlesschrome|lighthouse|pagespeed|preview|slurp|bingpreview|whatsapp|telegrambot|python-requests|curl|wget|axios|node-fetch/i

export function headerStr(req: VercelRequest, name: string): string | null {
  const raw = req.headers[name]
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export function clip(v: unknown, max = 240): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t) return null
  return t.slice(0, max)
}

export function isBotRequest(req: VercelRequest): boolean {
  const ua = headerStr(req, 'user-agent') || ''
  return !ua || BOT_UA.test(ua)
}

function clientIp(req: VercelRequest): string | null {
  const fwd = headerStr(req, 'x-forwarded-for')
  const ip = fwd?.split(',')[0]?.trim() || headerStr(req, 'x-real-ip')
  if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) return null
  return ip
}

async function geoFromIp(
  ip: string
): Promise<{ country: string | null; region: string | null; city: string | null } | null> {
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code,region_code,city`, {
      signal: AbortSignal.timeout(1500),
    })
    if (!res.ok) return null
    const j = (await res.json()) as {
      success?: boolean
      country_code?: string
      region_code?: string
      city?: string
    }
    if (!j.success) return null
    return {
      country: clip(j.country_code, 8),
      region: clip(j.region_code, 80),
      city: clip(j.city, 120),
    }
  } catch {
    return null
  }
}

function decodeHeader(v: string | null): string | null {
  if (!v) return null
  try {
    return decodeURIComponent(v)
  } catch {
    return v
  }
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

export type VisitorGeo = { country: string | null; region: string | null; city: string | null }

export async function resolveVisitorGeo(req: VercelRequest): Promise<VisitorGeo> {
  let country = headerStr(req, 'x-vercel-ip-country') || headerStr(req, 'cf-ipcountry')
  let region = headerStr(req, 'x-vercel-ip-country-region')
  let city = decodeHeader(headerStr(req, 'x-vercel-ip-city'))

  if (!city || !region || !country) {
    const ip = clientIp(req)
    const geo = ip ? await geoFromIp(ip) : null
    if (geo) {
      country = country || geo.country
      region = region || geo.region
      city = city || geo.city
    }
  }

  return { country: clip(country, 8), region: clip(region, 80), city: clip(city, 120) }
}
