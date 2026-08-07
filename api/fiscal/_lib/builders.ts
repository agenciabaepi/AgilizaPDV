import { HOMOLOG_NOME } from './config'

const ZERO = '0.00'

const UF_TO_CUF: Record<string, number> = {
  AC: 12, AL: 27, AM: 13, AP: 16, BA: 29, CE: 23, DF: 53, ES: 32, GO: 52,
  MA: 21, MG: 31, MS: 50, MT: 51, PA: 15, PB: 25, PE: 26, PI: 22, PR: 41,
  RJ: 33, RN: 24, RO: 11, RR: 14, RS: 43, SC: 42, SE: 28, SP: 35, TO: 17,
}

const UF_TO_CMUN_DEFAULT: Record<string, number> = {
  SP: 3550308,
}

const FORMA_TO_TPAG: Record<string, string> = {
  DINHEIRO: '01',
  PIX: '17',
  DEBITO: '04',
  CREDITO: '03',
  OUTROS: '99',
  CASHBACK: '99',
  LOJA_ONLINE: '99',
  A_PRAZO: '05',
}

/** SEFAZ exige xPag quando tPag = 99 (Outros). */
const FORMA_TO_XPAG: Record<string, string> = {
  OUTROS: 'Outros',
  CASHBACK: 'Cashback',
  LOJA_ONLINE: 'Pagamento loja online',
}

/** Grupo card só é válido para cartão e PIX (rejeição se enviado com tPag 99, etc.). */
const TPAG_ACEITA_CARD = new Set(['03', '04', '17'])

export type ProdutoFiscal = {
  id: string
  codigo?: number | null
  ncm?: string | null
  cfop?: string | null
}

export type ItemFiscal = {
  produto_id: string
  descricao: string
  preco_unitario: number
  quantidade: number
  desconto: number
  total: number
}

export type PagamentoFiscal = { forma: string; valor: number }

export type VendaFiscal = {
  id: string
  empresa_id: string
  desconto_total?: number | null
  troco?: number | null
}

export type EmpresaFiscal = {
  nome?: string | null
  razao_social?: string | null
  cnpj?: string | null
  endereco?: string | null
}

export type FiscalConfig = {
  ambiente: 'homologacao' | 'producao'
  serie_nfce: number
  serie_nfe: number
  uf_emitente: string
  ie_emitente: string
  c_mun_emitente?: number | null
  ncm_padrao?: string | null
}

export type ClienteFiscal = {
  nome: string
  cpf_cnpj?: string | null
  endereco?: string | null
  endereco_logradouro?: string | null
  endereco_numero?: string | null
  endereco_bairro?: string | null
  endereco_uf?: string | null
  endereco_municipio?: string | null
  endereco_municipio_codigo?: number | null
  endereco_cep?: string | null
  indicador_ie_dest?: string | null
}

function toStr(n: number): string {
  return n.toFixed(2)
}

function randomCNF(): string {
  return String(Math.floor(Math.random() * 100000000)).padStart(8, '0')
}

/** Data/hora de emissão no fuso de Brasília (SEFAZ exige offset explícito). */
function dhEmi(): string {
  const br = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
  return `${br.replace(' ', 'T')}-03:00`
}

function buildEnderEmit(empresa: EmpresaFiscal, fiscal: FiscalConfig) {
  const parts = (empresa.endereco || 'Endereço não informado').split(/[,;\n]/).map((p) => p.trim()).filter(Boolean)
  return {
    xLgr: parts[0] || 'Endereço não informado',
    nro: 'S/N',
    xBairro: parts[1] || 'Centro',
    cMun: fiscal.c_mun_emitente ?? 3550308,
    xMun: 'São Paulo',
    UF: fiscal.uf_emitente,
    CEP: '00000000',
  }
}

function buildEnderDest(cliente: ClienteFiscal) {
  const partsFromText = (cliente.endereco || '').split(/[,;\n]/).map((p) => p.trim()).filter(Boolean)
  const UF = (cliente.endereco_uf && cliente.endereco_uf.trim()) || 'SP'
  return {
    xLgr: (cliente.endereco_logradouro && cliente.endereco_logradouro.trim()) || partsFromText[0] || 'Endereço não informado',
    nro: (cliente.endereco_numero && cliente.endereco_numero.trim()) || 'S/N',
    xBairro: (cliente.endereco_bairro && cliente.endereco_bairro.trim()) || partsFromText[1] || 'Centro',
    cMun: cliente.endereco_municipio_codigo && cliente.endereco_municipio_codigo > 0
      ? cliente.endereco_municipio_codigo
      : UF_TO_CMUN_DEFAULT[UF] ?? 3550308,
    xMun: (cliente.endereco_municipio && cliente.endereco_municipio.trim()) || 'Município não informado',
    UF,
    CEP: ((cliente.endereco_cep && cliente.endereco_cep.replace(/\D/g, '')) || '00000000').padEnd(8, '0').slice(0, 8),
  }
}

