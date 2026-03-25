/**
 * Gera HTML do CUPOM FISCAL ELETRÔNICO - NFC-e para impressão (layout térmico 80mm).
 * Inclui: empresa, itens, totais, pagamentos, tributos aproximados (IBPT), chave, QR code, rodapé.
 */
import type { VendaDetalhes } from '../backend/services/vendas.service'
import type { EmpresaConfig } from '../backend/services/empresas.service'
import type { StatusNfce } from '../backend/services/nfce.service'

function labelFormaPagamento(forma: string): string {
  if (forma === 'A_PRAZO') return 'A prazo'
  return forma
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
  lines.push(`<div class="nfce-cupom" style="font-family: 'Courier New', Consolas, monospace; font-size: 12px; line-height: 1.32; color: #000; width: ${W}px; padding: 12px; box-sizing: border-box;">`)

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
  lines.push('<table style="width: 100%; font-size: 11px; border-collapse: collapse; margin-bottom: 8px;">')
  lines.push('<thead><tr style="border-bottom: 1px solid #000;">')
  lines.push('<th style="text-align: left;">#</th><th style="text-align: left;">DESC</th><th style="text-align: right;">QTD</th><th style="text-align: right;">VL UNIT R$</th><th style="text-align: right;">VL ITEM R$</th></tr></thead><tbody>')
  d.itens.forEach((i, idx) => {
    const vlUnit = i.quantidade > 0 ? i.total / i.quantidade : 0
    lines.push(
      '<tr style="border-bottom: 1px dotted #000;">' +
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
    lines.push(
      `<div style="display: flex; justify-content: space-between;"><span>${escapeHtml(labelFormaPagamento(p.forma))}</span><span>${p.valor.toFixed(2)}</span></div>`
    )
  })
  if (v.troco > 0) {
    lines.push(`<div style="display: flex; justify-content: space-between;"><span>Troco R$</span><span>${v.troco.toFixed(2)}</span></div>`)
  }
  lines.push('</div>')

  const ehVendaPrazo = Number(v.venda_a_prazo) === 1 || d.pagamentos.some((p) => p.forma === 'A_PRAZO')
  if (ehVendaPrazo) {
    lines.push('<div style="margin-top: 8px; font-size: 9px; border-top: 1px dashed #000; padding-top: 8px;">')
    lines.push('<div style="font-weight: bold;">Pagamento a prazo</div>')
    const nomeCli = d.cliente_nome_cupom?.trim()
    const docCli = d.cliente_documento_cupom?.trim()
    if (nomeCli) {
      lines.push(`<div style="margin-top: 4px;">Cliente: <strong>${escapeHtml(nomeCli)}</strong></div>`)
    }
    if (docCli) {
      lines.push(`<div style="margin-top: 2px;">CPF/CNPJ: ${escapeHtml(docCli)}</div>`)
    }
    if (v.data_vencimento) {
      const dv = new Date(`${String(v.data_vencimento).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
      lines.push(`<div style="margin-top: 4px;">Venc.: <strong>${escapeHtml(dv)}</strong></div>`)
    }
    lines.push(
      '<div style="margin-top: 8px; line-height: 1.3;">Declaro estar ciente e responsabilizo-me pelo pagamento.</div>'
    )
    lines.push('<div style="margin-top: 16px; border-bottom: 1px solid #000; min-height: 24px;"></div>')
    lines.push('<div style="text-align: center; margin-top: 2px; font-size: 8px;">Assinatura do cliente</div>')
    lines.push('</div>')
  }

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

  const cb = d.cashback_cupom
  if (cb) {
    lines.push('<div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #000; font-size: 9px;">')
    lines.push('<div style="font-weight: bold; margin-bottom: 4px;">Programa de cashback</div>')
    lines.push(`<div style="margin-bottom: 4px;">Cliente: ${escapeHtml(cb.cliente_nome)}</div>`)
    if (cb.gerado > 0) {
      lines.push(`<div>Cashback gerado nesta compra: <strong>R$ ${cb.gerado.toFixed(2)}</strong></div>`)
    }
    if (cb.usado > 0) {
      lines.push(`<div>Cashback utilizado nesta compra: <strong>R$ ${cb.usado.toFixed(2)}</strong></div>`)
    }
    if (cb.saldo_disponivel != null) {
      lines.push(`<div>Saldo atual disponível: <strong>R$ ${cb.saldo_disponivel.toFixed(2)}</strong></div>`)
    } else {
      lines.push('<div style="margin-top: 4px;">Para acumular e usar cashback, cadastre CPF ou CNPJ válido no cliente.</div>')
    }
    if (cb.gerado > 0) {
      if (cb.validade_credito_iso) {
        const dt = new Date(cb.validade_credito_iso).toLocaleString('pt-BR')
        lines.push(`<div style="margin-top: 4px;">Validade deste crédito: ${escapeHtml(dt)}</div>`)
      } else {
        lines.push('<div style="margin-top: 4px;">Validade deste crédito: sem expiração</div>')
      }
    }
    if (cb.gerado <= 0 && cb.usado <= 0 && cb.motivo_nao_gerado) {
      lines.push(`<div style="margin-top: 4px;">Cashback não gerado nesta compra: ${escapeHtml(cb.motivo_nao_gerado)}</div>`)
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
