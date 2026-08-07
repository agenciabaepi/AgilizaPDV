import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { fetchLojaOnlineCategoriasVitrine } from '../../lib/loja-online-api'
import type { LojaOnlineCategoria } from '../../lib/loja-online-types'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { LojaOnlineCategoriaCard } from './LojaOnlineCategoriaCard'

function isStoreHomeVitrine(pathname: string, search: string, categoriaId: string | null): boolean {
  if (search.trim() || categoriaId) return false
  if (pathname === '/') return true
  const segments = pathname.split('/').filter(Boolean)
  return segments.length === 2 && segments[0] === 'loja'
}

export function LojaOnlineCategoriasSection({ search }: { search: string }) {
  const { store } = useLojaOnlineStore()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const categoriaId = searchParams.get('categoria')
  const [categorias, setCategorias] = useState<LojaOnlineCategoria[]>([])
  const [loaded, setLoaded] = useState(false)

  const show = isStoreHomeVitrine(pathname, search, categoriaId)

  useEffect(() => {
    if (!show || !store?.empresa_id) {
      setCategorias([])
      setLoaded(false)
      return
    }
    let cancelled = false
    setLoaded(false)
    fetchLojaOnlineCategoriasVitrine(store.empresa_id)
      .then((list) => {
        if (!cancelled) setCategorias(list)
      })
      .catch(() => {
        if (!cancelled) setCategorias([])
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [show, store?.empresa_id])

  if (!show || !loaded || categorias.length === 0) return null

  const titulo =
    store?.loja_online_categorias_titulo?.trim() || 'Explore nossas categorias'

  return (
    <section className="loja-eco-section" aria-labelledby="loja-eco-section-title">
      <div className="loja-eco-section-inner">
        <h2 id="loja-eco-section-title" className="loja-eco-section-title">
          {titulo}
        </h2>
        <div className="loja-eco-grid">
          {categorias.map((categoria) => (
            <LojaOnlineCategoriaCard key={categoria.id} categoria={categoria} />
          ))}
        </div>
      </div>
    </section>
  )
}
