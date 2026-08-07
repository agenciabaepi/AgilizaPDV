import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { Package } from 'lucide-react'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'

export function LojaOnlineAddToCartFly() {
  const { flyItems, dismissFly } = useLojaOnlineCart()

  if (flyItems.length === 0) return null

  return createPortal(
    <div className="loja-store-fly-layer" aria-hidden>
      {flyItems.map((item) => (
        <div
          key={item.id}
          className="loja-store-fly-item"
          style={
            {
              '--fly-dx': `${item.toX - item.fromX}px`,
              '--fly-dy': `${item.toY - item.fromY}px`,
              left: item.fromX,
              top: item.fromY,
            } as CSSProperties
          }
          onAnimationEnd={() => dismissFly(item.id)}
        >
          {item.imagem ? (
            <img src={item.imagem} alt="" draggable={false} />
          ) : (
            <span className="loja-store-fly-placeholder">
              <Package size={18} strokeWidth={1.5} />
            </span>
          )}
        </div>
      ))}
    </div>,
    document.body
  )
}
