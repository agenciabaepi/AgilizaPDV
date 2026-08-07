import { randomUUID } from 'node:crypto'
import { getSupabaseAdmin } from './supabase'
import { getLojaConfigByEmpresaId } from './config'
import { getMercadoPagoPayment } from './mercadopago'
import {
  formaPagamentoFromMercadoPago,
  formaPagamentoFromPedidoOnline,
  isPagamentoMeioVenda,
  type PagamentoMeioVenda,
} from './pagamento-meio'
import { pedidoElegivelParaVenda } from './pedido-status'

export { pedidoElegivelParaVenda }

const CAIXA_LOJA_ONLINE_PREFIX = 'loja-online-caixa-'

type PedidoRow = {
  id: string
  empresa_id: string
  cliente_id: string | null
  status: string
  subtotal: number | null
  total: number
  valor_desconto: number | null
  cashback_usado: number | null
  venda_id: string | null
  created_at: string
  forma_pagamento: string | null
  pagamento_status: string | null
  pagamento_meio?: string | null
  gateway_payment_id?: string | null
}

type PedidoItemRow = {
  produto_id: string
  nome: string
  preco: number
  quantidade: number
  subtotal: number
}

function normalizeDocDigits(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const d = raw.replace(/\D/g, '')
  if (d.length === 11 || d.length === 14) return d
  return null
}

async function nextNumeroVenda(supabase: ReturnType<typeof getSupabaseAdmin>, empresaId: string): Promise<number> {
  const { data } = await supabase
    .from('vendas')
    .select('numero')
    .eq('empresa_id', empresaId)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()
  const n = data?.numero
  return typeof n === 'number' && Number.isFinite(n) ? n + 1 : 1
}

async function ensureLojaOnlineCaixa(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  empresaId: string,
  usuarioId: string
): Promise<string> {
  const id = `${CAIXA_LOJA_ONLINE_PREFIX}${empresaId}`
  const { data } = await supabase.from('caixas').select('id').eq('id', id).maybeSingle()
  if (data?.id) return id

  const now = new Date().toISOString()
  const { error } = await supabase.from('caixas').insert({
    id,
    empresa_id: empresaId,
    usuario_id: usuarioId,
    status: 'FECHADO',
    valor_inicial: 0,
    aberto_em: now,
    fechado_em: now,
  })
  if (error) throw error
  return id
}

async function getUsuarioIdLojaOnline(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  empresaId: string
): Promise<string> {
  const { data } = await supabase
    .from('usuarios')
    .select('id')
    .eq('empresa_id', empresaId)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  return (data?.id as string | undefined) ?? `loja-online-${empresaId}`
}

async function registrarSaidaEstoquePedido(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: {
    empresa_id: string
    produto_id: string
    quantidade: number
    custo_unitario: number
    venda_id: string
    usuario_id: string
  }
): Promise<void> {
  const { error } = await supabase.from('estoque_movimentos').insert({
    id: randomUUID(),
    empresa_id: params.empresa_id,
    produto_id: params.produto_id,
    tipo: 'SAIDA',
    quantidade: params.quantidade,
    custo_unitario: params.custo_unitario,
    referencia_tipo: 'VENDA',
    referencia_id: params.venda_id,
    usuario_id: params.usuario_id,
    created_at: new Date().toISOString(),
  })
  if (error) throw error

  const { data: movs } = await supabase
    .from('estoque_movimentos')
    .select('tipo, quantidade')
    .eq('empresa_id', params.empresa_id)
    .eq('produto_id', params.produto_id)

  let saldo = 0
  for (const m of movs ?? []) {
    const q = Number((m as { quantidade: number }).quantidade)
    if ((m as { tipo: string }).tipo === 'ENTRADA' || (m as { tipo: string }).tipo === 'DEVOLUCAO') saldo += q
    else saldo -= q
  }

  await supabase
    .from('produtos')
    .update({ estoque_atual: saldo })
    .eq('id', params.produto_id)
    .eq('empresa_id', params.empresa_id)
}

