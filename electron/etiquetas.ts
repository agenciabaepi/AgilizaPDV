/** Dados mínimos para etiqueta de produto */
export type ProdutoEtiqueta = {
  nome: string
  preco: number
  codigo_barras: string | null
  unidade?: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Gera HTML para impressão de etiquetas (grid de etiquetas ~50x30mm cada). */
export function etiquetasToHtml(produtos: ProdutoEtiqueta[]): string {
  const labels = produtos.map((p) => {
    const nome = escapeHtml(p.nome.length > 28 ? p.nome.slice(0, 25) + '...' : p.nome)
    const codigo = p.codigo_barras ? escapeHtml(p.codigo_barras) : ''
    const unidade = p.unidade ?? 'UN'
    return `
      <div class="etiqueta">
        <div class="etiqueta-nome">${nome}</div>
        <div class="etiqueta-preco">R$ ${p.preco.toFixed(2)}</div>
        ${codigo ? `<div class="etiqueta-codigo">${codigo}</div>` : ''}
        <div class="etiqueta-un">${unidade}</div>
      </div>
    `
  })
  return `
    <style>
      .etiquetas-page { display: flex; flex-wrap: wrap; gap: 4px; padding: 10px; font-family: sans-serif; }
      .etiqueta { width: 48mm; min-height: 28mm; padding: 4px; border: 1px dashed #333; font-size: 10px; display: flex; flex-direction: column; justify-content: space-between; }
      .etiqueta-nome { font-weight: bold; font-size: 11px; line-height: 1.2; }
      .etiqueta-preco { font-size: 14px; font-weight: bold; }
      .etiqueta-codigo { font-size: 9px; font-family: monospace; }
      .etiqueta-un { font-size: 9px; color: #666; }
    </style>
    <div class="etiquetas-page">${labels.join('')}</div>
  `
}
