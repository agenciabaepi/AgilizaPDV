import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  DollarSign,
  Eye,
  Globe2,
  Link2,
  Megaphone,
  Monitor,
  Percent,
  RefreshCw,
  Search,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Unlink,
  Users,
  XCircle,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { DashboardKpiCard } from '../components/dashboard/DashboardKpiCard'
import { Button, Card, CardBody, CardHeader, useToast } from '../components/ui'
import {
  loadLojaOnlineDashboardData,
  type LojaOnlineDashboardData,
} from '../lib/loja-online-dashboard-data'
import {
  DASHBOARD_CHART_COLORS,
  DASHBOARD_PERIODOS,
  formatCurrency,
  type DashboardPeriodo,
} from '../lib/dashboard-utils'
import type { LojaOnlineStoreConfig } from '../lib/loja-online-types'
import {
  metaAuthStart,
  metaDisconnect,
  metaSelectAccount,
  metaStatus,
  type MetaAdAccountOption,
} from '../lib/loja-online-meta-api'

type Props = {
  empresaId: string
  config: LojaOnlineStoreConfig | null
}

const PIE_COLORS = [
  DASHBOARD_CHART_COLORS.primary,
  DASHBOARD_CHART_COLORS.success,
  DASHBOARD_CHART_COLORS.info,
  DASHBOARD_CHART_COLORS.warning,
  DASHBOARD_CHART_COLORS.purple,
  DASHBOARD_CHART_COLORS.pink,
]

function SimpleTooltip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean
  payload?: { value: number; name: string }[]
  label?: string
  money?: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="dashboard-chart-tooltip">
      <div className="dashboard-chart-tooltip__label">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="dashboard-chart-tooltip__row">
          <span>{p.name}</span>
          <strong>{money ? formatCurrency(p.value) : p.value}</strong>
        </div>
      ))}
    </div>
  )
}

