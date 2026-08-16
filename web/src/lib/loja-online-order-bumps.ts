import type {
  LojaOnlineOrderBump,
  LojaOnlineOrderBumpOferta,
  LojaOnlineProduto,
} from './loja-online-types'

function bumpPreco(bump: LojaOnlineOrderBump, produto: LojaOnlineProduto): number {
  if (bump.preco_especial != null && bump.preco_especial > 0) return bump.preco_especial
  return produto.preco
}

export function resolveLojaOnlineOrderBumpOfertas(
  bumps: LojaOnlineOrderBump[],
  cartProdutoIds: string[]
): LojaOnlineOrderBumpOferta[] {
  const inCart = new Set(cartProdutoIds)
  const byProduto = new Map<string, LojaOnlineOrderBumpOferta>()

  const sorted = [...bumps].sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === 'personalizado' ? -1 : 1
    return (a.ordem ?? 0) - (b.ordem ?? 0)
  })

  for (const bump of sorted) {
    if (bump.ativo === 0) continue
    const produto = bump.produto
    if (!produto) continue
    if (inCart.has(produto.id)) continue
    if (produto.controla_estoque && (produto.estoque_atual ?? 0) <= 0) continue

    if (bump.tipo === 'personalizado') {
      if (!bump.trigger_produto_id || !inCart.has(bump.trigger_produto_id)) continue
    }

    if (byProduto.has(produto.id)) continue

    const preco = bumpPreco(bump, produto)
    byProduto.set(produto.id, {
      bumpId: bump.id,
      tipo: bump.tipo,
      titulo: bump.titulo?.trim() || `Leve também: ${produto.nome}`,
      descricao: bump.descricao?.trim() || produto.descricao,
      preco,
      precoOriginal: preco < produto.preco ? produto.preco : null,
      produto,
    })
  }

  return [...byProduto.values()]
}
