import { useCallback, useEffect, useRef, useState } from 'react'
import {
  countLojaOnlinePedidosNotificacao,
  fetchLojaOnlinePedidosAcaoAdmin,
} from '../lib/loja-online-api'
import type { LojaOnlinePedido } from '../lib/loja-online-types'
import { supabase } from '../lib/supabase'

const POLL_MS = 30_000
const UPDATED_EVENT = 'agiliza:lojaOnlinePedidosUpdated'
const DISMISS_KEY_PREFIX = 'agiliza:lojaPedidosDismissed:'

type Listener = () => void

const listenersByEmpresa = new Map<string, Set<Listener>>()
const channelsByEmpresa = new Map<string, ReturnType<typeof supabase.channel>>()

function subscribeLojaOnlinePedidosRealtime(empresaId: string, listener: Listener): () => void {
  let listeners = listenersByEmpresa.get(empresaId)
  if (!listeners) {
    listeners = new Set()
    listenersByEmpresa.set(empresaId, listeners)

    const channel = supabase
      .channel(`loja-pedidos-notificacao-${empresaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loja_online_pedidos',
          filter: `empresa_id=eq.${empresaId}`,
        },
        () => {
          listenersByEmpresa.get(empresaId)?.forEach((cb) => cb())
        }
      )
      .subscribe()

    channelsByEmpresa.set(empresaId, channel)
  }

  listeners.add(listener)

  return () => {
    const current = listenersByEmpresa.get(empresaId)
    current?.delete(listener)
    if (current && current.size === 0) {
      const channel = channelsByEmpresa.get(empresaId)
      if (channel) void supabase.removeChannel(channel)
      channelsByEmpresa.delete(empresaId)
      listenersByEmpresa.delete(empresaId)
    }
  }
}

function loadDismissedIds(empresaId: string | null): Set<string> {
  if (!empresaId || typeof window === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem(`${DISMISS_KEY_PREFIX}${empresaId}`)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveDismissedIds(empresaId: string, ids: Set<string>) {
  sessionStorage.setItem(`${DISMISS_KEY_PREFIX}${empresaId}`, JSON.stringify([...ids]))
}

export function useLojaOnlinePedidosPendentes(empresaId: string | null, enabled: boolean) {
  const [pedidos, setPedidos] = useState<LojaOnlinePedido[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => loadDismissedIds(empresaId))
  const [pulse, setPulse] = useState(false)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)

  useEffect(() => {
    setDismissedIds(loadDismissedIds(empresaId))
    knownIdsRef.current = new Set()
    initializedRef.current = false
  }, [empresaId])

  const refresh = useCallback(() => {
    if (!empresaId || !enabled) {
      setPedidos([])
      return Promise.resolve()
    }
    return fetchLojaOnlinePedidosAcaoAdmin(empresaId)
      .then((list) => {
        setPedidos(list)
        const ids = new Set(list.map((p) => p.id))
        if (initializedRef.current) {
          const hasNew = list.some((p) => !knownIdsRef.current.has(p.id))
          if (hasNew) setPulse(true)
        } else {
          initializedRef.current = true
        }
        knownIdsRef.current = ids
      })
      .catch(() => setPedidos([]))
  }, [empresaId, enabled])

  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    const runRefresh = () => void refreshRef.current()

    runRefresh()
    if (!empresaId || !enabled) return

    const interval = window.setInterval(runRefresh, POLL_MS)
    const onFocus = () => runRefresh()
    const onUpdated = () => runRefresh()

    window.addEventListener('focus', onFocus)
    window.addEventListener(UPDATED_EVENT, onUpdated)

    const unsubscribeRealtime = subscribeLojaOnlinePedidosRealtime(empresaId, runRefresh)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(UPDATED_EVENT, onUpdated)
      unsubscribeRealtime()
    }
  }, [empresaId, enabled])

  const dismiss = useCallback(
    (pedidoId: string) => {
      if (!empresaId) return
      setDismissedIds((prev) => {
        const next = new Set(prev)
        next.add(pedidoId)
        saveDismissedIds(empresaId, next)
        return next
      })
    },
    [empresaId]
  )

  const visiblePedidos = pedidos.filter((p) => !dismissedIds.has(p.id))

  useEffect(() => {
    if (!pulse) return
    const t = window.setTimeout(() => setPulse(false), 4000)
    return () => window.clearTimeout(t)
  }, [pulse])

  return {
    count: visiblePedidos.length,
    pedidos: visiblePedidos,
    pulse,
    dismiss,
    refresh: () => {
      if (!empresaId || !enabled) return Promise.resolve()
      return countLojaOnlinePedidosNotificacao(empresaId).then(() => refresh())
    },
  }
}
