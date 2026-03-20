/**
 * Monta o objeto NFe (LayoutNFe) para NF-e modelo 55.
 * Reaproveita a estrutura usada na NFC-e, ajustando apenas campos específicos (mod, tpImp, dest, etc.).
 *
 * Nesta etapa ainda não integramos com nenhuma lib específica de NF-e;
 * o builder serve para padronizar os dados da venda para o layout oficial.
 */
import type { Venda } from './vendas.service'
import type { EmpresaFiscalConfig, EmpresaConfig } from './empresas.service'
import type { Cliente } from './clientes.service'
import { getProdutoById } from './produtos.service'

const ZERO = '0.00'

/** Código IBGE da UF (2 dígitos) */
const UF_TO_CUF: Record<string, number> = {
  AC: 12, AL: 27, AM: 13, AP: 16, BA: 29, CE: 23, DF: 53, ES: 32, GO: 52,
  MA: 21, MG: 31, MS: 50, MT: 51, PA: 15, PB: 25, PE: 26, PI: 22, PR: 41,
  RJ: 33, RN: 24, RO: 11, RR: 14, RS: 43, SC: 42, SE: 28, SP: 35, TO: 17,
}

/** Forma de pagamento PDV -> tPag NFe (Portal NF-e) */
const FORMA_TO_TPAG: Record<string, string> = {
  DINHEIRO: '01',
  PIX: '17',
  DEBITO: '04',
  CREDITO: '03',
  OUTROS: '99',
}

export type ItemParaNfe = {
  produto_id: string
  descricao: string
  preco_unitario: number
  quantidade: number
  desconto: number
  total: number
}

export type PagamentoParaNfe = {
  forma: string
  valor: number
}

function toStr(n: number): string {
  return n.toFixed(2)
}

/** Gera código numérico aleatório 8 dígitos para cNF */
function randomCNF(): string {
  return String(Math.floor(Math.random() * 100000000)).padStart(8, '0')
}

/** Data/hora emissão no formato UTC exigido (AAAA-MM-DDThh:mm:ss-03:00) */
function dhEmi(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const h = pad(d.getHours())
  const min = pad(d.getMinutes())
  const s = pad(d.getSeconds())
  return `${y}-${m}-${day}T${h}:${min}:${s}-03:00`
}

/** Endereço emitente: usa endereco da empresa (texto) e fallbacks */
function buildEnderEmit(empresa: EmpresaConfig, fiscal: EmpresaFiscalConfig): {
  xLgr: string
  nro: string
  xBairro: string
  cMun: number
  xMun: string
  UF: string
  CEP: string
} {
  const parts = (empresa.endereco || 'Endereço não informado').split(/[,;\n]/).map((p) => p.trim()).filter(Boolean)
  const xLgr = parts[0] || 'Endereço não informado'
  const nro = 'S/N'
  const xBairro = parts[1] || 'Centro'
  const cMun = fiscal.c_mun_emitente ?? 3550308
  const xMun = 'São Paulo' // TODO: permitir configurar nome do município
  const UF = fiscal.uf_emitente
  const CEP = '00000000' // TODO: endereco_cep na config
  return { xLgr, nro, xBairro, cMun, xMun, UF, CEP }
}

/** Código IBGE do município (7 dígitos). Fallback por UF quando cliente não tem endereco_municipio_codigo. */
const UF_TO_CMUN_DEFAULT: Record<string, number> = {
  SP: 3550308,   // São Paulo
  RJ: 3304557,   // Rio de Janeiro
  MG: 3106200,   // Belo Horizonte
  PR: 4106902,   // Curitiba
  RS: 4314902,   // Porto Alegre
  SC: 4205407,   // Florianópolis
  BA: 2927408,   // Salvador
  PE: 2611606,   // Recife
  CE: 2304400,   // Fortaleza
  DF: 5300108,   // Brasília
  ES: 3205309,   // Vitória
  GO: 5208707,   // Goiânia
  PA: 1501402,   // Belém
  AC: 1200401,   // Rio Branco
  AL: 2704302,   // Maceió
  AM: 1302603,   // Manaus
  AP: 1600303,   // Macapá
  MA: 2111300,   // São Luís
  MS: 5002704,   // Campo Grande
  MT: 5103403,   // Cuiabá
  PB: 2507507,   // João Pessoa
  PI: 2211001,   // Teresina
  RN: 2408102,   // Natal
  RO: 1100205,   // Porto Velho
  RR: 1400100,   // Boa Vista
  SE: 2800308,   // Aracaju
  TO: 1721000,   // Palmas
}

