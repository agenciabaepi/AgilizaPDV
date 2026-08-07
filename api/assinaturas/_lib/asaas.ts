import { getAsaasApiBase, getAsaasApiKey } from './config'

export type AsaasError = { code?: string; description?: string }

export type AsaasCustomer = {
  id: string
  name: string
  cpfCnpj?: string
  email?: string
  externalReference?: string
}

export type AsaasPayment = {
  id: string
  customer: string
  subscription?: string
  billingType: string
  value: number
  status: string
  dueDate: string
  confirmedDate?: string | null
  paymentDate?: string | null
  externalReference?: string
}

export type AsaasSubscription = {
  id: string
  customer: string
  billingType: string
  value: number
  cycle: string
  status: string
  nextDueDate: string
}

export type AsaasPixQrCode = {
  encodedImage: string
  payload: string
  expirationDate: string
  description?: string
}

export type AsaasListResponse<T> = {
  object: string
  hasMore: boolean
  totalCount: number
  limit: number
  offset: number
  data: T[]
}

async function asaasRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const url = `${getAsaasApiBase()}/v3${path}`
  const res = await fetch(url, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      access_token: getAsaasApiKey(),
      'User-Agent': 'AgilizaPDV/1.0.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let json: unknown = null
  if (text.trim()) {
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error(`Resposta inválida do Asaas (HTTP ${res.status}).`)
    }
  }

  if (!res.ok) {
    const errors = (json as { errors?: AsaasError[] } | null)?.errors
    const msg =
      errors?.map((e) => e.description || e.code).filter(Boolean).join('; ') ||
      `Erro Asaas HTTP ${res.status}`
    throw new Error(msg)
  }

  return json as T
}

export function createCustomer(input: {
  name: string
  cpfCnpj: string
  email: string
  externalReference: string
}): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>('POST', '/customers', input)
}

export function findCustomerByReference(externalReference: string): Promise<AsaasListResponse<AsaasCustomer>> {
  return asaasRequest<AsaasListResponse<AsaasCustomer>>(
    'GET',
    `/customers?externalReference=${encodeURIComponent(externalReference)}&limit=1`
  )
}

export function createSubscription(input: {
  customer: string
  billingType: 'PIX'
  value: number
  nextDueDate: string
  cycle: 'MONTHLY'
  description: string
  externalReference: string
}): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>('POST', '/subscriptions', input)
}

export function listSubscriptionPayments(subscriptionId: string): Promise<AsaasListResponse<AsaasPayment>> {
  return asaasRequest<AsaasListResponse<AsaasPayment>>(
    'GET',
    `/subscriptions/${subscriptionId}/payments?limit=12`
  )
}

export function createPayment(input: {
  customer: string
  billingType: 'PIX'
  value: number
  dueDate: string
  description: string
  externalReference: string
}): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>('POST', '/payments', input)
}

export function getPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>('GET', `/payments/${paymentId}`)
}

export function getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasRequest<AsaasPixQrCode>('GET', `/payments/${paymentId}/pixQrCode`)
}

export function formatDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export const PAYMENT_RECEIVED_STATUSES = new Set([
  'RECEIVED',
  'CONFIRMED',
  'RECEIVED_IN_CASH',
])

export const PAYMENT_PENDING_STATUSES = new Set([
  'PENDING',
  'OVERDUE',
  'AWAITING_RISK_ANALYSIS',
])
