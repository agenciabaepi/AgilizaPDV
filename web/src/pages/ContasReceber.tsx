import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { DashboardKpiCard } from '../components/dashboard/DashboardKpiCard'
import { PageTitle, Button, Input, Select, Dialog, Alert, useOperationToast } from '../components/ui'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  HandCoins,
  Printer,
  RefreshCw,
  Settings2,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { labelFormaPagamento } from '../lib/forma-pagamento-labels'
import type { Caixa } from '../vite-env'

type ContaReceberRow = {
  id: string
  empresa_id: string
  venda_id: string
  cliente_id: string
  valor: number
  vencimento: string
  status: string
  recebido_em: string | null
  forma_recebimento: string | null
  cliente_nome: string
  venda_numero: number
}

type VendaPrazoConfig = {
  usar_limite_credito: boolean
  bloquear_inadimplente: boolean
}

type StatusFiltro = 'aberto' | 'RECEBIDA' | 'CANCELADA' | 'todas'

type ResumoPendente = {
  totalAberto: number
  totalVencido: number
  totalAVencer7d: number
  qtdTitulos: number
  qtdVencidos: number
}

const FORMAS_RECEB: { value: string; label: string }[] = [
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'PIX', label: 'PIX' },
  { value: 'DEBITO', label: 'Cartão de débito' },
  { value: 'CREDITO', label: 'Cartão de crédito' },
  { value: 'OUTROS', label: 'Outros' },
]

const STATUS_TABS: { id: StatusFiltro; label: string }[] = [
  { id: 'aberto', label: 'Em aberto' },
  { id: 'RECEBIDA', label: 'Recebidas' },
  { id: 'CANCELADA', label: 'Canceladas' },
  { id: 'todas', label: 'Todas' },
]

