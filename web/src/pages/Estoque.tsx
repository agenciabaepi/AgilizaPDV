import { useState, useEffect, useCallback, useMemo } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useSyncDataRefresh } from '../hooks/useSyncDataRefresh'
import type { ProdutoSaldo, EstoqueMovimento, TipoMovimento, Produto, Categoria } from '../vite-env'
import {
  PageTitle,
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Select,
  Alert,
  Dialog,
  useOperationToast,
} from '../components/ui'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react'
import { isCapaCustomProduto } from '../capa-custom/lib/capa-catalogo'
import { formatCurrency } from '../lib/dashboard-utils'
import {
  buildDemonstrativoMesTabs,
  currentDemonstrativoCompetencia,
  getDemonstrativoPeriodoRange,
  labelDemonstrativoCompetenciaCurta,
  labelDemonstrativoPeriodo,
  shiftDemonstrativoCompetencia,
} from '../lib/demonstrativos-data'
import {
  labelReferenciaMovimento,
  labelTipoMovimento,
} from '../lib/produto-historico'

type ProdutoVariacaoInfo = Produto & { produto_pai_id?: string | null; variacao_eixos_json?: string | null }

type AreaTab = 'saldos' | 'movimentacoes'
type TipoFiltro = 'todos' | TipoMovimento

const TIPOS: { value: TipoMovimento; label: string }[] = [
  { value: 'ENTRADA', label: 'Entrada' },
  { value: 'SAIDA', label: 'Saída' },
  { value: 'AJUSTE', label: 'Ajuste' },
  { value: 'DEVOLUCAO', label: 'Devolução' },
]

const TIPO_TABS: { id: TipoFiltro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'ENTRADA', label: 'Entradas' },
  { id: 'SAIDA', label: 'Saídas' },
  { id: 'AJUSTE', label: 'Ajustes' },
  { id: 'DEVOLUCAO', label: 'Devoluções' },
]

const AREA_TABS: { id: AreaTab; label: string; icon: typeof Package }[] = [
  { id: 'saldos', label: 'Saldos', icon: Package },
  { id: 'movimentacoes', label: 'Movimentações', icon: RefreshCw },
]

