export type MercadoPagoPreference = {
  id: string
  init_point: string
  sandbox_init_point?: string
}

const MP_API = 'https://api.mercadopago.com'

export function isMercadoPagoTestCredential(value: string | null | undefined): boolean | null {
  const v = value?.trim()
  if (!v) return null
  if (v.startsWith('TEST-')) return true
  if (v.startsWith('APP_USR-')) return false
  return null
}

/** Public Key e Access Token precisam ser do mesmo ambiente (teste ou produção). */
export function assertMercadoPagoCredentialsMatch(
  publicKey: string | null | undefined,
  accessToken: string | null | undefined
): void {
  const pkTest = isMercadoPagoTestCredential(publicKey)
  const tkTest = isMercadoPagoTestCredential(accessToken)
  if (pkTest === null || tkTest === null || pkTest === tkTest) return
  throw new Error(
    pkTest
      ? 'Public Key é de teste, mas o Access Token é de produção. No painel da loja, configure o par de credenciais do mesmo ambiente (ambos TEST-... para testes).'
      : 'Public Key é de produção, mas o Access Token é de teste. No painel da loja, configure o par de credenciais do mesmo ambiente.'
  )
}

function translateMercadoPagoError(message: string | undefined): string | undefined {
  if (!message) return message
  if (/unauthorized use of live credentials/i.test(message)) {
    return 'Credenciais misturadas: use Public Key e Access Token do mesmo ambiente (teste ou produção) no painel da loja.'
  }
  return message
}

function mpHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

export async function createMercadoPagoPreference(
  accessToken: string,
  input: {
    pedidoId: string
    titulo: string
    items: { title: string; quantity: number; unit_price: number }[]
    payerEmail?: string
    payerName?: string
    notificationUrl: string
    backUrls: { success: string; failure: string; pending: string }
  }
): Promise<MercadoPagoPreference> {
  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: mpHeaders(accessToken),
    body: JSON.stringify({
      items: input.items.map((i) => ({
        title: i.title.slice(0, 256),
        quantity: i.quantity,
        unit_price: Number(i.unit_price.toFixed(2)),
        currency_id: 'BRL',
      })),
      payer: {
        name: input.payerName,
        email: input.payerEmail,
      },
      external_reference: input.pedidoId,
      notification_url: input.notificationUrl,
      back_urls: input.backUrls,
      auto_return: 'approved',
      statement_descriptor: input.titulo.slice(0, 22),
    }),
  })

  const json = (await res.json()) as MercadoPagoPreference & { message?: string; error?: string }
  if (!res.ok) {
    throw new Error(json.message || json.error || `Erro Mercado Pago HTTP ${res.status}`)
  }
  if (!json.init_point && !json.sandbox_init_point) {
    throw new Error('Mercado Pago não retornou URL de checkout.')
  }
  return json
}

export type MercadoPagoPaymentRecord = {
  id: number
  status: string
  status_detail?: string
  external_reference?: string
  payment_method_id?: string
  payment_type_id?: string
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string
      qr_code_base64?: string
      ticket_url?: string
    }
  }
}

export function mercadoPagoPagamentoAprovado(status: string | null | undefined): boolean {
  return status === 'approved'
}

export async function getMercadoPagoPayment(accessToken: string, paymentId: string): Promise<MercadoPagoPaymentRecord> {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = (await res.json()) as MercadoPagoPaymentRecord & { message?: string }
  if (!res.ok) throw new Error(json.message || `Erro MP HTTP ${res.status}`)
  return json
}

/** Localiza cobranças MP pelo id do pedido (external_reference). */
export async function searchMercadoPagoPaymentsByPedido(
  accessToken: string,
  pedidoId: string
): Promise<MercadoPagoPaymentRecord[]> {
  const params = new URLSearchParams({
    sort: 'date_created',
    criteria: 'desc',
    external_reference: pedidoId,
  })
  const res = await fetch(`${MP_API}/v1/payments/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = (await res.json()) as { results?: MercadoPagoPaymentRecord[]; message?: string }
  if (!res.ok) throw new Error(json.message || `Erro MP search HTTP ${res.status}`)
  return json.results ?? []
}

export type MercadoPagoPaymentInput = {
  pedidoId: string
  amount: number
  token?: string
  paymentMethodId: string
  installments: number
  issuerId?: string
  payerEmail: string
  payer?: Record<string, unknown>
  description: string
  notificationUrl: string
}

export type MercadoPagoPaymentResult = {
  id: number
  status: string
  status_detail?: string
  payment_method_id?: string
  payment_type_id?: string
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string
      qr_code_base64?: string
    }
  }
}

export async function createMercadoPagoPayment(
  accessToken: string,
  input: MercadoPagoPaymentInput,
  idempotencyKey: string
): Promise<MercadoPagoPaymentResult> {
  const isPix = input.paymentMethodId === 'pix'
  const payer = (input.payer && typeof input.payer === 'object' ? input.payer : {}) as Record<string, unknown>
  if (!payer.email) payer.email = input.payerEmail

  const body: Record<string, unknown> = {
    transaction_amount: Number(input.amount.toFixed(2)),
    description: input.description,
    payment_method_id: input.paymentMethodId,
    payer,
    external_reference: input.pedidoId,
    notification_url: input.notificationUrl,
  }
  if (input.token) body.token = input.token
  if (!isPix) {
    body.installments = input.installments || 1
    if (input.issuerId) body.issuer_id = input.issuerId
  }

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: 'POST',
    headers: {
      ...mpHeaders(accessToken),
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  })

  const json = (await res.json()) as MercadoPagoPaymentResult & {
    message?: string
    cause?: { description?: string }[]
  }
  if (!res.ok) {
    const detail = translateMercadoPagoError(json.cause?.[0]?.description || json.message)
    throw new Error(detail || `Erro Mercado Pago HTTP ${res.status}`)
  }
  return json
}
