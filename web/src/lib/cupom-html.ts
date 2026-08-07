import type { VendaDetalhes } from '../vite-env'
import { labelFormaPagamento } from './forma-pagamento-labels'

export type CupomEmpresaInfo = {
  razao_social?: string | null
  cnpj?: string | null
  endereco?: string | null
  telefone?: string | null
  vendedor_nome?: string | null
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtMoeda(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

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

function sep(): string {
  return '<div class="cupom-sep"></div>'
}

function row(label: string, value: string, bold = false): string {
  const w = bold ? ' font-weight:700;' : ''
  return `<div class="cupom-row" style="${w}"><span>${label}</span><span>${value}</span></div>`
}

/** Gera HTML do cupom não fiscal (layout térmico 80mm, padrão PDV profissional). */
export function cupomToHtml(d: VendaDetalhes, empresaInfo?: CupomEmpresaInfo | null): string {
  const v = d.venda
  const info = empresaInfo ?? {}
  const dataHora = fmtDataHora(v.created_at)
  const nomeFantasia = d.empresa_nome.trim() || 'Empresa'
  const razaoSocial = info.razao_social?.trim() || nomeFantasia
  const endereco = info.endereco?.trim() || null
  const cnpj = fmtCnpj(info.cnpj)
  const telefone = info.telefone?.trim() || null
  const vendedor = info.vendedor_nome?.trim() || null
  const qtdItens = d.itens.reduce((acc, i) => acc + i.quantidade, 0)
  const clienteNome = d.cliente_nome_cupom?.trim() || null
  const clienteDoc = fmtCpfCnpj(d.cliente_documento_cupom)

  const lines: string[] = []
  lines.push('<div class="cupom-nao-fiscal">')

  // Cabeçalho emitente
  lines.push('<div class="cupom-block cupom-header">')
  lines.push(`<div class="cupom-store">${escapeHtml(nomeFantasia)}</div>`)
  if (razaoSocial !== nomeFantasia) {
    lines.push(`<div class="cupom-meta">${escapeHtml(razaoSocial)}</div>`)
  }
  if (endereco) lines.push(`<div class="cupom-meta">${escapeHtml(endereco)}</div>`)
  if (cnpj) lines.push(`<div class="cupom-meta">CNPJ: ${escapeHtml(cnpj)}</div>`)
  if (telefone) lines.push(`<div class="cupom-meta">Tel: ${escapeHtml(telefone)}</div>`)
  lines.push('</div>')

  lines.push(sep())

  // Tipo documento
  lines.push('<div class="cupom-block cupom-doc-type">')
  lines.push('<div class="cupom-doc-title">COMPROVANTE DE VENDA</div>')
  lines.push('<div class="cupom-doc-sub">CUPOM NÃO FISCAL</div>')
  lines.push('<div class="cupom-doc-note">Documento sem valor fiscal</div>')
  lines.push('</div>')

  lines.push(sep())

  // Identificação da venda
  lines.push('<div class="cupom-block cupom-ident">')
  lines.push(row('Cupom nº', String(v.numero).padStart(6, '0')))
  lines.push(row('Data/Hora', escapeHtml(dataHora)))
  if (vendedor) lines.push(row('Operador', escapeHtml(vendedor)))
  if (clienteNome) {
    lines.push(row('Cliente', escapeHtml(clienteNome)))
    if (clienteDoc) lines.push(row('CPF/CNPJ', escapeHtml(clienteDoc)))
  } else {
    lines.push(row('Cliente', 'Consumidor'))
  }
  lines.push('</div>')

  lines.push(sep())

  // Itens
  lines.push('<table class="cupom-itens">')
  lines.push(
    '<thead><tr>' +
      '<th>#</th><th>DESCRIÇÃO</th><th>QTD</th><th>UNIT</th><th>TOTAL</th>' +
      '</tr></thead><tbody>'
  )
  d.itens.forEach((i, idx) => {
    const vlUnit = i.quantidade > 0 ? i.total / i.quantidade : 0
    lines.push(
      '<tr>' +
        `<td>${String(idx + 1).padStart(2, '0')}</td>` +
        `<td class="cupom-item-desc">${escapeHtml(i.descricao.slice(0, 32))}</td>` +
        `<td>${i.quantidade}</td>` +
        `<td>${fmtMoeda(vlUnit)}</td>` +
        `<td>${fmtMoeda(i.total)}</td>` +
        '</tr>'
    )
    if (i.desconto > 0) {
      lines.push(
        `<tr class="cupom-item-desc-extra"><td colspan="5">desconto item: -R$ ${fmtMoeda(i.desconto)}</td></tr>`
      )
    }
  })
  lines.push('</tbody></table>')

  lines.push(sep())

  // Totais
  lines.push('<div class="cupom-block cupom-totais">')
  lines.push(row('Qtd. total itens', String(qtdItens)))
  lines.push(row('Subtotal R$', fmtMoeda(v.subtotal)))
  if (v.desconto_total > 0) {
    lines.push(row('Descontos R$', `- ${fmtMoeda(v.desconto_total)}`))
  }
  lines.push(`<div class="cupom-total-destaque"><span>TOTAL R$</span><span>${fmtMoeda(v.total)}</span></div>`)
  lines.push('</div>')

  lines.push(sep())

  // Pagamentos
  lines.push('<div class="cupom-block cupom-pagamentos">')
  lines.push('<div class="cupom-section-label">FORMA DE PAGAMENTO</div>')
  for (const p of d.pagamentos) {
    lines.push(row(escapeHtml(labelFormaPagamento(p.forma)), fmtMoeda(p.valor)))
  }
  if (v.troco > 0) {
    lines.push(row('Troco R$', fmtMoeda(v.troco)))
  }
  lines.push('</div>')

  const ehVendaPrazo = Number(v.venda_a_prazo) === 1 || d.pagamentos.some((p) => p.forma === 'A_PRAZO')
  if (ehVendaPrazo) {
    lines.push(sep())
    lines.push('<div class="cupom-block cupom-prazo">')
    lines.push('<div class="cupom-section-label">VENDA A PRAZO</div>')
    if (clienteNome) lines.push(`<div class="cupom-meta">Cliente: <strong>${escapeHtml(clienteNome)}</strong></div>`)
    if (clienteDoc) lines.push(`<div class="cupom-meta">CPF/CNPJ: ${escapeHtml(clienteDoc)}</div>`)
    if (v.data_vencimento) {
      const dv = new Date(`${String(v.data_vencimento).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
      lines.push(`<div class="cupom-meta">Vencimento: <strong>${escapeHtml(dv)}</strong></div>`)
    }
    lines.push(
      '<div class="cupom-legal">Declaro estar ciente das condições da compra a prazo e responsabilizo-me pelo pagamento na data acima.</div>'
    )
    lines.push('<div class="cupom-assinatura"></div>')
    lines.push('<div class="cupom-assinatura-label">Assinatura do cliente / responsável</div>')
    lines.push('</div>')
  }

  const cb = d.cashback_cupom
  if (cb && !ehVendaPrazo) {
    lines.push(sep())
    lines.push('<div class="cupom-block cupom-cashback">')
    lines.push('<div class="cupom-section-label">PROGRAMA DE CASHBACK</div>')
    lines.push(`<div class="cupom-meta">Cliente: ${escapeHtml(cb.cliente_nome)}</div>`)
    if (cb.gerado > 0) lines.push(`<div class="cupom-meta">Gerado nesta compra: <strong>R$ ${fmtMoeda(cb.gerado)}</strong></div>`)
    if (cb.usado > 0) lines.push(`<div class="cupom-meta">Utilizado nesta compra: <strong>R$ ${fmtMoeda(cb.usado)}</strong></div>`)
    if (cb.saldo_disponivel != null) {
      lines.push(`<div class="cupom-meta">Saldo disponível: <strong>R$ ${fmtMoeda(cb.saldo_disponivel)}</strong></div>`)
    }
    if (cb.gerado > 0 && cb.validade_credito_iso) {
      lines.push(
        `<div class="cupom-meta">Validade: ${escapeHtml(new Date(cb.validade_credito_iso).toLocaleString('pt-BR'))}</div>`
      )
    }
    if (cb.gerado <= 0 && cb.usado <= 0 && cb.motivo_nao_gerado) {
      lines.push(`<div class="cupom-meta">${escapeHtml(cb.motivo_nao_gerado)}</div>`)
    }
    lines.push('</div>')
  }

  lines.push(sep())

  // Rodapé
  lines.push('<div class="cupom-block cupom-footer">')
  lines.push('<div class="cupom-thanks">Obrigado pela preferência!</div>')
  lines.push('<div class="cupom-legal">Este comprovante não substitui a Nota Fiscal Eletrônica quando exigida por lei.</div>')
  lines.push('<div class="cupom-brand">Agiliza PDV</div>')
  lines.push('</div>')

  lines.push('</div>')
  return lines.join('')
}

/** Estilos compartilhados (pré-visualização e impressão 80mm). */
export const CUPOM_NAO_FISCAL_STYLES = `
.cupom-nao-fiscal {
  font-family: 'Courier New', Consolas, 'Liberation Mono', monospace;
  font-size: 11px;
  line-height: 1.35;
  color: #111;
  width: 100%;
  max-width: 302px;
  margin: 0 auto;
  padding: 4mm 3mm;
  box-sizing: border-box;
  background: #fff;
}
.cupom-block { margin: 0; }
.cupom-header { text-align: center; }
.cupom-store { font-weight: 700; font-size: 13px; letter-spacing: 0.02em; text-transform: uppercase; }
.cupom-meta { font-size: 10px; margin-top: 3px; line-height: 1.4; word-break: break-word; }
.cupom-sep { border-top: 1px dashed #222; margin: 8px 0; }
.cupom-doc-type { text-align: center; }
.cupom-doc-title { font-weight: 700; font-size: 12px; letter-spacing: 0.04em; }
.cupom-doc-sub { font-weight: 700; font-size: 11px; margin-top: 4px; }
.cupom-doc-note { font-size: 9px; margin-top: 4px; color: #444; }
.cupom-row { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; margin-top: 3px; }
.cupom-row span:last-child { text-align: right; white-space: nowrap; }
.cupom-section-label { font-weight: 700; font-size: 10px; margin-bottom: 4px; letter-spacing: 0.03em; }
.cupom-itens { width: 100%; border-collapse: collapse; font-size: 10px; }
.cupom-itens th { border-bottom: 1px solid #222; padding: 3px 2px; text-align: left; font-size: 9px; }
.cupom-itens th:nth-child(n+3), .cupom-itens td:nth-child(n+3) { text-align: right; }
.cupom-itens td { padding: 4px 2px; vertical-align: top; border-bottom: 1px dotted #bbb; }
.cupom-item-desc { max-width: 120px; word-break: break-word; }
.cupom-item-desc-extra td { font-size: 9px; color: #555; border-bottom: none; padding-top: 0; }
.cupom-total-destaque {
  display: flex; justify-content: space-between; font-weight: 700;
  font-size: 13px; margin-top: 8px; padding-top: 6px; border-top: 1px solid #222;
}
.cupom-legal { font-size: 9px; line-height: 1.45; color: #444; margin-top: 8px; text-align: center; }
.cupom-thanks { text-align: center; font-weight: 700; font-size: 11px; }
.cupom-brand { text-align: center; font-size: 9px; color: #666; margin-top: 6px; }
.cupom-assinatura { border-bottom: 1px solid #222; min-height: 28px; margin-top: 16px; }
.cupom-assinatura-label { text-align: center; font-size: 8px; margin-top: 4px; color: #555; }
@media print {
  .cupom-nao-fiscal { max-width: none; width: 72mm; padding: 2mm 1mm; }
}
`

export function cupomNaoFiscalDocumentHtml(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CUPOM_NAO_FISCAL_STYLES}@media print { @page { margin: 2mm; size: 80mm auto; } body { margin: 0; } }</style></head><body>${body}</body></html>`
}

export type ReciboRecebimentoCupomData = {
  empresa_id: string
  empresa_nome: string
  cliente_nome: string
  cliente_doc: string | null
  venda_numero: number
  valor: number
  forma_recebimento: string
  recebido_em: string
  conta_id: string
}

/** Cupom não fiscal — comprovante de recebimento de título (contas a receber). */
export function reciboRecebimentoToHtml(d: ReciboRecebimentoCupomData): string {
  const dataHora = new Date(d.recebido_em).toLocaleString('pt-BR')
  const formaLabel = labelFormaPagamento(d.forma_recebimento)
  const lines: string[] = []
  lines.push(
    '<div style="font-family: \'Courier New\', Consolas, monospace; font-size: 12px; line-height: 1.32; color: #000; width: 100%; padding: 2.5mm 1mm; box-sizing: border-box;">'
  )
  lines.push(`<div style="text-align: center; font-weight: bold; margin-bottom: 8px;">${escapeHtml(d.empresa_nome)}</div>`)
  lines.push(`<div style="text-align: center; font-size: 10px; margin-bottom: 12px;">COMPROVANTE DE RECEBIMENTO</div>`)
  lines.push(`<div style="border-bottom: 1px dashed #000; margin-bottom: 8px; font-size: 10px;">`)
  lines.push(
    `<div style="font-size: 9px; word-break: break-all; margin-bottom: 4px;">Ref. conta: ${escapeHtml(d.conta_id)}</div>`
  )
  lines.push(`<div>${escapeHtml(dataHora)}</div>`)
  lines.push('</div>')
  lines.push('<div style="font-size: 11px;">')
  lines.push(`<div style="margin-bottom: 6px;"><strong>Cliente:</strong> ${escapeHtml(d.cliente_nome || '—')}</div>`)
  if (d.cliente_doc) {
    lines.push(`<div style="margin-bottom: 6px;"><strong>CPF/CNPJ:</strong> ${escapeHtml(d.cliente_doc)}</div>`)
  }
  lines.push(`<div style="margin-bottom: 6px;"><strong>Venda origem:</strong> #${d.venda_numero}</div>`)
  lines.push(`<div style="margin-bottom: 6px;"><strong>Valor recebido:</strong> R$ ${d.valor.toFixed(2)}</div>`)
  lines.push(`<div style="margin-bottom: 6px;"><strong>Forma:</strong> ${escapeHtml(formaLabel)}</div>`)
  lines.push('</div>')
  lines.push(
    '<div style="margin-top: 12px; font-size: 9px; color: #444; border-top: 1px dashed #000; padding-top: 8px;">Documento não fiscal. Comprovante de entrada no caixa referente ao título em contas a receber.</div>'
  )
  lines.push('<div style="text-align: center; margin-top: 12px; font-size: 10px;">Obrigado!</div>')
  lines.push('</div>')
  return lines.join('')
}
