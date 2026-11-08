import { useCallback, useEffect, useState } from 'react'
import { Calendar, Eye, Package, TrendingUp, Wallet } from 'lucide-react'
import { Layout } from '../components/Layout'
import { PageTitle, Alert, Button, Dialog } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useSyncDataRefresh } from '../hooks/useSyncDataRefresh'
import { formatCurrency } from '../lib/dashboard-utils'
import {
  labelDemonstrativoPeriodo,
  loadDemonstrativoCmvDetalhe,
  loadDemonstrativoResumo,
  type DemonstrativoCmvDetalhe,
  type DemonstrativoCmvFonte,
  type DemonstrativoPeriodo,
  type DemonstrativoResumo,
} from '../lib/demonstrativos-data'

const PERIODOS: { id: DemonstrativoPeriodo; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mês' },
]

function formatPct(value: number | null): string {
  if (value == null) return '—'
  return `${value.toFixed(1).replace('.', ',')}%`
}

function formatQty(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function labelFonte(fonte: DemonstrativoCmvFonte): string {
  if (fonte === 'estoque') return 'Estoque'
  if (fonte === 'cadastro') return 'Cadastro'
  return 'Misto'
}

export function Demonstrativos() {
  const { session } = useAuth()
  const syncRefreshKey = useSyncDataRefresh()
  const empresaId = session?.empresa_id ?? ''

  const [periodo, setPeriodo] = useState<DemonstrativoPeriodo>('mes')
  const [resumo, setResumo] = useState<DemonstrativoResumo | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [cmvOpen, setCmvOpen] = useState(false)
  const [cmvDetalhe, setCmvDetalhe] = useState<DemonstrativoCmvDetalhe | null>(null)
  const [cmvLoading, setCmvLoading] = useState(false)
  const [cmvErro, setCmvErro] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    setErro(null)
    try {
      const data = await loadDemonstrativoResumo(empresaId, periodo)
      setResumo(data)
    } catch (err) {
      setResumo(null)
      setErro(err instanceof Error ? err.message : 'Erro ao carregar demonstrativos.')
    } finally {
      setLoading(false)
    }
  }, [empresaId, periodo, syncRefreshKey])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setCmvOpen(false)
    setCmvDetalhe(null)
    setCmvErro(null)
  }, [periodo])

  const openCmvDetalhe = async () => {
    if (!empresaId) return
    setCmvOpen(true)
    setCmvLoading(true)
    setCmvErro(null)
    try {
      const data = await loadDemonstrativoCmvDetalhe(empresaId, periodo)
      setCmvDetalhe(data)
    } catch (err) {
      setCmvDetalhe(null)
      setCmvErro(err instanceof Error ? err.message : 'Erro ao carregar detalhe do CMV.')
    } finally {
      setCmvLoading(false)
    }
  }

  if (!empresaId) {
    return (
      <Layout>
        <PageTitle title="Demonstrativos" subtitle="Sessão inválida." />
      </Layout>
    )
  }

  return (
    <Layout>
      <PageTitle
        title="Demonstrativos"
        subtitle="EBITDA, CMV e lucro líquido das vendas concluídas"
      />

      <div className="comissoes-toolbar">
        <div className="comissoes-periodos">
          <Calendar size={20} />
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`btn btn--secondary btn--sm ${periodo === p.id ? 'comissoes-periodo-ativo' : ''}`}
              onClick={() => setPeriodo(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <Alert variant="error" style={{ marginBottom: 16 }}>
          {erro}
        </Alert>
      )}

      {loading ? (
        <p className="vendas-loading">Carregando demonstrativos...</p>
      ) : !resumo ? (
        <p className="comissoes-empty">Não foi possível carregar os dados.</p>
      ) : (
        <>
          <div className="comissoes-cards-resumo">
            <div className="comissoes-card-resumo demonstrativos-card--ebitda">
              <div className="comissoes-card-resumo__icon">
                <TrendingUp size={22} strokeWidth={1.8} />
              </div>
              <div className="comissoes-card-resumo__content">
                <span className="comissoes-card-resumo__label">EBITDA</span>
                <span className="comissoes-card-resumo__value">{formatCurrency(resumo.ebitda)}</span>
                <span className="comissoes-card-resumo__hint">
                  {labelDemonstrativoPeriodo(periodo)} · margem {formatPct(resumo.margemEbitdaPct)}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="comissoes-card-resumo demonstrativos-card--cmv demonstrativos-card--clickable"
              onClick={openCmvDetalhe}
            >
              <div className="comissoes-card-resumo__icon">
                <Package size={22} strokeWidth={1.8} />
              </div>
              <div className="comissoes-card-resumo__content">
                <span className="comissoes-card-resumo__label">CMV</span>
                <span className="comissoes-card-resumo__value">{formatCurrency(resumo.cmv)}</span>
                <span className="comissoes-card-resumo__hint">
                  Custo das mercadorias · ver produtos
                </span>
              </div>
            </button>

            <div className="comissoes-card-resumo demonstrativos-card--lucro">
              <div className="comissoes-card-resumo__icon">
                <Wallet size={22} strokeWidth={1.8} />
              </div>
              <div className="comissoes-card-resumo__content">
                <span className="comissoes-card-resumo__label">Lucro líquido</span>
                <span className="comissoes-card-resumo__value">{formatCurrency(resumo.lucroLiquido)}</span>
                <span className="comissoes-card-resumo__hint">
                  margem {formatPct(resumo.margemLiquidaPct)} · {resumo.qtdVendas} venda(s)
                </span>
              </div>
            </div>
          </div>

          <section className="comissoes-section">
            <h3 className="comissoes-section-title">Composição do resultado</h3>
            <div className="fluxo-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Indicador</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th style={{ textAlign: 'right' }}>% da receita</th>
                    <th style={{ width: 48 }} />
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Receita (vendas concluídas)</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(resumo.receita)}</td>
                    <td style={{ textAlign: 'right' }}>{resumo.receita > 0 ? '100,0%' : '—'}</td>
                    <td />
                  </tr>
                  <tr>
                    <td>(−) CMV</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(resumo.cmv)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {formatPct(resumo.receita > 0 ? (resumo.cmv / resumo.receita) * 100 : null)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Eye size={16} />}
                        onClick={openCmvDetalhe}
                        aria-label="Ver detalhe do CMV"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>Lucro bruto</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(resumo.lucroBruto)}</td>
                    <td style={{ textAlign: 'right' }}>{formatPct(resumo.margemBrutaPct)}</td>
                    <td />
                  </tr>
                  <tr>
                    <td>(−) Comissões</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(resumo.comissoes)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {formatPct(resumo.receita > 0 ? (resumo.comissoes / resumo.receita) * 100 : null)}
                    </td>
                    <td />
                  </tr>
                  <tr className="demonstrativos-row--destaque">
                    <td>EBITDA</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(resumo.ebitda)}</td>
                    <td style={{ textAlign: 'right' }}>{formatPct(resumo.margemEbitdaPct)}</td>
                    <td />
                  </tr>
                  <tr className="demonstrativos-row--destaque">
                    <td>Lucro líquido</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(resumo.lucroLiquido)}</td>
                    <td style={{ textAlign: 'right' }}>{formatPct(resumo.margemLiquidaPct)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="demonstrativos-nota">
              CMV usa o custo registrado na saída de estoque da venda; quando não houver movimento, usa o
              custo atual do produto. EBITDA e lucro líquido consideram comissões de PDV como despesa
              operacional. Impostos e demais despesas ainda não entram no cálculo.
            </p>
          </section>
        </>
      )}

      <Dialog
        open={cmvOpen}
        onClose={() => setCmvOpen(false)}
        title={`Detalhe do CMV · ${labelDemonstrativoPeriodo(periodo)}`}
        size="large"
        footer={
          <Button variant="secondary" onClick={() => setCmvOpen(false)}>
            Fechar
          </Button>
        }
      >
        {cmvLoading ? (
          <p className="vendas-loading">Carregando produtos...</p>
        ) : cmvErro ? (
          <Alert variant="error">{cmvErro}</Alert>
        ) : !cmvDetalhe || cmvDetalhe.itens.length === 0 ? (
          <p className="comissoes-empty">Nenhum produto vendido no período.</p>
        ) : (
          <>
            <div className="demonstrativos-cmv-resumo">
              <span>
                <strong>{cmvDetalhe.itens.length}</strong> produto(s)
              </span>
              <span>
                CMV total: <strong>{formatCurrency(cmvDetalhe.total)}</strong>
              </span>
            </div>
            <div className="fluxo-table-wrap demonstrativos-cmv-table">
              <table className="table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th style={{ textAlign: 'right' }}>Qtd</th>
                    <th style={{ textAlign: 'right' }}>Custo unit.</th>
                    <th style={{ textAlign: 'right' }}>Custo total</th>
                    <th style={{ textAlign: 'right' }}>Receita</th>
                    <th>Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {cmvDetalhe.itens.map((item) => (
                    <tr key={item.produto_id}>
                      <td>{item.nome}</td>
                      <td style={{ textAlign: 'right' }}>{formatQty(item.quantidade)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.custo_unitario)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.custo_total)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.receita)}</td>
                      <td>
                        <span className={`demonstrativos-fonte demonstrativos-fonte--${item.fonte}`}>
                          {labelFonte(item.fonte)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="demonstrativos-nota">
              Origem Estoque = custo na saída da venda. Cadastro = custo atual do produto. Misto =
              parte de cada fonte.
            </p>
          </>
        )}
      </Dialog>
    </Layout>
  )
}
