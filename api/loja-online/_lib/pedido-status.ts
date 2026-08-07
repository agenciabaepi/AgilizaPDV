/** Status de pedidos online — espelho do módulo web para APIs serverless. */

export const LOJA_ONLINE_PEDIDO_STATUSES = [
  'pedido_recebido',
  'aguardando_pagamento',
  'pagamento_aprovado',
  'em_separacao',
  'em_preparacao',
  'enviado',
  'em_transporte',
  'saiu_para_entrega',
  'entregue',
  'cancelado',
  'pagamento_recusado',
  'aguardando_retirada',
  'disponivel_retirada',
  'devolucao_solicitada',
  'em_devolucao',
  'reembolsado',
  'falha_entrega',
] as const

export type LojaOnlinePedidoStatus = (typeof LOJA_ONLINE_PEDIDO_STATUSES)[number]

export const PEDIDO_STATUSES_ELEGIVEIS_VENDA: LojaOnlinePedidoStatus[] = [
  'pagamento_aprovado',
  'em_separacao',
  'em_preparacao',
  'enviado',
  'em_transporte',
  'saiu_para_entrega',
  'aguardando_retirada',
  'disponivel_retirada',
  'entregue',
  'falha_entrega',
  'devolucao_solicitada',
  'em_devolucao',
]

export function isLojaOnlinePedidoStatus(value: string): value is LojaOnlinePedidoStatus {
  return (LOJA_ONLINE_PEDIDO_STATUSES as readonly string[]).includes(value)
}

export function normalizePedidoStatus(
  status: string,
  pedido?: { forma_pagamento?: string | null; pagamento_status?: string | null }
): LojaOnlinePedidoStatus {
  if (isLojaOnlinePedidoStatus(status)) return status
  if (status === 'pendente') {
    const forma = pedido?.forma_pagamento ?? 'manual'
    const pag = pedido?.pagamento_status
    if ((forma === 'mercadopago' || forma === 'asaas_pix') && pag === 'pendente') return 'aguardando_pagamento'
    if (pag === 'pago') return 'pagamento_aprovado'
    return 'pedido_recebido'
  }
  if (status === 'confirmado') return 'pagamento_aprovado'
  if (status === 'entregue') return 'entregue'
  if (status === 'cancelado') return 'cancelado'
  return 'pedido_recebido'
}

export function pedidoElegivelParaVenda(pedido: {
  status: string
  forma_pagamento: string | null
  pagamento_status: string | null
}): boolean {
  const status = normalizePedidoStatus(pedido.status, pedido)
  const elegivel =
    PEDIDO_STATUSES_ELEGIVEIS_VENDA.includes(status) || status === 'confirmado' || status === 'entregue'
  if (!elegivel) return false

  const forma = pedido.forma_pagamento ?? 'manual'
  if (forma === 'manual') {
    return pedido.pagamento_status === 'na_entrega' || pedido.pagamento_status === 'pago'
  }
  return pedido.pagamento_status === 'pago'
}

export function statusPagamentoAprovado(): LojaOnlinePedidoStatus {
  return 'pagamento_aprovado'
}

export function statusAguardandoPagamento(): LojaOnlinePedidoStatus {
  return 'aguardando_pagamento'
}

export function isStatusPrePagamento(status: string): boolean {
  const normalized = normalizePedidoStatus(status)
  return normalized === 'pedido_recebido' || normalized === 'aguardando_pagamento'
}
