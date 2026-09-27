import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from '../_lib/supabase'
import { clip, isBotRequest, resolveVisitorGeo } from '../_lib/visitor'

const ALLOWED_TYPES = new Set([
  'session_start',
  'click',
  'rage_click',
  'scroll_depth',
  'page_leave',
  'product_view',
  'gallery_view',
  'variation_select',
  'remove_from_cart',
  'cart_update',
  'cart_view',
  'checkout_step',
  'delivery_mode',
  'shipping_quote',
  'shipping_error',
  'shipping_select',
  'coupon_apply',
  'payment_select',
  'checkout_submit',
  'checkout_error',
  'js_error',
  'search',
])

const MAX_EVENTS = 60
const MAX_PROPS_CHARS = 2000

function sanitizeProps(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 24)) {
    const key = k.slice(0, 40)
    if (typeof v === 'number') out[key] = Number.isFinite(v) ? v : null
    else if (typeof v === 'boolean' || v === null) out[key] = v
    else if (typeof v === 'string') out[key] = v.slice(0, 300)
  }
  return JSON.stringify(out).length > MAX_PROPS_CHARS ? {} : out
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

  let body = req.body as unknown
  // sendBeacon envia text/plain
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = null
    }
  }
  const b = (body ?? {}) as Record<string, unknown>
  const empresaId = clip(b.empresaId, 80)
  const sessionId = clip(b.sessionId, 80)
  const events = Array.isArray(b.events) ? b.events.slice(0, MAX_EVENTS) : []

  if (!empresaId || !sessionId || events.length === 0) {
    res.status(400).json({ ok: false, error: 'Payload inválido.' })
    return
  }

  if (isBotRequest(req)) {
    res.status(204).end()
    return
  }

  const supabase = getSupabaseAdmin()
  const { data: cfg } = await supabase
    .from('empresas_config')
    .select('empresa_id, loja_online_ativa')
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (!cfg || Number(cfg.loja_online_ativa) !== 1) {
    res.status(404).json({ ok: false, error: 'Loja não encontrada.' })
    return
  }

  const geo = await resolveVisitorGeo(req)
  const now = Date.now()
  const base = {
    empresa_id: empresaId,
    session_id: sessionId,
    visitor_id: clip(b.visitorId, 80),
    cliente_id: clip(b.clienteId, 80),
    device: clip(b.device, 40),
    ...geo,
  }

  const rows = events
    .map((raw) => {
      const e = (raw ?? {}) as Record<string, unknown>
      const type = clip(e.type, 40)
      if (!type || !ALLOWED_TYPES.has(type)) return null
      const ts = typeof e.ts === 'number' && e.ts > now - 24 * 3600_000 && e.ts <= now + 60_000 ? e.ts : now
      return {
        ...base,
        event_type: type,
        path: clip(e.path, 500),
        produto_id: clip(e.produtoId, 80),
        props: sanitizeProps(e.props),
        created_at: new Date(ts).toISOString(),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (rows.length === 0) {
    res.status(204).end()
    return
  }

  const { error } = await supabase.from('loja_online_comportamento').insert(rows)
  if (error) {
    console.error('[loja-online/comportamento]', error.message)
    res.status(500).json({ ok: false, error: 'Falha ao registrar eventos.' })
    return
  }

  res.status(200).json({ ok: true, count: rows.length })
}
