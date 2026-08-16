import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Input } from '../components/ui'
import {
  deleteLojaOnlineOrderBump,
  fetchLojaOnlineOrderBumps,
  fetchLojaOnlineProdutos,
  saveLojaOnlineOrderBump,
} from '../lib/loja-online-api'
import type { LojaOnlineOrderBump, LojaOnlineOrderBumpTipo, LojaOnlineProduto } from '../lib/loja-online-types'
import { formatCurrency } from '../lib/loja-online'

type Props = { empresaId: string }

const emptyForm = () => ({
  tipo: 'fixo' as LojaOnlineOrderBumpTipo,
  produtoId: '',
  triggerProdutoId: '',
  titulo: '',
  descricao: '',
  precoEspecial: '',
})

function produtoLabel(p: LojaOnlineProduto) {
  return `${p.nome} · ${formatCurrency(p.preco)}`
}

export function LojaOnlineOrderBumpsAdmin({ empresaId }: Props) {
  const [bumps, setBumps] = useState<LojaOnlineOrderBump[]>([])
  const [produtos, setProdutos] = useState<LojaOnlineProduto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [buscaOferta, setBuscaOferta] = useState('')
  const [buscaGatilho, setBuscaGatilho] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetchLojaOnlineOrderBumps(empresaId),
      fetchLojaOnlineProdutos(empresaId, false),
    ])
      .then(([list, prods]) => {
        setBumps(list)
        setProdutos(prods)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar order bumps.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [empresaId])

  const filtrar = (termo: string, excludeId?: string) => {
    const q = termo.trim().toLowerCase()
    return produtos
      .filter((p) => p.id !== excludeId)
      .filter((p) => !q || p.nome.toLowerCase().includes(q) || String(p.codigo ?? '').includes(q))
      .slice(0, 80)
  }

  const ofertas = useMemo(() => filtrar(buscaOferta), [produtos, buscaOferta])
  const gatilhos = useMemo(
    () => filtrar(buscaGatilho, form.produtoId),
    [produtos, buscaGatilho, form.produtoId]
  )

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.produtoId) {
      setError('Escolha o produto da oferta.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveLojaOnlineOrderBump({
        empresaId,
        tipo: form.tipo,
        produtoId: form.produtoId,
        triggerProdutoId: form.tipo === 'personalizado' ? form.triggerProdutoId : null,
        titulo: form.titulo,
        descricao: form.descricao,
        precoEspecial: form.precoEspecial ? Number(form.precoEspecial.replace(',', '.')) : null,
        ordem: bumps.length,
      })
      setForm(emptyForm())
      setBuscaOferta('')
      setBuscaGatilho('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar order bump.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este order bump?')) return
    await deleteLojaOnlineOrderBump(id, empresaId)
    load()
  }

  const handleToggle = async (bump: LojaOnlineOrderBump) => {
    await saveLojaOnlineOrderBump({
      empresaId,
      id: bump.id,
      tipo: bump.tipo,
      produtoId: bump.produto_id,
      triggerProdutoId: bump.trigger_produto_id,
      titulo: bump.titulo,
      descricao: bump.descricao,
      precoEspecial: bump.preco_especial,
      ativo: bump.ativo !== 1,
      ordem: bump.ordem,
    })
    load()
  }

  return (
    <div className="loja-orderbumps-admin">
      <form className="loja-orderbumps-form" onSubmit={handleAdd}>
        <div className="loja-orderbumps-tipo">
          <label className={`loja-orderbumps-tipo-opt${form.tipo === 'fixo' ? ' is-active' : ''}`}>
            <input
              type="radio"
              name="ob-tipo"
              checked={form.tipo === 'fixo'}
              onChange={() => setForm((f) => ({ ...f, tipo: 'fixo', triggerProdutoId: '' }))}
            />
            <span>
              <strong>Fixo</strong>
              <small>Aparece em qualquer checkout, se o produto extra ainda não estiver no carrinho.</small>
            </span>
          </label>
          <label className={`loja-orderbumps-tipo-opt${form.tipo === 'personalizado' ? ' is-active' : ''}`}>
            <input
              type="radio"
              name="ob-tipo"
              checked={form.tipo === 'personalizado'}
              onChange={() => setForm((f) => ({ ...f, tipo: 'personalizado' }))}
            />
            <span>
              <strong>Personalizado</strong>
              <small>Só aparece se um produto específico estiver no carrinho (ex.: controle → pilhas).</small>
            </span>
          </label>
        </div>

        <div className="loja-cupons-form-grid">
          {form.tipo === 'personalizado' && (
            <label className="input-wrap">
              <span className="input-label">Produto no carrinho (gatilho)</span>
              <input
                className="input-el"
                value={buscaGatilho}
                onChange={(e) => setBuscaGatilho(e.target.value)}
                placeholder="Buscar produto…"
              />
              <select
                className="input-el"
                value={form.triggerProdutoId}
                onChange={(e) => setForm((f) => ({ ...f, triggerProdutoId: e.target.value }))}
                required
              >
                <option value="">Selecione…</option>
                {gatilhos.map((p) => (
                  <option key={p.id} value={p.id}>{produtoLabel(p)}</option>
                ))}
              </select>
            </label>
          )}
          <label className="input-wrap">
            <span className="input-label">Produto da oferta (order bump)</span>
            <input
              className="input-el"
              value={buscaOferta}
              onChange={(e) => setBuscaOferta(e.target.value)}
              placeholder="Buscar produto…"
            />
            <select
              className="input-el"
              value={form.produtoId}
              onChange={(e) => setForm((f) => ({ ...f, produtoId: e.target.value }))}
              required
            >
              <option value="">Selecione…</option>
              {ofertas.map((p) => (
                <option key={p.id} value={p.id}>{produtoLabel(p)}</option>
              ))}
            </select>
          </label>
          <Input
            label="Título da oferta (opcional)"
            value={form.titulo}
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            placeholder="Aproveite: pilhas com desconto"
          />
          <Input
            label="Preço especial (R$)"
            value={form.precoEspecial}
            onChange={(e) => setForm((f) => ({ ...f, precoEspecial: e.target.value }))}
            placeholder="Deixe vazio para usar o preço normal"
          />
        </div>
        <div className="input-wrap">
          <label className="input-label">Descrição (opcional)</label>
          <textarea
            className="input-el loja-online-textarea"
            rows={2}
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            placeholder="Texto curto que aparece no checkout, no estilo Hotmart."
          />
        </div>
        {error && <p className="loja-online-field-error">{error}</p>}
        <Button type="submit" disabled={saving} leftIcon={<Plus size={16} />}>
          {saving ? 'Salvando…' : 'Adicionar order bump'}
        </Button>
      </form>

      {loading ? (
        <p className="loja-online-hint">Carregando order bumps…</p>
      ) : bumps.length === 0 ? (
        <p className="loja-online-hint">Nenhum order bump cadastrado.</p>
      ) : (
        <div className="loja-cupons-list">
          {bumps.map((b) => (
            <div key={b.id} className="loja-cupons-item">
              <div>
                <strong>{b.produto?.nome ?? 'Produto'}</strong>
                <span className="loja-cupons-item-meta">
                  {b.tipo === 'fixo' ? 'Fixo · todos os checkouts' : `Quando o carrinho tiver: ${b.trigger_produto?.nome ?? 'produto'}`}
                  {b.preco_especial != null ? ` · oferta ${formatCurrency(b.preco_especial)}` : ''}
                  {b.ativo !== 1 ? ' · pausado' : ''}
                </span>
              </div>
              <div className="loja-orderbumps-item-actions">
                <button type="button" className="loja-store-link-btn" onClick={() => handleToggle(b)}>
                  {b.ativo === 1 ? 'Pausar' : 'Ativar'}
                </button>
                <button type="button" className="loja-online-banner-remove" onClick={() => handleDelete(b.id)} aria-label="Excluir">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
