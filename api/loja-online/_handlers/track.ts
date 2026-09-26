import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from '../_lib/supabase'

const ALLOWED_EVENTS = new Set(['page_view', 'view_content', 'add_to_cart', 'begin_checkout', 'purchase'])

function headerStr(req: VercelRequest, name: string): string | null {
  const raw = req.headers[name]
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function clip(v: unknown, max = 240): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t) return null
  return t.slice(0, max)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' })
    return
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const empresaId = clip(body.empresaId, 80)
  const sessionId = clip(body.sessionId, 80)
  const eventName = clip(body.eventName, 40)

  if (!empresaId || !sessionId || !eventName || !ALLOWED_EVENTS.has(eventName)) {
    res.status(400).json({ ok: false, error: 'Payload inválido.' })
    return
  }

  const country =
    headerStr(req, 'x-vercel-ip-country') ||
    headerStr(req, 'cf-ipcountry') ||
    clip(body.country, 8)
  const region =
    headerStr(req, 'x-vercel-ip-country-region') ||
    clip(body.region, 80)
  const city = headerStr(req, 'x-vercel-ip-city') || clip(body.city, 120)

  const supabase = getSupabaseAdmin()

  // Garante que a loja existe e está ativa (evita spam em empresaId aleatório)
  const { data: cfg } = await supabase
    .from('empresas_config')
    .select('empresa_id, loja_online_ativa')
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (!cfg || Number(cfg.loja_online_ativa) !== 1) {
    res.status(404).json({ ok: false, error: 'Loja não encontrada.' })
    return
  }

  const id = crypto.randomUUID()
  const { error } = await supabase.from('loja_online_eventos').insert({
    id,
    empresa_id: empresaId,
    session_id: sessionId,
    event_name: eventName,
    path: clip(body.path, 500),
    produto_id: clip(body.produtoId, 80),
    pedido_id: clip(body.pedidoId, 80),
    device: clip(body.device, 40),
    browser: clip(body.browser, 40),
    os: clip(body.os, 40),
    referrer: clip(body.referrer, 500),
    utm_source: clip(body.utm_source, 120),
    utm_medium: clip(body.utm_medium, 120),
    utm_campaign: clip(body.utm_campaign, 120),
    fbclid: clip(body.fbclid, 200),
    country,
    region,
    city: city ? decodeURIComponent(city) : null,
  })

  if (error) {
    console.error('[loja-online/track]', error.message)
    res.status(500).json({ ok: false, error: 'Falha ao registrar evento.' })
    return
  }

  res.status(200).json({ ok: true, id })
}
