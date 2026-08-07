import { useEffect } from 'react'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
    _fbq?: unknown
  }
}

export function LojaOnlineAnalytics() {
  const { store } = useLojaOnlineStore()
  const ga4 = store?.loja_online_ga4_id?.trim()
  const pixel = store?.loja_online_meta_pixel_id?.trim()

  useEffect(() => {
    if (!ga4) return
    if (!window.dataLayer) window.dataLayer = []
    if (!document.getElementById('loja-ga4')) {
      const s = document.createElement('script')
      s.id = 'loja-ga4'
      s.async = true
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4)}`
      document.head.appendChild(s)
      window.gtag = function gtag(...args: unknown[]) {
        window.dataLayer!.push(args)
      }
      window.gtag('js', new Date())
      window.gtag('config', ga4, { send_page_view: true })
    } else {
      window.gtag?.('config', ga4, { page_path: window.location.pathname })
    }
  }, [ga4])

  useEffect(() => {
    if (!pixel) return
    if (!window.fbq) {
      const n: Window['fbq'] = function (...args: unknown[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(n as any).callMethod ? (n as any).callMethod(...args) : (n as any).queue.push(args)
      }
      if (!window._fbq) window._fbq = n
      window.fbq = n
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(n as any).push = n
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(n as any).loaded = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(n as any).version = '2.0'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(n as any).queue = []
      const s = document.createElement('script')
      s.id = 'loja-meta-pixel'
      s.async = true
      s.src = 'https://connect.facebook.net/en_US/fbevents.js'
      document.head.appendChild(s)
      window.fbq('init', pixel)
    }
    window.fbq?.('track', 'PageView')
  }, [pixel])

  return null
}
