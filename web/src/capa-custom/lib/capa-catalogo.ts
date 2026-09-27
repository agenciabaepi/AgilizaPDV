import type { LojaOnlineVariacaoSku } from '../../lib/loja-online-api'
import { parseVariacaoEixos, parseVariacaoValores } from '../../lib/produto-variacoes'
import { PHONE_MODELS, type PhoneModel } from '../phoneModels'

/**
 * Id fixo do eixo de variação "Modelo" do produto Capa personalizada.
 * Cada valor do eixo usa o id do modelo (ex.: `iphone-15-pro`), então o SKU filho
 * aponta direto para o `PhoneModel` usado pelo editor.
 */
export const CAPA_EIXO_ID = 'capa-custom-modelo'

export function isCapaCustomProduto(produto: { variacao_eixos_json?: string | null } | null | undefined): boolean {
  if (!produto?.variacao_eixos_json) return false
  return parseVariacaoEixos(produto.variacao_eixos_json).some((e) => e.id === CAPA_EIXO_ID)
}

export function capaModeloIdDoSku(variacaoValoresJson: string | null | undefined): string | null {
  return parseVariacaoValores(variacaoValoresJson)[CAPA_EIXO_ID] ?? null
}

export type CapaModeloOpcao = {
  model: PhoneModel
  skuId: string
  skuNome: string
  preco: number
  controlaEstoque: boolean
  estoque: number
  disponivel: boolean
}

/** Modelos liberados pela loja (SKUs ativos), na ordem do catálogo de aparelhos. */
export function capaModelosFromSkus(skus: LojaOnlineVariacaoSku[]): CapaModeloOpcao[] {
  const byModel = new Map<string, LojaOnlineVariacaoSku>()
  for (const sku of skus) {
    if (Number(sku.ativo) !== 1) continue
    const modelId = capaModeloIdDoSku(sku.variacao_valores_json)
    if (modelId) byModel.set(modelId, sku)
  }
  return PHONE_MODELS.flatMap((model) => {
    const sku = byModel.get(model.id)
    if (!sku) return []
    const controlaEstoque = Number(sku.controla_estoque) === 1
    const estoque = Math.max(0, Number(sku.estoque_atual) || 0)
    return [
      {
        model,
        skuId: sku.id,
        skuNome: sku.nome,
        preco: Number(sku.preco) || 0,
        controlaEstoque,
        estoque,
        disponivel: !controlaEstoque || estoque > 0,
      },
    ]
  })
}
