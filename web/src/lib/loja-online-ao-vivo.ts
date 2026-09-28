/** Visitantes ao vivo na loja online (Supabase Realtime Presence, sem gravar no banco). */

import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { presencaListar, type PresencaRow } from './loja-online-ia-api'

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
  /** Aba em segundo plano (visitante trocou de aba/app há pouco). */
  oculto?: boolean
}

export const LOJA_ONLINE_AO_VIVO_MARCAR_INTERNO = 'marcar-interno'
export const LOJA_ONLINE_PRESENCA_HEARTBEAT_MS = 20_000

const PRESENCA_ENDPOINT = '/api/loja-online/presenca'

/** Sinal de vida do visitante para o "Ao vivo" (não depende do WebSocket, que cai no celular). */
export function enviarLojaOnlinePresenca(
  body: { empresaId: string; saindo?: boolean; primeiro?: boolean; oculto?: boolean } & Partial<LojaOnlineAoVivoVisitante>,
  opts: { beacon?: boolean } = {}
) {
  const json = JSON.stringify(body)
  try {
    if (opts.beacon && navigator.sendBeacon) {
      navigator.sendBeacon(PRESENCA_ENDPOINT, new Blob([json], { type: 'application/json' }))
      return
    }
    void fetch(PRESENCA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* analytics nunca quebra a loja */
  }
}
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

const POLL_MS = 8_000

export type LojaOnlineAoVivoStatus = {
  /** Última leitura bem-sucedida do servidor (ms). */
  atualizadoEm: number | null
  realtime: boolean
  erro: boolean
}

function fromPresencaRow(r: PresencaRow): LojaOnlineAoVivoVisitante {
  return {
    sessionId: r.session_id,
    path: r.path ?? '/',
    titulo: r.titulo,
    device: r.device ?? 'desktop',
    city: r.city,
    region: r.region,
    country: r.country,
    carrinho: r.carrinho,
    checkout: r.checkout,
    oculto: r.oculto,
    desde: Date.parse(r.desde),
    paginaDesde: Date.parse(r.pagina_desde),
  }
}

/**
 * Lista de visitantes ao vivo: une o Realtime Presence (aparece na hora) com o sinal de vida
 * gravado no servidor (não some quando o WebSocket do visitante ou do painel cai).
 */
export function subscribeLojaOnlineAoVivo(
  empresaId: string,
  onChange: (visitantes: LojaOnlineAoVivoVisitante[], status: LojaOnlineAoVivoStatus) => void
): { stop: () => void; marcarInterno: (sessionId: string) => Promise<void> } {
  const channel: RealtimeChannel = supabase.channel(lojaOnlineAoVivoChannelName(empresaId))
  let servidor: LojaOnlineAoVivoVisitante[] = []
  const status: LojaOnlineAoVivoStatus = { atualizadoEm: null, realtime: false, erro: false }
  let parado = false

  const emit = () => {
    if (parado) return
    const bySession = new Map<string, LojaOnlineAoVivoVisitante>()
    const juntar = (m: LojaOnlineAoVivoVisitante) => {
      if (!m?.sessionId) return
      const prev = bySession.get(m.sessionId)
      if (!prev) bySession.set(m.sessionId, m)
      else if (m.paginaDesde > prev.paginaDesde) {
        bySession.set(m.sessionId, {
          ...m,
          city: m.city ?? prev.city,
          region: m.region ?? prev.region,
          country: m.country ?? prev.country,
          oculto: prev.oculto ?? m.oculto,
        })
      }
    }
    for (const v of servidor) juntar(v)
    for (const metas of Object.values(channel.presenceState<LojaOnlineAoVivoVisitante>())) {
      for (const m of metas) juntar(m)
    }
    onChange([...bySession.values()].sort((a, b) => a.desde - b.desde), { ...status })
  }

  const poll = async () => {
    try {
      const r = await presencaListar(empresaId)
      servidor = r.visitantes.map(fromPresencaRow)
      status.atualizadoEm = Date.now()
      status.erro = false
    } catch {
      status.erro = true
    }
    emit()
  }
  void poll()
  const timer = window.setInterval(() => {
    if (!document.hidden) void poll()
  }, POLL_MS)
  const onVisible = () => {
    if (!document.hidden) void poll()
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onVisible)

  channel
    .on('presence', { event: 'sync' }, emit)
    .on('presence', { event: 'join' }, emit)
    .on('presence', { event: 'leave' }, emit)
    .subscribe((s) => {
      status.realtime = s === 'SUBSCRIBED'
      emit()
    })

  return {
    stop: () => {
      parado = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
      void supabase.removeChannel(channel)
    },
    /** Pede ao navegador do visitante para se marcar como acesso interno (dono/equipe). */
    marcarInterno: async (sessionId: string) => {
      await channel.send({ type: 'broadcast', event: LOJA_ONLINE_AO_VIVO_MARCAR_INTERNO, payload: { sessionId } })
    },
  }
}
