import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { fetchLojaOnlineAvaliacoesResumoBatch, fetchLojaOnlineProdutosDestaque, fetchLojaOnlineVendidosResumoBatch } from '../../lib/loja-online-api'
import { lojaProdutosCacheKey, peekLojaOnlineProdutosCache } from '../../lib/loja-online-catalog-cache'
import type { LojaOnlineProduto } from '../../lib/loja-online-types'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { LojaOnlineFeaturedCarousel } from './LojaOnlineFeaturedCarousel'
import type { LojaOnlineProdutoAvaliacaoResumo } from './LojaOnlineProductCard'

function isStoreHomeVitrine(pathname: string, search: string, categoriaId: string | null): boolean {
  if (search.trim() || categoriaId) return false
  if (pathname === '/') return true
  const segments = pathname.split('/').filter(Boolean)
  return segments.length === 2 && segments[0] === 'loja'
}

export function LojaOnlineFeaturedSection({ search }: { search: string }) {
  const { store, ocultarSemEstoque } = useLojaOnlineStore()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const categoriaId = searchParams.get('categoria')
  const warmDestaque =
    store?.empresa_id
      ? peekLojaOnlineProdutosCache(lojaProdutosCacheKey(store.empresa_id, ocultarSemEstoque, true))
      : null
  const [produtos, setProdutos] = useState<LojaOnlineProduto[]>(() => warmDestaque ?? [])
  const [avaliacoes, setAvaliacoes] = useState<Map<string, LojaOnlineProdutoAvaliacaoResumo>>(
    () => new Map()
  )
  const [vendidos, setVendidos] = useState<Map<string, number>>(() => new Map())
  const [loaded, setLoaded] = useState(() => !!warmDestaque)

  const show = isStoreHomeVitrine(pathname, search, categoriaId)

  useEffect(() => {
    if (!show || !store?.empresa_id) {
      setProdutos([])
      setLoaded(false)
      return
    }
    let cancelled = false
    const warm = peekLojaOnlineProdutosCache(
      lojaProdutosCacheKey(store.empresa_id, ocultarSemEstoque, true)
    )
    if (warm) {
      setProdutos(warm)
      setLoaded(true)
    } else {
      setLoaded(false)
    }
    fetchLojaOnlineProdutosDestaque(store.empresa_id, ocultarSemEstoque)
      .then((list) => {
        if (cancelled) return
        setProdutos(list)
        setLoaded(true)
        const ids = list.map((p) => p.id)
        Promise.all([
          fetchLojaOnlineAvaliacoesResumoBatch(store.empresa_id, ids),
          fetchLojaOnlineVendidosResumoBatch(store.empresa_id, ids),
        ])
          .then(([resumo, vendidosMap]) => {
            if (cancelled) return
            setAvaliacoes(resumo)
            setVendidos(vendidosMap)
          })
          .catch(() => {
            if (cancelled) return
            setAvaliacoes(new Map())
            setVendidos(new Map())
          })
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [show, store?.empresa_id, ocultarSemEstoque])

  if (!show) return null

  if (!loaded) {
    return (
      <section className="loja-store-featured loja-store-featured--skeleton" aria-busy="true" aria-label="Destaques">
        <div className="loja-store-featured-inner">
          <div className="loja-vitrine-skel loja-vitrine-skel--title" />
          <div className="loja-vitrine-skel-row loja-vitrine-skel-row--products">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="loja-vitrine-skel loja-vitrine-skel--product" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (produtos.length === 0) return null

  return <LojaOnlineFeaturedCarousel produtos={produtos} avaliacoes={avaliacoes} vendidos={vendidos} />
}
