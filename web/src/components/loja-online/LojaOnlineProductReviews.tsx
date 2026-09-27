import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Play, X } from 'lucide-react'
import type { LojaOnlineAvaliacao, LojaOnlineMidia } from '../../lib/loja-online-types'
import { parseLojaOnlineAvaliacaoMidias } from '../../lib/loja-online-types'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { LojaOnlineGalaxyStars } from './LojaOnlineProductCard'

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span aria-label={`${value} de 5 estrelas`}>
      <LojaOnlineGalaxyStars value={value} size={size} />
    </span>
  )
}

export function ReviewMidiaThumb({
  midia,
  onOpen,
  onRemove,
}: {
  midia: LojaOnlineMidia
  onOpen?: () => void
  onRemove?: () => void
}) {
  return (
    <div className="loja-galaxy-pdp-reviews-midia">
      <button
        type="button"
        className="loja-galaxy-pdp-reviews-midia-btn"
        onClick={onOpen}
        aria-label={midia.tipo === 'video' ? 'Ver vídeo' : 'Ver foto'}
      >
        {midia.tipo === 'video' ? (
          <>
            <video src={midia.url} muted playsInline preload="metadata" />
            <span className="loja-galaxy-pdp-reviews-midia-play" aria-hidden>
              <Play size={18} fill="currentColor" />
            </span>
          </>
        ) : (
          <img src={midia.url} alt="" loading="lazy" decoding="async" />
        )}
      </button>
      {onRemove ? (
        <button
          type="button"
          className="loja-galaxy-pdp-reviews-midia-remove"
          onClick={onRemove}
          aria-label="Remover mídia"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      ) : null}
    </div>
  )
}

export function MidiaLightbox({
  midias,
  index,
  onClose,
  onIndex,
}: {
  midias: LojaOnlineMidia[]
  index: number
  onClose: () => void
  onIndex: (i: number) => void
}) {
  const current = midias[index]
  if (!current) return null

  return (
    <div className="loja-galaxy-pdp-reviews-lightbox" role="dialog" aria-modal="true" aria-label="Mídia da avaliação">
      <button type="button" className="loja-galaxy-pdp-reviews-lightbox-backdrop" onClick={onClose} aria-label="Fechar" />
      <div className="loja-galaxy-pdp-reviews-lightbox-body">
        <button type="button" className="loja-galaxy-pdp-reviews-lightbox-close" onClick={onClose} aria-label="Fechar">
          <X size={22} />
        </button>
        {current.tipo === 'video' ? (
          <video src={current.url} controls autoPlay playsInline className="loja-galaxy-pdp-reviews-lightbox-media" />
        ) : (
          <img src={current.url} alt="" className="loja-galaxy-pdp-reviews-lightbox-media" />
        )}
        {midias.length > 1 ? (
          <div className="loja-galaxy-pdp-reviews-lightbox-nav">
            <button type="button" disabled={index <= 0} onClick={() => onIndex(index - 1)}>
              Anterior
            </button>
            <span>
              {index + 1} / {midias.length}
            </span>
            <button type="button" disabled={index >= midias.length - 1} onClick={() => onIndex(index + 1)}>
              Próxima
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function LojaOnlineProductReviews({ avaliacoes }: { avaliacoes: LojaOnlineAvaliacao[] }) {
  const { cliente } = useLojaOnlineClienteAuth()
  const { link } = useLojaOnlineStore()
  const [lightbox, setLightbox] = useState<{ midias: LojaOnlineMidia[]; index: number } | null>(null)

  const media =
    avaliacoes.length > 0 ? avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length : 0

  const todasMidias = useMemo(() => {
    const list: LojaOnlineMidia[] = []
    for (const a of avaliacoes) list.push(...parseLojaOnlineAvaliacaoMidias(a.midias_json))
    return list
  }, [avaliacoes])

  return (
    <section className="loja-galaxy-pdp-reviews">
      <h2 className="loja-galaxy-pdp-reviews-title">Avaliações de quem comprou</h2>
      {avaliacoes.length > 0 && (
        <p className="loja-galaxy-pdp-reviews-summary">
          <Stars value={media} size={18} />
          <span>
            {media.toFixed(1)} · {avaliacoes.length} avaliação(ões)
          </span>
        </p>
      )}

      {todasMidias.length > 0 ? (
        <div className="loja-galaxy-pdp-reviews-gallery" aria-label="Fotos e vídeos dos clientes">
          {todasMidias.slice(0, 12).map((m, i) => (
            <ReviewMidiaThumb
              key={`${m.url}-${i}`}
              midia={m}
              onOpen={() => setLightbox({ midias: todasMidias, index: i })}
            />
          ))}
        </div>
      ) : null}

      <ul className="loja-galaxy-pdp-reviews-list">
        {avaliacoes.map((a) => {
          const midias = parseLojaOnlineAvaliacaoMidias(a.midias_json)
          return (
            <li key={a.id}>
              <div className="loja-galaxy-pdp-reviews-head">
                <strong>{a.cliente_nome}</strong>
                <Stars value={a.nota} size={14} />
              </div>
              <p className="loja-galaxy-pdp-reviews-badge">Compra verificada</p>
              {a.comentario && <p>{a.comentario}</p>}
              {midias.length > 0 ? (
                <div className="loja-galaxy-pdp-reviews-midias">
                  {midias.map((m, i) => (
                    <ReviewMidiaThumb
                      key={`${a.id}-${m.url}`}
                      midia={m}
                      onOpen={() => setLightbox({ midias, index: i })}
                    />
                  ))}
                </div>
              ) : null}
              <time dateTime={a.created_at}>{new Date(a.created_at).toLocaleDateString('pt-BR')}</time>
            </li>
          )
        })}
      </ul>

      {avaliacoes.length === 0 ? (
        <p className="loja-online-hint">Ainda não há avaliações neste produto.</p>
      ) : null}

      <p className="loja-online-hint loja-galaxy-pdp-reviews-how">
        Comprou este produto? Depois que o pedido for entregue, avalie e envie fotos ou vídeo em{' '}
        <Link to={cliente ? link('conta') : link('entrar')}>Minha conta → Meus pedidos</Link>.
      </p>

      {lightbox ? (
        <MidiaLightbox
          midias={lightbox.midias}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndex={(i) => setLightbox((cur) => (cur ? { ...cur, index: i } : null))}
        />
      ) : null}
    </section>
  )
}
