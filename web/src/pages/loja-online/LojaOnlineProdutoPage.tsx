import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Heart, Minus, Package, Plus } from 'lucide-react'
import {
  fetchLojaOnlineAvaliacoes,
  fetchLojaOnlineFavoritoIds,
  fetchLojaOnlineProduto,
  toggleLojaOnlineFavorito,
} from '../../lib/loja-online-api'
import { parseLojaOnlineCardMeta, parseLojaOnlineImagens, type LojaOnlineAvaliacao, type LojaOnlineProduto } from '../../lib/loja-online-types'
import { formatCurrency } from '../../lib/loja-online'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { useLojaOnlineSeo } from '../../hooks/useLojaOnlineSeo'
import { getLojaOnlineCanonicalUrl } from '../../lib/loja-online-seo'
import { LojaOnlineProductGallery } from '../../components/loja-online/LojaOnlineProductGallery'
import { LojaOnlineProductReviews } from '../../components/loja-online/LojaOnlineProductReviews'
import { LOJA_GALAXY_PARCELAS, LojaOnlineGalaxyStars } from '../../components/loja-online/LojaOnlineProductCard'

export function LojaOnlineProdutoPage() {
  const { produtoId } = useParams<{ produtoId: string }>()
  const { store, link, mostrarPreco, titulo, slug } = useLojaOnlineStore()
  const { addItem } = useLojaOnlineCart()
  const { cliente } = useLojaOnlineClienteAuth()
  const navigate = useNavigate()
  const [produto, setProduto] = useState<LojaOnlineProduto | null>(null)
  const [avaliacoes, setAvaliacoes] = useState<LojaOnlineAvaliacao[]>([])
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)
  const [favorito, setFavorito] = useState(false)
  const [justAdded, setJustAdded] = useState(false)
  const [corSelecionada, setCorSelecionada] = useState(0)
  const [armazenamentoSelecionado, setArmazenamentoSelecionado] = useState(0)

  const imagens = useMemo(
    () => (produto ? parseLojaOnlineImagens(produto.loja_online_imagens_json, produto.imagem) : []),
    [produto]
  )

  const meta = useMemo(
    () => (produto ? parseLojaOnlineCardMeta(produto.loja_online_card_json) : null),
    [produto]
  )

  const avaliacaoMedia = useMemo(() => {
    if (avaliacoes.length === 0) return 0
    return avaliacoes.reduce((sum, item) => sum + item.nota, 0) / avaliacoes.length
  }, [avaliacoes])

  useLojaOnlineSeo(
    produto
      ? {
          title: `${produto.nome} | ${titulo}`,
          description: produto.descricao?.slice(0, 160) || produto.nome,
          image: imagens[0] ?? produto.imagem,
          url: getLojaOnlineCanonicalUrl(slug, link(`produto/${produto.id}`), store?.loja_online_dominio_custom),
          type: 'product',
          price: produto.preco,
          availability:
            produto.controla_estoque && (produto.estoque_atual ?? 0) <= 0 ? 'OutOfStock' : 'InStock',
        }
      : null
  )

  useEffect(() => {
    if (!store?.empresa_id || !produtoId) return
    setLoading(true)
    Promise.all([
      fetchLojaOnlineProduto(store.empresa_id, produtoId),
      fetchLojaOnlineAvaliacoes(store.empresa_id, produtoId),
    ])
      .then(([p, av]) => {
        setProduto(p)
        setAvaliacoes(av)
      })
      .finally(() => setLoading(false))
  }, [store?.empresa_id, produtoId])

  useEffect(() => {
    if (!store?.empresa_id || !cliente?.id || !produtoId) return
    fetchLojaOnlineFavoritoIds(store.empresa_id, cliente.id).then((ids) => setFavorito(ids.has(produtoId)))
  }, [store?.empresa_id, cliente?.id, produtoId])

  const toggleFavorito = async () => {
    if (!store?.empresa_id || !cliente?.id || !produtoId) {
      navigate(link('entrar'))
      return
    }
    const next = !favorito
    setFavorito(next)
    try {
      await toggleLojaOnlineFavorito({
        empresaId: store.empresa_id,
        clienteId: cliente.id,
        produtoId,
        favorito: next,
      })
    } catch {
      setFavorito(!next)
    }
  }

  if (loading) {
    return <p className="loja-catalogo-empty">Carregando produto…</p>
  }

  if (!produto) {
    return (
      <div className="loja-store-page loja-galaxy-pdp">
        <p className="loja-catalogo-empty">Produto não encontrado.</p>
        <Link to={link()} className="loja-galaxy-pdp-back">
          <ArrowLeft size={16} /> Voltar à loja
        </Link>
      </div>
    )
  }

  const semEstoque = produto.controla_estoque && (produto.estoque_atual ?? 0) <= 0
  const maxQty = produto.controla_estoque ? Math.max(1, produto.estoque_atual ?? 0) : 99
  const precoOriginal =
    produto.loja_online_preco_de != null && produto.loja_online_preco_de > produto.preco
      ? produto.loja_online_preco_de
      : null
  const descontoValor = precoOriginal ? precoOriginal - produto.preco : 0
  const descontoPct =
    precoOriginal && precoOriginal > 0 ? Math.round((descontoValor / precoOriginal) * 100) : 0
  const parcela = produto.preco > 0 ? produto.preco / LOJA_GALAXY_PARCELAS : 0
  const corAtiva = meta?.cores?.[corSelecionada]

  const handleAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    addItem(produto, qty, e.currentTarget)
    setJustAdded(true)
    window.setTimeout(() => setJustAdded(false), 1800)
  }

  return (
    <div className="loja-store-page loja-galaxy-pdp">
      <Link to={link()} className="loja-galaxy-pdp-back">
        <ArrowLeft size={16} /> Voltar à loja
      </Link>

      <div className="loja-galaxy-pdp-grid">
        <div className="loja-galaxy-pdp-media">
          {imagens.length > 0 ? (
            <LojaOnlineProductGallery imagens={imagens} alt={produto.nome} />
          ) : (
            <div className="loja-galaxy-pdp-placeholder">
              <Package size={64} strokeWidth={1.25} />
            </div>
          )}
        </div>

        <div className="loja-galaxy-pdp-panel">
          <div className="loja-galaxy-pdp-head">
            <h1 className="loja-galaxy-pdp-title">{produto.nome}</h1>
            <button
              type="button"
              className={`loja-galaxy-pdp-fav${favorito ? ' is-active' : ''}`}
              onClick={toggleFavorito}
              aria-label={favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Heart size={22} fill={favorito ? 'currentColor' : 'none'} />
            </button>
          </div>

          {avaliacoes.length > 0 && (
            <div className="loja-galaxy-card-rating loja-galaxy-pdp-rating">
              <LojaOnlineGalaxyStars value={avaliacaoMedia} size={18} />
              <span className="loja-galaxy-card-rating-text">
                {avaliacaoMedia.toFixed(1)} ({avaliacoes.length})
              </span>
            </div>
          )}

          {mostrarPreco && (
            <div className="loja-galaxy-card-pricing loja-galaxy-pdp-pricing">
              {precoOriginal != null && descontoValor > 0 && (
                <div className="loja-galaxy-card-price-row">
                  <span className="loja-galaxy-card-was">{formatCurrency(precoOriginal)}</span>
                  <span className="loja-galaxy-card-discount">
                    {formatCurrency(descontoValor)} off / (-{descontoPct}%)
                  </span>
                </div>
              )}
              <p className="loja-galaxy-card-price">
                {formatCurrency(produto.preco)}{' '}
                <span className="loja-galaxy-card-price-tag">à vista</span>
              </p>
              {produto.preco > 0 && (
                <p className="loja-galaxy-card-installments">
                  {formatCurrency(produto.preco)} em {LOJA_GALAXY_PARCELAS}x {formatCurrency(parcela)} sem juros
                </p>
              )}
            </div>
          )}

          <div className="loja-galaxy-pdp-meta">
            <span>Unidade: {produto.unidade || 'UN'}</span>
            {produto.controla_estoque && (
              <span className={`loja-galaxy-pdp-stock${semEstoque ? ' is-off' : ''}`}>
                {semEstoque ? 'Sem estoque' : `Em estoque: ${produto.estoque_atual}`}
              </span>
            )}
          </div>

          {meta?.cores && meta.cores.length > 0 && (
            <div className="loja-galaxy-card-options loja-galaxy-pdp-options">
              <p className="loja-galaxy-card-color-label">
                Cor: <strong>{corAtiva?.nome ?? meta.cores[0].nome}</strong>
              </p>
              <div className="loja-galaxy-card-swatches" role="list" aria-label="Cores disponíveis">
                {meta.cores.map((cor, index) => (
                  <button
                    key={`${cor.nome}-${cor.hex}`}
                    type="button"
                    role="listitem"
                    className={`loja-galaxy-card-swatch${index === corSelecionada ? ' is-selected' : ''}`}
                    style={{ '--swatch-color': cor.hex } as CSSProperties}
                    aria-label={cor.nome}
                    aria-pressed={index === corSelecionada}
                    onClick={() => setCorSelecionada(index)}
                  />
                ))}
              </div>
            </div>
          )}

          {meta?.armazenamentos && meta.armazenamentos.length > 0 && (
            <div className="loja-galaxy-card-storage loja-galaxy-pdp-storage" role="list" aria-label="Armazenamentos disponíveis">
              {meta.armazenamentos.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  role="listitem"
                  className={`loja-galaxy-card-storage-pill${index === armazenamentoSelecionado ? ' is-selected' : ''}`}
                  aria-pressed={index === armazenamentoSelecionado}
                  onClick={() => setArmazenamentoSelecionado(index)}
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          {produto.descricao && (
            <div className="loja-galaxy-pdp-desc">
              <h2>Descrição</h2>
              <p>{produto.descricao}</p>
            </div>
          )}

          {!semEstoque && (
            <div className="loja-galaxy-pdp-qty">
              <span className="loja-galaxy-pdp-qty-label">Quantidade</span>
              <div className="loja-galaxy-pdp-qty-control">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuir">
                  <Minus size={16} />
                </button>
                <span>{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                  aria-label="Aumentar"
                  disabled={qty >= maxQty}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            className={`loja-galaxy-card-cta loja-galaxy-pdp-cta${justAdded ? ' loja-galaxy-card-cta--added' : ''}`}
            disabled={semEstoque}
            onClick={handleAdd}
          >
            {justAdded ? (
              <>
                <Check size={18} strokeWidth={2.5} />
                Adicionado!
              </>
            ) : semEstoque ? (
              'Esgotado'
            ) : (
              'Comprar agora'
            )}
          </button>
        </div>
      </div>

      {store?.empresa_id && produtoId && (
        <LojaOnlineProductReviews
          empresaId={store.empresa_id}
          produtoId={produtoId}
          avaliacoes={avaliacoes}
          onAdded={(a) => setAvaliacoes((prev) => [a, ...prev])}
        />
      )}
    </div>
  )
}
