import { getSupabaseAdmin } from '../../assinaturas/_lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

const STORAGE_BUCKETS = ['certificados', 'nfce-xml', 'nfe-xml', 'nfe-danfe'] as const

function isMissingTableError(message: string): boolean {
  return (
    message.includes('does not exist') ||
    message.includes('42P01') ||
    message.includes('Could not find the table')
  )
}

async function deleteFromTable(
  supabase: SupabaseClient,
  table: string,
  column: string,
  value: string
): Promise<void> {
  const { error } = await supabase.from(table).delete().eq(column, value)
  if (error && !isMissingTableError(error.message)) {
    throw new Error(`${table}: ${error.message}`)
  }
}

async function deleteByForeignIds(
  supabase: SupabaseClient,
  table: string,
  column: string,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return
  const chunkSize = 100
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const { error } = await supabase.from(table).delete().in(column, chunk)
    if (error && !isMissingTableError(error.message)) {
      throw new Error(`${table}: ${error.message}`)
    }
  }
}

async function fetchIds(
  supabase: SupabaseClient,
  table: string,
  empresaId: string
): Promise<string[]> {
  const { data, error } = await supabase.from(table).select('id').eq('empresa_id', empresaId)
  if (error) {
    if (isMissingTableError(error.message)) return []
    throw new Error(`${table}: ${error.message}`)
  }
  return (data ?? []).map((row) => String(row.id))
}

async function removeStoragePrefix(bucket: string, prefix: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { data: entries, error } = await supabase.storage.from(bucket).list(prefix, { limit: 500 })
  if (error || !entries?.length) return

  const paths = entries
    .filter((e) => e.name)
    .map((e) => `${prefix}/${e.name}`.replace(/^\/+/, ''))

  if (paths.length > 0) {
    await supabase.storage.from(bucket).remove(paths)
  }
}

async function deleteEmpresaStorage(empresaId: string): Promise<void> {
  const supabase = getSupabaseAdmin()

  const { data: cert } = await supabase
    .from('empresa_certificado')
    .select('storage_path')
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (cert?.storage_path) {
    await supabase.storage.from('certificados').remove([cert.storage_path])
  }

  for (const bucket of STORAGE_BUCKETS) {
    try {
      await removeStoragePrefix(bucket, empresaId)
      await removeStoragePrefix(bucket, `empresa/${empresaId}`)
    } catch {
      /* bucket pode não existir */
    }
  }
}

async function excluirEmpresaViaQueries(empresaId: string): Promise<void> {
  const supabase = getSupabaseAdmin()

  const { data: empresa, error: findErr } = await supabase
    .from('empresas')
    .select('id')
    .eq('id', empresaId)
    .maybeSingle()

  if (findErr) throw new Error(findErr.message)
  if (!empresa) throw new Error('Empresa não encontrada.')

  const vendaIds = await fetchIds(supabase, 'vendas', empresaId)
  await deleteByForeignIds(supabase, 'venda_nfce', 'venda_id', vendaIds)
  await deleteByForeignIds(supabase, 'venda_nfe', 'venda_id', vendaIds)

  for (const table of [
    'pagamentos',
    'venda_itens',
    'contas_receber',
    'contas_pagar',
    'cashback_movimentacoes',
    'cashback_creditos',
    'cashback_saldos',
    'cashback_regras',
    'cashback_configuracoes',
    'caixa_movimentos',
    'caixas',
    'estoque_movimentos',
  ]) {
    await deleteFromTable(supabase, table, 'empresa_id', empresaId)
  }

  const pedidoIds = await fetchIds(supabase, 'loja_online_pedidos', empresaId)
  await deleteByForeignIds(supabase, 'loja_online_pedido_itens', 'pedido_id', pedidoIds)

  for (const table of [
    'loja_online_avaliacoes',
    'loja_online_favoritos',
    'loja_online_cupons',
    'loja_online_pedidos',
    'loja_online_clientes',
  ]) {
    await deleteFromTable(supabase, table, 'empresa_id', empresaId)
  }

  await deleteFromTable(supabase, 'vendas', 'empresa_id', empresaId)
  await deleteFromTable(supabase, 'produtos', 'empresa_id', empresaId)

  const { error: catErr } = await supabase
    .from('categorias')
    .update({ parent_id: null })
    .eq('empresa_id', empresaId)
  if (catErr && !isMissingTableError(catErr.message)) {
    throw new Error(`categorias: ${catErr.message}`)
  }
  await deleteFromTable(supabase, 'categorias', 'empresa_id', empresaId)

  for (const table of [
    'marcas',
    'clientes',
    'fornecedores',
    'assinatura_pagamentos',
    'empresa_assinaturas',
    'empresa_certificado',
    'empresas_config',
    'pdv_backup_registry',
    'usuarios',
  ]) {
    await deleteFromTable(supabase, table, 'empresa_id', empresaId)
  }

  const { error: delEmpresaErr } = await supabase.from('empresas').delete().eq('id', empresaId)
  if (delEmpresaErr) throw new Error(delEmpresaErr.message)
}

function isRpcMissingError(message: string, code?: string): boolean {
  return (
    code === '42883' ||
    /saas_excluir_empresa/i.test(message) ||
    /function.*does not exist/i.test(message) ||
    /could not find the function/i.test(message)
  )
}

export async function excluirEmpresaCompleta(empresaId: string): Promise<void> {
  await deleteEmpresaStorage(empresaId)

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.rpc('saas_excluir_empresa', { p_empresa_id: empresaId })

  if (!error) return

  if (isRpcMissingError(error.message, error.code)) {
    await excluirEmpresaViaQueries(empresaId)
    return
  }

  throw new Error(error.message)
}
