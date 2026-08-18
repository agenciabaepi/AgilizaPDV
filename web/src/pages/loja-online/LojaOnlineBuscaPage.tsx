import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import {
  fetchLojaOnlineAvaliacoesResumoBatch,
  fetchLojaOnlineCategorias,
  fetchLojaOnlineProdutos,
} from '../../lib/loja-online-api'
import type { LojaOnlineCategoria, LojaOnlineProduto } from '../../lib/loja-online-types'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineSeo } from '../../hooks/useLojaOnlineSeo'
import { getLojaOnlineCanonicalUrl } from '../../lib/loja-online-seo'
import { LojaOnlineProductCard } from '../../components/loja-online/LojaOnlineProductCard'

type SortKey = 'nome' | 'preco-asc' | 'preco-desc' | 'novos'

function sortProdutos(list: LojaOnlineProduto[], sort: SortKey): LojaOnlineProduto[] {
  const copy = [...list]
  switch (sort) {
    case 'preco-asc':
      return copy.sort((a, b) => a.preco - b.preco)
    case 'preco-desc':
      return copy.sort((a, b) => b.preco - a.preco)
    case 'novos':
      return copy.sort((a, b) => (b.codigo ?? 0) - (a.codigo ?? 0))
    default:
      return copy.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }
}

export function LojaOnlineBuscaPage() {
  const { store, titulo, slug, ocultarSemEstoque, link } = useLojaOnlineStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const categoriaId = searchParams.get('categoria') ?? ''
  const sort = (searchParams.get('ordem') as SortKey) || 'nome'
  const precoMin = searchParams.get('preco_min') ?? ''
  const precoMax = searchParams.get('preco_max') ?? ''

  const [produtos, setProdutos] = useState<LojaOnlineProduto[]>([])
  const [categorias, setCategorias] = useState<LojaOnlineCategoria[]>([])
  const [avaliacoes, setAvaliacoes] = useState<Map<string, { media: number; total: number }>>(
    () => new Map()
  )
  const [loading, setLoading] = useState(true)
  const [localQ, setLocalQ] = useState(q)

  useEffect(() => setLocalQ(q), [q])

  useEffect(() => {
    if (!store?.empresa_id) return
    setLoading(true)
    Promise.all([
      fetchLojaOnlineProdutos(store.empresa_id, ocultarSemEstoque),
      fetchLojaOnlineCategorias(store.empresa_id),
    ])
      .then(([p, c]) => {
        setProdutos(p)
        setCategorias(c)
        setLoading(false)
        fetchLojaOnlineAvaliacoesResumoBatch(
          store.empresa_id,
          p.map((prod) => prod.id)
        )
          .then(setAvaliacoes)
          .catch(() => setAvaliacoes(new Map()))
      })
      .catch(() => setLoading(false))
  }, [store?.empresa_id, ocultarSemEstoque])

  const filtered = useMemo(() => {
    let list = produtos
    const query = q.trim().toLowerCase()
    if (query) {
      list = list.filter(
        (p) =>
          p.nome.toLowerCase().includes(query) ||
          (p.descricao?.toLowerCase().includes(query) ?? false)
      )
    }
    if (categoriaId) {
      if (categoriaId === '__sem__') list = list.filter((p) => !p.categoria_id)
      else list = list.filter((p) => p.categoria_id === categoriaId)
    }
    const min = precoMin ? Number(precoMin.replace(',', '.')) : null
    const max = precoMax ? Number(precoMax.replace(',', '.')) : null
    if (min != null && !Number.isNaN(min)) list = list.filter((p) => p.preco >= min)
    if (max != null && !Number.isNaN(max)) list = list.filter((p) => p.preco <= max)
    return sortProdutos(list, sort)
  }, [produtos, q, categoriaId, sort, precoMin, precoMax])

  useLojaOnlineSeo(
    store
      ? {
          title: q.trim() ? `Busca: ${q} | ${titulo}` : `Buscar produtos | ${titulo}`,
          description: store.loja_online_seo_descricao || store.loja_online_descricao || titulo,
          url: getLojaOnlineCanonicalUrl(slug, link(`busca${q ? `?q=${encodeURIComponent(q)}` : ''}`), store.loja_online_dominio_custom),
        }
      : null
  )

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault()
    const next = new URLSearchParams(searchParams)
    if (localQ.trim()) next.set('q', localQ.trim())
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="loja-store-page">
      <div className="loja-store-hero">
        <h1>Buscar produtos</h1>
        <form className="loja-store-busca-form" onSubmit={applySearch}>
          <input
            type="search"
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder="O que você procura?"
            aria-label="Buscar produtos"
          />
          <button type="submit" className="loja-store-btn-primary">Buscar</button>
        </form>
      </div>

      <div className="loja-store-busca-filters">
        <div className="loja-store-busca-filters-title">
          <SlidersHorizontal size={16} /> Filtros
        </div>
        <label>
          <span>Categoria</span>
          <select value={categoriaId} onChange={(e) => updateParam('categoria', e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.path || c.nome}</option>
            ))}
            <option value="__sem__">Sem categoria</option>
          </select>
        </label>
        <label>
          <span>Ordenar</span>
          <select value={sort} onChange={(e) => updateParam('ordem', e.target.value)}>
            <option value="nome">Nome A–Z</option>
            <option value="preco-asc">Menor preço</option>
            <option value="preco-desc">Maior preço</option>
            <option value="novos">Mais recentes</option>
          </select>
        </label>
        <label>
          <span>Preço mín.</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={precoMin}
            onChange={(e) => updateParam('preco_min', e.target.value)}
            placeholder="0"
          />
        </label>
        <label>
          <span>Preço máx.</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={precoMax}
            onChange={(e) => updateParam('preco_max', e.target.value)}
            placeholder="9999"
          />
        </label>
      </div>

      {loading ? (
        <p className="loja-catalogo-empty">Carregando…</p>
      ) : filtered.length === 0 ? (
        <p className="loja-catalogo-empty">Nenhum produto encontrado.</p>
      ) : (
        <>
          <p className="loja-store-busca-count">{filtered.length} produto(s)</p>
          <div className="loja-catalogo-grid">
            {filtered.map((p) => (
              <LojaOnlineProductCard key={p.id} produto={p} avaliacao={avaliacoes.get(p.id)} variant="grid" />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