export function LojaOnlineDashboard({ empresaId, config }: Props) {
  const { addToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [periodo, setPeriodo] = useState<DashboardPeriodo>('semana')
  const [data, setData] = useState<LojaOnlineDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metaBusy, setMetaBusy] = useState(false)
  const [metaAccounts, setMetaAccounts] = useState<MetaAdAccountOption[]>([])
  const [metaConfigured, setMetaConfigured] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState('')

  const load = useCallback(() => {
    if (!empresaId) return
    setLoading(true)
    setError(null)
    loadLojaOnlineDashboardData(empresaId, periodo, config)
      .then(setData)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Erro ao carregar dashboard.')
        setData(null)
      })
      .finally(() => setLoading(false))
  }, [empresaId, periodo, config])

  const refreshMetaStatus = useCallback(async () => {
    try {
      const st = await metaStatus(empresaId)
      setMetaConfigured(st.configured)
      setMetaAccounts(st.accounts)
      setSelectedAccount(st.adAccountId || st.accounts[0]?.id || '')
    } catch {
      /* ignore */
    }
  }, [empresaId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    void refreshMetaStatus()
  }, [refreshMetaStatus])

  useEffect(() => {
    const meta = searchParams.get('meta')
    if (!meta) return
    const msg = searchParams.get('meta_msg')
    if (meta === 'ok') {
      addToast('success', 'Meta Ads conectado com sucesso.')
      void refreshMetaStatus().then(() => load())
    } else if (meta === 'error') {
      addToast('error', msg || 'Falha ao conectar Meta Ads.')
    }
    const next = new URLSearchParams(searchParams)
    next.delete('meta')
    next.delete('meta_msg')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, addToast, refreshMetaStatus, load])

  const connectMeta = async () => {
    setMetaBusy(true)
    try {
      const { url } = await metaAuthStart(empresaId)
      window.location.href = url
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Falha ao conectar Meta.')
      setMetaBusy(false)
    }
  }

  const disconnectMeta = async () => {
    setMetaBusy(true)
    try {
      await metaDisconnect(empresaId)
      addToast('success', 'Meta Ads desconectado.')
      await refreshMetaStatus()
      load()
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Falha ao desconectar.')
    } finally {
      setMetaBusy(false)
    }
  }

  const saveAccount = async () => {
    if (!selectedAccount) return
    setMetaBusy(true)
    try {
      await metaSelectAccount(empresaId, selectedAccount)
      addToast('success', 'Conta de anúncios selecionada.')
      load()
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Falha ao salvar conta.')
    } finally {
      setMetaBusy(false)
    }
  }

  const kpis = data?.kpis
  const meta = data?.meta

  return (
    <div className="loja-online-dashboard">
      <header className="dashboard-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="dashboard-header__title" style={{ fontSize: '1.35rem' }}>
            Dashboard da loja
          </h2>
          <p className="dashboard-header__subtitle">Acessos, vendas, SEO e Meta Ads</p>
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
          label="Visitas"
          value={kpis ? String(kpis.visitas) : '—'}
          hint={kpis ? `${kpis.sessoes} sessões` : undefined}
          icon={<Eye size={22} strokeWidth={1.8} />}
          variant="info"
        />
        <DashboardKpiCard
          label="Pedidos"
          value={kpis ? String(kpis.pedidos) : '—'}
          hint={kpis && kpis.pendentes > 0 ? `${kpis.pendentes} pendentes` : 'No período'}
          icon={<ShoppingBag size={22} strokeWidth={1.8} />}
          variant="primary"
        />
        <DashboardKpiCard
          label="Receita"
          value={kpis ? formatCurrency(kpis.receita) : '—'}
          hint={kpis ? `Ticket ${formatCurrency(kpis.ticketMedio)}` : undefined}
          icon={<DollarSign size={22} strokeWidth={1.8} />}
          variant="success"
        />
        <DashboardKpiCard
          label="Conversão"
          value={kpis ? `${kpis.conversao.toFixed(1)}%` : '—'}
          hint="Pedidos / sessões"
          icon={<Percent size={22} strokeWidth={1.8} />}
          variant="warning"
        />
      </section>

      {/* Meta Ads connection */}
      <div style={{ marginTop: 16 }}>
      <Card className="page-card config-loja-card loja-online-grid-full">
        <CardHeader>
          <span>
            <Megaphone size={20} /> Meta Ads
          </span>
        </CardHeader>
        <CardBody className="loja-online-card-body">
          {!metaConfigured && (
            <p className="loja-online-hint">
              Configure <code>META_APP_ID</code> e <code>META_APP_SECRET</code> no servidor para habilitar o OAuth.
              Redirect URI: <code>https://agilizapdv.app/api/loja-online/meta-callback</code>
            </p>
          )}
          {!data?.metaConnected ? (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <p className="loja-online-hint" style={{ margin: 0, flex: 1 }}>
                Conecte o Gerenciador de Anúncios para ver campanhas, demografia (idade/sexo) e compras atribuídas ao
                Pixel.
              </p>
              <Button variant="primary" size="sm" onClick={connectMeta} disabled={metaBusy || !metaConfigured}>
                <Link2 size={16} /> Conectar Meta Ads
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="loja-online-hint" style={{ margin: 0 }}>
                Conta conectada
                {data.metaNeedsAccount ? ' — selecione uma Ad Account' : ''}
              </span>
              {metaAccounts.length > 0 && (
                <>
                  <select
                    className="input-el"
                    style={{ maxWidth: 280 }}
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                  >
                    {metaAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.account_id})
                      </option>
                    ))}
                  </select>
                  <Button variant="secondary" size="sm" onClick={saveAccount} disabled={metaBusy || !selectedAccount}>
                    Usar esta conta
                  </Button>
                </>
              )}
              <Button variant="secondary" size="sm" onClick={disconnectMeta} disabled={metaBusy}>
                <Unlink size={16} /> Desconectar
              </Button>
              <a
                href="https://business.facebook.com/adsmanager"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--secondary btn--sm"
              >
                Abrir Ads Manager
              </a>
            </div>
          )}
          {data?.metaError && (
            <p className="loja-online-hint" style={{ color: 'var(--color-danger)', marginTop: 8 }}>
              {data.metaError}
            </p>
          )}
        </CardBody>
      </Card>
      </div>

      {/* Charts row */}
      <div className="dashboard-charts" style={{ marginTop: 16 }}>
        <Card className="page-card">
          <CardHeader>
            <span>
              <TrendingUp size={18} /> Visitas e pedidos
            </span>
          </CardHeader>
          <CardBody>
            <div style={{ width: '100%', height: 260 }}>
              {(data?.visitasPorDia.some((d) => d.visitas > 0 || d.pedidos > 0) ?? false) ? (
                <ResponsiveContainer>
                  <AreaChart data={data?.visitasPorDia ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<SimpleTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="visitas"
                      name="Visitas"
                      stroke={DASHBOARD_CHART_COLORS.info}
                      fill={DASHBOARD_CHART_COLORS.primarySoft}
                    />
                    <Area
                      type="monotone"
                      dataKey="pedidos"
                      name="Pedidos"
                      stroke={DASHBOARD_CHART_COLORS.success}
                      fill={DASHBOARD_CHART_COLORS.successSoft}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="loja-online-hint">Sem dados de acesso no período. O tracking começa após publicar a migration e visitar a loja.</p>
              )}
            </div>
          </CardBody>
        </Card>

        <Card className="page-card">
          <CardHeader>
            <span>
              <Monitor size={18} /> Dispositivos
            </span>
          </CardHeader>
          <CardBody>
            <div style={{ width: '100%', height: 260 }}>
              {(data?.devices.length ?? 0) > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={data?.devices ?? []}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {(data?.devices ?? []).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="loja-online-hint">Aguardando visitas…</p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="dashboard-charts" style={{ marginTop: 16 }}>
        <Card className="page-card">
          <CardHeader>
            <span>
              <Globe2 size={18} /> Regiões
            </span>
          </CardHeader>
          <CardBody>
            <div style={{ width: '100%', height: 260 }}>
              {(data?.regions.length ?? 0) > 0 ? (
                <ResponsiveContainer>
                  <BarChart data={(data?.regions ?? []).slice(0, 8)} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                    <Tooltip content={<SimpleTooltip />} />
                    <Bar dataKey="value" name="Acessos" fill={DASHBOARD_CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="loja-online-hint">Regiões aparecem com visitas (geo do servidor) ou CEPs dos pedidos.</p>
              )}
            </div>
          </CardBody>
        </Card>

        <Card className="page-card">
          <CardHeader>
            <span>
              <ShoppingBag size={18} /> Produtos mais vendidos
            </span>
          </CardHeader>
          <CardBody>
            <div style={{ width: '100%', height: 260 }}>
              {(data?.topProdutos.length ?? 0) > 0 ? (
                <ResponsiveContainer>
                  <BarChart
                    data={(data?.topProdutos ?? []).map((p) => ({
                      name: p.nome.length > 18 ? `${p.nome.slice(0, 18)}…` : p.nome,
                      receita: p.receita,
                      quantidade: p.quantidade,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<SimpleTooltip money />} />
                    <Bar dataKey="receita" name="Receita" fill={DASHBOARD_CHART_COLORS.success} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="loja-online-hint">Nenhuma venda no período.</p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="dashboard-charts" style={{ marginTop: 16 }}>
        <Card className="page-card">
          <CardHeader>
            <span>
              <BarChart3 size={18} /> Páginas mais acessadas
            </span>
          </CardHeader>
          <CardBody>
            {(data?.topPages.length ?? 0) > 0 ? (
              <ul className="loja-online-dash-list">
                {data!.topPages.map((p) => (
                  <li key={p.path}>
                    <code>{p.path}</code>
                    <strong>{p.views}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="loja-online-hint">Sem page views no período.</p>
            )}
          </CardBody>
        </Card>

        <Card className="page-card">
          <CardHeader>
            <span>
              <Search size={18} /> Saúde SEO
            </span>
          </CardHeader>
          <CardBody>
            <ul className="loja-online-dash-seo">
              {(data?.seo ?? []).map((item) => (
                <li key={item.id} className={item.ok ? 'is-ok' : 'is-warn'}>
                  {item.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  <div>
                    <strong>{item.label}</strong>
                    {item.hint && <span>{item.hint}</span>}
                  </div>
                </li>
              ))}
            </ul>
            <Link to="/loja-online/seo" className="btn btn--secondary btn--sm" style={{ marginTop: 12 }}>
              Configurar SEO e Pixel
            </Link>
          </CardBody>
        </Card>
      </div>

      {/* Meta insights */}
      {meta && (
        <>
          <section className="dashboard-kpis" style={{ marginTop: 16 }}>
            <DashboardKpiCard
              label="Investimento ads"
              value={formatCurrency(meta.spend)}
              hint={`${meta.impressions.toLocaleString('pt-BR')} impressões`}
              icon={<DollarSign size={22} strokeWidth={1.8} />}
              variant="warning"
            />
            <DashboardKpiCard
              label="Cliques"
              value={String(meta.clicks)}
              hint={`CTR ${meta.ctr.toFixed(2)}%`}
              icon={<Users size={22} strokeWidth={1.8} />}
              variant="info"
            />
            <DashboardKpiCard
              label="Compras (Pixel)"
              value={String(meta.purchases)}
              hint={formatCurrency(meta.purchase_value)}
              icon={<ShoppingBag size={22} strokeWidth={1.8} />}
              variant="success"
            />
            <DashboardKpiCard
              label="ROAS"
              value={`${meta.roas.toFixed(2)}x`}
              hint="Receita ads / investimento"
              icon={<TrendingUp size={22} strokeWidth={1.8} />}
              variant="primary"
            />
          </section>

          <div className="dashboard-charts" style={{ marginTop: 16 }}>
            <Card className="page-card">
              <CardHeader>
                <span>
                  <Smartphone size={18} /> Idade (impressões)
                </span>
              </CardHeader>
              <CardBody>
                <div style={{ width: '100%', height: 240 }}>
                  {meta.age.length > 0 ? (
                    <ResponsiveContainer>
                      <BarChart data={meta.age}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<SimpleTooltip />} />
                        <Bar dataKey="value" name="Impressões" fill={DASHBOARD_CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="loja-online-hint">Sem breakdown de idade no período.</p>
                  )}
                </div>
              </CardBody>
            </Card>

            <Card className="page-card">
              <CardHeader>
                <span>
                  <Users size={18} /> Sexo (impressões)
                </span>
              </CardHeader>
              <CardBody>
                <div style={{ width: '100%', height: 240 }}>
                  {meta.gender.length > 0 ? (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={meta.gender}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        >
                          {meta.gender.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="loja-online-hint">Sem breakdown de sexo no período.</p>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>

          {(meta.campaigns.length > 0) && (
            <div style={{ marginTop: 16 }}>
            <Card className="page-card config-loja-card loja-online-grid-full">
              <CardHeader>
                <span>
                  <Megaphone size={18} /> Campanhas
                </span>
              </CardHeader>
              <CardBody>
                <div className="loja-online-table-wrap">
                  <table className="loja-online-table">
                    <thead>
                      <tr>
                        <th>Campanha</th>
                        <th>Gasto</th>
                        <th>Impressões</th>
                        <th>Cliques</th>
                        <th>CTR</th>
                        <th>Compras</th>
                        <th>ROAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meta.campaigns.map((c) => (
                        <tr key={c.campaign_id || c.campaign_name}>
                          <td>{c.campaign_name}</td>
                          <td>{formatCurrency(c.spend)}</td>
                          <td>{c.impressions.toLocaleString('pt-BR')}</td>
                          <td>{c.clicks.toLocaleString('pt-BR')}</td>
                          <td>{c.ctr.toFixed(2)}%</td>
                          <td>{c.purchases}</td>
                          <td>{c.roas.toFixed(2)}x</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
