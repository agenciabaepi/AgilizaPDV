/** Busca endereço pelo CEP (ViaCEP, com fallback BrasilAPI). Retorna null se inválido ou não encontrado. */
export type ViaCepResult = {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
}

const cepCache = new Map<string, ViaCepResult | null>()
const cepInflight = new Map<string, Promise<ViaCepResult | null>>()

function asResult(partial: {
  cep?: string
  logradouro?: string | null
  complemento?: string | null
  bairro?: string | null
  localidade?: string | null
  uf?: string | null
}, digits: string): ViaCepResult | null {
  const localidade = (partial.localidade ?? '').trim()
  if (!localidade) return null
  return {
    cep: partial.cep ?? digits,
    logradouro: (partial.logradouro ?? '').trim(),
    complemento: (partial.complemento ?? '').trim(),
    bairro: (partial.bairro ?? '').trim(),
    localidade,
    uf: (partial.uf ?? '').trim().toUpperCase(),
  }
}

async function buscarViaCep(digits: string): Promise<ViaCepResult | null> {
  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
  if (!res.ok) return null
  const data = (await res.json()) as {
    erro?: boolean | string
    cep?: string
    logradouro?: string
    complemento?: string
    bairro?: string
    localidade?: string
    uf?: string
  }
  if (data.erro) return null
  return asResult(data, digits)
}

async function buscarBrasilApi(digits: string): Promise<ViaCepResult | null> {
  const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`)
  if (!res.ok) return null
  const data = (await res.json()) as {
    cep?: string
    street?: string | null
    neighborhood?: string | null
    city?: string | null
    state?: string | null
  }
  return asResult(
    {
      cep: data.cep,
      logradouro: data.street,
      bairro: data.neighborhood,
      localidade: data.city,
      uf: data.state,
    },
    digits
  )
}

export async function buscarCep(cep: string): Promise<ViaCepResult | null> {
  const digits = (cep ?? '').replace(/\D/g, '')
  if (digits.length !== 8) return null
  if (cepCache.has(digits)) return cepCache.get(digits) ?? null
  const pending = cepInflight.get(digits)
  if (pending) return pending

  const request = (async () => {
    try {
      const result = (await buscarViaCep(digits)) ?? (await buscarBrasilApi(digits))
      cepCache.set(digits, result)
      return result
    } catch {
      try {
        const fallback = await buscarBrasilApi(digits)
        cepCache.set(digits, fallback)
        return fallback
      } catch {
        cepCache.set(digits, null)
        return null
      }
    } finally {
      cepInflight.delete(digits)
    }
  })()

  cepInflight.set(digits, request)
  return request
}
