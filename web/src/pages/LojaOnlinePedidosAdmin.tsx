import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Package, ShoppingBag } from 'lucide-react'
import { Card, CardBody, CardHeader, Input } from '../components/ui'
import { LojaOnlinePedidoStatusSelect } from '../components/loja-online/LojaOnlinePedidoStatusSelect'
import { sincronizarPagamentosLojaOnline } from '../lib/loja-online-pagamentos-api'
import {
  fetchLojaOnlinePedidoItens,
  fetchLojaOnlinePedidosAdmin,
  notifyLojaOnlinePedidosUpdated,
  updateLojaOnlinePedidoStatus,
  updateLojaOnlinePedidoRastreio,
} from '../lib/loja-online-api'
import {
  LOJA_ONLINE_PEDIDO_STATUSES,
  PEDIDO_STATUS_LABEL,
  pedidoAdminStatusClass,
  pedidoPrecisaAcaoAdmin,
  type LojaOnlinePedidoStatus,
} from '../lib/loja-online-pedido-status'
import {
  PEDIDOS_PERIODOS,
  filterPedidosPorPeriodo,
  groupPedidosPorData,
  sumPedidosTotal,
  type PedidosPeriodo,
} from '../lib/loja-online-pedidos-utils'
import type { LojaOnlinePedido, LojaOnlinePedidoItem } from '../lib/loja-online-types'
import { formatCurrency } from '../lib/loja-online'

const STATUS_FILTER_OPTIONS: { value: 'todos' | LojaOnlinePedidoStatus; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  ...LOJA_ONLINE_PEDIDO_STATUSES.map((value) => ({
    value,
    label: PEDIDO_STATUS_LABEL[value],
  })),
]

