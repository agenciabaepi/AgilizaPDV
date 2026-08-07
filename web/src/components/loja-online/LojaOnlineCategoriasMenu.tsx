import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchLojaOnlineCategorias, fetchLojaOnlineProdutos } from '../../lib/loja-online-api'
import {
  LOJA_ONLINE_SEM_CATEGORIA,
  buildLojaOnlineMenuCategorias,
  type LojaOnlineMenuCategoria,
} from '../../lib/loja-online-categorias'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'

export function LojaOnlineCategoriasMenu({ hidden }: { hidden?: boolean }) {
  const { store, link, ocultarSemEstoque } = useLojaOnlineStore()
  const [searchParams] = useSearchParams()
  const ativa = searchParams.get('categoria')
  const [menuCategorias, setMenuCategorias] = useState<LojaOnlineMenuCategoria[]>([])
  const [temSemCategoria, setTemSemCategoria] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!store?.empresa_id) return
    setLoading(true)
    Promise.all([
      fetchLojaOnlineCategorias(store.empresa_id),
      fetchLojaOnlineProdutos(store.empresa_id, ocultarSemEstoque),
    ])
      .then(([categorias, produtos]) => {
        const ids = produtos.map((p) => p.categoria_id)
        setMenuCategorias(buildLojaOnlineMenuCategorias(categorias, ids))
        setTemSemCategoria(produtos.some((p) => !p.categoria_id))
      })
      .finally(() => setLoading(false))
  }, [store?.empresa_id, ocultarSemEstoque])

  const visible = useMemo(
    () => !hidden && !loading && (menuCategorias.length > 0 || temSemCategoria),
    [hidden, loading, menuCategorias.length, temSemCategoria]
  )

  if (!visible) return null

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
