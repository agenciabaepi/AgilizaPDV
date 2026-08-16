import { useEffect, useMemo, useRef } from 'react'
import Lottie, { type LottieRefCurrentProps } from 'lottie-react'
import rawCart from '../../animation/Cart.json'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'

type LottieLayer = { nm?: string }

const cartAnimation = {
  ...(rawCart as Record<string, unknown>),
  layers: ((rawCart as { layers: LottieLayer[] }).layers ?? []).filter(
    (layer) => layer.nm !== 'White Solid 1'
  ),
}

export function LojaOnlineCartHeaderIcon({ size = 28 }: { size?: number }) {
  const { cartBurst, dismissCartBurst } = useLojaOnlineCart()
  const lottieRef = useRef<LottieRefCurrentProps>(null)
  const burstId = cartBurst?.id ?? null

  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  useEffect(() => {
    const api = lottieRef.current
    if (!api) return
    api.goToAndStop(0, true)
  }, [])

  useEffect(() => {
    if (!burstId || reducedMotion) return
    const api = lottieRef.current
    if (!api) return
    api.goToAndPlay(0, true)
    api.playSegments([0, 130], true)
  }, [burstId, reducedMotion])

  return (
    <span className="loja-store-cart-lottie-icon" style={{ width: size, height: size }} aria-hidden>
      <Lottie
        lottieRef={lottieRef}
        animationData={cartAnimation}
        loop={false}
        autoplay={false}
        onComplete={() => {
          lottieRef.current?.goToAndStop(0, true)
          dismissCartBurst()
        }}
      />
    </span>
  )
}
