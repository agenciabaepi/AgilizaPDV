import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { query, queryOne } from './db'
import { getSaldo } from './services/estoque'
import { getPending, markSent, markError, incrementAttempts } from './outbox'
import { EMPRESAS_CONFIG_MIRROR_FIELD_KEYS } from './empresas-config-mirror'

const MAX_SYNC_ATTEMPTS = 5

const ENTITY_SYNC_ORDER: Record<string, number> = {
  empresas: 0,
  empresas_config: 1,
  categorias: 1,
  marcas: 2,
  clientes: 2,
  produtos: 3,
  estoque_movimentos: 4,
  vendas: 5,
  venda_nfce: 6,
  venda_nfe: 6,
}

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

function toMirrorRow(payload: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined) continue
    row[k] = v
  }
  return row
}

async function getVendaItensAndPagamentos(vendaId: string): Promise<{
  itens: Record<string, unknown>[]
  pagamentos: Record<string, unknown>[]
}> {
  const itens = await query<Record<string, unknown>>(
    'SELECT id, empresa_id, venda_id, produto_id, descricao, preco_unitario, quantidade, desconto, total FROM venda_itens WHERE venda_id = $1',
    [vendaId]
  )
  const pagamentos = await query<Record<string, unknown>>(
    'SELECT id, empresa_id, venda_id, forma, valor FROM pagamentos WHERE venda_id = $1',
    [vendaId]
  )
  return { itens, pagamentos }
}

const COLS_CAT = 'id, empresa_id, nome, parent_id, nivel, ordem, ativo, created_at'
const COLS_MARCA = 'id, empresa_id, nome, ativo, created_at, updated_at'

async function getCategoriaPathForSync(categoriaId: string): Promise<Record<string, unknown>[]> {
  const path: Record<string, unknown>[] = []
  let current = await queryOne<Record<string, unknown>>(`SELECT ${COLS_CAT} FROM categorias WHERE id = $1`, [categoriaId])
  while (current) {
    path.unshift(current)
    const pid = current.parent_id as string | null
    current = pid ? (await queryOne<Record<string, unknown>>(`SELECT ${COLS_CAT} FROM categorias WHERE id = $1`, [pid])) : null
  }
  return path
}

