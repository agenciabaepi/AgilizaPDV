import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Check,
  ChevronDown,
  CirclePlus,
  Flame,
  Heart,
  Info,
  Package,
  Palette,
  Plus,
  ShoppingCart,
  WandSparkles,
} from 'lucide-react'
import { capaModelosFromSkus, isCapaCustomProduto } from '../../capa-custom/lib/capa-catalogo'
import {
  fetchLojaOnlineAvaliacoes,
  fetchLojaOnlineFavoritoIds,
  fetchLojaOnlineProduto,
  fetchLojaOnlineProdutoVariacoes,
  toggleLojaOnlineFavorito,
  type LojaOnlineVariacaoSku,
} from '../../lib/loja-online-api'
import { parseLojaOnlineCardMeta, parseLojaOnlineMidias, type LojaOnlineAvaliacao, type LojaOnlineProduto } from '../../lib/loja-online-types'
import { plainProdutoDescricao, renderProdutoDescricao } from '../../lib/produto-descricao'
import { formatCurrency } from '../../lib/loja-online'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { useLojaOnlineSeo } from '../../hooks/useLojaOnlineSeo'
import { getLojaOnlineCanonicalUrl } from '../../lib/loja-online-seo'
import { LojaOnlineProductGallery } from '../../components/loja-online/LojaOnlineProductGallery'
import { LojaOnlineProductReviews } from '../../components/loja-online/LojaOnlineProductReviews'
import {
  LOJA_GALAXY_PARCELAS,
  LojaOnlineGalaxyStars,
  LojaOnlinePixBadge,
} from '../../components/loja-online/LojaOnlineProductCard'
import { LojaOnlineVariacoesPicker } from '../../components/loja-online/LojaOnlineVariacoesPicker'
import { LojaOnlineFreteCalculo } from '../../components/loja-online/LojaOnlineFreteCalculo'
import { trackLojaOnlineEvent } from '../../lib/loja-online-track'
import { setLojaOnlineBehaviorProduto, trackLojaOnlineBehavior, trackLojaOnlineCapa } from '../../lib/loja-online-behavior'

