import { cancelarVendasIndevidasPedidosOnline, cancelarVendasOrfasOnline, ensureVendaFromPedidoOnline, gerarVendasPedidosConfirmados } from './venda-online'
import { cancelarPedidosPagamentoExpirado, cancelarTodosPedidosPagamentoExpirado } from './pedidos-expirados'
import { isStatusPrePagamento, statusPagamentoAprovado } from './pedido-status'
import { getSupabaseAdmin } from './supabase'
import {
  ASAAS_RECEIVED,
  createAsaasPixPayment,
  findOrCreateAsaasCustomer,
  getAsaasPayment,
  getAsaasPixQrCode,
} from './asaas-loja'
import {
  assertMercadoPagoCredentialsMatch,
  createMercadoPagoPayment,
  getMercadoPagoPayment,
  mercadoPagoPagamentoAprovado,
  searchMercadoPagoPaymentsByPedido,
  type MercadoPagoPaymentRecord,
} from './mercadopago'
import { formaPagamentoFromMercadoPago, type PagamentoMeioVenda } from './pagamento-meio'
import { getAppBaseUrl, getLojaConfigByEmpresaId, getLojaConfigBySlug, type LojaPagamentoConfig } from './config'

type PedidoRow = {
  id: string
  empresa_id: string
  total: number
  subtotal?: number | null
  valor_frete?: number | null
  valor_desconto?: number | null
  cashback_usado?: number | null
  cliente_nome: string | null
  cliente_email: string | null
  forma_pagamento: string
  pagamento_status: string
  gateway_payment_id: string | null
  gateway_checkout_url: string | null
  pagamento_meio?: string | null
}

type PedidoItemRow = {
  nome: string
  quantidade: number
  preco: number
  subtotal: number
}

async function updatePedidoOnline(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  pedidoId: string,
  updates: Record<string, string>
): Promise<void> {
  let { error } = await supabase.from('loja_online_pedidos').update(updates).eq('id', pedidoId)
  if (error?.message?.includes('pagamento_meio')) {
    const { pagamento_meio: _omit, ...semMeio } = updates
    if (Object.keys(semMeio).length > 0) {
      ;({ error } = await supabase.from('loja_online_pedidos').update(semMeio).eq('id', pedidoId))
    }
  }
  if (error) throw new Error(`Falha ao atualizar pedido online: ${error.message}`)
}

async function pedidoEstaPagoNoBanco(pedidoId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('loja_online_pedidos')
    .select('pagamento_status')
    .eq('id', pedidoId)
    .maybeSingle()
  if (error) throw error
  return data?.pagamento_status === 'pago'
}

export async function marcarPedidoPago(pedidoId: string, pagamentoMeio?: PagamentoMeioVenda): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data: pedido, error: fetchErr } = await supabase
    .from('loja_online_pedidos')
    .select('id, status, pagamento_status, forma_pagamento, pagamento_meio')
    .eq('id', pedidoId)
    .maybeSingle()
  if (fetchErr) throw fetchErr
  if (!pedido) return false

  if (pedido.pagamento_status === 'pago') {
    try {
      await ensureVendaFromPedidoOnline(pedidoId)
    } catch (err) {
      console.error('[loja-online/marcarPedidoPago] venda', pedidoId, err)
    }
    return true
  }

  const updates: Record<string, string> = { pagamento_status: 'pago' }
  if (isStatusPrePagamento(pedido.status)) updates.status = statusPagamentoAprovado()
  if (pagamentoMeio && !pedido.pagamento_meio) updates.pagamento_meio = pagamentoMeio
  else if (!pedido.pagamento_meio && pedido.forma_pagamento === 'asaas_pix') {
    updates.pagamento_meio = 'PIX'
  }

  try {
    await updatePedidoOnline(supabase, pedidoId, updates)
  } catch (err) {
    console.error('[loja-online/marcarPedidoPago] update', pedidoId, err)
    return false
  }

  if (!(await pedidoEstaPagoNoBanco(pedidoId))) return false

  try {
    await ensureVendaFromPedidoOnline(pedidoId)
  } catch (err) {
    console.error('[loja-online/marcarPedidoPago] venda', pedidoId, err)
  }
  return true
}

