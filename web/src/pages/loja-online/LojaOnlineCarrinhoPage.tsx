import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react'
import { formatCurrency } from '../../lib/loja-online'
import { prefetchLojaOnlineOrderBumps } from '../../lib/loja-online-api'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'
import { cartItemSubtotal } from '../../lib/loja-online-types'

export function LojaOnlineCarrinhoPage() {
  const { link, store } = useLojaOnlineStore()
  const { items, total, setQuantity, removeItem } = useLojaOnlineCart()

  useEffect(() => {
    if (!store?.empresa_id || items.length === 0) return
    prefetchLojaOnlineOrderBumps(store.empresa_id)
  }, [store?.empresa_id, items.length])

  if (items.length === 0) {
    return (
      <div className="loja-store-page loja-store-empty-state">
        <ShoppingBag size={48} strokeWidth={1.25} />
        <h1>Seu carrinho está vazio</h1>
        <p>Adicione produtos para continuar.</p>
        <Link to={link()} className="loja-store-btn-primary loja-store-btn-inline">
          Ver produtos
        </Link>
      </div>
    )
  }

  return (
    <div className="loja-store-page">
      <h1 className="loja-store-page-title">Carrinho</h1>
      <div className="loja-store-cart-layout">
        <div className="loja-store-cart-list">
          {items.map((item) => (
            <article key={item.produtoId} className="loja-store-cart-item">
              <div className="loja-store-cart-item-img">
                {item.imagem ? <img src={item.imagem} alt="" /> : null}
              </div>
              <div className="loja-store-cart-item-body">
                <Link to={link(`produto/${item.produtoId}`)}>{item.nome}</Link>
                <p>{formatCurrency(item.preco)} / {item.unidade}</p>
                <div className="loja-store-qty">
                  <button type="button" onClick={() => setQuantity(item.produtoId, item.quantidade - 1)}>
                    <Minus size={14} />
                  </button>
                  <span>{item.quantidade}</span>
                  <button type="button" onClick={() => setQuantity(item.produtoId, item.quantidade + 1)}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="loja-store-cart-item-right">
                <strong>{formatCurrency(cartItemSubtotal(item))}</strong>
                <button type="button" className="loja-store-icon-btn" onClick={() => removeItem(item.produtoId)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>

        <aside className="loja-store-cart-summary">
          <h2>Resumo</h2>
          <div className="loja-store-summary-row">
            <span>Subtotal</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
          <Link to={link('checkout')} className="loja-store-btn-primary loja-store-btn-block">
            Finalizar pedido
          </Link>
          <Link to={link()} className="loja-store-link-muted">Continuar comprando</Link>
        </aside>
      </div>
    </div>
  )
}
