import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImagePlus, Star, Trash2 } from 'lucide-react'
import { Alert, Button, ConfirmDialog, Input } from './ui'
import type { LojaOnlineAvaliacao, LojaOnlineMidia } from '../lib/loja-online-types'
import { parseLojaOnlineAvaliacaoMidias } from '../lib/loja-online-types'
import {
  createLojaOnlineAvaliacaoManual,
  deleteLojaOnlineAvaliacao,
  fetchLojaOnlineAvaliacoes,
} from '../lib/loja-online-api'
import { isProdutoImageFile, PRODUTO_MIDIA_ACCEPT, readProdutoImagemFile } from '../lib/produto-imagem'
import {
  isVideoFile,
  MAX_AVALIACAO_MIDIAS,
  MAX_AVALIACAO_VIDEOS,
  uploadAvaliacaoMidia,
} from '../lib/produto-midias-storage'
import { MidiaLightbox, ReviewMidiaThumb } from './loja-online/LojaOnlineProductReviews'

function dataUrlToJpegFile(dataUrl: string, name: string): File {
  const [meta, b64] = dataUrl.split(',')
  const mime = /:(.*?);/.exec(meta)?.[1] ?? 'image/jpeg'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], name.replace(/\.[^.]+$/, '.jpg'), { type: mime })
}

function hojeIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type DraftMidia = LojaOnlineMidia & { localId: string }

function StarsInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} estrelas`}
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer' }}
        >
          <Star
            size={24}
            fill={n <= value ? '#ff6900' : 'none'}
            color={n <= value ? '#ff6900' : '#d9d9d9'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  )
}

export function ProdutoAvaliacoesAdmin({ empresaId, produtoId }: { empresaId: string; produtoId: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [avaliacoes, setAvaliacoes] = useState<LojaOnlineAvaliacao[]>([])
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState('')
  const [nota, setNota] = useState(5)
  const [comentario, setComentario] = useState('')
  const [data, setData] = useState(hojeIso)
  const [draftMidias, setDraftMidias] = useState<DraftMidia[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LojaOnlineAvaliacao | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [lightbox, setLightbox] = useState<{ midias: LojaOnlineMidia[]; index: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAvaliacoes(await fetchLojaOnlineAvaliacoes(empresaId, produtoId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar avaliações.')
    } finally {
      setLoading(false)
    }
  }, [empresaId, produtoId])

  useEffect(() => {
    void load()
  }, [load])

  const handlePickFiles = async (files: FileList | null) => {
    if (!files?.length) return
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

  const handleAdd = async () => {
    setError(null)
    if (!nome.trim()) {
      setError('Informe o nome de quem avaliou.')
      return
    }
    setSaving(true)
    try {
      const createdAt = data && data !== hojeIso() ? new Date(`${data}T12:00:00`).toISOString() : null
      const av = await createLojaOnlineAvaliacaoManual({
        empresaId,
        produtoId,
        clienteNome: nome,
        nota,
        comentario: comentario.trim() || null,
        midias: draftMidias.map(({ tipo, url }) => ({ tipo, url })),
        createdAt,
      })
      setAvaliacoes((prev) =>
        [av, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      )
      setNome('')
      setNota(5)
      setComentario('')
      setData(hojeIso())
      setDraftMidias([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar avaliação.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteLojaOnlineAvaliacao(empresaId, deleteTarget.id)
      setAvaliacoes((prev) => prev.filter((a) => a.id !== deleteTarget.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir avaliação.')
    } finally {
      setDeleting(false)
    }
  }

  const draftPreview = draftMidias.map(({ tipo, url }) => ({ tipo, url }))

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault()
      }}
    >
      <div
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <strong>Adicionar avaliação manual</strong>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }} className="grid-mobile-1">
          <Input
            label="Nome de quem avaliou"
            value={nome}
            onChange={(e) => setNome(e.currentTarget.value)}
            placeholder="Ex: Maria S."
          />
          <Input
            label="Data"
            type="date"
            value={data}
            max={hojeIso()}
            onChange={(e) => setData(e.currentTarget.value)}
          />
        </div>
        <div className="input-wrap">
          <span className="input-label">Nota</span>
          <StarsInput value={nota} onChange={setNota} />
        </div>
        <div className="input-wrap">
          <label className="input-label" htmlFor="produto-avaliacao-comentario">Comentário</label>
          <textarea
            id="produto-avaliacao-comentario"
            className="input-el"
            rows={3}
            value={comentario}
            onChange={(e) => setComentario(e.currentTarget.value)}
            placeholder="O que o cliente achou do produto (opcional)"
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept={PRODUTO_MIDIA_ACCEPT}
            multiple
            hidden
            onChange={(e) => void handlePickFiles(e.target.files)}
          />
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ImagePlus size={16} />}
            disabled={uploading || draftMidias.length >= MAX_AVALIACAO_MIDIAS}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? 'Enviando…' : 'Adicionar fotos ou vídeo'}
          </Button>
          <span className="input-hint" style={{ marginLeft: 10 }}>
            Até {MAX_AVALIACAO_MIDIAS} arquivos · máx. {MAX_AVALIACAO_VIDEOS} vídeo
          </span>
          {draftMidias.length > 0 ? (
            <div className="loja-galaxy-pdp-reviews-midias">
              {draftMidias.map((m, i) => (
                <ReviewMidiaThumb
                  key={m.localId}
                  midia={m}
                  onOpen={() => setLightbox({ midias: draftPreview, index: i })}
                  onRemove={() => setDraftMidias((prev) => prev.filter((x) => x.localId !== m.localId))}
                />
              ))}
            </div>
          ) : null}
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <div>
          <Button onClick={() => void handleAdd()} disabled={saving || uploading}>
            {saving ? 'Salvando…' : 'Adicionar avaliação'}
          </Button>
        </div>
      </div>

      <h4 style={{ margin: '24px 0 8px' }}>
        Avaliações publicadas {avaliacoes.length > 0 ? `(${avaliacoes.length})` : ''}
      </h4>
      {loading ? (
        <p className="input-hint">Carregando…</p>
      ) : avaliacoes.length === 0 ? (
        <p className="input-hint">Nenhuma avaliação neste produto ainda.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {avaliacoes.map((a) => {
            const midias = parseLojaOnlineAvaliacaoMidias(a.midias_json)
            return (
              <li
                key={a.id}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>{a.cliente_nome}</strong>
                    <span style={{ color: '#ff6900' }}>{'★'.repeat(a.nota)}{'☆'.repeat(5 - a.nota)}</span>
                    <span className="input-hint">
                      {new Date(a.created_at).toLocaleDateString('pt-BR')} ·{' '}
                      {a.cliente_id ? 'Cliente da loja' : 'Manual'}
                    </span>
                  </div>
                  {a.comentario && <p style={{ margin: '4px 0 0' }}>{a.comentario}</p>}
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
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Excluir avaliação"
                  title="Excluir avaliação"
                  onClick={() => setDeleteTarget(a)}
                >
                  <Trash2 size={16} />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {createPortal(
        <>
          <ConfirmDialog
            open={deleteTarget != null}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            title="Excluir avaliação"
            message={`Excluir a avaliação de ${deleteTarget?.cliente_nome ?? ''}? Ela some da loja online.`}
            confirmLabel="Excluir"
            variant="danger"
            loading={deleting}
          />
          {lightbox ? (
            <MidiaLightbox
              midias={lightbox.midias}
              index={lightbox.index}
              onClose={() => setLightbox(null)}
              onIndex={(i) => setLightbox((cur) => (cur ? { ...cur, index: i } : null))}
            />
          ) : null}
        </>,
        document.body
      )}
    </div>
  )
}
