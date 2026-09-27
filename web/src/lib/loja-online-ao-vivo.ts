/** Visitantes ao vivo na loja online (Supabase Realtime Presence, sem gravar no banco). */

import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

const GEO_KEY = 'agiliza:loja-geo'

export type LojaOnlineGeo = { country: string | null; region: string | null; city: string | null }

export type LojaOnlineAoVivoVisitante = {
  sessionId: string
  path: string
  titulo: string | null
  device: string
  city: string | null
  region: string | null
  country: string | null
  carrinho: boolean
  checkout: boolean
  desde: number
  paginaDesde: number
}

export const LOJA_ONLINE_AO_VIVO_MARCAR_INTERNO = 'marcar-interno'
export const LOJA_ONLINE_AO_VIVO_ABA_OCULTA_MS = 2 * 60 * 1000

export function lojaOnlineAoVivoChannelName(empresaId: string): string {
  return `loja-online-ao-vivo:${empresaId}`
}

export function readLojaOnlineGeo(): LojaOnlineGeo | null {
  try {
    const raw = sessionStorage.getItem(GEO_KEY)
    return raw ? (JSON.parse(raw) as LojaOnlineGeo) : null
  } catch {
    return null
  }
}

export function saveLojaOnlineGeo(geo: LojaOnlineGeo) {
  if (!geo.city && !geo.region && !geo.country) return
  try {
    sessionStorage.setItem(GEO_KEY, JSON.stringify(geo))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('agiliza:loja-geo'))
}

export function lojaOnlineAoVivoLocal(v: Pick<LojaOnlineAoVivoVisitante, 'city' | 'region' | 'country'>): string {
  if (v.city && v.region) return `${v.city}, ${v.region}`
  if (v.city) return v.city
  if (v.region) return v.region
  if (v.country) return v.country === 'BR' ? 'Brasil' : v.country
  return 'Local desconhecido'
}

/** Assina o canal de presença da loja e devolve a lista de visitantes a cada mudança. */
export function subscribeLojaOnlineAoVivo(
  empresaId: string,
  onChange: (visitantes: LojaOnlineAoVivoVisitante[]) => void
): { stop: () => void; marcarInterno: (sessionId: string) => Promise<void> } {
  const channel: RealtimeChannel = supabase.channel(lojaOnlineAoVivoChannelName(empresaId))

  const emit = () => {
    const state = channel.presenceState<LojaOnlineAoVivoVisitante>()
    const bySession = new Map<string, LojaOnlineAoVivoVisitante>()
    for (const metas of Object.values(state)) {
      for (const m of metas) {
        if (!m?.sessionId) continue
        const prev = bySession.get(m.sessionId)
        if (!prev || m.paginaDesde > prev.paginaDesde) bySession.set(m.sessionId, m)
      }
    }
    onChange([...bySession.values()].sort((a, b) => a.desde - b.desde))
  }

  channel
    .on('presence', { event: 'sync' }, emit)
    .on('presence', { event: 'join' }, emit)
    .on('presence', { event: 'leave' }, emit)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') emit()
    })

  return {
    stop: () => {
      void supabase.removeChannel(channel)
    },
    /** Pede ao navegador do visitante para se marcar como acesso interno (dono/equipe). */
    marcarInterno: async (sessionId: string) => {
      await channel.send({ type: 'broadcast', event: LOJA_ONLINE_AO_VIVO_MARCAR_INTERNO, payload: { sessionId } })
    },
  }
}
