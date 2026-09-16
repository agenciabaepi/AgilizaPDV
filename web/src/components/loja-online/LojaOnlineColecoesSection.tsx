import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { fetchLojaOnlineColecoes } from '../../lib/loja-online-api'
import type { LojaOnlineColecao } from '../../lib/loja-online-types'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { LojaOnlineColecaoCard } from './LojaOnlineColecaoCard'

function isStoreHomeVitrine(pathname: string, search: string, categoriaId: string | null): boolean {
  if (search.trim() || categoriaId) return false
  if (pathname === '/') return true
  const segments = pathname.split('/').filter(Boolean)
  return segments.length === 2 && segments[0] === 'loja'
}

export function LojaOnlineColecoesSection({ search }: { search: string }) {
  const { store } = useLojaOnlineStore()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const categoriaId = searchParams.get('categoria')
  const [colecoes, setColecoes] = useState<LojaOnlineColecao[]>([])
  const [loaded, setLoaded] = useState(false)

  const show = isStoreHomeVitrine(pathname, search, categoriaId)

  useEffect(() => {
    if (!show || !store?.empresa_id) {
      setColecoes([])
      setLoaded(false)
      return
    }
    let cancelled = false
    setLoaded(false)
    fetchLojaOnlineColecoes(store.empresa_id, { somenteAtivas: true })
      .then((list) => {
        if (!cancelled) setColecoes(list)
      })
      .catch(() => {
        if (!cancelled) setColecoes([])
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [show, store?.empresa_id])

  if (!show || !loaded || colecoes.length === 0) return null

  return (
    <section className="loja-eco-section loja-eco-section--colecoes" aria-labelledby="loja-colecoes-section-title">
      <div className="loja-eco-section-inner">
        <h2 id="loja-colecoes-section-title" className="loja-eco-section-title">
          Nossas coleções
        </h2>
        <div className="loja-eco-grid">
          {colecoes.map((colecao) => (
            <LojaOnlineColecaoCard key={colecao.id} colecao={colecao} />
          ))}
        </div>
      </div>
    </section>
  )
}
