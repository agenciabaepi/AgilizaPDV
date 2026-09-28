import { Link } from 'react-router-dom'
import { ArrowRight, Layers } from 'lucide-react'
import type { LojaOnlineColecao } from '../../lib/loja-online-types'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'

export function LojaOnlineColecaoCard({ colecao }: { colecao: LojaOnlineColecao }) {
  const { link } = useLojaOnlineStore()
  const href = link(`/colecao/${encodeURIComponent(colecao.slug || colecao.id)}`)
  const subtitulo = colecao.subtitulo?.trim()

  return (
    <Link to={href} className="loja-colecao-tile loja-card-colecao" aria-label={`Ver coleção ${colecao.nome}`}>
      {colecao.imagem ? (
        <img
          src={colecao.imagem}
          alt=""
          className="loja-colecao-tile-img"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="loja-colecao-tile-placeholder" aria-hidden>
          <Layers size={56} strokeWidth={1.25} />
        </div>
      )}
      <div className="loja-colecao-tile-overlay">
        <span className="loja-colecao-tile-kicker">Coleção</span>
        <h3 className="loja-colecao-tile-title">{colecao.nome}</h3>
        {subtitulo ? <p className="loja-colecao-tile-subtitle">{subtitulo}</p> : null}
        <span className="loja-colecao-tile-cta">
          Ver coleção
          <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
        </span>
      </div>
    </Link>
  )
}
