import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getDb } from '../backend/db'
import { getLastLocalUpdate, setLastLocalUpdate } from '../backend/sync-clock'
import { getCategoriaPathForSync } from '../backend/services/categorias.service'
import { getSaldo } from '../backend/services/estoque.service'
import { getPending, markSent, markError, incrementAttempts, markAllPendingAsSent, getPendingCount } from './outbox'

const MAX_SYNC_ATTEMPTS = 5

/** Ordem de entidades para respeitar FKs: categorias antes de produtos, etc. */
const ENTITY_SYNC_ORDER: Record<string, number> = {
  empresas: 0,
  categorias: 1,
  produtos: 2,
  estoque_movimentos: 3,
  vendas: 4
}

/** Tabela de eventos (audit log) */
export const SYNC_TABLE_NAME = 'pdv_sync_events'

export type SyncResult = {
  success: boolean
  sent: number
  errors: number
  message: string
}

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_ANON_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key)
}

/** Converte payload para formato aceito pelo Supabase (snake_case, datas ISO) */
function toMirrorRow(payload: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined) continue
    row[k] = v
  }
  return row
}

/** Retorna itens e pagamentos de uma venda do banco local (para espelho) */
function getVendaItensAndPagamentos(vendaId: string): {
  itens: Record<string, unknown>[]
  pagamentos: Record<string, unknown>[]
} {
  const db = getDb()
  if (!db) return { itens: [], pagamentos: [] }
  const itens = db.prepare(
    'SELECT id, empresa_id, venda_id, produto_id, descricao, preco_unitario, quantidade, desconto, total FROM venda_itens WHERE venda_id = ?'
  ).all(vendaId) as Record<string, unknown>[]
  const pagamentos = db.prepare(
    'SELECT id, empresa_id, venda_id, forma, valor FROM pagamentos WHERE venda_id = ?'
  ).all(vendaId) as Record<string, unknown>[]
  return { itens, pagamentos }
}

/** Aplica um evento às tabelas espelho no Supabase */
async function applyToMirror(
  supabase: SupabaseClient,
  entity: string,
  operation: string,
  entityId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const table = entity
  const row = toMirrorRow(payload)

  if (operation === 'DELETE') {
    if (entity === 'categorias' || entity === 'estoque_movimentos') {
      const { error } = await supabase.from(table).delete().eq('id', entityId)
      if (error) throw error
      return
    }
    throw new Error(`DELETE não suportado para espelho: ${entity}`)
  }

  if (entity === 'empresas') {
    const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' })
    if (error) throw error
    return
  }

  if (entity === 'categorias') {
    const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' })
    if (error) throw error
    return
  }

  if (entity === 'estoque_movimentos') {
    const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' })
    if (error) throw error
    // Atualiza estoque_atual do produto no espelho com o saldo calculado localmente (incluindo este movimento)
    const empresaId = row.empresa_id as string
    const produtoId = row.produto_id as string
    const saldo = getSaldo(empresaId, produtoId)
    const { error: errProd } = await supabase.from('produtos').update({ estoque_atual: saldo }).eq('id', produtoId)
    if (errProd) throw errProd
    return
  }

  if (entity === 'produtos') {
    const empresaId = row.empresa_id as string
    const produtoId = entityId
    const saldo = getSaldo(empresaId, produtoId)
    const rowComEstoque = { ...row, estoque_atual: saldo }
    let { error } = await supabase.from(table).upsert(rowComEstoque, { onConflict: 'id' })
    // Se falhar por FK de categoria (categoria ainda não existe no Supabase), envia a categoria (e pais) primeiro e repete
    if (error?.message?.includes('produtos_categoria_id_fkey') && row.categoria_id != null) {
      const categoriaId = row.categoria_id as string
      const path = getCategoriaPathForSync(categoriaId)
      for (const cat of path) {
        const catRow = toMirrorRow(cat as unknown as Record<string, unknown>)
        const { error: errCat } = await supabase.from('categorias').upsert(catRow, { onConflict: 'id' })
        if (errCat) throw errCat
      }
      const retry = await supabase.from(table).upsert(rowComEstoque, { onConflict: 'id' })
      if (retry.error) throw retry.error
      return
    }
    if (error) throw error
    return
  }

  if (entity === 'vendas') {
    const { error: errVenda } = await supabase.from(table).upsert(row, { onConflict: 'id' })
    if (errVenda) throw errVenda
    if (operation === 'CREATE') {
      const { itens, pagamentos } = getVendaItensAndPagamentos(entityId)
      if (itens.length > 0) {
        const { error: errItens } = await supabase.from('venda_itens').upsert(itens.map(toMirrorRow), { onConflict: 'id' })
        if (errItens) throw errItens
      }
      if (pagamentos.length > 0) {
        const { error: errPag } = await supabase.from('pagamentos').upsert(pagamentos.map(toMirrorRow), { onConflict: 'id' })
        if (errPag) throw errPag
      }
    }
    return
  }

  throw new Error(`Entidade não mapeada para espelho: ${entity}`)
}

