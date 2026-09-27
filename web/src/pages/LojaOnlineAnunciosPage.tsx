import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Calendar,
  DollarSign,
  Link2,
  Megaphone,
  RefreshCw,
  Search,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Unlink,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  DASHBOARD_CHART_COLORS,
  DASHBOARD_PERIODOS,
  formatCurrency,
  getDashboardPeriodoRange,
  type DashboardPeriodo,
} from '../lib/dashboard-utils'
import {
  metaAuthStart,
  metaDisconnect,
  metaInsights,
  metaSelectAccount,
  metaStatus,
  type MetaAdAccountOption,
  type MetaInsights,
} from '../lib/loja-online-meta-api'

type Props = {
  empresaId: string
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
}: {
  active?: boolean
  payload?: { value: number; name: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="dashboard-chart-tooltip">
      <div className="dashboard-chart-tooltip__label">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="dashboard-chart-tooltip__row">
          <span>{p.name}</span>
          <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

export function LojaOnlineAnunciosPage({ empresaId }: Props) {
  const { addToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [periodo, setPeriodo] = useState<DashboardPeriodo>('hoje')
  const [metaBusy, setMetaBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [metaConfigured, setMetaConfigured] = useState(true)
  const [connected, setConnected] = useState(false)
  const [needsAccount, setNeedsAccount] = useState(false)
  const [accounts, setAccounts] = useState<MetaAdAccountOption[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [accountSearch, setAccountSearch] = useState('')
  const [showAllAccounts, setShowAllAccounts] = useState(false)
  const [insights, setInsights] = useState<MetaInsights | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.account_id.includes(q) ||
        a.id.toLowerCase().includes(q)
    )
  }, [accounts, accountSearch])

  const refresh = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    setError(null)
    setWarning(null)
    try {
      const st = await metaStatus(empresaId, { includeAll: showAllAccounts })
      setMetaConfigured(st.configured)
      setConnected(st.connected)
      setAccounts(st.accounts)
      setSelectedAccount(st.adAccountId || st.accounts[0]?.id || '')
      setNeedsAccount(st.connected && !st.adAccountId)
      if (st.warning) setWarning(st.warning)

      if (st.connected && st.adAccountId) {
        const { dataInicio, dataFim } = getDashboardPeriodoRange(periodo)
        const m = await metaInsights(empresaId, dataInicio.slice(0, 10), dataFim.slice(0, 10))
        setNeedsAccount(Boolean(m.needsAccount))
        setInsights(m.insights)
        if (m.error) setError(m.error)
      } else {
        setInsights(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar anúncios.')
      setInsights(null)
    } finally {
      setLoading(false)
    }
  }, [empresaId, periodo, showAllAccounts])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const meta = searchParams.get('meta')
    if (!meta) return
    const msg = searchParams.get('meta_msg')
    if (meta === 'ok') {
      addToast('success', 'Meta Ads conectado com sucesso. Selecione a conta da loja.')
      void refresh()
    } else if (meta === 'error') {
      addToast('error', msg || 'Falha ao conectar Meta Ads.')
    }
    const next = new URLSearchParams(searchParams)
    next.delete('meta')
    next.delete('meta_msg')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, addToast, refresh])

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
      await refresh()
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
      await refresh()
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Falha ao salvar conta.')
    } finally {
      setMetaBusy(false)
    }
  }

  const selectedLabel = accounts.find((a) => a.id === selectedAccount)

  return (
    <div className="loja-online-dashboard">
      <header className="dashboard-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="dashboard-header__title" style={{ fontSize: '1.35rem' }}>
            Anúncios Meta
          </h2>
          <p className="dashboard-header__subtitle">
            Conecte uma conta do Gerenciador e acompanhe campanhas desta loja
          </p>
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
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'dashboard-spin' : ''} />
            Atualizar
          </Button>
        </div>
      </header>

      {(error || warning) && (
        <div className="dashboard-alert dashboard-alert--error">
          <AlertTriangle size={18} />
          {error || warning}
        </div>
      )}

      <Card className="page-card config-loja-card loja-online-grid-full">
        <CardHeader>
          <span>
            <Megaphone size={20} /> Conexão Meta Ads
          </span>
        </CardHeader>
        <CardBody className="loja-online-card-body">
          {!metaConfigured && (
            <p className="loja-online-hint">
              Configure <code>META_APP_ID</code> e <code>META_APP_SECRET</code> no servidor.
            </p>
          )}

          {!connected ? (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <p className="loja-online-hint" style={{ margin: 0, flex: 1 }}>
                Autorize o Facebook uma vez e depois escolha <strong>só a Ad Account desta loja</strong>. Contas
                somente leitura e parceiras ficam ocultas por padrão.
              </p>
              <Button variant="primary" size="sm" onClick={connectMeta} disabled={metaBusy || !metaConfigured}>
                <Link2 size={16} /> Conectar Meta Ads
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="loja-online-hint" style={{ margin: 0 }}>
                  Conta Meta conectada
                  {needsAccount ? ' — selecione a Ad Account da loja' : selectedLabel ? ` · ${selectedLabel.name}` : ''}
                </span>
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

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
                  <Search
                    size={16}
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}
                  />
                  <input
                    className="input-el"
                    style={{ paddingLeft: 32 }}
                    placeholder="Buscar conta por nome ou ID…"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                  />
                </div>
                <select
                  className="input-el"
                  style={{ flex: '1 1 280px', maxWidth: 420 }}
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                >
                  {filteredAccounts.length === 0 && <option value="">Nenhuma conta encontrada</option>}
                  {filteredAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.read_only ? ' (somente leitura)' : ''} · {a.account_id}
                    </option>
                  ))}
                </select>
                <Button variant="primary" size="sm" onClick={saveAccount} disabled={metaBusy || !selectedAccount}>
                  Usar esta conta
                </Button>
              </div>

              <label className="loja-online-hint" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={showAllAccounts}
                  onChange={(e) => setShowAllAccounts(e.target.checked)}
                />
                Mostrar todas as contas (inclui somente leitura / parceiras)
              </label>
              <p className="loja-online-hint" style={{ margin: 0 }}>
                Exibindo {filteredAccounts.length} de {accounts.length} conta(s)
                {!showAllAccounts ? ' · filtradas' : ''}.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {insights && (
        <>
          <section className="dashboard-kpis" style={{ marginTop: 16 }}>
            <DashboardKpiCard
              label="Investimento ads"
              value={formatCurrency(insights.spend)}
              hint={`${insights.impressions.toLocaleString('pt-BR')} impressões`}
              icon={<DollarSign size={22} strokeWidth={1.8} />}
              variant="warning"
            />
            <DashboardKpiCard
              label="Cliques"
              value={String(insights.clicks)}
              hint={`CTR ${insights.ctr.toFixed(2)}%`}
              icon={<Users size={22} strokeWidth={1.8} />}
              variant="info"
            />
            <DashboardKpiCard
              label="Compras (Pixel)"
              value={String(insights.purchases)}
              hint={formatCurrency(insights.purchase_value)}
              icon={<ShoppingBag size={22} strokeWidth={1.8} />}
              variant="success"
            />
            <DashboardKpiCard
              label="ROAS"
              value={`${insights.roas.toFixed(2)}x`}
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
                  {insights.age.length > 0 ? (
                    <ResponsiveContainer>
                      <BarChart data={insights.age}>
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
                  {insights.gender.length > 0 ? (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={insights.gender}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius="55%"
                          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        >
                          {insights.gender.map((_, i) => (
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

          {insights.campaigns.length > 0 && (
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
                        {insights.campaigns.map((c) => (
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

      {connected && !insights && !loading && !needsAccount && (
        <p className="loja-online-hint" style={{ marginTop: 16 }}>
          Sem métricas no período. Confirme a conta selecionada e o Pixel da loja em{' '}
          <Link to="/loja-online/seo">SEO e marketing</Link>.
        </p>
      )}
    </div>
  )
}
