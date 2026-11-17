import { useCallback, useEffect, useMemo, useState } from 'react'
import { RotateCcw, Search } from 'lucide-react'
import { Alert, Button, Dialog, Input } from './ui'
import { formatCurrency } from '../lib/dashboard-utils'
import type { DevolucaoPreview, VendaComNfce } from '../vite-env'

type Props = {
  open: boolean
  onClose: () => void
  empresaId: string
  usuarioId: string
  caixaAberto: boolean
  vendasHoje: VendaComNfce[]
  initialVendaId?: string | null
  onSuccess?: (result: { vendaNumero: number; movimentos: number; valor: number; sangria: boolean }) => void
}

function formatQty(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

export function PdvDevolucaoDialog({
  open,
  onClose,
  empresaId,
  usuarioId,
  caixaAberto,
  vendasHoje,
  initialVendaId = null,
  onSuccess,
}: Props) {
  const [buscaNumero, setBuscaNumero] = useState('')
  const [preview, setPreview] = useState<DevolucaoPreview | null>(null)
  const [qtys, setQtys] = useState<Record<string, string>>({})
  const [estornarCaixa, setEstornarCaixa] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const reset = useCallback(() => {
    setBuscaNumero('')
    setPreview(null)
    setQtys({})
    setEstornarCaixa(true)
    setErro(null)
    setLoading(false)
    setSaving(false)
  }, [])

  const carregarVenda = useCallback(async (vendaId: string) => {
    setLoading(true)
    setErro(null)
    try {
      const data = await window.electronAPI.vendas.previewDevolucao(vendaId)
      if (data.status !== 'CONCLUIDA') {
        throw new Error('Só é possível devolver vendas concluídas.')
      }
      setPreview(data)
      const initial: Record<string, string> = {}
      for (const item of data.itens) {
        initial[item.produto_id] = item.quantidade_disponivel > 0 ? String(item.quantidade_disponivel) : '0'
      }
      setQtys(initial)
    } catch (err) {
      setPreview(null)
      setQtys({})
      setErro(err instanceof Error ? err.message : 'Erro ao carregar venda.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    if (initialVendaId) {
      void carregarVenda(initialVendaId)
    }
  }, [open, initialVendaId, reset, carregarVenda])

  const vendasConcluidas = useMemo(
    () =>
      [...vendasHoje]
        .filter((v) => v.status === 'CONCLUIDA')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [vendasHoje]
  )

  const buscarPorNumero = async () => {
    const term = buscaNumero.trim()
    if (!term) {
      setErro('Informe o número da venda.')
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const digits = term.replace(/\D/g, '')
      let found = vendasConcluidas.find(
        (v) => String(v.numero) === term || (digits && String(v.numero) === digits)
      )
      if (!found) {
        const list = await window.electronAPI.vendas.list(empresaId, { limit: 300, periodo: 'mes' })
        found = list.find(
          (v) =>
            v.status === 'CONCLUIDA' &&
            (String(v.numero) === term || (digits && String(v.numero) === digits))
        )
      }
      if (!found) throw new Error('Venda não encontrada.')
      await carregarVenda(found.id)
    } catch (err) {
      setPreview(null)
      setErro(err instanceof Error ? err.message : 'Erro ao buscar venda.')
      setLoading(false)
    }
  }

  const valorSelecionado = useMemo(() => {
    if (!preview) return 0
    let total = 0
    for (const item of preview.itens) {
      const qty = Number(String(qtys[item.produto_id] ?? '0').replace(',', '.')) || 0
      if (qty > 0) total += qty * item.preco_unitario_liquido
    }
    return Math.round((total + Number.EPSILON) * 100) / 100
  }, [preview, qtys])

  const qtdSelecionada = useMemo(() => {
    if (!preview) return 0
    return preview.itens.reduce((acc, item) => {
      const qty = Number(String(qtys[item.produto_id] ?? '0').replace(',', '.')) || 0
      return acc + (qty > 0 ? qty : 0)
    }, 0)
  }, [preview, qtys])

  const confirmar = async () => {
    if (!preview) return
    setSaving(true)
    setErro(null)
    try {
      const itens = preview.itens
        .map((item) => ({
          produto_id: item.produto_id,
          quantidade: Number(String(qtys[item.produto_id] ?? '0').replace(',', '.')) || 0,
        }))
        .filter((i) => i.quantidade > 0)

      const result = await window.electronAPI.vendas.devolver({
        empresa_id: empresaId,
        venda_id: preview.venda_id,
        usuario_id: usuarioId,
        itens,
        estornar_caixa: estornarCaixa && caixaAberto,
      })

      onSuccess?.({
        vendaNumero: preview.venda_numero,
        movimentos: result.movimentos,
        valor: result.valor_estornado,
        sangria: result.sangria_registrada,
      })
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar devolução.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      className="pdv-dialog"
      open={open}
      onClose={() => !saving && onClose()}
      title="Devolução de mercadoria"
      size="large"
      showCloseButton={!saving}
      footer={
        preview ? (
          <>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void confirmar()}
              disabled={saving || qtdSelecionada <= 0}
              leftIcon={<RotateCcw size={16} />}
            >
              {saving ? 'Registrando...' : `Confirmar devolução · ${formatCurrency(valorSelecionado)}`}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="pdv-devolucao">
        {!preview ? (
          <>
            <p className="input-hint" style={{ marginBottom: 12 }}>
              Busque a venda pelo número ou escolha uma venda de hoje para devolver itens ao estoque.
            </p>
            <div className="pdv-devolucao-busca">
              <div className="pdv-search-wrap">
                <Search size={16} className="pdv-search-icon" />
                <input
                  type="text"
                  className="input-el pdv-search"
                  placeholder="Número da venda..."
                  value={buscaNumero}
                  onChange={(e) => setBuscaNumero(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void buscarPorNumero()
                  }}
                  autoFocus
                />
              </div>
              <Button type="button" onClick={() => void buscarPorNumero()} disabled={loading}>
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>

            {vendasConcluidas.length > 0 && (
              <div className="pdv-devolucao-hoje">
                <h4>Vendas de hoje</h4>
                <ul className="pdv-vendas-dia-lista">
                  {vendasConcluidas.slice(0, 12).map((v) => (
                    <li key={v.id} className="pdv-vendas-dia-item">
                      <div className="pdv-vendas-dia-info">
                        <div className="pdv-vendas-dia-top">
                          <strong>Venda #{v.numero}</strong>
                          <span className="pdv-vendas-dia-total">{formatCurrency(v.total)}</span>
                        </div>
                        <span>
                          {new Date(v.created_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void carregarVenda(v.id)}
                        disabled={loading}
                      >
                        Devolver
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="pdv-devolucao-resumo">
              <div>
                <strong>Venda #{preview.venda_numero}</strong>
                <span>
                  {new Date(preview.created_at).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div>
                <span>Total da venda</span>
                <strong>{formatCurrency(preview.total_venda)}</strong>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={saving}>
                Trocar venda
              </Button>
            </div>

            <div className="fluxo-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th style={{ textAlign: 'right' }}>Vendido</th>
                    <th style={{ textAlign: 'right' }}>Já devolvido</th>
                    <th style={{ textAlign: 'right' }}>Disponível</th>
                    <th style={{ textAlign: 'right' }}>Devolver</th>
                    <th style={{ textAlign: 'right' }}>Valor un.</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.itens.map((item) => {
                    const disabled = item.quantidade_disponivel <= 0
                    return (
                      <tr key={item.produto_id} className={disabled ? 'pdv-devolucao-row--disabled' : ''}>
                        <td>
                          <div className="estoque-mov-produto">
                            <strong>{item.descricao}</strong>
                            {!item.controla_estoque ? (
                              <span>Sem controle de estoque</span>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>{formatQty(item.quantidade_vendida)}</td>
                        <td style={{ textAlign: 'right' }}>{formatQty(item.quantidade_ja_devolvida)}</td>
                        <td style={{ textAlign: 'right' }}>{formatQty(item.quantidade_disponivel)}</td>
                        <td style={{ textAlign: 'right', minWidth: 110 }}>
                          <Input
                            type="number"
                            min={0}
                            max={item.quantidade_disponivel}
                            step="0.001"
                            value={qtys[item.produto_id] ?? '0'}
                            disabled={disabled || saving}
                            onChange={(e) => {
                              const raw = e.currentTarget.value
                              setQtys((prev) => ({ ...prev, [item.produto_id]: raw }))
                            }}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(item.preco_unitario_liquido)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="pdv-devolucao-footer-opts">
              <label className="pdv-devolucao-check">
                <input
                  type="checkbox"
                  checked={estornarCaixa && caixaAberto}
                  disabled={!caixaAberto || saving}
                  onChange={(e) => setEstornarCaixa(e.target.checked)}
                />
                <span>
                  Estornar valor no caixa (sangria)
                  {!caixaAberto ? ' — caixa fechado' : ` · ${formatCurrency(valorSelecionado)}`}
                </span>
              </label>
              <p className="input-hint">
                Itens com controle de estoque voltam como movimento <strong>DEVOLUÇÃO</strong>,
                vinculados à venda.
              </p>
            </div>
          </>
        )}

        {erro && (
          <Alert variant="error" style={{ marginTop: 12 }}>
            {erro}
          </Alert>
        )}
      </div>
    </Dialog>
  )
}
