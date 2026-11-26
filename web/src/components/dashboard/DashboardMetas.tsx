import { useCallback, useEffect, useMemo, useState } from 'react'
import { Target } from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button, Card, CardBody, CardHeader, Dialog, Input } from '../ui'
import { DASHBOARD_CHART_COLORS, formatCurrency } from '../../lib/dashboard-utils'

/** Eixo do gráfico: "R$ 7,5 mil", "R$ 30 mil", "R$ 1,2 mi". */
function formatEixo(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (v >= 1_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return `R$ ${Math.round(v)}`
}

type Metas = { mensal: number | null; diaria: number | null }

type Props = {
  empresaId: string
  /** Admin/gerente podem definir as metas; os demais só acompanham. */
  podeEditar: boolean
  /** Muda quando o Dashboard recarrega (botão Atualizar / sincronização). */
  refreshKey?: unknown
}

type PontoDia = {
  dia: number
  label: string
  vendido: number | null
  acumulado: number | null
  metaAcumulada: number | null
}

function parseValor(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  if (!limpo.trim()) return null
  const n = Number(limpo)
  return Number.isFinite(n) && n > 0 ? n : null
}

const formatoCampo = { minimumFractionDigits: 2, maximumFractionDigits: 2 }

function valorParaCampo(v: number | null): string {
  return v != null ? v.toLocaleString('pt-BR', formatoCampo) : ''
}

/**
 * Máscara de dinheiro: só aceita dígitos e preenche a partir dos centavos
 * ("3" → "0,03", "3000000" → "30.000,00"). Campo vazio = sem meta.
 */
function mascaraMoeda(texto: string): string {
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12)
  if (!digitos) return ''
  return (Number(digitos) / 100).toLocaleString('pt-BR', formatoCampo)
}

function pct(realizado: number, meta: number | null): number {
  if (!meta || meta <= 0) return 0
  return Math.round((realizado / meta) * 100)
}

function BarraProgresso({ percentual }: { percentual: number }) {
  const largura = Math.min(100, Math.max(0, percentual))
  return (
    <div
      className="dashboard-meta-barra"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={largura}
    >
      <div
        className={`dashboard-meta-barra__fill${percentual >= 100 ? ' dashboard-meta-barra__fill--ok' : ''}`}
        style={{ width: `${largura}%` }}
      />
    </div>
  )
}

