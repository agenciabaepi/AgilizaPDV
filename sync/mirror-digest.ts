/**
 * Detecção de divergência entre banco local (SQLite) e espelho Supabase.
 * Usa COUNT + MAX(updated_at)/MAX(created_at) por tabela/empresa — não compara campo a campo,
 * mas apanha a maior parte dos dessincs (web vs app).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type Database from 'better-sqlite3'

export type DigestTableSpec = {
  table: string
  empresaScoped: boolean
  /** Se false, só MAX(created_at) no SQLite. */
  hasUpdatedAt: boolean
}

/** Manter alinhado com `store-server/src/mirror-digest.ts`. */
export const MIRROR_DIGEST_TABLE_SPECS: DigestTableSpec[] = [
  { table: 'empresas', empresaScoped: false, hasUpdatedAt: false },
  { table: 'usuarios', empresaScoped: true, hasUpdatedAt: false },
  { table: 'empresas_config', empresaScoped: true, hasUpdatedAt: true },
  { table: 'categorias', empresaScoped: true, hasUpdatedAt: false },
  { table: 'marcas', empresaScoped: true, hasUpdatedAt: true },
  { table: 'produtos', empresaScoped: true, hasUpdatedAt: true },
  { table: 'clientes', empresaScoped: true, hasUpdatedAt: false },
  { table: 'fornecedores', empresaScoped: true, hasUpdatedAt: true },
]

export type TableDigest = {
  count: number
  /** Maior updated_at da tabela (ou null). */
  maxUpdated: string | null
  /** Maior created_at da tabela (ou null). */
  maxCreated: string | null
}

function maxIso(a: string | null, b: string | null): string | null {
  const ta = a ? new Date(a).getTime() : -Infinity
  const tb = b ? new Date(b).getTime() : -Infinity
  const t = Math.max(ta, tb)
  if (!Number.isFinite(t) || t < 0) return null
  return new Date(t).toISOString()
}

function digestPairEqual(a: TableDigest, b: TableDigest): boolean {
  if (a.count !== b.count) return false
  const fa = maxIso(a.maxUpdated, a.maxCreated)
  const fb = maxIso(b.maxUpdated, b.maxCreated)
  if (fa === fb) return true
  if (fa == null && fb == null) return true
  if (fa == null || fb == null) return false
  return Math.abs(new Date(fa).getTime() - new Date(fb).getTime()) <= 3000
}

function sqliteDigest(db: Database.Database, spec: DigestTableSpec, empresaId: string | null): TableDigest {
  if (!spec.empresaScoped) {
    const sql = spec.hasUpdatedAt
      ? `SELECT COUNT(*) AS c, MAX(updated_at) AS mu, MAX(created_at) AS mc FROM ${spec.table}`
      : `SELECT COUNT(*) AS c, NULL AS mu, MAX(created_at) AS mc FROM ${spec.table}`
    const row = db.prepare(sql).get() as { c: number; mu: string | null; mc: string | null }
    return { count: Number(row.c) || 0, maxUpdated: row.mu ?? null, maxCreated: row.mc ?? null }
  }
  const sql = spec.hasUpdatedAt
    ? `SELECT COUNT(*) AS c, MAX(updated_at) AS mu, MAX(created_at) AS mc FROM ${spec.table} WHERE empresa_id = ?`
    : `SELECT COUNT(*) AS c, NULL AS mu, MAX(created_at) AS mc FROM ${spec.table} WHERE empresa_id = ?`
  const row = db.prepare(sql).get(empresaId) as { c: number; mu: string | null; mc: string | null }
  return { count: Number(row.c) || 0, maxUpdated: row.mu ?? null, maxCreated: row.mc ?? null }
}

async function supabaseDigest(
  supabase: SupabaseClient,
  spec: DigestTableSpec,
  empresaId: string | null
): Promise<TableDigest> {
  let head = supabase.from(spec.table).select('id', { count: 'exact', head: true })
  if (spec.empresaScoped && empresaId) head = head.eq('empresa_id', empresaId)
  const { count, error: e0 } = await head
  if (e0) throw e0
  const c = count ?? 0

  if (spec.hasUpdatedAt) {
    let qU = supabase.from(spec.table).select('updated_at')
    if (spec.empresaScoped && empresaId) qU = qU.eq('empresa_id', empresaId)
    const { data: du, error: eU } = await qU.not('updated_at', 'is', null).order('updated_at', { ascending: false }).limit(1)
    if (eU) throw eU
    let qC = supabase.from(spec.table).select('created_at')
    if (spec.empresaScoped && empresaId) qC = qC.eq('empresa_id', empresaId)
    const { data: dc, error: eC } = await qC.order('created_at', { ascending: false }).limit(1)
    if (eC) throw eC
    return {
      count: c,
      maxUpdated: (du?.[0] as { updated_at?: string } | undefined)?.updated_at ?? null,
      maxCreated: (dc?.[0] as { created_at?: string } | undefined)?.created_at ?? null,
    }
  }

  let qC2 = supabase.from(spec.table).select('created_at')
  if (spec.empresaScoped && empresaId) qC2 = qC2.eq('empresa_id', empresaId)
  const { data: dc, error: eC } = await qC2.order('created_at', { ascending: false }).limit(1)
  if (eC) throw eC
  return {
    count: c,
    maxUpdated: null,
    maxCreated: (dc?.[0] as { created_at?: string } | undefined)?.created_at ?? null,
  }
}

export type MirrorDigestResult = {
  mismatch: boolean
  details: string[]
}

/**
 * Compara digest local vs Supabase para cadastros espelhados.
 */
export async function compareMirrorDigestSqlite(
  db: Database.Database,
  supabase: SupabaseClient
): Promise<MirrorDigestResult> {
  const details: string[] = []
  const empresas = db.prepare('SELECT id FROM empresas').all() as { id: string }[]
  const empresaIds = empresas.map((e) => e.id)

  for (const spec of MIRROR_DIGEST_TABLE_SPECS) {
    try {
      if (!spec.empresaScoped) {
        const loc = sqliteDigest(db, spec, null)
        const rem = await supabaseDigest(supabase, spec, null)
        if (!digestPairEqual(loc, rem)) {
          details.push(
            `${spec.table}: local count=${loc.count} pair=${maxIso(loc.maxUpdated, loc.maxCreated)} | remoto count=${rem.count} pair=${maxIso(rem.maxUpdated, rem.maxCreated)}`
          )
        }
        continue
      }
      if (empresaIds.length === 0) continue
      for (const eid of empresaIds) {
        const loc = sqliteDigest(db, spec, eid)
        const rem = await supabaseDigest(supabase, spec, eid)
        if (!digestPairEqual(loc, rem)) {
          details.push(
            `${spec.table} empresa=${eid}: local count=${loc.count} pair=${maxIso(loc.maxUpdated, loc.maxCreated)} | remoto count=${rem.count} pair=${maxIso(rem.maxUpdated, rem.maxCreated)}`
          )
        }
      }
    } catch (err) {
      details.push(`${spec.table}: erro ao comparar — ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { mismatch: details.length > 0, details }
}
