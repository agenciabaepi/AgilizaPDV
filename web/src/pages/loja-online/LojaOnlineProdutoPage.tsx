import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Flame, Heart, Info, Minus, Package, Plus } from 'lucide-react'
import {
  fetchLojaOnlineAvaliacoes,
  fetchLojaOnlineFavoritoIds,
  fetchLojaOnlineProduto,
  fetchLojaOnlineProdutoVariacoes,
  fetchLojaOnlineVendidosCount,
  toggleLojaOnlineFavorito,
  type LojaOnlineVariacaoSku,
} from '../../lib/loja-online-api'
import { parseLojaOnlineCardMeta, parseLojaOnlineMidias, type LojaOnlineAvaliacao, type LojaOnlineProduto } from '../../lib/loja-online-types'
import { resolveLojaOnlineProdutoTags } from '../../lib/loja-online-produto-tags'
import { plainProdutoDescricao, renderProdutoDescricao } from '../../lib/produto-descricao'
import { formatCurrency, formatLojaOnlineVendidos } from '../../lib/loja-online'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { useLojaOnlineSeo } from '../../hooks/useLojaOnlineSeo'
import { getLojaOnlineCanonicalUrl } from '../../lib/loja-online-seo'
import { LojaOnlineProductGallery } from '../../components/loja-online/LojaOnlineProductGallery'
import { LojaOnlineProductReviews } from '../../components/loja-online/LojaOnlineProductReviews'
import { LOJA_GALAXY_PARCELAS, LojaOnlineGalaxyStars } from '../../components/loja-online/LojaOnlineProductCard'
import { LojaOnlineVariacoesPicker } from '../../components/loja-online/LojaOnlineVariacoesPicker'
import { LojaOnlineFreteCalculo } from '../../components/loja-online/LojaOnlineFreteCalculo'
import { trackLojaOnlineEvent } from '../../lib/loja-online-track'

