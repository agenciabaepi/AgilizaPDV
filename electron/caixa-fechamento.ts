import type { ResumoFechamentoCaixa, Caixa } from '../backend/services/caixa.service'
import type { EmpresaConfig } from '../backend/services/empresas.service'
import type { Usuario } from '../backend/services/usuarios.service'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function fechamentoCaixaToHtml(opts: {
  empresa: EmpresaConfig | null
  caixa: Caixa
  resumo: ResumoFechamentoCaixa
  operador: Usuario | null
  valorManterProximo?: number
}): string {
  const { empresa, caixa, resumo, operador, valorManterProximo } = opts
  const abertoEm = new Date(caixa.aberto_em).toLocaleString('pt-BR')
  const fechadoEm = caixa.fechado_em ? new Date(caixa.fechado_em).toLocaleString('pt-BR') : ''
  const empresaNome = empresa?.nome ?? 'Fechamento de Caixa'
  const responsavel = operador?.nome ?? '—'

  const totalPorForma = resumo.totais_por_forma
  const totalGeral = totalPorForma.reduce((acc, p) => acc + p.total, 0)

  const lines: string[] = []
  lines.push('<div style="font-family: monospace; font-size: 12px; width: 280px; padding: 8px 12px;">')
  lines.push('<div style="text-align: center; font-weight: bold; margin-bottom: 4px;">FECHAMENTO DE CAIXA</div>')
  lines.push(`<div style="text-align: center; margin-bottom: 8px;">${escapeHtml(empresaNome)}</div>`)

  lines.push('<div style="border-top: 1px solid #000; margin: 4px 0;"></div>')
  lines.push('<div style="font-size: 11px; margin-bottom: 4px;">')
  lines.push(`<div>Abertura: ${escapeHtml(abertoEm)}</div>`)
  if (fechadoEm) lines.push(`<div>Fechamento: ${escapeHtml(fechadoEm)}</div>`)
  lines.push(`<div>Responsável: ${escapeHtml(responsavel)}</div>`)
  lines.push('</div>')

  // Resumo dinheiro (abertura + vendas + saldo esperado)
  lines.push('<div style="border-top: 1px solid #000; margin: 4px 0;"></div>')
  lines.push('<div style="font-weight: bold; margin-bottom: 2px;">RESUMO</div>')
  lines.push('<div style="font-size: 11px;">')
  lines.push(`<div style="display:flex;justify-content:space-between;"><span>Abertura do caixa</span><span>R$ ${caixa.valor_inicial.toFixed(2)}</span></div>`)
  lines.push(`<div style="display:flex;justify-content:space-between;"><span>Total em vendas</span><span>R$ ${totalGeral.toFixed(2)}</span></div>`)
  lines.push(
    `<div style="display:flex;justify-content:space-between;font-weight:bold;margin-top:2px;"><span>SALDO ESPERADO</span><span>R$ ${resumo.saldo_atual.toFixed(2)}</span></div>`
  )
  if (valorManterProximo && valorManterProximo > 0) {
    lines.push(
      `<div style="display:flex;justify-content:space-between;margin-top:2px;"><span>Valor a manter no próximo caixa</span><span>R$ ${valorManterProximo.toFixed(2)}</span></div>`
    )
  }
  lines.push('</div>')

  // Totais por forma
  for (const p of totalPorForma) {
    lines.push('<div style="border-top: 1px solid #000; margin: 6px 0 2px 0;"></div>')
    lines.push(`<div style="font-weight:bold; margin-bottom:2px;">${escapeHtml(p.forma)}</div>`)
    lines.push('<div style="font-size:11px;">')
    lines.push(`<div style="display:flex;justify-content:space-between;"><span>Vendas</span><span>R$ ${p.total.toFixed(2)}</span></div>`)
    lines.push(
      `<div style="display:flex;justify-content:space-between;font-weight:bold;margin-top:2px;"><span>Total Geral</span><span>R$ ${p.total.toFixed(2)}</span></div>`
    )
    lines.push('</div>')
  }

  lines.push('<div style="border-top: 1px solid #000; margin: 8px 0;"></div>')
  lines.push(
    `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:11px;"><span>TOTAL FINAL</span><span>R$ ${totalGeral.toFixed(2)}</span></div>`
  )

  lines.push('<div style="margin-top:16px;border-top:1px solid #000;padding-top:24px;text-align:center;font-size:11px;">')
  lines.push('<span>Assinatura</span>')
  lines.push('</div>')

  lines.push('</div>')
  return lines.join('')
}

