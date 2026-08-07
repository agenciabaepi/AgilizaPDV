/** Formas aceitas na tabela `pagamentos` (PDV / NFC-e). */
export type PagamentoMeioVenda = 'PIX' | 'CREDITO' | 'DEBITO' | 'DINHEIRO' | 'OUTROS'

const MEIOS_VALIDOS = new Set<PagamentoMeioVenda>(['PIX', 'CREDITO', 'DEBITO', 'DINHEIRO', 'OUTROS'])

export function isPagamentoMeioVenda(value: string | null | undefined): value is PagamentoMeioVenda {
  return !!value && MEIOS_VALIDOS.has(value as PagamentoMeioVenda)
}

/** Mapeia resposta do Mercado Pago para forma do PDV. */
export function formaPagamentoFromMercadoPago(payment: {
  payment_method_id?: string | null
  payment_type_id?: string | null
}): PagamentoMeioVenda {
  const methodId = String(payment.payment_method_id ?? '').toLowerCase()
  const typeId = String(payment.payment_type_id ?? '').toLowerCase()

  if (methodId === 'pix' || typeId === 'bank_transfer') return 'PIX'
  if (typeId === 'debit_card') return 'DEBITO'
  if (typeId === 'credit_card') return 'CREDITO'
  if (typeId === 'ticket') return 'OUTROS'
  return 'OUTROS'
}

/** Fallback quando só temos o payment_method_id enviado pelo Brick (antes da resposta completa). */
export function formaPagamentoFromMercadoPagoMethodId(paymentMethodId: string): PagamentoMeioVenda {
  if (paymentMethodId.toLowerCase() === 'pix') return 'PIX'
  return 'CREDITO'
}

export function formaPagamentoFromPedidoOnline(pedido: {
  forma_pagamento?: string | null
  pagamento_meio?: string | null
}): PagamentoMeioVenda {
  if (isPagamentoMeioVenda(pedido.pagamento_meio)) return pedido.pagamento_meio
  if (pedido.forma_pagamento === 'asaas_pix') return 'PIX'
  if (pedido.forma_pagamento === 'manual') return 'DINHEIRO'
  return 'OUTROS'
}