export function LojaOnlineProdutoPage() {
  const { produtoId } = useParams<{ produtoId: string }>()
  const { store, link, mostrarPreco, titulo, slug } = useLojaOnlineStore()
  const { addItem } = useLojaOnlineCart()
  const { cliente } = useLojaOnlineClienteAuth()
  const navigate = useNavigate()
  const [produto, setProduto] = useState<LojaOnlineProduto | null>(null)
  const [avaliacoes, setAvaliacoes] = useState<LojaOnlineAvaliacao[]>([])
  const [vendidos, setVendidos] = useState(0)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)
  const [favorito, setFavorito] = useState(false)
  const [justAdded, setJustAdded] = useState(false)
  const [corSelecionada, setCorSelecionada] = useState(0)
  const [armazenamentoSelecionado, setArmazenamentoSelecionado] = useState(0)
  const [variacaoSkus, setVariacaoSkus] = useState<LojaOnlineVariacaoSku[]>([])
  const [skuAtual, setSkuAtual] = useState<LojaOnlineVariacaoSku | null>(null)
  const [variacaoLabel, setVariacaoLabel] = useState('')

  const midias = useMemo(
    () => (produto ? parseLojaOnlineMidias(produto.loja_online_imagens_json, produto.imagem) : []),
    [produto]
  )

  const meta = useMemo(
    () => (produto ? parseLojaOnlineCardMeta(produto.loja_online_card_json) : null),
    [produto]
  )

  const produtoTags = useMemo(
    () =>
      produto
        ? resolveLojaOnlineProdutoTags({
            tags: meta?.tags,
            preco: produto.preco,
            precoDe: produto.loja_online_preco_de,
          })
        : [],
    [produto, meta?.tags]
  )

  const avaliacaoMedia = useMemo(() => {
    if (avaliacoes.length === 0) return 0
    return avaliacoes.reduce((sum, item) => sum + item.nota, 0) / avaliacoes.length
  }, [avaliacoes])

  const skusAtivos = useMemo(
    () => variacaoSkus.filter((s) => Number(s.ativo) === 1),
    [variacaoSkus]
  )

  useLojaOnlineSeo(
    produto
      ? {
          title: `${produto.nome} | ${titulo}`,
          description: plainProdutoDescricao(produto.descricao || '').slice(0, 160) || produto.nome,
          image: midias.find((m) => m.tipo === 'image')?.url ?? produto.imagem,
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
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const [p, av, vd] = await Promise.all([
          fetchLojaOnlineProduto(store.empresa_id, produtoId),
          fetchLojaOnlineAvaliacoes(store.empresa_id, produtoId),
          fetchLojaOnlineVendidosCount(store.empresa_id, produtoId).catch(() => 0),
        ])
        let skus: LojaOnlineVariacaoSku[] = []
        try {
          skus = await fetchLojaOnlineProdutoVariacoes(store.empresa_id, produtoId)
        } catch {
          skus = []
        }
        if (cancelled) return
        setProduto(p)
        setAvaliacoes(av)
        setVendidos(vd)
        setVariacaoSkus(skus)
        setSkuAtual(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [store?.empresa_id, produtoId])

  useEffect(() => {
    if (!store?.empresa_id || !cliente?.id || !produtoId) return
    fetchLojaOnlineFavoritoIds(store.empresa_id, cliente.id).then((ids) => setFavorito(ids.has(produtoId)))
  }, [store?.empresa_id, cliente?.id, produtoId])

  useEffect(() => {
    if (!store?.empresa_id || !produto?.id) return
    void trackLojaOnlineEvent({
      empresaId: store.empresa_id,
      eventName: 'view_content',
      produtoId: produto.id,
      value: produto.preco,
      contentIds: [produto.id],
    })
  }, [store?.empresa_id, produto?.id, produto?.preco])

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

  const onSkuChange = useCallback((sku: LojaOnlineVariacaoSku | null, label: string) => {
    setSkuAtual(sku)
    setVariacaoLabel(label)
  }, [])

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

  const temVariacoes = skusAtivos.length > 0
  const precoVenda = skuAtual?.preco ?? produto.preco
  const estoqueVenda = skuAtual?.estoque_atual ?? produto.estoque_atual
  const controlaVenda = skuAtual ? skuAtual.controla_estoque : produto.controla_estoque
  const semEstoque = temVariacoes
    ? !skuAtual || (Boolean(skuAtual.controla_estoque) && (skuAtual.estoque_atual ?? 0) <= 0)
    : Boolean(produto.controla_estoque) && (produto.estoque_atual ?? 0) <= 0
  const precisaEscolher = temVariacoes && !skuAtual
  const estoqueBaixo =
    Boolean(controlaVenda) &&
    !precisaEscolher &&
    !semEstoque &&
    (estoqueVenda ?? 0) > 0 &&
    (estoqueVenda ?? 0) <= 2
  const maxQty = controlaVenda ? Math.max(1, estoqueVenda ?? 0) : 99
  const precoOriginal =
    produto.loja_online_preco_de != null && produto.loja_online_preco_de > precoVenda
      ? produto.loja_online_preco_de
      : null
  const descontoValor = precoOriginal ? precoOriginal - precoVenda : 0
  const descontoPct =
    precoOriginal && precoOriginal > 0 ? Math.round((descontoValor / precoOriginal) * 100) : 0
  const parcela = precoVenda > 0 ? precoVenda / LOJA_GALAXY_PARCELAS : 0
  const corAtiva = meta?.cores?.[corSelecionada]

  const handleAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (temVariacoes) {
      if (!skuAtual) return
      addItem(
        {
          ...produto,
          id: skuAtual.id,
          nome: skuAtual.nome,
          preco: skuAtual.preco,
          imagem: skuAtual.imagem ?? produto.imagem,
          estoque_atual: skuAtual.estoque_atual,
          controla_estoque: skuAtual.controla_estoque,
          unidade: skuAtual.unidade || produto.unidade,
        },
        qty,
        e.currentTarget,
        { produtoPaiId: produto.id, variacaoLabel: variacaoLabel || skuAtual.nome }
      )
    } else {
      addItem(produto, qty, e.currentTarget)
    }
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
          {midias.length > 0 ? (
            <LojaOnlineProductGallery midias={midias} alt={produto.nome} />
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

          {produtoTags.length > 0 ? (
            <div className="loja-galaxy-card-tags loja-galaxy-pdp-tags" aria-label="Destaques do produto">
              {produtoTags.map((tag) => (
                <span key={tag.id} className={`loja-galaxy-card-tag loja-galaxy-card-tag--${tag.tone}`}>
                  {tag.label}
                </span>
              ))}
            </div>
          ) : null}

          {(avaliacoes.length > 0 || vendidos > 0) && (
            <div className="loja-galaxy-card-rating loja-galaxy-pdp-rating">
              {avaliacoes.length > 0 ? (
                <>
                  <LojaOnlineGalaxyStars value={avaliacaoMedia} size={18} />
                  <span className="loja-galaxy-card-rating-text">
                    {avaliacaoMedia.toFixed(1)} ({avaliacoes.length})
                  </span>
                </>
              ) : null}
              {vendidos > 0 ? (
                <span className="loja-galaxy-pdp-sold">{formatLojaOnlineVendidos(vendidos)}</span>
              ) : null}
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
                {formatCurrency(precoVenda)}{' '}
                <span className="loja-galaxy-card-price-tag">à vista</span>
              </p>
              {precoVenda > 0 && (
                <p className="loja-galaxy-card-installments">
                  {formatCurrency(precoVenda)} em {LOJA_GALAXY_PARCELAS}x {formatCurrency(parcela)} sem juros
                </p>
              )}
            </div>
          )}

          {meta?.aviso?.trim() ? (
            <aside className="loja-galaxy-pdp-aviso" role="note" aria-label={meta.avisoTitulo?.trim() || 'Aviso do produto'}>
              <span className="loja-galaxy-pdp-aviso-icon" aria-hidden>
                <Info size={18} strokeWidth={2.25} />
              </span>
              <div className="loja-galaxy-pdp-aviso-body">
                <strong className="loja-galaxy-pdp-aviso-title">
                  {meta.avisoTitulo?.trim() || 'Atenção'}
                </strong>
                <p className="loja-galaxy-pdp-aviso-text">{meta.aviso.trim()}</p>
              </div>
            </aside>
          ) : null}

          <div className="loja-galaxy-pdp-meta">
            <span>Unidade: {produto.unidade || 'UN'}</span>
            {controlaVenda && !precisaEscolher && semEstoque ? (
              <span className="loja-galaxy-pdp-stock is-off">Esgotado</span>
            ) : null}
            {estoqueBaixo ? (
              <span className="loja-galaxy-pdp-stock is-low">
                <Flame size={14} strokeWidth={2.4} aria-hidden />
                Poucas unidades — somente {estoqueVenda}
              </span>
            ) : null}
          </div>

          {temVariacoes && (
            <LojaOnlineVariacoesPicker
              produto={produto}
              skus={variacaoSkus}
              onSkuChange={onSkuChange}
            />
          )}

          {!temVariacoes && meta?.cores && meta.cores.length > 0 && (
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

          {!temVariacoes && meta?.armazenamentos && meta.armazenamentos.length > 0 && (
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
              <div className="loja-galaxy-pdp-desc-body">{renderProdutoDescricao(produto.descricao)}</div>
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

          {store && slug && (
            <LojaOnlineFreteCalculo
              store={store}
              slug={slug}
              produtoId={skuAtual?.id ?? produto.id}
              preco={precoVenda}
              quantidade={qty}
            />
          )}

          <button
            type="button"
            className={`loja-galaxy-card-cta loja-galaxy-pdp-cta${justAdded ? ' loja-galaxy-card-cta--added' : ''}`}
            disabled={semEstoque || precisaEscolher}
            onClick={handleAdd}
          >
            {justAdded ? (
              <>
                <Check size={18} strokeWidth={2.5} />
                Adicionado!
              </>
            ) : precisaEscolher ? (
              'Escolha as opções'
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