/** API local/remota pode devolver números como string; evita quebra na tabela e no saldo exibido. */
function parseMovimentoRow(row: unknown): EstoqueMovimento | null {
  if (row == null || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const id = r.id
  const produto_id = r.produto_id
  const tipo = r.tipo
  const created_at = r.created_at
  if (typeof id !== 'string' || typeof produto_id !== 'string' || typeof tipo !== 'string' || typeof created_at !== 'string') {
    return null
  }
  const qRaw = r.quantidade
  const quantidade =
    typeof qRaw === 'number' && Number.isFinite(qRaw)
      ? qRaw
      : typeof qRaw === 'string' && Number.isFinite(Number(qRaw))
        ? Number(qRaw)
        : NaN
  if (!Number.isFinite(quantidade)) return null

  let custo_unitario: number | null = null
  const c = r.custo_unitario
  if (c != null && c !== '') {
    const n = typeof c === 'number' ? c : Number(c)
    if (Number.isFinite(n)) custo_unitario = n
  }

  return {
    id,
    empresa_id: typeof r.empresa_id === 'string' ? r.empresa_id : '',
    produto_id,
    tipo: tipo as TipoMovimento,
    quantidade,
    custo_unitario,
    referencia_tipo: r.referencia_tipo != null ? String(r.referencia_tipo) : null,
    referencia_id: r.referencia_id != null ? String(r.referencia_id) : null,
    usuario_id: r.usuario_id != null ? String(r.usuario_id) : null,
    created_at,
  }
}

function normalizeMovimentosList(rows: unknown): EstoqueMovimento[] {
  if (!Array.isArray(rows)) return []
  const out: EstoqueMovimento[] = []
  for (const row of rows) {
    const m = parseMovimentoRow(row)
    if (m) out.push(m)
  }
  return out
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const hoje = new Date()
  const ontem = new Date()
  ontem.setDate(hoje.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, hoje)) return 'Hoje'
  if (sameDay(d, ontem)) return 'Ontem'
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatQty(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function tipoBadgeClass(tipo: TipoMovimento): string {
  if (tipo === 'ENTRADA' || tipo === 'DEVOLUCAO') return 'produto-hist-badge--entrada'
  if (tipo === 'SAIDA') return 'produto-hist-badge--saida'
  return 'produto-hist-badge--ajuste'
}

function qtySigned(m: EstoqueMovimento): number {
  if (m.tipo === 'SAIDA') return -Math.abs(m.quantidade)
  if (m.tipo === 'AJUSTE') return m.quantidade
  return Math.abs(m.quantidade)
}

export function Estoque() {
  const { session } = useAuth()
  const syncRefreshKey = useSyncDataRefresh()
  const empresaId = session?.empresa_id ?? ''
  const userId = session?.id ?? ''
  const op = useOperationToast()

  const competenciaAtual = currentDemonstrativoCompetencia()
  const [area, setArea] = useState<AreaTab>('movimentacoes')
  const [competencia, setCompetencia] = useState(competenciaAtual)
  const [mesJanela, setMesJanela] = useState(competenciaAtual)
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos')
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [saldoBusca, setSaldoBusca] = useState('')

  const [saldos, setSaldos] = useState<ProdutoSaldo[]>([])
  const [movimentos, setMovimentos] = useState<EstoqueMovimento[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loadingMov, setLoadingMov] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    tipo: 'ENTRADA' as TipoMovimento,
    produto_id: '',
    quantidade: 0,
    custo_unitario: 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const mesTabs = useMemo(() => buildDemonstrativoMesTabs(mesJanela, 5), [mesJanela])
  const { dataInicio, dataFim } = useMemo(
    () => getDemonstrativoPeriodoRange(competencia),
    [competencia]
  )

  const produtoMap = useMemo(() => {
    const map = new Map<string, Produto>()
    for (const p of produtos) map.set(p.id, p)
    return map
  }, [produtos])

  const categoriaNomeMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categorias) map.set(c.id, c.nome)
    return map
  }, [categorias])

  const categoriaOptions = useMemo(
    () => [
      { value: '', label: 'Todas as categorias' },
      ...[...categorias]
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((c) => ({ value: c.id, label: c.nome })),
    ],
    [categorias]
  )

  const loadSaldos = useCallback(() => {
    if (!empresaId) return
    window.electronAPI.estoque.listSaldos(empresaId).then(setSaldos).catch(() => setSaldos([]))
  }, [empresaId])

  const loadProdutos = useCallback(() => {
    if (!empresaId) return
    window.electronAPI.produtos
      .list(empresaId, { apenasAtivos: true })
      .then(setProdutos)
      .catch(() => setProdutos([]))
  }, [empresaId])

  const loadCategorias = useCallback(() => {
    if (!empresaId) return
    window.electronAPI.categorias
      .list(empresaId)
      .then((rows) => setCategorias(Array.isArray(rows) ? rows : []))
      .catch(() => setCategorias([]))
  }, [empresaId])

  const loadMovimentos = useCallback(async () => {
    if (!empresaId) return
    setLoadingMov(true)
    setLoadError(null)
    try {
      const rows = await window.electronAPI.estoque.listMovimentos(empresaId, {
        dataInicio,
        dataFim,
        tipo: tipoFiltro === 'todos' ? undefined : tipoFiltro,
        limit: 3000,
      })
      setMovimentos(normalizeMovimentosList(rows))
    } catch (err) {
      setMovimentos([])
      setLoadError(err instanceof Error ? err.message : 'Erro ao carregar movimentações.')
    } finally {
      setLoadingMov(false)
    }
  }, [empresaId, dataInicio, dataFim, tipoFiltro, syncRefreshKey])

  useEffect(() => {
    loadSaldos()
    loadProdutos()
    loadCategorias()
  }, [loadSaldos, loadProdutos, loadCategorias, syncRefreshKey])

  useEffect(() => {
    if (area === 'movimentacoes') loadMovimentos()
  }, [area, loadMovimentos])

  const irParaCompetencia = (mes: string) => {
    setCompetencia(mes)
    const idx = mesTabs.indexOf(mes)
    if (idx <= 1 || idx >= mesTabs.length - 2) setMesJanela(mes)
  }

  const deslocarMeses = (delta: number) => {
    setMesJanela((j) => shiftDemonstrativoCompetencia(j, delta))
    setCompetencia((c) => shiftDemonstrativoCompetencia(c, delta))
  }

  const openNovoMovimento = () => {
    const comEstoque = produtos.filter((p) => p.controla_estoque === 1)
    setForm({
      tipo: 'ENTRADA',
      produto_id: comEstoque[0]?.id ?? '',
      quantidade: 0,
      custo_unitario: 0,
    })
    setError('')
    setShowForm(true)
  }

  const submitMovimento = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.produto_id) {
      setError('Selecione o produto.')
      return
    }
    const qty = form.tipo === 'AJUSTE' ? form.quantidade : Math.abs(form.quantidade)
    if (qty === 0) {
      setError('Informe a quantidade.')
      return
    }
    setSaving(true)
    try {
      await window.electronAPI.estoque.registrarMovimento({
        empresa_id: empresaId,
        produto_id: form.produto_id,
        tipo: form.tipo,
        quantidade: form.tipo === 'AJUSTE' ? form.quantidade : qty,
        custo_unitario: form.custo_unitario || undefined,
        usuario_id: userId,
      })
      op.saved('Movimento de estoque registrado com sucesso.')
      setShowForm(false)
      loadSaldos()
      loadMovimentos()
    } catch (err) {
      op.failed(err, 'Erro ao registrar movimento de estoque.')
      setError(err instanceof Error ? err.message : 'Erro ao registrar movimento.')
    } finally {
      setSaving(false)
    }
  }

  const quantidadeLabel = form.tipo === 'AJUSTE' ? 'Quantidade (+ ou -)' : 'Quantidade'
  const capaPaiIds = new Set(
    produtos.filter((p) => isCapaCustomProduto(p as ProdutoVariacaoInfo)).map((p) => p.id)
  )
  const produtosComEstoque = produtos.filter((p) => {
    if (p.controla_estoque !== 1 || !p.id) return false
    const paiId = (p as ProdutoVariacaoInfo).produto_pai_id
    return !capaPaiIds.has(p.id) && !(paiId && capaPaiIds.has(paiId))
  })

  const movimentosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return movimentos.filter((m) => {
      const produto = produtoMap.get(m.produto_id)
      if (categoriaFiltro) {
        if (!produto || produto.categoria_id !== categoriaFiltro) return false
      }
      if (!q) return true
      const nome = (produto?.nome ?? '').toLowerCase()
      const sku = (produto?.sku ?? '').toLowerCase()
      const codigo = String(produto?.codigo ?? '').toLowerCase()
      const cat =
        produto?.categoria_id != null
          ? (categoriaNomeMap.get(produto.categoria_id) ?? '').toLowerCase()
          : ''
      const ref = `${m.referencia_tipo ?? ''} ${m.referencia_id ?? ''}`.toLowerCase()
      return (
        nome.includes(q) ||
        sku.includes(q) ||
        codigo.includes(q) ||
        cat.includes(q) ||
        ref.includes(q) ||
        m.produto_id.toLowerCase().includes(q)
      )
    })
  }, [movimentos, produtoMap, categoriaFiltro, categoriaNomeMap, busca])

  const resumo = useMemo(() => {
    let entradas = 0
    let saidas = 0
    let ajustes = 0
    let devolucoes = 0
    let valorEntradas = 0
    let valorSaidas = 0
    for (const m of movimentosFiltrados) {
      const custo = m.custo_unitario ?? 0
      const absQty = Math.abs(m.quantidade)
      if (m.tipo === 'ENTRADA') {
        entradas += absQty
        valorEntradas += absQty * custo
      } else if (m.tipo === 'SAIDA') {
        saidas += absQty
        valorSaidas += absQty * custo
      } else if (m.tipo === 'AJUSTE') {
        ajustes += 1
      } else if (m.tipo === 'DEVOLUCAO') {
        devolucoes += absQty
      }
    }
    return {
      qtd: movimentosFiltrados.length,
      entradas,
      saidas,
      ajustes,
      devolucoes,
      valorEntradas,
      valorSaidas,
    }
  }, [movimentosFiltrados])

  const gruposPorDia = useMemo(() => {
    const map = new Map<string, EstoqueMovimento[]>()
    for (const m of movimentosFiltrados) {
      const key = dayKey(m.created_at)
      const list = map.get(key) ?? []
      list.push(m)
      map.set(key, list)
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a))
  }, [movimentosFiltrados])

  const saldosFiltrados = useMemo(() => {
    const q = saldoBusca.trim().toLowerCase()
    if (!q) return saldos
    return saldos.filter((s) => {
      const produto = produtoMap.get(s.produto_id)
      const cat =
        produto?.categoria_id != null
          ? (categoriaNomeMap.get(produto.categoria_id) ?? '').toLowerCase()
          : ''
      return (
        s.nome.toLowerCase().includes(q) ||
        cat.includes(q) ||
        (produto?.sku ?? '').toLowerCase().includes(q)
      )
    })
  }, [saldos, saldoBusca, produtoMap, categoriaNomeMap])

  return (
    <Layout>
      <PageTitle title="Estoque" subtitle="Saldos e movimentações organizadas por período" />

      <div className="financeiro-status-tabs" style={{ marginBottom: 16 }} role="tablist" aria-label="Áreas do estoque">
        {AREA_TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={area === tab.id}
              className={`financeiro-status-tab ${area === tab.id ? 'financeiro-status-tab--active' : ''}`}
              onClick={() => setArea(tab.id)}
            >
              <Icon size={16} strokeWidth={1.8} style={{ marginRight: 6, verticalAlign: -2 }} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {area === 'saldos' && (
        <Card className="mb-section">
          <CardHeader style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={22} />
            Saldos por produto
          </CardHeader>
          <CardBody>
            <div className="estoque-toolbar">
              <div className="estoque-search">
                <Search size={16} />
                <input
                  type="search"
                  className="input-el"
                  placeholder="Buscar produto, SKU ou categoria..."
                  value={saldoBusca}
                  onChange={(e) => setSaldoBusca(e.currentTarget.value)}
                />
              </div>
              <span className="estoque-toolbar-meta">
                {saldosFiltrados.length} produto(s)
              </span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Categoria</th>
                    <th>Unidade</th>
                    <th style={{ textAlign: 'right' }}>Saldo</th>
                    <th style={{ textAlign: 'right' }}>Mínimo</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {saldosFiltrados.map((s) => {
                    const produto = produtoMap.get(s.produto_id)
                    const catNome =
                      produto?.categoria_id != null
                        ? categoriaNomeMap.get(produto.categoria_id) ?? '—'
                        : '—'
                    return (
                      <tr key={s.produto_id}>
                        <td>{s.nome}</td>
                        <td>{catNome}</td>
                        <td>{s.unidade}</td>
                        <td style={{ textAlign: 'right' }}>{formatQty(s.saldo)}</td>
                        <td style={{ textAlign: 'right' }}>{formatQty(s.estoque_minimo)}</td>
                        <td>
                          {(s.alerta_estoque_minimo ?? 1) !== 1 ? (
                            <span style={{ color: 'var(--color-text-muted)' }}>Sem alerta</span>
                          ) : s.saldo <= s.estoque_minimo ? (
                            <span style={{ color: 'var(--color-error)' }}>Abaixo do mínimo</span>
                          ) : (
                            <span style={{ color: 'var(--color-success)' }}>OK</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {saldosFiltrados.length === 0 && (
              <p className="comissoes-empty" style={{ marginTop: 16 }}>
                Nenhum produto encontrado.
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {area === 'movimentacoes' && (
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

          <div className="financeiro-toolbar-row financeiro-toolbar-row--between">
            <div className="financeiro-status-tabs">
              {TIPO_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`financeiro-status-tab ${tipoFiltro === tab.id ? 'financeiro-status-tab--active' : ''}`}
                  onClick={() => setTipoFiltro(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <Button leftIcon={<Plus size={18} />} onClick={openNovoMovimento}>
              Novo movimento
            </Button>
          </div>

          <div className="estoque-toolbar">
            <div className="estoque-search">
              <Search size={16} />
              <input
                type="search"
                className="input-el"
                placeholder="Buscar produto, SKU, categoria ou referência..."
                value={busca}
                onChange={(e) => setBusca(e.currentTarget.value)}
              />
            </div>
            <div className="estoque-categoria-filter">
              <select
                className="input-select"
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.currentTarget.value)}
                aria-label="Filtrar por categoria"
              >
                {categoriaOptions.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="estoque-kpis">
            <div className="estoque-kpi">
              <span className="estoque-kpi__label">Movimentos</span>
              <strong>{resumo.qtd}</strong>
              <span className="estoque-kpi__hint">{labelDemonstrativoPeriodo(competencia)}</span>
            </div>
            <div className="estoque-kpi estoque-kpi--entrada">
              <span className="estoque-kpi__label">
                <ArrowDownToLine size={14} /> Entradas
              </span>
              <strong>{formatQty(resumo.entradas)}</strong>
              <span className="estoque-kpi__hint">{formatCurrency(resumo.valorEntradas)}</span>
            </div>
            <div className="estoque-kpi estoque-kpi--saida">
              <span className="estoque-kpi__label">
                <ArrowUpFromLine size={14} /> Saídas
              </span>
              <strong>{formatQty(resumo.saidas)}</strong>
              <span className="estoque-kpi__hint">{formatCurrency(resumo.valorSaidas)}</span>
            </div>
            <div className="estoque-kpi">
              <span className="estoque-kpi__label">
                <RotateCcw size={14} /> Ajustes / Dev.
              </span>
              <strong>
                {resumo.ajustes} / {formatQty(resumo.devolucoes)}
              </strong>
              <span className="estoque-kpi__hint">qtd. ajustes · qtd. devoluções</span>
            </div>
          </div>

          {loadError && (
            <Alert variant="error" style={{ marginBottom: 16 }}>
              {loadError}
            </Alert>
          )}

          {loadingMov ? (
            <p className="vendas-loading">Carregando movimentações...</p>
          ) : movimentosFiltrados.length === 0 ? (
            <p className="comissoes-empty">Nenhuma movimentação encontrada neste filtro.</p>
          ) : (
            <div className="estoque-mov-grupos">
              {gruposPorDia.map(([dia, items]) => (
                <section key={dia} className="estoque-mov-dia">
                  <h3 className="estoque-mov-dia__title">
                    {formatDayLabel(items[0]?.created_at ?? dia)}
                    <span>{items.length} movimento(s)</span>
                  </h3>
                  <div className="estoque-movimentos-wrap">
                    <table className="estoque-movimentos-table">
                      <thead>
                        <tr>
                          <th>Horário</th>
                          <th>Produto</th>
                          <th>Categoria</th>
                          <th>Tipo</th>
                          <th style={{ textAlign: 'right' }}>Qtd</th>
                          <th style={{ textAlign: 'right' }}>Custo un.</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th>Referência</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((m) => {
                          const produto = produtoMap.get(m.produto_id)
                          const catNome =
                            produto?.categoria_id != null
                              ? categoriaNomeMap.get(produto.categoria_id) ?? 'Sem categoria'
                              : 'Sem categoria'
                          const signed = qtySigned(m)
                          const custo = m.custo_unitario
                          const total =
                            custo != null && Number.isFinite(custo)
                              ? Math.abs(m.quantidade) * custo
                              : null
                          return (
                            <tr key={m.id}>
                              <td className="estoque-mov-hora">{formatTime(m.created_at)}</td>
                              <td>
                                <div className="estoque-mov-produto">
                                  <strong>{produto?.nome ?? 'Produto removido'}</strong>
                                  {produto?.sku ? <span>SKU {produto.sku}</span> : null}
                                </div>
                              </td>
                              <td>{catNome}</td>
                              <td>
                                <span className={`produto-hist-badge ${tipoBadgeClass(m.tipo)}`}>
                                  {labelTipoMovimento(m.tipo)}
                                </span>
                              </td>
                              <td
                                style={{ textAlign: 'right' }}
                                className={
                                  signed > 0
                                    ? 'demonstrativos-valor--positivo'
                                    : signed < 0
                                      ? 'demonstrativos-valor--negativo'
                                      : ''
                                }
                              >
                                {signed > 0 ? '+' : ''}
                                {formatQty(signed)}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {custo == null ? '—' : formatCurrency(custo)}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {total == null ? '—' : formatCurrency(total)}
                              </td>
                              <td>{labelReferenciaMovimento(m.referencia_tipo, m.referencia_id)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog
        open={showForm}
        onClose={() => !saving && setShowForm(false)}
        title="Novo movimento de estoque"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" form="form-estoque-movimento" disabled={saving}>
              {saving ? 'Salvando...' : 'Registrar'}
            </Button>
          </>
        }
      >
        <form id="form-estoque-movimento" onSubmit={submitMovimento}>
          <div className="form-grid form-grid-2">
            <Select
              label="Tipo"
              value={form.tipo}
              onChange={(e) => {
                const v = e.currentTarget?.value
                if (v == null) return
                setForm((f) => ({ ...f, tipo: v as TipoMovimento }))
              }}
              options={TIPOS}
            />
            <Select
              label="Produto"
              required
              value={form.produto_id}
              onChange={(e) => {
                const v = e.currentTarget?.value
                if (v == null) return
                setForm((f) => ({ ...f, produto_id: v }))
              }}
              options={produtosComEstoque.map((p) => ({ value: p.id, label: p.nome }))}
              placeholder="Selecione"
            />
            <Input
              label={quantidadeLabel}
              type="number"
              step="0.01"
              value={form.quantidade || ''}
              onChange={(e) => {
                const el = e.currentTarget
                if (!el) return
                setForm((f) => ({ ...f, quantidade: Number(el.value) || 0 }))
              }}
              required
            />
            <Input
              label="Custo unitário (R$) — opcional"
              type="number"
              step="0.01"
              min={0}
              value={form.custo_unitario || ''}
              onChange={(e) => {
                const el = e.currentTarget
                if (!el) return
                setForm((f) => ({ ...f, custo_unitario: Number(el.value) || 0 }))
              }}
            />
          </div>
          {error && (
            <Alert variant="error" style={{ marginTop: 16 }}>
              {error}
            </Alert>
          )}
        </form>
      </Dialog>
    </Layout>
  )
}