export async function runSync(): Promise<SyncResult> {
  const supabase = getSupabase()
  if (!supabase) {
    return {
      success: false,
      sent: 0,
      errors: 0,
      message: 'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY.'
    }
  }

  const pending = getPending(50)
  if (pending.length === 0) {
    return { success: true, sent: 0, errors: 0, message: 'Nada pendente para sincronizar.' }
  }

  // Processar na ordem que respeita FKs (categorias antes de produtos)
  const sorted = [...pending].sort((a, b) => {
    const orderA = ENTITY_SYNC_ORDER[a.entity] ?? 99
    const orderB = ENTITY_SYNC_ORDER[b.entity] ?? 99
    return orderA !== orderB ? orderA - orderB : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  let sent = 0
  let errors = 0
  let lastError: unknown = null

  for (const entry of sorted) {
    try {
      const payload = (() => {
        try {
          return JSON.parse(entry.payload_json) as Record<string, unknown>
        } catch {
          return { raw: entry.payload_json }
        }
      })()

      // 1) Aplicar nas tabelas espelho (empresas, categorias, produtos, estoque_movimentos, vendas, venda_itens, pagamentos)
      await applyToMirror(supabase, entry.entity, entry.operation, entry.entity_id, payload)

      // 2) Manter log de eventos (audit)
      const { error: logError } = await supabase.from(SYNC_TABLE_NAME).insert({
        source_id: entry.id,
        entity: entry.entity,
        entity_id: entry.entity_id,
        operation: entry.operation,
        payload_json: payload,
        created_at: entry.created_at
      })
      if (logError) throw logError

      markSent(entry.id)
      sent++
    } catch (err) {
      const attempts = (entry.attempts ?? 0) + 1
      if (attempts >= MAX_SYNC_ATTEMPTS) {
        markError(entry.id)
      } else {
        incrementAttempts(entry.id)
      }
      errors++
      lastError = err
    }
  }

  const getErrorMessage = (err: unknown): string => {
    if (err == null) return 'Erro desconhecido'
    if (err instanceof Error) return err.message || 'Erro desconhecido'
    if (typeof err === 'object' && err !== null) {
      const o = err as Record<string, unknown>
      if (typeof o.message === 'string' && o.message.trim()) return o.message.trim()
      if (typeof o.details === 'string' && o.details.trim()) return o.details.trim()
      if (typeof o.hint === 'string' && o.hint.trim()) return o.hint.trim()
      if (o.error != null) return getErrorMessage(o.error)
      try {
        const str = JSON.stringify(err)
        if (str && str !== '{}') return str
      } catch {
        // ignore
      }
    }
    const fallback = String(err)
    if (fallback === '[object Object]') return 'Erro desconhecido'
    return fallback
  }
  const errText = errors > 0 && lastError ? getErrorMessage(lastError) : ''
  const errorDetail = errText ? ` Erro mais recente: ${errText}` : ''

  let message: string
  if (errors === 0) {
    message = `${sent} evento(s) sincronizado(s).`
  } else {
    message = `${sent} enviado(s), ${errors} erro(s). Verifique a conexão e as tabelas no Supabase.${errorDetail}`
  }
  // Nunca exibir [object Object] na UI (objeto de erro não stringificado)
  if (message.includes('[object Object]')) {
    message = message.replace(/\[object Object\]/g, 'Erro desconhecido')
  }

  if (errors === 0 && sent > 0) {
    const localTs = getLastLocalUpdate() ?? new Date().toISOString()
    await supabase.from('pdv_sync_clock').upsert({ id: 1, last_update: localTs }, { onConflict: 'id' })
  }

  return {
    success: errors === 0,
    sent,
    errors,
    message
  }
}

const SYNC_CLOCK_TABLE = 'pdv_sync_clock'

/** Retorna o timestamp da última atualização no Supabase (ISO) ou null. */
export async function getRemoteLastUpdate(): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase.from(SYNC_CLOCK_TABLE).select('last_update').eq('id', 1).maybeSingle()
  if (error || !data?.last_update) return null
  const v = data.last_update
  return typeof v === 'string' ? v : (v && (v as { toISOString?: () => string }).toISOString?.()) ?? null
}

/** Ordem das tabelas para pull (respeitando FKs). Colunas locais conhecidas para INSERT. */
const PULL_TABLES: { table: string; columns: string[] }[] = [
  { table: 'empresas', columns: ['id', 'nome', 'cnpj', 'created_at'] },
  { table: 'usuarios', columns: ['id', 'empresa_id', 'nome', 'login', 'senha_hash', 'role', 'created_at'] },
  { table: 'categorias', columns: ['id', 'empresa_id', 'nome', 'parent_id', 'nivel', 'ordem', 'ativo', 'created_at'] },
  {
    table: 'produtos',
    columns: [
      'id', 'empresa_id', 'codigo', 'nome', 'sku', 'codigo_barras', 'fornecedor_id', 'categoria_id', 'descricao',
      'imagem', 'custo', 'markup', 'preco', 'unidade', 'controla_estoque', 'estoque_minimo', 'estoque_atual', 'ativo', 'ncm', 'cfop',
      'created_at', 'updated_at'
    ]
  },
  { table: 'clientes', columns: ['id', 'empresa_id', 'nome', 'cpf_cnpj', 'telefone', 'email', 'endereco', 'observacoes', 'created_at'] },
  { table: 'fornecedores', columns: ['id', 'empresa_id', 'razao_social', 'cnpj', 'contato', 'observacoes', 'created_at'] },
  { table: 'estoque_movimentos', columns: ['id', 'empresa_id', 'produto_id', 'tipo', 'quantidade', 'custo_unitario', 'referencia_tipo', 'referencia_id', 'usuario_id', 'created_at'] },
  { table: 'caixas', columns: ['id', 'empresa_id', 'usuario_id', 'status', 'valor_inicial', 'aberto_em', 'fechado_em'] },
  { table: 'caixa_movimentos', columns: ['id', 'empresa_id', 'caixa_id', 'tipo', 'valor', 'motivo', 'usuario_id', 'created_at'] },
  { table: 'vendas', columns: ['id', 'empresa_id', 'caixa_id', 'usuario_id', 'cliente_id', 'numero', 'status', 'subtotal', 'desconto_total', 'total', 'troco', 'created_at'] },
  { table: 'venda_itens', columns: ['id', 'empresa_id', 'venda_id', 'produto_id', 'descricao', 'preco_unitario', 'quantidade', 'desconto', 'total'] },
  { table: 'pagamentos', columns: ['id', 'empresa_id', 'venda_id', 'forma', 'valor'] }
]

/** Tabelas que são substituídas no pull (excluindo empresas e usuarios para não quebrar o login local). */
const PULL_TABLES_REPLACE = PULL_TABLES.filter((t) => t.table !== 'empresas' && t.table !== 'usuarios')
/** Ordem inversa (filhos primeiro) para limpar antes do pull. */
const PULL_TABLES_REPLACE_REVERSE = [...PULL_TABLES_REPLACE].reverse()

function toSqliteValue(val: unknown): string | number | null {
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

/** Copia dados do Supabase para o SQLite local (pull). Limpa cada tabela e reinsere para ficar igual ao remoto (evita estoque/valores duplicados). */
export async function pullFromSupabase(): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabase()
  const db = getDb()
  if (!supabase) return { success: false, message: 'Supabase não configurado.' }
  if (!db) return { success: false, message: 'Banco local não inicializado.' }

  try {
    const rowsByTable: Record<string, Record<string, unknown>[]> = {}
    for (const { table } of PULL_TABLES) {
      const { data: rows, error } = await supabase.from(table).select('*')
      if (error) throw error
      rowsByTable[table] = (rows ?? []) as Record<string, unknown>[]
    }
    db.exec('PRAGMA foreign_keys = OFF')
    try {
      db.transaction(() => {
        for (const { table } of PULL_TABLES_REPLACE_REVERSE) {
          db.prepare(`DELETE FROM ${table}`).run()
        }
        for (const { table, columns } of PULL_TABLES_REPLACE) {
          const list = rowsByTable[table] ?? []
          if (list.length === 0) continue
          const placeholders = columns.map(() => '?').join(', ')
          const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
          const stmt = db.prepare(sql)
          for (const row of list) {
            const values = columns.map((col) => toSqliteValue(row[col]))
            stmt.run(...values)
          }
        }
      })()
    } finally {
      db.exec('PRAGMA foreign_keys = ON')
    }
    markAllPendingAsSent()
    return { success: true, message: 'Dados do Supabase copiados para o banco local.' }
  } catch (err) {
    db.exec('PRAGMA foreign_keys = ON')
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, message: msg }
  }
}

