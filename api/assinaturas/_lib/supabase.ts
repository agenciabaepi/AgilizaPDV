import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'
import { getSupabaseServiceRoleKey, getSupabaseUrl } from './config'

let _supabase: SupabaseClient | null = null

function createAdminClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: {
      transport: ws as unknown as typeof WebSocket,
    },
  })
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabase) _supabase = createAdminClient()
  return _supabase
}
