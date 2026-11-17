import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Layout } from '../components/Layout'
import { PageTitle, Alert, Button } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useSyncDataRefresh } from '../hooks/useSyncDataRefresh'
import { formatCurrency } from '../lib/dashboard-utils'
import {
  buildDemonstrativoMesTabs,
  currentDemonstrativoCompetencia,
  labelDemonstrativoCompetenciaCurta,
  labelDemonstrativoPeriodo,
  loadDemonstrativosCompleto,
  shiftDemonstrativoCompetencia,
  type DemonstrativoAba,
  type DemonstrativoCmvFonte,
  type DemonstrativoCompleto,
  type DemonstrativoPeriodo,
} from '../lib/demonstrativos-data'

const ABAS: { id: DemonstrativoAba; label: string; icon: typeof TrendingUp }[] = [
  { id: 'ebitda', label: 'EBITDA', icon: TrendingUp },
  { id: 'dre', label: 'DRE', icon: FileSpreadsheet },
  { id: 'cmv', label: 'CMV', icon: Package },
  { id: 'contas', label: 'Contas fixas / variáveis', icon: Wallet },
  { id: 'compras', label: 'Compras de produto', icon: ShoppingCart },
]

function formatPct(value: number | null): string {
  if (value == null) return '—'
  return `${value.toFixed(1).replace('.', ',')}%`
}

function formatQty(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString('pt-BR')
}

function labelFonte(fonte: DemonstrativoCmvFonte): string {
  if (fonte === 'estoque') return 'Estoque'
  if (fonte === 'cadastro') return 'Cadastro'
  return 'Misto'
}

function statusContaLabel(status: string): string {
  if (status === 'PAGA') return 'Paga'
  if (status === 'PENDENTE') return 'Pendente'
  if (status === 'CANCELADA') return 'Cancelada'
  return status
}

function signedClass(value: number): string {
  if (value > 0) return 'demonstrativos-valor--positivo'
  if (value < 0) return 'demonstrativos-valor--negativo'
  return ''
}

