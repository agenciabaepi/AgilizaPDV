import { useState } from 'react'
import { Star } from 'lucide-react'
import type { LojaOnlineAvaliacao } from '../../lib/loja-online-types'
import { createLojaOnlineAvaliacao } from '../../lib/loja-online-api'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { LojaOnlineGalaxyStars } from './LojaOnlineProductCard'

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span aria-label={`${value} de 5 estrelas`}>
      <LojaOnlineGalaxyStars value={value} size={size} />
    </span>
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
  const [nota, setNota] = useState(5)
  const [comentario, setComentario] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const media =
    initial.length > 0
      ? initial.reduce((s, a) => s + a.nota, 0) / initial.length
      : 0

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
      })
      onAdded(av)
      setComentario('')
      setNota(5)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar avaliação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="loja-galaxy-pdp-reviews">
      <h2 className="loja-galaxy-pdp-reviews-title">Avaliações</h2>
      {initial.length > 0 && (
        <p className="loja-galaxy-pdp-reviews-summary">
          <Stars value={media} size={18} />
          <span>{media.toFixed(1)} · {initial.length} avaliação(ões)</span>
        </p>
      )}

      <ul className="loja-galaxy-pdp-reviews-list">
        {initial.map((a) => (
          <li key={a.id}>
            <div className="loja-galaxy-pdp-reviews-head">
              <strong>{a.cliente_nome}</strong>
              <Stars value={a.nota} size={14} />
            </div>
            {a.comentario && <p>{a.comentario}</p>}
            <time dateTime={a.created_at}>
              {new Date(a.created_at).toLocaleDateString('pt-BR')}
            </time>
          </li>
        ))}
      </ul>

      <form className="loja-galaxy-pdp-reviews-form" onSubmit={handleSubmit}>
        <h3>Deixe sua avaliação</h3>
        {!cliente && <p className="loja-online-hint">Entre na sua conta para avaliar.</p>}
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
          disabled={!cliente}
        />
        {error && <p className="loja-online-field-error">{error}</p>}
        <button type="submit" className="loja-galaxy-card-cta loja-galaxy-pdp-reviews-submit" disabled={!cliente || saving}>
          {saving ? 'Enviando…' : 'Publicar avaliação'}
        </button>
      </form>
    </section>
  )
}
