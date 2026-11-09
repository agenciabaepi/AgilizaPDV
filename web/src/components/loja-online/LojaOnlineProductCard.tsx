import { Link } from 'react-router-dom'
import { ArrowRight, Heart, Package } from 'lucide-react'
import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import type { LojaOnlineProduto } from '../../lib/loja-online-types'
import { parseLojaOnlineCardMeta, parseLojaOnlineImagens } from '../../lib/loja-online-types'
import { formatCurrency } from '../../lib/loja-online'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { isCapaCustomProduto } from '../../capa-custom/lib/capa-catalogo'

export type LojaOnlineProdutoAvaliacaoResumo = {
  media: number
  total: number
}

export type LojaOnlineProdutoCardCor = {
  nome: string
  hex: string
}

/** Parcelas no padrão Joog (vitrine e PDP). */
export const LOJA_GALAXY_PARCELAS = 12

export function LojaOnlinePixBadge({ pct = 5 }: { pct?: number }) {
  return (
    <span className="loja-joog-pix-badge">
      <svg
        className="loja-joog-pix-badge-icon"
        viewBox="0 0 24 24"
        width={14}
        height={14}
        aria-hidden
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156"
        />
      </svg>
      {pct}% Off no PIX
    </span>
  )
}

function StarFraction({ fill, size = 16 }: { fill: number; size?: number }) {
  const pct = `${Math.min(100, Math.max(0, fill * 100))}%`
  return (
    <span className="loja-galaxy-star" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 24 24" width={size} height={size} className="loja-galaxy-star-empty">
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <span className="loja-galaxy-star-fill" style={{ width: pct }}>
        <svg viewBox="0 0 24 24" width={size} height={size}>
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  )
}

export function LojaOnlineGalaxyStars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="loja-galaxy-stars" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarFraction key={n} size={size} fill={Math.min(1, Math.max(0, value - (n - 1)))} />
      ))}
    </span>
  )
}

