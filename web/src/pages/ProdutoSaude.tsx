import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowLeft,
  Pencil,
  Package,
  DollarSign,
  TrendingUp,
  Percent,
  Warehouse,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { Layout } from '../components/Layout'
import { Card, CardHeader, CardBody, Button } from '../components/ui'
import { DashboardKpiCard } from '../components/dashboard/DashboardKpiCard'
import { DASHBOARD_CHART_COLORS, formatCurrency, formatCompactCurrency } from '../lib/dashboard-utils'
import { carregarSaudeProduto, type ProdutoSaude as Dados } from '../lib/produto-saude'

type Nivel = 'bom' | 'medio' | 'ruim' | 'neutro'
type Indicador = { titulo: string; status: string; nivel: Nivel; texto: string }

const PERIODOS = [
  { dias: 7, label: '7 dias' },
  { dias: 30, label: '30 dias' },
  { dias: 90, label: '90 dias' },
  { dias: 365, label: '1 ano' },
]

const fmtQtd = (n: number) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 })

function variacaoPct(atual: number, anterior: number): { value: string; up: boolean } | undefined {
  if (anterior <= 0) return atual > 0 ? { value: 'novo no período', up: true } : undefined
  const pct = ((atual - anterior) / anterior) * 100
  return { value: `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% vs período anterior`, up: pct >= 0 }
}

