import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Play, Star, X } from 'lucide-react'
import type { LojaOnlineAvaliacao, LojaOnlineMidia } from '../../lib/loja-online-types'
import { parseLojaOnlineAvaliacaoMidias } from '../../lib/loja-online-types'
import {
  createLojaOnlineAvaliacao,
  fetchLojaOnlineElegibilidadeAvaliacao,
  type LojaOnlineElegibilidadeAvaliacao,
} from '../../lib/loja-online-api'
import { isProdutoImageFile, PRODUTO_MIDIA_ACCEPT, readProdutoImagemFile } from '../../lib/produto-imagem'
import {
  isVideoFile,
  MAX_AVALIACAO_MIDIAS,
  MAX_AVALIACAO_VIDEOS,
  uploadAvaliacaoMidia,
} from '../../lib/produto-midias-storage'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { LojaOnlineGalaxyStars } from './LojaOnlineProductCard'

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span aria-label={`${value} de 5 estrelas`}>
      <LojaOnlineGalaxyStars value={value} size={size} />
    </span>
  )
}

function dataUrlToJpegFile(dataUrl: string, name: string): File {
  const [meta, b64] = dataUrl.split(',')
  const mime = /:(.*?);/.exec(meta)?.[1] ?? 'image/jpeg'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], name.replace(/\.[^.]+$/, '.jpg'), { type: mime })
}

type DraftMidia = LojaOnlineMidia & { previewUrl?: string; localId: string }