export function LojaOnlineProductCard({
  produto,
  avaliacao,
  vendidos: _vendidos,
  cores,
  armazenamentos,
  precoDe,
  corSelecionada = 0,
  armazenamentoSelecionado = 0,
  onMediaLoad,
  variant = 'default',
}: {
  produto: LojaOnlineProduto
  avaliacao?: LojaOnlineProdutoAvaliacaoResumo | null
  vendidos?: number | null
  cores?: LojaOnlineProdutoCardCor[]
  armazenamentos?: string[]
  precoDe?: number | null
  corSelecionada?: number
  armazenamentoSelecionado?: number
  onMediaLoad?: () => void
  variant?: 'default' | 'grid' | 'carousel' | 'list'
}) {
  const { link, mostrarPreco, cardsConfig, capaPersonalizadaAtiva } = useLojaOnlineStore()
  const [wishPulse, setWishPulse] = useState(false)

  const isCapaPersonalizada = capaPersonalizadaAtiva && isCapaCustomProduto(produto)
  const meta = parseLojaOnlineCardMeta(produto.loja_online_card_json)
  const coresExibir = cores ?? meta?.cores
  const armazenamentosExibir = armazenamentos ?? meta?.armazenamentos
  const precoOriginalBase = precoDe ?? produto.loja_online_preco_de
  const parcela = produto.preco > 0 ? produto.preco / LOJA_GALAXY_PARCELAS : 0
  const precoOriginal =
    precoOriginalBase != null && precoOriginalBase > produto.preco ? precoOriginalBase : null
  const descontoValor = precoOriginal ? precoOriginal - produto.preco : 0
  const descontoPct =
    precoOriginal && precoOriginal > 0 ? Math.round((descontoValor / precoOriginal) * 100) : 0
  const corAtiva = coresExibir?.[corSelecionada]
  const isCarousel = variant === 'carousel'
  const isGrid = variant === 'grid'
  const isList = variant === 'list'
  const isAligned = isCarousel || isGrid || isList
  const ratingValue = avaliacao && avaliacao.total > 0 ? avaliacao.media : 0
  const hasDiscount = precoOriginal != null && descontoValor > 0
  const pixBadgePct = hasDiscount ? Math.max(1, descontoPct) : 5
  const cardCta = cardsConfig.produto.corCta
  const variantClass = isCarousel
    ? ' loja-galaxy-card--carousel'
    : isList
      ? ' loja-galaxy-card--grid loja-joog-card--list'
      : isGrid
        ? ' loja-galaxy-card--grid'
        : ''
  const imagens = useMemo(
    () => parseLojaOnlineImagens(produto.loja_online_imagens_json, produto.imagem),
    [produto.loja_online_imagens_json, produto.imagem],
  )
  const imagemPrincipal = imagens[0] ?? produto.imagem
  const imagemHover = imagens.length > 1 ? imagens[1] : null
  const produtoHref = link(`produto/${produto.id}`)
  const ctaLabel = isCapaPersonalizada ? 'Personalizar' : 'Ver detalhes'

  const handleWish = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setWishPulse(true)
    window.setTimeout(() => setWishPulse(false), 450)
  }

  return (
    <article
      className={`loja-galaxy-card loja-joog-card loja-store-product-card loja-card-produto loja-card-produto--${cardsConfig.produto.template}${isAligned ? ' loja-galaxy-card--aligned' : ''}${variantClass}`}
      style={{ '--loja-card-produto-cta': cardCta } as CSSProperties}
    >
      <div className={`loja-joog-card-media${imagemHover ? ' loja-galaxy-card-media--has-hover' : ''}`}>
        <button
          type="button"
          className={`loja-joog-card-wish${wishPulse ? ' is-pulse' : ''}`}
          onClick={handleWish}
          aria-label="Adicionar à lista de desejos"
        >
          <Heart size={18} strokeWidth={1.6} />
        </button>

        <Link to={produtoHref} className="loja-joog-card-media-link" tabIndex={-1} aria-hidden>
          {imagemPrincipal ? (
            imagemHover ? (
              <div className="loja-galaxy-card-media-stack">
                <img
                  className="loja-galaxy-card-media-img loja-galaxy-card-media-img--primary"
                  src={imagemPrincipal}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onLoad={onMediaLoad}
                />
                <img
                  className="loja-galaxy-card-media-img loja-galaxy-card-media-img--hover"
                  src={imagemHover}
                  alt=""
                  aria-hidden
                  loading="eager"
                  decoding="async"
                />
              </div>
            ) : (
              <img src={imagemPrincipal} alt="" loading="lazy" decoding="async" onLoad={onMediaLoad} />
            )
          ) : (
            <div className="loja-galaxy-card-placeholder">
              <Package size={40} strokeWidth={1.25} />
            </div>
          )}
        </Link>
      </div>

      <Link to={produtoHref} className="loja-joog-card-content">
        <h3 className="loja-joog-card-title">{produto.nome}</h3>

        <div className="loja-joog-card-rate">
          <LojaOnlineGalaxyStars value={ratingValue} size={14} />
        </div>

        {coresExibir && coresExibir.length > 0 && (
          <div className="loja-joog-card-options">
            <p className="loja-galaxy-card-color-label">
              Cor: <strong>{corAtiva?.nome ?? coresExibir[0].nome}</strong>
            </p>
            <div className="loja-galaxy-card-swatches" role="list" aria-label="Cores disponíveis">
              {coresExibir.slice(0, 5).map((cor, index) => (
                <span
                  key={`${cor.nome}-${cor.hex}`}
                  role="listitem"
                  className={`loja-galaxy-card-swatch${index === corSelecionada ? ' is-selected' : ''}`}
                  style={{ '--swatch-color': cor.hex } as CSSProperties}
                  aria-label={cor.nome}
                />
              ))}
            </div>
          </div>
        )}

        {armazenamentosExibir && armazenamentosExibir.length > 0 && (
          <div className="loja-joog-card-storage" role="list" aria-label="Armazenamentos">
            {armazenamentosExibir.slice(0, 3).map((item, index) => (
              <span
                key={item}
                role="listitem"
                className={`loja-galaxy-card-storage-pill${index === armazenamentoSelecionado ? ' is-selected' : ''}`}
              >
                {item}
              </span>
            ))}
          </div>
        )}

        {mostrarPreco && (
          <div className="loja-joog-card-prices">
            <div className={`loja-joog-card-list-row${hasDiscount ? '' : ' is-empty'}`}>
              {hasDiscount && precoOriginal != null ? (
                <span className="loja-joog-card-list-price">{formatCurrency(precoOriginal)}</span>
              ) : null}
            </div>

            <div className="loja-joog-card-badge-row">
              <LojaOnlinePixBadge pct={pixBadgePct} />
            </div>

            <div className="loja-joog-card-sell-row">
              <span className="loja-joog-card-sell-price">{formatCurrency(produto.preco)}</span>
            </div>

            {produto.preco > 0 ? (
              <p className="loja-joog-card-installment">
                <span className="loja-joog-inst-total">{formatCurrency(produto.preco)}</span>
                {' em '}
                <span className="loja-joog-inst-count">{LOJA_GALAXY_PARCELAS}x</span>
                {' '}
                <span className="loja-joog-inst-value">{formatCurrency(parcela)}</span>
                {' '}
                <span className="loja-joog-inst-suffix">s/ juros</span>
              </p>
            ) : null}
          </div>
        )}
      </Link>

      <Link to={produtoHref} className="loja-joog-card-cta" aria-label={`${ctaLabel} de ${produto.nome}`}>
        <span>{ctaLabel}</span>
        <ArrowRight size={16} strokeWidth={2.25} aria-hidden />
      </Link>
    </article>
  )
}
