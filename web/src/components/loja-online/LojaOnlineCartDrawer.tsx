import { useEffect, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingBag, Palette, Pencil, X } from 'lucide-react'
import { formatCurrency } from '../../lib/loja-online'
import { prefetchLojaOnlineOrderBumps } from '../../lib/loja-online-api'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'
import { cartItemSubtotal, cartLineKey } from '../../lib/loja-online-types'
import { trackLojaOnlineBehavior, trackLojaOnlineCapa } from '../../lib/loja-online-behavior'
import { lockDocumentScroll, unlockDocumentScroll } from '../../lib/scroll-lock'

export function LojaOnlineCartDrawer() {
  const { link, store, capaPersonalizadaAtiva, corPrimaria } = useLojaOnlineStore()
  const { items, total, setQuantity, removeItem, cartOpen, closeCart } = useLojaOnlineCart()
  const closeRef = useRef<HTMLButtonElement>(null)
  const trackedOpenRef = useRef(false)

  useEffect(() => {
    if (!cartOpen) {
      trackedOpenRef.current = false
      return
    }
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart()
    }
    document.addEventListener('keydown', onKey)
    lockDocumentScroll()
    return () => {
      document.removeEventListener('keydown', onKey)
      unlockDocumentScroll()
    }
  }, [cartOpen, closeCart])

  useEffect(() => {
    if (!cartOpen || !store?.empresa_id || items.length === 0) return
    prefetchLojaOnlineOrderBumps(store.empresa_id)
  }, [cartOpen, store?.empresa_id, items.length])

  useEffect(() => {
    if (!cartOpen || !store?.empresa_id || trackedOpenRef.current) return
    trackedOpenRef.current = true
    trackLojaOnlineBehavior('cart_view', { subtotal: total, itens: items.length })
  }, [cartOpen, store?.empresa_id, total, items.length])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      id="loja-store-cart-drawer"
      className={`loja-store-cart-drawer${cartOpen ? ' is-open' : ''}`}
      aria-hidden={!cartOpen}
      style={{ '--loja-cor': corPrimaria } as CSSProperties}
    >
      <button
        type="button"
        className="loja-store-cart-drawer-backdrop"
        aria-label="Fechar carrinho"
        tabIndex={cartOpen ? 0 : -1}
        onClick={closeCart}
      />
      <aside
        className="loja-store-cart-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Carrinho"
      >
        <div className="loja-store-cart-drawer-head">
          <div className="loja-store-cart-drawer-title-wrap">
            <h2 className="loja-store-cart-drawer-title">Carrinho</h2>
            {items.length > 0 ? (
              <span className="loja-store-cart-drawer-count">
                {items.length} {items.length === 1 ? 'item' : 'itens'}
              </span>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="loja-store-cart-drawer-close"
            onClick={closeCart}
            aria-label="Fechar carrinho"
            tabIndex={cartOpen ? 0 : -1}
          >
            <X size={20} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="loja-store-cart-drawer-empty">
            <ShoppingBag size={40} strokeWidth={1.25} />
            <p>Seu carrinho está vazio</p>
            <button type="button" className="loja-store-btn-primary" onClick={closeCart}>
              Continuar comprando
            </button>
          </div>
        ) : (
          <>
            <div className="loja-store-cart-drawer-list">
              {items.map((item) => {
                const key = cartLineKey(item)
                return (
                  <article key={key} className="loja-store-cart-drawer-item">
                    <Link
                      to={link(`produto/${item.produtoPaiId || item.produtoId}`)}
                      className={`loja-store-cart-drawer-item-img${item.personalizacao ? ' is-capa' : ''}`}
                      onClick={closeCart}
                      tabIndex={cartOpen ? 0 : -1}
                    >
                      {item.imagem ? <img src={item.imagem} alt="" /> : null}
                    </Link>
                    <div className="loja-store-cart-drawer-item-body">
                      <Link
                        to={link(`produto/${item.produtoPaiId || item.produtoId}`)}
                        onClick={closeCart}
                        tabIndex={cartOpen ? 0 : -1}
                      >
                        {item.nome}
                      </Link>
                      {item.personalizacao ? (
                        <span className="loja-store-cart-item-personalizada">
                          <Palette size={12} /> Arte personalizada · {item.personalizacao.modeloNome}
                        </span>
                      ) : null}
                      <p className="loja-store-cart-drawer-item-price">
                        {formatCurrency(item.preco)} / {item.unidade}
                      </p>
                      <div className="loja-store-cart-drawer-item-actions">
                        <div className="loja-store-qty">
                          <button
                            type="button"
                            onClick={() => setQuantity(key, item.quantidade - 1)}
                            tabIndex={cartOpen ? 0 : -1}
                            aria-label="Diminuir quantidade"
                          >
                            <Minus size={14} />
                          </button>
                          <span>{item.quantidade}</span>
                          <button
                            type="button"
                            onClick={() => setQuantity(key, item.quantidade + 1)}
                            tabIndex={cartOpen ? 0 : -1}
                            aria-label="Aumentar quantidade"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <strong>{formatCurrency(cartItemSubtotal(item))}</strong>
                        <button
                          type="button"
                          className="loja-store-icon-btn"
                          onClick={() => removeItem(key)}
                          tabIndex={cartOpen ? 0 : -1}
                          aria-label="Remover item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      {capaPersonalizadaAtiva && item.personalizacao && item.produtoPaiId ? (
                        <div className="loja-store-cart-item-capa-acoes">
                          <Link
                            to={link(
                              `personalizar/${item.produtoPaiId}?editar=${encodeURIComponent(item.personalizacao.designId)}`
                            )}
                            onClick={() => {
                              trackLojaOnlineCapa('carrinho_editar_arte', item.produtoPaiId!, {
                                modelo: item.personalizacao?.modeloNome,
                              })
                              closeCart()
                            }}
                            tabIndex={cartOpen ? 0 : -1}
                          >
                            <Pencil size={13} /> Editar arte
                          </Link>
                          <Link
                            to={link(`personalizar/${item.produtoPaiId}`)}
                            onClick={() => {
                              trackLojaOnlineCapa('carrinho_outra_capa', item.produtoPaiId!)
                              closeCart()
                            }}
                            tabIndex={cartOpen ? 0 : -1}
                          >
                            <Plus size={13} /> Criar outra capa
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="loja-store-cart-drawer-footer">
              <div className="loja-store-summary-row">
                <span>Subtotal</span>
                <strong>{formatCurrency(total)}</strong>
              </div>
              <Link
                to={link('checkout')}
                className="loja-store-btn-primary loja-store-btn-block"
                onClick={closeCart}
                tabIndex={cartOpen ? 0 : -1}
              >
                Finalizar pedido
              </Link>
              <button type="button" className="loja-store-link-muted loja-store-cart-drawer-continue" onClick={closeCart}>
                Continuar comprando
              </button>
            </div>
          </>
        )}
      </aside>
    </div>,
    document.body
  )
}
