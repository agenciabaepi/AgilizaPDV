import { Link, useSearchParams } from 'react-router-dom'
import {
  LOJA_ONLINE_SEM_CATEGORIA,
  type LojaOnlineMenuCategoria,
} from '../../lib/loja-online-categorias'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'

export function LojaOnlineCategoriasMenu({
  hidden,
  menuCategorias,
  temSemCategoria,
  loading,
}: {
  hidden?: boolean
  menuCategorias: LojaOnlineMenuCategoria[]
  temSemCategoria: boolean
  loading: boolean
}) {
  const { link } = useLojaOnlineStore()
  const [searchParams] = useSearchParams()
  const ativa = searchParams.get('categoria')
  const hasItems = menuCategorias.length > 0 || temSemCategoria

  if (hidden || loading || !hasItems) return null

  const homePath = link()
  const linkTo = (categoria: string | null) =>
    categoria ? `${homePath}?categoria=${encodeURIComponent(categoria)}` : homePath

  return (
    <nav className="loja-store-catbar" aria-label="Categorias">
      <div className="loja-store-catbar-inner">
        <Link
          to={linkTo(null)}
          className={`loja-store-catbar-link${!ativa ? ' is-active' : ''}`}
        >
          Todos
        </Link>
        {menuCategorias.map((cat) => (
          <Link
            key={cat.id}
            to={linkTo(cat.id)}
            className={`loja-store-catbar-link${ativa === cat.id ? ' is-active' : ''}`}
          >
            {cat.nome}
          </Link>
        ))}
        {temSemCategoria && (
          <Link
            to={linkTo(LOJA_ONLINE_SEM_CATEGORIA)}
            className={`loja-store-catbar-link${ativa === LOJA_ONLINE_SEM_CATEGORIA ? ' is-active' : ''}`}
          >
            Outros
          </Link>
        )}
      </div>
    </nav>
  )
}
