import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.generated'

/**
 * O instalador embute Supabase em `supabase-config.generated.ts` (CI / env.install).
 * O store-server só lia `store-server.env` — em modo servidor as edições vão para a API/outbox
 * no Postgres, e o sync para o espelho roda **no processo do store-server**. Sem SUPABASE_* aí,
 * o espelho nunca atualizava mesmo com o GitHub correto.
 */
export function mergeBuildSupabaseIntoEnvIfMissing(env: NodeJS.ProcessEnv): void {
  const url = env.SUPABASE_URL?.trim()
  const key = env.SUPABASE_ANON_KEY?.trim()
  const bu = (SUPABASE_URL ?? '').trim()
  const bk = (SUPABASE_ANON_KEY ?? '').trim()
  if (!url && bu) env.SUPABASE_URL = bu
  if (!key && bk) env.SUPABASE_ANON_KEY = bk
}