async function gerarCashbackPedidoOnline(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  input: {
    empresaId: string
    clientePdvId: string
    cpfNorm: string
    vendaId: string
    valorBase: number
  }
): Promise<number> {
  const { data: cfg } = await supabase
    .from('cashback_configuracoes')
    .select('ativo, percentual_padrao, valor_minimo_compra_gerar, modo_validade, dias_validade')
    .eq('empresa_id', input.empresaId)
    .maybeSingle()

  if (!cfg || Number(cfg.ativo) !== 1) return 0
  const minCompra = Number(cfg.valor_minimo_compra_gerar) || 0
  if (input.valorBase < minCompra) return 0

  const pct = Number(cfg.percentual_padrao) || 0
  if (pct <= 0) return 0

  let valor = Math.round(((input.valorBase * pct) / 100) * 100) / 100
  if (valor <= 0) return 0

  let expiraEm: string | null = null
  if (cfg.modo_validade === 'DIAS' && cfg.dias_validade) {
    const d = new Date()
    d.setDate(d.getDate() + Number(cfg.dias_validade))
    expiraEm = d.toISOString()
  }

  const creditoId = randomUUID()
  const { error: credErr } = await supabase.from('cashback_creditos').insert({
    id: creditoId,
    empresa_id: input.empresaId,
    cliente_id: input.clientePdvId,
    cpf_normalizado: input.cpfNorm,
    venda_id_origem: input.vendaId,
    valor_inicial: valor,
    valor_restante: valor,
    expira_em: expiraEm,
    status: 'ATIVO',
  })
  if (credErr) throw credErr

  const { data: saldoRow } = await supabase
    .from('cashback_saldos')
    .select('saldo_disponivel, total_gerado')
    .eq('empresa_id', input.empresaId)
    .eq('cliente_id', input.clientePdvId)
    .maybeSingle()

  const saldoAtual = Number(saldoRow?.saldo_disponivel) || 0
  const novoSaldo = Math.round((saldoAtual + valor) * 100) / 100

  if (saldoRow) {
    await supabase
      .from('cashback_saldos')
      .update({
        saldo_disponivel: novoSaldo,
        total_gerado: Math.round(((Number(saldoRow.total_gerado) || 0) + valor) * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq('empresa_id', input.empresaId)
      .eq('cliente_id', input.clientePdvId)
  } else {
    await supabase.from('cashback_saldos').insert({
      empresa_id: input.empresaId,
      cliente_id: input.clientePdvId,
      cpf_normalizado: input.cpfNorm,
      saldo_disponivel: novoSaldo,
      total_gerado: valor,
    })
  }

  await supabase.from('cashback_movimentacoes').insert({
    id: randomUUID(),
    empresa_id: input.empresaId,
    cliente_id: input.clientePdvId,
    cpf_normalizado: input.cpfNorm,
    tipo: 'CREDITO_VENDA',
    origem: 'LOJA_ONLINE',
    venda_id: input.vendaId,
    credito_id: creditoId,
    valor,
    saldo_disponivel_apos: novoSaldo,
    observacao: 'Cashback gerado na venda online',
    idempotency_key: `loja-online-credito-${input.vendaId}`,
  })

  return valor
}

function pagamentoFormaFromPedido(formaPagamento: string | null, pagamentoMeio?: string | null): PagamentoMeioVenda {
  return formaPagamentoFromPedidoOnline({ forma_pagamento: formaPagamento, pagamento_meio: pagamentoMeio })
}

async function resolvePagamentoFormaVenda(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  pedido: PedidoRow
): Promise<PagamentoMeioVenda> {
  if (isPagamentoMeioVenda(pedido.pagamento_meio)) return pedido.pagamento_meio

  if (pedido.forma_pagamento === 'mercadopago' && pedido.gateway_payment_id) {
    const cfg = await getLojaConfigByEmpresaId(pedido.empresa_id)
    const token = cfg?.loja_online_mercadopago_access_token?.trim()
    if (token) {
      try {
        const payment = await getMercadoPagoPayment(token, pedido.gateway_payment_id)
        const meio = formaPagamentoFromMercadoPago(payment)
        await supabase.from('loja_online_pedidos').update({ pagamento_meio: meio }).eq('id', pedido.id)
        return meio
      } catch {
        /* fallback abaixo */
      }
    }
  }

  return pagamentoFormaFromPedido(pedido.forma_pagamento, pedido.pagamento_meio)
}

/** Atualiza forma do pagamento da venda quando o pedido passa a ter meio resolvido (ex.: PIX). */
async function corrigirPagamentoVendaOnline(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  pedido: PedidoRow,
  vendaId: string
): Promise<void> {
  const forma = await resolvePagamentoFormaVenda(supabase, pedido)
  const { data: pags } = await supabase.from('pagamentos').select('id, forma').eq('venda_id', vendaId)
  for (const p of pags ?? []) {
    const atual = String((p as { forma: string }).forma ?? '').toUpperCase()
    if (atual === 'LOJA_ONLINE' || (atual === 'OUTROS' && forma !== 'OUTROS')) {
      await supabase.from('pagamentos').update({ forma }).eq('id', (p as { id: string }).id)
    }
  }
}

async function criarVendaFromPedidoOnline(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  pedido: PedidoRow
): Promise<string> {
  const { data: itens, error: itensErr } = await supabase
    .from('loja_online_pedido_itens')
    .select('produto_id, nome, preco, quantidade, subtotal')
    .eq('pedido_id', pedido.id)
  if (itensErr) throw itensErr
  const itemRows = (itens ?? []) as PedidoItemRow[]
  if (itemRows.length === 0) throw new Error('Pedido sem itens.')

  const usuarioId = await getUsuarioIdLojaOnline(supabase, pedido.empresa_id)
  const caixaId = await ensureLojaOnlineCaixa(supabase, pedido.empresa_id, usuarioId)
  const vendaId = randomUUID()
  const numero = await nextNumeroVenda(supabase, pedido.empresa_id)
  const subtotal = pedido.subtotal ?? pedido.total
  const descontoTotal = Number(pedido.valor_desconto) || 0
  const cashbackUsado = Number(pedido.cashback_usado) || 0
  const now = new Date().toISOString()

  let clientePdvId: string | null = null
  if (pedido.cliente_id) {
    const { data: cli } = await supabase
      .from('loja_online_clientes')
      .select('cliente_pdv_id')
      .eq('id', pedido.cliente_id)
      .maybeSingle()
    clientePdvId = (cli?.cliente_pdv_id as string | null) ?? null
  }

  const { data: cfgLoja } = await supabase
    .from('empresas_config')
    .select('loja_online_cashback_ativo')
    .eq('empresa_id', pedido.empresa_id)
    .maybeSingle()

  const { error: vendaErr } = await supabase.from('vendas').insert({
    id: vendaId,
    empresa_id: pedido.empresa_id,
    caixa_id: caixaId,
    usuario_id: usuarioId,
    cliente_id: clientePdvId,
    numero,
    status: 'CONCLUIDA',
    subtotal,
    desconto_total: descontoTotal + cashbackUsado,
    total: pedido.total,
    troco: 0,
    venda_a_prazo: 0,
    data_vencimento: null,
    cashback_gerado: 0,
    cashback_usado: cashbackUsado,
    venda_online: 1,
    created_at: pedido.created_at || now,
  })
  if (vendaErr) throw new Error(`Falha ao registrar venda online: ${vendaErr.message}`)

  const itensRows = itemRows.map((item) => ({
    id: randomUUID(),
    empresa_id: pedido.empresa_id,
    venda_id: vendaId,
    produto_id: item.produto_id,
    descricao: item.nome,
    preco_unitario: item.preco,
    quantidade: item.quantidade,
    desconto: 0,
    total: item.subtotal,
  }))
  const { error: vendaItensErr } = await supabase.from('venda_itens').insert(itensRows)
  if (vendaItensErr) throw new Error(`Falha ao registrar itens da venda: ${vendaItensErr.message}`)

  const produtoIds = [...new Set(itemRows.map((i) => i.produto_id))]
  const { data: produtos } = await supabase
    .from('produtos')
    .select('id, controla_estoque, custo')
    .in('id', produtoIds)

  const prodMap = new Map(
    (produtos ?? []).map((p) => [
      String((p as { id: string }).id),
      p as { id: string; controla_estoque: number; custo: number },
    ])
  )

  for (const item of itemRows) {
    const produto = prodMap.get(item.produto_id)
    if (produto && Number(produto.controla_estoque) === 1) {
      await registrarSaidaEstoquePedido(supabase, {
        empresa_id: pedido.empresa_id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        custo_unitario: Number(produto.custo) || 0,
        venda_id: vendaId,
        usuario_id: usuarioId,
      })
    }
  }

  const forma = await resolvePagamentoFormaVenda(supabase, pedido)
  const pagamentoBase = {
    id: randomUUID(),
    empresa_id: pedido.empresa_id,
    venda_id: vendaId,
    valor: pedido.total,
  }
  let { error: pagErr } = await supabase.from('pagamentos').insert({
    ...pagamentoBase,
    forma,
  })
  if (pagErr?.message?.includes('pagamentos_forma_check')) {
    const retry = await supabase.from('pagamentos').insert({
      ...pagamentoBase,
      forma: 'OUTROS',
    })
    pagErr = retry.error
  }
  if (pagErr) throw new Error(`Falha ao registrar pagamento: ${pagErr.message}`)

  if (Number(cfgLoja?.loja_online_cashback_ativo) === 1 && clientePdvId && pedido.cliente_id) {
    const { data: cliRow } = await supabase
      .from('loja_online_clientes')
      .select('cpf_cnpj')
      .eq('id', pedido.cliente_id)
      .maybeSingle()
    const cpfNorm = normalizeDocDigits(cliRow?.cpf_cnpj as string | null)
    if (cpfNorm) {
      const gerado = await gerarCashbackPedidoOnline(supabase, {
        empresaId: pedido.empresa_id,
        clientePdvId,
        cpfNorm,
        vendaId,
        valorBase: Math.max(0, pedido.total),
      })
      if (gerado > 0) {
        await supabase.from('vendas').update({ cashback_gerado: gerado }).eq('id', vendaId)
      }
    }
  }

  return vendaId
}

/** Cria venda financeira para pedido confirmado/entregue (idempotente). */
export async function ensureVendaFromPedidoOnline(pedidoId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  const { data: pedido, error } = await supabase
    .from('loja_online_pedidos')
    .select('*')
    .eq('id', pedidoId)
    .maybeSingle()
  if (error) throw error
  if (!pedido) return null

  const row = pedido as PedidoRow
  if (row.venda_id) {
    await corrigirPagamentoVendaOnline(supabase, row, row.venda_id)
    return row.venda_id
  }
  if (!pedidoElegivelParaVenda(row)) return null

  const vendaId = await criarVendaFromPedidoOnline(supabase, row)
  const { data: linked } = await supabase
    .from('loja_online_pedidos')
    .update({ venda_id: vendaId })
    .eq('id', pedidoId)
    .is('venda_id', null)
    .select('venda_id')
    .maybeSingle()

  if (linked?.venda_id) return linked.venda_id as string

  const { data: current } = await supabase
    .from('loja_online_pedidos')
    .select('venda_id')
    .eq('id', pedidoId)
    .maybeSingle()
  if (current?.venda_id && current.venda_id !== vendaId) {
    await supabase.from('vendas').update({ status: 'CANCELADA' }).eq('id', vendaId).eq('venda_online', 1)
  }
  return (current?.venda_id as string | null) ?? null
}

/** Gera vendas para pedidos confirmados sem venda_id (backfill). */
export async function gerarVendasPedidosConfirmados(empresaId: string, limit = 50): Promise<number> {
  const supabase = getSupabaseAdmin()
  const { data: pedidos, error } = await supabase
    .from('loja_online_pedidos')
    .select('id, status, forma_pagamento, pagamento_status, venda_id')
    .eq('empresa_id', empresaId)
    .in('status', ['confirmado', 'entregue', 'pagamento_aprovado', 'em_separacao', 'em_preparacao', 'enviado', 'em_transporte', 'saiu_para_entrega', 'aguardando_retirada', 'disponivel_retirada'])
    .is('venda_id', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error

  let geradas = 0
  for (const p of pedidos ?? []) {
    if (!pedidoElegivelParaVenda(p as PedidoRow)) continue
    try {
      const vendaId = await ensureVendaFromPedidoOnline(p.id as string)
      if (vendaId) geradas++
    } catch (err) {
      console.error('[loja-online/venda-online]', p.id, err)
    }
  }
  return geradas
}

/** Cancela vendas online geradas indevidamente (ex.: pedido ainda aguardando pagamento). */
export async function cancelarVendasIndevidasPedidosOnline(empresaId: string, limit = 100): Promise<number> {
  const supabase = getSupabaseAdmin()
  const { data: pedidos, error } = await supabase
    .from('loja_online_pedidos')
    .select('id, venda_id, status, forma_pagamento, pagamento_status')
    .eq('empresa_id', empresaId)
    .not('venda_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error

  let canceladas = 0
  for (const p of pedidos ?? []) {
    const row = p as PedidoRow
    if (!row.venda_id || pedidoElegivelParaVenda(row)) continue
    await supabase.from('vendas').update({ status: 'CANCELADA' }).eq('id', row.venda_id).eq('venda_online', 1)
    await supabase.from('loja_online_pedidos').update({ venda_id: null }).eq('id', row.id)
    canceladas++
  }
  return canceladas
}

/** Cancela vendas online sem pedido vinculado (duplicatas geradas por erro). */
export async function cancelarVendasOrfasOnline(empresaId: string, limit = 100): Promise<number> {
  const supabase = getSupabaseAdmin()
  const { data: vendas, error } = await supabase
    .from('vendas')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('venda_online', 1)
    .eq('status', 'CONCLUIDA')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error

  let canceladas = 0
  for (const v of vendas ?? []) {
    const { count } = await supabase
      .from('loja_online_pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('venda_id', v.id as string)
    if ((count ?? 0) === 0) {
      await supabase.from('vendas').update({ status: 'CANCELADA' }).eq('id', v.id as string)
      canceladas++
    }
  }
  return canceladas
}