export function Demonstrativos() {
  const { session } = useAuth()
  const syncRefreshKey = useSyncDataRefresh()
  const empresaId = session?.empresa_id ?? ''

  const competenciaAtual = currentDemonstrativoCompetencia()
  const [competencia, setCompetencia] = useState<DemonstrativoPeriodo>(competenciaAtual)
  const [mesJanela, setMesJanela] = useState<DemonstrativoPeriodo>(competenciaAtual)
  const [aba, setAba] = useState<DemonstrativoAba>('ebitda')
  const [data, setData] = useState<DemonstrativoCompleto | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const mesTabs = useMemo(() => buildDemonstrativoMesTabs(mesJanela, 5), [mesJanela])

  const irParaCompetencia = (mes: string) => {
    setCompetencia(mes)
    const idx = mesTabs.indexOf(mes)
    if (idx <= 1 || idx >= mesTabs.length - 2) {
      setMesJanela(mes)
    }
  }

  const deslocarMeses = (delta: number) => {
    setMesJanela((j) => shiftDemonstrativoCompetencia(j, delta))
    setCompetencia((c) => shiftDemonstrativoCompetencia(c, delta))
  }

  const load = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    setErro(null)
    try {
      const result = await loadDemonstrativosCompleto(empresaId, competencia)
      setData(result)
    } catch (err) {
      setData(null)
      setErro(err instanceof Error ? err.message : 'Erro ao carregar demonstrativos.')
    } finally {
      setLoading(false)
    }
  }, [empresaId, competencia, syncRefreshKey])

  useEffect(() => {
    load()
  }, [load])

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
        subtitle="Visualização analítica do resultado — sem lançamentos"
      />

      <div className="financeiro-mes-bar">
        <button
          type="button"
          className="financeiro-mes-nav"
          aria-label="Mês anterior"
          onClick={() => deslocarMeses(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="financeiro-mes-tabs" role="tablist" aria-label="Competência">
          {mesTabs.map((mes) => (
            <button
              key={mes}
              type="button"
              role="tab"
              aria-selected={mes === competencia}
              className={`financeiro-mes-tab ${mes === competencia ? 'financeiro-mes-tab--active' : ''} ${mes === competenciaAtual ? 'financeiro-mes-tab--atual' : ''}`}
              onClick={() => irParaCompetencia(mes)}
            >
              {labelDemonstrativoCompetenciaCurta(mes)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="financeiro-mes-nav"
          aria-label="Próximo mês"
          onClick={() => deslocarMeses(1)}
        >
          <ChevronRight size={18} />
        </button>
        {competencia !== competenciaAtual && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCompetencia(competenciaAtual)
              setMesJanela(competenciaAtual)
            }}
          >
            Mês atual
          </Button>
        )}
      </div>

      <div className="financeiro-status-tabs demonstrativos-abas" role="tablist" aria-label="Demonstrativos">
        {ABAS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={aba === tab.id}
              className={`financeiro-status-tab ${aba === tab.id ? 'financeiro-status-tab--active' : ''}`}
              onClick={() => setAba(tab.id)}
            >
              <Icon size={16} strokeWidth={1.8} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {erro && (
        <Alert variant="error" style={{ marginBottom: 16 }}>
          {erro}
        </Alert>
      )}

      {loading ? (
        <p className="vendas-loading">Carregando demonstrativos...</p>
      ) : !data ? (
        <p className="comissoes-empty">Não foi possível carregar os dados.</p>
      ) : (
        <>
          {aba === 'ebitda' && <AbaEbitda data={data} />}
          {aba === 'dre' && <AbaDre data={data} />}
          {aba === 'cmv' && <AbaCmv data={data} />}
          {aba === 'contas' && <AbaContas data={data} />}
          {aba === 'compras' && <AbaCompras data={data} />}
        </>
      )}
    </Layout>
  )
}

function AbaEbitda({ data }: { data: DemonstrativoCompleto }) {
  return (
    <>
      <div className="comissoes-cards-resumo">
        <div className="comissoes-card-resumo demonstrativos-card--ebitda">
          <div className="comissoes-card-resumo__icon">
            <TrendingUp size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">EBITDA</span>
            <span className={`comissoes-card-resumo__value ${signedClass(data.ebitda)}`}>
              {formatCurrency(data.ebitda)}
            </span>
            <span className="comissoes-card-resumo__hint">
              {labelDemonstrativoPeriodo(data.periodo)} · margem {formatPct(data.margemEbitdaPct)}
            </span>
          </div>
        </div>

        <div className="comissoes-card-resumo demonstrativos-card--lucro">
          <div className="comissoes-card-resumo__icon">
            <Receipt size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">Receita líquida</span>
            <span className="comissoes-card-resumo__value">{formatCurrency(data.receita)}</span>
            <span className="comissoes-card-resumo__hint">
              {data.qtdVendas} venda(s) · ticket {formatCurrency(data.ticketMedio)}
            </span>
          </div>
        </div>

        <div className="comissoes-card-resumo demonstrativos-card--cmv">
          <div className="comissoes-card-resumo__icon">
            <Wallet size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">Despesas operacionais</span>
            <span className="comissoes-card-resumo__value">{formatCurrency(data.despesasOperacionais)}</span>
            <span className="comissoes-card-resumo__hint">
              Comissões + contas + cashback gerado
            </span>
          </div>
        </div>
      </div>

      <section className="comissoes-section">
        <h3 className="comissoes-section-title">Como o EBITDA é formado</h3>
        <div className="fluxo-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Composição</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'right' }}>% da receita</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Receita líquida</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(data.receita)}</td>
                <td style={{ textAlign: 'right' }}>{data.receita > 0 ? '100,0%' : '—'}</td>
              </tr>
              <tr>
                <td>(−) CMV</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(data.cmv)}</td>
                <td style={{ textAlign: 'right' }}>{formatPct(data.cmvSobreReceitaPct)}</td>
              </tr>
              <tr>
                <td>Lucro bruto</td>
                <td style={{ textAlign: 'right' }} className={signedClass(data.lucroBruto)}>
                  {formatCurrency(data.lucroBruto)}
                </td>
                <td style={{ textAlign: 'right' }}>{formatPct(data.margemBrutaPct)}</td>
              </tr>
              <tr>
                <td>(−) Comissões</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(data.comissoes)}</td>
                <td style={{ textAlign: 'right' }}>{formatPct(pct(data.comissoes, data.receita))}</td>
              </tr>
              <tr>
                <td>(−) Contas fixas</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(data.despesasFixas.total)}</td>
                <td style={{ textAlign: 'right' }}>
                  {formatPct(pct(data.despesasFixas.total, data.receita))}
                </td>
              </tr>
              <tr>
                <td>(−) Contas variáveis</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(data.despesasVariaveis.total)}</td>
                <td style={{ textAlign: 'right' }}>
                  {formatPct(pct(data.despesasVariaveis.total, data.receita))}
                </td>
              </tr>
              <tr>
                <td>(−) Cashback gerado</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(data.cashbackGerado)}</td>
                <td style={{ textAlign: 'right' }}>
                  {formatPct(pct(data.cashbackGerado, data.receita))}
                </td>
              </tr>
              <tr className="demonstrativos-row--destaque">
                <td>EBITDA</td>
                <td style={{ textAlign: 'right' }} className={signedClass(data.ebitda)}>
                  {formatCurrency(data.ebitda)}
                </td>
                <td style={{ textAlign: 'right' }}>{formatPct(data.margemEbitdaPct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="demonstrativos-nota">
          EBITDA = lucro bruto − despesas operacionais do mês. Contas usam a competência do mês
          selecionado (não canceladas). Compras de estoque não entram aqui — o custo aparece no
          CMV quando o produto é vendido. Sem juros, impostos e depreciação no cadastro, o lucro
          líquido estimado coincide com o EBITDA.
        </p>
      </section>
    </>
  )
}

