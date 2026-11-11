import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'

const FALLBACK_URL = 'https://xyflyetsvsoanhslaxyd.supabase.co'
const FALLBACK_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5Zmx5ZXRzdnNvYW5oc2xheHlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzMwODAsImV4cCI6MjA4ODIwOTA4MH0.cjNELwkashKJI52Mt0IZaHkgiP2kcbFo-Rc_tyqY_wo'

function resolveConfig(): { url: string; anonKey: string } {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || FALLBACK_URL).trim()
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    FALLBACK_ANON
  ).trim()
  return { url, anonKey }
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!client) {
    const { url, anonKey } = resolveConfig()
    // Electron usa Node < 22: supabase-js exige transport WebSocket explícito.
    client = createClient(url, anonKey, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      realtime: { transport: ws as any }
    })
  }
  return client
}
