import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'
import {
  captureLojaOnlineAttributionFromUrl,
  detectLojaOnlineDevice,
  getOrCreateLojaOnlineSessionId,
} from '../../lib/loja-online-attribution'
import {
  LOJA_ONLINE_AO_VIVO_ABA_OCULTA_MS,
  LOJA_ONLINE_AO_VIVO_MARCAR_INTERNO,
  lojaOnlineAoVivoChannelName,
  readLojaOnlineGeo,
  type LojaOnlineAoVivoVisitante,
} from '../../lib/loja-online-ao-vivo'
import {
  captureLojaOnlineInternalFromUrl,
  markLojaOnlineInternalAccess,
  shouldSkipLojaOnlineAnalytics,
} from '../../lib/loja-online-internal-analytics'
import { trackLojaOnlineEvent } from '../../lib/loja-online-track'
import { initLojaOnlineBehavior, notifyLojaOnlineBehaviorRoute } from '../../lib/loja-online-behavior'
import { supabase } from '../../lib/supabase'

/** Presença em tempo real do visitante (painel "Ao vivo" do dashboard). */
function useLojaOnlineAoVivoPresence(empresaId: string | undefined, path: string, carrinho: boolean) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [joined, setJoined] = useState(false)
  const desdeRef = useRef(Date.now())
  const paginaDesdeRef = useRef(Date.now())
  const lastPathRef = useRef(path)
  const [geoTick, setGeoTick] = useState(0)

  useEffect(() => {
    const onGeo = () => setGeoTick((n) => n + 1)
    window.addEventListener('agiliza:loja-geo', onGeo)
    return () => window.removeEventListener('agiliza:loja-geo', onGeo)
  }, [])

  const [marcadoInterno, setMarcadoInterno] = useState(false)
  const [ativo, setAtivo] = useState(() => typeof document === 'undefined' || !document.hidden)

  useEffect(() => {
    let timer: number | undefined
    const onVisibility = () => {
      window.clearTimeout(timer)
      if (document.hidden) {
        timer = window.setTimeout(() => setAtivo(false), LOJA_ONLINE_AO_VIVO_ABA_OCULTA_MS)
      } else {
        setAtivo(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const skip =
    !empresaId ||
    marcadoInterno ||
    shouldSkipLojaOnlineAnalytics(empresaId) ||
    (typeof navigator !== 'undefined' && navigator.webdriver)

  useEffect(() => {
    if (skip || !empresaId) return
    const sessionId = getOrCreateLojaOnlineSessionId()
    const channel = supabase.channel(lojaOnlineAoVivoChannelName(empresaId), {
      config: { presence: { key: sessionId } },
    })
    channelRef.current = channel
    channel
      .on('broadcast', { event: LOJA_ONLINE_AO_VIVO_MARCAR_INTERNO }, ({ payload }) => {
        if ((payload as { sessionId?: string } | null)?.sessionId !== sessionId) return
        markLojaOnlineInternalAccess(empresaId)
        void channel.untrack()
        setMarcadoInterno(true)
      })
      .subscribe((status) => setJoined(status === 'SUBSCRIBED'))
    return () => {
      setJoined(false)
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [empresaId, skip])

  useEffect(() => {
    const channel = channelRef.current
    if (skip || !channel || !joined) return
    if (!ativo) {
      void channel.untrack()
      return
    }
    if (lastPathRef.current !== path) {
      lastPathRef.current = path
      paginaDesdeRef.current = Date.now()
    }
    const timer = window.setTimeout(() => {
      const geo = readLojaOnlineGeo()
      const payload: LojaOnlineAoVivoVisitante = {
        sessionId: getOrCreateLojaOnlineSessionId(),
        path,
        titulo: document.title?.trim() || null,
        device: detectLojaOnlineDevice().device,
        city: geo?.city ?? null,
        region: geo?.region ?? null,
        country: geo?.country ?? null,
        carrinho,
        checkout: /\/checkout$/.test(path),
        desde: desdeRef.current,
        paginaDesde: paginaDesdeRef.current,
      }
      void channel.track(payload)
    }, 600)
    return () => window.clearTimeout(timer)
  }, [skip, joined, ativo, path, carrinho, geoTick])
}

/** Tracking first-party de page views + captura de UTM/fbclid. */
export function LojaOnlineTracker() {
  const { store } = useLojaOnlineStore()
  const { count } = useLojaOnlineCart()
  const location = useLocation()
  const lastPath = useRef('')

  useLojaOnlineAoVivoPresence(store?.empresa_id, location.pathname, count > 0)

  useEffect(() => {
    captureLojaOnlineAttributionFromUrl(location.search)
    if (store?.empresa_id) captureLojaOnlineInternalFromUrl(store.empresa_id, location.search)
  }, [location.search, store?.empresa_id])

  useEffect(() => {
    if (!store?.empresa_id) return
    return initLojaOnlineBehavior(store.empresa_id, location.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rota inicial; trocas vão pelo efeito abaixo
  }, [store?.empresa_id])

  useEffect(() => {
    notifyLojaOnlineBehaviorRoute(location.pathname)
  }, [location.pathname])

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
