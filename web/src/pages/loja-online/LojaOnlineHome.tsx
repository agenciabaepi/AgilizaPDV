import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { ChevronRight, Home, ArrowUpDown } from 'lucide-react'
import {
  fetchLojaOnlineAvaliacoesResumoBatch,
  fetchLojaOnlineCategorias,
  fetchLojaOnlineProdutos,
  fetchLojaOnlineVendidosResumoBatch,
} from '../../lib/loja-online-api'
import {
  lojaProdutosCacheKey,
  peekLojaOnlineCategoriasCache,
  peekLojaOnlineProdutosCache,
  scheduleLojaOnlineIdle,
} from '../../lib/loja-online-catalog-cache'
import { filterProdutosPorCategoriaMenu, LOJA_ONLINE_SEM_CATEGORIA } from '../../lib/loja-online-categorias'
import {
  applyLojaOnlineFiltros,
  applyLojaOnlineFiltrosPatch,
  buildLojaOnlineFiltrosOpcoes,
  countLojaOnlineFiltrosAtivos,
  LOJA_ONLINE_ORDEM_OPCOES,
  parseLojaOnlineFiltros,
  sortLojaOnlineProdutos,
  type LojaOnlineFiltrosState,
} from '../../lib/loja-online-filtros'
import type { LojaOnlineCategoria, LojaOnlineProduto } from '../../lib/loja-online-types'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineCatalogView } from '../../hooks/useLojaOnlineCatalogView'
import { LojaOnlineProductCard } from '../../components/loja-online/LojaOnlineProductCard'
import { LojaOnlineFeaturedCarousel } from '../../components/loja-online/LojaOnlineFeaturedCarousel'
import { LojaOnlineFiltrosSidebar } from '../../components/loja-online/LojaOnlineFiltrosSidebar'
import { LojaOnlineCategoriaCard } from '../../components/loja-online/LojaOnlineCategoriaCard'
import { LojaOnlineCatalogViewToggle } from '../../components/loja-online/LojaOnlineCatalogViewToggle'
import type { LojaOnlineOutletContext } from '../../components/loja-online/LojaOnlineLayout'

function filterProdutos(produtos: LojaOnlineProduto[], search: string) {
  if (!search.trim()) return produtos
  const q = search.toLowerCase()
  return produtos.filter(
    (p) => p.nome.toLowerCase().includes(q) || (p.descricao?.toLowerCase().includes(q) ?? false)
  )
}

function resolveCategoriaCapa(categoria: LojaOnlineCategoria | null): string | null {
  // Banner wide da página — separado do PNG do carrossel (`imagem`).
  return categoria?.loja_online_capa?.trim() || null
}

