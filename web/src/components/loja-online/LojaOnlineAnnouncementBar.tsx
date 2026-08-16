import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type Ref } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone } from 'lucide-react'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { lojaOnlineForegroundOn } from '../../lib/loja-online'
import {
  LOJA_ONLINE_FAIXA_VELOCIDADE_PX_S,
  type LojaOnlineFaixaAviso,
} from '../../lib/loja-online-types'

const ROTATE_MS = 5000

function AvisoContent({ aviso, link }: { aviso: LojaOnlineFaixaAviso; link: (path?: string) => string }) {
  const href = aviso.link?.trim()
  const isExternal = href?.startsWith('http://') || href?.startsWith('https://')

  if (!href) {
    return <span>{aviso.texto}</span>
  }

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="loja-store-announcement-link">
        {aviso.texto}
      </a>
    )
  }

  const path = href.startsWith('/') ? href : `/${href}`
  return (
    <Link to={link(path.replace(/^\//, ''))} className="loja-store-announcement-link">
      {aviso.texto}
    </Link>
  )
}

function MarqueeSet({
  avisos,
  link,
  setRef,
}: {
  avisos: LojaOnlineFaixaAviso[]
  link: (path?: string) => string
  setRef?: Ref<HTMLDivElement>
}) {
  return (
    <div ref={setRef} className="loja-store-announcement-marquee-set" aria-hidden={setRef ? undefined : true}>
      {avisos.map((aviso) => (
        <p key={aviso.id} className="loja-store-announcement-text loja-store-announcement-text--marquee">
          <AvisoContent aviso={aviso} link={link} />
        </p>
      ))}
    </div>
  )
}

export function LojaOnlineAnnouncementBar() {
  const { faixaAtiva, faixaAvisos, faixaEfeito, faixaSentido, faixaVelocidade, faixaCor, corPrimaria, link } =
    useLojaOnlineStore()
  const [index, setIndex] = useState(0)
  const [animating, setAnimating] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const setRef = useRef<HTMLDivElement>(null)
  const [shiftPx, setShiftPx] = useState(0)
  const [copies, setCopies] = useState(2)
  const [durationSec, setDurationSec] = useState(12)

  const avisos = faixaAvisos
  const count = avisos.length
  const isMarquee = faixaEfeito === 'correr'

  useEffect(() => {
    setIndex(0)
  }, [count])

  useEffect(() => {
    if (isMarquee || count <= 1) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const id = window.setInterval(() => {
      setAnimating(true)
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % count)
        setAnimating(false)
      }, 280)
    }, ROTATE_MS)

    return () => window.clearInterval(id)
  }, [count, isMarquee])

  useLayoutEffect(() => {
    if (!isMarquee) return
    const viewport = viewportRef.current
    const setEl = setRef.current
    if (!viewport || !setEl) return

    const measure = () => {
      const setWidth = setEl.getBoundingClientRect().width
      const viewWidth = viewport.getBoundingClientRect().width
      if (setWidth <= 0) return
      const needed = Math.max(2, Math.ceil((viewWidth * 2) / setWidth) + 1)
      setCopies(needed)
      setShiftPx(setWidth)
      const pxPerSec = LOJA_ONLINE_FAIXA_VELOCIDADE_PX_S[faixaVelocidade]
      setDurationSec(Math.max(4, setWidth / pxPerSec))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(viewport)
    ro.observe(setEl)
    return () => ro.disconnect()
  }, [isMarquee, avisos, faixaVelocidade])

  if (!faixaAtiva || count === 0) return null

  const current = avisos[index]
  const bg = faixaCor || corPrimaria
  const fg = lojaOnlineForegroundOn(bg)
  const colorStyle = { '--loja-faixa-bg': bg, '--loja-faixa-fg': fg } as CSSProperties

  if (isMarquee) {
    const extra = Math.max(0, copies - 1)
    return (
      <div className="loja-store-announcement" role="region" aria-label="Avisos da loja" style={colorStyle}>
        <div
          className={`loja-store-announcement-inner loja-store-announcement-inner--marquee loja-store-announcement-inner--marquee-${faixaSentido}`}
          style={
            {
              '--loja-marquee-shift': `${shiftPx}px`,
              '--loja-marquee-duration': `${durationSec}s`,
            } as CSSProperties
          }
        >
          <Megaphone size={16} className="loja-store-announcement-icon" aria-hidden />
          <div ref={viewportRef} className="loja-store-announcement-marquee">
            <div className={`loja-store-announcement-marquee-track${shiftPx > 0 ? ' is-ready' : ''}`}>
              <MarqueeSet avisos={avisos} link={link} setRef={setRef} />
              {Array.from({ length: extra }, (_, i) => (
                <MarqueeSet key={`copy-${i}`} avisos={avisos} link={link} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="loja-store-announcement" role="region" aria-label="Avisos da loja" style={colorStyle}>
      <div className={`loja-store-announcement-inner${count > 1 ? ' loja-store-announcement-inner--multi' : ''}`}>
        <div className="loja-store-announcement-message">
          <Megaphone size={16} className="loja-store-announcement-icon" aria-hidden />
          <div className="loja-store-announcement-viewport">
            <p
              key={current.id}
              className={`loja-store-announcement-text${animating ? ' loja-store-announcement-text--out' : ' loja-store-announcement-text--in'}`}
            >
              <AvisoContent aviso={current} link={link} />
            </p>
          </div>
        </div>
        {count > 1 && (
          <div className="loja-store-announcement-dots" aria-hidden>
            {avisos.map((a, i) => (
              <span key={a.id} className={i === index ? 'is-active' : ''} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
