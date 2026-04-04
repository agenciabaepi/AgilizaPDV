import { reconcileMirrorDigestFull } from './mirror-digest-reconcile'

const DIGEST_INTERVAL_MS = 55_000

/** Verificação periódica Postgres ↔ Supabase (cadastros). */
export function startMirrorDigestScheduler(): void {
  setInterval(() => {
    void reconcileMirrorDigestFull().catch((e) => {
      console.error('[agiliza-store] mirror-digest:', e instanceof Error ? e.message : e)
    })
  }, DIGEST_INTERVAL_MS)
}
