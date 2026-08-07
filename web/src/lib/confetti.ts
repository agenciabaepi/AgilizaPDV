import confetti from 'canvas-confetti'

/** Efeito de celebração ao confirmar pagamento da assinatura. */
export function firePaymentConfetti(): void {
  const duration = 2800
  const end = Date.now() + duration
  const colors = ['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899']

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
      colors,
      zIndex: 10000,
    })
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
      colors,
      zIndex: 10000,
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  }

  confetti({
    particleCount: 120,
    spread: 72,
    origin: { y: 0.55 },
    colors,
    zIndex: 10000,
  })

  frame()
}