function quandoFoi(iso: string | null): string {
  if (!iso) return 'Nunca vendido'
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (dias <= 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  return `Há ${dias} dias`
}

function calcularIndicadores(d: Dados): { lista: Indicador[]; nota: number } {
  const { produto: p, periodo, dias } = d
  const lista: Indicador[] = []

  // Margem
  if (p.preco <= 0) {
    lista.push({ titulo: 'Margem', status: 'Sem preço', nivel: 'ruim', texto: 'Cadastre o preço de venda.' })
  } else if (p.custo <= 0) {
    lista.push({
      titulo: 'Margem',
      status: 'Sem custo',
      nivel: 'neutro',
      texto: 'Cadastre o custo para calcular o lucro de verdade.',
    })
  } else {
    const m = ((p.preco - p.custo) / p.preco) * 100
    lista.push({
      titulo: 'Margem',
      status: `${m.toFixed(1)}%`,
      nivel: m >= 30 ? 'bom' : m >= 15 ? 'medio' : 'ruim',
      texto:
        m >= 30
          ? 'Margem saudável.'
          : m >= 15
            ? 'Margem apertada. Revise custo ou preço.'
            : m < 0
              ? 'Vendendo abaixo do custo!'
              : 'Margem baixa. Pouco lucro por venda.',
    })
  }

  // Giro de vendas
  const mediaDia = periodo.quantidade / dias
  lista.push({
    titulo: 'Vendas',
    status: periodo.quantidade > 0 ? `${fmtQtd(periodo.quantidade)} em ${dias} dias` : 'Sem vendas',
    nivel: periodo.quantidade === 0 ? 'ruim' : mediaDia >= 1 ? 'bom' : 'medio',
    texto:
      periodo.quantidade === 0
        ? `Nenhuma venda nos últimos ${dias} dias.`
        : `Média de ${fmtQtd(Math.round(mediaDia * 100) / 100)} por dia.`,
  })

  // Estoque
  if (!p.controla_estoque) {
    lista.push({ titulo: 'Estoque', status: 'Não controla', nivel: 'neutro', texto: 'Este produto não controla estoque.' })
  } else if (p.estoque_atual <= 0) {
    lista.push({ titulo: 'Estoque', status: 'Sem estoque', nivel: 'ruim', texto: 'Reponha para não perder vendas.' })
  } else {
    const cobertura = mediaDia > 0 ? p.estoque_atual / mediaDia : Infinity
    const abaixoMin = p.estoque_minimo > 0 && p.estoque_atual <= p.estoque_minimo
    lista.push({
      titulo: 'Estoque',
      status:
        cobertura === Infinity ? 'Parado' : `Dura ~${Math.max(1, Math.round(cobertura))} dias`,
      nivel: abaixoMin || cobertura < 7 ? 'medio' : cobertura > 120 ? 'medio' : 'bom',
      texto: abaixoMin
        ? `No mínimo (${fmtQtd(p.estoque_minimo)}). Hora de repor.`
        : cobertura === Infinity
          ? 'Tem estoque mas não vendeu no período.'
          : cobertura < 7
            ? 'Acaba em menos de uma semana no ritmo atual.'
            : cobertura > 120
              ? 'Estoque alto para o ritmo de vendas.'
              : 'Estoque equilibrado com as vendas.',
    })
  }

  const pontos = lista.filter((i) => i.nivel !== 'neutro')
  const nota = pontos.length
    ? Math.round((pontos.reduce((s, i) => s + (i.nivel === 'bom' ? 1 : i.nivel === 'medio' ? 0.5 : 0), 0) / pontos.length) * 100)
    : 0
  return { lista, nota }
}

export function ProdutoSaude() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [dias, setDias] = useState(30)
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelado = false
    setCarregando(true)
    setErro('')
    carregarSaudeProduto(id, dias)
      .then((d) => {
        if (cancelado) return
        if (!d) setErro('Produto não encontrado.')
        setDados(d)
      })
      .catch((err) => {
        if (!cancelado) setErro(err instanceof Error ? err.message : 'Erro ao carregar dados do produto.')
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [id, dias])

  const indicadores = useMemo(() => (dados ? calcularIndicadores(dados) : null), [dados])
  const p = dados?.produto
  const margemUnit = p ? p.preco - p.custo : 0
  const margemPct = p && p.preco > 0 && p.custo > 0 ? (margemUnit / p.preco) * 100 : null
  const temVendas = (dados?.periodo.quantidade ?? 0) > 0
  const nivelNota = indicadores ? (indicadores.nota >= 75 ? 'bom' : indicadores.nota >= 45 ? 'medio' : 'ruim') : 'neutro'

  return (
    <Layout>
      <div className="produto-saude">
        <div className="produto-saude-topo">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/produtos')}>
            Produtos
          </Button>
          <div className="produto-saude-periodos" role="group" aria-label="Período">
            {PERIODOS.map((op) => (
              <button
                key={op.dias}
                type="button"
                className={`produto-saude-periodo ${dias === op.dias ? 'is-active' : ''}`}
                onClick={() => setDias(op.dias)}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>

        {erro && (
          <div className="dashboard-error">
            <AlertTriangle size={18} />
            {erro}
          </div>
        )}

        {p && (
          <section className="produto-saude-header">
            <div className="produto-saude-foto">
              {p.imagem ? <img src={p.imagem} alt="" /> : <Package size={34} strokeWidth={1.5} />}
            </div>
            <div className="produto-saude-info">
              <h1>{p.nome}</h1>
              <div className="produto-saude-meta">
                {p.codigo != null && <span>Cód. {p.codigo}</span>}
                {p.codigo_barras && <span>{p.codigo_barras}</span>}
                {p.categoria_nome && <span>{p.categoria_nome}</span>}
                {p.marca_nome && <span>{p.marca_nome}</span>}
                {!p.ativo && <span className="produto-saude-inativo">Inativo</span>}
              </div>
              <div className="produto-saude-precos">
                <span>
                  Preço <strong>{formatCurrency(p.preco)}</strong>
                </span>
                <span>
                  Custo <strong>{p.custo > 0 ? formatCurrency(p.custo) : '—'}</strong>
                </span>
                <span>
                  Lucro por unidade <strong>{p.custo > 0 ? formatCurrency(margemUnit) : '—'}</strong>
                </span>
              </div>
            </div>
            <div className={`produto-saude-nota is-${nivelNota}`}>
              <span className="produto-saude-nota-valor">{indicadores ? indicadores.nota : '—'}</span>
              <span className="produto-saude-nota-label">Saúde</span>
            </div>
            <Button leftIcon={<Pencil size={16} />} onClick={() => navigate(`/produtos/${p.id}`)}>
              Editar
            </Button>
          </section>
        )}

        {carregando && !dados && <div className="produto-saude-carregando">Carregando dados do produto…</div>}

        {dados && p && indicadores && (
          <>
            <section className="produto-saude-indicadores">
              {indicadores.lista.map((i) => (
                <div key={i.titulo} className={`produto-saude-ind is-${i.nivel}`}>
                  <span className="produto-saude-ind-titulo">{i.titulo}</span>
                  <span className="produto-saude-ind-status">{i.status}</span>
                  <span className="produto-saude-ind-texto">{i.texto}</span>
                </div>
              ))}
            </section>

            <section className="dashboard-kpis" style={carregando ? { opacity: 0.6 } : undefined}>
              <DashboardKpiCard
                label="Unidades vendidas"
                value={fmtQtd(dados.periodo.quantidade)}
                hint={`${dados.periodo.vendas} venda(s) em ${dias} dias`}
                icon={<Package size={22} strokeWidth={1.8} />}
                variant="primary"
                trend={variacaoPct(dados.periodo.quantidade, dados.periodoAnterior.quantidade)}
              />
              <DashboardKpiCard
                label="Faturamento"
                value={formatCurrency(dados.periodo.faturamento)}
                hint={`Total desde o cadastro: ${formatCurrency(dados.total.faturamento)}`}
                icon={<DollarSign size={22} strokeWidth={1.8} />}
                variant="success"
                trend={variacaoPct(dados.periodo.faturamento, dados.periodoAnterior.faturamento)}
              />
              <DashboardKpiCard
                label="Lucro estimado"
                value={p.custo > 0 ? formatCurrency(dados.periodo.lucro) : '—'}
                hint={p.custo > 0 ? 'Vendido menos o custo cadastrado' : 'Cadastre o custo do produto'}
                icon={<TrendingUp size={22} strokeWidth={1.8} />}
                variant="info"
              />
              <DashboardKpiCard
                label="Margem de lucro"
                value={margemPct != null ? `${margemPct.toFixed(1)}%` : '—'}
                hint={p.custo > 0 ? `${formatCurrency(margemUnit)} por unidade` : 'Sem custo cadastrado'}
                icon={<Percent size={22} strokeWidth={1.8} />}
                variant={margemPct == null ? 'neutral' : margemPct >= 30 ? 'success' : margemPct >= 15 ? 'warning' : 'danger'}
              />
              <DashboardKpiCard
                label="Estoque atual"
                value={p.controla_estoque ? `${fmtQtd(p.estoque_atual)} ${p.unidade ?? ''}` : '—'}
                hint={
                  p.controla_estoque
                    ? p.estoque_minimo > 0
                      ? `Mínimo: ${fmtQtd(p.estoque_minimo)}`
                      : 'Sem estoque mínimo definido'
                    : 'Não controla estoque'
                }
                icon={<Warehouse size={22} strokeWidth={1.8} />}
                variant={!p.controla_estoque ? 'neutral' : p.estoque_atual <= 0 ? 'danger' : 'warning'}
              />
              <DashboardKpiCard
                label="Última venda"
                value={quandoFoi(dados.ultimaVenda)}
                hint={
                  dados.ultimaVenda
                    ? new Date(dados.ultimaVenda).toLocaleDateString('pt-BR')
                    : `Total vendido: ${fmtQtd(dados.total.quantidade)}`
                }
                icon={<Clock size={22} strokeWidth={1.8} />}
                variant="neutral"
              />
            </section>

            <div className="produto-saude-graficos">
              <Card className="dashboard-chart-card">
                <CardHeader>
                  <div>
                    <h3 className="dashboard-chart-title">Vendas por dia</h3>
                    <p className="dashboard-chart-subtitle">Unidades vendidas nos últimos {dias} dias</p>
                  </div>
                </CardHeader>
                <CardBody>
                  {temVendas ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={dados.vendasPorDia} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#717171' }} axisLine={false} tickLine={false} minTickGap={12} />
                        <YAxis tick={{ fontSize: 11, fill: '#717171' }} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
                        <Tooltip
                          cursor={{ fill: 'rgba(29, 78, 216, 0.06)' }}
                          formatter={(v, nome) =>
                            nome === 'quantidade' ? [fmtQtd(Number(v)), 'Unidades'] : [formatCurrency(Number(v)), 'Faturamento']
                          }
                          labelFormatter={(l) => `Dia ${l}`}
                        />
                        <Bar dataKey="quantidade" fill={DASHBOARD_CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="dashboard-chart-empty">Nenhuma venda nos últimos {dias} dias.</div>
                  )}
                </CardBody>
              </Card>

              <Card className="dashboard-chart-card">
                <CardHeader>
                  <div>
                    <h3 className="dashboard-chart-title">Faturamento e lucro</h3>
                    <p className="dashboard-chart-subtitle">Por dia, nos últimos {dias} dias</p>
                  </div>
                </CardHeader>
                <CardBody>
                  {temVendas ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={dados.vendasPorDia} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="saudeFat" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={DASHBOARD_CHART_COLORS.primary} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={DASHBOARD_CHART_COLORS.primary} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#717171' }} axisLine={false} tickLine={false} minTickGap={12} />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#717171' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => formatCompactCurrency(Number(v))}
                          width={64}
                        />
                        <Tooltip
                          formatter={(v, nome) => [formatCurrency(Number(v)), nome === 'lucro' ? 'Lucro' : 'Faturamento']}
                          labelFormatter={(l) => `Dia ${l}`}
                        />
                        <Area type="monotone" dataKey="faturamento" stroke={DASHBOARD_CHART_COLORS.primary} strokeWidth={2} fill="url(#saudeFat)" />
                        {p.custo > 0 && (
                          <Area type="monotone" dataKey="lucro" stroke={DASHBOARD_CHART_COLORS.info} strokeWidth={2} fill="transparent" strokeDasharray="4 3" />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="dashboard-chart-empty">Sem faturamento no período.</div>
                  )}
                </CardBody>
              </Card>

              <Card className="dashboard-chart-card produto-saude-grafico-largo">
                <CardHeader>
                  <div>
                    <h3 className="dashboard-chart-title">Estoque</h3>
                    <p className="dashboard-chart-subtitle">
                      Saldo no fim de cada dia{p.estoque_minimo > 0 ? ' · linha tracejada = estoque mínimo' : ''}
                    </p>
                  </div>
                </CardHeader>
                <CardBody>
                  {p.controla_estoque ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={dados.estoquePorDia} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="saudeEstoque" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={DASHBOARD_CHART_COLORS.success} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={DASHBOARD_CHART_COLORS.success} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#717171' }} axisLine={false} tickLine={false} minTickGap={12} />
                        <YAxis tick={{ fontSize: 11, fill: '#717171' }} axisLine={false} tickLine={false} width={40} />
                        <Tooltip formatter={(v) => [fmtQtd(Number(v)), 'Estoque']} labelFormatter={(l) => `Dia ${l}`} />
                        {p.estoque_minimo > 0 && (
                          <ReferenceLine y={p.estoque_minimo} stroke="#dc2626" strokeDasharray="5 4" />
                        )}
                        <Area type="stepAfter" dataKey="saldo" stroke={DASHBOARD_CHART_COLORS.success} strokeWidth={2} fill="url(#saudeEstoque)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="dashboard-chart-empty">Este produto não controla estoque.</div>
                  )}
                  {dados.movimentos.length > 0 && (
                    <div className="produto-saude-movs">
                      <div className="produto-saude-movs-titulo">Últimas movimentações</div>
                      {dados.movimentos.map((m) => {
                        const sinal = m.tipo === 'SAIDA' ? '−' : m.tipo === 'AJUSTE' ? (m.quantidade >= 0 ? '+' : '−') : '+'
                        return (
                          <div key={m.id} className="produto-saude-mov">
                            <span>
                              {new Date(m.created_at).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span>{m.tipo === 'SAIDA' ? 'Saída' : m.tipo === 'ENTRADA' ? 'Entrada' : m.tipo === 'AJUSTE' ? 'Ajuste' : 'Devolução'}</span>
                            <strong className={sinal === '+' ? 'is-mais' : 'is-menos'}>
                              {sinal}
                              {fmtQtd(Math.abs(m.quantidade))}
                            </strong>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
