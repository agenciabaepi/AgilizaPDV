import { Link } from 'react-router-dom'
import { ArrowUpRight, FolderOpen } from 'lucide-react'
import type { LojaOnlineCategoria } from '../../lib/loja-online-types'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'

export function LojaOnlineCategoriaCard({ categoria }: { categoria: LojaOnlineCategoria }) {
  const { link, cardsConfig } = useLojaOnlineStore()
  const href = `${link()}?categoria=${encodeURIComponent(categoria.id)}`

  return (
    <article
      className={`loja-eco-card loja-card-categoria loja-card-categoria--${cardsConfig.categoria.template}`}
    >
      <Link to={href} className="loja-eco-card-link">
        <div className="loja-eco-card-media">
          {categoria.imagem ? (
            <img src={categoria.imagem} alt={categoria.nome} loading="lazy" decoding="async" />
          ) : (
            <div className="loja-eco-card-placeholder" aria-hidden>
              <FolderOpen size={56} strokeWidth={1.25} />
            </div>
          )}
        </div>
        <h3 className="loja-eco-card-title">{categoria.nome}</h3>
        {categoria.loja_online_subtitulo?.trim() && (
          <p className="loja-eco-card-subtitle">{categoria.loja_online_subtitulo.trim()}</p>
        )}
      </Link>
      <Link to={href} className="loja-eco-card-cta">
        Comprar
        <ArrowUpRight size={16} strokeWidth={2.5} aria-hidden />
      </Link>
    </article>
  )
}
