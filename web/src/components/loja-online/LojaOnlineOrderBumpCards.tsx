import { useEffect, useRef, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { formatCurrency } from '../../lib/loja-online'
import type { LojaOnlineOrderBumpOferta, LojaOnlineProduto } from '../../lib/loja-online-types'

type Props = {
  ofertas: LojaOnlineOrderBumpOferta[]
  selectedIds: Set<string>
  onToggle: (oferta: LojaOnlineOrderBumpOferta, checked: boolean) => void
  loading?: boolean
}

export function LojaOnlineOrderBumpCards({ ofertas, selectedIds, onToggle, loading }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const carousel = ofertas.length > 1

  useEffect(() => {
    if (index >= ofertas.length) setIndex(0)
  }, [ofertas.length, index])

  const goTo = (i: number) => {
    const el = trackRef.current
    if (!el) return
    const card = el.children[i] as HTMLElement | undefined
    if (!card) return
    el.scrollTo({ left: card.offsetLeft, behavior: 'smooth' })
    setIndex(i)
  }

  const onScroll = () => {
    const el = trackRef.current
    if (!el || !carousel) return
    const cards = [...el.children] as HTMLElement[]
    const left = el.scrollLeft
    let best = 0
    let bestDist = Infinity
    cards.forEach((card, i) => {
      const dist = Math.abs(card.offsetLeft - left)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    })
    setIndex(best)
  }

  if (loading && ofertas.length === 0) {
    return (
      <section className="loja-store-orderbumps is-compact is-loading" aria-busy="true" aria-label="Carregando oferta">
        <div className="loja-store-orderbumps-skeleton" />
      </section>
    )
  }

  if (ofertas.length === 0) return null

  return (
    <section className="loja-store-orderbumps is-compact" aria-label="Oferta exclusiva">
      <div className="loja-store-orderbumps-ribbon">Compre junto</div>
      <div className="loja-store-orderbumps-head">
        <h2>Oferta exclusiva</h2>
        <p>Desconto especial só nesta compra</p>
      </div>

      <div
        ref={trackRef}
        className={`loja-store-orderbumps-track${carousel ? ' is-carousel' : ''}`}
        onScroll={carousel ? onScroll : undefined}
      >
        {ofertas.map((oferta, i) => {
          const checked = selectedIds.has(oferta.produto.id)
          return (
            <article
              key={oferta.bumpId}
              className={`loja-store-orderbump-card${checked ? ' is-checked' : ''}`}
            >
              <div className="loja-store-orderbump-top">
                <span className="loja-store-orderbump-media">
                  {oferta.produto.imagem ? (
                    <img
                      src={oferta.produto.imagem}
                      alt=""
                      className="loja-store-orderbump-img"
                      width={64}
                      height={64}
                      decoding="async"
                      loading={i === 0 ? 'eager' : 'lazy'}
                    />
                  ) : (
                    <span className="loja-store-orderbump-img loja-store-orderbump-img--empty" />
                  )}
                </span>
                <span className="loja-store-orderbump-body">
                  <span className="loja-store-orderbump-name">{oferta.produto.nome}</span>
                  <span className="loja-store-orderbump-price">
                    {oferta.precoOriginal != null && <s>{formatCurrency(oferta.precoOriginal)}</s>}
                    <strong>{formatCurrency(oferta.preco)}</strong>
                  </span>
                  {(oferta.descricao || oferta.titulo) && (
                    <small className="loja-store-orderbump-desc">{oferta.descricao || oferta.titulo}</small>
                  )}
                </span>
              </div>
              <button
                type="button"
                className={`loja-store-orderbump-btn${checked ? ' is-added' : ''}`}
                onClick={() => onToggle(oferta, !checked)}
                aria-pressed={checked}
              >
                {checked ? (
                  <>
                    <Check size={15} strokeWidth={2.5} aria-hidden />
                    Adicionado ao pedido
                  </>
                ) : (
                  <>
                    <Plus size={15} strokeWidth={2.5} aria-hidden />
                    Adicionar ao pedido
                  </>
                )}
              </button>
            </article>
          )
        })}
      </div>

      {carousel && (
        <div className="loja-store-orderbumps-dots" role="tablist" aria-label="Ofertas">
          {ofertas.map((oferta, i) => (
            <button
              key={oferta.bumpId}
              type="button"
              className={i === index ? 'is-active' : ''}
              aria-label={`Oferta ${i + 1}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export function orderBumpProdutoComPreco(oferta: LojaOnlineOrderBumpOferta): LojaOnlineProduto {
  return { ...oferta.produto, preco: oferta.preco }
}
