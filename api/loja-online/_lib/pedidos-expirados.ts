import { getSupabaseAdmin } from './supabase'
import { isStatusPrePagamento } from './pedido-status'

/** Horas sem pagamento online antes de cancelar o pedido automaticamente. */
export const LOJA_ONLINE_PAGAMENTO_EXPIRACAO_HORAS = 48

type PedidoExpiradoRow = {
  id: string
  empresa_id: string
  status: string
  forma_pagamento: string | null
  pagamento_status: string | null
  venda_id: string | null
  cupom_id: string | null
  created_at: string
}

function cutoffIso(horas = LOJA_ONLINE_PAGAMENTO_EXPIRACAO_HORAS): string {
  return new Date(Date.now() - horas * 60 * 60 * 1000).toISOString()
}

function pedidoExpiravel(row: PedidoExpiradoRow): boolean {
  if (row.pagamento_status !== 'pendente') return false
  const forma = row.forma_pagamento ?? 'manual'
  if (forma !== 'mercadopago' && forma !== 'asaas_pix') return false
  if (row.status === 'cancelado' || row.status === 'pagamento_recusado' || row.status === 'reembolsado') {
    return false
  }
  if (row.status === 'entregue') return false
  return isStatusPrePagamento(row.status) || row.status === 'aguardando_pagamento'
}

async function cancelarVendaPedido(vendaId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  await supabase.from('vendas').update({ status: 'CANCELADA' }).eq('id', vendaId).eq('venda_online', 1)
}

async function restaurarCupom(cupomId: string | null): Promise<void> {
  if (!cupomId) return
  const supabase = getSupabaseAdmin()
  const { data: cupom } = await supabase
    .from('loja_online_cupons')
    .select('usos_atual')
    .eq('id', cupomId)
    .maybeSingle()
  const usos = Number(cupom?.usos_atual) || 0
  if (usos > 0) {
    await supabase.from('loja_online_cupons').update({ usos_atual: usos - 1 }).eq('id', cupomId)
  }
}

async function cancelarPedidoExpirado(row: PedidoExpiradoRow): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data: atual, error: fetchErr } = await supabase
    .from('loja_online_pedidos')
    .select('id, status, pagamento_status, forma_pagamento, venda_id, cupom_id')
    .eq('id', row.id)
    .maybeSingle()
  if (fetchErr || !atual) return false
  if (!pedidoExpiravel(atual as PedidoExpiradoRow)) return false

  const { error } = await supabase
    .from('loja_online_pedidos')
    .update({ status: 'cancelado', pagamento_status: 'cancelado' })
    .eq('id', row.id)
    .eq('pagamento_status', 'pendente')
  if (error) {
    console.error('[loja-online/pedidos-expirados] cancelar', row.id, error.message)
    return false
  }

  if (atual.venda_id) {
    await cancelarVendaPedido(atual.venda_id as string)
    await supabase.from('loja_online_pedidos').update({ venda_id: null }).eq('id', row.id)
  }

  await restaurarCupom((atual.cupom_id as string | null) ?? null)
  return true
}

/** Cancela pedidos online aguardando pagamento há mais de N horas (empresa específica). */
export async function cancelarPedidosPagamentoExpirado(
  empresaId: string,
  options?: { horas?: number; limit?: number }
): Promise<number> {
  const supabase = getSupabaseAdmin()
  const horas = options?.horas ?? LOJA_ONLINE_PAGAMENTO_EXPIRACAO_HORAS
  const limit = options?.limit ?? 100

  const { data, error } = await supabase
    .from('loja_online_pedidos')
    .select('id, empresa_id, status, forma_pagamento, pagamento_status, venda_id, cupom_id, created_at')
    .eq('empresa_id', empresaId)
    .eq('pagamento_status', 'pendente')
    .in('forma_pagamento', ['mercadopago', 'asaas_pix'])
    .lt('created_at', cutoffIso(horas))
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error

  let cancelados = 0
  for (const row of (data ?? []) as PedidoExpiradoRow[]) {
    if (!pedidoExpiravel(row)) continue
    if (await cancelarPedidoExpirado(row)) cancelados++
  }
  return cancelados
}

/** Cancela pedidos expirados de todas as lojas (cron / manutenção). */
export async function cancelarTodosPedidosPagamentoExpirado(
  options?: { horas?: number; limit?: number }
): Promise<number> {
  const supabase = getSupabaseAdmin()
  const horas = options?.horas ?? LOJA_ONLINE_PAGAMENTO_EXPIRACAO_HORAS
  const limit = options?.limit ?? 200

  const { data, error } = await supabase
    .from('loja_online_pedidos')
    .select('id, empresa_id, status, forma_pagamento, pagamento_status, venda_id, cupom_id, created_at')
    .eq('pagamento_status', 'pendente')
    .in('forma_pagamento', ['mercadopago', 'asaas_pix'])
    .lt('created_at', cutoffIso(horas))
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error

  let cancelados = 0
  for (const row of (data ?? []) as PedidoExpiradoRow[]) {
    if (!pedidoExpiravel(row)) continue
    if (await cancelarPedidoExpirado(row)) cancelados++
  }
  return cancelados
}
