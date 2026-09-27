import { useRef, useState } from 'react'
import { ImagePlus, Star } from 'lucide-react'
import type { LojaOnlineAvaliacao, LojaOnlineMidia } from '../../lib/loja-online-types'
import { createLojaOnlineAvaliacao } from '../../lib/loja-online-api'
import { isProdutoImageFile, PRODUTO_MIDIA_ACCEPT, readProdutoImagemFile } from '../../lib/produto-imagem'
import {
  isVideoFile,
  MAX_AVALIACAO_MIDIAS,
  MAX_AVALIACAO_VIDEOS,
  uploadAvaliacaoMidia,
} from '../../lib/produto-midias-storage'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { MidiaLightbox, ReviewMidiaThumb } from './LojaOnlineProductReviews'

function dataUrlToJpegFile(dataUrl: string, name: string): File {
  const [meta, b64] = dataUrl.split(',')
  const mime = /:(.*?);/.exec(meta)?.[1] ?? 'image/jpeg'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], name.replace(/\.[^.]+$/, '.jpg'), { type: mime })
}

type DraftMidia = LojaOnlineMidia & { localId: string }

export function LojaOnlineAvaliacaoForm({
  empresaId,
  produtoId,
  pedidoId,
  produtoNome,
  onDone,
  onCancel,
}: {
  empresaId: string
  produtoId: string
  pedidoId: string
  produtoNome: string
  onDone: (a: LojaOnlineAvaliacao) => void
  onCancel?: () => void
}) {
  const { cliente } = useLojaOnlineClienteAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [nota, setNota] = useState(5)
  const [comentario, setComentario] = useState('')
  const [draftMidias, setDraftMidias] = useState<DraftMidia[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

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
        if (isVideoFile(file)) {
          if (next.filter((m) => m.tipo === 'video').length >= MAX_AVALIACAO_VIDEOS) {
            setError('Envie no máximo 1 vídeo por avaliação.')
            continue
          }
          const url = await uploadAvaliacaoMidia({ empresaId, file, kind: 'video' })
          next.push({ tipo: 'video', url, localId: crypto.randomUUID() })
        } else if (isProdutoImageFile(file)) {
          const dataUrl = await readProdutoImagemFile(file)
          const jpeg = dataUrlToJpegFile(dataUrl, file.name)
          const url = await uploadAvaliacaoMidia({ empresaId, file: jpeg, kind: 'image', ext: 'jpg' })
          next.push({ tipo: 'image', url, localId: crypto.randomUUID() })
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
        pedidoId,
      })
      onDone(av)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar avaliação.')
    } finally {
      setSaving(false)
    }
  }

  const midiasPreview = draftMidias.map(({ tipo, url }) => ({ tipo, url }))

  return (
    <form className="loja-galaxy-pdp-reviews-form loja-store-pedido-avaliacao-form" onSubmit={handleSubmit}>
      <h3>Avaliar {produtoNome}</h3>
      <p className="loja-online-hint">
        Conte como foi receber o produto. Anexe fotos ou um vídeo, se quiser.
      </p>

      <div className="loja-galaxy-pdp-reviews-nota">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={n <= nota ? 'is-active' : ''}
            onClick={() => setNota(n)}
            aria-label={`${n} estrelas`}
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
      />

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
            {draftMidias.map((m, i) => (
              <ReviewMidiaThumb
                key={m.localId}
                midia={m}
                onOpen={() => setLightboxIndex(i)}
                onRemove={() => setDraftMidias((prev) => prev.filter((x) => x.localId !== m.localId))}
              />
            ))}
          </div>
        ) : null}
      </div>

      {error && <p className="loja-online-field-error">{error}</p>}
      <div className="loja-store-pedido-avaliacao-actions">
        <button
          type="submit"
          className="loja-galaxy-card-cta loja-galaxy-pdp-reviews-submit"
          disabled={saving || uploading}
        >
          {saving ? 'Enviando…' : 'Publicar avaliação'}
        </button>
        {onCancel ? (
          <button type="button" className="loja-store-pedido-avaliacao-cancel" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
        ) : null}
      </div>

      {lightboxIndex != null ? (
        <MidiaLightbox
          midias={midiasPreview}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndex={setLightboxIndex}
        />
      ) : null}
    </form>
  )
}