export async function criarPagamentoPedido(pedidoId: string, slug: string) {
  const supabase = getSupabaseAdmin()
  const cfg = await getLojaConfigBySlug(slug)
  if (!cfg) throw new Error('Loja não encontrada.')

  const { data: pedido, error } = await supabase
    .from('loja_online_pedidos')
    .select('*')
    .eq('id', pedidoId)
    .eq('empresa_id', cfg.empresa_id)
    .maybeSingle()
  if (error) throw error
  if (!pedido) throw new Error('Pedido não encontrado.')

  const row = pedido as PedidoRow
  if (row.pagamento_status === 'pago') {
    return { ok: true as const, alreadyPaid: true, pedidoId }
  }

  const { data: itens } = await supabase
    .from('loja_online_pedido_itens')
    .select('nome, quantidade, preco, subtotal')
    .eq('pedido_id', pedidoId)
  const itemRows = (itens ?? []) as PedidoItemRow[]

  if (row.forma_pagamento === 'asaas_pix') {
    return criarAsaasPix(cfg, row, itemRows)
  }
  if (row.forma_pagamento === 'mercadopago') {
    return criarMercadoPago(cfg, row, itemRows, slug)
  }

  throw new Error('Forma de pagamento não suportada para cobrança online.')
}

async function criarAsaasPix(cfg: LojaPagamentoConfig, pedido: PedidoRow, itens: PedidoItemRow[]) {
  const apiKey = cfg.loja_online_asaas_api_key?.trim()
  if (!apiKey) throw new Error('Asaas não configurado nesta loja.')
  const sandbox = cfg.loja_online_asaas_sandbox === 1

  if (pedido.gateway_payment_id) {
    try {
      const existing = await getAsaasPayment(apiKey, sandbox, pedido.gateway_payment_id)
      if (ASAAS_RECEIVED.has(existing.status)) {
        const ok = await marcarPedidoPago(pedido.id, 'PIX')
        if (ok) {
          return { ok: true as const, alreadyPaid: true as const, pedidoId: pedido.id }
        }
      }
      const pix = await getAsaasPixQrCode(apiKey, sandbox, pedido.gateway_payment_id)
      return {
        ok: true as const,
        tipo: 'asaas_pix' as const,
        pedidoId: pedido.id,
        paymentId: pedido.gateway_payment_id,
        pix: asaasPixPayload(pix),
        itens,
      }
    } catch {
      /* cobrança expirada ou inválida — gera nova abaixo */
    }
  }

  const customerRef = `loja-cliente:${pedido.empresa_id}:${pedido.cliente_email || pedido.id}`
  const customerId = await findOrCreateAsaasCustomer(apiKey, sandbox, {
    name: pedido.cliente_nome || 'Cliente',
    email: pedido.cliente_email || undefined,
    externalReference: customerRef,
  })

  const paymentRef = `loja-pedido:${pedido.empresa_id}:${pedido.id}`
  const payment = await createAsaasPixPayment(apiKey, sandbox, {
    customerId,
    value: pedido.total,
    description: `Pedido #${pedido.id.slice(0, 8).toUpperCase()}`,
    externalReference: paymentRef,
  })

  const pix = await getAsaasPixQrCode(apiKey, sandbox, payment.id)

  const supabase = getSupabaseAdmin()
  await supabase
    .from('loja_online_pedidos')
    .update({ gateway_payment_id: payment.id })
    .eq('id', pedido.id)

  return {
    ok: true as const,
    tipo: 'asaas_pix' as const,
    pedidoId: pedido.id,
    paymentId: payment.id,
    pix: asaasPixPayload(pix),
    itens,
  }
}

