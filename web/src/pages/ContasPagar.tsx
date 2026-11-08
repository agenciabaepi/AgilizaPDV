import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { DashboardKpiCard } from '../components/dashboard/DashboardKpiCard'
import { PageTitle, Button, Input, Select, Dialog, Alert, useOperationToast } from '../components/ui'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  PlusCircle,
  RefreshCw,
  Repeat,
  Tag,
  Wallet,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { labelFormaPagamento } from '../lib/forma-pagamento-labels'
import type {
  CategoriaDespesa,
  ContaPagar,
  ContaPagarFixa,
} from '../lib/contas-pagar-types'

type CaixaAberto = { id: string; status: string; empresa_id: string }

type AreaTab = 'lancamentos' | 'fixas' | 'categorias'
type StatusFiltro = 'aberto' | 'PAGA' | 'CANCELADA' | 'todas'
type ModoPagamento = 'simples' | 'caixa'

type ResumoPendente = {
  totalAberto: number
  totalVencido: number
  totalAVencer7d: number
  qtdTitulos: number
  qtdVencidos: number
}

const FORMAS_PAG: { value: string; label: string }[] = [
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'PIX', label: 'PIX' },
  { value: 'DEBITO', label: 'Cartão de débito' },
  { value: 'CREDITO', label: 'Cartão de crédito' },
  { value: 'OUTROS', label: 'Outros' },
]

const STATUS_TABS: { id: StatusFiltro; label: string }[] = [
  { id: 'aberto', label: 'Em aberto' },
  { id: 'PAGA', label: 'Pagas' },
  { id: 'CANCELADA', label: 'Canceladas' },
  { id: 'todas', label: 'Todas' },
]

const AREA_TABS: { id: AreaTab; label: string; icon: typeof Wallet }[] = [
  { id: 'lancamentos', label: 'Lançamentos', icon: Wallet },
  { id: 'fixas', label: 'Contas fixas', icon: Repeat },
  { id: 'categorias', label: 'Categorias', icon: Tag },
]