export function DashboardMetas({ empresaId, podeEditar, refreshKey }: Props) {
  const [metas, setMetas] = useState<Metas>({ mensal: null, diaria: null })
  const [vendasMes, setVendasMes] = useState<{ created_at: string; total: number }[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [campoMensal, setCampoMensal] = useState('')
  const [campoDiaria, setCampoDiaria] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)

  const suportaMetas = typeof window !== 'undefined' && !!window.electronAPI?.empresas?.getMetasVendas

  const carregar = useCallback(async () => {
    const api = window.electronAPI
    if (!empresaId || !api?.empresas?.getMetasVendas) return
    setCarregando(true)
    setErro(null)
    try {
      const agora = new Date()
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0)
      const fimHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999)
      const [m, vendas] = await Promise.all([
        api.empresas.getMetasVendas(empresaId),
        api.vendas.list(empresaId, {
          dataInicio: inicioMes.toISOString(),
          dataFim: fimHoje.toISOString(),
          limit: 10_000,
        }),
      ])
      setMetas(m)
      setVendasMes(
        vendas
          .filter((v) => v.status === 'CONCLUIDA')
          .map((v) => ({ created_at: v.created_at, total: Number(v.total) || 0 }))
      )
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar as metas.')
    } finally {
      setCarregando(false)
    }
  }, [empresaId])

  useEffect(() => {
    void carregar()
  }, [carregar, refreshKey])

  const resumo = useMemo(() => {
    const agora = new Date()
    const diaHoje = agora.getDate()
    const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate()
    const porDia = new Array<number>(diasNoMes + 1).fill(0)
    for (const v of vendasMes) {
      const d = new Date(v.created_at)
      if (d.getMonth() !== agora.getMonth() || d.getFullYear() !== agora.getFullYear()) continue
      porDia[d.getDate()] += v.total
    }
    const realizadoMes = porDia.reduce((s, v) => s + v, 0)
    const realizadoHoje = porDia[diaHoje] ?? 0
    const diasRestantes = diasNoMes - diaHoje + 1 // inclui hoje
    const faltaMes = metas.mensal ? Math.max(0, metas.mensal - realizadoMes) : 0
    const ritmoNecessario = diasRestantes > 0 ? faltaMes / diasRestantes : 0

    let acumulado = 0
    const serie: PontoDia[] = []
    const mesAbrev = agora.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const passou = dia <= diaHoje
      if (passou) acumulado += porDia[dia]
      serie.push({
        dia,
        label: `${dia} ${mesAbrev}`,
        vendido: passou ? porDia[dia] : null,
        acumulado: passou ? acumulado : null,
        metaAcumulada: metas.mensal ? (metas.mensal / diasNoMes) * dia : null,
      })
    }

    return { realizadoMes, realizadoHoje, diasRestantes, faltaMes, ritmoNecessario, serie }
  }, [vendasMes, metas.mensal])

  const abrirEdicao = () => {
    setCampoMensal(valorParaCampo(metas.mensal))
    setCampoDiaria(valorParaCampo(metas.diaria))
    setErroSalvar(null)
    setEditando(true)
  }

  const sugerirDiaria = () => {
    const mensal = parseValor(campoMensal)
    if (!mensal) return
    const agora = new Date()
    const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate()
    setCampoDiaria(valorParaCampo(Math.ceil((mensal / diasNoMes) * 100) / 100))
  }

  const salvar = async () => {
    const api = window.electronAPI
    if (!api?.empresas?.updateMetasVendas) return
    setSalvando(true)
    setErroSalvar(null)
    try {
      const salvas = await api.empresas.updateMetasVendas(empresaId, {
        mensal: parseValor(campoMensal),
        diaria: parseValor(campoDiaria),
      })
      setMetas(salvas)
      setEditando(false)
    } catch (e: unknown) {
      setErroSalvar(e instanceof Error ? e.message : 'Não foi possível salvar as metas.')
    } finally {
      setSalvando(false)
    }
  }

  if (!suportaMetas) return null

  const temMeta = metas.mensal != null || metas.diaria != null
  const pctHoje = pct(resumo.realizadoHoje, metas.diaria)
  const pctMes = pct(resumo.realizadoMes, metas.mensal)

  return (
    <section className="dashboard-section dashboard-metas" aria-labelledby="dashboard-metas-titulo">
      <div className="dashboard-section__head">
        <div className="dashboard-section__title-wrap">
          <Target size={20} />
          <div>
            <h2 id="dashboard-metas-titulo" className="dashboard-section__title">Metas de vendas</h2>
            <p className="dashboard-section__subtitle">Progresso de hoje e do mês, independente do filtro acima</p>
          </div>
        </div>
        {podeEditar && temMeta && (
          <Button variant="secondary" size="sm" onClick={abrirEdicao}>
            Editar metas
          </Button>
        )}
      </div>

      {erro && <p className="dashboard-metas-erro">{erro}</p>}

      {!carregando && !temMeta ? (
        <Card className="dashboard-metas-vazio">
          <CardBody>
            <Target size={22} />
            <div>
              <h3>Nenhuma meta definida</h3>
              <p>
                {podeEditar
                  ? 'Defina quanto a loja quer vender por dia e no mês para acompanhar o progresso aqui.'
                  : 'Peça a um administrador para definir as metas de vendas da loja.'}
              </p>
            </div>
            {podeEditar && (
              <Button variant="primary" size="md" onClick={abrirEdicao}>
                Definir metas
              </Button>
            )}
          </CardBody>
        </Card>
      ) : (
        temMeta && (
          <div className="dashboard-metas-grid">
            <div className="dashboard-metas-cards">
              <div className="dashboard-meta-card">
                <span className="dashboard-meta-card__label">Hoje</span>
                {metas.diaria ? (
                  <>
                    <span className="dashboard-meta-card__valor">
                      {formatCurrency(resumo.realizadoHoje)}
                      <span className="dashboard-meta-card__de"> de {formatCurrency(metas.diaria)}</span>
                    </span>
                    <BarraProgresso percentual={pctHoje} />
                    <span className="dashboard-meta-card__hint">
                      {pctHoje >= 100
                        ? `Meta do dia batida (${pctHoje}%)`
                        : `${pctHoje}% · faltam ${formatCurrency(metas.diaria - resumo.realizadoHoje)}`}
                    </span>
                  </>
                ) : (
                  <span className="dashboard-meta-card__hint">Sem meta diária definida.</span>
                )}
              </div>

              <div className="dashboard-meta-card">
                <span className="dashboard-meta-card__label">Este mês</span>
                {metas.mensal ? (
                  <>
                    <span className="dashboard-meta-card__valor">
                      {formatCurrency(resumo.realizadoMes)}
                      <span className="dashboard-meta-card__de"> de {formatCurrency(metas.mensal)}</span>
                    </span>
                    <BarraProgresso percentual={pctMes} />
                    <span className="dashboard-meta-card__hint">
                      {pctMes >= 100
                        ? `Meta do mês batida (${pctMes}%)`
                        : `${pctMes}% · faltam ${formatCurrency(resumo.faltaMes)} · ${formatCurrency(
                            resumo.ritmoNecessario
                          )}/dia nos ${resumo.diasRestantes} ${resumo.diasRestantes === 1 ? 'dia restante' : 'dias restantes'}`}
                    </span>
                  </>
                ) : (
                  <span className="dashboard-meta-card__hint">Sem meta mensal definida.</span>
                )}
              </div>
            </div>

            <Card className="dashboard-chart-card dashboard-metas-grafico">
              <CardHeader>
                <h3 className="dashboard-chart-title">
                  {metas.mensal ? 'Vendido no mês × meta' : 'Vendas por dia × meta diária'}
                </h3>
                <p className="dashboard-chart-subtitle">
                  {metas.mensal
                    ? 'Barras: vendas do dia · linha azul: acumulado · tracejado: ritmo para bater a meta'
                    : 'Barras: vendas do dia · tracejado: meta diária'}
                </p>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={resumo.serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                    <XAxis
                      dataKey="dia"
                      tick={{ fontSize: 11, fill: '#6b6b6b' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#6b6b6b' }}
                      axisLine={false}
                      tickLine={false}
                      width={72}
                      tickFormatter={(v: number) => formatEixo(v)}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const p = payload[0].payload as PontoDia
                        return (
                          <div className="dashboard-chart-tooltip">
                            <div className="dashboard-chart-tooltip__label">{p.label}</div>
                            {p.vendido != null && (
                              <div className="dashboard-chart-tooltip__row">
                                <span>Vendido no dia</span>
                                <strong>{formatCurrency(p.vendido)}</strong>
                              </div>
                            )}
                            {metas.mensal && p.acumulado != null && (
                              <div className="dashboard-chart-tooltip__row">
                                <span>Acumulado</span>
                                <strong>{formatCurrency(p.acumulado)}</strong>
                              </div>
                            )}
                            {metas.mensal && p.metaAcumulada != null && (
                              <div className="dashboard-chart-tooltip__row">
                                <span>Meta até o dia</span>
                                <strong>{formatCurrency(p.metaAcumulada)}</strong>
                              </div>
                            )}
                            {!metas.mensal && metas.diaria && (
                              <div className="dashboard-chart-tooltip__row">
                                <span>Meta do dia</span>
                                <strong>{formatCurrency(metas.diaria)}</strong>
                              </div>
                            )}
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="vendido" name="Vendido no dia" fill="#bfdbfe" radius={[4, 4, 0, 0]} maxBarSize={18} />
                    {metas.mensal ? (
                      <>
                        <Line
                          type="monotone"
                          dataKey="metaAcumulada"
                          name="Meta"
                          stroke="#9ca3af"
                          strokeDasharray="5 5"
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="acumulado"
                          name="Acumulado"
                          stroke={DASHBOARD_CHART_COLORS.primary}
                          strokeWidth={2.5}
                          dot={false}
                          connectNulls={false}
                        />
                      </>
                    ) : (
                      metas.diaria && (
                        <ReferenceLine y={metas.diaria} stroke="#9ca3af" strokeDasharray="5 5" strokeWidth={1.5} />
                      )
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </div>
        )
      )}

      <Dialog
        open={editando}
        onClose={() => setEditando(false)}
        title="Metas de vendas"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setEditando(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="primary" size="md" onClick={() => void salvar()} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar metas'}
            </Button>
          </>
        }
      >
        <div className="dashboard-metas-form">
          <p className="dashboard-metas-form__ajuda">
            Valores em reais, considerando as vendas concluídas (PDV e loja online). Deixe em branco para não usar a
            meta.
          </p>
          <Input
            label="Meta mensal (R$)"
            inputMode="numeric"
            placeholder="0,00"
            value={campoMensal}
            onChange={(e) => setCampoMensal(mascaraMoeda(e.target.value))}
          />
          <div className="dashboard-metas-form__linha">
            <Input
              label="Meta diária (R$)"
              inputMode="numeric"
              placeholder="0,00"
              value={campoDiaria}
              onChange={(e) => setCampoDiaria(mascaraMoeda(e.target.value))}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={sugerirDiaria}
              disabled={!parseValor(campoMensal)}
              className="dashboard-metas-form__sugerir"
            >
              Calcular pela mensal
            </Button>
          </div>
          {erroSalvar && <p className="dashboard-metas-erro">{erroSalvar}</p>}
        </div>
      </Dialog>
    </section>
  )
}