function asaasPixPayload(pix: { encodedImage: string; payload: string; expirationDate: string }) {
  return {
    qrCodeImage: pix.encodedImage.startsWith('data:')
      ? pix.encodedImage
      : `data:image/png;base64,${pix.encodedImage}`,
    copyPaste: pix.payload,
    expirationDate: pix.expirationDate,
  }
}

function mpPixPayload(payment: MercadoPagoPaymentRecord) {
  const tx = payment.point_of_interaction?.transaction_data
  if (!tx?.qr_code) return null
  return {
    qrCodeImage: tx.qr_code_base64
      ? tx.qr_code_base64.startsWith('data:')
        ? tx.qr_code_base64
        : `data:image/png;base64,${tx.qr_code_base64}`
      : '',
    copyPaste: tx.qr_code,
    expirationDate: '',
  }
}

async function buscarPagamentoMercadoPago(
  accessToken: string,
  row: PedidoRow
): Promise<MercadoPagoPaymentRecord | null> {
  const gid = row.gateway_payment_id ? String(row.gateway_payment_id) : ''
  if (gid && /^\d+$/.test(gid)) {
    try {
      return await getMercadoPagoPayment(accessToken, gid)
    } catch {
      /* tenta busca por pedido */
    }
  }
  const results = await searchMercadoPagoPaymentsByPedido(accessToken, row.id)
  if (results.length === 0) return null
  const approved = results.find((p) => mercadoPagoPagamentoAprovado(p.status))
  return approved ?? results[0] ?? null
}

async function sincronizarMercadoPagoPedido(
  cfg: LojaPagamentoConfig,
  row: PedidoRow
): Promise<{
  status: 'pago' | 'pendente'
  gatewayStatus?: string
  pix?: ReturnType<typeof mpPixPayload>
  paymentId?: string
}> {
  const accessToken = cfg.loja_online_mercadopago_access_token?.trim()
  if (!accessToken) return { status: 'pendente' }

  const payment = await buscarPagamentoMercadoPago(accessToken, row)
  if (!payment) return { status: 'pendente' }

  const supabase = getSupabaseAdmin()
  if (String(payment.id) !== String(row.gateway_payment_id ?? '')) {
    await supabase
      .from('loja_online_pedidos')
      .update({ gateway_payment_id: String(payment.id) })
      .eq('id', row.id)
  }

  if (mercadoPagoPagamentoAprovado(payment.status)) {
    const meio = formaPagamentoFromMercadoPago(payment)
    const ok = await marcarPedidoPago(row.id, meio)
    return { status: ok ? 'pago' : 'pendente', gatewayStatus: payment.status, paymentId: String(payment.id) }
  }

  const pix = payment.status === 'pending' ? mpPixPayload(payment) : null
  return { status: 'pendente', gatewayStatus: payment.status, pix, paymentId: String(payment.id) }
}

async function retomarMercadoPago(cfg: LojaPagamentoConfig, pedido: PedidoRow, itens: PedidoItemRow[]) {
  const token = cfg.loja_online_mercadopago_access_token?.trim()
  if (!token) throw new Error('Mercado Pago não configurado nesta loja.')

  const synced = await sincronizarMercadoPagoPedido(cfg, pedido).catch(() => null)
  if (synced?.status === 'pago') {
    return { ok: true as const, alreadyPaid: true as const, pedidoId: pedido.id }
  }
  if (synced?.pix) {
    return {
      ok: true as const,
      tipo: 'pix' as const,
      pedidoId: pedido.id,
      paymentId: synced.paymentId ?? String(pedido.gateway_payment_id ?? ''),
      pix: synced.pix,
      itens,
    }
  }

  if (pedido.gateway_checkout_url?.trim()) {
    return {
      ok: true as const,
      tipo: 'mercadopago_redirect' as const,
      pedidoId: pedido.id,
      checkoutUrl: pedido.gateway_checkout_url,
      itens,
    }
  }

  return {
    ok: true as const,
    tipo: 'mercadopago_brick' as const,
    pedidoId: pedido.id,
    amount: pedido.total,
    itens,
  }
}

