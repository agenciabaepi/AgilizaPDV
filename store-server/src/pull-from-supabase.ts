import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { PoolClient } from 'pg'
import { withTransaction } from './db'
import { EMPRESAS_CONFIG_PULL_PG_DEFAULTS, type EmpresasConfigMirrorFieldKey } from './empresas-config-mirror'
import { markAllPendingAsSent } from './outbox'
import { PULL_FISCAL_MERGE_TABLES, PULL_TABLES, PULL_TABLES_REPLACE, PULL_TABLES_REPLACE_REVERSE } from './pull-tables'

const PULL_EMPRESAS_DEF = PULL_TABLES.find((t) => t.table === 'empresas')!
const PULL_USUARIOS_DEF = PULL_TABLES.find((t) => t.table === 'usuarios')!

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_ANON_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key)
}

function toPgParam(val: unknown): unknown {
  if (val == null) return null
  if (typeof val === 'string') return val
  if (typeof val === 'number' && !Number.isNaN(val)) return val
  if (typeof val === 'boolean') return val ? 1 : 0
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'object' && typeof (val as { toISOString?: () => string }).toISOString === 'function') {
    return (val as { toISOString: () => string }).toISOString()
  }
  return String(val)
}

function postgresValuesForPullRow(table: string, columns: string[], row: Record<string, unknown>): unknown[] {
  if (table === 'empresas_config') {
    return columns.map((col) => {
      const v = row[col]
      if (v !== undefined && v !== null) return toPgParam(v)
      if (col === 'updated_at') return toPgParam(new Date().toISOString())
      const d = EMPRESAS_CONFIG_PULL_PG_DEFAULTS[col as EmpresasConfigMirrorFieldKey]
      if (d !== undefined) return d
      return null
    })
  }
  return columns.map((col) => {
    if ((table === 'venda_nfce' || table === 'venda_nfe') && col === 'xml_local_path') {
      return null
    }
    const v = row[col]
    if (v !== undefined && v !== null) return toPgParam(v)
    if (table === 'vendas' && col === 'venda_a_prazo') return 0
    return null
  })
}

async function snapshotEmpresasConfigCsc(
  client: PoolClient
): Promise<Map<string, { csc_nfce: string | null; csc_id_nfce: string | null }>> {
  const m = new Map<string, { csc_nfce: string | null; csc_id_nfce: string | null }>()
  const res = await client.query<{ empresa_id: string; csc_nfce: string | null; csc_id_nfce: string | null }>(
    'SELECT empresa_id, csc_nfce, csc_id_nfce FROM empresas_config'
  )
  for (const r of res.rows) {
    m.set(r.empresa_id, { csc_nfce: r.csc_nfce ?? null, csc_id_nfce: r.csc_id_nfce ?? null })
  }
  return m
}

function mergePulledEmpresasConfigCsc(
  empresaId: string,
  columns: string[],
  values: unknown[],
  backup: Map<string, { csc_nfce: string | null; csc_id_nfce: string | null }>
): void {
  const idxCsc = columns.indexOf('csc_nfce')
  const idxId = columns.indexOf('csc_id_nfce')
  if (idxCsc < 0 && idxId < 0) return
  const str = (x: unknown) => (x != null && String(x).trim() !== '' ? String(x) : null)
  const remoteCsc = idxCsc >= 0 ? str(values[idxCsc]) : null
  const remoteId = idxId >= 0 ? str(values[idxId]) : null
  const prev = backup.get(empresaId)
  if (idxCsc >= 0 && !remoteCsc && prev?.csc_nfce?.trim()) {
    values[idxCsc] = prev.csc_nfce
  }
  if (idxId >= 0 && !remoteId && prev?.csc_id_nfce?.trim()) {
    values[idxId] = prev.csc_id_nfce
  }
}

async function shouldSkipStaleFiscalMirrorPull(
  client: PoolClient,
  table: string,
  vendaId: string,
  remoteStatusRaw: unknown
): Promise<boolean> {
  if (table !== 'venda_nfce' && table !== 'venda_nfe') return false
  const remote = remoteStatusRaw != null ? String(remoteStatusRaw).trim().toUpperCase() : ''
  const r = await client.query<{ status: string }>(`SELECT status FROM ${table} WHERE venda_id = $1`, [vendaId])
  const local = r.rows[0]
  const ls = local?.status != null ? String(local.status).trim().toUpperCase() : ''
  if (ls !== 'AUTORIZADA') return false
  if (remote === 'AUTORIZADA' || remote === 'CANCELADA') return false
  return true
}

