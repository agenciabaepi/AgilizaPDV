import { calcularFreteMelhorEnvio, resolveMelhorEnvioAuth, saveMelhorEnvioAuth } from './melhor-envio'
import type { MelhorEnvioProductInput } from './melhor-envio'
import type { OpcaoFreteCorreios } from './frete-types'

export type { OpcaoFreteCorreios } from './frete-types'
export type { MelhorEnvioProductInput } from './melhor-envio'

const SERVICOS = [
  { servico: 'pac' as const, codigo: '04510', nome: 'PAC' },
  { servico: 'sedex' as const, codigo: '04014', nome: 'SEDEX' },
]

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '')
}

function parseXmlTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i')
  const m = xml.match(re)
  return m?.[1]?.trim() ?? null
}

async function calcularFreteCorreiosLegado(input: {
  cepOrigem: string
  cepDestino: string
  pesoKg: number
}): Promise<OpcaoFreteCorreios[]> {
  const origem = onlyDigits(input.cepOrigem)
  const destino = onlyDigits(input.cepDestino)
  if (origem.length !== 8 || destino.length !== 8) {
    throw new Error('CEP de origem ou destino inválido.')
  }

  const peso = Math.max(0.1, Math.min(input.pesoKg || 0.3, 30))
  const params = new URLSearchParams({
    nCdEmpresa: '',
    sDsSenha: '',
    sCdAgrupamento: '',
    nCdServico: SERVICOS.map((s) => s.codigo).join(','),
    sCepOrigem: origem,
    sCepDestino: destino,
    nVlPeso: String(peso),
    nCdFormato: '1',
    nVlComprimento: '20',
    nVlAltura: '5',
    nVlLargura: '15',
    nVlDiametro: '0',
    sCdMaoPropria: 'n',
    nVlValorDeclarado: '0',
    sCdAvisoRecebimento: 'n',
    StrRetorno: 'xml',
  })

  const url = `https://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx?${params}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error('Não foi possível consultar os Correios.')
  const xml = await res.text()

  const opcoes: OpcaoFreteCorreios[] = []
  for (const s of SERVICOS) {
    const bloco = xml.split(`<cServico>`).find((b) => b.includes(`<Codigo>${s.codigo}</Codigo>`))
    if (!bloco) continue
    const erro = parseXmlTag(`<cServico>${bloco}`, 'Erro')
    if (erro && erro !== '0') continue
    const valorStr = parseXmlTag(`<cServico>${bloco}`, 'Valor')
    const prazoStr = parseXmlTag(`<cServico>${bloco}`, 'PrazoEntrega')
    const valor = valorStr ? Number(valorStr.replace(',', '.')) : NaN
    const prazo = prazoStr ? Number(prazoStr) : 0
    if (!Number.isFinite(valor) || valor <= 0) continue
    opcoes.push({ servico: s.servico, codigo: s.codigo, nome: s.nome, valor, prazo })
  }

  if (opcoes.length === 0) {
    throw new Error('Nenhuma opção de frete disponível para este CEP.')
  }
  return opcoes
}

export async function calcularFreteCorreios(input: {
  cepOrigem: string
  cepDestino: string
  pesoKg: number
  melhorEnvioToken?: string | null
  melhorEnvioSandbox?: boolean
  valorSeguro?: number
  products?: MelhorEnvioProductInput[]
  empresaId?: string
}): Promise<OpcaoFreteCorreios[]> {
  const resolved = resolveMelhorEnvioAuth(input.melhorEnvioToken, input.melhorEnvioSandbox)
  if (resolved.auth) {
    return calcularFreteMelhorEnvio({
      token: resolved.auth.access_token,
      refreshToken: resolved.auth.refresh_token,
      sandbox: resolved.sandbox,
      cepOrigem: input.cepOrigem,
      cepDestino: input.cepDestino,
      pesoKg: input.pesoKg,
      valorSeguro: input.valorSeguro,
      products: input.products,
      onTokenRefreshed: input.empresaId
        ? (auth) => saveMelhorEnvioAuth(input.empresaId!, auth)
        : undefined,
    })
  }

  return calcularFreteCorreiosLegado(input)
}