async function criarMercadoPago(
  cfg: LojaPagamentoConfig,
  pedido: PedidoRow,
  itens: PedidoItemRow[],
  _slug: string
) {
  return retomarMercadoPago(cfg, pedido, itens)
}

export async function processarPagamentoMercadoPagoTransparente(
  pedidoId: string,
  slug: string,
  formData: Record<string, unknown>
) {
  const supabase = getSupabaseAdmin()
  const cfg = await getLojaConfigBySlug(slug)
  if (!cfg) throw new Error('Loja não encontrada.')

  const accessToken = cfg.loja_online_mercadopago_access_token?.trim()
  if (!accessToken) throw new Error('Mercado Pago não configurado nesta loja.')
  assertMercadoPagoCredentialsMatch(cfg.loja_online_mercadopago_public_key, accessToken)

  const { data: pedido, error } = await supabase
    .from('loja_online_pedidos')
    .select('*')
    .eq('id', pedidoId)
    .eq('empresa_id', cfg.empresa_id)
    .maybeSingle()
  if (error) throw error
  if (!pedido) throw new Error('Pedido não encontrado.')

  const row = pedido as PedidoRow
  if (row.pagamento_status === 'pago') {
    return { ok: true as const, pedidoId, status: 'approved', paymentId: row.gateway_payment_id, statusDetail: null, pix: null }
  }

  const token = formData.token ? String(formData.token) : undefined
  const paymentMethodId = String(formData.payment_method_id ?? '')
  const isPix = paymentMethodId === 'pix'
  if (!paymentMethodId || (!isPix && !token)) {
    throw new Error('Dados de pagamento incompletos. Tente novamente.')
  }

  const payerFromForm =
    formData.payer && typeof formData.payer === 'object'
      ? (formData.payer as Record<string, unknown>)
      : undefined

  const base = getAppBaseUrl()
  const payment = await createMercadoPagoPayment(
    accessToken,
    {
      pedidoId: row.id,
      amount: Number(row.total),
      token,
      paymentMethodId,
      installments: Number(formData.installments) || 1,
      issuerId: formData.issuer_id ? String(formData.issuer_id) : undefined,
      payerEmail: row.cliente_email || String(payerFromForm?.email ?? ''),
      payer: payerFromForm,
      description: `Pedido #${row.id.slice(0, 8).toUpperCase()}`,
      notificationUrl: `${base}/api/loja-online/webhook-mercadopago`,
    },
    `loja-mp-${row.id}`
  )

  const meio = formaPagamentoFromMercadoPago(payment)

  const baseUpdates: Record<string, string> = {
    gateway_payment_id: String(payment.id),
    pagamento_status: payment.status === 'approved' ? 'pago' : 'pendente',
    pagamento_meio: meio,
  }
  if (payment.status === 'approved' && isStatusPrePagamento(row.status)) {
    baseUpdates.status = statusPagamentoAprovado()
  }

  try {
    await updatePedidoOnline(supabase, row.id, baseUpdates)
  } catch (err) {
    console.error('[loja-online/processarMp] update pedido', row.id, err)
    throw err
  }

  if (payment.status === 'approved') {
    const ok = await marcarPedidoPago(row.id, meio)
    if (!ok) {
      throw new Error(
        'Pagamento aprovado no Mercado Pago, mas não foi possível confirmar o pedido. Abra Meus pedidos e clique em Verificar pagamento.'
      )
    }
  }

  const tx = payment.point_of_interaction?.transaction_data
  const pix =
    payment.status === 'pending' && tx?.qr_code
      ? {
          qrCodeImage: tx.qr_code_base64
            ? tx.qr_code_base64.startsWith('data:')
              ? tx.qr_code_base64
              : `data:image/png;base64,${tx.qr_code_base64}`
            : '',
          copyPaste: tx.qr_code,
          expirationDate: '',
        }
      : null

  return {
    ok: true as const,
    pedidoId: row.id,
    paymentId: String(payment.id),
    status: payment.status,
    statusDetail: payment.status_detail ?? null,
    pix,
  }
}