/** Endereço destinatário: prioriza campos estruturados do cliente e faz fallback para o texto livre. Schema exige cMun antes de xMun. */
function buildEnderDest(cliente: Cliente): {
  xLgr: string
  nro: string
  xBairro: string
  cMun: number
  xMun: string
  UF: string
  CEP: string
} {
  const textoLivre = cliente.endereco || ''
  const partsFromText = textoLivre
    .split(/[,;\n]/)
    .map((p) => p.trim())
    .filter(Boolean)

  const xLgr =
    (cliente.endereco_logradouro && cliente.endereco_logradouro.trim()) ||
    partsFromText[0] ||
    'Endereço não informado'
  const nro =
    (cliente.endereco_numero && cliente.endereco_numero.trim()) ||
    'S/N'
  const xBairro =
    (cliente.endereco_bairro && cliente.endereco_bairro.trim()) ||
    partsFromText[1] ||
    'Centro'
  const UF =
    (cliente.endereco_uf && cliente.endereco_uf.trim()) ||
    'SP'
  const cMun =
    cliente.endereco_municipio_codigo != null && cliente.endereco_municipio_codigo > 0
      ? cliente.endereco_municipio_codigo
      : UF_TO_CMUN_DEFAULT[UF] ?? 3550308
  const xMun =
    (cliente.endereco_municipio && cliente.endereco_municipio.trim()) ||
    'Município não informado'
  const cepRaw = (cliente.endereco_cep && cliente.endereco_cep.replace(/\D/g, '')) || ''
  const CEP = cepRaw.padEnd(8, '0').slice(0, 8) || '00000000'
  return { xLgr, nro, xBairro, cMun, xMun, UF, CEP }
}

export type BuildNfeInput = {
  venda: Venda
  numeroNfe: number
  fiscal: EmpresaFiscalConfig
  empresa: EmpresaConfig
  cliente: Cliente
  itens: ItemParaNfe[]
  pagamentos: PagamentoParaNfe[]
}

/**
 * Monta o objeto NFe (idLote, indSinc, NFe com infNFe) para NF-e modelo 55.
 */
