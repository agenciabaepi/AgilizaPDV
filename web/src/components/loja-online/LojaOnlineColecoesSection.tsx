import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { fetchLojaOnlineColecoes } from '../../lib/loja-online-api'
import { lojaColecoesCacheKey, peekLojaOnlineColecoesCache } from '../../lib/loja-online-catalog-cache'
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
  const warmColecoes =
    store?.empresa_id ? peekLojaOnlineColecoesCache(lojaColecoesCacheKey(store.empresa_id, true)) : null
  const [colecoes, setColecoes] = useState<LojaOnlineColecao[]>(() => warmColecoes ?? [])
  const [loaded, setLoaded] = useState(() => !!warmColecoes)

  const show = isStoreHomeVitrine(pathname, search, categoriaId)

  useEffect(() => {
    if (!show || !store?.empresa_id) {
      setColecoes([])
      setLoaded(false)
      return
    }
    let cancelled = false
    const warm = peekLojaOnlineColecoesCache(lojaColecoesCacheKey(store.empresa_id, true))
    if (warm) {
      setColecoes(warm)
      setLoaded(true)
    } else {
      setLoaded(false)
    }
    fetchLojaOnlineColecoes(store.empresa_id, { somenteAtivas: true })
      .then((list) => {
        if (!cancelled) setColecoes(list)
      })
      .catch(() => {
        if (!cancelled && !warm) setColecoes([])
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [show, store?.empresa_id])

  if (!show) return null

  if (!loaded) {
    return (
      <section className="loja-eco-section loja-eco-section--colecoes loja-eco-section--skeleton" aria-busy="true" aria-label="Coleções">
        <div className="loja-eco-section-inner">
          <div className="loja-vitrine-skel loja-vitrine-skel--title" />
          <div className="loja-colecoes-grid">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="loja-vitrine-skel loja-vitrine-skel--colecao" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (colecoes.length === 0) return null

  return (
    <section className="loja-eco-section loja-eco-section--colecoes" aria-labelledby="loja-colecoes-section-title">
      <div className="loja-eco-section-inner">
        <h2 id="loja-colecoes-section-title" className="loja-eco-section-title">
          Nossas coleções
        </h2>
        <div className={`loja-colecoes-grid${colecoes.length === 1 ? ' loja-colecoes-grid--single' : ''}`}>
          {colecoes.map((colecao) => (
            <LojaOnlineColecaoCard key={colecao.id} colecao={colecao} />
          ))}
        </div>
      </div>
    </section>
  )
}