const today = () => new Date().toISOString().slice(0, 10)

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_LONGOS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function currentCompetencia(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftCompetencia(comp: string, delta: number): string {
  const [ys, ms] = comp.split('-')
  const base = new Date(Number(ys), Number(ms) - 1 + delta, 1)
  return currentCompetencia(base)
}

function labelCompetenciaCurta(comp: string): string {
  const [ys, ms] = comp.split('-')
  const m = Number(ms) - 1
  return `${MESES_CURTOS[m] ?? ms}/${ys.slice(2)}`
}

function labelCompetenciaLonga(comp: string): string {
  const [ys, ms] = comp.split('-')
  const m = Number(ms) - 1
  return `${MESES_LONGOS[m] ?? ms} de ${ys}`
}

function midDayOfCompetencia(comp: string): string {
  return `${comp}-15`
}

function buildMesTabs(centro: string, raio = 5): string[] {
  const tabs: string[] = []
  for (let i = -raio; i <= raio; i += 1) {
    tabs.push(shiftCompetencia(centro, i))
  }
  return tabs
}

function fmtMoeda(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function statusLabel(status: string): string {
  switch (status) {
    case 'PENDENTE':
      return 'Em aberto'
    case 'PAGA':
      return 'Paga'
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
    case 'PAGA':
      return 'financeiro-status-badge financeiro-status-badge--recebida'
    case 'CANCELADA':
      return 'financeiro-status-badge financeiro-status-badge--cancelada'
    default:
      return 'financeiro-status-badge'
  }
}

function computeResumoPendente(contas: ContaPagar[]): ResumoPendente {
  const hoje = today()
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

function parseMoney(raw: string): number {
  const s = String(raw).trim()
  if (!s) return NaN
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'))
  return Number(s)
}

export function ContasPagar() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const userId = session?.id ?? ''
  const op = useOperationToast()

  const api = window.electronAPI?.contasPagar

  const [area, setArea] = useState<AreaTab>('lancamentos')
  const [contas, setContas] = useState<ContaPagar[]>([])
  const [resumo, setResumo] = useState<ResumoPendente | null>(null)
  const [categorias, setCategorias] = useState<CategoriaDespesa[]>([])
  const [fixas, setFixas] = useState<ContaPagarFixa[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [caixaAberto, setCaixaAberto] = useState<CaixaAberto | null>(null)

  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('aberto')
  const [competencia, setCompetencia] = useState(currentCompetencia)
  const [mesJanela, setMesJanela] = useState(currentCompetencia)
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')

  const [modalNovaDespesa, setModalNovaDespesa] = useState(false)
  const [novaDesc, setNovaDesc] = useState('')
  const [novaValor, setNovaValor] = useState('')
  const [novaVenc, setNovaVenc] = useState(today())
  const [novaCat, setNovaCat] = useState('')
  const [salvandoAvulsa, setSalvandoAvulsa] = useState(false)

  const [pagarConta, setPagarConta] = useState<ContaPagar | null>(null)
  const [modoPagamento, setModoPagamento] = useState<ModoPagamento>('simples')
  const [formaPagamento, setFormaPagamento] = useState('DINHEIRO')
  const [pagando, setPagando] = useState(false)

  const [editConta, setEditConta] = useState<ContaPagar | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const [editValor, setEditValor] = useState('')
  const [editVenc, setEditVenc] = useState('')
  const [editCat, setEditCat] = useState('')
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  const [modalFixa, setModalFixa] = useState(false)
  const [fixaForm, setFixaForm] = useState({
    id: '' as string,
    descricao: '',
    valor: '',
    dia: '10',
    categoria_id: '',
    observacao: '',
  })
  const [salvandoFixa, setSalvandoFixa] = useState(false)

  const [modalCategoria, setModalCategoria] = useState(false)
  const [novaCatNome, setNovaCatNome] = useState('')
  const [editCatId, setEditCatId] = useState<string | null>(null)
  const [editCatNome, setEditCatNome] = useState('')
  const [salvandoCat, setSalvandoCat] = useState(false)

  const loadCategorias = useCallback(async () => {
    if (!empresaId || !api?.listCategorias) return
    const list = await api.listCategorias(empresaId, false)
    setCategorias(Array.isArray(list) ? list : [])
  }, [empresaId, api])

  const loadFixas = useCallback(async () => {
    if (!empresaId || !api?.listFixas) return
    const list = await api.listFixas(empresaId)
    setFixas(Array.isArray(list) ? list : [])
  }, [empresaId, api])

  const loadContas = useCallback(async () => {
    if (!empresaId || !api?.list) return
    setLoading(true)
    setLoadError(null)
    try {
      if (api.gerarCompetencia) {
        await api.gerarCompetencia(empresaId, competencia)
      }
      const listOpts = {
        status: statusFiltro,
        limit: 500,
        competencia,
        categoria_id: categoriaFiltro || undefined,
        busca: busca || undefined,
      }
      const rowsPromise = api.list(empresaId, listOpts)
      const pendingPromise =
        statusFiltro === 'aberto'
          ? rowsPromise
          : api.list(empresaId, { status: 'aberto', competencia, limit: 2000 })

      const [rows, pendingRows] = await Promise.all([rowsPromise, pendingPromise])
      const list = Array.isArray(rows) ? (rows as ContaPagar[]) : []
      const pending = Array.isArray(pendingRows) ? (pendingRows as ContaPagar[]) : list
      setContas(list)
      setResumo(computeResumoPendente(pending))
    } catch (e) {
      setContas([])
      setResumo(null)
      setLoadError(e instanceof Error ? e.message : 'Erro ao carregar contas a pagar.')
    } finally {
      setLoading(false)
    }
  }, [empresaId, api, statusFiltro, competencia, categoriaFiltro, busca])

  useEffect(() => {
    if (!api || !empresaId) return
    loadCategorias().catch(() => setCategorias([]))
  }, [api, empresaId, loadCategorias])

  useEffect(() => {
    if (area === 'lancamentos') loadContas()
  }, [area, loadContas])

  useEffect(() => {
    if (area === 'fixas') {
      loadFixas().catch((e) => {
        setLoadError(e instanceof Error ? e.message : 'Erro ao carregar contas fixas.')
      })
    }
  }, [area, loadFixas])

  useEffect(() => {
    if (!empresaId || !window.electronAPI?.caixa?.getAberto) return
    window.electronAPI.caixa.getAberto(empresaId).then(setCaixaAberto).catch(() => setCaixaAberto(null))
  }, [empresaId])

  const categoriasAtivas = useMemo(() => categorias.filter((c) => c.ativo), [categorias])
  const catOptions = useMemo(
    () => [
      { value: '', label: 'Sem categoria' },
      ...categoriasAtivas.map((c) => ({ value: c.id, label: c.nome })),
    ],
    [categoriasAtivas]
  )

  const totalListado = useMemo(() => contas.reduce((acc, c) => acc + c.valor, 0), [contas])
  const mesTabs = useMemo(() => buildMesTabs(mesJanela, 5), [mesJanela])
  const competenciaAtual = currentCompetencia()
  const hoje = today()
  const vencido = (v: string) => v < hoje

  const irParaCompetencia = (mes: string) => {
    setCompetencia(mes)
    const idx = mesTabs.indexOf(mes)
    if (idx <= 1 || idx >= mesTabs.length - 2) {
      setMesJanela(mes)
    }
  }

  const deslocarMeses = (delta: number) => {
    setMesJanela((j) => shiftCompetencia(j, delta))
    setCompetencia((c) => shiftCompetencia(c, delta))
  }

  const handleCriarAvulsa = async () => {
    if (!api?.create || !empresaId) return
    const valor = parseMoney(novaValor)
    if (!novaDesc.trim() || !Number.isFinite(valor) || valor <= 0) {
      op.warn('Informe descrição e valor válidos.')
      return
    }
    setSalvandoAvulsa(true)
    try {
      await api.create({
        empresa_id: empresaId,
        descricao: novaDesc.trim(),
        valor,
        vencimento: novaVenc,
        categoria_id: novaCat || null,
        competencia,
      })
      op.saved('Despesa lançada.')
      setModalNovaDespesa(false)
      setNovaDesc('')
      setNovaValor('')
      setNovaVenc(midDayOfCompetencia(competencia))
      setNovaCat('')
      await loadContas()
    } catch (e) {
      op.failed(e, 'Erro ao lançar despesa.')
    } finally {
      setSalvandoAvulsa(false)
    }
  }

  const abrirEditar = (c: ContaPagar) => {
    setEditConta(c)
    setEditDesc(c.descricao)
    setEditValor(String(c.valor).replace('.', ','))
    setEditVenc(c.vencimento)
    setEditCat(c.categoria_id ?? '')
  }

  const salvarEdicao = async () => {
    if (!editConta || !api?.update || !empresaId) return
    const valor = parseMoney(editValor)
    setSalvandoEdit(true)
    try {
      await api.update(editConta.id, empresaId, {
        descricao: editDesc,
        valor,
        vencimento: editVenc,
        categoria_id: editCat || null,
      })
      op.saved('Lançamento atualizado.')
      setEditConta(null)
      await loadContas()
    } catch (e) {
      op.failed(e, 'Erro ao atualizar.')
    } finally {
      setSalvandoEdit(false)
    }
  }

  const handleCancelar = async (c: ContaPagar) => {
    if (!api?.cancelar || !empresaId) return
    if (!window.confirm(`Cancelar «${c.descricao}»?`)) return
    try {
      await api.cancelar(c.id, empresaId)
      op.saved('Conta cancelada.')
      await loadContas()
    } catch (e) {
      op.failed(e, 'Erro ao cancelar.')
    }
  }

  const confirmarPagar = async () => {
    if (!pagarConta || !api?.pagar || !empresaId) return
    if (modoPagamento === 'caixa' && !caixaAberto) {
      op.warn('Abra o caixa no PDV para dar baixa no caixa.')
      return
    }
    setPagando(true)
    try {
      await api.pagar({
        conta_id: pagarConta.id,
        empresa_id: empresaId,
        modo: modoPagamento,
        usuario_id: userId,
        forma: formaPagamento,
        caixa_id: modoPagamento === 'caixa' ? caixaAberto?.id : undefined,
      })
      op.saved(modoPagamento === 'caixa' ? 'Pago e baixado no caixa.' : 'Conta marcada como paga.')
      setPagarConta(null)
      await loadContas()
      if (modoPagamento === 'caixa' && empresaId) {
        const cx = await window.electronAPI?.caixa?.getAberto(empresaId)
        setCaixaAberto(cx ?? null)
      }
    } catch (e) {
      op.failed(e, 'Erro ao pagar.')
    } finally {
      setPagando(false)
    }
  }

  const resetFixaForm = () =>
    setFixaForm({ id: '', descricao: '', valor: '', dia: '10', categoria_id: '', observacao: '' })

  const abrirNovaDespesa = () => {
    setNovaDesc('')
    setNovaValor('')
    setNovaVenc(midDayOfCompetencia(competencia))
    setNovaCat('')
    setModalNovaDespesa(true)
  }

  const abrirNovaFixa = () => {
    resetFixaForm()
    setModalFixa(true)
  }

  const abrirNovaCategoria = () => {
    setEditCatId(null)
    setNovaCatNome('')
    setEditCatNome('')
    setModalCategoria(true)
  }

  const salvarFixa = async () => {
    if (!api || !empresaId) return
    const valor = parseMoney(fixaForm.valor)
    const dia = Number(fixaForm.dia) || 10
    if (!fixaForm.descricao.trim()) {
      op.warn('Informe a descrição da conta fixa.')
      return
    }
    if (!Number.isFinite(valor) || valor < 0) {
      op.warn('Informe um valor padrão válido.')
      return
    }
    setSalvandoFixa(true)
    try {
      if (fixaForm.id) {
        await api.updateFixa(fixaForm.id, empresaId, {
          descricao: fixaForm.descricao,
          valor_padrao: valor,
          dia_vencimento: dia,
          categoria_id: fixaForm.categoria_id || null,
          observacao: fixaForm.observacao || null,
        })
        op.saved('Conta fixa atualizada.')
      } else {
        await api.createFixa({
          empresa_id: empresaId,
          descricao: fixaForm.descricao,
          valor_padrao: valor,
          dia_vencimento: dia,
          categoria_id: fixaForm.categoria_id || null,
          observacao: fixaForm.observacao || null,
        })
        op.saved('Conta fixa cadastrada.')
      }
      setModalFixa(false)
      resetFixaForm()
      await loadFixas()
      if (api.gerarCompetenciasAbertura) await api.gerarCompetenciasAbertura(empresaId)
    } catch (e) {
      op.failed(e, 'Erro ao salvar conta fixa.')
    } finally {
      setSalvandoFixa(false)
    }
  }

  const editarFixa = (f: ContaPagarFixa) => {
    setFixaForm({
      id: f.id,
      descricao: f.descricao,
      valor: String(f.valor_padrao).replace('.', ','),
      dia: String(f.dia_vencimento),
      categoria_id: f.categoria_id ?? '',
      observacao: f.observacao ?? '',
    })
    setModalFixa(true)
  }

  const toggleFixa = async (f: ContaPagarFixa) => {
    if (!api?.toggleFixa || !empresaId) return
    try {
      await api.toggleFixa(f.id, empresaId, !f.ativa)
      op.saved(f.ativa ? 'Conta fixa desativada.' : 'Conta fixa ativada.')
      await loadFixas()
    } catch (e) {
      op.failed(e, 'Erro ao alterar status.')
    }
  }

  const criarCategoria = async () => {
    if (!api?.createCategoria || !empresaId) return
    if (!novaCatNome.trim()) {
      op.warn('Informe o nome da categoria.')
      return
    }
    setSalvandoCat(true)
    try {
      await api.createCategoria({ empresa_id: empresaId, nome: novaCatNome })
      op.saved('Categoria criada.')
      setNovaCatNome('')
      setModalCategoria(false)
      await loadCategorias()
    } catch (e) {
      op.failed(e, 'Erro ao criar categoria.')
    } finally {
      setSalvandoCat(false)
    }
  }

  const salvarNomeCategoria = async () => {
    if (!editCatId || !api?.updateCategoria || !empresaId) return
    setSalvandoCat(true)
    try {
      await api.updateCategoria(editCatId, empresaId, { nome: editCatNome })
      op.saved('Categoria atualizada.')
      setEditCatId(null)
      setModalCategoria(false)
      await loadCategorias()
    } catch (e) {
      op.failed(e, 'Erro ao atualizar categoria.')
    } finally {
      setSalvandoCat(false)
    }
  }

  const toggleCategoria = async (c: CategoriaDespesa) => {
    if (!api?.toggleCategoria || !empresaId) return
    try {
      await api.toggleCategoria(c.id, empresaId, !c.ativo)
      op.saved(c.ativo ? 'Categoria inativada.' : 'Categoria ativada.')
      await loadCategorias()
    } catch (e) {
      op.failed(e, 'Erro ao alterar categoria.')
    }
  }

  if (!api) {
    return (
      <Layout>
        <PageTitle title="Contas a pagar" subtitle="Despesas, contas fixas e categorias financeiras." />
        <Alert variant="error">
          Módulo de contas a pagar indisponível neste ambiente. Atualize o aplicativo ou entre em contato com o suporte.
        </Alert>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="financeiro-page">
      <PageTitle
        title="Contas a pagar"
        subtitle="Lançamentos, contas fixas recorrentes e categorias de despesa — separados do cadastro de produtos."
      />

      <div className="financeiro-toolbar-row financeiro-toolbar-row--between">
        <div className="financeiro-area-tabs">
          {AREA_TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                className={`financeiro-area-tab ${area === tab.id ? 'financeiro-area-tab--active' : ''}`}
                onClick={() => setArea(tab.id)}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            )
          })}
        </div>
        <div className="financeiro-toolbar-actions">
          {area === 'lancamentos' && (
            <>
              <Button leftIcon={<RefreshCw size={16} />} variant="secondary" onClick={() => loadContas()} disabled={loading}>
                Atualizar
              </Button>
              <Button leftIcon={<PlusCircle size={16} />} onClick={abrirNovaDespesa}>
                Nova despesa
              </Button>
            </>
          )}
          {area === 'fixas' && (
            <Button leftIcon={<PlusCircle size={16} />} onClick={abrirNovaFixa}>
              Nova conta fixa
            </Button>
          )}
          {area === 'categorias' && (
            <Button leftIcon={<PlusCircle size={16} />} onClick={abrirNovaCategoria}>
              Nova categoria
            </Button>
          )}
        </div>
      </div>

      {area === 'lancamentos' && (
        <>
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
                  {labelCompetenciaCurta(mes)}
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
            <span className="financeiro-mes-label">{labelCompetenciaLonga(competencia)}</span>
          </div>

          {resumo && (
            <section className="dashboard-kpis dashboard-kpis--compact financeiro-kpis">
              <DashboardKpiCard
                label="Total em aberto"
                value={fmtMoeda(resumo.totalAberto)}
                hint={`${resumo.qtdTitulos} título(s) em ${labelCompetenciaCurta(competencia)}`}
                icon={<Wallet size={20} />}
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
                hint="Próximos vencimentos do mês"
                icon={<Clock size={20} />}
                variant="warning"
              />
              <DashboardKpiCard
                label="Listagem do mês"
                value={fmtMoeda(totalListado)}
                hint={`${contas.length} registro(s) em ${labelCompetenciaCurta(competencia)}`}
                icon={<Calendar size={20} />}
                variant="info"
              />
            </section>
          )}

          <div className="financeiro-form-wrap">
            <Input
              label="Buscar"
              placeholder="Descrição ou categoria"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <Select
              label="Filtrar categoria"
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              options={[{ value: '', label: 'Todas' }, ...categorias.map((c) => ({ value: c.id, label: c.nome }))]}
            />
            {(busca || categoriaFiltro) && (
              <Button
                variant="outline"
                onClick={() => {
                  setBusca('')
                  setCategoriaFiltro('')
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>

          {loadError && (
            <Alert variant="error" style={{ marginBottom: 'var(--space-3)' }}>
              {loadError}
              {(loadError.toLowerCase().includes('contas_pagar') ||
                loadError.toLowerCase().includes('categorias_despesa') ||
                loadError.toLowerCase().includes('schema cache') ||
                loadError.toLowerCase().includes('does not exist')) && (
                <span>
                  {' '}
                  Execute o script <code>sql/supabase-contas-pagar.sql</code> no Supabase se ainda não criou as tabelas.
                </span>
              )}
            </Alert>
          )}

          <div className="financeiro-lista-wrap">
            <h3 className="financeiro-lista-title">
              {statusFiltro === 'aberto' && `Em aberto — ${labelCompetenciaLonga(competencia)}`}
              {statusFiltro === 'PAGA' && `Pagas — ${labelCompetenciaLonga(competencia)}`}
              {statusFiltro === 'CANCELADA' && `Canceladas — ${labelCompetenciaLonga(competencia)}`}
              {statusFiltro === 'todas' && `Todas — ${labelCompetenciaLonga(competencia)}`}
            </h3>
            {loading ? (
              <p className="financeiro-empty">Carregando…</p>
            ) : contas.length === 0 ? (
              <p className="financeiro-empty">
                {statusFiltro === 'aberto'
                  ? `Nenhuma conta pendente em ${labelCompetenciaLonga(competencia)}. Cadastre uma despesa ou ative contas fixas.`
                  : `Nenhum registro em ${labelCompetenciaLonga(competencia)} para os filtros selecionados.`}
              </p>
            ) : (
              <div className="financeiro-lista">
                {contas.map((conta) => (
                  <div key={conta.id} className="financeiro-item">
                    <div className="financeiro-item-main">
                      <div className="financeiro-item-title-row">
                        <span className="financeiro-item-title">{conta.descricao}</span>
                        <span className={statusBadgeClass(conta.status)}>{statusLabel(conta.status)}</span>
                        <span
                          className={`financeiro-origem-badge financeiro-origem-badge--${conta.tipo === 'FIXA' ? 'fixa' : 'avulsa'}`}
                        >
                          {conta.tipo === 'FIXA' ? 'Fixa' : 'Avulsa'}
                        </span>
                      </div>
                      <div className="financeiro-item-meta">
                        {conta.categoria_nome && <span>{conta.categoria_nome}</span>}
                        {conta.status === 'PENDENTE' && (
                          <>
                            <Calendar size={14} />
                            <span className={vencido(conta.vencimento) ? 'financeiro-vencido' : undefined}>
                              Vence em {new Date(`${conta.vencimento}T12:00:00`).toLocaleDateString('pt-BR')}
                              {vencido(conta.vencimento) ? ' · vencida' : ''}
                            </span>
                          </>
                        )}
                        {conta.status === 'PAGA' && conta.pago_em && (
                          <>
                            <CheckCircle2 size={14} />
                            <span>
                              Pago em{' '}
                              {new Date(conta.pago_em).toLocaleString('pt-BR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                              {conta.forma_pagamento ? ` · ${labelFormaPagamento(conta.forma_pagamento)}` : ''}
                              {conta.pagamento_caixa_id ? ' · no caixa' : ' · só financeiro'}
                            </span>
                          </>
                        )}
                        {conta.status === 'CANCELADA' && (
                          <>
                            <XCircle size={14} />
                            <span>
                              Venc. {new Date(`${conta.vencimento}T12:00:00`).toLocaleDateString('pt-BR')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="financeiro-item-right">
                      <strong>{fmtMoeda(conta.valor)}</strong>
                      {conta.status === 'PENDENTE' && (
                        <div className="financeiro-item-actions">
                          <Button size="sm" variant="outline" leftIcon={<Pencil size={14} />} onClick={() => abrirEditar(conta)}>
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              setModoPagamento('simples')
                              setFormaPagamento('DINHEIRO')
                              setPagarConta(conta)
                            }}
                          >
                            Pagar
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => handleCancelar(conta)}>
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {area === 'fixas' && (
        <>
          <Alert variant="info" style={{ marginBottom: 'var(--space-3)' }}>
            Contas fixas geram automaticamente o título de cada mês. Você pode alterar o valor no lançamento gerado.
          </Alert>

          <div className="financeiro-lista-wrap">
            <h3 className="financeiro-lista-title">Contas fixas cadastradas</h3>
            {fixas.length === 0 ? (
              <p className="financeiro-empty">
                Nenhuma conta fixa. Cadastre aluguel, funcionários, DAS, água, luz, internet etc.
              </p>
            ) : (
              <div className="financeiro-lista">
                {fixas.map((f) => (
                  <div key={f.id} className="financeiro-item">
                    <div className="financeiro-item-main">
                      <div className="financeiro-item-title-row">
                        <span className="financeiro-item-title">{f.descricao}</span>
                        <span
                          className={`financeiro-status-badge ${f.ativa ? 'financeiro-status-badge--recebida' : 'financeiro-status-badge--cancelada'}`}
                        >
                          {f.ativa ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                      <div className="financeiro-item-meta">
                        {f.categoria_nome && <span>{f.categoria_nome}</span>}
                        <span>Vence todo dia {f.dia_vencimento}</span>
                      </div>
                    </div>
                    <div className="financeiro-item-right">
                      <strong>{fmtMoeda(f.valor_padrao)}</strong>
                      <div className="financeiro-item-actions">
                        <Button size="sm" variant="outline" onClick={() => editarFixa(f)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => toggleFixa(f)}>
                          {f.ativa ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {area === 'categorias' && (
        <>
          <Alert variant="info" style={{ marginBottom: 'var(--space-3)' }}>
            Categorias financeiras de despesa (independentes das categorias de produto).
          </Alert>

          <div className="financeiro-lista-wrap">
            <h3 className="financeiro-lista-title">Categorias de despesa</h3>
            {categorias.length === 0 ? (
              <p className="financeiro-empty">Nenhuma categoria cadastrada.</p>
            ) : (
              <div className="financeiro-lista">
                {categorias.map((c) => (
                  <div key={c.id} className="financeiro-item">
                    <div className="financeiro-item-main">
                      <div className="financeiro-item-title-row">
                        <span className="financeiro-item-title">{c.nome}</span>
                        {c.sistema && (
                          <span className="financeiro-origem-badge financeiro-origem-badge--sistema">Padrão</span>
                        )}
                        <span
                          className={`financeiro-status-badge ${c.ativo ? 'financeiro-status-badge--recebida' : 'financeiro-status-badge--cancelada'}`}
                        >
                          {c.ativo ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                    </div>
                    <div className="financeiro-item-right">
                      <div className="financeiro-item-actions">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditCatId(c.id)
                            setEditCatNome(c.nome)
                            setNovaCatNome('')
                            setModalCategoria(true)
                          }}
                        >
                          Renomear
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => toggleCategoria(c)}>
                          {c.ativo ? 'Inativar' : 'Ativar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      </div>

      <Dialog
        open={modalNovaDespesa}
        onClose={() => !salvandoAvulsa && setModalNovaDespesa(false)}
        title="Nova despesa"
        size="large"
        showCloseButton={!salvandoAvulsa}
      >
        <div className="financeiro-dialog-body">
          <p className="financeiro-dialog-hint">
            Lançamento avulso em <strong>{labelCompetenciaLonga(competencia)}</strong>. Para despesas
            recorrentes, use a aba Contas fixas.
          </p>
          <div className="financeiro-dialog-grid">
            <Input
              label="Descrição"
              placeholder="Ex.: Compra de material"
              value={novaDesc}
              onChange={(e) => setNovaDesc(e.target.value)}
              autoFocus
            />
            <Input
              label="Valor (R$)"
              placeholder="0,00"
              value={novaValor}
              onChange={(e) => setNovaValor(e.target.value)}
            />
            <Input
              label="Vencimento"
              type="date"
              value={novaVenc}
              onChange={(e) => setNovaVenc(e.target.value)}
            />
            <Select
              label="Categoria"
              value={novaCat}
              onChange={(e) => setNovaCat(e.target.value)}
              options={catOptions}
            />
          </div>
          <div className="financeiro-dialog-actions">
            <Button variant="secondary" onClick={() => setModalNovaDespesa(false)} disabled={salvandoAvulsa}>
              Cancelar
            </Button>
            <Button variant="primary" leftIcon={<PlusCircle size={16} />} onClick={handleCriarAvulsa} disabled={salvandoAvulsa}>
              {salvandoAvulsa ? 'Salvando…' : 'Cadastrar despesa'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={modalFixa}
        onClose={() => {
          if (salvandoFixa) return
          setModalFixa(false)
          resetFixaForm()
        }}
        title={fixaForm.id ? 'Editar conta fixa' : 'Nova conta fixa'}
        size="large"
        showCloseButton={!salvandoFixa}
      >
        <div className="financeiro-dialog-body">
          <p className="financeiro-dialog-hint">
            Gera automaticamente o título de cada mês. Você poderá alterar o valor no lançamento gerado.
          </p>
          <div className="financeiro-dialog-grid">
            <Input
              label="Descrição"
              placeholder="Ex.: Aluguel da loja"
              value={fixaForm.descricao}
              onChange={(e) => setFixaForm((f) => ({ ...f, descricao: e.target.value }))}
              autoFocus
            />
            <Input
              label="Valor padrão (R$)"
              placeholder="0,00"
              value={fixaForm.valor}
              onChange={(e) => setFixaForm((f) => ({ ...f, valor: e.target.value }))}
            />
            <Input
              label="Dia do vencimento"
              type="number"
              min={1}
              max={28}
              value={fixaForm.dia}
              onChange={(e) => setFixaForm((f) => ({ ...f, dia: e.target.value }))}
            />
            <Select
              label="Categoria"
              value={fixaForm.categoria_id}
              onChange={(e) => setFixaForm((f) => ({ ...f, categoria_id: e.target.value }))}
              options={catOptions}
            />
            <div className="financeiro-dialog-grid-full">
              <Input
                label="Observação"
                placeholder="Opcional"
                value={fixaForm.observacao}
                onChange={(e) => setFixaForm((f) => ({ ...f, observacao: e.target.value }))}
              />
            </div>
          </div>
          <div className="financeiro-dialog-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setModalFixa(false)
                resetFixaForm()
              }}
              disabled={salvandoFixa}
            >
              Cancelar
            </Button>
            <Button variant="primary" leftIcon={<PlusCircle size={16} />} onClick={salvarFixa} disabled={salvandoFixa}>
              {salvandoFixa ? 'Salvando…' : fixaForm.id ? 'Salvar alterações' : 'Cadastrar conta fixa'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={modalCategoria}
        onClose={() => {
          if (salvandoCat) return
          setModalCategoria(false)
          setEditCatId(null)
          setNovaCatNome('')
          setEditCatNome('')
        }}
        title={editCatId ? 'Renomear categoria' : 'Nova categoria'}
        showCloseButton={!salvandoCat}
      >
        <div className="financeiro-dialog-body">
          <p className="financeiro-dialog-hint">
            Categorias financeiras de despesa — separadas das categorias de produto.
          </p>
          <Input
            label="Nome"
            placeholder="Ex.: Marketing"
            value={editCatId ? editCatNome : novaCatNome}
            onChange={(e) => (editCatId ? setEditCatNome(e.target.value) : setNovaCatNome(e.target.value))}
            autoFocus
          />
          <div className="financeiro-dialog-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setModalCategoria(false)
                setEditCatId(null)
              }}
              disabled={salvandoCat}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              leftIcon={<PlusCircle size={16} />}
              onClick={editCatId ? salvarNomeCategoria : criarCategoria}
              disabled={salvandoCat}
            >
              {salvandoCat ? 'Salvando…' : editCatId ? 'Salvar' : 'Cadastrar categoria'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={pagarConta != null}
        onClose={() => !pagando && setPagarConta(null)}
        title="Registrar pagamento"
        showCloseButton={!pagando}
      >
        {pagarConta && (
          <div className="financeiro-dialog-body">
            <p className="text-secondary text-sm" style={{ marginTop: 0 }}>
              <strong>{pagarConta.descricao}</strong>
              <br />
              Vencimento:{' '}
              <strong>
                {new Date(`${pagarConta.vencimento}T12:00:00`).toLocaleDateString('pt-BR')}
              </strong>
              <br />
              Valor: <strong>{fmtMoeda(pagarConta.valor)}</strong>
            </p>

            <div className="financeiro-modo-pagar">
              <label className={`financeiro-modo-option ${modoPagamento === 'simples' ? 'financeiro-modo-option--active' : ''}`}>
                <input
                  type="radio"
                  name="modo-pagar"
                  checked={modoPagamento === 'simples'}
                  onChange={() => setModoPagamento('simples')}
                />
                <span>
                  <strong>Só marcar como paga</strong>
                  <small>Atualiza o financeiro, sem movimentar o caixa</small>
                </span>
              </label>
              <label className={`financeiro-modo-option ${modoPagamento === 'caixa' ? 'financeiro-modo-option--active' : ''}`}>
                <input
                  type="radio"
                  name="modo-pagar"
                  checked={modoPagamento === 'caixa'}
                  onChange={() => setModoPagamento('caixa')}
                />
                <span>
                  <strong>Dar baixa no caixa</strong>
                  <small>Registra sangria no caixa aberto</small>
                </span>
              </label>
            </div>

            {modoPagamento === 'caixa' && !caixaAberto && (
              <Alert variant="warning">Abra o caixa no PDV para dar baixa no caixa.</Alert>
            )}

            <Select
              label="Forma de pagamento"
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              options={FORMAS_PAG.map((o) => ({ value: o.value, label: o.label }))}
            />

            <div className="financeiro-dialog-actions">
              <Button variant="secondary" onClick={() => setPagarConta(null)} disabled={pagando}>
                Voltar
              </Button>
              <Button
                variant="primary"
                onClick={confirmarPagar}
                disabled={pagando || (modoPagamento === 'caixa' && !caixaAberto)}
              >
                {pagando ? 'Registrando…' : 'Confirmar pagamento'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={editConta != null}
        onClose={() => !salvandoEdit && setEditConta(null)}
        title="Editar lançamento"
        size="large"
        showCloseButton={!salvandoEdit}
      >
        {editConta && (
          <div className="financeiro-dialog-body">
            <div className="financeiro-dialog-grid">
              <Input label="Descrição" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} autoFocus />
              <Input label="Valor (R$)" value={editValor} onChange={(e) => setEditValor(e.target.value)} />
              <Input label="Vencimento" type="date" value={editVenc} onChange={(e) => setEditVenc(e.target.value)} />
              <Select
                label="Categoria"
                value={editCat}
                onChange={(e) => setEditCat(e.target.value)}
                options={catOptions}
              />
            </div>
            <div className="financeiro-dialog-actions">
              <Button variant="secondary" onClick={() => setEditConta(null)} disabled={salvandoEdit}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={salvarEdicao} disabled={salvandoEdit}>
                {salvandoEdit ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </Layout>
  )
}