function buildDetItens(
  venda: VendaFiscal,
  itens: ItemFiscal[],
  fiscal: FiscalConfig,
  produtoById: (id: string) => ProdutoFiscal | null,
  homologacao: boolean
) {
  const NCM_FALLBACK = '21069090'
  const ncmPadraoConfig = (fiscal.ncm_padrao || '').replace(/\D/g, '').slice(0, 8)
  const ncmPadrao = ncmPadraoConfig.length === 8 ? ncmPadraoConfig : NCM_FALLBACK
  const descontoGlobal = venda.desconto_total ?? 0
  let totalBrutoItens = 0
  for (const item of itens) totalBrutoItens += item.preco_unitario * item.quantidade
  const totalLiquidoEsperado = totalBrutoItens - descontoGlobal
  const fatorDescontoGlobal = totalBrutoItens > 0 ? totalLiquidoEsperado / totalBrutoItens : 1

  const det: Array<{ prod: Record<string, unknown>; imposto: Record<string, unknown> }> = []
  let vProdTotal = 0

  for (let i = 0; i < itens.length; i++) {
    const item = itens[i]
    const produto = produtoById(item.produto_id)
    const ncmRaw = (produto?.ncm || '').replace(/\D/g, '').slice(0, 8)
    const ncm = ncmRaw.length === 8 ? ncmRaw : ncmPadrao
    const cfop = parseInt((produto?.cfop || '5102').replace(/\D/g, '').slice(0, 4), 10) || 5102
    const brutoItem = item.preco_unitario * item.quantidade
    let vProd = brutoItem * fatorDescontoGlobal
    if (i === itens.length - 1) vProd = totalLiquidoEsperado - vProdTotal
    vProdTotal += vProd
    const qCom = item.quantidade
    const vUnCom = qCom > 0 ? vProd / qCom : 0
    let xProd = (item.descricao || 'Produto').slice(0, 120)
    if (homologacao && i === 0) xProd = HOMOLOG_NOME.slice(0, 120)

    det.push({
      prod: {
        cProd: String(produto?.codigo ?? i + 1),
        cEAN: 'SEM GTIN',
        xProd,
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
      },
      imposto: {
        ICMS: { ICMSSN102: { orig: 0, CSOSN: 102 } },
        PIS: { PISNT: { CST: '07' } },
        COFINS: { COFINSNT: { CST: '07' } },
      },
    })
  }

  return { det, vProdTotal }
}

function buildPag(pagamentos: PagamentoFiscal[], trocoVenda?: number | null) {
  const detPag = pagamentos.map((p) => {
    const formaNorm = typeof p.forma === 'string' ? p.forma.trim().toUpperCase() : ''
    const tPag = FORMA_TO_TPAG[formaNorm] || '99'
    // XSD exige ordem: indPag, tPag, xPag (se 99), vPag, card
    return {
      indPag: 0 as const,
      tPag,
      ...(tPag === '99' ? { xPag: FORMA_TO_XPAG[formaNorm] || 'Outros' } : {}),
      vPag: toStr(p.valor),
      ...(TPAG_ACEITA_CARD.has(tPag) ? { card: { tpIntegra: '2' as const } } : {}),
    }
  })

  const hasDinheiro = detPag.some((p) => p.tPag === '01')
  if (!hasDinheiro) return { detPag }

  const troco = Math.max(0, Number(trocoVenda ?? 0))
  return { detPag, vTroco: toStr(troco) }
}

