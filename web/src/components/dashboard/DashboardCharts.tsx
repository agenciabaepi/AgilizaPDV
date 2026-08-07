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
import { Card, CardBody, CardHeader } from '../ui'
import { DASHBOARD_CHART_COLORS, formatCompactCurrency, formatCurrency } from '../../lib/dashboard-utils'
import type {
  DashboardChartPoint,
  DashboardFormaPoint,
  DashboardOrigemPoint,
  DashboardTopProduto,
} from '../../lib/dashboard-data'

function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="dashboard-chart-tooltip">
      <div className="dashboard-chart-tooltip__label">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="dashboard-chart-tooltip__row">
          <span>{p.name}</span>
          <strong>{formatCurrency(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

function CountTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
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

type DashboardChartsProps = {
  vendasPorDia: DashboardChartPoint[]
  origemVendas: DashboardOrigemPoint[]
  formasPagamento: DashboardFormaPoint[]
  topProdutos: DashboardTopProduto[]
  lojaAtividade?: DashboardChartPoint[]
  showLojaOnline: boolean
}

const PIE_COLORS = [DASHBOARD_CHART_COLORS.pdv, DASHBOARD_CHART_COLORS.online, DASHBOARD_CHART_COLORS.purple, DASHBOARD_CHART_COLORS.warning]
const BAR_COLORS = [DASHBOARD_CHART_COLORS.primary, DASHBOARD_CHART_COLORS.success, DASHBOARD_CHART_COLORS.info, DASHBOARD_CHART_COLORS.purple, DASHBOARD_CHART_COLORS.pink, DASHBOARD_CHART_COLORS.warning]

export function DashboardCharts({
  vendasPorDia,
  origemVendas,
  formasPagamento,
  topProdutos,
  lojaAtividade,
  showLojaOnline,
}: DashboardChartsProps) {
  const hasVendasChart = vendasPorDia.some((d) => d.total > 0)
  const topProdutosChart = topProdutos.map((p) => ({
    name: p.nome.length > 22 ? `${p.nome.slice(0, 22)}…` : p.nome,
    quantidade: p.quantidade,
    receita: p.receita,
  }))

  return (
    <div className="dashboard-charts">
      <Card className="dashboard-chart-card">
        <CardHeader>
          <div>
            <h3 className="dashboard-chart-title">Receita por dia</h3>
            <p className="dashboard-chart-subtitle">Evolução das vendas concluídas no período</p>
          </div>
        </CardHeader>
        <CardBody>
          {hasVendasChart ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={vendasPorDia} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="receitaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={DASHBOARD_CHART_COLORS.primary} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={DASHBOARD_CHART_COLORS.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#717171' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#717171' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCompactCurrency(v)}
                  width={72}
                />
                <Tooltip content={<CurrencyTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Receita"
                  stroke={DASHBOARD_CHART_COLORS.primary}
                  strokeWidth={2.5}
                  fill="url(#receitaGradient)"
                  dot={{ r: 3, fill: DASHBOARD_CHART_COLORS.primary, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="dashboard-chart-empty">Nenhuma venda no período selecionado.</div>
          )}
        </CardBody>
      </Card>

      <Card className="dashboard-chart-card">
        <CardHeader>
          <div>
            <h3 className="dashboard-chart-title">Origem das vendas</h3>
            <p className="dashboard-chart-subtitle">PDV físico vs loja online</p>
          </div>
        </CardHeader>
        <CardBody>
          {origemVendas.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={origemVendas}
                  dataKey="receita"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={100}
                  paddingAngle={3}
                  stroke="none"
                >
                  {origemVendas.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as DashboardOrigemPoint
                    return (
                      <div className="dashboard-chart-tooltip">
                        <div className="dashboard-chart-tooltip__label">{d.name}</div>
                        <div className="dashboard-chart-tooltip__row">
                          <span>Receita</span>
                          <strong>{formatCurrency(d.receita)}</strong>
                        </div>
                        <div className="dashboard-chart-tooltip__row">
                          <span>Vendas</span>
                          <strong>{d.value}</strong>
                        </div>
                      </div>
                    )
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  formatter={(value) => <span style={{ color: '#717171', fontSize: 12 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="dashboard-chart-empty">Sem dados de origem no período.</div>
          )}
        </CardBody>
      </Card>

      <Card className="dashboard-chart-card">
        <CardHeader>
          <div>
            <h3 className="dashboard-chart-title">Formas de pagamento</h3>
            <p className="dashboard-chart-subtitle">Distribuição por meio de pagamento</p>
          </div>
        </CardHeader>
        <CardBody>
          {formasPagamento.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={formasPagamento} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#717171' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#717171' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCompactCurrency(v)}
                  width={72}
                />
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="value" name="Valor" radius={[8, 8, 0, 0]}>
                  {formasPagamento.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="dashboard-chart-empty">Nenhum pagamento registrado no período.</div>
          )}
        </CardBody>
      </Card>

      <Card className="dashboard-chart-card">
        <CardHeader>
          <div>
            <h3 className="dashboard-chart-title">Produtos mais vendidos</h3>
            <p className="dashboard-chart-subtitle">Top 8 por quantidade no período</p>
          </div>
        </CardHeader>
        <CardBody>
          {topProdutosChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topProdutosChart} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#717171' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11, fill: '#717171' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="quantidade" name="Unidades" fill={DASHBOARD_CHART_COLORS.success} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="dashboard-chart-empty">Nenhum produto vendido no período.</div>
          )}
        </CardBody>
      </Card>

      {showLojaOnline && (
        <Card className="dashboard-chart-card dashboard-chart-card--wide">
          <CardHeader>
            <div>
              <h3 className="dashboard-chart-title">Atividade da loja online</h3>
              <p className="dashboard-chart-subtitle">Pedidos e receita por dia — proxy de tráfego e conversão</p>
            </div>
          </CardHeader>
          <CardBody>
            {lojaAtividade && lojaAtividade.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={lojaAtividade} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="onlineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={DASHBOARD_CHART_COLORS.success} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={DASHBOARD_CHART_COLORS.success} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#717171' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#717171' }} axisLine={false} tickLine={false} width={32} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#717171' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCompactCurrency(v)}
                    width={72}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="dashboard-chart-tooltip">
                          <div className="dashboard-chart-tooltip__label">{label}</div>
                          <div className="dashboard-chart-tooltip__row">
                            <span>Pedidos</span>
                            <strong>{payload.find((p) => p.dataKey === 'count')?.value ?? 0}</strong>
                          </div>
                          <div className="dashboard-chart-tooltip__row">
                            <span>Receita</span>
                            <strong>{formatCurrency(Number(payload.find((p) => p.dataKey === 'total')?.value ?? 0))}</strong>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    formatter={(value) => <span style={{ color: '#717171', fontSize: 12 }}>{value}</span>}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="count"
                    name="Pedidos"
                    stroke={DASHBOARD_CHART_COLORS.info}
                    strokeWidth={2}
                    fill="transparent"
                    dot={{ r: 3, fill: DASHBOARD_CHART_COLORS.info, strokeWidth: 0 }}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="total"
                    name="Receita"
                    stroke={DASHBOARD_CHART_COLORS.success}
                    strokeWidth={2.5}
                    fill="url(#onlineGradient)"
                    dot={{ r: 3, fill: DASHBOARD_CHART_COLORS.success, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="dashboard-chart-empty">Nenhum pedido online no período.</div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
