/**
 * Gera HTML do CUPOM FISCAL ELETRÔNICO - NFC-e para impressão (layout térmico 80mm).
 * Inclui: empresa, itens, totais, pagamentos, tributos aproximados (IBPT), chave, QR code, rodapé.
 */
import type { VendaDetalhes } from '../backend/services/vendas.service'
import type { EmpresaConfig } from '../backend/services/empresas.service'
import type { StatusNfce } from '../backend/services/nfce.service'

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

  const W = 302
  const lines: string[] = []
  lines.push(`<div class="nfce-cupom" style="font-family: monospace; font-size: 11px; width: ${W}px; padding: 12px; box-sizing: border-box;">`)

  // Cabeçalho - Empresa
  lines.push('<div class="nfce-header" style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">')
  lines.push(`<div style="font-weight: bold; font-size: 12px;">${escapeHtml(nomeFantasia)}</div>`)
  lines.push(`<div style="font-size: 10px;">${escapeHtml(razaoSocial)}</div>`)
  lines.push(`<div style="font-size: 10px;">${escapeHtml(endereco)}</div>`)
  lines.push(`<div style="font-size: 10px; margin-top: 4px;">CNPJ: ${escapeHtml(cnpj)}</div>`)
  lines.push(`<div style="font-size: 10px;">IE: ${escapeHtml(ie)}</div>`)
  lines.push('</div>')

  // Identificação do documento
  lines.push('<div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">')
  lines.push(`<div style="font-weight: bold;">Extrato No. ${status.numero_nfce ?? v.numero}</div>`)
  lines.push('<div style="font-weight: bold; margin-top: 4px;">CUPOM FISCAL ELETRÔNICO - NFC-e</div>')
  lines.push('<div style="font-size: 10px; margin-top: 4px;">Consumidor não identificado</div>')
  lines.push('</div>')

  // Tabela de itens (# COD DESC QTD UN VL UNIT VL ITEM)
  lines.push('<table style="width: 100%; font-size: 10px; border-collapse: collapse; margin-bottom: 8px;">')
  lines.push('<thead><tr style="border-bottom: 1px solid #000;">')
  lines.push('<th style="text-align: left;">#</th><th style="text-align: left;">DESC</th><th style="text-align: right;">QTD</th><th style="text-align: right;">VL UNIT R$</th><th style="text-align: right;">VL ITEM R$</th></tr></thead><tbody>')
  d.itens.forEach((i, idx) => {
    const vlUnit = i.quantidade > 0 ? i.total / i.quantidade : 0
    lines.push(
      '<tr style="border-bottom: 1px dotted #999;">' +
      `<td>${String(idx + 1).padStart(3, '0')}</td>` +
      `<td>${escapeHtml(i.descricao.slice(0, 28))}</td>` +
      `<td style="text-align: right;">${i.quantidade}</td>` +
      `<td style="text-align: right;">${vlUnit.toFixed(2)}</td>` +
      `<td style="text-align: right;">${i.total.toFixed(2)}</td>` +
      '</tr>'
    )
  })
  lines.push('</tbody></table>')

  // Totais e pagamento
  lines.push('<div style="border-top: 1px dashed #000; padding-top: 8px; font-size: 10px;">')
  lines.push(`<div style="display: flex; justify-content: space-between;"><span>Subtotal</span><span>${v.subtotal.toFixed(2)}</span></div>`)
  if (v.desconto_total > 0) {
    lines.push(`<div style="display: flex; justify-content: space-between;"><span>Descontos</span><span>-${v.desconto_total.toFixed(2)}</span></div>`)
  }
  lines.push(`<div style="display: flex; justify-content: space-between; font-weight: bold;"><span>TOTAL R$</span><span>${v.total.toFixed(2)}</span></div>`)
  d.pagamentos.forEach((p) => {
    lines.push(`<div style="display: flex; justify-content: space-between;"><span>${escapeHtml(p.forma)}</span><span>${p.valor.toFixed(2)}</span></div>`)
  })
  if (v.troco > 0) {
    lines.push(`<div style="display: flex; justify-content: space-between;"><span>Troco R$</span><span>${v.troco.toFixed(2)}</span></div>`)
  }
  lines.push('</div>')

  // Tributos aproximados (Lei 12.741/2012 - IBPT)
  if (indicar_fonte_ibpt) {
    const fmt = (x: number) => x.toFixed(2).replace('.', ',')
    lines.push('<div style="margin-top: 10px; font-size: 9px; border-top: 1px dashed #000; padding-top: 8px;">')
    lines.push('<div style="font-weight: bold;">OBSERVAÇÕES DO CONTRIBUINTE</div>')
    lines.push(`<div style="margin-top: 4px;">Valor aprox. dos Tributos: R$ ${fmt(trib.federal)} Federal, R$ ${fmt(trib.estadual)} Estadual e R$ ${fmt(trib.municipal)} Municipal.</div>`)
    lines.push('<div style="margin-top: 2px;">Fonte: IBPT - Conforme Lei Fed. 12.741/2012</div>')
    lines.push('<div style="margin-top: 2px;">Valor aproximado dos Tributos (Conforme Lei Fed. 12.741/2012)</div>')
    lines.push('</div>')
  }

  // Nota fiscal
  lines.push('<div style="margin-top: 10px; font-size: 9px; text-align: center; border-top: 1px dashed #000; padding-top: 8px;">')
  lines.push('ICMS a ser recolhido conforme LC 123/2006 - Simples Nacional')
  lines.push('</div>')

  // Informações gerais da nota + Chave + QR Code
  if (status.protocolo || status.chave) {
    lines.push('<div style="margin-top: 10px; font-size: 9px; border-top: 1px dashed #000; padding-top: 8px;">')
    lines.push(`<div>Emissão: ${dataHora}</div>`)
    if (status.protocolo) {
      lines.push(`<div>Protocolo: ${escapeHtml(status.protocolo)}</div>`)
    }
    if (status.chave) {
      const chaveFmt = status.chave.replace(/(.{4})/g, '$1 ').trim()
      lines.push(`<div style="word-break: break-all; margin-top: 4px;">Chave: ${chaveFmt}</div>`)
      if (qrCodeDataUrl) {
        lines.push(`<div style="text-align: center; margin-top: 8px;"><img src="${escapeHtml(qrCodeDataUrl)}" alt="QR Code" width="120" height="120" style="display: block; margin: 0 auto;" /></div>`)
        lines.push('<div style="text-align: center; margin-top: 6px; font-size: 8px;">Consulte o QR Code pelo aplicativo "De olho na nota" ou em nfce.fazenda.sp.gov.br</div>')
      } else {
        lines.push('<div style="margin-top: 6px;">Consulte pela chave em nfce.fazenda.sp.gov.br</div>')
      }
    }
    lines.push('</div>')
  }

  // Rodapé - Nome do sistema
  lines.push('<div style="margin-top: 14px; padding-top: 8px; border-top: 1px dashed #000; font-size: 9px; text-align: center; color: #666;">')
  lines.push('powered by <strong>Agiliza PDV</strong>')
  lines.push('</div>')

  lines.push('</div>')
  return lines.join('')
}