function fmtMoeda(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function statusLabel(status: string): string {
  switch (status) {
    case 'PENDENTE':
      return 'Em aberto'
    case 'RECEBIDA':
      return 'Recebida'
    case 'CANCELADA':
      return 'Cancelada'
    default:
      return status
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'PENDENTE':
      return 'financeiro-status-badge financeiro-status-badge--pendente'
    case 'RECEBIDA':
      return 'financeiro-status-badge financeiro-status-badge--recebida'
    case 'CANCELADA':
      return 'financeiro-status-badge financeiro-status-badge--cancelada'
    default:
      return 'financeiro-status-badge'
  }
}

function computeResumoPendente(contas: ContaReceberRow[]): ResumoPendente {
  const hoje = new Date().toISOString().slice(0, 10)
  const em7 = new Date()
  em7.setDate(em7.getDate() + 7)
  const limite7 = em7.toISOString().slice(0, 10)

  let totalAberto = 0
  let totalVencido = 0
  let totalAVencer7d = 0
  let qtdVencidos = 0

  for (const c of contas) {
    if (c.status !== 'PENDENTE') continue
    totalAberto += c.valor
    if (c.vencimento < hoje) {
      totalVencido += c.valor
      qtdVencidos += 1
    } else if (c.vencimento <= limite7) {
      totalAVencer7d += c.valor
    }
  }

  return {
    totalAberto,
    totalVencido,
    totalAVencer7d,
    qtdTitulos: contas.filter((c) => c.status === 'PENDENTE').length,
    qtdVencidos,
  }
}

export function ContasReceber() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const userId = session?.id ?? ''
  const op = useOperationToast()

  const [contas, setContas] = useState<ContaReceberRow[]>([])
  const [resumo, setResumo] = useState<ResumoPendente | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [clienteFiltro, setClienteFiltro] = useState('')
  const [vencimentoDe, setVencimentoDe] = useState('')
  const [vencimentoAte, setVencimentoAte] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('aberto')
  const [cfg, setCfg] = useState<VendaPrazoConfig | null>(null)
  const [caixaAberto, setCaixaAberto] = useState<Caixa | null>(null)
  const [receberConta, setReceberConta] = useState<ContaReceberRow | null>(null)
  const [formaRecebimento, setFormaRecebimento] = useState('DINHEIRO')
  const [recebendo, setRecebendo] = useState(false)
  const [imprimindoId, setImprimindoId] = useState<string | null>(null)

  const api = window.electronAPI?.contasReceber

  const load = useCallback(async () => {
    if (!empresaId || !api?.list) return
    setLoading(true)
    setLoadError(null)
    try {
      const listOpts = {
        status: statusFiltro,
        limit: 500,
        vencimento_de: vencimentoDe || undefined,
        vencimento_ate: vencimentoAte || undefined,
      }
      const rowsPromise = api.list(empresaId, listOpts)
      const pendingPromise =
        statusFiltro === 'aberto'
          ? rowsPromise
          : api.list(empresaId, { status: 'aberto', limit: 2000 })

      const [rows, pendingRows] = await Promise.all([rowsPromise, pendingPromise])
      const list = Array.isArray(rows) ? (rows as ContaReceberRow[]) : []
      const pending = Array.isArray(pendingRows) ? (pendingRows as ContaReceberRow[]) : list
      setContas(list)
      setResumo(computeResumoPendente(pending))
    } catch (e) {
      setContas([])
      setResumo(null)
      setLoadError(e instanceof Error ? e.message : 'Erro ao carregar contas a receber.')
    } finally {
      setLoading(false)
    }
  }, [empresaId, api, statusFiltro, vencimentoDe, vencimentoAte])

  const loadCfg = useCallback(async () => {
    if (!empresaId || !api?.getVendaPrazoConfig) return
    try {
      const c = (await api.getVendaPrazoConfig(empresaId)) as VendaPrazoConfig
      setCfg(c)
    } catch {
      setCfg({ usar_limite_credito: false, bloquear_inadimplente: false })
    }
  }, [empresaId, api])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadCfg()
  }, [loadCfg])

  useEffect(() => {
    if (!empresaId || !window.electronAPI?.caixa?.getAberto) return
    window.electronAPI.caixa.getAberto(empresaId).then(setCaixaAberto).catch(() => setCaixaAberto(null))
  }, [empresaId])

  const contasFiltradas = useMemo(() => {
    if (!clienteFiltro.trim()) return contas
    const t = clienteFiltro.trim().toLowerCase()
    return contas.filter((c) => c.cliente_nome.toLowerCase().includes(t))
  }, [contas, clienteFiltro])

  const totalListado = useMemo(
    () => contasFiltradas.reduce((acc, c) => acc + c.valor, 0),
    [contasFiltradas]
  )

  const salvarCfg = async () => {
    if (!empresaId || !api?.updateVendaPrazoConfig || !cfg) return
    try {
      await api.updateVendaPrazoConfig(empresaId, cfg)
      op.saved('Configurações salvas.')
    } catch (e) {
      op.failed(e, 'Erro ao salvar.')
    }
  }

  const imprimirRecibo = async (contaId: string) => {
    const imprimir = window.electronAPI?.cupom?.imprimirReciboRecebimento
    if (typeof imprimir !== 'function') {
      op.warn('Impressão de comprovante não disponível.')
      return
    }
    setImprimindoId(contaId)
    try {
      const r = await imprimir(contaId)
      if (r && !r.ok && r.error) op.warn(`Comprovante não impresso: ${r.error}`)
    } catch (e) {
      op.failed(e, 'Erro ao imprimir comprovante.')
    } finally {
      setImprimindoId(null)
    }
  }

  const confirmarReceber = async () => {
    if (!receberConta || !caixaAberto || !empresaId || !api?.receber) return
    setRecebendo(true)
    try {
      const contaIdParaRecibo = receberConta.id
      await api.receber({
        conta_id: contaIdParaRecibo,
        empresa_id: empresaId,
        caixa_id: caixaAberto.id,
        usuario_id: userId,
        forma: formaRecebimento as 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'OUTROS',
      })
      op.saved('Recebimento registrado no caixa.')
      setReceberConta(null)
      await imprimirRecibo(contaIdParaRecibo)
      await load()
      const cx = await window.electronAPI?.caixa?.getAberto(empresaId)
      setCaixaAberto(cx ?? null)
    } catch (e) {
      op.failed(e, 'Erro ao receber.')
    } finally {
      setRecebendo(false)
    }
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const vencido = (v: string) => v < hoje

  if (!api) {
    return (
      <Layout>
        <PageTitle title="Contas a receber" subtitle="Títulos em aberto, recebimentos e regras de venda a prazo." />
        <Alert variant="danger">
          Módulo de contas a receber indisponível neste ambiente. Atualize o aplicativo ou entre em contato com o suporte.
        </Alert>
      </Layout>
    )
  }

  return (
    <Layout>
      <PageTitle title="Contas a receber" subtitle="Gestão de títulos, recebimentos, inadimplência e crédito do cliente." />

      <div className="financeiro-toolbar-row financeiro-toolbar-row--between">
        <div className="financeiro-status-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`financeiro-status-tab ${statusFiltro === tab.id ? 'financeiro-status-tab--active' : ''}`}
              onClick={() => setStatusFiltro(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button leftIcon={<RefreshCw size={16} />} variant="secondary" onClick={() => load()} disabled={loading}>
          Atualizar
        </Button>
      </div>

      {resumo && (
        <section className="dashboard-kpis dashboard-kpis--compact financeiro-kpis">
          <DashboardKpiCard
            label="Total em aberto"
            value={fmtMoeda(resumo.totalAberto)}
            hint={`${resumo.qtdTitulos} título(s) pendente(s)`}
            icon={<HandCoins size={20} />}
            variant="primary"
          />
          <DashboardKpiCard
            label="Vencido"
            value={fmtMoeda(resumo.totalVencido)}
            hint={resumo.qtdVencidos > 0 ? `${resumo.qtdVencidos} título(s) em atraso` : 'Nenhum título vencido'}
            icon={<AlertTriangle size={20} />}
            variant={resumo.qtdVencidos > 0 ? 'danger' : 'neutral'}
          />
          <DashboardKpiCard
            label="A vencer (7 dias)"
            value={fmtMoeda(resumo.totalAVencer7d)}
            hint="Próximos vencimentos"
            icon={<Clock size={20} />}
            variant="warning"
          />
          <DashboardKpiCard
            label="Listagem atual"
            value={fmtMoeda(totalListado)}
            hint={`${contasFiltradas.length} registro(s) exibido(s)`}
            icon={<Calendar size={20} />}
            variant="info"
          />
        </section>
      )}

      {cfg && (
        <div className="financeiro-config-card">
          <div className="financeiro-config-head">
            <Settings2 size={18} />
            <span>Venda a prazo — regras de crédito</span>
          </div>
          <div className="financeiro-config-grid">
            <label className="financeiro-check">
              <input
                type="checkbox"
                checked={cfg.usar_limite_credito}
                onChange={(e) => setCfg({ ...cfg, usar_limite_credito: e.target.checked })}
              />
              Limitar crédito pelo campo «Limite de crédito» no cadastro do cliente
            </label>
            <label className="financeiro-check">
              <input
                type="checkbox"
                checked={cfg.bloquear_inadimplente}
                onChange={(e) => setCfg({ ...cfg, bloquear_inadimplente: e.target.checked })}
              />
              Bloquear nova venda a prazo para clientes com título vencido em aberto
            </label>
          </div>
          <Button size="sm" variant="secondary" onClick={salvarCfg}>
            Salvar regras
          </Button>
        </div>
      )}

      <div className="financeiro-form-wrap financeiro-form-wrap--filtro">
        <Input
          label="Filtrar por cliente"
          placeholder="Nome do cliente"
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
        />
        <Input
          label="Vencimento de"
          type="date"
          value={vencimentoDe}
          onChange={(e) => setVencimentoDe(e.target.value)}
        />
        <Input
          label="Vencimento até"
          type="date"
          value={vencimentoAte}
          onChange={(e) => setVencimentoAte(e.target.value)}
        />
        {(vencimentoDe || vencimentoAte || clienteFiltro) && (
          <Button
            variant="outline"
            onClick={() => {
              setClienteFiltro('')
              setVencimentoDe('')
              setVencimentoAte('')
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {statusFiltro === 'aberto' && !caixaAberto && (
        <Alert variant="warning" style={{ marginBottom: 'var(--space-3)' }}>
          Abra o caixa no PDV para registrar recebimentos — o valor será lançado no caixa atual pela forma escolhida.
        </Alert>
      )}

      {loadError && (
        <Alert variant="danger" style={{ marginBottom: 'var(--space-3)' }}>
          {loadError}
          {loadError.toLowerCase().includes('contas_receber') && (
            <span>
              {' '}
              Execute o script <code>docs/supabase-venda-a-prazo-migracao.sql</code> no Supabase se ainda não criou a
              tabela.
            </span>
          )}
        </Alert>
      )}

      <div className="financeiro-lista-wrap">
        <h3 className="financeiro-lista-title">
          {statusFiltro === 'aberto' && 'Títulos em aberto'}
          {statusFiltro === 'RECEBIDA' && 'Histórico de recebimentos'}
          {statusFiltro === 'CANCELADA' && 'Títulos cancelados'}
          {statusFiltro === 'todas' && 'Todos os títulos'}
        </h3>
        {loading ? (
          <p className="financeiro-empty">Carregando…</p>
        ) : contasFiltradas.length === 0 ? (
          <p className="financeiro-empty">
            {statusFiltro === 'aberto'
              ? 'Nenhuma conta pendente. Vendas a prazo no PDV geram títulos automaticamente.'
              : 'Nenhum registro encontrado para os filtros selecionados.'}
          </p>
        ) : (
          <div className="financeiro-lista">
            {contasFiltradas.map((conta) => (
              <div key={conta.id} className="financeiro-item">
                <div className="financeiro-item-main">
                  <div className="financeiro-item-title-row">
                    <span className="financeiro-item-title">
                      {conta.cliente_nome} — Venda #{conta.venda_numero}
                    </span>
                    <span className={statusBadgeClass(conta.status)}>{statusLabel(conta.status)}</span>
                  </div>
                  <div className="financeiro-item-meta">
                    {conta.status === 'PENDENTE' && (
                      <>
                        <Calendar size={14} />
                        <span className={vencido(conta.vencimento) ? 'financeiro-vencido' : ''}>
                          Venc. {new Date(`${conta.vencimento}T12:00:00`).toLocaleDateString('pt-BR')}
                          {vencido(conta.vencimento) ? ' — vencido' : ''}
                        </span>
                      </>
                    )}
                    {conta.status === 'RECEBIDA' && conta.recebido_em && (
                      <>
                        <CheckCircle2 size={14} />
                        <span>
                          Recebido em{' '}
                          {new Date(conta.recebido_em).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                          {conta.forma_recebimento
                            ? ` · ${labelFormaPagamento(conta.forma_recebimento)}`
                            : ''}
                        </span>
                      </>
                    )}
                    {conta.status === 'CANCELADA' && (
                      <>
                        <XCircle size={14} />
                        <span>Venc. {new Date(`${conta.vencimento}T12:00:00`).toLocaleDateString('pt-BR')}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="financeiro-item-right">
                  <strong>{fmtMoeda(conta.valor)}</strong>
                  {conta.status === 'PENDENTE' && (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!caixaAberto}
                      onClick={() => {
                        setFormaRecebimento('DINHEIRO')
                        setReceberConta(conta)
                      }}
                    >
                      Receber
                    </Button>
                  )}
                  {conta.status === 'RECEBIDA' && (
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Printer size={14} />}
                      disabled={imprimindoId === conta.id}
                      onClick={() => imprimirRecibo(conta.id)}
                    >
                      {imprimindoId === conta.id ? 'Imprimindo…' : 'Comprovante'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={receberConta != null}
        onClose={() => !recebendo && setReceberConta(null)}
        title="Registrar recebimento"
        showCloseButton={!recebendo}
      >
        {receberConta && (
          <div className="financeiro-dialog-body">
            <p className="text-secondary text-sm" style={{ marginTop: 0 }}>
              Cliente: <strong>{receberConta.cliente_nome}</strong>
              <br />
              Venda: <strong>#{receberConta.venda_numero}</strong>
              <br />
              Vencimento:{' '}
              <strong>
                {new Date(`${receberConta.vencimento}T12:00:00`).toLocaleDateString('pt-BR')}
              </strong>
              <br />
              Valor: <strong>{fmtMoeda(receberConta.valor)}</strong>
            </p>
            <Select
              label="Forma de recebimento (entrada no caixa)"
              value={formaRecebimento}
              onChange={(e) => setFormaRecebimento(e.target.value)}
              options={FORMAS_RECEB.map((o) => ({ value: o.value, label: o.label }))}
            />
            <div className="financeiro-dialog-actions">
              <Button variant="secondary" onClick={() => setReceberConta(null)} disabled={recebendo}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={confirmarReceber} disabled={recebendo}>
                {recebendo ? 'Registrando…' : 'Confirmar recebimento'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </Layout>
  )
}
