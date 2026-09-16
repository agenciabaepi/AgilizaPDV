import type { ViaCepResult } from './cep'

export type EnderecoCheckout = {
  cep: string
  logradouro: string
  bairro: string
  cidade: string
  uf: string
  numero: string
  complemento: string
  referencia: string
}

export function maskCep(value: string): string {
  const d = (value ?? '').replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export function normalizeCidadeNome(value: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function cidadesIguais(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeCidadeNome(a ?? '')
  const nb = normalizeCidadeNome(b ?? '')
  return na.length > 0 && na === nb
}

/** Tenta extrair "Cidade - UF" / "Cidade/SP" do endereço cadastrado da loja. */
export function extrairCidadeDeEndereco(endereco: string | null | undefined): string | null {
  const raw = (endereco ?? '').trim()
  if (!raw) return null
  const m = raw.match(/([A-Za-zÀ-ÿ'’.]+(?:\s+[A-Za-zÀ-ÿ'’.]+)*)\s*[-/,]\s*[A-Za-z]{2}\b/)
  const cidade = m?.[1]?.trim()
  return cidade || null
}

export function formatarEnderecoEntrega(e: EnderecoCheckout): string {
  const ruaNumero = [e.logradouro.trim(), e.numero.trim()].filter(Boolean).join(', ')
  const complemento = e.complemento.trim()
  const bairro = e.bairro.trim()
  const cidadeUf = [e.cidade.trim(), e.uf.trim().toUpperCase()].filter(Boolean).join(' - ')
  const cepDigits = e.cep.replace(/\D/g, '')
  const cep = cepDigits.length === 8 ? `CEP ${maskCep(cepDigits)}` : ''
  const ref = e.referencia.trim() ? `Ref.: ${e.referencia.trim()}` : ''
  return [ruaNumero, complemento, bairro, cidadeUf, cep, ref].filter(Boolean).join(' · ')
}

export function enderecoFromViaCep(
  data: ViaCepResult,
  extras?: Partial<Pick<EnderecoCheckout, 'numero' | 'complemento' | 'referencia'>>
): EnderecoCheckout {
  return {
    cep: data.cep,
    logradouro: data.logradouro,
    bairro: data.bairro,
    cidade: data.localidade,
    uf: data.uf,
    numero: extras?.numero ?? '',
    complemento: extras?.complemento || data.complemento || '',
    referencia: extras?.referencia ?? '',
  }
}

/**
 * "Pagar na entrega" só faz sentido na cidade da loja (entrega local).
 * Retirada na loja continua liberada. Se a cidade da loja não puder ser
 * determinada, não restringe (lojas sem CEP de origem).
 */
export function pagamentoManualLiberado(opts: {
  formaEntrega: 'retirada' | 'entrega'
  cidadeLoja: string | null
  cidadeCliente: string | null
}): boolean {
  if (opts.formaEntrega === 'retirada') return true
  if (!opts.cidadeLoja?.trim()) return true
  if (!opts.cidadeCliente?.trim()) return false
  return cidadesIguais(opts.cidadeLoja, opts.cidadeCliente)
}