export function buildNfePayload(input: BuildNfeInput): {
  idLote: string
  indSinc: number
  NFe: {
    infNFe: {
      ide: Record<string, unknown>
      emit: Record<string, unknown>
      dest: Record<string, unknown>
      det: Array<{ prod: Record<string, unknown>; imposto: Record<string, unknown> }>
      total: { ICMSTot: Record<string, string> }
      transp: { modFrete: number }
      pag: { detPag: Array<{ indPag: number; tPag: string; vPag: string }> }
    }
  }
} {
  const { venda, numeroNfe, fiscal, empresa, cliente, itens, pagamentos } = input

  const cnpj = (empresa.cnpj || '').replace(/\D/g, '')
  const cUF = UF_TO_CUF[fiscal.uf_emitente] ?? 35
  const tpAmb = fiscal.ambiente === 'homologacao' ? 2 : 1
  const serie = String(fiscal.serie_nfe)
  const enderEmit = buildEnderEmit(empresa, fiscal)

  const ide = {
    cUF,
    cNF: randomCNF(),
    natOp: 'Venda de mercadoria',
    mod: 55,
    serie,
    nNF: numeroNfe,
    dhEmi: dhEmi(),
    tpNF: 1,
    idDest: 1,
    cMunFG: enderEmit.cMun,
    tpImp: 1, // DANFE retrato
    tpEmis: 1,
    cDV: 0,
    tpAmb,
    finNFe: 1,
    indFinal: 1,
    indPres: 1,
    procEmi: 0,
  }

  const emit = {
    CNPJCPF: cnpj,
    xNome: (empresa.razao_social || empresa.nome || 'Emitente').slice(0, 60),
    enderEmit,
    IE: (fiscal.ie_emitente || '').slice(0, 14),
    CRT: 1,
  }

  const docDest = (cliente.cpf_cnpj || '').replace(/\D/g, '')
  const dest: Record<string, unknown> = {
    xNome: cliente.nome.slice(0, 60),
    enderDest: buildEnderDest(cliente),
    indIEDest: Number(cliente.indicador_ie_dest ?? '9'),
  }
  if (docDest.length === 11) {
    dest.CNPJCPF = docDest
  } else if (docDest.length === 14) {
    dest.CNPJCPF = docDest
  }

  const det: Array<{ prod: Record<string, unknown>; imposto: Record<string, unknown> }> = []
  let vProdTotal = 0

  const NCM_FALLBACK = '21069090'
  const ncmPadraoConfig = (fiscal.ncm_padrao || '').replace(/\D/g, '').slice(0, 8)
  const ncmPadrao = ncmPadraoConfig.length === 8 ? ncmPadraoConfig : NCM_FALLBACK

  const descontoGlobal = venda.desconto_total ?? 0
  let totalBrutoItens = 0
  for (const item of itens) {
    const bruto = item.preco_unitario * item.quantidade
    totalBrutoItens += bruto
  }
  const totalLiquidoEsperado = totalBrutoItens - descontoGlobal
  const fatorDescontoGlobal = totalBrutoItens > 0 ? totalLiquidoEsperado / totalBrutoItens : 1

  for (let i = 0; i < itens.length; i++) {
    const item = itens[i]
    const produto = getProdutoById(item.produto_id)
    const ncmRaw = (produto?.ncm || '').replace(/\D/g, '').slice(0, 8)
    const ncm = ncmRaw.length === 8 ? ncmRaw : ncmPadrao
    const cfop = parseInt((produto?.cfop || '5102').replace(/\D/g, '').slice(0, 4), 10) || 5102

    const brutoItem = item.preco_unitario * item.quantidade
    let vProd = brutoItem * fatorDescontoGlobal

    if (i === itens.length - 1) {
      const somaAnteriores = vProdTotal
      vProd = totalLiquidoEsperado - somaAnteriores
    }

    vProdTotal += vProd
    const qCom = item.quantidade
    const vUnCom = qCom > 0 ? vProd / qCom : 0

    const prod: Record<string, unknown> = {
      cProd: String(produto?.codigo ?? i + 1),
      cEAN: 'SEM GTIN',
      xProd: (item.descricao || 'Produto').slice(0, 120),
      NCM: ncm,
      CFOP: cfop,
      uCom: 'UN',
      qCom,
      vUnCom: toStr(vUnCom),
      vProd: toStr(vProd),
      cEANTrib: 'SEM GTIN',
      uTrib: 'UN',
      qTrib: qCom,
      vUnTrib: toStr(vUnCom),
      indTot: 1,
    }

    const imposto = {
      ICMS: {
        ICMSSN102: {
          orig: 0,
          CSOSN: 102 as const,
        },
      },
      PIS: {
        PISNT: { CST: '07' },
      },
      COFINS: {
        COFINSNT: { CST: '07' },
      },
    }
    det.push({ prod, imposto })
  }

  const vNF = vProdTotal
  const ICMSTot = {
    vBC: ZERO,
    vICMS: ZERO,
    vICMSDeson: ZERO,
    vFCP: ZERO,
    vBCST: ZERO,
    vST: ZERO,
    vFCPST: ZERO,
    vFCPSTRet: ZERO,
    vProd: toStr(vProdTotal),
    vFrete: ZERO,
    vSeg: ZERO,
    vDesc: ZERO,
    vII: ZERO,
    vIPI: ZERO,
    vIPIDevol: ZERO,
    vPIS: ZERO,
    vCOFINS: ZERO,
    vOutro: ZERO,
    vNF: toStr(vNF),
  }

  const transp = { modFrete: 9 }

  const detPag = pagamentos.map((p) => {
    const formaNorm = typeof p.forma === 'string' ? p.forma.trim().toUpperCase() : ''
    const tPag = FORMA_TO_TPAG[formaNorm] || '99'
    const item: { indPag: 0; tPag: string; vPag: string; card?: { tpIntegra: '1' | '2' } } = {
      indPag: 0 as const,
      tPag,
      vPag: toStr(p.valor),
    }
    if (tPag !== '01') {
      item.card = { tpIntegra: '2' }
    }
    return item
  })

  return {
    idLote: String(Date.now()),
    indSinc: 1,
    NFe: {
      infNFe: {
        ide,
        emit,
        dest,
        det,
        total: { ICMSTot },
        transp,
        pag: { detPag },
      },
    },
  }
}

