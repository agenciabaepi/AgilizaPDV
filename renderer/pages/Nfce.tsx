import { useState, useEffect, useCallback, useRef } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useSyncDataRefresh } from '../hooks/useSyncDataRefresh'
import type { NfceListItem, NfceStatus, StatusNfce } from '../vite-env'
import { PageTitle, Button, Select, Dialog } from '../components/ui'
import {
  FileCheck,
  Receipt,
  AlertCircle,
  XCircle,
  CheckCircle,
  Calendar,
  Search,
  Eye,
  Printer,
  ShoppingCart,
  ExternalLink,
  FileText,
  CloudUpload,
} from 'lucide-react'

const SITUACOES: { value: '' | NfceStatus; label: string }[] = [
  { value: '', label: 'Todas as situações' },
  { value: 'PENDENTE', label: 'Em aberto' },
  { value: 'ERRO', label: 'Em processo' },
  { value: 'REJEITADA', label: 'Rejeitadas' },
  { value: 'CANCELADA', label: 'Canceladas' },
  { value: 'AUTORIZADA', label: 'Autorizadas' },
]

const REGISTROS_POR_PAGINA = [10, 20, 50]

function parseDateOnlyLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((n) => Number(n))
  // Interpreta a data como "local midnight" (evita new Date('YYYY-MM-DD') = UTC midnight)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0)
}

