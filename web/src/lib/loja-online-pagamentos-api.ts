import type { LojaOnlinePagamentosPublicos, LojaOnlinePedidoItem, LojaOnlineStoreConfig } from './loja-online-types'

export type LojaOnlinePixData = {
  qrCodeImage: string
  copyPaste: string
  expirationDate: string
}

export type LojaOnlinePixPagamento = {
  ok: true
  tipo: 'asaas_pix'
  pedidoId: string
  paymentId: string
  pix: LojaOnlinePixData
}

export type LojaOnlineMpPagamento = {
  ok: true
  tipo: 'mercadopago'
  pedidoId: string
  preferenceId: string
  checkoutUrl: string
}

export type LojaOnlineMpTransparenteResult = {
  ok: true
  pedidoId: string
  paymentId: string
  status: string
  statusDetail: string | null
  pix: LojaOnlinePixData | null
}

export type LojaOnlineRetomarPagamentoResult =
  | { ok: true; alreadyPaid: true; pedidoId: string }
  | (LojaOnlinePixPagamento & { itens?: LojaOnlinePedidoItem[] })
  | {
      ok: true
      tipo: 'pix'
      pedidoId: string
      paymentId: string
      pix: LojaOnlinePixData
      itens?: LojaOnlinePedidoItem[]
    }
  | {
      ok: true
      tipo: 'mercadopago_brick'
      pedidoId: string
      amount: number
      itens?: LojaOnlinePedidoItem[]
    }
  | {
      ok: true
      tipo: 'mercadopago_redirect'
      pedidoId: string
      checkoutUrl: string
      itens?: LojaOnlinePedidoItem[]
    }
  | LojaOnlineMpPagamento

/** Resolve formas de pagamento a partir da config pública da loja (sem expor tokens). */
export function pagamentosPublicosFromStore(store: LojaOnlineStoreConfig): LojaOnlinePagamentosPublicos {
  const mpAtivo = Number(store.loja_online_pag_mercadopago) === 1
  const mpPronto =
    Number(store.loja_online_mp_pronto) === 1 ||
    !!store.loja_online_mercadopago_public_key?.trim()

  const asaasAtivo = Number(store.loja_online_pag_asaas) === 1
  const asaasPronto = Number(store.loja_online_asaas_pronto) === 1

  return {
    manual: Number(store.loja_online_pag_manual) === 1,
    asaasPix: asaasAtivo && asaasPronto,
    mercadopago: mpAtivo && mpPronto,
    mercadopagoPublicKey: store.loja_online_mercadopago_public_key?.trim() || null,
  }
}

async function parseJson<T>(res: Response): Promise<T & { ok?: boolean; error?: string }> {
  const data = await res.json()
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Erro HTTP ${res.status}`)
  }
  return data
}

export async function fetchLojaOnlinePagamentos(
  slug: string,
  store?: LojaOnlineStoreConfig | null
): Promise<LojaOnlinePagamentosPublicos> {
  if (store) {
    return pagamentosPublicosFromStore(store)
  }

  try {
    const res = await fetch(`/api/loja-online/pagamentos-disponiveis?slug=${encodeURIComponent(slug)}`)
    const data = await parseJson<{ pagamentos: LojaOnlinePagamentosPublicos }>(res)
    return data.pagamentos
  } catch {
    return { manual: false, asaasPix: false, mercadopago: false, mercadopagoPublicKey: null }
  }
}

export async function retomarPagamentoLojaOnline(
  pedidoId: string,
  slug: string
): Promise<LojaOnlineRetomarPagamentoResult> {
  const res = await fetch('/api/loja-online/criar-pagamento', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pedidoId, slug }),
  })
  return parseJson(res)
}

export async function criarPagamentoLojaOnline(
  pedidoId: string,
  slug: string
): Promise<LojaOnlinePixPagamento | LojaOnlineMpPagamento> {
  const result = await retomarPagamentoLojaOnline(pedidoId, slug)
  if ('alreadyPaid' in result && result.alreadyPaid) {
    throw new Error('Este pedido já foi pago.')
  }
  if (result.tipo === 'asaas_pix') return result
  if (result.tipo === 'mercadopago') return result
  throw new Error('Resposta de pagamento inesperada.')
}

export async function processarPagamentoMpLojaOnline(
  pedidoId: string,
  slug: string,
  formData: Record<string, unknown>
): Promise<LojaOnlineMpTransparenteResult> {
  const res = await fetch('/api/loja-online/processar-pagamento-mp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pedidoId, slug, formData }),
  })
  return parseJson(res)
}

export async function consultarStatusPagamentoLojaOnline(
  pedidoId: string,
  slug: string
): Promise<{ status: string }> {
  const res = await fetch(
    `/api/loja-online/status-pagamento?pedidoId=${encodeURIComponent(pedidoId)}&slug=${encodeURIComponent(slug)}`
  )
  return parseJson(res)
}

export async function sincronizarPagamentosLojaOnline(
  input: { slug?: string; empresaId?: string }
): Promise<{ ok: true; atualizados: number; verificados: number; vendasGeradas?: number }> {
  const params = new URLSearchParams()
  if (input.slug) params.set('slug', input.slug)
  if (input.empresaId) params.set('empresaId', input.empresaId)
  const res = await fetch(`/api/loja-online/sincronizar-pagamentos?${params.toString()}`, {
    method: 'POST',
  })
  return parseJson(res)
}
