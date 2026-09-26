import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { captureLojaOnlineAttributionFromUrl } from '../../lib/loja-online-attribution'
import {
  captureLojaOnlineInternalFromUrl,
  shouldSkipLojaOnlineAnalytics,
} from '../../lib/loja-online-internal-analytics'
import { trackLojaOnlineEvent } from '../../lib/loja-online-track'

/** Tracking first-party de page views + captura de UTM/fbclid. */
export function LojaOnlineTracker() {
  const { store } = useLojaOnlineStore()
  const location = useLocation()
  const lastPath = useRef('')

  useEffect(() => {
    captureLojaOnlineAttributionFromUrl(location.search)
    if (store?.empresa_id) captureLojaOnlineInternalFromUrl(store.empresa_id, location.search)
  }, [location.search, store?.empresa_id])

  useEffect(() => {
    const empresaId = store?.empresa_id
    if (!empresaId) return
    if (shouldSkipLojaOnlineAnalytics(empresaId)) return
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
