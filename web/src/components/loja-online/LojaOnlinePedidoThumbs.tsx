import { Package } from 'lucide-react'
import type { LojaOnlinePedidoItemComImagem } from '../../lib/loja-online-types'

const MAX_THUMBS = 3

export function LojaOnlinePedidoThumbs({ itens }: { itens: LojaOnlinePedidoItemComImagem[] }) {
  if (itens.length === 0) {
    return (
      <div className="loja-store-pedido-thumbs">
        <div className="loja-store-pedido-thumb loja-store-pedido-thumb--placeholder" aria-hidden>
          <Package size={22} />
        </div>
      </div>
    )
  }

  const visible = itens.slice(0, MAX_THUMBS)
  const extra = itens.length - visible.length

  return (
    <div className="loja-store-pedido-thumbs" aria-label={`${itens.length} produto(s) no pedido`}>
      {visible.map((item) => (
        <div key={item.id} className="loja-store-pedido-thumb-wrap" title={item.nome}>
          {item.imagem ? (
            <img src={item.imagem} alt="" className="loja-store-pedido-thumb" loading="lazy" />
          ) : (
            <div className="loja-store-pedido-thumb loja-store-pedido-thumb--placeholder">
              <Package size={18} />
            </div>
          )}
          {item.quantidade > 1 && (
            <span className="loja-store-pedido-thumb-qty">×{item.quantidade}</span>
          )}
        </div>
      ))}
      {extra > 0 && (
        <div className="loja-store-pedido-thumb-more" aria-label={`Mais ${extra} produto(s)`}>
          +{extra}
        </div>
      )}
    </div>
  )
}
