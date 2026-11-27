/**
 * Cupons em "blocos" para o programa Agiliza Impressão (impressora térmica ESC/POS).
 * O programa só sabe desenhar os blocos; o conteúdo e o visual ficam aqui, então
 * mudar o cupom não exige atualizar o programa instalado nas lojas.
 */
import type { VendaDetalhes } from '../vite-env'
import type { CupomEmpresaInfo, ReciboRecebimentoCupomData } from './cupom-html'
import type { NfceCupomEmpresa, StatusNfce, TributosAprox } from './nfce-cupom'
import { labelFormaPagamento } from './forma-pagamento-labels'

export type BlocoImpressao =
  | {
      t: 'texto'
      v: string
      alinhar?: 'esquerda' | 'centro' | 'direita'
      negrito?: boolean
      largura?: 1 | 2
      altura?: 1 | 2
    }
  | { t: 'linha'; esq: string; dir: string; negrito?: boolean }
  | { t: 'divisor'; c?: string }
  | { t: 'pular'; n?: number }
  | { t: 'qrcode'; v: string; tamanho?: number }

export type DocumentoImpressao = {
  blocos: BlocoImpressao[]
  abrir_gaveta?: boolean
  copias?: number
}

type ItemCupom = { descricao: string; quantidade: number; total: number; desconto: number }
type PagamentoCupom = { forma: string; valor: number }

const moeda = (n: number) => (Number(n) || 0).toFixed(2).replace('.', ',')

function fmtCnpj(cnpj: string | null | undefined): string | null {
  if (!cnpj) return null
  const n = cnpj.replace(/\D/g, '')
  if (n.length !== 14) return cnpj
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`
}

function fmtCpfCnpj(doc: string | null | undefined): string | null {
  if (!doc) return null
  const n = doc.replace(/\D/g, '')
  if (n.length === 11) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`
  if (n.length === 14) return fmtCnpj(n)
  return doc
}

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function fmtQtd(q: number): string {
  return Number.isInteger(q) ? String(q) : String(q).replace('.', ',')
}

const centro = (v: string, extra: Partial<Extract<BlocoImpressao, { t: 'texto' }>> = {}): BlocoImpressao => ({
  t: 'texto',
  v,
  alinhar: 'centro',
  ...extra,
})
const texto = (v: string, negrito = false): BlocoImpressao => ({ t: 'texto', v, negrito })
const linha = (esq: string, dir: string, negrito = false): BlocoImpressao => ({ t: 'linha', esq, dir, negrito })
const divisor = (): BlocoImpressao => ({ t: 'divisor' })

/** Itens no formato "01 DESCRIÇÃO" e abaixo "  2 x 10,00            20,00". */
function itensBlocos(d: VendaDetalhes): BlocoImpressao[] {
  const out: BlocoImpressao[] = []
  d.itens.forEach((i: ItemCupom, idx: number) => {
    const unit = i.quantidade > 0 ? i.total / i.quantidade : 0
    out.push(texto(`${String(idx + 1).padStart(2, '0')} ${i.descricao}`))
    out.push(linha(`   ${fmtQtd(i.quantidade)} x ${moeda(unit)}`, moeda(i.total)))
    if (i.desconto > 0) out.push(texto(`   desconto item: -R$ ${moeda(i.desconto)}`))
  })
  return out
}

function pagamentosBlocos(d: VendaDetalhes): BlocoImpressao[] {
  const out: BlocoImpressao[] = []
  for (const p of d.pagamentos) out.push(linha(labelFormaPagamento(p.forma), moeda(p.valor)))
  if (d.venda.troco > 0) out.push(linha('Troco R$', moeda(d.venda.troco)))
  return out
}

function ehVendaPrazo(d: VendaDetalhes): boolean {
  return Number(d.venda.venda_a_prazo) === 1 || d.pagamentos.some((p: PagamentoCupom) => p.forma === 'A_PRAZO')
}

