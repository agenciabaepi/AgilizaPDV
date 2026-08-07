import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  DollarSign,
  Globe,
  Package,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react'
import { Layout } from '../components/Layout'
import { DashboardCharts } from '../components/dashboard/DashboardCharts'
import { DashboardKpiCard } from '../components/dashboard/DashboardKpiCard'
import { Button, Card, CardBody, CardHeader } from '../components/ui'
import { loadDashboardData, type DashboardData } from '../lib/dashboard-data'
import { DASHBOARD_PERIODOS, formatCurrency, type DashboardPeriodo } from '../lib/dashboard-utils'
import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../hooks/useSubscription'
import { useSyncDataRefresh } from '../hooks/useSyncDataRefresh'

export function Dashboard() {
  const { session } = useAuth()
  const { status } = useSubscription()
  const syncRefreshKey = useSyncDataRefresh()
  const empresaId = session?.empresa_id ?? ''
  const nome = session && 'nome' in session ? session.nome : ''

  const [periodo, setPeriodo] = useState<DashboardPeriodo>('semana')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const comLojaOnline = status?.lojaOnline === true

  const load = useCallback(() => {
    if (!empresaId) return
    setLoading(true)
    setError(null)
    loadDashboardData(empresaId, periodo, comLojaOnline)
      .then(setData)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Erro ao carregar dashboard.')
        setData(null)
      })
      .finally(() => setLoading(false))
  }, [empresaId, periodo, comLojaOnline, syncRefreshKey])

  useEffect(() => {
    load()
  }, [load])

  if (!empresaId) {
    return (
      <Layout>
        <div className="dashboard-page">
          <p style={{ color: 'var(--color-text-secondary)' }}>Sessão inválida.</p>
        </div>
      </Layout>
    )
  }

  const kpis = data?.kpis
  const loja = data?.lojaOnline

  return (
    <Layout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1 className="dashboard-header__title">Olá, {nome || 'bem-vindo'} 👋</h1>
            <p className="dashboard-header__subtitle">Visão geral do seu negócio em tempo real</p>
          </div>
          <div className="dashboard-header__actions">
            <div className="dashboard-periodos">
              <Calendar size={18} />
              {DASHBOARD_PERIODOS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`btn btn--secondary btn--sm ${periodo === p.id ? 'dashboard-periodo-ativo' : ''}`}
                  onClick={() => setPeriodo(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'dashboard-spin' : ''} />
              Atualizar
            </Button>
          </div>
        </header>

        {error && (
          <div className="dashboard-alert dashboard-alert--error">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        <section className="dashboard-kpis">
          <DashboardKpiCard
            label="Receita"
            value={kpis ? formatCurrency(kpis.receita) : '—'}
            hint="Vendas concluídas no período"
            icon={<DollarSign size={22} strokeWidth={1.8} />}
            variant="success"
          />
          <DashboardKpiCard
            label="Vendas"
            value={kpis ? String(kpis.totalVendas) : '—'}
            hint={kpis ? `Ticket médio ${formatCurrency(kpis.ticketMedio)}` : undefined}
            icon={<Receipt size={22} strokeWidth={1.8} />}
            variant="primary"
          />
          <DashboardKpiCard
            label="PDV"
            value={kpis ? String(kpis.vendasPdv) : '—'}
            hint={kpis ? formatCurrency(kpis.receitaPdv) : undefined}
            icon={<Store size={22} strokeWidth={1.8} />}
            variant="info"
          />
          {comLojaOnline ? (
            <DashboardKpiCard
              label="Online"
              value={kpis ? String(kpis.vendasOnline) : '—'}
              hint={kpis ? formatCurrency(kpis.receitaOnline) : undefined}
              icon={<ShoppingBag size={22} strokeWidth={1.8} />}
              variant="success"
            />
          ) : (
            <DashboardKpiCard
              label="Caixa"
              value={kpis?.caixaAberto ? formatCurrency(kpis.saldoCaixa ?? 0) : 'Fechado'}
              hint={kpis?.caixaAberto ? 'Saldo do caixa aberto' : 'Nenhum caixa aberto'}
              icon={<Wallet size={22} strokeWidth={1.8} />}
              variant={kpis?.caixaAberto ? 'warning' : 'neutral'}
            />
          )}
          <DashboardKpiCard
            label="Estoque baixo"
            value={kpis ? String(kpis.estoqueBaixo) : '—'}
            hint="Produtos abaixo do mínimo"
            icon={<Package size={22} strokeWidth={1.8} />}
            variant={kpis && kpis.estoqueBaixo > 0 ? 'danger' : 'neutral'}
          />
          <DashboardKpiCard
            label="Canceladas"
            value={kpis ? String(kpis.canceladas) : '—'}
            icon={<XCircle size={22} strokeWidth={1.8} />}
            variant="neutral"
          />
        </section>

        {comLojaOnline && loja && (
          <section className="dashboard-section">
            <div className="dashboard-section__head">
              <div className="dashboard-section__title-wrap">
                <Globe size={20} />
                <div>
                  <h2 className="dashboard-section__title">Loja online</h2>
                  <p className="dashboard-section__subtitle">Tráfego, pedidos e conversão do e-commerce</p>
                </div>
              </div>
              <Link to="/loja-online" className="dashboard-link">
                Gerenciar loja <ArrowRight size={16} />
              </Link>
            </div>
            <div className="dashboard-kpis dashboard-kpis--compact">
              <DashboardKpiCard
                label="Pedidos"
                value={String(loja.pedidos)}
                hint={`${loja.pendentes} pendentes · ${loja.confirmados} confirmados`}
                icon={<ShoppingBag size={20} strokeWidth={1.8} />}
                variant="primary"
              />
              <DashboardKpiCard
                label="Receita online"
                value={formatCurrency(loja.receita)}
                icon={<TrendingUp size={20} strokeWidth={1.8} />}
                variant="success"
              />
              <DashboardKpiCard
                label="Clientes cadastrados"
                value={String(loja.clientes)}
                hint="Compradores na loja virtual"
                icon={<Users size={20} strokeWidth={1.8} />}
                variant="info"
              />
              <DashboardKpiCard
                label="Produtos publicados"
                value={String(loja.produtosPublicados)}
                icon={<Package size={20} strokeWidth={1.8} />}
                variant="neutral"
              />
            </div>
          </section>
        )}

        {loading && !data ? (
          <div className="dashboard-loading">
            <RefreshCw size={28} className="dashboard-spin" />
            <span>Carregando métricas…</span>
          </div>
        ) : data ? (
          <>
            <DashboardCharts
              vendasPorDia={data.vendasPorDia}
              origemVendas={data.origemVendas}
              formasPagamento={data.formasPagamento}
              topProdutos={data.topProdutos}
              lojaAtividade={loja?.atividadePorDia}
              showLojaOnline={comLojaOnline}
            />

            <div className="dashboard-bottom">
              <Card className="dashboard-recent-card">
                <CardHeader>
                  <div className="dashboard-section__head" style={{ marginBottom: 0 }}>
                    <div>
                      <h3 className="dashboard-chart-title">Últimas vendas</h3>
                      <p className="dashboard-chart-subtitle">Transações mais recentes no período</p>
                    </div>
                    <Link to="/vendas" className="dashboard-link">
                      Ver todas <ArrowRight size={16} />
                    </Link>
                  </div>
                </CardHeader>
                <CardBody className="dashboard-recent-body">
                  {data.ultimasVendas.length === 0 ? (
                    <p className="dashboard-chart-empty">Nenhuma venda no período.</p>
                  ) : (
                    <div className="dashboard-recent-table-wrap">
                      <table className="table dashboard-recent-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Data</th>
                            <th>Origem</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.ultimasVendas.map((v) => (
                            <tr key={v.id}>
                              <td>{v.numero}</td>
                              <td>
                                {new Date(v.created_at).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td>
                                <span className={`dashboard-badge ${v.venda_online === 1 ? 'dashboard-badge--online' : 'dashboard-badge--pdv'}`}>
                                  {v.venda_online === 1 ? 'Online' : 'PDV'}
                                </span>
                              </td>
                              <td>
                                <span className={`dashboard-badge dashboard-badge--${v.status === 'CONCLUIDA' ? 'ok' : 'cancel'}`}>
                                  {v.status === 'CONCLUIDA' ? 'Concluída' : v.status === 'CANCELADA' ? 'Cancelada' : v.status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(v.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardBody>
              </Card>

              <div className="dashboard-quick-actions">
                <Card className="dashboard-action-card">
                  <CardBody>
                    <Store size={24} />
                    <h4>Abrir PDV</h4>
                    <p>Inicie uma nova venda no balcão</p>
                    <Link to="/pdv" className="btn btn--primary btn--sm">
                      Ir para PDV
                    </Link>
                  </CardBody>
                </Card>
                <Card className="dashboard-action-card">
                  <CardBody>
                    <Receipt size={24} />
                    <h4>Relatório de vendas</h4>
                    <p>Detalhes, cupons e cancelamentos</p>
                    <Link to="/vendas" className="btn btn--secondary btn--sm">
                      Ver vendas
                    </Link>
                  </CardBody>
                </Card>
                {kpis && kpis.estoqueBaixo > 0 && (
                  <Card className="dashboard-action-card dashboard-action-card--alert">
                    <CardBody>
                      <AlertTriangle size={24} />
                      <h4>Estoque crítico</h4>
                      <p>{kpis.estoqueBaixo} produto(s) abaixo do mínimo</p>
                      <Link to="/estoque" className="btn btn--secondary btn--sm">
                        Ver estoque
                      </Link>
                    </CardBody>
                  </Card>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  )
}