function toDateInputValueLocal(date: Date): string {
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function getConsultaNfceUrl(chave: string | null): string {
  if (!chave || chave.length < 44) return ''
  const uf = chave.slice(0, 2)
  const urls: Record<string, string> = {
    '35': 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx',
    '43': 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx',
    '31': 'https://nfce.fazenda.mg.gov.br/portalnfce',
    '41': 'https://www.fazenda.pr.gov.br/nfce/consulta',
    '33': 'https://www4.fazenda.rj.gov.br/certidao-internet/ConsultaNFCe',
  }
  const base = urls[uf] || urls['35']
  return base.includes('?') ? `${base}&p=${chave}` : `${base}?p=${chave}`
}

export function Nfce() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const canFiscalBackfill =
    session &&
    (('suporte' in session && session.suporte) ||
      ('role' in session && ['admin', 'gerente'].includes(String(session.role).toLowerCase())))
  const syncRefreshKey = useSyncDataRefresh()

  const [list, setList] = useState<NfceListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return toDateInputValueLocal(d)
  })
  const [dataFim, setDataFim] = useState(() => toDateInputValueLocal(new Date()))
  const [situacao, setSituacao] = useState<'' | NfceStatus>('')
  const [page, setPage] = useState(1)
  const [porPagina, setPorPagina] = useState(10)

  const [visualizarVendaId, setVisualizarVendaId] = useState<string | null>(null)
  const [nfceDetalhes, setNfceDetalhes] = useState<{
    detalhes: { venda: { numero: number; total: number; subtotal: number; desconto_total: number; troco: number; created_at: string }; empresa_nome: string; itens: { descricao: string; quantidade: number; total: number }[]; pagamentos: { forma: string; valor: number }[] }
    status: StatusNfce
  } | null>(null)
  const [cupomPreviewHtml, setCupomPreviewHtml] = useState<string | null>(null)
  const [imprimindoId, setImprimindoId] = useState<string | null>(null)
  const [emitindoId, setEmitindoId] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)
  const [backfillMirror, setBackfillMirror] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const nfcePrintRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    if (!empresaId) return
    setLoading(true)
    const inicio = parseDateOnlyLocal(dataInicio)
    const fim = parseDateOnlyLocal(dataFim)
    // Inclui o dia inteiro no intervalo (hora final local)
    fim.setHours(23, 59, 59, 999)
    window.electronAPI.nfce
      .list(empresaId, {
        dataInicio: inicio.toISOString(),
        dataFim: fim.toISOString(),
        status: situacao || undefined,
        search: search.trim() || undefined,
      })
      .then(setList)
      .finally(() => setLoading(false))
  }, [empresaId, dataInicio, dataFim, situacao, search])

  useEffect(() => {
    load()
  }, [load, syncRefreshKey])

  // Se filtros mudam, a paginação atual pode ficar fora do range e a tabela
  // mostrar um subconjunto que confunde com os totais dos cards.
  useEffect(() => {
    setPage(1)
  }, [dataInicio, dataFim, situacao, search])

  useEffect(() => {
    if (!visualizarVendaId) {
      setNfceDetalhes(null)
      setCupomPreviewHtml(null)
      return
    }
    setNfceDetalhes(null)
    setCupomPreviewHtml(null)
    Promise.all([
      window.electronAPI.cupom.getDetalhes(visualizarVendaId),
      window.electronAPI.vendas.getStatusNfce(visualizarVendaId),
    ]).then(([detalhes, status]) => {
      if (detalhes && status?.emitida) {
        setNfceDetalhes({ detalhes: detalhes as DetalhesNfce, status })
        window.electronAPI.cupom.getHtmlNfce(visualizarVendaId).then((html) => setCupomPreviewHtml(html ?? null))
      }
    })
  }, [visualizarVendaId])

  type DetalhesNfce = {
    empresa_nome: string
    venda: { numero: number; total: number; subtotal: number; desconto_total: number; troco: number; created_at: string }
    itens: { descricao: string; quantidade: number; total: number }[]
    pagamentos: { forma: string; valor: number }[]
  }

  const handleImprimirCupom = async (vendaId: string) => {
    setImprimindoId(vendaId)
    setMessage(null)
    try {
      const result = await window.electronAPI.cupom.imprimirNfce(vendaId)
      if (result.ok) {
        setMessage({ type: 'success', text: 'Cupom fiscal enviado para impressão.' })
      } else {
        setMessage({ type: 'error', text: result.error ?? 'Falha ao imprimir.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro ao imprimir cupom fiscal.' })
    } finally {
      setImprimindoId(null)
    }
  }

  const handleGerarDanfeA4 = async (vendaId: string) => {
    setMessage(null)
    try {
      const api: any = (window as any).electronAPI
      const result = await api?.nfce?.gerarDanfeA4?.(vendaId)
      if (result?.ok) {
        setMessage({
          type: 'success',
          text: 'DANFE A4 gerada e aberta no visualizador padrão.',
        })
      } else {
        setMessage({
          type: 'error',
          text: result?.error ?? 'Erro ao gerar a DANFE A4.',
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage({ type: 'error', text: msg || 'Erro ao gerar a DANFE A4.' })
    }
  }

  const handleEmitirNfce = async (vendaId: string) => {
    setEmitindoId(vendaId)
    setMessage(null)
    try {
      const result = await window.electronAPI.vendas.emitirNfce(vendaId)
      if (result.ok) {
        setMessage({ type: 'success', text: 'NFC-e emitida com sucesso.' })
        load()
        setVisualizarVendaId(vendaId)
      } else {
        setMessage({ type: 'error', text: result.error ?? 'Erro ao emitir NFC-e.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao emitir NFC-e.' })
    } finally {
      setEmitindoId(null)
    }
  }

  const totalGeral = list.reduce((acc, n) => acc + n.venda_total, 0)
  const porStatus = {
    PENDENTE: list.filter((n) => n.status === 'PENDENTE'),
    ERRO: list.filter((n) => n.status === 'ERRO'),
    REJEITADA: list.filter((n) => n.status === 'REJEITADA'),
    CANCELADA: list.filter((n) => n.status === 'CANCELADA'),
    AUTORIZADA: list.filter((n) => n.status === 'AUTORIZADA'),
  }
  const totalAberto = porStatus.PENDENTE.reduce((a, n) => a + n.venda_total, 0)
  const totalProcesso = porStatus.ERRO.reduce((a, n) => a + n.venda_total, 0)
  const totalRejeitadas = porStatus.REJEITADA.reduce((a, n) => a + n.venda_total, 0)
  const totalCanceladas = porStatus.CANCELADA.reduce((a, n) => a + n.venda_total, 0)
  const totalAutorizadas = porStatus.AUTORIZADA.reduce((a, n) => a + n.venda_total, 0)

  const totalPages = Math.max(1, Math.ceil(list.length / porPagina))
  const paginated = list.slice((page - 1) * porPagina, page * porPagina)

  const handleToggleRow = (vendaId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(vendaId)
      else next.delete(vendaId)
      return next
    })
  }

  const handleToggleAllCurrentPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        paginated.forEach((row) => next.add(row.venda_id))
      } else {
        paginated.forEach((row) => next.delete(row.venda_id))
      }
      return next
    })
  }

  const handleExportXml = async () => {
    if (!empresaId || selectedIds.size === 0) return
    setExportando(true)
    setMessage(null)
    try {
      const api: any = (window as any).electronAPI
      const result = await api?.nfce?.exportXmlZip?.(empresaId, Array.from(selectedIds))
      if (result?.ok) {
        setMessage({
          type: 'success',
          text: `Exportado(s) ${result.count ?? selectedIds.size} XML em um arquivo ZIP.`,
        })
      } else {
        setMessage({
          type: 'error',
          text: result?.error ?? 'Erro ao exportar XML das NFC-e.',
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage({ type: 'error', text: msg || 'Erro ao exportar XML das NFC-e.' })
    } finally {
      setExportando(false)
    }
  }

  const handleBackfillMirror = async () => {
    const fn = window.electronAPI?.sync?.backfillFiscalMirror
    if (!fn || !empresaId) return
    setBackfillMirror(true)
    setMessage(null)
    try {
      const r = await fn(empresaId)
      if (r.ok) {
        setMessage({
          type: 'success',
          text: `Fila de sincronização: ${r.nfce} NFC-e e ${r.nfe} NF-e reenviadas para a nuvem. Aguarde o sync automático ou use Sincronizar.`,
        })
      } else {
        setMessage({ type: 'error', text: r.error ?? 'Não foi possível reenviar as notas.' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Erro ao reenviar notas.' })
    } finally {
      setBackfillMirror(false)
    }
  }

  if (!empresaId) {
    return (
      <Layout>
        <PageTitle title="Notas Fiscais de Consumidor (NFC-e)" subtitle="Sessão inválida." />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="nfce-page-header">
        <PageTitle
          title="Notas Fiscais de Consumidor (NFC-e)"
          subtitle="Resumo das notas emitidas e em processamento"
        />
      </div>

      <div className="nfce-cards-resumo">
        <div className="nfce-card-resumo nfce-card-resumo--aberto">
          <div className="nfce-card-resumo__icon">
            <Receipt size={22} strokeWidth={1.8} />
          </div>
          <div className="nfce-card-resumo__content">
            <span className="nfce-card-resumo__label">Em aberto</span>
            <span className="nfce-card-resumo__value">R$ {totalAberto.toFixed(2)}</span>
            <span className="nfce-card-resumo__count">({porStatus.PENDENTE.length} nota{porStatus.PENDENTE.length !== 1 ? 's' : ''})</span>
          </div>
        </div>
        <div className="nfce-card-resumo nfce-card-resumo--processo">
          <div className="nfce-card-resumo__icon">
            <AlertCircle size={22} strokeWidth={1.8} />
          </div>
          <div className="nfce-card-resumo__content">
            <span className="nfce-card-resumo__label">Em processo</span>
            <span className="nfce-card-resumo__value">R$ {totalProcesso.toFixed(2)}</span>
            <span className="nfce-card-resumo__count">({porStatus.ERRO.length} nota{porStatus.ERRO.length !== 1 ? 's' : ''})</span>
          </div>
        </div>
        <div className="nfce-card-resumo nfce-card-resumo--rejeitadas">
          <div className="nfce-card-resumo__icon">
            <XCircle size={22} strokeWidth={1.8} />
          </div>
          <div className="nfce-card-resumo__content">
            <span className="nfce-card-resumo__label">Rejeitadas</span>
            <span className="nfce-card-resumo__value">R$ {totalRejeitadas.toFixed(2)}</span>
            <span className="nfce-card-resumo__count">({porStatus.REJEITADA.length} nota{porStatus.REJEITADA.length !== 1 ? 's' : ''})</span>
          </div>
        </div>
        <div className="nfce-card-resumo nfce-card-resumo--canceladas">
          <div className="nfce-card-resumo__icon">
            <XCircle size={22} strokeWidth={1.8} />
          </div>
          <div className="nfce-card-resumo__content">
            <span className="nfce-card-resumo__label">Canceladas</span>
            <span className="nfce-card-resumo__value">R$ {totalCanceladas.toFixed(2)}</span>
            <span className="nfce-card-resumo__count">({porStatus.CANCELADA.length} nota{porStatus.CANCELADA.length !== 1 ? 's' : ''})</span>
          </div>
        </div>
        <div className="nfce-card-resumo nfce-card-resumo--autorizadas">
          <div className="nfce-card-resumo__icon">
            <CheckCircle size={22} strokeWidth={1.8} />
          </div>
          <div className="nfce-card-resumo__content">
            <span className="nfce-card-resumo__label">Autorizadas</span>
            <span className="nfce-card-resumo__value">R$ {totalAutorizadas.toFixed(2)}</span>
            <span className="nfce-card-resumo__count">({porStatus.AUTORIZADA.length} nota{porStatus.AUTORIZADA.length !== 1 ? 's' : ''})</span>
          </div>
        </div>
        <div className="nfce-card-resumo nfce-card-resumo--total">
          <div className="nfce-card-resumo__icon">
            <FileCheck size={22} strokeWidth={1.8} />
          </div>
          <div className="nfce-card-resumo__content">
            <span className="nfce-card-resumo__label">Total</span>
            <span className="nfce-card-resumo__value">R$ {totalGeral.toFixed(2)}</span>
            <span className="nfce-card-resumo__count">({list.length} nota{list.length !== 1 ? 's' : ''})</span>
          </div>
        </div>
      </div>

      <div className="nfce-toolbar">
        <div className="nfce-toolbar__filters">
          <div className="nfce-search-wrap">
            <Search size={18} className="nfce-search-icon" />
            <input
              type="text"
              className="input-el nfce-search-input"
              placeholder="Pesquisar por número ou destinatário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="nfce-dates-wrap">
            <Calendar size={18} />
            <input
              type="date"
              className="input-el nfce-date-input"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
            <span className="nfce-date-sep">até</span>
            <input
              type="date"
              className="input-el nfce-date-input"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>
          <Select
            value={situacao}
            onChange={(e) => setSituacao((e.target.value || '') as '' | NfceStatus)}
            options={SITUACOES.map((s) => ({ value: s.value, label: s.label }))}
            style={{ minWidth: 180 }}
          />
        </div>
        <div className="nfce-toolbar__actions">
          {canFiscalBackfill && typeof window.electronAPI?.sync?.backfillFiscalMirror === 'function' && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<CloudUpload size={14} />}
              onClick={() => void handleBackfillMirror()}
              disabled={backfillMirror}
              title="Reenvia metadados de todas as NFC-e/NF-e desta loja para o Supabase (útil uma vez após criar as tabelas espelho)."
            >
              {backfillMirror ? 'Enviando...' : 'Nuvem: reenviar notas'}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<FileCheck size={14} />}
            onClick={handleExportXml}
            disabled={selectedIds.size === 0 || exportando}
          >
            {exportando ? 'Exportando...' : `Exportar XML (${selectedIds.size || 0})`}
          </Button>
        </div>
      </div>

      {message && (
        <div
          role="alert"
          className={`nfce-message nfce-message--${message.type}`}
        >
          {message.text}
        </div>
      )}

      <div className="nfce-table-wrap">
        {loading ? (
          <p className="nfce-loading">Carregando...</p>
        ) : list.length === 0 ? (
          <p className="nfce-empty">Nenhuma NFC-e no período com os filtros aplicados.</p>
        ) : (
          <>
            <div className="table-responsive">
              <table className="nfce-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={
                          paginated.length > 0 &&
                          paginated.every((row) => selectedIds.has(row.venda_id))
                        }
                        onChange={(e) => handleToggleAllCurrentPage(e.target.checked)}
                      />
                    </th>
                    <th className="nfce-table__th--tipo">Tipo</th>
                    <th className="nfce-table__th--finalidade">Finalidade</th>
                    <th className="nfce-table__th--numero">Número</th>
                    <th className="nfce-table__th--data">Data</th>
                    <th className="nfce-table__th--dest">Destinatário</th>
                    <th className="nfce-table__th--valor">Valor total</th>
                    <th className="nfce-table__th--situacao">Situação</th>
                    <th className="nfce-table__th--acoes">Operações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((row) => (
                    <tr key={row.venda_id} className="nfce-table__row">
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.venda_id)}
                          onChange={(e) => handleToggleRow(row.venda_id, e.target.checked)}
                        />
                      </td>
                      <td className="nfce-table__tipo">
                        <span className="nfce-badge-tipo">S</span>
                      </td>
                      <td className="nfce-table__finalidade">
                        <span className="nfce-pill nfce-pill--finalidade">NFC-e normal</span>
                      </td>
                      <td className="nfce-table__numero">
                        1-{String(row.numero_nfce).padStart(5, '0')}
                      </td>
                      <td className="nfce-table__data">
                        {new Date(row.venda_created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="nfce-table__dest">{row.cliente_nome || '—'}</td>
                      <td className="nfce-table__valor">
                        <span className="nfce-valor">
                          <ShoppingCart size={14} className="nfce-valor-icon" />
                          R$ {row.venda_total.toFixed(2)}
                        </span>
                      </td>
                      <td className="nfce-table__situacao">
                        <span className={`nfce-pill nfce-pill--${row.status.toLowerCase()}`}>
                          {row.status === 'PENDENTE' && 'Em aberto'}
                          {row.status === 'ERRO' && 'Em processo'}
                          {row.status === 'REJEITADA' && 'Rejeitada'}
                          {row.status === 'CANCELADA' && 'Cancelada'}
                          {row.status === 'AUTORIZADA' && 'Autorizada'}
                        </span>
                      </td>
                      <td className="nfce-table__acoes">
                        {row.status === 'AUTORIZADA' ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              leftIcon={<Eye size={14} />}
                              onClick={() => setVisualizarVendaId(row.venda_id)}
                              title="Visualizar NFC-e"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              leftIcon={<Printer size={14} />}
                              onClick={() => handleImprimirCupom(row.venda_id)}
                              disabled={imprimindoId === row.venda_id}
                              title="Imprimir cupom fiscal"
                            />
                          </>
                        ) : row.status === 'PENDENTE' || row.status === 'REJEITADA' || row.status === 'ERRO' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            leftIcon={<FileCheck size={14} />}
                            onClick={() => handleEmitirNfce(row.venda_id)}
                            disabled={emitindoId === row.venda_id}
                            title="Emitir NFC-e"
                          >
                            {emitindoId === row.venda_id ? 'Emitindo...' : 'Emitir'}
                          </Button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="nfce-pagination">
              <span className="nfce-pagination__info">
                {list.length} registro{list.length !== 1 ? 's' : ''} em {totalPages} página{totalPages !== 1 ? 's' : ''}
              </span>
              <div className="nfce-pagination__controls">
                <Select
                  value={String(porPagina)}
                  onChange={(e) => {
                    setPorPagina(Number(e.target.value))
                    setPage(1)
                  }}
                  options={REGISTROS_POR_PAGINA.map((n) => ({ value: String(n), label: `${n} por página` }))}
                  style={{ minWidth: 140 }}
                />
                <div className="nfce-pagination__buttons">
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={page <= 1}
                    onClick={() => setPage(1)}
                  >
                    Primeira
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </button>
                  <span className="nfce-pagination__page">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Próxima
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(totalPages)}
                  >
                    Última
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog
        open={visualizarVendaId !== null}
        onClose={() => setVisualizarVendaId(null)}
        title="NFC-e"
        size="large"
        footer={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {nfceDetalhes?.status?.chave && getConsultaNfceUrl(nfceDetalhes.status.chave) ? (
              <Button
                variant="secondary"
                leftIcon={<ExternalLink size={16} />}
                onClick={() => window.open(getConsultaNfceUrl(nfceDetalhes!.status.chave!), '_blank')}
              >
                Consultar na SEFAZ
              </Button>
            ) : null}
            <Button
              leftIcon={<Printer size={16} />}
              onClick={() => visualizarVendaId && handleImprimirCupom(visualizarVendaId)}
              disabled={!visualizarVendaId || imprimindoId === visualizarVendaId}
            >
              {imprimindoId === visualizarVendaId ? 'Imprimindo...' : 'Imprimir cupom fiscal'}
            </Button>
            <Button
              variant="secondary"
              leftIcon={<FileText size={16} />}
              onClick={() => visualizarVendaId && handleGerarDanfeA4(visualizarVendaId)}
              disabled={!visualizarVendaId}
            >
              Gerar DANFE A4
            </Button>
            <Button variant="secondary" onClick={() => setVisualizarVendaId(null)}>
              Fechar
            </Button>
          </div>
        }
      >
        <div ref={nfcePrintRef} className="nfce-print-area">
          {!nfceDetalhes ? (
            <p style={{ color: 'var(--color-text-muted)' }}>Carregando...</p>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>Pré-visualização do cupom fiscal</div>
                <div
                  style={{
                    width: 302,
                    maxWidth: '100%',
                    margin: '0 auto',
                    background: '#fff',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }}
                >
                  {cupomPreviewHtml === null ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                      Carregando pré-visualização...
                    </div>
                  ) : cupomPreviewHtml ? (
                    <iframe
                      title="Cupom fiscal NFC-e"
                      srcDoc={cupomPreviewHtml}
                      style={{
                        display: 'block',
                        width: 302,
                        minHeight: 560,
                        border: 0,
                        transformOrigin: 'top left',
                      }}
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                      Pré-visualização disponível apenas no modo local.
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
                {nfceDetalhes.status.chave && (
                  <div style={{ marginBottom: 12, padding: 12, background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', wordBreak: 'break-all', fontSize: 'var(--text-xs)' }}>
                    <div style={{ marginBottom: 4, fontWeight: 600 }}>Chave de acesso</div>
                    <div>{nfceDetalhes.status.chave.replace(/(.{4})/g, '$1 ').trim()}</div>
                    {nfceDetalhes.status.protocolo && (
                      <div style={{ marginTop: 8 }}><strong>Protocolo:</strong> {nfceDetalhes.status.protocolo}</div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Dialog>
    </Layout>
  )
}