/** Itens da preference devem somar exatamente o total do pedido (frete, cupom, cashback). */
function buildMercadoPagoItems(
  pedido: PedidoRow,
  itens: PedidoItemRow[]
): { title: string; quantity: number; unit_price: number }[] {
  const frete = Number(pedido.valor_frete) || 0
  const desconto = (Number(pedido.valor_desconto) || 0) + (Number(pedido.cashback_usado) || 0)
  const pedidoTotal = Number(pedido.total) || 0

  if (desconto > 0) {
    return [
      {
        title: `Pedido #${pedido.id.slice(0, 8).toUpperCase()}`,
        quantity: 1,
        unit_price: pedidoTotal,
      },
    ]
  }

  const lines: { title: string; quantity: number; unit_price: number }[] = itens.map((i) => ({
    title: i.nome,
    quantity: i.quantidade,
    unit_price: i.preco,
  }))

  if (frete > 0) {
    lines.push({ title: 'Frete', quantity: 1, unit_price: frete })
  }

  const linesSum = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0)
  if (Math.abs(linesSum - pedidoTotal) > 0.02) {
    return [
      {
        title: `Pedido #${pedido.id.slice(0, 8).toUpperCase()}`,
        quantity: 1,
        unit_price: pedidoTotal,
      },
    ]
  }

  return lines
}

export async function consultarStatusPagamento(pedidoId: string, slug: string) {
  const supabase = getSupabaseAdmin()
  const cfg = await getLojaConfigBySlug(slug)
  if (!cfg) throw new Error('Loja não encontrada.')

  const { data: pedido } = await supabase
    .from('loja_online_pedidos')
    .select('*')
    .eq('id', pedidoId)
    .eq('empresa_id', cfg.empresa_id)
    .maybeSingle()
  if (!pedido) throw new Error('Pedido não encontrado.')

  const row = pedido as PedidoRow
  if (row.pagamento_status === 'pago') {
    return { ok: true, status: 'pago' as const }
  }

  if (row.forma_pagamento === 'asaas_pix' && row.gateway_payment_id) {
    const apiKey = cfg.loja_online_asaas_api_key?.trim()
    if (apiKey) {
      const payment = await getAsaasPayment(apiKey, cfg.loja_online_asaas_sandbox === 1, row.gateway_payment_id)
      if (ASAAS_RECEIVED.has(payment.status)) {
        const ok = await marcarPedidoPago(row.id, 'PIX')
        return { ok: true, status: ok ? ('pago' as const) : ('pendente' as const) }
      }
      return { ok: true, status: 'pendente' as const, gatewayStatus: payment.status }
    }
  }

  if (row.forma_pagamento === 'mercadopago') {
    try {
      const synced = await sincronizarMercadoPagoPedido(cfg, row)
      if (synced.status === 'pago') {
        return { ok: true, status: 'pago' as const }
      }
      return {
        ok: true,
        status: 'pendente' as const,
        gatewayStatus: synced.gatewayStatus,
      }
    } catch {
      return { ok: true, status: row.pagamento_status as 'pendente' | 'pago' }
    }
  }

  return { ok: true, status: row.pagamento_status }
}

/** Consulta gateways e atualiza pedidos online ainda pendentes (PIX/cartão MP e Asaas). */
export async function sincronizarPagamentosPendentes(slug: string, limit = 30) {
  const cfg = await getLojaConfigBySlug(slug)
  if (!cfg) throw new Error('Loja não encontrada.')

  const supabase = getSupabaseAdmin()
  const { data: pedidos, error } = await supabase
    .from('loja_online_pedidos')
    .select('id')
    .eq('empresa_id', cfg.empresa_id)
    .eq('pagamento_status', 'pendente')
    .not('gateway_payment_id', 'is', null)
    .in('forma_pagamento', ['mercadopago', 'asaas_pix'])
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error

  let atualizados = 0
  for (const p of pedidos ?? []) {
    const result = await consultarStatusPagamento(p.id as string, slug)
    if (result.status === 'pago') atualizados++
  }

  const vendasCanceladas =
    (await cancelarVendasIndevidasPedidosOnline(cfg.empresa_id)) +
    (await cancelarVendasOrfasOnline(cfg.empresa_id))
  const pedidosExpiradosCancelados = await cancelarPedidosPagamentoExpirado(cfg.empresa_id)
  const vendasGeradas = await gerarVendasPedidosConfirmados(cfg.empresa_id)

  return {
    ok: true as const,
    atualizados,
    verificados: pedidos?.length ?? 0,
    vendasGeradas,
    vendasCanceladas,
    pedidosExpiradosCancelados,
  }
}

