import { useMemo } from 'react'
import Lottie from 'lottie-react'
import { Bike } from 'lucide-react'
import {
  formatCurrency,
  tintLottieWithHex,
  type LojaOnlineFreteGratisProgress,
} from '../../lib/loja-online'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import freeDeliveryAnimation from '../../animation/Free Delivery.json'

export function LojaOnlineFreteGratisBar({ progress }: { progress: LojaOnlineFreteGratisProgress }) {
  const { corPrimaria } = useLojaOnlineStore()
  const pct = Math.round(progress.progress * 100)
  const unlocked = progress.unlocked
  const tintedDelivery = useMemo(
    () => tintLottieWithHex(freeDeliveryAnimation, corPrimaria),
    [corPrimaria]
  )

  return (
    <div
      className={`loja-store-frete-bar${unlocked ? ' loja-store-frete-bar--ok' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="loja-store-frete-bar-inner">
        <span className="loja-store-frete-bar-icon" aria-hidden>
          {unlocked ? (
            <Lottie
              className="loja-store-frete-bar-lottie"
              animationData={tintedDelivery}
              loop
              autoplay
            />
          ) : (
            <Bike size={18} strokeWidth={2.25} />
          )}
        </span>
        <div className="loja-store-frete-bar-copy">
          <p>
            {unlocked ? (
              <>Você ganhou <strong>frete grátis</strong>!</>
            ) : (
              <>
                Faltam <strong>{formatCurrency(progress.remaining)}</strong> para <strong>frete grátis</strong>
              </>
            )}
          </p>
          <div
            className="loja-store-frete-bar-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={
              unlocked
                ? 'Frete grátis desbloqueado'
                : `Progresso para frete grátis: ${pct}%`
            }
          >
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
