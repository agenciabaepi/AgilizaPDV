import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone } from 'lucide-react'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import type { LojaOnlineFaixaAviso } from '../../lib/loja-online-types'

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

export function LojaOnlineAnnouncementBar() {
  const { faixaAtiva, faixaAvisos, link } = useLojaOnlineStore()
  const [index, setIndex] = useState(0)
  const [animating, setAnimating] = useState(false)

  const avisos = faixaAvisos
  const count = avisos.length

  useEffect(() => {
    setIndex(0)
  }, [count])

  useEffect(() => {
    if (count <= 1) return
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
  }, [count])

  if (!faixaAtiva || count === 0) return null

  const current = avisos[index]

  return (
    <div className="loja-store-announcement" role="region" aria-label="Avisos da loja">
      <div className={`loja-store-announcement-inner${count > 1 ? ' loja-store-announcement-inner--multi' : ''}`}>
        <div className="loja-store-announcement-message">
          <Megaphone size={14} className="loja-store-announcement-icon" aria-hidden />
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
