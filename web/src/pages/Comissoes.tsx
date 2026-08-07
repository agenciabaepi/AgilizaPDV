import { useState, useEffect, useCallback, useMemo } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useSyncDataRefresh } from '../hooks/useSyncDataRefresh'
import { PageTitle, Button, Input, Alert, Dialog, useOperationToast } from '../components/ui'
import {
  Calendar,
  DollarSign,
  Printer,
  Target,
  TrendingUp,
  Users,
  Package,
  Receipt,
  Settings,
  ChevronDown,
  Eye,
} from 'lucide-react'
import { VendaDetalhesDialog } from '../components/VendaDetalhesDialog'
import type { Usuario } from '../vite-env'
import {
  loadComissaoRelatorio,
  saveComissaoConfigPadrao,
  labelComissaoPeriodo,
  type ComissaoPeriodo,
  type ComissaoRelatorio,
} from '../lib/comissoes-data'
import { comissaoRelatorioToHtml } from '../lib/comissao-print'
import { webPrintHtml } from '../lib/web-print'

const PERIODOS: { id: ComissaoPeriodo; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mês' },
]

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPct(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`
}

export function Comissoes() {
  const { session } = useAuth()
  const syncRefreshKey = useSyncDataRefresh()
  const op = useOperationToast()
  const empresaId = session?.empresa_id ?? ''
  const userId = session?.id ?? ''
  const role = session && 'role' in session ? String(session.role).toLowerCase() : ''
  const isManager = role === 'admin' || role === 'gerente'

  const [periodo, setPeriodo] = useState<ComissaoPeriodo>('mes')
  const [vendedorId, setVendedorId] = useState<string>('')
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [relatorio, setRelatorio] = useState<ComissaoRelatorio | null>(null)
  const [loading, setLoading] = useState(true)
  const [imprimindo, setImprimindo] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [configPadrao, setConfigPadrao] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [visualizarVendaId, setVisualizarVendaId] = useState<string | null>(null)
  const [visualizarVendaComissao, setVisualizarVendaComissao] = useState<{
    percentual: number
    valor: number
  } | null>(null)

  const vendedorFiltro = useMemo(() => {
    if (!isManager) return userId
    return vendedorId || null
  }, [isManager, userId, vendedorId])

  const loadUsuarios = useCallback(async () => {
    if (!empresaId) return
    try {
      const list = await window.electronAPI.usuarios.list(empresaId)
      setUsuarios(list)
    } catch {
      setUsuarios([])
    }
  }, [empresaId])

  const loadRelatorio = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    try {
      const data = await loadComissaoRelatorio(empresaId, periodo, {
        usuarioId: vendedorFiltro,
      })
      setRelatorio(data)
      setConfigPadrao(String(data.config.comissao_percentual_padrao))
    } catch (err) {
      op.error(err instanceof Error ? err.message : 'Erro ao carregar comissões.')
      setRelatorio(null)
    } finally {
      setLoading(false)
    }
  }, [empresaId, periodo, vendedorFiltro, syncRefreshKey, op])

  useEffect(() => {
    loadUsuarios()
  }, [loadUsuarios, syncRefreshKey])

  useEffect(() => {
    loadRelatorio()
  }, [loadRelatorio])

  const totais = useMemo(() => {
    if (!relatorio) return { vendido: 0, comissao: 0, vendas: 0, vendedores: 0 }
    return {
      vendido: relatorio.vendedores.reduce((acc, v) => acc + v.total_vendido, 0),
      comissao: relatorio.vendedores.reduce((acc, v) => acc + v.total_comissao, 0),
      vendas: relatorio.vendas.length,
      vendedores: relatorio.vendedores.filter((v) => v.qtd_vendas > 0).length,
    }
  }, [relatorio])

  const handleImprimir = async () => {
    if (!relatorio) return
    setImprimindo(true)
    try {
      const html = comissaoRelatorioToHtml(relatorio, new Date())
      const result = webPrintHtml(html)
      if (!result.ok) {
        op.error(result.error ?? 'Falha ao imprimir.')
      }
    } finally {
      setImprimindo(false)
    }
  }

  const handleSalvarConfig = async () => {
    if (!empresaId) return
    const valor = parseFloat(configPadrao.replace(',', '.'))
    if (Number.isNaN(valor) || valor < 0 || valor > 100) {
      op.error('Informe um percentual entre 0 e 100.')
      return
    }
    setSavingConfig(true)
    try {
      await saveComissaoConfigPadrao(empresaId, valor)
      op.saved('Configuração salva.')
      setConfigOpen(false)
      loadRelatorio()
    } catch (err) {
      op.error(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSavingConfig(false)
    }
  }

  const vendedoresAtivos = useMemo(
    () => usuarios.filter((u) => ['caixa', 'gerente', 'admin'].includes(u.role)),
    [usuarios]
  )

  if (!empresaId) {
    return (
      <Layout>
        <PageTitle title="Comissões" subtitle="Sessão inválida." />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="comissoes-page-header">
        <PageTitle
          title="Comissões de vendedores"
          subtitle="Relatório de vendas, metas e comissões por vendedor"
        />
        <div className="comissoes-page-actions">
          {isManager && (
            <Button variant="secondary" leftIcon={<Settings size={16} />} onClick={() => setConfigOpen(true)}>
              Configurar
            </Button>
          )}
          <Button
            leftIcon={<Printer size={16} />}
            onClick={handleImprimir}
            disabled={!relatorio || imprimindo}
          >
            {imprimindo ? 'Imprimindo...' : 'Imprimir relatório'}
          </Button>
        </div>
      </div>

      <div className="comissoes-cards-resumo">
        <div className="comissoes-card-resumo comissoes-card-resumo--vendido">
          <div className="comissoes-card-resumo__icon">
            <DollarSign size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">Total vendido</span>
            <span className="comissoes-card-resumo__value">{formatCurrency(totais.vendido)}</span>
            <span className="comissoes-card-resumo__hint">{labelComissaoPeriodo(periodo)} · PDV concluídas</span>
          </div>
        </div>
        <div className="comissoes-card-resumo comissoes-card-resumo--comissao">
          <div className="comissoes-card-resumo__icon">
            <TrendingUp size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">Comissão total</span>
            <span className="comissoes-card-resumo__value">{formatCurrency(totais.comissao)}</span>
            <span className="comissoes-card-resumo__hint">Calculada sobre o total vendido</span>
          </div>
        </div>
        <div className="comissoes-card-resumo comissoes-card-resumo--vendas">
          <div className="comissoes-card-resumo__icon">
            <Receipt size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">Vendas</span>
            <span className="comissoes-card-resumo__value">{totais.vendas}</span>
            <span className="comissoes-card-resumo__hint">{totais.vendedores} vendedor(es) com vendas</span>
          </div>
        </div>
        <div className="comissoes-card-resumo comissoes-card-resumo--meta">
          <div className="comissoes-card-resumo__icon">
            <Target size={22} strokeWidth={1.8} />
          </div>
          <div className="comissoes-card-resumo__content">
            <span className="comissoes-card-resumo__label">Meta mensal</span>
            <span className="comissoes-card-resumo__value">
              {relatorio?.vendedores.some((v) => v.meta_vendas_mes != null && v.meta_vendas_mes > 0)
                ? `${relatorio.vendedores.filter((v) => v.percentual_meta != null && v.percentual_meta >= 100).length}/${relatorio.vendedores.filter((v) => v.meta_vendas_mes != null && v.meta_vendas_mes > 0).length} atingidas`
                : '—'}
            </span>
            <span className="comissoes-card-resumo__hint">Progresso no mês corrente</span>
          </div>
        </div>
      </div>

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
        {isManager && (
          <div className="comissoes-filtro-vendedor">
            <Users size={18} />
            <select
              value={vendedorId}
              onChange={(e) => setVendedorId(e.target.value)}
              className="comissoes-select"
            >
              <option value="">Todos os vendedores</option>
              {vendedoresAtivos.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!isManager && (
        <Alert variant="info" style={{ marginBottom: 16 }}>
          Você está visualizando apenas suas vendas e comissões.
        </Alert>
      )}

      <div className="comissoes-print-area">
        {loading ? (
          <p className="comissoes-loading">Carregando relatório...</p>
        ) : !relatorio ? (
          <p className="comissoes-empty">Não foi possível carregar os dados.</p>
        ) : (
          <>
            <section className="comissoes-section">
              <h3 className="comissoes-section-title">
                <Users size={18} />
                Resumo por vendedor
              </h3>
              {relatorio.vendedores.length === 0 ? (
                <p className="comissoes-empty">Nenhum vendedor cadastrado.</p>
              ) : (
                <div className="table-responsive">
                  <table className="comissoes-table">
                    <thead>
                      <tr>
                        <th>Vendedor</th>
                        <th>Vendas</th>
                        <th>Total vendido</th>
                        <th>% Comissão</th>
                        <th>Comissão</th>
                        <th>Meta mensal</th>
                        <th>Progresso meta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatorio.vendedores.map((v) => (
                        <tr key={v.usuario_id}>
                          <td className="comissoes-table__nome">{v.nome}</td>
                          <td>{v.qtd_vendas}</td>
                          <td>{formatCurrency(v.total_vendido)}</td>
                          <td>{formatPct(v.comissao_percentual)}</td>
                          <td className="comissoes-table__destaque">{formatCurrency(v.total_comissao)}</td>
                          <td>{v.meta_vendas_mes != null ? formatCurrency(v.meta_vendas_mes) : '—'}</td>
                          <td>
                            {v.meta_vendas_mes != null && v.meta_vendas_mes > 0 ? (
                              <div className="comissoes-meta-bar-wrap">
                                <div className="comissoes-meta-bar">
                                  <div
                                    className="comissoes-meta-bar__fill"
                                    style={{ width: `${Math.min(100, v.percentual_meta ?? 0)}%` }}
                                  />
                                </div>
                                <span className="comissoes-meta-bar__label">
                                  {formatPct(v.percentual_meta ?? 0)} · {formatCurrency(v.vendido_mes_atual)}
                                </span>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {relatorio.vendedores.some((v) => v.qtd_vendas > 0) && (
                      <tfoot>
                        <tr>
                          <td><strong>Total</strong></td>
                          <td>{totais.vendas}</td>
                          <td><strong>{formatCurrency(totais.vendido)}</strong></td>
                          <td />
                          <td><strong>{formatCurrency(totais.comissao)}</strong></td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </section>

            <section className="comissoes-section">
              <h3 className="comissoes-section-title">
                <Receipt size={18} />
                Detalhamento das vendas
              </h3>
              {relatorio.vendas.length === 0 ? (
                <p className="comissoes-empty">Nenhuma venda concluída no período selecionado.</p>
              ) : (
                <div className="table-responsive">
                  <table className="comissoes-table comissoes-table--detalhes">
                    <thead>
                      <tr>
                        <th>Nº</th>
                        <th>Data / Hora</th>
                        <th>Vendedor</th>
                        <th>Total</th>
                        <th>%</th>
                        <th>Comissão</th>
                        <th className="comissoes-table__acoes-col" />
                      </tr>
                    </thead>
                    <tbody>
                      {relatorio.vendas.map((v) => (
                        <tr key={v.venda_id}>
                          <td>#{v.numero}</td>
                          <td>
                            {new Date(v.created_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td>{v.vendedor_nome}</td>
                          <td>{formatCurrency(v.total)}</td>
                          <td>{formatPct(v.comissao_percentual)}</td>
                          <td className="comissoes-table__destaque">{formatCurrency(v.comissao_valor)}</td>
                          <td className="comissoes-table__acoes-col">
                            <button
                              type="button"
                              className="comissoes-acao-btn"
                              onClick={() => {
                                setVisualizarVendaComissao({
                                  percentual: v.comissao_percentual,
                                  valor: v.comissao_valor,
                                })
                                setVisualizarVendaId(v.venda_id)
                              }}
                            >
                              <Eye size={14} />
                              <span>Detalhes</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="comissoes-section">
              <h3 className="comissoes-section-title">
                <Package size={18} />
                Produtos mais vendidos
              </h3>
              {relatorio.topProdutos.length === 0 ? (
                <p className="comissoes-empty">Nenhum produto vendido no período.</p>
              ) : (
                <>
                  <div className="comissoes-top-produtos">
                    {relatorio.topProdutos.slice(0, 5).map((p, idx) => (
                      <div key={p.produto_id} className="comissoes-top-produto-card">
                        <span className="comissoes-top-produto-card__rank">#{idx + 1}</span>
                        <div className="comissoes-top-produto-card__info">
                          <span className="comissoes-top-produto-card__nome">{p.descricao}</span>
                          <span className="comissoes-top-produto-card__stats">
                            {p.quantidade} un. · {formatCurrency(p.receita)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <details className="comissoes-top-expand">
                    <summary>
                      Ver ranking completo
                      <ChevronDown size={16} />
                    </summary>
                    <div className="table-responsive" style={{ marginTop: 12 }}>
                      <table className="comissoes-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Produto</th>
                            <th>Quantidade</th>
                            <th>Receita</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatorio.topProdutos.map((p, idx) => (
                            <tr key={p.produto_id}>
                              <td>{idx + 1}</td>
                              <td>{p.descricao}</td>
                              <td>{p.quantidade}</td>
                              <td>{formatCurrency(p.receita)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              )}
            </section>
          </>
        )}
      </div>

      <VendaDetalhesDialog
        vendaId={visualizarVendaId}
        comissao={visualizarVendaComissao}
        onClose={() => {
          setVisualizarVendaId(null)
          setVisualizarVendaComissao(null)
        }}
      />

      <Dialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Configuração de comissões"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfigOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarConfig} disabled={savingConfig}>
              {savingConfig ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 0 }}>
          Percentual padrão aplicado quando o vendedor não tem comissão individual. Configure metas e percentuais
          por vendedor em Cadastro → Usuários.
        </p>
        <Input
          label="Comissão padrão (%)"
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={configPadrao}
          onChange={(e) => setConfigPadrao((e.target as HTMLInputElement).value)}
          placeholder="Ex: 2.5"
        />
        <Alert variant="info" style={{ marginTop: 16 }}>
          Vendas online e canceladas não entram no cálculo de comissão.
        </Alert>
      </Dialog>
    </Layout>
  )
}