/**
 * Força pull do Supabase (ignora comparação de relógio).
 * Use quando alterar dados no painel web e quiser que o app atualize,
 * ou para funcionar mesmo sem o trigger no pdv_sync_clock.
 */
export async function forcePullFromSupabase(): Promise<{ success: boolean; message: string }> {
  const result = await pullFromSupabase()
  if (!result.success) return result
  const remoteTs = await getRemoteLastUpdate()
  setLastLocalUpdate(remoteTs ?? new Date().toISOString())
  return result
}

export type CompareAndSyncResult = {
  success: boolean
  action: 'none' | 'pull' | 'push'
  message: string
}

/**
 * Compara relógios local e remoto; se Supabase estiver mais atualizado faz pull;
 * se o local estiver mais atualizado (ou igual com pendentes) faz push.
 */
export async function compareAndSync(): Promise<CompareAndSyncResult> {
  const supabase = getSupabase()
  if (!supabase) {
    return { success: false, action: 'none', message: 'Supabase não configurado.' }
  }

  const localTs = getLastLocalUpdate()
  const remoteTs = await getRemoteLastUpdate()

  const pending = getPending(1)
  const hasPending = pending.length > 0

  const localTime = localTs ? new Date(localTs).getTime() : 0
  const remoteTime = remoteTs ? new Date(remoteTs).getTime() : 0

  if (remoteTs != null && remoteTime > localTime) {
    const pullResult = await pullFromSupabase()
    if (!pullResult.success) return { success: false, action: 'pull', message: pullResult.message }
    setLastLocalUpdate(remoteTs)
    return { success: true, action: 'pull', message: 'Banco local atualizado com os dados do Supabase.' }
  }

  if (localTime > remoteTime || hasPending) {
    if (hasPending) {
      const result = await runSync()
      if (!result.success) return { success: false, action: 'push', message: result.message }
      return { success: true, action: 'push', message: result.message }
    }
    // Local mais atual, sem pendentes: só atualizar relógio remoto
    const localNow = getLastLocalUpdate() ?? new Date().toISOString()
    const { error } = await supabase.from(SYNC_CLOCK_TABLE).upsert({ id: 1, last_update: localNow }, { onConflict: 'id' })
    if (error) return { success: false, action: 'push', message: error.message }
    return { success: true, action: 'push', message: 'Relógio remoto atualizado.' }
  }

  return { success: true, action: 'none', message: 'Já sincronizado. Nada a fazer.' }
}