function ReviewMidiaThumb({
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

function MidiaLightbox({
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
            <button
              type="button"
              disabled={index <= 0}
              onClick={() => onIndex(index - 1)}
            >
              Anterior
            </button>
            <span>
              {index + 1} / {midias.length}
            </span>
            <button
              type="button"
              disabled={index >= midias.length - 1}
              onClick={() => onIndex(index + 1)}
            >
              Próxima
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function LojaOnlineProductReviews({
  empresaId,
  produtoId,
  avaliacoes: initial,
  onAdded,
}: {
  empresaId: string
  produtoId: string
  avaliacoes: LojaOnlineAvaliacao[]
  onAdded: (a: LojaOnlineAvaliacao) => void
}) {
  const { cliente } = useLojaOnlineClienteAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [nota, setNota] = useState(5)
  const [comentario, setComentario] = useState('')
  const [draftMidias, setDraftMidias] = useState<DraftMidia[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elegivel, setElegivel] = useState<LojaOnlineElegibilidadeAvaliacao | null>(null)
  const [lightbox, setLightbox] = useState<{ midias: LojaOnlineMidia[]; index: number } | null>(null)

  const media =
    initial.length > 0
      ? initial.reduce((s, a) => s + a.nota, 0) / initial.length
      : 0

  const todasMidias = useMemo(() => {
    const list: LojaOnlineMidia[] = []
    for (const a of initial) {
      list.push(...parseLojaOnlineAvaliacaoMidias(a.midias_json))
    }
    return list
  }, [initial])

  useEffect(() => {
    if (!cliente?.id) {
      setElegivel(null)
      return
    }
    let cancelled = false
    fetchLojaOnlineElegibilidadeAvaliacao(empresaId, produtoId, cliente.id)
      .then((e) => {
        if (!cancelled) setElegivel(e)
      })
      .catch(() => {
        if (!cancelled) {
          setElegivel({
            podeAvaliar: false,
            jaAvaliou: false,
            comprou: false,
            pedidoId: null,
            motivo: 'Não foi possível verificar sua compra.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [empresaId, produtoId, cliente?.id])

  const podeForm = Boolean(cliente && elegivel?.podeAvaliar)

  const handlePickFiles = async (files: FileList | null) => {
    if (!files?.length || !cliente) return
    setError(null)
    setUploading(true)
    try {
      const next = [...draftMidias]
      for (const file of Array.from(files)) {
        if (next.length >= MAX_AVALIACAO_MIDIAS) {
          setError(`Máximo de ${MAX_AVALIACAO_MIDIAS} fotos/vídeos por avaliação.`)
          break
        }
        const videos = next.filter((m) => m.tipo === 'video').length
        if (isVideoFile(file)) {
          if (videos >= MAX_AVALIACAO_VIDEOS) {
            setError('Envie no máximo 1 vídeo por avaliação.')
            continue
          }
          const url = await uploadAvaliacaoMidia({
            empresaId,
            file,
            kind: 'video',
          })
          next.push({ tipo: 'video', url, localId: crypto.randomUUID(), previewUrl: url })
        } else if (isProdutoImageFile(file)) {
          const dataUrl = await readProdutoImagemFile(file)
          const jpeg = dataUrlToJpegFile(dataUrl, file.name)
          const url = await uploadAvaliacaoMidia({
            empresaId,
            file: jpeg,
            kind: 'image',
            ext: 'jpg',
          })
          next.push({ tipo: 'image', url, localId: crypto.randomUUID(), previewUrl: url })
        } else {
          setError('Use fotos (JPG, PNG, HEIC) ou vídeo (MP4, MOV, WebM).')
        }
      }
      setDraftMidias(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar mídia.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cliente) {
      setError('Faça login para avaliar.')
      return
    }
    if (!elegivel?.podeAvaliar) {
      setError(elegivel?.motivo || 'Só quem comprou este produto pode avaliar.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const av = await createLojaOnlineAvaliacao({
        empresaId,
        produtoId,
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        nota,
        comentario: comentario.trim() || null,
        midias: draftMidias.map(({ tipo, url }) => ({ tipo, url })),
        pedidoId: elegivel.pedidoId,
      })
      onAdded(av)
      setComentario('')
      setNota(5)
      setDraftMidias([])
      setElegivel({
        ...elegivel,
        podeAvaliar: false,
        jaAvaliou: true,
        motivo: 'Você já avaliou este produto.',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar avaliação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="loja-galaxy-pdp-reviews">
      <h2 className="loja-galaxy-pdp-reviews-title">Avaliações de quem comprou</h2>
      {initial.length > 0 && (
        <p className="loja-galaxy-pdp-reviews-summary">
          <Stars value={media} size={18} />
          <span>
            {media.toFixed(1)} · {initial.length} avaliação(ões)
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
        {initial.map((a) => {
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
              <time dateTime={a.created_at}>
                {new Date(a.created_at).toLocaleDateString('pt-BR')}
              </time>
            </li>
          )
        })}
      </ul>

      {initial.length === 0 ? (
        <p className="loja-online-hint">Ainda não há avaliações neste produto.</p>
      ) : null}

      <form className="loja-galaxy-pdp-reviews-form" onSubmit={handleSubmit}>
        <h3>Deixe sua avaliação</h3>

        {!cliente ? (
          <p className="loja-online-hint">Entre na sua conta para avaliar — só quem comprou pode publicar.</p>
        ) : elegivel == null ? (
          <p className="loja-online-hint">Verificando sua compra…</p>
        ) : elegivel.jaAvaliou ? (
          <p className="loja-online-hint">Obrigado! Você já avaliou este produto.</p>
        ) : !elegivel.podeAvaliar ? (
          <p className="loja-online-hint">
            {elegivel.motivo || 'Só quem comprou este produto pode avaliar e anexar fotos/vídeos.'}
          </p>
        ) : (
          <p className="loja-online-hint">
            Conte como foi receber o produto. Anexe fotos ou um vídeo da compra, se quiser.
          </p>
        )}

        <div className="loja-galaxy-pdp-reviews-nota">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={n <= nota ? 'is-active' : ''}
              onClick={() => setNota(n)}
              aria-label={`${n} estrelas`}
              disabled={!podeForm}
            >
              <Star
                size={22}
                fill={n <= nota ? '#ff6900' : 'none'}
                color={n <= nota ? '#ff6900' : '#d9d9d9'}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>

        <textarea
          className="input-el loja-online-textarea"
          rows={3}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Conte sua experiência (opcional)"
          disabled={!podeForm}
        />

        {podeForm ? (
          <div className="loja-galaxy-pdp-reviews-attach">
            <input
              ref={fileRef}
              type="file"
              accept={PRODUTO_MIDIA_ACCEPT}
              multiple
              hidden
              onChange={(e) => void handlePickFiles(e.target.files)}
            />
            <button
              type="button"
              className="loja-galaxy-pdp-reviews-attach-btn"
              disabled={uploading || draftMidias.length >= MAX_AVALIACAO_MIDIAS}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus size={18} strokeWidth={2} />
              {uploading ? 'Enviando…' : 'Anexar fotos ou vídeo'}
            </button>
            <span className="loja-galaxy-pdp-reviews-attach-hint">
              Até {MAX_AVALIACAO_MIDIAS} arquivos · máx. {MAX_AVALIACAO_VIDEOS} vídeo
            </span>
            {draftMidias.length > 0 ? (
              <div className="loja-galaxy-pdp-reviews-midias">
                {draftMidias.map((m) => (
                  <ReviewMidiaThumb
                    key={m.localId}
                    midia={m}
                    onOpen={() =>
                      setLightbox({
                        midias: draftMidias.map(({ tipo, url }) => ({ tipo, url })),
                        index: draftMidias.findIndex((x) => x.localId === m.localId),
                      })
                    }
                    onRemove={() =>
                      setDraftMidias((prev) => prev.filter((x) => x.localId !== m.localId))
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {error && <p className="loja-online-field-error">{error}</p>}
        <button
          type="submit"
          className="loja-galaxy-card-cta loja-galaxy-pdp-reviews-submit"
          disabled={!podeForm || saving || uploading}
        >
          {saving ? 'Enviando…' : 'Publicar avaliação'}
        </button>
      </form>

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
