import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PackagePlus } from 'lucide-react'
import {
  fetchLojaOnlineAvaliacoesResumoBatch,
  fetchLojaOnlineColecao,
  fetchLojaOnlineColecaoProdutos,
  fetchLojaOnlineVendidosResumoBatch,
} from '../../lib/loja-online-api'
import {
  isLojaOnlineColecaoCombo,
  type LojaOnlineColecao,
  type LojaOnlineProduto,
} from '../../lib/loja-online-types'
import { formatCurrency } from '../../lib/loja-online'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineCatalogView } from '../../hooks/useLojaOnlineCatalogView'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'
import { LojaOnlineProductCard } from '../../components/loja-online/LojaOnlineProductCard'
import { LojaOnlineCatalogViewToggle } from '../../components/loja-online/LojaOnlineCatalogViewToggle'

export function LojaOnlineColecaoPage() {
  const { colecaoSlug } = useParams<{ colecaoSlug: string }>()
  const { store, link, ocultarSemEstoque } = useLojaOnlineStore()
  const { addCombo } = useLojaOnlineCart()
  const [colecao, setColecao] = useState<LojaOnlineColecao | null>(null)
  const [produtos, setProdutos] = useState<LojaOnlineProduto[]>([])
  const [avaliacoes, setAvaliacoes] = useState<Map<string, { media: number; total: number }>>(
    () => new Map()
  )
  const [vendidos, setVendidos] = useState<Map<string, number>>(() => new Map())
  const [loading, setLoading] = useState(true)
  const [addingCombo, setAddingCombo] = useState(false)
  const [comboErro, setComboErro] = useState<string | null>(null)
  const { vista, setVista, gridClassName, cardVariant } = useLojaOnlineCatalogView()

  useEffect(() => {
    if (!store?.empresa_id || !colecaoSlug) return
    let cancelled = false
    setLoading(true)
    fetchLojaOnlineColecao(store.empresa_id, decodeURIComponent(colecaoSlug))
      .then(async (found) => {
        if (cancelled) return
        setColecao(found)
        if (!found) {
          setProdutos([])
          setLoading(false)
          return
        }
        const prods = await fetchLojaOnlineColecaoProdutos(
          store.empresa_id,
          found,
          ocultarSemEstoque
        )
        if (cancelled) return
        setProdutos(prods)
        setLoading(false)
        const ids = prods.map((p) => p.id)
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
        if (!cancelled) {
          setColecao(null)
          setProdutos([])
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [store?.empresa_id, colecaoSlug, ocultarSemEstoque])

  const ehCombo = isLojaOnlineColecaoCombo(colecao)
  const somaIndividual = useMemo(
    () => produtos.reduce((s, p) => s + (Number(p.preco) || 0), 0),
    [produtos]
  )
  const precoCombo = colecao?.preco_combo != null ? Number(colecao.preco_combo) : null
  const economia =
    ehCombo && precoCombo != null ? Math.max(0, somaIndividual - precoCombo) : 0
  const comboDisponivel =
    ehCombo &&
    produtos.length >= 2 &&
    produtos.every((p) => !p.controla_estoque || (p.estoque_atual ?? 0) > 0)

  const handleComprarCombo = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!colecao || !comboDisponivel || addingCombo) return
    setComboErro(null)
    setAddingCombo(true)
    const ok = addCombo(colecao, produtos, e.currentTarget)
    setAddingCombo(false)
    if (!ok) {
      setComboErro('Não foi possível adicionar o combo. Verifique o estoque dos produtos.')
    }
  }

  if (loading) {
    return <p className="loja-catalogo-empty">Carregando coleção…</p>
  }

  if (!colecao) {
    return (
      <div className="loja-store-page">
        <p className="loja-catalogo-empty">Coleção não encontrada.</p>
        <p>
          <Link to={link()} className="loja-store-link-btn">
            Voltar à loja
          </Link>
        </p>
      </div>
    )
  }

  const capa = colecao.imagem_capa || colecao.imagem
  const kicker = ehCombo ? 'Combo' : 'Coleção'

  return (
    <div className="loja-store-page loja-colecao-page">
      {capa ? (
        <>
          <div className="loja-colecao-hero loja-colecao-hero--imagem">
            <img src={capa} alt={colecao.nome} />
          </div>
          <div className="loja-colecao-titulo">
            <p className="loja-colecao-kicker">{kicker}</p>
            <h1>{colecao.nome}</h1>
            {colecao.descricao?.trim() ? <p>{colecao.descricao.trim()}</p> : null}
          </div>
        </>
      ) : (
        <div className="loja-colecao-hero is-empty">
          <div className="loja-colecao-hero-overlay">
            <p className="loja-colecao-kicker">{kicker}</p>
            <h1>{colecao.nome}</h1>
            {colecao.descricao?.trim() ? <p>{colecao.descricao.trim()}</p> : null}
          </div>
        </div>
      )}

      {ehCombo && precoCombo != null && produtos.length > 0 ? (
        <div className="loja-colecao-combo-cta">
          <div className="loja-colecao-combo-cta-info">
            <p className="loja-colecao-combo-cta-label">Leve o combo completo</p>
            <p className="loja-colecao-combo-cta-precos">
              {economia > 0 ? (
                <span className="loja-colecao-combo-de">{formatCurrency(somaIndividual)}</span>
              ) : null}
              <strong>{formatCurrency(precoCombo)}</strong>
              {economia > 0 ? (
                <span className="loja-colecao-combo-economia">
                  Economize {formatCurrency(economia)}
                </span>
              ) : null}
            </p>
            <p className="loja-colecao-combo-cta-hint">
              {produtos.map((p) => p.nome).join(' + ')}
            </p>
          </div>
          <button
            type="button"
            className="loja-store-btn-primary loja-colecao-combo-btn"
            onClick={handleComprarCombo}
            disabled={!comboDisponivel || addingCombo}
          >
            <PackagePlus size={18} />
            {comboDisponivel ? 'Comprar combo' : 'Indisponível'}
          </button>
          {comboErro ? <p className="loja-colecao-combo-erro">{comboErro}</p> : null}
        </div>
      ) : null}

      {produtos.length === 0 ? (
        <p className="loja-catalogo-empty">Nenhum produto nesta coleção no momento.</p>
      ) : (
        <div className="loja-store-categoria-section loja-joog-cat-page loja-joog-cat-page--colecao">
          <div className="loja-joog-cat-toolbar">
            <p className="loja-joog-cat-count">
              {ehCombo ? 'Também à parte · ' : ''}
              {produtos.length} produto{produtos.length === 1 ? '' : 's'}
            </p>
            <div className="loja-joog-cat-toolbar-actions">
              <LojaOnlineCatalogViewToggle value={vista} onChange={setVista} />
            </div>
          </div>
          <div className={gridClassName}>
            {produtos.map((p) => (
              <LojaOnlineProductCard
                key={p.id}
                produto={p}
                avaliacao={avaliacoes.get(p.id)}
                vendidos={vendidos.get(p.id)}
                variant={cardVariant}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
