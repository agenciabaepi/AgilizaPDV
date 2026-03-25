import type { VendaDetalhes } from '../backend/services/vendas.service'
import type { ReciboRecebimentoCupomData } from '../backend/services/contas-receber.service'

function labelFormaPagamento(forma: string): string {
  if (forma === 'A_PRAZO') return 'A prazo'
  return forma
}

/** Gera HTML do cupom para impressão (fonte fixa, largura ~58 chars). */
export function cupomToHtml(d: VendaDetalhes): string {
  const v = d.venda
  const dataHora = new Date(v.created_at).toLocaleString('pt-BR')
  const lines: string[] = []
  lines.push('<div style="font-family: monospace; font-size: 12px; width: 302px; padding: 10px; box-sizing: border-box;">')
  lines.push(`<div style="text-align: center; font-weight: bold; margin-bottom: 8px;">${escapeHtml(d.empresa_nome)}</div>`)
  lines.push(`<div style="text-align: center; font-size: 10px; margin-bottom: 12px;">CUPOM NÃO FISCAL</div>`)
  lines.push(`<div style="border-bottom: 1px dashed #000; margin-bottom: 8px;">`)
  lines.push(`Venda #${v.numero} &nbsp; ${escapeHtml(dataHora)}`)
  lines.push('</div>')
  lines.push('<table style="width: 100%; font-size: 11px; border-collapse: collapse;">')
  lines.push('<thead><tr style="border-bottom: 1px solid #ccc;"><th style="text-align: left;">Item</th><th style="text-align: right;">Qtd</th><th style="text-align: right;">Valor</th></tr></thead><tbody>')
  for (const i of d.itens) {
    lines.push(
      `<tr style="border-bottom: 1px dotted #ddd;">` +
      `<td>${escapeHtml(i.descricao)}</td>` +
      `<td style="text-align: right;">${i.quantidade}</td>` +
      `<td style="text-align: right;">R$ ${i.total.toFixed(2)}</td></tr>`
    )
  }
  lines.push('</tbody></table>')
  lines.push('<div style="border-top: 1px dashed #000; margin-top: 8px; padding-top: 8px; font-size: 11px;">')
  lines.push(`<div style="display: flex; justify-content: space-between;"><span>Subtotal</span><span>R$ ${v.subtotal.toFixed(2)}</span></div>`)
  if (v.desconto_total > 0) {
    lines.push(`<div style="display: flex; justify-content: space-between;"><span>Desconto</span><span>- R$ ${v.desconto_total.toFixed(2)}</span></div>`)
  }
  lines.push(`<div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 4px;"><span>Total</span><span>R$ ${v.total.toFixed(2)}</span></div>`)
  for (const p of d.pagamentos) {
    lines.push(
      `<div style="display: flex; justify-content: space-between;"><span>${escapeHtml(labelFormaPagamento(p.forma))}</span><span>R$ ${p.valor.toFixed(2)}</span></div>`
    )
  }
  if (v.troco > 0) {
    lines.push(`<div style="display: flex; justify-content: space-between;"><span>Troco</span><span>R$ ${v.troco.toFixed(2)}</span></div>`)
  }
  lines.push('</div>')

  const ehVendaPrazo = Number(v.venda_a_prazo) === 1 || d.pagamentos.some((p) => p.forma === 'A_PRAZO')
  if (ehVendaPrazo) {
    lines.push('<div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #000; font-size: 10px;">')
    lines.push('<div style="font-weight: bold; margin-bottom: 6px;">Pagamento a prazo</div>')
    const nomeCli = d.cliente_nome_cupom?.trim()
    const docCli = d.cliente_documento_cupom?.trim()
    if (nomeCli) {
      lines.push(`<div style="margin-bottom: 4px;">Cliente: <strong>${escapeHtml(nomeCli)}</strong></div>`)
    }
    if (docCli) {
      lines.push(`<div style="margin-bottom: 8px;">CPF/CNPJ: ${escapeHtml(docCli)}</div>`)
    } else if (!nomeCli && v.cliente_id) {
      lines.push('<div style="margin-bottom: 8px; color: #555;">Cliente: (cadastro não encontrado)</div>')
    }
    if (v.data_vencimento) {
      const dv = new Date(`${String(v.data_vencimento).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
      lines.push(`<div style="margin-bottom: 8px;">Data de vencimento: <strong>${escapeHtml(dv)}</strong></div>`)
    } else {
      lines.push('<div style="margin-bottom: 8px;">Data de vencimento: —</div>')
    }
    lines.push(
      '<div style="margin-top: 10px; font-size: 9px; line-height: 1.4;">Declaro estar ciente das condições da compra a prazo e responsabilizo-me pelo pagamento na data acima.</div>'
    )
    lines.push(
      '<div style="margin-top: 20px; border-bottom: 1px solid #000; min-height: 28px;"></div>'
    )
    lines.push('<div style="text-align: center; margin-top: 4px; font-size: 9px;">Assinatura do cliente / responsável</div>')
    lines.push('</div>')
  }

  const cb = d.cashback_cupom
  if (cb && !ehVendaPrazo) {
    lines.push('<div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #000; font-size: 10px;">')
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
  lines.push(
    `<div style="text-align: center; margin-top: ${ehVendaPrazo ? '12px' : '16px'}; font-size: 10px;">Obrigado pela preferência!</div>`
  )
  lines.push('</div>')
  return lines.join('')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Cupom não fiscal — comprovante de recebimento de título (contas a receber). */
export function reciboRecebimentoToHtml(d: ReciboRecebimentoCupomData): string {
  const dataHora = new Date(d.recebido_em).toLocaleString('pt-BR')
  const formaLabel = labelFormaPagamento(d.forma_recebimento)
  const lines: string[] = []
  lines.push('<div style="font-family: monospace; font-size: 12px; width: 302px; padding: 10px; box-sizing: border-box;">')
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