async function upsertEmpresasFromMirror(client: PoolClient, rows: Record<string, unknown>[]): Promise<void> {
  const { columns } = PULL_EMPRESAS_DEF
  const ph = columns.map((_, i) => `$${i + 1}`).join(', ')
  const setClause = columns
    .filter((c) => c !== 'id')
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(', ')
  const sql = `INSERT INTO empresas (${columns.join(', ')}) VALUES (${ph}) ON CONFLICT (id) DO UPDATE SET ${setClause}`
  for (const row of rows) {
    const vals = postgresValuesForPullRow('empresas', columns, row)
    await client.query(sql, vals)
  }
}

async function upsertUsuariosFromMirror(client: PoolClient, rows: Record<string, unknown>[]): Promise<void> {
  const { columns } = PULL_USUARIOS_DEF
  const ph = columns.map((_, i) => `$${i + 1}`).join(', ')
  const setClause = columns
    .filter((c) => c !== 'id')
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(', ')
  const sql = `INSERT INTO usuarios (${columns.join(', ')}) VALUES (${ph}) ON CONFLICT (id) DO UPDATE SET ${setClause}`
  for (const row of rows) {
    const vals = postgresValuesForPullRow('usuarios', columns, row)
    await client.query(sql, vals)
  }
}

async function insertReplaceRows(
  client: PoolClient,
  table: string,
  columns: string[],
  list: Record<string, unknown>[],
  cscBackup: Map<string, { csc_nfce: string | null; csc_id_nfce: string | null }>
): Promise<void> {
  if (list.length === 0) return
  const ph = columns.map((_, i) => `$${i + 1}`).join(', ')
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${ph})`
  for (const row of list) {
    const values = postgresValuesForPullRow(table, columns, row as Record<string, unknown>)
    if (table === 'empresas_config') {
      const eid = row.empresa_id != null ? String(row.empresa_id) : ''
      if (eid) mergePulledEmpresasConfigCsc(eid, columns, values, cscBackup)
    }
    await client.query(sql, values)
  }
}

async function upsertFiscalRows(
  client: PoolClient,
  table: string,
  columns: string[],
  list: Record<string, unknown>[]
): Promise<void> {
  if (list.length === 0) return
  const updateCols = columns.filter((c) => c !== 'venda_id')
  const setClause = updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ')
  const ph = columns.map((_, i) => `$${i + 1}`).join(', ')
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${ph}) ON CONFLICT (venda_id) DO UPDATE SET ${setClause}`
  for (const row of list) {
    const vendaId = row.venda_id != null ? String(row.venda_id) : ''
    if (vendaId && (await shouldSkipStaleFiscalMirrorPull(client, table, vendaId, row.status))) {
      continue
    }
    const values = postgresValuesForPullRow(table, columns, row as Record<string, unknown>)
    await client.query(sql, values)
  }
}

async function syncEmpresaVendaPrazoFromConfig(client: PoolClient): Promise<void> {
  await client.query(`
    UPDATE empresas e SET
      venda_prazo_usar_limite_credito = COALESCE(c.venda_prazo_usar_limite_credito, 0),
      venda_prazo_bloquear_inadimplente = COALESCE(c.venda_prazo_bloquear_inadimplente, 0)
    FROM empresas_config c
    WHERE c.empresa_id = e.id
  `)
}

/**
 * Copia o espelho Supabase → Postgres (mesma ideia que `pullFromSupabase` no Electron/SQLite).
 */
export async function pullFromSupabaseIntoPostgres(): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabase()
  if (!supabase) return { success: false, message: 'Supabase não configurado no servidor da loja (SUPABASE_URL / SUPABASE_ANON_KEY).' }

  try {
    const rowsByTable: Record<string, Record<string, unknown>[]> = {}
    for (const { table } of PULL_TABLES) {
      const { data: rows, error } = await supabase.from(table).select('*')
      if (error) throw error
      rowsByTable[table] = (rows ?? []) as Record<string, unknown>[]
    }

    await withTransaction(async (client) => {
      const cscBackup = await snapshotEmpresasConfigCsc(client)

      for (const { table } of PULL_TABLES_REPLACE_REVERSE) {
        await client.query(`DELETE FROM ${table}`)
      }

      await upsertEmpresasFromMirror(client, rowsByTable.empresas ?? [])
      await upsertUsuariosFromMirror(client, rowsByTable.usuarios ?? [])

      for (const { table, columns } of PULL_TABLES_REPLACE) {
        const list = rowsByTable[table] ?? []
        await insertReplaceRows(client, table, columns, list, cscBackup)
      }

      for (const table of PULL_FISCAL_MERGE_TABLES) {
        const def = PULL_TABLES.find((t) => t.table === table)
        if (!def) continue
        await upsertFiscalRows(client, def.table, def.columns, rowsByTable[table] ?? [])
      }

      await syncEmpresaVendaPrazoFromConfig(client)
    })

    await markAllPendingAsSent()
    return { success: true, message: 'Dados do Supabase copiados para o PostgreSQL da loja.' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, message: msg }
  }
}
