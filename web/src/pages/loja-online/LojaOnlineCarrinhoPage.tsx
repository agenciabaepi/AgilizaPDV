import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingBag, Palette, Pencil } from 'lucide-react'
import { formatCurrency } from '../../lib/loja-online'
import { prefetchLojaOnlineOrderBumps } from '../../lib/loja-online-api'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'
import { cartItemSubtotal, cartLineKey } from '../../lib/loja-online-types'
import { trackLojaOnlineBehavior, trackLojaOnlineCapa } from '../../lib/loja-online-behavior'

export function LojaOnlineCarrinhoPage() {
  const { link, store } = useLojaOnlineStore()
  const { items, total, setQuantity, removeItem } = useLojaOnlineCart()

  useEffect(() => {
    if (!store?.empresa_id || items.length === 0) return
    prefetchLojaOnlineOrderBumps(store.empresa_id)
  }, [store?.empresa_id, items.length])

  useEffect(() => {
    if (!store?.empresa_id) return
    trackLojaOnlineBehavior('cart_view', { subtotal: total, itens: items.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registra só a abertura da página
  }, [store?.empresa_id])

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
          {items.map((item) => {
            const key = cartLineKey(item)
            return (
              <article key={key} className="loja-store-cart-item">
                <div className={`loja-store-cart-item-img${item.personalizacao ? ' loja-store-cart-item-img--capa' : ''}`}>
                  {item.imagem ? <img src={item.imagem} alt="" /> : null}
                </div>
                <div className="loja-store-cart-item-body">
                  <Link to={link(`produto/${item.produtoPaiId || item.produtoId}`)}>{item.nome}</Link>
                  {item.personalizacao && (
                    <span className="loja-store-cart-item-personalizada">
                      <Palette size={12} /> Arte personalizada · {item.personalizacao.modeloNome}
                    </span>
                  )}
                  <p>{formatCurrency(item.preco)} / {item.unidade}</p>
                  <div className="loja-store-qty">
                    <button type="button" onClick={() => setQuantity(key, item.quantidade - 1)}>
                      <Minus size={14} />
                    </button>
                    <span>{item.quantidade}</span>
                    <button type="button" onClick={() => setQuantity(key, item.quantidade + 1)}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div className="loja-store-cart-item-right">
                  <strong>{formatCurrency(cartItemSubtotal(item))}</strong>
                  <button type="button" className="loja-store-icon-btn" onClick={() => removeItem(key)}>
                    <Trash2 size={16} />
                  </button>
                </div>
                {item.personalizacao && item.produtoPaiId && (
                  <div className="loja-store-cart-item-capa-acoes">
                    <Link
                      to={link(`personalizar/${item.produtoPaiId}?editar=${encodeURIComponent(item.personalizacao.designId)}`)}
                      onClick={() =>
                        trackLojaOnlineCapa('carrinho_editar_arte', item.produtoPaiId!, { modelo: item.personalizacao?.modeloNome })
                      }
                    >
                      <Pencil size={13} /> Editar arte
                    </Link>
                    <Link
                      to={link(`personalizar/${item.produtoPaiId}`)}
                      onClick={() => trackLojaOnlineCapa('carrinho_outra_capa', item.produtoPaiId!)}
                    >
                      <Plus size={13} /> Criar outra capa
                    </Link>
                  </div>
                )}
              </article>
            )
          })}
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