export function LojaOnlineHome() {
  const { store, titulo, link, ocultarSemEstoque } = useLojaOnlineStore()
  const { search } = useOutletContext<LojaOnlineOutletContext>()
  const [searchParams, setSearchParams] = useSearchParams()
  const categoriaId = searchParams.get('categoria')
  const filtros = useMemo(() => parseLojaOnlineFiltros(searchParams), [searchParams])
  const [produtos, setProdutos] = useState<LojaOnlineProduto[]>(() => {
    if (!store?.empresa_id) return []
    return peekLojaOnlineProdutosCache(lojaProdutosCacheKey(store.empresa_id, ocultarSemEstoque, false)) ?? []
  })
  const [categorias, setCategorias] = useState<LojaOnlineCategoria[]>(() => {
    if (!store?.empresa_id) return []
    return peekLojaOnlineCategoriasCache(`${store.empresa_id}:c`) ?? []
  })
  const [avaliacoes, setAvaliacoes] = useState<Map<string, { media: number; total: number }>>(
    () => new Map()
  )
  const [vendidos, setVendidos] = useState<Map<string, number>>(() => new Map())
  const [loading, setLoading] = useState(() => {
    if (!store?.empresa_id) return true
    const warm = peekLojaOnlineProdutosCache(lojaProdutosCacheKey(store.empresa_id, ocultarSemEstoque, false))
    return !warm
  })
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const [ordenarOpen, setOrdenarOpen] = useState(false)
  const { vista, setVista, gridClassName, cardVariant } = useLojaOnlineCatalogView()

  useEffect(() => {
    if (!store?.empresa_id) return
    let cancelled = false
    let cancelIdle: (() => void) | undefined
    const warmProds = peekLojaOnlineProdutosCache(
      lojaProdutosCacheKey(store.empresa_id, ocultarSemEstoque, false)
    )
    const warmCats = peekLojaOnlineCategoriasCache(`${store.empresa_id}:c`)
    if (warmProds) setProdutos(warmProds)
    if (warmCats) setCategorias(warmCats)
    if (!warmProds) setLoading(true)

    Promise.all([
      fetchLojaOnlineProdutos(store.empresa_id, ocultarSemEstoque),
      fetchLojaOnlineCategorias(store.empresa_id),
    ])
      .then(([prods, cats]) => {
        if (cancelled) return
        setProdutos(prods)
        setCategorias(cats)
        setLoading(false)

        cancelIdle = scheduleLojaOnlineIdle(() => {
          if (cancelled) return
          const ids = prods.slice(0, 48).map((p) => p.id)
          if (ids.length === 0) return
          void Promise.all([
            fetchLojaOnlineAvaliacoesResumoBatch(store.empresa_id, ids),
            fetchLojaOnlineVendidosResumoBatch(store.empresa_id, ids),
          ])
            .then(([av, vd]) => {
              if (cancelled) return
              setAvaliacoes(av)
              setVendidos(vd)
            })
            .catch(() => {
              if (cancelled) return
              setAvaliacoes(new Map())
              setVendidos(new Map())
            })
        })
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      cancelIdle?.()
    }
  }, [store?.empresa_id, ocultarSemEstoque])

  const filtered = useMemo(() => {
    const bySearch = filterProdutos(produtos, search)
    if (categoriaId) {
      return applyLojaOnlineFiltros(bySearch, filtros, categorias, categoriaId)
    }
    const byCat = filterProdutosPorCategoriaMenu(bySearch, categoriaId, categorias)
    return sortLojaOnlineProdutos(byCat, filtros.ordem)
  }, [produtos, search, categoriaId, categorias, filtros])

  const filtrosOpcoes = useMemo(() => {
    if (!categoriaId) return null
    return buildLojaOnlineFiltrosOpcoes(produtos, categorias, categoriaId)
  }, [produtos, categorias, categoriaId])

  const categoriaAtiva = useMemo(() => {
    if (!categoriaId) return null
    if (categoriaId === LOJA_ONLINE_SEM_CATEGORIA) {
      return {
        id: LOJA_ONLINE_SEM_CATEGORIA,
        nome: 'Outros',
        parent_id: null,
        ordem: 0,
        path: 'Outros',
        imagem: null,
        loja_online_capa: null,
      } satisfies LojaOnlineCategoria
    }
    return categorias.find((c) => c.id === categoriaId) ?? null
  }, [categoriaId, categorias])

  const subcategorias = useMemo(() => {
    if (!categoriaId || categoriaId === LOJA_ONLINE_SEM_CATEGORIA) return []
    return categorias
      .filter((c) => c.parent_id === categoriaId)
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [categorias, categoriaId])

  const capaUrl = useMemo(() => resolveCategoriaCapa(categoriaAtiva), [categoriaAtiva])

  const filtroAtivo = !!categoriaId || !!search.trim()
  const paginaCategoria = !!categoriaId
  const useJoogShelf = !paginaCategoria && !search.trim()
  const filtrosAtivos = countLojaOnlineFiltrosAtivos(filtros)

  const patchFiltros = (partial: Partial<LojaOnlineFiltrosState>) => {
    setSearchParams(applyLojaOnlineFiltrosPatch(searchParams, partial), { replace: true })
  }

  const ordemLabel =
    LOJA_ONLINE_ORDEM_OPCOES.find((o) => o.value === filtros.ordem)?.label ?? 'Ordenar'

  const shelfSkeleton = (
    <section className="loja-joog-home-shelf loja-store-featured--skeleton" aria-busy="true" aria-label="Produtos">
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

  const gridContent = loading ? (
    useJoogShelf || paginaCategoria ? (
      shelfSkeleton
    ) : (
      <p className="loja-catalogo-empty">Carregando produtos…</p>
    )
  ) : filtered.length === 0 ? (
    <p className="loja-catalogo-empty">
      {search.trim()
        ? 'Nenhum produto encontrado para sua busca.'
        : categoriaId
          ? 'Nenhum produto nesta categoria com os filtros selecionados.'
          : 'Nenhum produto disponível no momento.'}
    </p>
  ) : useJoogShelf ? (
    <div className="loja-joog-home-shelf">
      <LojaOnlineFeaturedCarousel
        produtos={filtered}
        avaliacoes={avaliacoes}
        vendidos={vendidos}
        title="Conheça nossos produtos"
      />
    </div>
  ) : (
    <div className={gridClassName}>
      {filtered.map((p) => (
        <LojaOnlineProductCard
          key={p.id}
          produto={p}
          avaliacao={avaliacoes.get(p.id)}
          vendidos={vendidos.get(p.id)}
          variant={cardVariant}
        />
      ))}
    </div>
  )

  if (paginaCategoria && categoriaAtiva) {
    return (
      <div className="loja-store-page loja-joog-cat-page">
        <nav className="loja-joog-cat-breadcrumb" aria-label="Breadcrumb">
          <Link to={link()} className="loja-joog-cat-breadcrumb-home" aria-label="Início">
            <Home size={16} strokeWidth={2} />
          </Link>
          <ChevronRight size={14} strokeWidth={2} aria-hidden />
          <span aria-current="page">{categoriaAtiva.nome}</span>
        </nav>

        {capaUrl ? (
          <div className="loja-joog-cat-capa">
            <img src={capaUrl} alt="" loading="eager" decoding="async" />
          </div>
        ) : (
          <div className="loja-joog-cat-capa loja-joog-cat-capa--empty" aria-hidden />
        )}

        <h1 className="loja-joog-cat-title">{categoriaAtiva.nome}</h1>

        {subcategorias.length > 0 && (
          <div className="loja-joog-cat-subcats" aria-label="Subcategorias">
            <div className="loja-joog-cats-track loja-joog-cat-subcats-track">
              {subcategorias.map((sub) => (
                <LojaOnlineCategoriaCard key={sub.id} categoria={sub} />
              ))}
            </div>
          </div>
        )}

        <div className="loja-joog-cat-toolbar">
          <p className="loja-joog-cat-count">
            {loading ? '…' : `${filtered.length} produto${filtered.length === 1 ? '' : 's'} encontrado${filtered.length === 1 ? '' : 's'}`}
          </p>
          <div className="loja-joog-cat-toolbar-actions">
            <LojaOnlineCatalogViewToggle value={vista} onChange={setVista} />
            <div className="loja-joog-cat-ordenar-wrap">
              <button
                type="button"
                className="loja-joog-cat-btn loja-joog-cat-btn--outline"
                onClick={() => setOrdenarOpen((v) => !v)}
                aria-expanded={ordenarOpen}
              >
                <ArrowUpDown size={16} strokeWidth={2} />
                Ordenar
              </button>
              {ordenarOpen && (
                <div className="loja-joog-cat-ordenar-menu" role="listbox" aria-label="Ordenar por">
                  {LOJA_ONLINE_ORDEM_OPCOES.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={filtros.ordem === opt.value}
                      className={filtros.ordem === opt.value ? 'is-active' : ''}
                      onClick={() => {
                        patchFiltros({ ordem: opt.value })
                        setOrdenarOpen(false)
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="loja-joog-cat-btn loja-joog-cat-btn--solid"
              onClick={() => setFiltrosOpen(true)}
            >
              Filtrar
              {filtrosAtivos > 0 ? ` (${filtrosAtivos})` : ''}
            </button>
          </div>
        </div>

        {filtrosOpcoes && (
          <LojaOnlineFiltrosSidebar
            opcoes={filtrosOpcoes}
            hideMobileToggle
            mobileOpen={filtrosOpen}
            onMobileOpenChange={setFiltrosOpen}
            className="loja-joog-cat-filtros-aside"
          />
        )}

        <div className="loja-joog-cat-grid-wrap">{gridContent}</div>
      </div>
    )
  }

  return (
    <div className="loja-store-page">
      {filtroAtivo && (
        <div className="loja-store-hero">
          <h1>{search.trim() ? 'Resultados' : titulo}</h1>
          {!search.trim() && store?.loja_online_descricao && <p>{store.loja_online_descricao}</p>}
        </div>
      )}

      {search.trim() && (
        <div className="loja-store-categoria-section loja-joog-cat-page loja-joog-cat-page--busca">
          <div className="loja-joog-cat-toolbar">
            <p className="loja-joog-cat-count">
              {ordemLabel} · {filtered.length} produto{filtered.length === 1 ? '' : 's'}
            </p>
            <div className="loja-joog-cat-toolbar-actions">
              <LojaOnlineCatalogViewToggle value={vista} onChange={setVista} />
            </div>
          </div>
          {gridContent}
        </div>
      )}

      {!search.trim() && gridContent}
    </div>
  )
}