export function LojaOnlineProdutoPage() {
  const { produtoId } = useParams<{ produtoId: string }>()
  const { store, link, mostrarPreco, titulo, slug, capaPersonalizadaAtiva } = useLojaOnlineStore()
  const { addItem, openCart } = useLojaOnlineCart()
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
  const [variacaoSkus, setVariacaoSkus] = useState<LojaOnlineVariacaoSku[]>([])
  const [skuAtual, setSkuAtual] = useState<LojaOnlineVariacaoSku | null>(null)
  const [erroVariacao, setErroVariacao] = useState(false)
  const variacoesRef = useRef<HTMLDivElement>(null)
  const descricaoRef = useRef<HTMLDivElement>(null)
  const [variacaoLabel, setVariacaoLabel] = useState('')

  const midias = useMemo(
    () => (produto ? parseLojaOnlineMidias(produto.loja_online_imagens_json, produto.imagem) : []),
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

  const skusAtivos = useMemo(
    () => variacaoSkus.filter((s) => Number(s.ativo) === 1),
    [variacaoSkus]
  )

  const descricaoPlain = useMemo(
    () => (produto ? plainProdutoDescricao(produto.descricao || '') : ''),
    [produto]
  )

  useLojaOnlineSeo(
    produto
      ? {
          title: `${produto.nome} | ${titulo}`,
          description: descricaoPlain.slice(0, 160) || produto.nome,
          image: midias.find((m) => m.tipo === 'image')?.url ?? produto.imagem,
          url: getLojaOnlineCanonicalUrl(slug, link(`produto/${produto.id}`), store?.loja_online_dominio_custom),
          type: 'product',
          price: produto.preco,
          availability:
            produto.controla_estoque && (produto.estoque_atual ?? 0) <= 0 ? 'OutOfStock' : 'InStock',
        }
      : null,
    { keepStorefrontBrand: true }
  )

  useEffect(() => {
    if (!store?.empresa_id || !produtoId) return
    let cancelled = false
    setLoading(true)
    setAvaliacoes([])
    fetchLojaOnlineAvaliacoes(store.empresa_id, produtoId)
      .then((av) => !cancelled && setAvaliacoes(av))
      .catch(() => null)
    void (async () => {
      try {
        const [p, skus] = await Promise.all([
          fetchLojaOnlineProduto(store.empresa_id, produtoId),
          fetchLojaOnlineProdutoVariacoes(store.empresa_id, produtoId).catch(() => [] as LojaOnlineVariacaoSku[]),
        ])
        if (cancelled) return
        setProduto(p)
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
    setLojaOnlineBehaviorProduto(produto.id)
    trackLojaOnlineBehavior('product_view', {
      nome: produto.nome,
      preco: produto.preco,
      preco_de: produto.loja_online_preco_de ?? null,
      total_midias: midias.length,
      sem_estoque: Boolean(produto.controla_estoque) && (produto.estoque_atual ?? 0) <= 0,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez por produto aberto
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
    if (sku) {
      setErroVariacao(false)
      trackLojaOnlineBehavior('variation_select', { label: label || sku.nome, preco: sku.preco })
    }
  }, [])

  useEffect(() => {
    setErroVariacao(false)
  }, [produtoId])

  if (loading) {
    return (
      <div className="loja-store-page loja-pdp-skeleton loja-joog-pdp" aria-busy="true" aria-label="Carregando produto">
        <div className="loja-pdp-skeleton-media" />
        <div className="loja-pdp-skeleton-info">
          <span className="loja-pdp-skeleton-line is-title" />
          <span className="loja-pdp-skeleton-line is-short" />
          <span className="loja-pdp-skeleton-line is-price" />
          <span className="loja-pdp-skeleton-line" />
          <span className="loja-pdp-skeleton-line" />
          <span className="loja-pdp-skeleton-btn" />
        </div>
      </div>
    )
  }

  if (!produto) {
    return (
      <div className="loja-store-page loja-galaxy-pdp loja-joog-pdp">
        <p className="loja-catalogo-empty">Produto não encontrado.</p>
        <Link to={link()} className="loja-galaxy-pdp-back">
          Voltar à loja
        </Link>
      </div>
    )
  }

  const capaModelos =
    capaPersonalizadaAtiva && isCapaCustomProduto(produto) ? capaModelosFromSkus(skusAtivos) : null
  const capaDisponivel = capaModelos?.some((m) => m.disponivel) ?? false
  const capaPrecoMin = capaModelos?.length ? Math.min(...capaModelos.map((m) => m.preco)) : null
  const temVariacoes = !capaModelos && skusAtivos.length > 0
  const precoVenda = skuAtual?.preco ?? capaPrecoMin ?? produto.preco
  const estoqueVenda = skuAtual?.estoque_atual ?? produto.estoque_atual
  const controlaVenda = capaModelos ? 0 : skuAtual ? skuAtual.controla_estoque : produto.controla_estoque
  const semEstoque = capaModelos
    ? !capaDisponivel
    : temVariacoes
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
  const pixBadgePct = descontoPct > 0 ? descontoPct : 5
  const codigoProduto =
    produto.codigo != null && Number.isFinite(produto.codigo)
      ? String(produto.codigo)
      : produto.id.slice(0, 8)

  const resolveCartProduto = () => {
    if (temVariacoes && skuAtual) {
      return {
        produtoParaCarrinho: {
          ...produto,
          id: skuAtual.id,
          nome: skuAtual.nome,
          preco: skuAtual.preco,
          imagem: produto.imagem,
          loja_online_imagens_json: produto.loja_online_imagens_json,
          estoque_atual: skuAtual.estoque_atual,
          controla_estoque: skuAtual.controla_estoque,
          unidade: skuAtual.unidade || produto.unidade,
        } as LojaOnlineProduto,
        metaExtra: { produtoPaiId: produto.id, variacaoLabel: variacaoLabel || skuAtual.nome },
      }
    }
    return { produtoParaCarrinho: produto, metaExtra: undefined }
  }

  const ensureVariacao = () => {
    if (!temVariacoes || skuAtual) return true
    setErroVariacao(true)
    variacoesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return false
  }

  const handleAdd = (e: React.MouseEvent<HTMLButtonElement>, goCheckout = false) => {
    if (!ensureVariacao()) return
    const { produtoParaCarrinho, metaExtra } = resolveCartProduto()
    addItem(produtoParaCarrinho, qty, e.currentTarget, metaExtra)
    setJustAdded(true)
    window.setTimeout(() => setJustAdded(false), 1800)
    if (goCheckout) openCart()
  }

  const scrollToDescricao = () => {
    descricaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="loja-store-page loja-galaxy-pdp loja-joog-pdp">
      <div className="loja-galaxy-pdp-grid loja-joog-pdp-grid">
        <div className="loja-galaxy-pdp-media loja-joog-pdp-media">
          <div className="loja-joog-pdp-gallery-wrap">
            {midias.length > 0 ? (
              <LojaOnlineProductGallery
                midias={midias}
                alt={produto.nome}
                onMediaChange={(index, total, tipo) =>
                  trackLojaOnlineBehavior('gallery_view', { index, total, tipo }, { produtoId: produto.id })
                }
              />
            ) : (
              <div className="loja-galaxy-pdp-placeholder">
                <Package size={64} strokeWidth={1.25} />
              </div>
            )}
            {!capaModelos && (
              <button
                type="button"
                className={`loja-joog-pdp-wish${favorito ? ' is-active' : ''}`}
                onClick={toggleFavorito}
                aria-label={favorito ? 'Remover dos favoritos' : 'Adicionar à lista de desejos'}
                aria-pressed={favorito}
              >
                <Heart size={18} strokeWidth={1.75} fill={favorito ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>
        </div>

        <div className="loja-galaxy-pdp-panel loja-joog-pdp-info">
          <h1 className="loja-galaxy-pdp-title loja-joog-pdp-title">{produto.nome}</h1>

          <div className="loja-joog-pdp-rate-row">
            <LojaOnlineGalaxyStars value={avaliacoes.length > 0 ? avaliacaoMedia : 0} size={16} />
            <span className="loja-joog-pdp-code">Cod.: {codigoProduto}</span>
          </div>

          {descricaoPlain ? (
            <div className="loja-joog-pdp-excerpt">
              <p className="loja-joog-pdp-excerpt-text">{descricaoPlain}</p>
              <button type="button" className="loja-joog-pdp-more" onClick={scrollToDescricao}>
                <span className="loja-joog-plus-circle" aria-hidden>
                  <Plus size={12} strokeWidth={2.75} />
                </span>
                mais informações
              </button>
            </div>
          ) : null}

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

          <div className="loja-galaxy-pdp-meta loja-joog-pdp-meta">
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
            <div ref={variacoesRef} className="loja-joog-pdp-skus">
              <LojaOnlineVariacoesPicker
                produto={produto}
                skus={variacaoSkus}
                onSkuChange={onSkuChange}
                mostrarErro={erroVariacao}
              />
            </div>
          )}

          {!temVariacoes && meta?.cores && meta.cores.length > 0 && (
            <div className="loja-galaxy-card-options loja-galaxy-pdp-options loja-joog-pdp-skus">
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
            <div className="loja-galaxy-card-storage loja-galaxy-pdp-storage loja-joog-pdp-skus" role="list" aria-label="Armazenamentos disponíveis">
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
        </div>

        <div className="loja-joog-pdp-buybox">
          {mostrarPreco && (
            <div className={`loja-joog-pdp-prices${capaModelos ? ' loja-joog-pdp-prices--capa' : ''}`}>
              <div className="loja-joog-pdp-selling-row">
                <p className="loja-joog-pdp-selling-price">
                  {capaModelos && capaModelos.some((m) => m.preco !== capaPrecoMin) ? (
                    <span className="loja-joog-pdp-from">a partir de </span>
                  ) : null}
                  {formatCurrency(precoVenda)}
                </p>
                <LojaOnlinePixBadge pct={pixBadgePct} />
              </div>
              {precoOriginal != null && descontoValor > 0 ? (
                <p className="loja-joog-pdp-list-price">
                  <span className="loja-galaxy-card-was">{formatCurrency(precoOriginal)}</span>
                  <span className="loja-galaxy-card-discount">
                    {formatCurrency(descontoValor)} off (-{descontoPct}%)
                  </span>
                </p>
              ) : null}
              {precoVenda > 0 && (
                <p className="loja-joog-pdp-installments">
                  <span className="loja-joog-inst-total">{formatCurrency(precoVenda)}</span>
                  {' em '}
                  <span className="loja-joog-inst-count">{LOJA_GALAXY_PARCELAS}x</span>
                  {' '}
                  <span className="loja-joog-inst-value">{formatCurrency(parcela)}</span>
                  {' '}
                  <span className="loja-joog-inst-suffix">sem juros</span>
                </p>
              )}
              <button type="button" className="loja-joog-pdp-pay-more" onClick={scrollToDescricao}>
                <span className="loja-joog-plus-circle" aria-hidden>
                  <Plus size={12} strokeWidth={2.75} />
                </span>
                mais opções de pagamento
              </button>
            </div>
          )}

          {capaModelos ? (
            <div className="loja-capa-custom-pdp">
              <p className="loja-capa-custom-pdp-title">
                <Palette size={18} /> Crie sua capa do seu jeito
              </p>
              <ol className="loja-capa-custom-pdp-steps">
                <li>Escolha o modelo do seu celular</li>
                <li>Envie suas fotos, escreva textos e escolha a cor de fundo</li>
                <li>Confira a prévia e adicione ao carrinho</li>
              </ol>
              {!capaDisponivel && (
                <p className="loja-capa-custom-pdp-modelos">Todos os modelos estão esgotados no momento.</p>
              )}
              <div className="loja-capa-pdp-sticky">
                <button
                  type="button"
                  className="loja-capa-pdp-sticky-cta"
                  disabled={!capaDisponivel}
                  onClick={() => {
                    trackLojaOnlineCapa('cta', produto.id)
                    navigate(link(`personalizar/${produto.id}`))
                  }}
                >
                  <WandSparkles size={20} strokeWidth={2.25} />
                  {capaDisponivel ? 'Personalizar' : 'Esgotado'}
                </button>
                <button
                  type="button"
                  className={`loja-capa-pdp-sticky-fav${favorito ? ' is-active' : ''}`}
                  onClick={toggleFavorito}
                  aria-label={favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  aria-pressed={favorito}
                >
                  <Heart size={22} fill={favorito ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          ) : (
            <>
              {!semEstoque || precisaEscolher ? (
                <label className="loja-joog-pdp-qty">
                  <span className="sr-only">Quantidade</span>
                  <div className="loja-joog-pdp-qty-select-wrap">
                    <select
                      className="loja-joog-pdp-qty-select"
                      value={qty}
                      onChange={(e) => setQty(Math.min(maxQty, Math.max(1, Number(e.target.value) || 1)))}
                      aria-label="Quantidade"
                    >
                      {Array.from({ length: Math.min(10, maxQty) }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} strokeWidth={2.25} aria-hidden />
                  </div>
                </label>
              ) : null}

              <button
                type="button"
                className={`loja-joog-pdp-buy${justAdded ? ' is-added' : ''}`}
                disabled={semEstoque && !precisaEscolher}
                onClick={(e) => handleAdd(e, true)}
              >
                {justAdded ? (
                  <>
                    <Check size={18} strokeWidth={2.5} />
                    Adicionado!
                  </>
                ) : semEstoque && !precisaEscolher ? (
                  'Esgotado'
                ) : (
                  <>
                    <ShoppingCart size={18} strokeWidth={2.25} aria-hidden />
                    Comprar
                  </>
                )}
              </button>

              <button
                type="button"
                className={`loja-joog-pdp-add${justAdded ? ' is-added' : ''}`}
                disabled={semEstoque && !precisaEscolher}
                onClick={(e) => handleAdd(e, false)}
              >
                {semEstoque && !precisaEscolher ? (
                  'Esgotado'
                ) : (
                  <>
                    <CirclePlus size={20} strokeWidth={2} aria-hidden />
                    Adicionar ao carrinho
                  </>
                )}
              </button>
            </>
          )}

          {store && slug && !capaModelos && (
            <LojaOnlineFreteCalculo
              store={store}
              slug={slug}
              produtoId={skuAtual?.id ?? produto.id}
              preco={precoVenda}
              quantidade={qty}
            />
          )}
        </div>
      </div>

      {produto.descricao && (
        <div className="loja-galaxy-pdp-desc loja-joog-pdp-desc" ref={descricaoRef} id="descricao">
          <h2>Sobre este item</h2>
          <div className="loja-galaxy-pdp-desc-body">{renderProdutoDescricao(produto.descricao)}</div>
        </div>
      )}

      {store?.empresa_id && produtoId && (
        <LojaOnlineProductReviews avaliacoes={avaliacoes} />
      )}
    </div>
  )
}