let realtimeChannel: ReturnType<SupabaseClient['channel']> | null = null
let pollIntervalId: ReturnType<typeof setInterval> | null = null
let forcePullIntervalId: ReturnType<typeof setInterval> | null = null

const POLL_INTERVAL_MS = 15_000
const FORCE_PULL_INTERVAL_MS = 20_000
const INITIAL_POLL_DELAY_MS = 3_000

function parseRemoteTs(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && typeof (value as { toISOString?: () => string }).toISOString === 'function') {
    return (value as { toISOString: () => string }).toISOString()
  }
  return null
}

async function checkRemoteAndPullIfNewer(onDataUpdated: () => void): Promise<void> {
  const remoteTs = await getRemoteLastUpdate()
  if (!remoteTs) return
  const localTs = getLastLocalUpdate()
  const remoteTime = new Date(remoteTs).getTime()
  const localTime = localTs ? new Date(localTs).getTime() : 0
  if (remoteTime <= localTime) return
  const result = await pullFromSupabase()
  if (result.success) {
    setLastLocalUpdate(remoteTs)
    onDataUpdated()
  }
}

/**
 * Inscreve-se em alterações do relógio no Supabase (Realtime) e inicia polling de fallback.
 * Assim, alterações manuais no painel web são detectadas mesmo se o Realtime falhar ou não estiver configurado.
 */
