import type { VendaDetalhes } from '../backend/services/vendas.service'

/** Gera HTML do cupom para impressão (fonte fixa, largura ~58 chars). */
export function cupomToHtml(d: VendaDetalhes): string {
  const v = d.venda
  const dataHora = new Date(v.created_at).toLocaleString('pt-BR')
  const lines: string[] = []
  lines.push('<div style="font-family: monospace; font-size: 12px; width: 280px; padding: 16px;">')
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
    lines.push(`<div style="display: flex; justify-content: space-between;"><span>${p.forma}</span><span>R$ ${p.valor.toFixed(2)}</span></div>`)
  }
  if (v.troco > 0) {
    lines.push(`<div style="display: flex; justify-content: space-between;"><span>Troco</span><span>R$ ${v.troco.toFixed(2)}</span></div>`)
  }
  lines.push('</div>')
  lines.push('<div style="text-align: center; margin-top: 16px; font-size: 10px;">Obrigado pela preferência!</div>')
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