export async function sincronizarPagamentosEmpresa(empresaId: string, limit = 30) {
  const cfg = await getLojaConfigByEmpresaId(empresaId)
  const slug = cfg?.loja_online_slug?.trim()
  if (!slug) {
    const vendasCanceladas =
      (await cancelarVendasIndevidasPedidosOnline(empresaId)) +
      (await cancelarVendasOrfasOnline(empresaId))
    const pedidosExpiradosCancelados = await cancelarPedidosPagamentoExpirado(empresaId)
    const vendasGeradas = await gerarVendasPedidosConfirmados(empresaId)
    return {
      ok: true as const,
      atualizados: 0,
      verificados: 0,
      vendasGeradas,
      vendasCanceladas,
      pedidosExpiradosCancelados,
    }
  }
  return sincronizarPagamentosPendentes(slug, limit)
}

export async function handleAsaasLojaWebhook(paymentId: string) {
  const supabase = getSupabaseAdmin()
  const { data: pedido } = await supabase
    .from('loja_online_pedidos')
    .select('id, empresa_id, gateway_payment_id')
    .eq('gateway_payment_id', paymentId)
    .maybeSingle()
  if (!pedido) return { handled: false }

  const cfg = await getLojaConfigByEmpresaId(pedido.empresa_id as string)
  const apiKey = cfg?.loja_online_asaas_api_key?.trim()
  if (!apiKey) return { handled: false }

  const payment = await getAsaasPayment(apiKey, cfg!.loja_online_asaas_sandbox === 1, paymentId)
  if (ASAAS_RECEIVED.has(payment.status)) {
    await marcarPedidoPago(pedido.id as string, 'PIX')
    return { handled: true }
  }
  return { handled: true, pending: true }
}

export async function handleMercadoPagoWebhook(paymentId: string) {
  const supabase = getSupabaseAdmin()

  const { data: pedidoByGateway } = await supabase
    .from('loja_online_pedidos')
    .select('id, empresa_id')
    .eq('gateway_payment_id', paymentId)
    .maybeSingle()

  if (pedidoByGateway) {
    const cfg = await getLojaConfigByEmpresaId(pedidoByGateway.empresa_id as string)
    const token = cfg?.loja_online_mercadopago_access_token?.trim()
    if (token) {
      try {
        const payment = await getMercadoPagoPayment(token, paymentId)
        if (payment.status === 'approved') {
          const meio = formaPagamentoFromMercadoPago(payment)
          await marcarPedidoPago(pedidoByGateway.id as string, meio)
          return { handled: true }
        }
        return { handled: true, pending: true }
      } catch {
        return { handled: false }
      }
    }
  }

  const configs = await supabase
    .from('empresas_config')
    .select('empresa_id, loja_online_mercadopago_access_token')
    .eq('loja_online_pag_mercadopago', 1)

  for (const cfg of configs.data ?? []) {
    const token = (cfg as { loja_online_mercadopago_access_token: string | null }).loja_online_mercadopago_access_token?.trim()
    if (!token) continue
    try {
      const payment = await getMercadoPagoPayment(token, paymentId)
      if (payment.status === 'approved' && payment.external_reference) {
        const meio = formaPagamentoFromMercadoPago(payment)
        await marcarPedidoPago(payment.external_reference, meio)
        return { handled: true }
      }
    } catch {
      continue
    }
  }
  return { handled: false }
}
