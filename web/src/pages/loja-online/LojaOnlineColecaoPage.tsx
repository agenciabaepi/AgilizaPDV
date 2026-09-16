import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchLojaOnlineAvaliacoesResumoBatch,
  fetchLojaOnlineColecao,
  fetchLojaOnlineColecaoProdutos,
} from '../../lib/loja-online-api'
import type { LojaOnlineColecao, LojaOnlineProduto } from '../../lib/loja-online-types'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { LojaOnlineProductCard } from '../../components/loja-online/LojaOnlineProductCard'

export function LojaOnlineColecaoPage() {
  const { colecaoSlug } = useParams<{ colecaoSlug: string }>()
  const { store, link, ocultarSemEstoque } = useLojaOnlineStore()
  const [colecao, setColecao] = useState<LojaOnlineColecao | null>(null)
  const [produtos, setProdutos] = useState<LojaOnlineProduto[]>([])
  const [avaliacoes, setAvaliacoes] = useState<Map<string, { media: number; total: number }>>(
    () => new Map()
  )
  const [loading, setLoading] = useState(true)

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
        fetchLojaOnlineAvaliacoesResumoBatch(
          store.empresa_id,
          prods.map((p) => p.id)
        )
          .then((resumo) => {
            if (!cancelled) setAvaliacoes(resumo)
          })
          .catch(() => {
            if (!cancelled) setAvaliacoes(new Map())
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

  return (
    <div className="loja-store-page loja-colecao-page">
      <div className={`loja-colecao-hero${capa ? '' : ' is-empty'}`}>
        {capa ? <img src={capa} alt="" /> : null}
        <div className="loja-colecao-hero-overlay">
          <p className="loja-colecao-kicker">Coleção</p>
          <h1>{colecao.nome}</h1>
          {colecao.descricao?.trim() ? <p>{colecao.descricao.trim()}</p> : null}
        </div>
      </div>

      {produtos.length === 0 ? (
        <p className="loja-catalogo-empty">Nenhum produto nesta coleção no momento.</p>
      ) : (
        <div className="loja-store-categoria-section">
          <p className="loja-store-busca-count">{produtos.length} produto(s)</p>
          <div className="loja-catalogo-grid">
            {produtos.map((p) => (
              <LojaOnlineProductCard key={p.id} produto={p} avaliacao={avaliacoes.get(p.id)} variant="grid" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
