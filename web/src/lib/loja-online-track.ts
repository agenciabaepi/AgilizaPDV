/** Helpers do Meta Pixel (fbq) e tracking first-party. */

import {
  captureLojaOnlineAttributionFromUrl,
  detectLojaOnlineDevice,
  getLojaOnlineAttribution,
  getOrCreateLojaOnlineSessionId,
} from './loja-online-attribution'

export type LojaOnlineTrackEventName =
  | 'page_view'
  | 'view_content'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'purchase'

export function trackMetaPixel(
  event: 'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase',
  params?: Record<string, unknown>
) {
  if (typeof window === 'undefined' || !window.fbq) return
  if (params) window.fbq('track', event, params)
  else window.fbq('track', event)
}

export async function trackLojaOnlineEvent(input: {
  empresaId: string
  eventName: LojaOnlineTrackEventName
  path?: string
  produtoId?: string | null
  pedidoId?: string | null
  value?: number
  currency?: string
  contentIds?: string[]
}): Promise<void> {
  if (!input.empresaId) return

  captureLojaOnlineAttributionFromUrl()
  const attr = getLojaOnlineAttribution()
  const sessionId = getOrCreateLojaOnlineSessionId()
  const deviceInfo = detectLojaOnlineDevice()

  const body = {
    empresaId: input.empresaId,
    sessionId,
    eventName: input.eventName,
    path: input.path ?? (typeof window !== 'undefined' ? window.location.pathname : null),
    produtoId: input.produtoId ?? null,
    pedidoId: input.pedidoId ?? null,
    device: deviceInfo.device,
    browser: deviceInfo.browser,
    os: deviceInfo.os,
    referrer: typeof document !== 'undefined' ? document.referrer || null : null,
    utm_source: attr?.utm_source ?? null,
    utm_medium: attr?.utm_medium ?? null,
    utm_campaign: attr?.utm_campaign ?? null,
    fbclid: attr?.fbclid ?? null,
  }

  try {
    void fetch('/api/loja-online/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    })
  } catch {
    /* ignore network errors for analytics */
  }

  // Espelha no Meta Pixel quando configurado
  switch (input.eventName) {
    case 'page_view':
      // PageView do Pixel fica a cargo do LojaOnlineAnalytics (init)
      break
    case 'view_content':
      trackMetaPixel('ViewContent', {
        content_ids: input.contentIds ?? (input.produtoId ? [input.produtoId] : undefined),
        content_type: 'product',
        value: input.value,
        currency: input.currency ?? 'BRL',
      })
      break
    case 'add_to_cart':
      trackMetaPixel('AddToCart', {
        content_ids: input.contentIds ?? (input.produtoId ? [input.produtoId] : undefined),
        content_type: 'product',
        value: input.value,
        currency: input.currency ?? 'BRL',
      })
      break
    case 'begin_checkout':
      trackMetaPixel('InitiateCheckout', {
        content_ids: input.contentIds,
        value: input.value,
        currency: input.currency ?? 'BRL',
      })
      break
    case 'purchase':
      trackMetaPixel('Purchase', {
        content_ids: input.contentIds,
        value: input.value,
        currency: input.currency ?? 'BRL',
        order_id: input.pedidoId,
      })
      break
  }
}
