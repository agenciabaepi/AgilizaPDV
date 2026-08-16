import { useEffect, useMemo, useState } from 'react'
import type { LojaOnlineCheckoutOferta } from '../../lib/loja-online-types'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatRestante(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

function timerStorageKey(empresaId: string, minutos: number) {
  return `agiliza:lojaCheckoutTimer:${empresaId}:${minutos}`
}

function getOrCreateEndsAt(empresaId: string, minutos: number): number {
  if (typeof sessionStorage === 'undefined') return Date.now() + minutos * 60_000
  const key = timerStorageKey(empresaId, minutos)
  try {
    const raw = sessionStorage.getItem(key)
    const parsed = raw ? Number(raw) : NaN
    if (Number.isFinite(parsed) && parsed > Date.now() - 60_000) return parsed
  } catch {
    /* ignore */
  }
  const endsAt = Date.now() + minutos * 60_000
  try {
    sessionStorage.setItem(key, String(endsAt))
  } catch {
    /* ignore */
  }
  return endsAt
}

export function LojaOnlineCheckoutOfertaHero({
  empresaId,
  oferta,
}: {
  empresaId: string
  oferta: LojaOnlineCheckoutOferta
}) {
  const showFaixa = oferta.faixaAtiva && !!oferta.faixaTexto.trim()
  const showTimer = oferta.cronometroAtivo
  const showBanner = !!oferta.banner
  const endsAt = useMemo(
    () => (showTimer ? getOrCreateEndsAt(empresaId, oferta.cronometroMinutos) : 0),
    [empresaId, oferta.cronometroMinutos, showTimer]
  )
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!showTimer) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [showTimer])

  if (!showFaixa && !showTimer && !showBanner) return null

  return (
    <div className="loja-store-checkout-oferta">
      {(showFaixa || showTimer) && (
        <div className="loja-store-checkout-oferta-bar">
          {showFaixa && <p className="loja-store-checkout-oferta-faixa">{oferta.faixaTexto}</p>}
          {showTimer && (
            <span className="loja-store-checkout-oferta-timer">
              {oferta.cronometroTexto}: {formatRestante(endsAt - now)}
            </span>
          )}
        </div>
      )}
      {showBanner && (
        <img src={oferta.banner!} alt="" className="loja-store-checkout-oferta-banner" />
      )}
    </div>
  )
}
