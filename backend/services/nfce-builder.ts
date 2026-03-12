/**
 * Monta o objeto NFe (LayoutNFe) no formato esperado pela lib @nfewizard/nfce
 * para envio à SEFAZ (NFCE_Autorizacao).
 */
import type { Venda } from './vendas.service'
import type { EmpresaFiscalConfig } from './empresas.service'
import type { EmpresaConfig } from './empresas.service'
import { getDb } from '../db'
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

export type ItemParaNfce = {
  produto_id: string
  descricao: string
  preco_unitario: number
  quantidade: number
  desconto: number
  total: number
}

export type PagamentoParaNfce = {
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

export type BuildNFeInput = {
  venda: Venda
  numeroNfce: number
  fiscal: EmpresaFiscalConfig
  empresa: EmpresaConfig
  itens: ItemParaNfce[]
  pagamentos: PagamentoParaNfce[]
}

/**
 * Monta o objeto NFe (idLote, indSinc, NFe com infNFe) para NFCE_Autorizacao.
 */
export function buildNFePayload(input: BuildNFeInput): {
  idLote: string
  indSinc: number
  NFe: {
    infNFe: {
      ide: Record<string, unknown>
      emit: Record<string, unknown>
      det: Array<{ prod: Record<string, unknown>; imposto: Record<string, unknown> }>
      total: { ICMSTot: Record<string, string> }
      transp: { modFrete: number }
      pag: { detPag: Array<{ indPag: number; tPag: string; vPag: string }> }
    }
  }
} {
  const { venda, numeroNfce, fiscal, empresa, itens, pagamentos } = input
  const cnpj = (empresa.cnpj || '').replace(/\D/g, '')
  const cUF = UF_TO_CUF[fiscal.uf_emitente] ?? 35
  const tpAmb = fiscal.ambiente === 'homologacao' ? 2 : 1
  // Schema NFe exige: 0 ou 1-999 sem zeros à esquerda (pattern: 0|[1-9][0-9]{0,2})
  const serie = String(fiscal.serie_nfce)
  const enderEmit = buildEnderEmit(empresa, fiscal)

  // Ordem dos campos deve seguir o XSD: cDV entre tpEmis e tpAmb (a lib preenche cDV depois)
  const ide = {
    cUF,
    cNF: randomCNF(),
    natOp: 'Venda de mercadoria',
    mod: 65,
    serie,
    nNF: numeroNfce,
    dhEmi: dhEmi(),
    tpNF: 1,
    idDest: 1,
    cMunFG: enderEmit.cMun,
    tpImp: 4,
    tpEmis: 1,
    cDV: 0, // substituído pela lib com o dígito verificador da chave
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
    IE: (fiscal.ie_emitente || '').slice(0, 14), // schema NFe: maxLength 14
    CRT: 1, // Simples Nacional
  }

  const det: Array<{ prod: Record<string, unknown>; imposto: Record<string, unknown> }> = []
  let vProdTotal = 0

  // NCM deve existir na tabela TIPI; usa NCM do produto, senão ncm_padrao da config, senão fallback fixo
  const NCM_FALLBACK = '21069090' // Outras preparações para alimentação (genérico)
  const ncmPadraoConfig = (fiscal.ncm_padrao || '').replace(/\D/g, '').slice(0, 8)
  const ncmPadrao = ncmPadraoConfig.length === 8 ? ncmPadraoConfig : NCM_FALLBACK

  // Primeiro calcula o total bruto (sem desconto global) para ratear o desconto_total da venda
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

    // Ajuste de centavos no último item para garantir que a soma dos itens = totalLiquidoEsperado
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

    // Emissor CRT=1 (Simples Nacional): usar ICMSSN (CSOSN), não CST
    const imposto = {
      ICMS: {
        ICMSSN102: {
          orig: 0,
          CSOSN: 102 as const, // Tributada pelo Simples Nacional sem permissão de crédito
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

  // Para NFC-e:
  // - vProd = soma dos itens já líquidos de desconto global rateado
  // - vDesc = 0 (desconto considerado diretamente nos itens)
  // - vNF = vProd (igual ao total da venda)
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
    // Desconto total informado como zero; o desconto global foi rateado nos itens.
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
    // SEFAZ exige grupo card para pagamentos eletrônicos (cartão, PIX, outros). Não exige para dinheiro (01).
    // tpIntegra 2 = não integrado (sem TEF/maquininha integrada).
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
        det,
        total: { ICMSTot },
        transp,
        pag: { detPag },
      },
    },
  }
}

/** Busca itens da venda com produto_id para montar a NFe */
export function getVendaItensParaNfce(vendaId: string): ItemParaNfce[] {
  const db = getDb()
  if (!db) return []
  const rows = db
    .prepare(
      `SELECT produto_id, descricao, preco_unitario, quantidade, COALESCE(desconto, 0) AS desconto, total
       FROM venda_itens WHERE venda_id = ?`
    )
    .all(vendaId) as ItemParaNfce[]
  return rows
}

/** Busca pagamentos da venda para montar a NFe */
export function getVendaPagamentosParaNfce(vendaId: string): PagamentoParaNfce[] {
  const db = getDb()
  if (!db) return []
  const rows = db
    .prepare(`SELECT forma, valor FROM pagamentos WHERE venda_id = ?`)
    .all(vendaId) as PagamentoParaNfce[]
  return rows
}
