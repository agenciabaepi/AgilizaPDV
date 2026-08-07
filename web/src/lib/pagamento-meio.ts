export type PagamentoMeioVenda = 'PIX' | 'CREDITO' | 'DEBITO' | 'DINHEIRO' | 'OUTROS'

const MEIOS_VALIDOS = new Set<PagamentoMeioVenda>(['PIX', 'CREDITO', 'DEBITO', 'DINHEIRO', 'OUTROS'])

export function isPagamentoMeioVenda(value: string | null | undefined): value is PagamentoMeioVenda {
  return !!value && MEIOS_VALIDOS.has(value as PagamentoMeioVenda)
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