function AbaDre({ data }: { data: DemonstrativoCompleto }) {
  return (
    <>
      <div className="comissoes-cards-resumo">
        <div className="comissoes-card-resumo demonstrativos-card--lucro">
          <div className="comissoes-card-resumo__icon">
            <FileSpreadsheet size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">Lucro líquido estimado</span>
            <span className={`comissoes-card-resumo__value ${signedClass(data.lucroLiquido)}`}>
              {formatCurrency(data.lucroLiquido)}
            </span>
            <span className="comissoes-card-resumo__hint">
              margem {formatPct(data.margemLiquidaPct)} · {data.periodoLabel}
            </span>
          </div>
        </div>
        <div className="comissoes-card-resumo demonstrativos-card--ebitda">
          <div className="comissoes-card-resumo__icon">
            <TrendingUp size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">Lucro bruto</span>
            <span className={`comissoes-card-resumo__value ${signedClass(data.lucroBruto)}`}>
              {formatCurrency(data.lucroBruto)}
            </span>
            <span className="comissoes-card-resumo__hint">margem {formatPct(data.margemBrutaPct)}</span>
          </div>
        </div>
        <div className="comissoes-card-resumo demonstrativos-card--cmv">
          <div className="comissoes-card-resumo__icon">
            <Package size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">Receita bruta</span>
            <span className="comissoes-card-resumo__value">{formatCurrency(data.receitaBruta)}</span>
            <span className="comissoes-card-resumo__hint">
              descontos {formatCurrency(data.descontos)}
            </span>
          </div>
        </div>
      </div>

      <section className="comissoes-section">
        <h3 className="comissoes-section-title">Demonstração do resultado do exercício</h3>
        <div className="fluxo-table-wrap">
          <table className="table demonstrativos-dre-table">
            <thead>
              <tr>
                <th>Conta</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'right' }}>% da receita líquida</th>
              </tr>
            </thead>
            <tbody>
              {data.dre.map((linha) => (
                <tr
                  key={linha.id}
                  className={[
                    linha.tipo === 'resultado' || linha.tipo === 'subtotal'
                      ? 'demonstrativos-row--destaque'
                      : '',
                    linha.nivel === 1 ? 'demonstrativos-dre-row--nested' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <td>
                    <span className="demonstrativos-dre-label">
                      {linha.sinal ? `${linha.sinal} ` : ''}
                      {linha.label}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }} className={signedClass(linha.valor)}>
                    {formatCurrency(linha.valor)}
                  </td>
                  <td style={{ textAlign: 'right' }}>{formatPct(linha.pctReceita)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="demonstrativos-nota">
          Regime de competência: vendas concluídas no mês; contas a pagar pela competência do
          mês; CMV pelo custo da saída da venda (ou custo do cadastro). Entradas de estoque
          (compras) não são despesa do DRE — viram CMV na venda.
          {data.qtdVendasCanceladas > 0
            ? ` ${data.qtdVendasCanceladas} venda(s) cancelada(s) no mês foram ignoradas.`
            : ''}
        </p>
      </section>
    </>
  )
}

function AbaCmv({ data }: { data: DemonstrativoCompleto }) {
  const receitaItens = data.cmvItens.reduce((s, i) => s + i.receita, 0)
  const lucroItens = data.cmvItens.reduce((s, i) => s + i.lucro, 0)

  return (
    <>
      <div className="comissoes-cards-resumo">
        <div className="comissoes-card-resumo demonstrativos-card--cmv">
          <div className="comissoes-card-resumo__icon">
            <Package size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">CMV total</span>
            <span className="comissoes-card-resumo__value">{formatCurrency(data.cmv)}</span>
            <span className="comissoes-card-resumo__hint">
              {formatPct(data.cmvSobreReceitaPct)} da receita · {data.cmvItens.length} produto(s)
            </span>
          </div>
        </div>
        <div className="comissoes-card-resumo demonstrativos-card--lucro">
          <div className="comissoes-card-resumo__icon">
            <Receipt size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">Receita dos itens</span>
            <span className="comissoes-card-resumo__value">{formatCurrency(receitaItens)}</span>
            <span className="comissoes-card-resumo__hint">soma dos itens vendidos</span>
          </div>
        </div>
        <div className="comissoes-card-resumo demonstrativos-card--ebitda">
          <div className="comissoes-card-resumo__icon">
            <TrendingUp size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">Lucro bruto dos itens</span>
            <span className={`comissoes-card-resumo__value ${signedClass(lucroItens)}`}>
              {formatCurrency(lucroItens)}
            </span>
            <span className="comissoes-card-resumo__hint">
              margem {formatPct(pct(lucroItens, receitaItens))}
            </span>
          </div>
        </div>
      </div>

      <section className="comissoes-section">
        <h3 className="comissoes-section-title">Detalhe por produto</h3>
        {data.cmvItens.length === 0 ? (
          <p className="comissoes-empty">Nenhum produto vendido no período.</p>
        ) : (
          <div className="fluxo-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th style={{ textAlign: 'right' }}>Qtd</th>
                  <th style={{ textAlign: 'right' }}>Custo unit.</th>
                  <th style={{ textAlign: 'right' }}>CMV</th>
                  <th style={{ textAlign: 'right' }}>Receita</th>
                  <th style={{ textAlign: 'right' }}>Lucro</th>
                  <th style={{ textAlign: 'right' }}>Margem</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {data.cmvItens.map((item) => (
                  <tr key={item.produto_id}>
                    <td>{item.nome}</td>
                    <td style={{ textAlign: 'right' }}>{formatQty(item.quantidade)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.custo_unitario)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.custo_total)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.receita)}</td>
                    <td style={{ textAlign: 'right' }} className={signedClass(item.lucro)}>
                      {formatCurrency(item.lucro)}
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatPct(item.margemPct)}</td>
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
        )}
        <p className="demonstrativos-nota">
          Origem Estoque = custo na saída da venda. Cadastro = custo atual do produto quando não há
          movimento de estoque. Misto = parte de cada fonte.
        </p>
      </section>
    </>
  )
}

function AbaContas({ data }: { data: DemonstrativoCompleto }) {
  const totalGeral = data.despesasFixas.total + data.despesasVariaveis.total
  const pagoGeral = data.despesasFixas.pago + data.despesasVariaveis.pago
  const pendenteGeral = data.despesasFixas.pendente + data.despesasVariaveis.pendente

  return (
    <>
      <div className="comissoes-cards-resumo">
        <div className="comissoes-card-resumo demonstrativos-card--cmv">
          <div className="comissoes-card-resumo__icon">
            <Wallet size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">Total de contas</span>
            <span className="comissoes-card-resumo__value">{formatCurrency(totalGeral)}</span>
            <span className="comissoes-card-resumo__hint">
              {data.despesasFixas.qtd + data.despesasVariaveis.qtd} título(s) no período
            </span>
          </div>
        </div>
        <div className="comissoes-card-resumo demonstrativos-card--ebitda">
          <div className="comissoes-card-resumo__icon">
            <Receipt size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">Fixas</span>
            <span className="comissoes-card-resumo__value">
              {formatCurrency(data.despesasFixas.total)}
            </span>
            <span className="comissoes-card-resumo__hint">
              {formatPct(pct(data.despesasFixas.total, totalGeral))} do total ·{' '}
              {data.despesasFixas.qtd} conta(s)
            </span>
          </div>
        </div>
        <div className="comissoes-card-resumo demonstrativos-card--lucro">
          <div className="comissoes-card-resumo__icon">
            <ShoppingCart size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">Variáveis (avulsas)</span>
            <span className="comissoes-card-resumo__value">
              {formatCurrency(data.despesasVariaveis.total)}
            </span>
            <span className="comissoes-card-resumo__hint">
              {formatPct(pct(data.despesasVariaveis.total, totalGeral))} do total ·{' '}
              {data.despesasVariaveis.qtd} conta(s)
            </span>
          </div>
        </div>
      </div>

      <div className="demonstrativos-cmv-resumo" style={{ marginTop: 8 }}>
        <span>
          Pagas: <strong>{formatCurrency(pagoGeral)}</strong>
        </span>
        <span>
          Pendentes: <strong>{formatCurrency(pendenteGeral)}</strong>
        </span>
      </div>

      <section className="comissoes-section">
        <h3 className="comissoes-section-title">Contas fixas</h3>
        <ContasGrupoTable grupo={data.despesasFixas} empty="Nenhuma conta fixa com vencimento no período." />
      </section>

      <section className="comissoes-section">
        <h3 className="comissoes-section-title">Contas variáveis (avulsas)</h3>
        <ContasGrupoTable
          grupo={data.despesasVariaveis}
          empty="Nenhuma conta variável com vencimento no período."
        />
      </section>

      <p className="demonstrativos-nota">
        Classificação: tipo FIXA (recorrentes geradas das contas fixas) e AVULSA (lançamentos
        variáveis). Filtro pela competência do mês selecionado; canceladas não entram nos totais.
      </p>
    </>
  )
}

function ContasGrupoTable({
  grupo,
  empty,
}: {
  grupo: DemonstrativoCompleto['despesasFixas']
  empty: string
}) {
  if (grupo.itens.length === 0) {
    return <p className="comissoes-empty">{empty}</p>
  }

  return (
    <>
      {grupo.porCategoria.length > 0 && (
        <div className="fluxo-table-wrap" style={{ marginBottom: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th style={{ textAlign: 'right' }}>Qtd</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'right' }}>% do grupo</th>
              </tr>
            </thead>
            <tbody>
              {grupo.porCategoria.map((c) => (
                <tr key={c.categoria}>
                  <td>{c.categoria}</td>
                  <td style={{ textAlign: 'right' }}>{c.qtd}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(c.valor)}</td>
                  <td style={{ textAlign: 'right' }}>{formatPct(c.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="fluxo-table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {grupo.itens.map((item) => (
              <tr key={item.id}>
                <td>{item.descricao}</td>
                <td>{item.categoria_nome || '—'}</td>
                <td>{formatDate(item.vencimento)}</td>
                <td>
                  <span
                    className={`demonstrativos-fonte demonstrativos-fonte--status-${item.status.toLowerCase()}`}
                  >
                    {statusContaLabel(item.status)}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(item.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function AbaCompras({ data }: { data: DemonstrativoCompleto }) {
  return (
    <>
      <div className="comissoes-cards-resumo">
        <div className="comissoes-card-resumo demonstrativos-card--cmv">
          <div className="comissoes-card-resumo__icon">
            <ShoppingCart size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">Gasto em compras</span>
            <span className="comissoes-card-resumo__value">{formatCurrency(data.compras.total)}</span>
            <span className="comissoes-card-resumo__hint">
              entradas de estoque · {data.periodoLabel}
            </span>
          </div>
        </div>
        <div className="comissoes-card-resumo demonstrativos-card--lucro">
          <div className="comissoes-card-resumo__icon">
            <Package size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">Produtos</span>
            <span className="comissoes-card-resumo__value">{data.compras.qtdProdutos}</span>
            <span className="comissoes-card-resumo__hint">
              qtd total {formatQty(data.compras.quantidade)}
            </span>
          </div>
        </div>
        <div className="comissoes-card-resumo demonstrativos-card--ebitda">
          <div className="comissoes-card-resumo__icon">
            <TrendingUp size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">vs CMV do período</span>
            <span className="comissoes-card-resumo__value">{formatCurrency(data.cmv)}</span>
            <span className="comissoes-card-resumo__hint">
              diferença compra − CMV:{' '}
              {formatCurrency(data.compras.total - data.cmv)}
            </span>
          </div>
        </div>
      </div>

      <section className="comissoes-section">
        <h3 className="comissoes-section-title">Entradas de estoque por produto</h3>
        {data.compras.itens.length === 0 ? (
          <p className="comissoes-empty">Nenhuma entrada de estoque no período.</p>
        ) : (
          <div className="fluxo-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th style={{ textAlign: 'right' }}>Qtd</th>
                  <th style={{ textAlign: 'right' }}>Custo médio</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Movimentos</th>
                  <th>Última entrada</th>
                </tr>
              </thead>
              <tbody>
                {data.compras.itens.map((item) => (
                  <tr key={item.produto_id}>
                    <td>{item.nome}</td>
                    <td style={{ textAlign: 'right' }}>{formatQty(item.quantidade)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.custo_unitario)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.custo_total)}</td>
                    <td style={{ textAlign: 'right' }}>{item.qtd_movimentos}</td>
                    <td>{formatDate(item.ultima_entrada)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="demonstrativos-nota">
          Compras = movimentos de estoque do tipo ENTRADA × custo unitário. Isso reforça o estoque
          (ativo); no resultado, o custo só aparece no CMV quando há venda. A diferença compra − CMV
          indica formação ou consumo de estoque no período.
        </p>
      </section>
    </>
  )
}

function pct(parte: number, base: number): number | null {
  return base > 0 ? (parte / base) * 100 : null
}
