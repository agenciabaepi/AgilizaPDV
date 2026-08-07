import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { fetchLojaOnlineAvaliacoesResumoBatch, fetchLojaOnlineProdutosDestaque } from '../../lib/loja-online-api'
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
  const [produtos, setProdutos] = useState<LojaOnlineProduto[]>([])
  const [avaliacoes, setAvaliacoes] = useState<Map<string, LojaOnlineProdutoAvaliacaoResumo>>(
    () => new Map()
  )
  const [loaded, setLoaded] = useState(false)

  const show = isStoreHomeVitrine(pathname, search, categoriaId)

  useEffect(() => {
    if (!show || !store?.empresa_id) {
      setProdutos([])
      setLoaded(false)
      return
    }
    let cancelled = false
    setLoaded(false)
    fetchLojaOnlineProdutosDestaque(store.empresa_id, ocultarSemEstoque)
      .then(async (list) => {
        if (cancelled) return
        setProdutos(list)
        try {
          const resumo = await fetchLojaOnlineAvaliacoesResumoBatch(
            store.empresa_id,
            list.map((p) => p.id)
          )
          if (!cancelled) setAvaliacoes(resumo)
        } catch {
          if (!cancelled) setAvaliacoes(new Map())
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [show, store?.empresa_id, ocultarSemEstoque])

  if (!show || !loaded || produtos.length === 0) return null

  return <LojaOnlineFeaturedCarousel produtos={produtos} avaliacoes={avaliacoes} />
}
