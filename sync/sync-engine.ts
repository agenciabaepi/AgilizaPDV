import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getDb } from '../backend/db'
import { getCategoriaPathForSync } from '../backend/services/categorias.service'
import { getSaldo } from '../backend/services/estoque.service'
import { getPending, markSent, markError, incrementAttempts } from './outbox'

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

  return {
    success: errors === 0,
    sent,
    errors,
    message
  }
}