export function LojaOnlinePedidosAdmin({ empresaId }: { empresaId: string }) {
  const [pedidos, setPedidos] = useState<LojaOnlinePedido[]>([])
  const [itensMap, setItensMap] = useState<Record<string, LojaOnlinePedidoItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState<PedidosPeriodo>('semana')
  const [statusFilter, setStatusFilter] = useState<'todos' | LojaOnlinePedidoStatus>('todos')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadPedidos = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const data = await fetchLojaOnlinePedidosAdmin(empresaId)
      setPedidos(data)
      setError('')
    } catch {
      setError('Erro ao carregar pedidos.')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    let cancelled = false

    void loadPedidos()

    sincronizarPagamentosLojaOnline({ empresaId })
      .catch(() => null)
      .then(async (result) => {
        if (cancelled) return
        if (result && (result.atualizados > 0 || (result.vendasGeradas ?? 0) > 0)) {
          await loadPedidos({ silent: true })
        }
        notifyLojaOnlinePedidosUpdated()
      })

    return () => {
      cancelled = true
    }
  }, [empresaId, loadPedidos])

  const filtered = useMemo(() => {
    let list = filterPedidosPorPeriodo(pedidos, periodo)
    if (statusFilter !== 'todos') list = list.filter((p) => p.status === statusFilter)
    return list
  }, [pedidos, periodo, statusFilter])

  const groups = useMemo(() => groupPedidosPorData(filtered), [filtered])

  const resumo = useMemo(() => {
    const pendentes = filtered.filter((p) => pedidoPrecisaAcaoAdmin(p)).length
    return {
      total: filtered.length,
      pendentes,
      valor: sumPedidosTotal(filtered),
    }
  }, [filtered])

  const toggleExpand = async (pedidoId: string) => {
    if (expanded === pedidoId) {
      setExpanded(null)
      return
    }
    setExpanded(pedidoId)
    if (!itensMap[pedidoId]) {
      const itens = await fetchLojaOnlinePedidoItens(pedidoId)
      setItensMap((m) => ({ ...m, [pedidoId]: itens }))
    }
  }

  const handleStatus = async (pedidoId: string, status: LojaOnlinePedidoStatus) => {
    setError('')
    setSavingId(pedidoId)
    try {
      await updateLojaOnlinePedidoStatus(pedidoId, status)
      setPedidos((prev) => prev.map((p) => (p.id === pedidoId ? { ...p, status } : p)))
      notifyLojaOnlinePedidosUpdated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar pedido.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <Card className="page-card loja-admin-pedidos-card">
      <CardHeader>
        <span>Pedidos online</span>
      </CardHeader>
      <CardBody className="loja-admin-pedidos-card-body">
        <div className="loja-admin-pedidos-toolbar">
          <div className="loja-admin-pedidos-periodos">
            {PEDIDOS_PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`loja-admin-pedidos-periodo${periodo === p.id ? ' is-active' : ''}`}
                onClick={() => setPeriodo(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="loja-admin-pedidos-filters">
            <label className="loja-admin-pedidos-filter-label">
              Status
              <select
                className="input-el loja-admin-pedido-status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                {STATUS_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="loja-admin-pedidos-resumo">
          <div className="loja-admin-pedidos-resumo-card">
            <ShoppingBag size={20} />
            <div>
              <span>Pedidos</span>
              <strong>{resumo.total}</strong>
            </div>
          </div>
          <div className="loja-admin-pedidos-resumo-card loja-admin-pedidos-resumo-card--warn">
            <Package size={20} />
            <div>
              <span>Aguardando ação</span>
              <strong>{resumo.pendentes}</strong>
            </div>
          </div>
          <div className="loja-admin-pedidos-resumo-card">
            <Calendar size={20} />
            <div>
              <span>Total no período</span>
              <strong>{formatCurrency(resumo.valor)}</strong>
            </div>
          </div>
        </div>

        {error && <p className="loja-online-field-error">{error}</p>}

        <div className="loja-admin-pedidos-list-scroll">
          {loading ? (
            <p className="loja-online-hint">Carregando pedidos…</p>
          ) : filtered.length === 0 ? (
            <p className="loja-online-hint">Nenhum pedido neste período.</p>
          ) : (
            <div className="loja-admin-pedidos-groups">
              {groups.map((group) => (
                <section key={group.key} className="loja-admin-pedidos-group">
                  <header className="loja-admin-pedidos-group-head">
                    <div>
                      <h3>{group.label}</h3>
                      <p>
                        {group.pedidos.length} pedido{group.pedidos.length !== 1 ? 's' : ''}
                        {group.pendentes > 0 && ` · ${group.pendentes} aguardando ação`}
                      </p>
                    </div>
                    <strong>{formatCurrency(group.total)}</strong>
                  </header>

                  <div className="loja-admin-pedidos">
                    {group.pedidos.map((p) => (
                      <article key={p.id} className="loja-admin-pedido">
                        <button type="button" className="loja-admin-pedido-head" onClick={() => toggleExpand(p.id)}>
                          <div className="loja-admin-pedido-head-main">
                            <strong>#{p.id.slice(0, 8).toUpperCase()}</strong>
                            <span>{p.cliente_nome ?? 'Cliente'}</span>
                            <span className={pedidoAdminStatusClass(p.status, p)}>
                              {PEDIDO_STATUS_LABEL[p.status]}
                            </span>
                          </div>
                          <div className="loja-admin-pedido-head-meta">
                            <span>{formatCurrency(p.total)}</span>
                            <span>
                              {new Date(p.created_at).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </button>
                        {expanded === p.id && (
                          <div className="loja-admin-pedido-body">
                            <p>Telefone: {p.cliente_telefone ?? '—'}</p>
                            <p>E-mail: {p.cliente_email ?? '—'}</p>
                            <p>Entrega: {p.forma_entrega === 'entrega' ? 'Delivery' : 'Retirada'}</p>
                            {p.endereco_entrega && <p>Endereço: {p.endereco_entrega}</p>}
                            {p.observacoes && <p>Obs: {p.observacoes}</p>}
                            {p.venda_id && (
                              <p className="loja-admin-pedido-venda-link">
                                Venda registrada:{' '}
                                <Link to="/vendas">ver em Vendas (online)</Link>
                              </p>
                            )}
                            <ul>
                              {(itensMap[p.id] ?? []).map((i) => (
                                <li key={i.id}>
                                  {i.quantidade}x {i.nome} — {formatCurrency(i.subtotal)}
                                </li>
                              ))}
                            </ul>
                            <LojaOnlinePedidoStatusSelect
                              value={p.status}
                              formaEntrega={p.forma_entrega}
                              disabled={savingId === p.id}
                              onChange={(status) => handleStatus(p.id, status)}
                            />
                            <Input
                              label="Código de rastreio"
                              value={p.codigo_rastreio ?? ''}
                              onChange={(e) =>
                                setPedidos((prev) =>
                                  prev.map((x) => (x.id === p.id ? { ...x, codigo_rastreio: e.target.value } : x))
                                )
                              }
                              onBlur={(e) => {
                                const v = e.target.value.trim()
                                if (v !== (p.codigo_rastreio ?? '')) {
                                  void updateLojaOnlinePedidoRastreio(p.id, v || null)
                                }
                              }}
                              placeholder="BR123456789BR"
                              hint="Exibido ao cliente na página do pedido"
                            />
                            {pedidoPrecisaAcaoAdmin(p) && !p.venda_id && (
                              <p className="loja-online-hint">
                                Ao avançar o status com pagamento confirmado, uma venda online é gerada automaticamente em Vendas.
                              </p>
                            )}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
