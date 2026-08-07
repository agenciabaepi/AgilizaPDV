import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Input } from '../components/ui'
import {
  deleteLojaOnlineCupom,
  fetchLojaOnlineCupons,
  saveLojaOnlineCupom,
} from '../lib/loja-online-api'
import type { LojaOnlineCupom } from '../lib/loja-online-types'
import { formatCurrency } from '../lib/loja-online'

type Props = { empresaId: string }

const emptyForm = () => ({
  codigo: '',
  tipo: 'percentual' as 'percentual' | 'fixo',
  valor: '',
  valorMinimo: '',
  usoMaximo: '',
  validoAte: '',
})

export function LojaOnlineCuponsAdmin({ empresaId }: Props) {
  const [cupons, setCupons] = useState<LojaOnlineCupom[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetchLojaOnlineCupons(empresaId)
      .then(setCupons)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [empresaId])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.codigo.trim()) return
    setSaving(true)
    setError(null)
    try {
      await saveLojaOnlineCupom({
        empresaId,
        codigo: form.codigo,
        tipo: form.tipo,
        valor: Number(form.valor.replace(',', '.')) || 0,
        valorMinimo: Number(form.valorMinimo.replace(',', '.')) || 0,
        usoMaximo: form.usoMaximo ? Number(form.usoMaximo) : null,
        validoAte: form.validoAte || null,
      })
      setForm(emptyForm())
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar cupom.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este cupom?')) return
    await deleteLojaOnlineCupom(id)
    load()
  }

  return (
    <div className="loja-cupons-admin">
      <form className="loja-cupons-form" onSubmit={handleAdd}>
        <div className="loja-cupons-form-grid">
          <Input label="Código" value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))} placeholder="VERAO10" required />
          <label className="input-wrap">
            <span className="input-label">Tipo</span>
            <select className="input-el" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as 'percentual' | 'fixo' }))}>
              <option value="percentual">Percentual (%)</option>
              <option value="fixo">Valor fixo (R$)</option>
            </select>
          </label>
          <Input label={form.tipo === 'percentual' ? 'Percentual' : 'Valor (R$)'} value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} required />
          <Input label="Pedido mínimo (R$)" value={form.valorMinimo} onChange={(e) => setForm((f) => ({ ...f, valorMinimo: e.target.value }))} />
          <Input label="Limite de usos" value={form.usoMaximo} onChange={(e) => setForm((f) => ({ ...f, usoMaximo: e.target.value }))} placeholder="Ilimitado" />
          <Input label="Válido até" type="date" value={form.validoAte} onChange={(e) => setForm((f) => ({ ...f, validoAte: e.target.value }))} />
        </div>
        {error && <p className="loja-online-field-error">{error}</p>}
        <Button type="submit" disabled={saving} leftIcon={<Plus size={16} />}>
          {saving ? 'Salvando…' : 'Adicionar cupom'}
        </Button>
      </form>

      {loading ? (
        <p className="loja-online-hint">Carregando cupons…</p>
      ) : cupons.length === 0 ? (
        <p className="loja-online-hint">Nenhum cupom cadastrado.</p>
      ) : (
        <div className="loja-cupons-list">
          {cupons.map((c) => (
            <div key={c.id} className="loja-cupons-item">
              <div>
                <strong>{c.codigo}</strong>
                <span className="loja-cupons-item-meta">
                  {c.tipo === 'percentual' ? `${c.valor}%` : formatCurrency(c.valor)}
                  {c.valor_minimo > 0 ? ` · mín. ${formatCurrency(c.valor_minimo)}` : ''}
                  {c.uso_maximo != null ? ` · ${c.usos_atual}/${c.uso_maximo} usos` : ''}
                </span>
              </div>
              <button type="button" className="loja-online-banner-remove" onClick={() => handleDelete(c.id)} aria-label="Excluir">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