function prazoBlocos(d: VendaDetalhes): BlocoImpressao[] {
  const out: BlocoImpressao[] = [divisor(), texto('VENDA A PRAZO', true)]
  const nome = d.cliente_nome_cupom?.trim()
  const doc = fmtCpfCnpj(d.cliente_documento_cupom)
  if (nome) out.push(texto(`Cliente: ${nome}`))
  if (doc) out.push(texto(`CPF/CNPJ: ${doc}`))
  if (d.venda.data_vencimento) {
    const dv = new Date(`${String(d.venda.data_vencimento).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
    out.push(texto(`Vencimento: ${dv}`, true))
  }
  out.push(
    texto('Declaro estar ciente das condições da compra a prazo e responsabilizo-me pelo pagamento na data acima.'),
    { t: 'pular', n: 3 },
    { t: 'divisor', c: '_' },
    centro('Assinatura do cliente / responsável')
  )
  return out
}

function cashbackBlocos(d: VendaDetalhes): BlocoImpressao[] {
  const cb = d.cashback_cupom
  if (!cb) return []
  const out: BlocoImpressao[] = [divisor(), texto('PROGRAMA DE CASHBACK', true), texto(`Cliente: ${cb.cliente_nome}`)]
  if (cb.gerado > 0) out.push(linha('Gerado nesta compra', `R$ ${moeda(cb.gerado)}`))
  if (cb.usado > 0) out.push(linha('Utilizado nesta compra', `R$ ${moeda(cb.usado)}`))
  if (cb.saldo_disponivel != null) out.push(linha('Saldo disponível', `R$ ${moeda(cb.saldo_disponivel)}`))
  if (cb.gerado > 0 && cb.validade_credito_iso) {
    out.push(texto(`Validade: ${new Date(cb.validade_credito_iso).toLocaleString('pt-BR')}`))
  }
  if (cb.gerado <= 0 && cb.usado <= 0 && cb.motivo_nao_gerado) out.push(texto(cb.motivo_nao_gerado))
  return out
}

/** Cupom não fiscal (comprovante de venda). Mesmo conteúdo do cupom HTML. */
export function cupomNaoFiscalBlocos(d: VendaDetalhes, empresaInfo?: CupomEmpresaInfo | null): DocumentoImpressao {
  const v = d.venda
  const info = empresaInfo ?? {}
  const nomeFantasia = d.empresa_nome.trim() || 'Empresa'
  const razao = info.razao_social?.trim() || nomeFantasia
  const cnpj = fmtCnpj(info.cnpj)
  const clienteNome = d.cliente_nome_cupom?.trim() || null
  const clienteDoc = fmtCpfCnpj(d.cliente_documento_cupom)
  const qtdItens = d.itens.reduce((acc: number, i: ItemCupom) => acc + i.quantidade, 0)
  const prazo = ehVendaPrazo(d)

  const b: BlocoImpressao[] = [centro(nomeFantasia.toUpperCase(), { negrito: true, largura: 2, altura: 2 })]
  if (razao !== nomeFantasia) b.push(centro(razao))
  if (info.endereco?.trim()) b.push(centro(info.endereco.trim()))
  if (cnpj) b.push(centro(`CNPJ: ${cnpj}`))
  if (info.telefone?.trim()) b.push(centro(`Tel: ${info.telefone.trim()}`))
  b.push(divisor())
  b.push(centro('COMPROVANTE DE VENDA', { negrito: true }), centro('CUPOM NÃO FISCAL'), centro('Documento sem valor fiscal'))
  b.push(divisor())
  b.push(linha('Cupom nº', String(v.numero).padStart(6, '0')), linha('Data/Hora', fmtDataHora(v.created_at)))
  if (info.vendedor_nome?.trim()) b.push(linha('Operador', info.vendedor_nome.trim()))
  if (clienteNome) {
    b.push(linha('Cliente', clienteNome))
    if (clienteDoc) b.push(linha('CPF/CNPJ', clienteDoc))
  } else {
    b.push(linha('Cliente', 'Consumidor'))
  }
  b.push(divisor(), ...itensBlocos(d), divisor())
  b.push(linha('Qtd. total itens', fmtQtd(qtdItens)), linha('Subtotal R$', moeda(v.subtotal)))
  if (v.desconto_total > 0) b.push(linha('Descontos R$', `- ${moeda(v.desconto_total)}`))
  b.push({ t: 'texto', v: `TOTAL R$ ${moeda(v.total)}`, alinhar: 'direita', negrito: true, largura: 2, altura: 2 })
  b.push(divisor(), texto('FORMA DE PAGAMENTO', true), ...pagamentosBlocos(d))
  if (prazo) b.push(...prazoBlocos(d))
  else b.push(...cashbackBlocos(d))
  b.push(divisor())
  b.push(centro('Obrigado pela preferência!', { negrito: true }))
  b.push(centro('Este comprovante não substitui a Nota Fiscal Eletrônica quando exigida por lei.'))
  b.push({ t: 'pular', n: 1 }, centro('Agiliza PDV'))
  return { blocos: b, copias: prazo ? 2 : 1 }
}

/** Cupom da NFC-e (extrato) com QR Code de consulta. */
export function nfceCupomBlocos(
  d: VendaDetalhes,
  status: StatusNfce,
  empresa: NfceCupomEmpresa | null,
  options: { indicar_fonte_ibpt?: boolean; consultaUrl?: string | null; tributosAprox?: TributosAprox }
): DocumentoImpressao {
  const v = d.venda
  const nomeFantasia = empresa?.nome ?? d.empresa_nome
  const razao = empresa?.razao_social?.trim() || nomeFantasia
  const endereco = empresa?.endereco?.trim() || 'Endereço não informado'
  const cnpj = fmtCnpj(empresa?.cnpj ?? null) ?? '-'
  const ie = empresa?.ie_emitente?.trim() || 'IE não informada'
  const trib = options.tributosAprox ?? { federal: 0, estadual: 0, municipal: 0 }

  const b: BlocoImpressao[] = [centro(String(nomeFantasia).toUpperCase(), { negrito: true })]
  if (razao !== nomeFantasia) b.push(centro(razao))
  b.push(centro(endereco), centro(`CNPJ: ${cnpj}  IE: ${ie}`), divisor())
  b.push(
    centro(`Extrato No. ${status.numero_nfce ?? v.numero}`, { negrito: true }),
    centro('CUPOM FISCAL ELETRÔNICO - NFC-e', { negrito: true }),
    centro('Consumidor não identificado'),
    divisor()
  )
  b.push(...itensBlocos(d), divisor())
  b.push(linha('Subtotal', moeda(v.subtotal)))
  if (v.desconto_total > 0) b.push(linha('Descontos', `-${moeda(v.desconto_total)}`))
  b.push({ t: 'texto', v: `TOTAL R$ ${moeda(v.total)}`, alinhar: 'direita', negrito: true, largura: 2, altura: 2 })
  b.push(...pagamentosBlocos(d))
  if (ehVendaPrazo(d)) b.push(...prazoBlocos(d))
  if (options.indicar_fonte_ibpt) {
    b.push(
      divisor(),
      texto('OBSERVAÇÕES DO CONTRIBUINTE', true),
      texto(
        `Tributos aprox.: R$ ${moeda(trib.federal)} Fed., R$ ${moeda(trib.estadual)} Est. e R$ ${moeda(trib.municipal)} Mun. Fonte: IBPT - Lei 12.741/2012`
      )
    )
  }
  b.push(divisor(), centro('ICMS conforme LC 123/2006 - Simples Nacional'))
  if (status.protocolo || status.chave) {
    b.push(divisor(), texto(`Emissão: ${fmtDataHora(v.created_at)}`))
    if (status.protocolo) b.push(texto(`Protocolo: ${status.protocolo}`))
    if (status.chave) {
      b.push(centro('Chave de acesso', { negrito: true }), centro(status.chave.replace(/(.{4})/g, '$1 ').trim()))
      if (options.consultaUrl) {
        b.push({ t: 'qrcode', v: options.consultaUrl, tamanho: 5 })
        b.push(centro('Consulte pelo app "De olho na nota" ou no site da SEFAZ'))
      } else {
        b.push(centro('Consulte pela chave no site da SEFAZ'))
      }
    }
  }
  b.push(...cashbackBlocos(d))
  b.push(divisor(), centro('powered by Agiliza PDV'))
  return { blocos: b }
}

/** Comprovante de recebimento de conta a receber. */
export function reciboRecebimentoBlocos(d: ReciboRecebimentoCupomData): DocumentoImpressao {
  const b: BlocoImpressao[] = [
    centro(d.empresa_nome.toUpperCase(), { negrito: true }),
    centro('COMPROVANTE DE RECEBIMENTO'),
    divisor(),
    texto(new Date(d.recebido_em).toLocaleString('pt-BR')),
    texto(`Cliente: ${d.cliente_nome || '—'}`),
  ]
  if (d.cliente_doc) b.push(texto(`CPF/CNPJ: ${d.cliente_doc}`))
  b.push(
    texto(`Venda origem: #${d.venda_numero}`),
    linha('Valor recebido', `R$ ${moeda(d.valor)}`, true),
    texto(`Forma: ${labelFormaPagamento(d.forma_recebimento)}`),
    divisor(),
    texto('Documento não fiscal. Comprovante de entrada no caixa referente ao título em contas a receber.'),
    { t: 'pular', n: 1 },
    centro('Obrigado!')
  )
  return { blocos: b }
}

export type FechamentoCaixaDados = {
  empresa_nome: string
  operador?: string | null
  aberto_em: string
  fechado_em: string | null
  valor_inicial: number
  totais_por_forma: { forma: string; total: number }[]
  movimentos: { tipo: string; valor: number; motivo?: string | null }[]
  saldo_final: number
  valor_manter_proximo?: number | null
}

/** Relatório de fechamento de caixa. */
export function fechamentoCaixaBlocos(d: FechamentoCaixaDados): DocumentoImpressao {
  const b: BlocoImpressao[] = [
    centro(d.empresa_nome.toUpperCase(), { negrito: true }),
    centro('FECHAMENTO DE CAIXA', { negrito: true }),
    divisor(),
    linha('Abertura', fmtDataHora(d.aberto_em)),
  ]
  if (d.fechado_em) b.push(linha('Fechamento', fmtDataHora(d.fechado_em)))
  if (d.operador) b.push(linha('Operador', d.operador))
  b.push(divisor(), linha('Valor inicial (troco)', moeda(d.valor_inicial)))
  b.push(divisor(), texto('VENDAS POR FORMA', true))
  const totalVendas = d.totais_por_forma.reduce((s, t) => s + (Number(t.total) || 0), 0)
  for (const t of d.totais_por_forma) b.push(linha(labelFormaPagamento(t.forma), moeda(t.total)))
  b.push(linha('Total vendido', moeda(totalVendas), true))
  if (d.movimentos.length) {
    b.push(divisor(), texto('SANGRIAS E SUPRIMENTOS', true))
    for (const m of d.movimentos) {
      const sinal = m.tipo === 'SANGRIA' ? '-' : '+'
      const nome = m.tipo === 'SANGRIA' ? 'Sangria' : m.tipo === 'SUPRIMENTO' ? 'Suprimento' : m.tipo
      b.push(linha(m.motivo ? `${nome} · ${m.motivo}` : nome, `${sinal} ${moeda(Math.abs(m.valor))}`))
    }
  }
  b.push(divisor(), { t: 'texto', v: `SALDO DO CAIXA R$ ${moeda(d.saldo_final)}`, alinhar: 'direita', negrito: true })
  if (d.valor_manter_proximo != null && d.valor_manter_proximo > 0) {
    b.push(linha('Manter para o próximo caixa', moeda(d.valor_manter_proximo)))
  }
  b.push({ t: 'pular', n: 3 }, { t: 'divisor', c: '_' }, centro('Assinatura do operador'))
  return { blocos: b }
}
