import { createClient } from '@supabase/supabase-js'
import { compareMirrorDigestPostgres } from './mirror-digest'
import { runSync } from './sync-supabase'
import { pullFromSupabaseIntoPostgres } from './pull-from-supabase'
import { broadcast } from './ws'

export type MirrorReconcileResult = {
  ok: boolean
  hadMismatch: boolean
  details: string[]
  message: string
}

/**
 * Compara Postgres da loja com Supabase; se divergir, faz push (outbox) + pull do espelho
 * e notifica terminais. Complementa o relógio `pdv_sync_clock` (casos em que o digest apanha
 * diferenças sem o relógio ter mudado como esperado).
 */
export async function reconcileMirrorDigestFull(): Promise<MirrorReconcileResult> {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_ANON_KEY?.trim()
  if (!url || !key) {
    return { ok: false, hadMismatch: false, details: [], message: 'Supabase não configurado no servidor.' }
  }

  const supabase = createClient(url, key)
  const { mismatch, details } = await compareMirrorDigestPostgres(supabase)
  if (!mismatch) {
    return { ok: true, hadMismatch: false, details: [], message: 'Cadastros espelho alinhados (digest).' }
  }

  const preview = details.slice(0, 6).join(' | ')
  console.warn('[agiliza-store] Digest divergente — reconciliando:', preview)

  const push = await runSync()
  if (!push.success) {
    return {
      ok: false,
      hadMismatch: true,
      details,
      message: `Digest divergente; push falhou: ${push.message}`,
    }
  }

  const pull = await pullFromSupabaseIntoPostgres()
  if (pull.success) {
    broadcast({ type: 'sync:dataUpdated' })
  }

  return {
    ok: pull.success,
    hadMismatch: true,
    details,
    message: pull.success ? 'Digest divergente corrigido (push + pull).' : `Pull falhou: ${pull.message}`,
  }
}