export function buildNfcePayload(input: {
  venda: VendaFiscal
  numeroNfce: number
  fiscal: FiscalConfig
  empresa: EmpresaFiscal
  itens: ItemFiscal[]
  pagamentos: PagamentoFiscal[]
  produtoById: (id: string) => ProdutoFiscal | null
}) {
  const { venda, numeroNfce, fiscal, empresa, itens, pagamentos, produtoById } = input
  const homologacao = fiscal.ambiente === 'homologacao'
  const cnpj = (empresa.cnpj || '').replace(/\D/g, '')
  const enderEmit = buildEnderEmit(empresa, fiscal)
  const { det, vProdTotal } = buildDetItens(venda, itens, fiscal, produtoById, homologacao)

  let xNomeEmit = (empresa.razao_social || empresa.nome || 'Emitente').slice(0, 60)
  if (homologacao) xNomeEmit = HOMOLOG_NOME.slice(0, 60)

  return {
    idLote: String(Date.now()),
    indSinc: 1,
    NFe: {
      infNFe: {
        ide: {
          cUF: UF_TO_CUF[fiscal.uf_emitente] ?? 35,
          cNF: randomCNF(),
          natOp: 'Venda de mercadoria',
          mod: 65,
          serie: String(fiscal.serie_nfce),
          nNF: numeroNfce,
          dhEmi: dhEmi(),
          tpNF: 1,
          idDest: 1,
          cMunFG: enderEmit.cMun,
          tpImp: 4,
          tpEmis: 1,
          cDV: 0,
          tpAmb: homologacao ? 2 : 1,
          finNFe: 1,
          indFinal: 1,
          indPres: 1,
          procEmi: 0,
        },
        emit: {
          CNPJCPF: cnpj,
          xNome: xNomeEmit,
          enderEmit,
          IE: (fiscal.ie_emitente || '').slice(0, 14),
          CRT: 1,
        },
        det,
        total: {
          ICMSTot: {
            vBC: ZERO, vICMS: ZERO, vICMSDeson: ZERO, vFCP: ZERO, vBCST: ZERO, vST: ZERO,
            vFCPST: ZERO, vFCPSTRet: ZERO, vProd: toStr(vProdTotal), vFrete: ZERO, vSeg: ZERO,
            vDesc: ZERO, vII: ZERO, vIPI: ZERO, vIPIDevol: ZERO, vPIS: ZERO, vCOFINS: ZERO,
            vOutro: ZERO, vNF: toStr(vProdTotal),
          },
        },
        transp: { modFrete: 9 },
        pag: buildPag(pagamentos, venda.troco),
      },
    },
  }
}

export function buildNfePayload(input: {
  venda: VendaFiscal
  numeroNfe: number
  fiscal: FiscalConfig
  empresa: EmpresaFiscal
  cliente: ClienteFiscal
  itens: ItemFiscal[]
  pagamentos: PagamentoFiscal[]
  produtoById: (id: string) => ProdutoFiscal | null
}) {
  const { venda, numeroNfe, fiscal, empresa, cliente, itens, pagamentos, produtoById } = input
  const homologacao = fiscal.ambiente === 'homologacao'
  const cnpj = (empresa.cnpj || '').replace(/\D/g, '')
  const enderEmit = buildEnderEmit(empresa, fiscal)
  const { det, vProdTotal } = buildDetItens(venda, itens, fiscal, produtoById, homologacao)

  let xNomeEmit = (empresa.razao_social || empresa.nome || 'Emitente').slice(0, 60)
  if (homologacao) xNomeEmit = HOMOLOG_NOME.slice(0, 60)

  let xNomeDest = cliente.nome.slice(0, 60)
  if (homologacao) xNomeDest = HOMOLOG_NOME.slice(0, 60)

  const dest: Record<string, unknown> = {
    xNome: xNomeDest,
    enderDest: buildEnderDest(cliente),
    indIEDest: Number(cliente.indicador_ie_dest ?? '9'),
  }
  const docDest = (cliente.cpf_cnpj || '').replace(/\D/g, '')
  if (docDest.length === 11 || docDest.length === 14) dest.CNPJCPF = docDest

  return {
    idLote: String(Date.now()),
    indSinc: 1,
    NFe: {
      infNFe: {
        ide: {
          cUF: UF_TO_CUF[fiscal.uf_emitente] ?? 35,
          cNF: randomCNF(),
          natOp: 'Venda de mercadoria',
          mod: 55,
          serie: String(fiscal.serie_nfe),
          nNF: numeroNfe,
          dhEmi: dhEmi(),
          tpNF: 1,
          idDest: 1,
          cMunFG: enderEmit.cMun,
          tpImp: 1,
          tpEmis: 1,
          cDV: 0,
          tpAmb: homologacao ? 2 : 1,
          finNFe: 1,
          indFinal: 1,
          indPres: 1,
          procEmi: 0,
        },
        emit: {
          CNPJCPF: cnpj,
          xNome: xNomeEmit,
          enderEmit,
          IE: (fiscal.ie_emitente || '').slice(0, 14),
          CRT: 1,
        },
        dest,
        det,
        total: {
          ICMSTot: {
            vBC: ZERO, vICMS: ZERO, vICMSDeson: ZERO, vFCP: ZERO, vBCST: ZERO, vST: ZERO,
            vFCPST: ZERO, vFCPSTRet: ZERO, vProd: toStr(vProdTotal), vFrete: ZERO, vSeg: ZERO,
            vDesc: ZERO, vII: ZERO, vIPI: ZERO, vIPIDevol: ZERO, vPIS: ZERO, vCOFINS: ZERO,
            vOutro: ZERO, vNF: toStr(vProdTotal),
          },
        },
        transp: { modFrete: 9 },
        pag: buildPag(pagamentos, venda.troco),
      },
    },
  }
}