export function startRealtimeSync(onDataUpdated: () => void): void {
  const supabase = getSupabase()
  if (!supabase) return
  if (realtimeChannel) return

  realtimeChannel = supabase
    .channel('pdv_sync_clock_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: SYNC_CLOCK_TABLE },
      async (payload: { eventType: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
        const newRow = payload.new
        const remoteTs = parseRemoteTs(newRow?.last_update)
        if (!remoteTs) return
        const localTs = getLastLocalUpdate()
        const remoteTime = new Date(remoteTs).getTime()
        const localTime = localTs ? new Date(localTs).getTime() : 0
        if (remoteTime <= localTime) return
        const result = await pullFromSupabase()
        if (result.success) {
          setLastLocalUpdate(remoteTs)
          onDataUpdated()
        }
      }
    )
    .subscribe()

  setTimeout(() => checkRemoteAndPullIfNewer(onDataUpdated).catch(() => {}), INITIAL_POLL_DELAY_MS)
  pollIntervalId = setInterval(() => {
    checkRemoteAndPullIfNewer(onDataUpdated).catch(() => {})
  }, POLL_INTERVAL_MS)

  setTimeout(() => {
    if (getPendingCount() === 0) {
      forcePullFromSupabase().then((r) => r.success && onDataUpdated())
    }
  }, 10_000)

  forcePullIntervalId = setInterval(async () => {
    if (getPendingCount() > 0) return
    const result = await forcePullFromSupabase()
    if (result.success) onDataUpdated()
  }, FORCE_PULL_INTERVAL_MS)
}

export function stopRealtimeSync(): void {
  if (forcePullIntervalId) {
    clearInterval(forcePullIntervalId)
    forcePullIntervalId = null
  }
  if (pollIntervalId) {
    clearInterval(pollIntervalId)
    pollIntervalId = null
  }
  if (realtimeChannel) {
    realtimeChannel.unsubscribe()
    realtimeChannel = null
  }
}
