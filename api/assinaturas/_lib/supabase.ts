import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'
import { getSupabaseServiceRoleKey, getSupabaseUrl } from './config'

let _supabase: SupabaseClient | null = null
let _supabaseKey = ''

function createAdminClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: {
      transport: ws as unknown as typeof WebSocket,
    },
  })
}

export function getSupabaseAdmin(): SupabaseClient {
  const url = getSupabaseUrl()
  const key = getSupabaseServiceRoleKey()
  // Em dev o .env pode mudar sem reiniciar o processo: recria se a credencial mudou
  if (!_supabase || _supabaseKey !== `${url}|${key}`) {
    _supabase = createAdminClient(url, key)
    _supabaseKey = `${url}|${key}`
  }
  return _supabase
}
