import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { pullFromSupabaseIntoPostgres } from './pull-from-supabase'
import { broadcast } from './ws'

const CLOCK_TABLE = 'pdv_sync_clock'
const FALLBACK_POLL_MS = 45_000
const PULL_DEBOUNCE_MS = 500

let lastSeenMs = -1
let pullInFlight: Promise<boolean> | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function parseRemoteTs(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && typeof (value as { toISOString?: () => string }).toISOString === 'function') {
    return (value as { toISOString: () => string }).toISOString()
  }
  return null
}

async function runPullAndNotify(reason: string): Promise<boolean> {
  if (pullInFlight) return pullInFlight
  const p = (async (): Promise<boolean> => {
    try {
      const r = await pullFromSupabaseIntoPostgres()
      if (r.success) {
        broadcast({ type: 'sync:dataUpdated' })
        console.log(`[agiliza-store] Espelho Supabase → Postgres (${reason})`)
        return true
      }
      console.warn(`[agiliza-store] Pull espelho falhou (${reason}):`, r.message)
      return false
    } finally {
      pullInFlight = null
    }
  })()
  pullInFlight = p
  return p
}

function schedulePull(reason: string, pendingMs: number): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void (async () => {
      const ok = await runPullAndNotify(reason)
      if (ok) lastSeenMs = pendingMs
    })()
  }, PULL_DEBOUNCE_MS)
}

async function onRemoteClockNewer(remoteIso: string, reason: string): Promise<void> {
  const ms = new Date(remoteIso).getTime()
  if (!Number.isFinite(ms)) return

  if (lastSeenMs < 0) {
    const ok = await runPullAndNotify(reason)
    if (ok) lastSeenMs = ms
    return
  }
  if (ms <= lastSeenMs) return
  schedulePull(reason, ms)
}

async function fetchClockRow(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.from(CLOCK_TABLE).select('last_update').eq('id', 1).maybeSingle()
  if (error) return null
  return parseRemoteTs(data?.last_update)
}

/**
 * Terminais Windows (e outros) nem sempre recebem Realtime do Supabase no Electron.
 * O store-server observa `pdv_sync_clock`, puxa o espelho para o Postgres e avisa os PDVs pelo WebSocket `/ws`.
 */
export function startSupabaseMirrorWatcher(): void {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_ANON_KEY?.trim()
  if (!url || !key) return

  const supabase = createClient(url, key)

  void (async () => {
    const initial = await fetchClockRow(supabase)
    if (initial) {
      lastSeenMs = -1
      await onRemoteClockNewer(initial, 'inicialização')
    }
  })()

  supabase
    .channel('store_pdv_sync_clock')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: CLOCK_TABLE },
      (payload: { new?: Record<string, unknown> }) => {
        const ts = parseRemoteTs(payload.new?.last_update)
        if (ts) void onRemoteClockNewer(ts, 'realtime')
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[agiliza-store] Realtime pdv_sync_clock:', status, '(fallback por polling)')
      }
    })

  setInterval(() => {
    void (async () => {
      const ts = await fetchClockRow(supabase)
      if (ts) await onRemoteClockNewer(ts, 'polling')
    })()
  }, FALLBACK_POLL_MS)
}
