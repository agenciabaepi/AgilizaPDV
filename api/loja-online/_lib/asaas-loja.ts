export type AsaasPayment = {
  id: string
  customer: string
  billingType: string
  value: number
  status: string
  dueDate: string
  externalReference?: string
}

export type AsaasPixQrCode = {
  encodedImage: string
  payload: string
  expirationDate: string
}

export type AsaasCustomer = { id: string }

type AsaasList<T> = { data: T[] }

async function asaasRequest<T>(
  apiKey: string,
  sandbox: boolean,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const base = sandbox ? 'https://api-sandbox.asaas.com' : 'https://api.asaas.com'
  const res = await fetch(`${base}/v3${path}`, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      access_token: apiKey,
      'User-Agent': 'AgilizaPDV-LojaOnline/1.0',
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
    const errors = (json as { errors?: { description?: string }[] } | null)?.errors
    const msg = errors?.map((e) => e.description).filter(Boolean).join('; ') || `Erro Asaas HTTP ${res.status}`
    throw new Error(msg)
  }
  return json as T
}

export async function findOrCreateAsaasCustomer(
  apiKey: string,
  sandbox: boolean,
  input: { name: string; email?: string; externalReference: string }
): Promise<string> {
  const list = await asaasRequest<AsaasList<AsaasCustomer>>(
    apiKey,
    sandbox,
    'GET',
    `/customers?externalReference=${encodeURIComponent(input.externalReference)}&limit=1`
  )
  if (list.data?.[0]?.id) return list.data[0].id

  const created = await asaasRequest<AsaasCustomer>(apiKey, sandbox, 'POST', '/customers', {
    name: input.name,
    email: input.email || undefined,
    externalReference: input.externalReference,
  })
  return created.id
}

export async function createAsaasPixPayment(
  apiKey: string,
  sandbox: boolean,
  input: {
    customerId: string
    value: number
    description: string
    externalReference: string
  }
): Promise<AsaasPayment> {
  const dueDate = new Date().toISOString().slice(0, 10)
  return asaasRequest<AsaasPayment>(apiKey, sandbox, 'POST', '/payments', {
    customer: input.customerId,
    billingType: 'PIX',
    value: input.value,
    dueDate,
    description: input.description,
    externalReference: input.externalReference,
  })
}

export async function getAsaasPixQrCode(
  apiKey: string,
  sandbox: boolean,
  paymentId: string
): Promise<AsaasPixQrCode> {
  return asaasRequest<AsaasPixQrCode>(apiKey, sandbox, 'GET', `/payments/${paymentId}/pixQrCode`)
}

export async function getAsaasPayment(
  apiKey: string,
  sandbox: boolean,
  paymentId: string
): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>(apiKey, sandbox, 'GET', `/payments/${paymentId}`)
}

export const ASAAS_RECEIVED = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])
