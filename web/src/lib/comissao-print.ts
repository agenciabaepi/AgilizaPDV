import type { ComissaoRelatorio } from './comissoes-data'

function fmtMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtPct(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`
}

export function comissaoRelatorioToHtml(relatorio: ComissaoRelatorio, geradoEm: Date): string {
  const totalVendido = relatorio.vendedores.reduce((acc, v) => acc + v.total_vendido, 0)
  const totalComissao = relatorio.vendedores.reduce((acc, v) => acc + v.total_comissao, 0)
  const totalVendas = relatorio.vendas.length

  const vendedoresRows = relatorio.vendedores
    .map(
      (v) => `
      <tr>
        <td>${escapeHtml(v.nome)}</td>
        <td style="text-align:center">${v.qtd_vendas}</td>
        <td style="text-align:right">${fmtMoney(v.total_vendido)}</td>
        <td style="text-align:center">${fmtPct(v.comissao_percentual)}</td>
        <td style="text-align:right;font-weight:600">${fmtMoney(v.total_comissao)}</td>
        <td style="text-align:right">${v.meta_vendas_mes != null ? fmtMoney(v.meta_vendas_mes) : '—'}</td>
        <td style="text-align:center">${v.percentual_meta != null ? fmtPct(v.percentual_meta) : '—'}</td>
      </tr>`
    )
    .join('')

  const vendasRows = relatorio.vendas
    .map(
      (v) => `
      <tr>
        <td>#${v.numero}</td>
        <td>${fmtDate(v.created_at)}</td>
        <td>${escapeHtml(v.vendedor_nome)}</td>
        <td style="text-align:right">${fmtMoney(v.total)}</td>
        <td style="text-align:center">${fmtPct(v.comissao_percentual)}</td>
        <td style="text-align:right">${fmtMoney(v.comissao_valor)}</td>
      </tr>`
    )
    .join('')

  const produtosRows = relatorio.topProdutos
    .map(
      (p, idx) => `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>${escapeHtml(p.descricao)}</td>
        <td style="text-align:center">${p.quantidade}</td>
        <td style="text-align:right">${fmtMoney(p.receita)}</td>
      </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório de Comissões</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #111;
      margin: 24px;
      line-height: 1.4;
    }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .meta { color: #555; margin-bottom: 16px; }
    .resumo {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 16px 0 24px;
    }
    .resumo-item {
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 10px 12px;
    }
    .resumo-item .label { font-size: 10px; color: #666; text-transform: uppercase; }
    .resumo-item .value { font-size: 16px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f5f5f5; font-size: 11px; }
    .footer { margin-top: 32px; font-size: 10px; color: #888; }
    @media print {
      body { margin: 12px; }
      h2 { page-break-after: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Relatório de Comissões de Vendedores</h1>
  <div class="meta">
    <div><strong>${escapeHtml(relatorio.empresaNome)}</strong></div>
    <div>Período: ${escapeHtml(relatorio.periodoLabel)}</div>
    <div>Gerado em: ${fmtDate(geradoEm.toISOString())}</div>
    <div style="margin-top:6px;font-size:11px;color:#666">
      Considera vendas concluídas no PDV (exclui vendas online e canceladas).
    </div>
  </div>

  <div class="resumo">
    <div class="resumo-item">
      <div class="label">Total vendido</div>
      <div class="value">${fmtMoney(totalVendido)}</div>
    </div>
    <div class="resumo-item">
      <div class="label">Comissão total</div>
      <div class="value">${fmtMoney(totalComissao)}</div>
    </div>
    <div class="resumo-item">
      <div class="label">Vendas no período</div>
      <div class="value">${totalVendas}</div>
    </div>
  </div>

  <h2>Resumo por vendedor</h2>
  <table>
    <thead>
      <tr>
        <th>Vendedor</th>
        <th>Qtd</th>
        <th>Total vendido</th>
        <th>% Comissão</th>
        <th>Comissão</th>
        <th>Meta mensal</th>
        <th>Meta atingida</th>
      </tr>
    </thead>
    <tbody>
      ${vendedoresRows || '<tr><td colspan="7">Nenhuma venda no período.</td></tr>'}
    </tbody>
  </table>

  <h2>Detalhamento das vendas</h2>
  <table>
    <thead>
      <tr>
        <th>Nº</th>
        <th>Data</th>
        <th>Vendedor</th>
        <th>Total</th>
        <th>%</th>
        <th>Comissão</th>
      </tr>
    </thead>
    <tbody>
      ${vendasRows || '<tr><td colspan="6">Nenhuma venda no período.</td></tr>'}
    </tbody>
  </table>

  <h2>Produtos mais vendidos</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Produto</th>
        <th>Qtd</th>
        <th>Receita</th>
      </tr>
    </thead>
    <tbody>
      ${produtosRows || '<tr><td colspan="4">Nenhum produto no período.</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    Agiliza PDV — Relatório de comissões
  </div>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
