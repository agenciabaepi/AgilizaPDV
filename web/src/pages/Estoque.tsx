import { useState, useEffect, useCallback } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import type { ProdutoSaldo, EstoqueMovimento, TipoMovimento, Produto } from '../vite-env'
import {
  PageTitle,
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Select,
  Alert,
  useOperationToast,
} from '../components/ui'
import { Plus, Package } from 'lucide-react'

const TIPOS: { value: TipoMovimento; label: string }[] = [
  { value: 'ENTRADA', label: 'Entrada' },
  { value: 'SAIDA', label: 'Saída' },
  { value: 'AJUSTE', label: 'Ajuste' },
  { value: 'DEVOLUCAO', label: 'Devolução' }
]

/** API local/remota pode devolver números como string; evita quebra na tabela e no saldo exibido. */
function parseMovimentoRow(row: unknown): EstoqueMovimento | null {
  if (row == null || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const id = r.id
  const produto_id = r.produto_id
  const tipo = r.tipo
  const created_at = r.created_at
  if (typeof id !== 'string' || typeof produto_id !== 'string' || typeof tipo !== 'string' || typeof created_at !== 'string') {
    return null
  }
  const qRaw = r.quantidade
  const quantidade =
    typeof qRaw === 'number' && Number.isFinite(qRaw)
      ? qRaw
      : typeof qRaw === 'string' && Number.isFinite(Number(qRaw))
        ? Number(qRaw)
        : NaN
  if (!Number.isFinite(quantidade)) return null

  let custo_unitario: number | null = null
  const c = r.custo_unitario
  if (c != null && c !== '') {
    const n = typeof c === 'number' ? c : Number(c)
    if (Number.isFinite(n)) custo_unitario = n
  }

  return {
    id,
    empresa_id: typeof r.empresa_id === 'string' ? r.empresa_id : '',
    produto_id,
    tipo: tipo as TipoMovimento,
    quantidade,
    custo_unitario,
    referencia_tipo: r.referencia_tipo != null ? String(r.referencia_tipo) : null,
    referencia_id: r.referencia_id != null ? String(r.referencia_id) : null,
    usuario_id: r.usuario_id != null ? String(r.usuario_id) : null,
    created_at
  }
}

function normalizeMovimentosList(rows: unknown): EstoqueMovimento[] {
  if (!Array.isArray(rows)) return []
  const out: EstoqueMovimento[] = []
  for (const row of rows) {
    const m = parseMovimentoRow(row)
    if (m) out.push(m)
  }
  return out
}

export function Estoque() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const userId = session?.id ?? ''
  const op = useOperationToast()
  const [saldos, setSaldos] = useState<ProdutoSaldo[]>([])
  const [movimentos, setMovimentos] = useState<EstoqueMovimento[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtoFiltro, setProdutoFiltro] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    tipo: 'ENTRADA' as TipoMovimento,
    produto_id: '',
    quantidade: 0,
    custo_unitario: 0
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadSaldos = useCallback(() => {
    if (!empresaId) return
    window.electronAPI.estoque.listSaldos(empresaId).then(setSaldos)
  }, [empresaId])

  const loadMovimentos = useCallback(() => {
    if (!empresaId) return
    window.electronAPI.estoque
      .listMovimentos(empresaId, {
        produtoId: produtoFiltro || undefined,
        limit: 100
      })
      .then((rows) => setMovimentos(normalizeMovimentosList(rows)))
      .catch(() => setMovimentos([]))
  }, [empresaId, produtoFiltro])

  const loadProdutos = useCallback(() => {
    if (!empresaId) return
    window.electronAPI.produtos.list(empresaId, { apenasAtivos: true }).then(setProdutos)
  }, [empresaId])

  useEffect(() => {
    loadSaldos()
    loadMovimentos()
    loadProdutos()
  }, [loadSaldos, loadMovimentos, loadProdutos])

  const openNovoMovimento = () => {
    const comEstoque = produtos.filter((p) => p.controla_estoque === 1)
    setForm({
      tipo: 'ENTRADA',
      produto_id: comEstoque[0]?.id ?? '',
      quantidade: 0,
      custo_unitario: 0
    })
    setError('')
    setShowForm(true)
  }

  const submitMovimento = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.produto_id) {
      setError('Selecione o produto.')
      return
    }
    const qty = form.tipo === 'AJUSTE' ? form.quantidade : Math.abs(form.quantidade)
    if (qty === 0) {
      setError('Informe a quantidade.')
      return
    }
    setSaving(true)
    try {
      await window.electronAPI.estoque.registrarMovimento({
        empresa_id: empresaId,
        produto_id: form.produto_id,
        tipo: form.tipo,
        quantidade: form.tipo === 'AJUSTE' ? form.quantidade : qty,
        custo_unitario: form.custo_unitario || undefined,
        usuario_id: userId
      })
      op.saved('Movimento de estoque registrado com sucesso.')
      setShowForm(false)
      loadSaldos()
      loadMovimentos()
    } catch (err) {
      op.failed(err, 'Erro ao registrar movimento de estoque.')
      setError(err instanceof Error ? err.message : 'Erro ao registrar movimento.')
    } finally {
      setSaving(false)
    }
  }

  const quantidadeLabel = form.tipo === 'AJUSTE' ? 'Quantidade (+ ou -)' : 'Quantidade'
  const produtosComEstoque = produtos.filter((p) => p.controla_estoque === 1 && Boolean(p.id))

  return (
    <Layout>
      <PageTitle title="Estoque" subtitle="Saldos e movimentações" />

      <Card className="mb-section">
        <CardHeader style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Package size={22} />
          Saldos por produto
        </CardHeader>
        <CardBody>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16, fontSize: 'var(--text-sm)' }}>
            Apenas produtos com controle de estoque ativo.
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Unidade</th>
                  <th>Saldo</th>
                  <th>Mínimo</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {saldos.map((s) => (
                  <tr key={s.produto_id}>
                    <td>{s.nome}</td>
                    <td>{s.unidade}</td>
                    <td>{s.saldo}</td>
                    <td>{s.estoque_minimo}</td>
                    <td>
                      {s.saldo <= s.estoque_minimo ? (
                        <span style={{ color: 'var(--color-error)' }}>Abaixo do mínimo</span>
                      ) : (
                        <span style={{ color: 'var(--color-success)' }}>OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {saldos.length === 0 && (
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 16, fontSize: 'var(--text-sm)' }}>
              Nenhum produto com controle de estoque ou sem produtos ativos.
            </p>
          )}
        </CardBody>
      </Card>

      <Card className="mb-section">
        <CardHeader>Movimentos</CardHeader>
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <Button leftIcon={<Plus size={18} />} onClick={openNovoMovimento}>
              Novo movimento
            </Button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                Filtrar por produto:
              </label>
              <select
                className="input-select"
                value={produtoFiltro}
                onChange={(e) => setProdutoFiltro(e.currentTarget?.value ?? '')}
                style={{ minWidth: 180, width: '100%', maxWidth: 280, margin: 0 }}
              >
                <option value="">Todos</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {showForm && (
            <form
              onSubmit={submitMovimento}
              style={{ padding: 20, background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', marginBottom: 16, flexShrink: 0 }}
            >
              <h4 style={{ marginTop: 0, marginBottom: 16 }}>Registrar movimento</h4>
              <div className="form-grid form-grid-2">
                <Select
                  label="Tipo"
                  value={form.tipo}
                  onChange={(e) => {
                    const v = e.currentTarget?.value
                    if (v == null) return
                    setForm((f) => ({ ...f, tipo: v as TipoMovimento }))
                  }}
                  options={TIPOS}
                />
                <Select
                  label="Produto"
                  required
                  value={form.produto_id}
                  onChange={(e) => {
                    const v = e.currentTarget?.value
                    if (v == null) return
                    setForm((f) => ({ ...f, produto_id: v }))
                  }}
                  options={produtosComEstoque.map((p) => ({ value: p.id, label: p.nome }))}
                  placeholder="Selecione"
                />
                <Input
                  label={quantidadeLabel}
                  type="number"
                  step="0.01"
                  value={form.quantidade || ''}
                  onChange={(e) => {
                    const el = e.currentTarget
                    if (!el) return
                    setForm((f) => ({ ...f, quantidade: Number(el.value) || 0 }))
                  }}
                  required
                />
                <Input
                  label="Custo unitário (R$) — opcional"
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.custo_unitario || ''}
                  onChange={(e) => {
                    const el = e.currentTarget
                    if (!el) return
                    setForm((f) => ({ ...f, custo_unitario: Number(el.value) || 0 }))
                  }}
                />
              </div>
              {error && <Alert variant="error" style={{ marginTop: 16 }}>{error}</Alert>}
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 20 }}>
                <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Registrar'}</Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          )}

          <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ marginBottom: 12, marginTop: 0 }}>Últimos movimentos</h4>
            <div className="table-wrap estoque-movimentos-wrap" style={{ flex: '1 1 auto', minHeight: 120 }}>
            <table className="estoque-movimentos-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Produto</th>
                  <th>Tipo</th>
                  <th>Quantidade</th>
                  <th>Custo un.</th>
                </tr>
              </thead>
              <tbody>
                {movimentos.map((m) => {
                  const produto = produtos.find((p) => p.id === m.produto_id)
                  const qtyDisplay = m.tipo === 'SAIDA' ? -m.quantidade : m.quantidade
                  return (
                    <tr key={m.id}>
                      <td>{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                      <td>{produto?.nome ?? m.produto_id}</td>
                      <td>{m.tipo}</td>
                      <td>{qtyDisplay}</td>
                      <td>
                        {m.custo_unitario != null && Number.isFinite(Number(m.custo_unitario))
                          ? Number(m.custo_unitario).toFixed(2)
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
          {movimentos.length === 0 && (
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 16, fontSize: 'var(--text-sm)' }}>Nenhum movimento registrado.</p>
          )}
        </CardBody>
      </Card>
    </Layout>
  )
}
