import { Link } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import type { LojaOnlineCategoria } from '../../lib/loja-online-types'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'

/** Categoria estilo Joog: PNG transparente sobre círculo cinza. */
export function LojaOnlineCategoriaCard({ categoria }: { categoria: LojaOnlineCategoria }) {
  const { link } = useLojaOnlineStore()
  const href = `${link()}?categoria=${encodeURIComponent(categoria.id)}`

  return (
    <Link to={href} className="loja-joog-cat-card" aria-label={categoria.nome}>
      <span className="loja-joog-cat-circle" aria-hidden={!categoria.imagem}>
        {categoria.imagem ? (
          <img
            src={categoria.imagem}
            alt=""
            loading="lazy"
            decoding="async"
            className="loja-joog-cat-img"
          />
        ) : (
          <FolderOpen size={36} strokeWidth={1.25} className="loja-joog-cat-placeholder" />
        )}
      </span>
      <span className="loja-joog-cat-label">{categoria.nome}</span>
    </Link>
  )
}