async function upsertEmpresasConfigMirror(
  supabase: SupabaseClient,
  configRow: Record<string, unknown>
): Promise<void> {
  let row: Record<string, unknown> = { ...configRow }
  for (let attempt = 0; attempt < 32; attempt++) {
    const { error } = await supabase.from('empresas_config').upsert(row, { onConflict: 'empresa_id' })
    if (!error) return
    const msg = error.message ?? ''
    const missingCol = msg.match(/Could not find the '([^']+)' column/)
    if (missingCol?.[1] && Object.prototype.hasOwnProperty.call(row, missingCol[1])) {
      const k = missingCol[1]
      const { [k]: _, ...rest } = row
      row = rest
      continue
    }
    throw error
  }
  const { error: last } = await supabase.from('empresas_config').upsert(row, { onConflict: 'empresa_id' })
  if (last) throw last
}

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
    if (entity === 'categorias' || entity === 'marcas' || entity === 'estoque_movimentos') {
      const { error } = await supabase.from(table).delete().eq('id', entityId)
      if (error) throw error
      return
    }
    throw new Error(`DELETE não suportado para espelho: ${entity}`)
  }

  if (entity === 'empresas') {
    // Espelho `empresas`: id, nome, cnpj, codigo_acesso, created_at.
    // Eventos antigos podem conter campos de `empresas_config` (ex: cor_primaria), então filtramos.
    const empresaRow: Record<string, unknown> = {}
    if (row.id !== undefined) empresaRow.id = row.id
    if (row.nome !== undefined) empresaRow.nome = row.nome
    if (row.cnpj !== undefined) empresaRow.cnpj = row.cnpj
    if (row.codigo_acesso !== undefined) empresaRow.codigo_acesso = row.codigo_acesso
    if (row.created_at !== undefined) empresaRow.created_at = row.created_at

    const { error } = await supabase.from(table).upsert(empresaRow, { onConflict: 'id' })
    if (error) throw error
    return
  }

  if (entity === 'empresas_config') {
    const configRow: Record<string, unknown> = {}
    for (const k of EMPRESAS_CONFIG_MIRROR_FIELD_KEYS) {
      if (row[k] !== undefined) configRow[k] = row[k]
    }
    await upsertEmpresasConfigMirror(supabase, configRow)
    return
  }

  if (entity === 'categorias') {
    const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' })
    if (error) throw error
    return
  }

  if (entity === 'marcas') {
    const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' })
    if (error) throw error
    return
  }

  if (entity === 'estoque_movimentos') {
    const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' })
    if (error) throw error
    const empresaId = row.empresa_id as string
    const produtoId = row.produto_id as string
    const saldo = await getSaldo(empresaId, produtoId)
    const { error: errProd } = await supabase.from('produtos').update({ estoque_atual: saldo }).eq('id', produtoId)
    if (errProd) throw errProd
    return
  }

  if (entity === 'produtos') {
    const empresaId = row.empresa_id as string
    const produtoId = entityId
    const saldo = await getSaldo(empresaId, produtoId)
    const rowComEstoque = { ...row, estoque_atual: saldo }
    let { error } = await supabase.from(table).upsert(rowComEstoque, { onConflict: 'id' })
    if (error?.message?.includes('produtos_categoria_id_fkey') && row.categoria_id != null) {
      const path = await getCategoriaPathForSync(row.categoria_id as string)
      for (const cat of path) {
        const catRow = toMirrorRow(cat)
        const { error: errCat } = await supabase.from('categorias').upsert(catRow, { onConflict: 'id' })
        if (errCat) throw errCat
      }
      const retry = await supabase.from(table).upsert(rowComEstoque, { onConflict: 'id' })
      if (retry.error) throw retry.error
      return
    }
    if (error?.message?.includes('produtos_marca_id_fkey') && row.marca_id != null) {
      const marca = await queryOne<Record<string, unknown>>(`SELECT ${COLS_MARCA} FROM marcas WHERE id = $1`, [row.marca_id as string])
      if (marca) {
        const marcaRow = toMirrorRow(marca)
        const { error: errM } = await supabase.from('marcas').upsert(marcaRow, { onConflict: 'id' })
        if (errM) throw errM
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
      const { itens, pagamentos } = await getVendaItensAndPagamentos(entityId)
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

  if (entity === 'clientes') {
    const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' })
    if (error) throw error
    return
  }

  if (entity === 'venda_nfce') {
    const mirrorRow = { ...row, xml_local_path: null }
    const { error } = await supabase.from('venda_nfce').upsert(mirrorRow, { onConflict: 'venda_id' })
    if (error) throw error
    return
  }

  if (entity === 'venda_nfe') {
    const mirrorRow = { ...row, xml_local_path: null }
    const { error } = await supabase.from('venda_nfe').upsert(mirrorRow, { onConflict: 'venda_id' })
    if (error) throw error
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

  const pending = await getPending(50)
  if (pending.length === 0) {
    return { success: true, sent: 0, errors: 0, message: 'Nada pendente para sincronizar.' }
  }

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

      await applyToMirror(supabase, entry.entity, entry.operation, entry.entity_id, payload)

      const { error: logError } = await supabase.from(SYNC_TABLE_NAME).insert({
        source_id: entry.id,
        entity: entry.entity,
        entity_id: entry.entity_id,
        operation: entry.operation,
        payload_json: payload,
        created_at: entry.created_at
      })
      if (logError) throw logError

      await markSent(entry.id)
      sent++
    } catch (err) {
      const attempts = (entry.attempts ?? 0) + 1
      if (attempts >= MAX_SYNC_ATTEMPTS) {
        await markError(entry.id)
      } else {
        await incrementAttempts(entry.id)
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
