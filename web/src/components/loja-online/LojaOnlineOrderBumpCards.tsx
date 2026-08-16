import { useEffect, useRef, useState } from 'react'
import { formatCurrency } from '../../lib/loja-online'
import type { LojaOnlineOrderBumpOferta, LojaOnlineProduto } from '../../lib/loja-online-types'

type Props = {
  ofertas: LojaOnlineOrderBumpOferta[]
  selectedIds: Set<string>
  onToggle: (oferta: LojaOnlineOrderBumpOferta, checked: boolean) => void
}

export function LojaOnlineOrderBumpCards({ ofertas, selectedIds, onToggle }: Props) {
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

  if (ofertas.length === 0) return null

  return (
    <section className="loja-store-orderbumps" aria-label="Oferta exclusiva">
      <div className="loja-store-orderbumps-ribbon">Compre junto</div>
      <div className="loja-store-orderbumps-head">
        <h2>Oferta exclusiva</h2>
        <p>Comprando hoje você tem desconto exclusivo no produto abaixo!</p>
      </div>

      <div
        ref={trackRef}
        className={`loja-store-orderbumps-track${carousel ? ' is-carousel' : ''}`}
        onScroll={carousel ? onScroll : undefined}
      >
        {ofertas.map((oferta) => {
          const checked = selectedIds.has(oferta.produto.id)
          return (
            <label
              key={oferta.bumpId}
              className={`loja-store-orderbump-card${checked ? ' is-checked' : ''}`}
            >
              <span className="loja-store-orderbump-add">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onToggle(oferta, e.target.checked)}
                />
                Adicionar ao carrinho
              </span>
              {oferta.produto.imagem ? (
                <img src={oferta.produto.imagem} alt="" className="loja-store-orderbump-img" />
              ) : (
                <span className="loja-store-orderbump-img loja-store-orderbump-img--empty" />
              )}
              <span className="loja-store-orderbump-price">
                {oferta.precoOriginal != null && <s>{formatCurrency(oferta.precoOriginal)}</s>}
                <strong>{formatCurrency(oferta.preco)}</strong>
              </span>
              <span className="loja-store-orderbump-name">{oferta.produto.nome}</span>
              {(oferta.descricao || oferta.titulo) && (
                <small className="loja-store-orderbump-desc">{oferta.descricao || oferta.titulo}</small>
              )}
            </label>
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
