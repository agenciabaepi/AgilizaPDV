import { Link } from 'react-router-dom'
import { ArrowUpRight, Layers } from 'lucide-react'
import type { LojaOnlineColecao } from '../../lib/loja-online-types'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'

export function LojaOnlineColecaoCard({ colecao }: { colecao: LojaOnlineColecao }) {
  const { link } = useLojaOnlineStore()
  const href = link(`/colecao/${encodeURIComponent(colecao.slug || colecao.id)}`)

  return (
    <article className="loja-eco-card loja-card-colecao">
      <Link to={href} className="loja-eco-card-link">
        <div className="loja-eco-card-media">
          {colecao.imagem ? (
            <img src={colecao.imagem} alt={colecao.nome} loading="lazy" decoding="async" />
          ) : (
            <div className="loja-eco-card-placeholder" aria-hidden>
              <Layers size={56} strokeWidth={1.25} />
            </div>
          )}
        </div>
        <h3 className="loja-eco-card-title">{colecao.nome}</h3>
        {colecao.subtitulo?.trim() && (
          <p className="loja-eco-card-subtitle">{colecao.subtitulo.trim()}</p>
        )}
      </Link>
      <Link to={href} className="loja-eco-card-cta">
        Ver coleção
        <ArrowUpRight size={16} strokeWidth={2.5} aria-hidden />
      </Link>
    </article>
  )
}
