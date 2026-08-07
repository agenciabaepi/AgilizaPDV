import type { OpcaoFreteCorreios } from './frete-types'

type MelhorEnvioQuote = {
  id: number
  name: string
  price: string
  custom_price?: string
  delivery_time: number
  custom_delivery_time?: number
  company?: { name?: string }
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '')
}

function parseQuoteValue(q: MelhorEnvioQuote): number {
  return Number(q.custom_price ?? q.price)
}

function parseQuotePrazo(q: MelhorEnvioQuote): number {
  return Number(q.custom_delivery_time ?? q.delivery_time) || 0
}

function isPacQuote(name: string): boolean {
  return /pac/i.test(name) && !/mini|gf/i.test(name)
}

function isSedexQuote(name: string): boolean {
  return /sedex/i.test(name) && !/10|12|hoje|gf/i.test(name)
}

export async function calcularFreteMelhorEnvio(input: {
  token: string
  sandbox?: boolean
  cepOrigem: string
  cepDestino: string
  pesoKg: number
  valorSeguro?: number
}): Promise<OpcaoFreteCorreios[]> {
  const origem = onlyDigits(input.cepOrigem)
  const destino = onlyDigits(input.cepDestino)
  if (origem.length !== 8 || destino.length !== 8) {
    throw new Error('CEP de origem ou destino inválido.')
  }

  const base = input.sandbox ? 'https://sandbox.melhorenvio.com.br' : 'https://melhorenvio.com.br'
  const peso = Math.max(0.1, Math.min(input.pesoKg || 0.3, 30))

  const res = await fetch(`${base}/api/v2/me/shipment/calculate`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.token.trim()}`,
      'User-Agent': 'AgilizaPDV (contato@agilizapdv.app)',
    },
    body: JSON.stringify({
      from: { postal_code: origem },
      to: { postal_code: destino },
      products: [
        {
          width: 15,
          height: 5,
          length: 20,
          weight: peso,
          insurance_value: input.valorSeguro ?? 50,
          quantity: 1,
        },
      ],
      options: { receipt: false, own_hand: false },
    }),
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(
      `Melhor Envio: não foi possível calcular o frete (${res.status}). ${errText.slice(0, 160)}`
    )
  }

  const quotes = (await res.json()) as MelhorEnvioQuote[]
  if (!Array.isArray(quotes) || quotes.length === 0) {
    throw new Error('Nenhuma opção de frete disponível para este CEP.')
  }

  const opcoes: OpcaoFreteCorreios[] = []

  const pac = quotes.find((q) => isPacQuote(q.name))
  if (pac) {
    const valor = parseQuoteValue(pac)
    if (Number.isFinite(valor) && valor > 0) {
      opcoes.push({
        servico: 'pac',
        codigo: String(pac.id),
        nome: pac.name,
        valor,
        prazo: parseQuotePrazo(pac),
      })
    }
  }

  const sedex = quotes.find((q) => isSedexQuote(q.name))
  if (sedex) {
    const valor = parseQuoteValue(sedex)
    if (Number.isFinite(valor) && valor > 0) {
      opcoes.push({
        servico: 'sedex',
        codigo: String(sedex.id),
        nome: sedex.name,
        valor,
        prazo: parseQuotePrazo(sedex),
      })
    }
  }

  if (opcoes.length === 0) {
    const correios = quotes
      .filter((q) => q.company?.name?.toLowerCase().includes('correios') || /pac|sedex/i.test(q.name))
      .sort((a, b) => parseQuoteValue(a) - parseQuoteValue(b))

    for (const q of correios.slice(0, 2)) {
      const valor = parseQuoteValue(q)
      if (!Number.isFinite(valor) || valor <= 0) continue
      opcoes.push({
        servico: isSedexQuote(q.name) ? 'sedex' : 'pac',
        codigo: String(q.id),
        nome: q.name,
        valor,
        prazo: parseQuotePrazo(q),
      })
    }
  }

  if (opcoes.length === 0) {
    throw new Error('Nenhuma opção de frete disponível para este CEP.')
  }

  return opcoes
}
