/**
 * Gera HTML do CUPOM FISCAL ELETRÔNICO - NFC-e para impressão (layout térmico 80mm).
 * Inclui: empresa, itens, totais, pagamentos, tributos aproximados (IBPT), chave, QR code, rodapé.
 */
import type { VendaDetalhes } from '../backend/services/vendas.service'
import type { EmpresaConfig } from '../backend/services/empresas.service'
import type { StatusNfce } from '../backend/services/nfce.service'

function labelFormaPagamento(forma: string): string {
  const key = forma.trim().toUpperCase()
  const labels: Record<string, string> = {
    DINHEIRO: 'Dinheiro',
    DEBITO: 'Cartão débito',
    CREDITO: 'Cartão crédito',
    PIX: 'PIX',
    A_PRAZO: 'A prazo',
    CASHBACK: 'Cashback',
    OUTROS: 'Outros',
    LOJA_ONLINE: 'Loja online',
  }
  return labels[key] ?? forma
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtCnpj(cnpj: string | null): string {
  if (!cnpj) return '-'
  const n = cnpj.replace(/\D/g, '')
  if (n.length !== 14) return cnpj
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`
}

export type NfceCupomEmpresa = Pick<EmpresaConfig, 'nome' | 'razao_social' | 'endereco' | 'cnpj'> & { ie_emitente?: string }

export type TributosAprox = {
  federal: number
  estadual: number
  municipal: number
}

export type NfceCupomOptions = {
  indicar_fonte_ibpt?: boolean
  qrCodeDataUrl?: string
  tributosAprox?: TributosAprox
}

/** Estilos otimizados para impressora térmica 80mm (contraste alto, tipografia compacta). */
export const NFCE_CUPOM_STYLES = `
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: #000;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.nfce-cupom {
  font-family: "Courier New", Consolas, "Liberation Mono", monospace;
  font-size: 9px;
  line-height: 1.15;
  font-weight: 900;
  color: #000;
  width: 100%;
  max-width: 80mm;
  margin: 0 auto;
  padding: 1mm 0.4mm;
  background: #fff;
  -webkit-font-smoothing: none;
  font-smooth: never;
  text-rendering: geometricPrecision;
}
.nfce-cupom * { color: #000 !important; }
.nfce-sep {
  border: 0;
  border-top: 1px dashed #000;
  margin: 4px 0;
}
.nfce-center { text-align: center; }
.nfce-store { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.01em; }
.nfce-meta { font-size: 8px; line-height: 1.15; word-break: break-word; }
.nfce-title { font-size: 9px; font-weight: 900; margin-top: 2px; }
.nfce-itens {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 8px;
  margin: 2px 0;
}
.nfce-itens th {
  border-bottom: 1px solid #000;
  padding: 1px 1px 2px;
  font-size: 7px;
  font-weight: 900;
  text-align: left;
  white-space: nowrap;
}
.nfce-itens td {
  padding: 2px 1px;
  vertical-align: top;
  border-bottom: 1px dotted #000;
  word-break: break-word;
}
.nfce-itens .c-num { width: 8%; }
.nfce-itens .c-desc { width: 42%; }
.nfce-itens .c-qtd { width: 12%; text-align: right; }
.nfce-itens .c-unit { width: 19%; text-align: right; }
.nfce-itens .c-tot { width: 19%; text-align: right; }
.nfce-row {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-size: 8px;
  margin-top: 1px;
}
.nfce-row span:last-child { text-align: right; white-space: nowrap; }
.nfce-total {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 900;
  margin-top: 3px;
  padding-top: 3px;
  border-top: 1px solid #000;
}
.nfce-block { margin-top: 4px; font-size: 7px; line-height: 1.15; }
.nfce-block strong { font-weight: 900; }
.nfce-chave { word-break: break-all; font-size: 8px; margin-top: 2px; }
.nfce-qr { text-align: center; margin-top: 4px; }
.nfce-qr img { display: block; margin: 0 auto; width: 96px; height: 96px; image-rendering: pixelated; }
.nfce-brand { text-align: center; font-size: 8px; margin-top: 6px; font-weight: 900; }
@media print {
  @page { size: 80mm auto; margin: 0; }
  html, body { width: 80mm; margin: 0; padding: 0; }
  .nfce-cupom {
    max-width: none;
    width: 100%;
    padding: 0.8mm 0.5mm;
    margin: 0;
  }
}
`

export function nfceCupomDocumentHtml(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${NFCE_CUPOM_STYLES}</style></head><body>${body}</body></html>`
}

export function nfceCupomToHtml(
  d: VendaDetalhes,
  status: StatusNfce,
  empresa: NfceCupomEmpresa | null,
  options?: NfceCupomOptions
): string {
  const { indicar_fonte_ibpt = false, qrCodeDataUrl, tributosAprox } = options ?? {}
  const trib = tributosAprox ?? { federal: 0, estadual: 0, municipal: 0 }
  const v = d.venda
  const dataHora = new Date(v.created_at).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const nomeFantasia = empresa?.nome ?? d.empresa_nome
  const razaoSocial = empresa?.razao_social?.trim() || nomeFantasia
  const endereco = empresa?.endereco?.trim() || 'Endereço não informado'
  const cnpj = fmtCnpj(empresa?.cnpj ?? null)
  const ie = empresa?.ie_emitente?.trim() || 'IE não informada'

  const lines: string[] = []
  lines.push('<div class="nfce-cupom">')

  lines.push('<div class="nfce-center">')
  lines.push(`<div class="nfce-store">${escapeHtml(nomeFantasia)}</div>`)
  if (razaoSocial !== nomeFantasia) {
    lines.push(`<div class="nfce-meta">${escapeHtml(razaoSocial)}</div>`)
  }
  lines.push(`<div class="nfce-meta">${escapeHtml(endereco)}</div>`)
  lines.push(`<div class="nfce-meta">CNPJ: ${escapeHtml(cnpj)} &nbsp; IE: ${escapeHtml(ie)}</div>`)
  lines.push('</div>')
  lines.push('<hr class="nfce-sep" />')

  lines.push('<div class="nfce-center">')
  lines.push(`<div class="nfce-title">Extrato No. ${status.numero_nfce ?? v.numero}</div>`)
  lines.push('<div class="nfce-title">CUPOM FISCAL ELETRÔNICO - NFC-e</div>')
  lines.push('<div class="nfce-meta">Consumidor não identificado</div>')
  lines.push('</div>')
  lines.push('<hr class="nfce-sep" />')

  lines.push('<table class="nfce-itens">')
  lines.push(
    '<thead><tr>' +
      '<th class="c-num">#</th>' +
      '<th class="c-desc">DESC</th>' +
      '<th class="c-qtd">QTD</th>' +
      '<th class="c-unit">UNIT</th>' +
      '<th class="c-tot">TOTAL</th>' +
      '</tr></thead><tbody>'
  )
  d.itens.forEach((i, idx) => {
    const vlUnit = i.quantidade > 0 ? i.total / i.quantidade : 0
    lines.push(
      '<tr>' +
        `<td class="c-num">${String(idx + 1).padStart(3, '0')}</td>` +
        `<td class="c-desc">${escapeHtml(i.descricao.slice(0, 36))}</td>` +
        `<td class="c-qtd">${i.quantidade}</td>` +
        `<td class="c-unit">${vlUnit.toFixed(2)}</td>` +
        `<td class="c-tot">${i.total.toFixed(2)}</td>` +
        '</tr>'
    )
  })
  lines.push('</tbody></table>')

  lines.push('<hr class="nfce-sep" />')
  lines.push(`<div class="nfce-row"><span>Subtotal</span><span>${v.subtotal.toFixed(2)}</span></div>`)
  if (v.desconto_total > 0) {
    lines.push(`<div class="nfce-row"><span>Descontos</span><span>-${v.desconto_total.toFixed(2)}</span></div>`)
  }
  lines.push(`<div class="nfce-total"><span>TOTAL R$</span><span>${v.total.toFixed(2)}</span></div>`)
  d.pagamentos.forEach((p) => {
    lines.push(
      `<div class="nfce-row"><span>${escapeHtml(labelFormaPagamento(p.forma))}</span><span>${p.valor.toFixed(2)}</span></div>`
    )
  })
  if (v.troco > 0) {
    lines.push(`<div class="nfce-row"><span>Troco R$</span><span>${v.troco.toFixed(2)}</span></div>`)
  }

  const ehVendaPrazo = Number(v.venda_a_prazo) === 1 || d.pagamentos.some((p) => p.forma === 'A_PRAZO')
  if (ehVendaPrazo) {
    lines.push('<hr class="nfce-sep" />')
    lines.push('<div class="nfce-block">')
    lines.push('<div><strong>Pagamento a prazo</strong></div>')
    const nomeCli = d.cliente_nome_cupom?.trim()
    const docCli = d.cliente_documento_cupom?.trim()
    if (nomeCli) lines.push(`<div>Cliente: <strong>${escapeHtml(nomeCli)}</strong></div>`)
    if (docCli) lines.push(`<div>CPF/CNPJ: ${escapeHtml(docCli)}</div>`)
    if (v.data_vencimento) {
      const dv = new Date(`${String(v.data_vencimento).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
      lines.push(`<div>Venc.: <strong>${escapeHtml(dv)}</strong></div>`)
    }
    lines.push('<div style="margin-top:4px;">Declaro estar ciente e responsabilizo-me pelo pagamento.</div>')
    lines.push('<div style="margin-top:12px;border-bottom:1px solid #000;min-height:18px;"></div>')
    lines.push('<div class="nfce-center" style="margin-top:2px;font-size:7px;">Assinatura do cliente</div>')
    lines.push('</div>')
  }

  if (indicar_fonte_ibpt) {
    const fmt = (x: number) => x.toFixed(2).replace('.', ',')
    lines.push('<hr class="nfce-sep" />')
    lines.push('<div class="nfce-block">')
    lines.push('<div><strong>OBSERVACOES DO CONTRIBUINTE</strong></div>')
    lines.push(
      `<div>Tributos aprox.: R$ ${fmt(trib.federal)} Fed., R$ ${fmt(trib.estadual)} Est. e R$ ${fmt(trib.municipal)} Mun. Fonte: IBPT - Lei 12.741/2012</div>`
    )
    lines.push('</div>')
  }

  lines.push('<hr class="nfce-sep" />')
  lines.push('<div class="nfce-center nfce-block">ICMS conforme LC 123/2006 - Simples Nacional</div>')

  if (status.protocolo || status.chave) {
    lines.push('<hr class="nfce-sep" />')
    lines.push('<div class="nfce-block">')
    lines.push(`<div>Emissao: ${dataHora}</div>`)
    if (status.protocolo) {
      lines.push(`<div>Protocolo: ${escapeHtml(status.protocolo)}</div>`)
    }
    if (status.chave) {
      const chaveFmt = status.chave.replace(/(.{4})/g, '$1 ').trim()
      lines.push(`<div class="nfce-chave">Chave: ${chaveFmt}</div>`)
      if (qrCodeDataUrl) {
        lines.push(
          `<div class="nfce-qr"><img src="${escapeHtml(qrCodeDataUrl)}" alt="QR Code" width="96" height="96" /></div>`
        )
        lines.push(
          '<div class="nfce-center" style="margin-top:3px;font-size:7px;">Consulte pelo app "De olho na nota" ou nfce.fazenda.sp.gov.br</div>'
        )
      } else {
        lines.push('<div style="margin-top:3px;">Consulte pela chave em nfce.fazenda.sp.gov.br</div>')
      }
    }
    lines.push('</div>')
  }

  const cb = d.cashback_cupom
  if (cb) {
    lines.push('<hr class="nfce-sep" />')
    lines.push('<div class="nfce-block">')
    lines.push('<div><strong>Programa de cashback</strong></div>')
    lines.push(`<div>Cliente: ${escapeHtml(cb.cliente_nome)}</div>`)
    if (cb.gerado > 0) {
      lines.push(`<div>Gerado: <strong>R$ ${cb.gerado.toFixed(2)}</strong></div>`)
    }
    if (cb.usado > 0) {
      lines.push(`<div>Utilizado: <strong>R$ ${cb.usado.toFixed(2)}</strong></div>`)
    }
    if (cb.saldo_disponivel != null) {
      lines.push(`<div>Saldo: <strong>R$ ${cb.saldo_disponivel.toFixed(2)}</strong></div>`)
    }
    if (cb.gerado > 0) {
      if (cb.validade_credito_iso) {
        const dt = new Date(cb.validade_credito_iso).toLocaleString('pt-BR')
        lines.push(`<div>Validade: ${escapeHtml(dt)}</div>`)
      } else {
        lines.push('<div>Validade: sem expiracao</div>')
      }
    }
    if (cb.gerado <= 0 && cb.usado <= 0 && cb.motivo_nao_gerado) {
      lines.push(`<div>Nao gerado: ${escapeHtml(cb.motivo_nao_gerado)}</div>`)
    }
    lines.push('</div>')
  }

  lines.push('<hr class="nfce-sep" />')
  lines.push('<div class="nfce-brand">powered by Agiliza PDV</div>')
  lines.push('</div>')
  return lines.join('')
}
