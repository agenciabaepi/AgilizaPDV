import { Link } from 'react-router-dom'
import { Check, Package } from 'lucide-react'
import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import type { LojaOnlineProduto } from '../../lib/loja-online-types'
import { parseLojaOnlineCardMeta, parseLojaOnlineImagens } from '../../lib/loja-online-types'
import { formatCurrency } from '../../lib/loja-online'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'

export type LojaOnlineProdutoAvaliacaoResumo = {
  media: number
  total: number
}

export type LojaOnlineProdutoCardCor = {
  nome: string
  hex: string
}

export const LOJA_GALAXY_PARCELAS = 18

function StarFraction({ fill, size = 16 }: { fill: number; size?: number }) {
  const pct = `${Math.min(100, Math.max(0, fill * 100))}%`
  return (
    <span className="loja-galaxy-star" style={{ width: size, height: size }} aria-hidden>
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className="loja-galaxy-star-empty"
      >
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

function ProductStarsDetailed({ value, size = 16 }: { value: number; size?: number }) {
  return <LojaOnlineGalaxyStars value={value} size={size} />
}

function produtoEmEstoque(produto: LojaOnlineProduto): boolean {
  if (!produto.controla_estoque) return true
  return (produto.estoque_atual ?? 0) > 0
}

export function LojaOnlineProductCard({
  produto,
  avaliacao,
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
  cores?: LojaOnlineProdutoCardCor[]
  armazenamentos?: string[]
  precoDe?: number | null
  corSelecionada?: number
  armazenamentoSelecionado?: number
  onMediaLoad?: () => void
  /** `grid` = catálogo; `carousel` = destaques — blocos com altura fixa para alinhar botões */
  variant?: 'default' | 'grid' | 'carousel'
}) {
  const { link, mostrarPreco, cardsConfig } = useLojaOnlineStore()
  const { addItem } = useLojaOnlineCart()
  const [justAdded, setJustAdded] = useState(false)

  const emEstoque = produtoEmEstoque(produto)
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

  const handleAdd = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    addItem(produto, 1, e.currentTarget)
    setJustAdded(true)
    window.setTimeout(() => setJustAdded(false), 1400)
  }

  const isCarousel = variant === 'carousel'
  const isGrid = variant === 'grid'
  const isAligned = isCarousel || isGrid
  const showRating = Boolean(avaliacao && avaliacao.total > 0)
  const reserveRatingSlot = isAligned || showRating
  const hasDiscount = precoOriginal != null && descontoValor > 0
  const cardBg = cardsConfig.produto.corFundo
  const cardCta = cardsConfig.produto.corCta
  const variantClass = isCarousel ? ' loja-galaxy-card--carousel' : isGrid ? ' loja-galaxy-card--grid' : ''
  const imagens = useMemo(
    () => parseLojaOnlineImagens(produto.loja_online_imagens_json, produto.imagem),
    [produto.loja_online_imagens_json, produto.imagem],
  )
  const imagemPrincipal = imagens[0] ?? produto.imagem
  const imagemHover = imagens.length > 1 ? imagens[1] : null

  return (
    <article
      className={`loja-galaxy-card loja-store-product-card loja-card-produto loja-card-produto--${cardsConfig.produto.template}${isAligned ? ' loja-galaxy-card--aligned' : ''}${variantClass}`}
      style={
        {
          '--loja-card-produto-cor': cardBg,
          '--loja-card-produto-cta': cardCta,
          backgroundColor: cardBg,
        } as CSSProperties
      }
    >
      <Link to={link(`produto/${produto.id}`)} className="loja-galaxy-card-link">
        <h3 className="loja-galaxy-card-title">{produto.nome}</h3>

        <div
          className={`loja-galaxy-card-media${imagemHover ? ' loja-galaxy-card-media--has-hover' : ''}`}
          style={{ backgroundColor: cardBg }}
        >
          {imagemPrincipal ? (
            imagemHover ? (
              <div className="loja-galaxy-card-media-stack">
                <img
                  className="loja-galaxy-card-media-img loja-galaxy-card-media-img--primary"
                  src={imagemPrincipal}
                  alt={produto.nome}
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
              <img
                src={imagemPrincipal}
                alt={produto.nome}
                loading="lazy"
                decoding="async"
                onLoad={onMediaLoad}
              />
            )
          ) : (
            <div className="loja-galaxy-card-placeholder">
              <Package size={48} strokeWidth={1.25} />
            </div>
          )}
        </div>
      </Link>

      {coresExibir && coresExibir.length > 0 && (
        <div className="loja-galaxy-card-options">
          <p className="loja-galaxy-card-color-label">
            Cor: <strong>{corAtiva?.nome ?? coresExibir[0].nome}</strong>
          </p>
          <div className="loja-galaxy-card-swatches" role="list" aria-label="Cores disponíveis">
            {coresExibir.map((cor, index) => (
              <span
                key={`${cor.nome}-${cor.hex}`}
                role="listitem"
                className={`loja-galaxy-card-swatch${index === corSelecionada ? ' is-selected' : ''}`}
                style={{ '--swatch-color': cor.hex } as CSSProperties}
                aria-label={cor.nome}
                aria-current={index === corSelecionada ? 'true' : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {armazenamentosExibir && armazenamentosExibir.length > 0 && (
        <div className="loja-galaxy-card-storage" role="list" aria-label="Armazenamentos disponíveis">
          {armazenamentosExibir.map((item, index) => (
            <span
              key={item}
              role="listitem"
              className={`loja-galaxy-card-storage-pill${index === armazenamentoSelecionado ? ' is-selected' : ''}`}
              aria-current={index === armazenamentoSelecionado ? 'true' : undefined}
            >
              {item}
            </span>
          ))}
        </div>
      )}

      {mostrarPreco && (
        <div className="loja-galaxy-card-pricing">
          {(isAligned || hasDiscount) && (
            <div
              className={`loja-galaxy-card-price-row${isAligned && !hasDiscount ? ' is-empty' : ''}`}
              aria-hidden={isAligned && !hasDiscount}
            >
              {hasDiscount && precoOriginal != null && (
                <>
                  <span className="loja-galaxy-card-was">{formatCurrency(precoOriginal)}</span>
                  <span className="loja-galaxy-card-discount">
                    {formatCurrency(descontoValor)} off / (-{descontoPct}%)
                  </span>
                </>
              )}
            </div>
          )}
          <p className="loja-galaxy-card-price">
            {formatCurrency(produto.preco)} <span className="loja-galaxy-card-price-tag">à vista</span>
          </p>
          {produto.preco > 0 && (
            <p className="loja-galaxy-card-installments">
              {formatCurrency(produto.preco)} em {LOJA_GALAXY_PARCELAS}x {formatCurrency(parcela)} sem juros
            </p>
          )}
        </div>
      )}

      {reserveRatingSlot && (
        <div
          className={`loja-galaxy-card-rating${isAligned && !showRating ? ' is-empty' : ''}`}
          aria-hidden={isAligned && !showRating}
        >
          {showRating && avaliacao && (
            <>
              <ProductStarsDetailed value={avaliacao.media} size={isCarousel ? 13 : 16} />
              <span className="loja-galaxy-card-rating-text">
                {avaliacao.media.toFixed(1)} ({avaliacao.total})
              </span>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        className={`loja-galaxy-card-cta${justAdded ? ' loja-galaxy-card-cta--added' : ''}`}
        onClick={handleAdd}
        disabled={!emEstoque}
        aria-label={
          justAdded ? 'Adicionado ao carrinho' : `Comprar ${produto.nome} agora`
        }
      >
        {justAdded ? (
          <>
            <Check size={18} strokeWidth={2.5} />
            Adicionado!
          </>
        ) : emEstoque ? (
          'Comprar agora'
        ) : (
          'Esgotado'
        )}
      </button>
    </article>
  )
}
