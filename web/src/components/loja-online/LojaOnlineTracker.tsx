import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { captureLojaOnlineAttributionFromUrl } from '../../lib/loja-online-attribution'
import { trackLojaOnlineEvent } from '../../lib/loja-online-track'

/** Tracking first-party de page views + captura de UTM/fbclid. */
export function LojaOnlineTracker() {
  const { store } = useLojaOnlineStore()
  const location = useLocation()
  const lastPath = useRef('')

  useEffect(() => {
    captureLojaOnlineAttributionFromUrl(location.search)
  }, [location.search])

  useEffect(() => {
    const empresaId = store?.empresa_id
    if (!empresaId) return
    const path = `${location.pathname}${location.search}`
    if (lastPath.current === path) return
    lastPath.current = path
    void trackLojaOnlineEvent({
      empresaId,
      eventName: 'page_view',
      path: location.pathname,
    })
  }, [store?.empresa_id, location.pathname, location.search])

  return null
}
