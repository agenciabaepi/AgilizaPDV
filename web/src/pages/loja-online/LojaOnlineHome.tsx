import { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import {
  fetchLojaOnlineAvaliacoesResumoBatch,
  fetchLojaOnlineCategorias,
  fetchLojaOnlineProdutos,
} from '../../lib/loja-online-api'
import { filterProdutosPorCategoriaMenu } from '../../lib/loja-online-categorias'
import {
  applyLojaOnlineFiltros,
  buildLojaOnlineFiltrosOpcoes,
  parseLojaOnlineFiltros,
  sortLojaOnlineProdutos,
} from '../../lib/loja-online-filtros'
import type { LojaOnlineCategoria, LojaOnlineProduto } from '../../lib/loja-online-types'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { LojaOnlineProductCard } from '../../components/loja-online/LojaOnlineProductCard'
import { LojaOnlineFiltrosSidebar } from '../../components/loja-online/LojaOnlineFiltrosSidebar'
import type { LojaOnlineOutletContext } from '../../components/loja-online/LojaOnlineLayout'

function filterProdutos(produtos: LojaOnlineProduto[], search: string) {
  if (!search.trim()) return produtos
  const q = search.toLowerCase()
  return produtos.filter(
    (p) => p.nome.toLowerCase().includes(q) || (p.descricao?.toLowerCase().includes(q) ?? false)
  )
}

export function LojaOnlineHome() {
  const { store, titulo, ocultarSemEstoque } = useLojaOnlineStore()
  const { search } = useOutletContext<LojaOnlineOutletContext>()
  const [searchParams] = useSearchParams()
  const categoriaId = searchParams.get('categoria')
  const filtros = useMemo(() => parseLojaOnlineFiltros(searchParams), [searchParams])
  const [produtos, setProdutos] = useState<LojaOnlineProduto[]>([])
  const [categorias, setCategorias] = useState<LojaOnlineCategoria[]>([])
  const [avaliacoes, setAvaliacoes] = useState<Map<string, { media: number; total: number }>>(
    () => new Map()
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!store?.empresa_id) return
    setLoading(true)
    Promise.all([
      fetchLojaOnlineProdutos(store.empresa_id, ocultarSemEstoque),
      fetchLojaOnlineCategorias(store.empresa_id),
    ])
      .then(async ([prods, cats]) => {
        setProdutos(prods)
        setCategorias(cats)
        try {
          const resumo = await fetchLojaOnlineAvaliacoesResumoBatch(
            store.empresa_id,
            prods.map((p) => p.id)
          )
          setAvaliacoes(resumo)
        } catch {
          setAvaliacoes(new Map())
        }
      })
      .finally(() => setLoading(false))
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

  const categoriaAtiva = categoriaId
    ? categorias.find((c) => c.id === categoriaId)?.nome ?? (categoriaId === '__sem__' ? 'Outros' : null)
    : null

  const filtroAtivo = !!categoriaId || !!search.trim()
  const paginaCategoria = !!categoriaId

  const gridContent = loading ? (
    <p className="loja-catalogo-empty">Carregando produtos…</p>
  ) : filtered.length === 0 ? (
    <p className="loja-catalogo-empty">
      {search.trim()
        ? 'Nenhum produto encontrado para sua busca.'
        : categoriaId
          ? 'Nenhum produto nesta categoria com os filtros selecionados.'
          : 'Nenhum produto disponível no momento.'}
    </p>
  ) : (
    <div className="loja-store-categoria-section">
      {search.trim() && <h2 className="loja-catalogo-section-title">Resultados</h2>}
      {paginaCategoria && (
        <p className="loja-store-busca-count">{filtered.length} produto(s)</p>
      )}
      <div className="loja-catalogo-grid">
        {filtered.map((p) => (
          <LojaOnlineProductCard key={p.id} produto={p} avaliacao={avaliacoes.get(p.id)} variant="grid" />
        ))}
      </div>
    </div>
  )

  return (
    <div className="loja-store-page">
      {filtroAtivo && (
        <div className="loja-store-hero">
          <h1>{categoriaAtiva ?? titulo}</h1>
          {!categoriaAtiva && store?.loja_online_descricao && <p>{store.loja_online_descricao}</p>}
        </div>
      )}

      {paginaCategoria && filtrosOpcoes ? (
        <div className="loja-store-catalog-layout">
          <LojaOnlineFiltrosSidebar opcoes={filtrosOpcoes} />
          <div className="loja-store-catalog-main">{gridContent}</div>
        </div>
      ) : (
        gridContent
      )}
    </div>
  )
}
