/** Busca endereço pelo CEP (ViaCEP). Retorna null se inválido ou não encontrado. */
export type ViaCepResult = {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
}

export async function buscarCep(cep: string): Promise<ViaCepResult | null> {
  const digits = (cep ?? '').replace(/\D/g, '')
  if (digits.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!res.ok) return null
    const data = (await res.json()) as { erro?: boolean; cep?: string; logradouro?: string; complemento?: string; bairro?: string; localidade?: string; uf?: string }
    if (data.erro) return null
    return {
      cep: data.cep ?? digits,
      logradouro: data.logradouro ?? '',
      complemento: data.complemento ?? '',
      bairro: data.bairro ?? '',
      localidade: data.localidade ?? '',
      uf: data.uf ?? ''
    }
  } catch {
    return null
  }
}
