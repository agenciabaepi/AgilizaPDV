import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Layout } from '../components/Layout'
import { PageTitle, Button } from '../components/ui'
import type { Caixa, CaixaMovimento, Venda } from '../vite-env'

type FluxoMes = {
  key: string
  label: string
  entradas: number
  saidas: number
  saldoPeriodo: number
  saldoFinal: number
  situacao: 'Realizado' | 'Previsto'
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function makeYearMonths(ano: number): FluxoMes[] {
  const now = new Date()
  const currentMonth = now.getMonth()
  return Array.from({ length: 12 }, (_, month) => {
    const date = new Date(ano, month, 1)
    return {
      key: monthKey(date),
      label: date.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '').replace(' ', ' - '),
      entradas: 0,
      saidas: 0,
      saldoPeriodo: 0,
      saldoFinal: 0,
      situacao: ano < now.getFullYear() || (ano === now.getFullYear() && month <= currentMonth) ? 'Realizado' : 'Previsto',
    }
  })
}

export function FluxoCaixa() {
  const [ano, setAno] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<FluxoMes[]>([])
  const [saldoAnterior, setSaldoAnterior] = useState(0)

  const loadFluxo = useCallback(async () => {
    const session = await window.electronAPI.auth.getSession()
    const empresaId = session && 'empresa_id' in session ? session.empresa_id : ''
    if (!empresaId) {
      setRows(makeYearMonths(ano))
      setSaldoAnterior(0)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const inicioAno = new Date(ano, 0, 1, 0, 0, 0, 0)
      const fimAno = new Date(ano, 11, 31, 23, 59, 59, 999)

      const [vendasNoAno, vendasAntesAno, caixas] = await Promise.all([
        window.electronAPI.vendas.list(empresaId, { dataInicio: inicioAno.toISOString(), dataFim: fimAno.toISOString() }),
        window.electronAPI.vendas.list(empresaId, { dataFim: new Date(inicioAno.getTime() - 1).toISOString() }),
        window.electronAPI.caixa.list(empresaId, 1000),
      ])

      const movimentosResults = await Promise.allSettled(
        caixas.map((c: Caixa) => window.electronAPI.caixa.listMovimentos(c.id))
      )
      const movimentos = movimentosResults
        .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
        .filter((m): m is CaixaMovimento => m != null)

      const base = makeYearMonths(ano)
      const idxByKey = new Map(base.map((m, idx) => [m.key, idx]))

      const saldoAnteriorVendas = vendasAntesAno
        .filter((v: Venda) => v.status === 'CONCLUIDA')
        .reduce((acc: number, v: Venda) => acc + v.total, 0)

      const limiteAnterior = new Date(inicioAno.getTime() - 1)
      const saldoAnteriorMovimentos = movimentos.reduce((acc, m) => {
        const data = new Date(m.created_at)
        if (data > limiteAnterior) return acc
        if (m.tipo === 'SUPRIMENTO') return acc + m.valor
        if (m.tipo === 'SANGRIA') return acc - m.valor
        return acc
      }, 0)

      vendasNoAno.forEach((v) => {
        const data = new Date(v.created_at)
        const idx = idxByKey.get(monthKey(data))
        if (idx == null) return
        if (v.status === 'CONCLUIDA') base[idx].entradas += v.total
      })

      movimentos.forEach((m) => {
        const data = new Date(m.created_at)
        const idx = idxByKey.get(monthKey(data))
        if (idx == null) return
        if (m.tipo === 'SUPRIMENTO') base[idx].entradas += m.valor
        if (m.tipo === 'SANGRIA') base[idx].saidas += m.valor
      })

      const saldoInicial = saldoAnteriorVendas + saldoAnteriorMovimentos
      let saldoAcumulado = saldoInicial
      base.forEach((m) => {
        m.saldoPeriodo = m.entradas - m.saidas
        saldoAcumulado += m.saldoPeriodo
        m.saldoFinal = saldoAcumulado
      })

      setSaldoAnterior(saldoInicial)
      setRows(base)
    } finally {
      setLoading(false)
    }
  }, [ano])

  useEffect(() => {
    loadFluxo()
  }, [loadFluxo])

  const resumo = useMemo(() => {
    const entradas = rows.reduce((acc, m) => acc + m.entradas, 0)
    const saidas = rows.reduce((acc, m) => acc + m.saidas, 0)
    const saldoPeriodo = entradas - saidas
    const saldoFinal = rows[rows.length - 1]?.saldoFinal ?? saldoAnterior
    return { entradas, saidas, saldoPeriodo, saldoFinal }
  }, [rows, saldoAnterior])

  const maxChartValue = Math.max(
    ...rows.flatMap((m) => [m.entradas, m.saidas]),
    1
  )

  return (
    <Layout>
      <PageTitle
        title="Fluxo de caixa"
        subtitle="Visão mensal de entradas, saídas e evolução do saldo no período."
      />

      <div className="fluxo-toolbar">
        <Button size="sm" variant="secondary" leftIcon={<ChevronLeft size={16} />} onClick={() => setAno((a) => a - 1)}>
          Ano anterior
        </Button>
        <span className="fluxo-ano">{ano}</span>
        <Button size="sm" variant="secondary" rightIcon={<ChevronRight size={16} />} onClick={() => setAno((a) => a + 1)}>
          Próximo ano
        </Button>
      </div>

      <div className="fluxo-resumo-cards">
        <div className="fluxo-resumo-card">
          <Wallet size={18} />
          <span>Saldo anterior</span>
          <strong>{formatCurrency(saldoAnterior)}</strong>
        </div>
        <div className="fluxo-resumo-card fluxo-resumo-card--success">
          <TrendingUp size={18} />
          <span>Entradas</span>
          <strong>{formatCurrency(resumo.entradas)}</strong>
        </div>
        <div className="fluxo-resumo-card fluxo-resumo-card--danger">
          <TrendingDown size={18} />
          <span>Saídas</span>
          <strong>{formatCurrency(resumo.saidas)}</strong>
        </div>
        <div className="fluxo-resumo-card">
          <span>Saldo do período</span>
          <strong>{formatCurrency(resumo.saldoPeriodo)}</strong>
        </div>
        <div className="fluxo-resumo-card">
          <span>Saldo final</span>
          <strong>{formatCurrency(resumo.saldoFinal)}</strong>
        </div>
      </div>

      <div className="fluxo-chart-wrap">
        <div className="fluxo-chart-title">Fluxo de caixa - mensal</div>
        {loading ? (
          <p className="vendas-loading">Carregando gráfico...</p>
        ) : (
          <div className="fluxo-chart">
            {rows.map((m) => (
              <div key={m.key} className="fluxo-chart-col" title={`${m.label} | Entradas: ${formatCurrency(m.entradas)} | Saídas: ${formatCurrency(m.saidas)}`}>
                <div className="fluxo-chart-bars">
                  <div className="fluxo-chart-bar fluxo-chart-bar--entrada" style={{ height: `${Math.max((m.entradas / maxChartValue) * 100, m.entradas > 0 ? 3 : 0)}%` }} />
                  <div className="fluxo-chart-bar fluxo-chart-bar--saida" style={{ height: `${Math.max((m.saidas / maxChartValue) * 100, m.saidas > 0 ? 3 : 0)}%` }} />
                </div>
                <span>{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fluxo-table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Entradas</th>
              <th>Saídas</th>
              <th>Saldo do período</th>
              <th>Saldo final</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td>{formatCurrency(m.entradas)}</td>
                <td>{formatCurrency(m.saidas)}</td>
                <td>{formatCurrency(m.saldoPeriodo)}</td>
                <td>{formatCurrency(m.saldoFinal)}</td>
                <td>{m.situacao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
