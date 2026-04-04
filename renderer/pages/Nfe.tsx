import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useSyncDataRefresh } from '../hooks/useSyncDataRefresh'
import type { NfeStatus, NfeListItem } from '../vite-env'
import { PageTitle, Button, Select, Dialog } from '../components/ui'
import {
  FileCheck,
  AlertCircle,
  XCircle,
  CheckCircle,
  Calendar,
  Search,
  FileText,
  Printer,
  CloudUpload,
} from 'lucide-react'

const SITUACOES: { value: '' | NfeStatus; label: string }[] = [
  { value: '', label: 'Todas as situações' },
  { value: 'PENDENTE', label: 'Em aberto' },
  { value: 'ERRO', label: 'Em processo' },
  { value: 'REJEITADA', label: 'Rejeitadas' },
  { value: 'CANCELADA', label: 'Canceladas' },
  { value: 'AUTORIZADA', label: 'Autorizadas' },
]

const REGISTROS_POR_PAGINA = [10, 20, 50]

/** Datas vindas do SQLite (`YYYY-MM-DD HH:MM:SS`) ou ISO; evita `+ 'Z'` cego (quebrava se já houvesse `Z`). */
function formatNfeListDate(value: string | null | undefined): string {
  if (value == null || String(value).trim() === '') return '—'
  let s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    s = s.replace(' ', 'T')
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function toDateInputValueLocal(date: Date): string {
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function Nfe() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const canFiscalBackfill =
    session &&
    (('suporte' in session && session.suporte) ||
      ('role' in session && ['admin', 'gerente'].includes(String(session.role).toLowerCase())))
  const syncRefreshKey = useSyncDataRefresh()
  const navigate = useNavigate()

  const [list, setList] = useState<NfeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return toDateInputValueLocal(d)
  })
  const [dataFim, setDataFim] = useState(() => toDateInputValueLocal(new Date()))
  const [situacao, setSituacao] = useState<'' | NfeStatus>('')
  const [page, setPage] = useState(1)
  const [porPagina, setPorPagina] = useState(10)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )
  const [danfePreview, setDanfePreview] = useState<{ vendaId: string; dataUrl: string } | null>(null)
  const [danfePreviewLoading, setDanfePreviewLoading] = useState(false)
  const [danfePrinting, setDanfePrinting] = useState(false)
  const [backfillMirror, setBackfillMirror] = useState(false)

  const load = useCallback(() => {
    if (!empresaId) return
    setLoading(true)
    window.electronAPI.nfe
      .list(empresaId, {
        dataInicio: dataInicio,
        dataFim: dataFim,
        status: situacao || undefined,
        search: search.trim() || undefined,
      })
      .then(setList)
      .catch(() => {
        setList([])
        setMessage({
          type: 'error',
          text: 'Erro ao carregar as NF-e.',
        })
      })
      .finally(() => setLoading(false))
  }, [empresaId, dataInicio, dataFim, situacao, search])

  useEffect(() => {
    load()
  }, [load, syncRefreshKey])

  // Se filtros mudam, a paginação atual pode ficar fora do range e a tabela
  // aparentar "lista vazia". Sempre volta para a primeira página.
  useEffect(() => {
    setPage(1)
  }, [dataInicio, dataFim, situacao, search])

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

  const handleAbrirDanfe = async (vendaId: string) => {
    setMessage(null)
    setDanfePreviewLoading(true)
    try {
      const apiNfe: any = window.electronAPI?.nfe

      // Fallback: se o preload ainda estiver desatualizado e não expor `getDanfePdfPath`,
      // abre a visualização interna já com botão de impressão (evita abrir site externo).
      if (typeof apiNfe?.getDanfePdfDataUrl !== 'function') {
        const r = await apiNfe?.gerarDanfeA4?.(vendaId)
        if (!r?.ok) setMessage({ type: 'error', text: r?.error ?? 'Erro ao abrir DANFE.' })
        return
      }

      const result = await apiNfe.getDanfePdfDataUrl(vendaId)
      if (result.ok && result.dataUrl) setDanfePreview({ vendaId, dataUrl: result.dataUrl })
      else
        setMessage({
          type: 'error',
          text: result.error ?? 'Erro ao preparar a pré-visualização da DANFE.',
        })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessage({
        type: 'error',
        text: msg || 'Erro ao gerar a DANFE NF-e.',
      })
    } finally {
      setDanfePreviewLoading(false)
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
          text: `Fila de sincronização: ${r.nfce} NFC-e e ${r.nfe} NF-e reenviadas para a nuvem. Aguarde o sync ou use Sincronizar.`,
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
        <PageTitle title="Notas Fiscais Eletrônicas (NF-e)" subtitle="Sessão inválida." />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="nfce-page-header">
        <PageTitle
          title="Notas Fiscais Eletrônicas (NF-e)"
          subtitle="Resumo das NF-e emitidas e em processamento"
        />
      </div>

      <div className="nfce-cards-resumo">
        <div className="nfce-card-resumo nfce-card-resumo--aberto">
          <div className="nfce-card-resumo__icon">
            <FileCheck size={22} strokeWidth={1.8} />
          </div>
          <div className="nfce-card-resumo__content">
            <span className="nfce-card-resumo__label">Em aberto</span>
            <span className="nfce-card-resumo__value">R$ {totalAberto.toFixed(2)}</span>
            <span className="nfce-card-resumo__count">
              ({porStatus.PENDENTE.length} nota
              {porStatus.PENDENTE.length !== 1 ? 's' : ''})
            </span>
          </div>
        </div>
        <div className="nfce-card-resumo nfce-card-resumo--processo">
          <div className="nfce-card-resumo__icon">
            <AlertCircle size={22} strokeWidth={1.8} />
          </div>
          <div className="nfce-card-resumo__content">
            <span className="nfce-card-resumo__label">Em processo</span>
            <span className="nfce-card-resumo__value">R$ {totalProcesso.toFixed(2)}</span>
            <span className="nfce-card-resumo__count">
              ({porStatus.ERRO.length} nota{porStatus.ERRO.length !== 1 ? 's' : ''})
            </span>
          </div>
        </div>
        <div className="nfce-card-resumo nfce-card-resumo--rejeitadas">
          <div className="nfce-card-resumo__icon">
            <XCircle size={22} strokeWidth={1.8} />
          </div>
          <div className="nfce-card-resumo__content">
            <span className="nfce-card-resumo__label">Rejeitadas</span>
            <span className="nfce-card-resumo__value">R$ {totalRejeitadas.toFixed(2)}</span>
            <span className="nfce-card-resumo__count">
              ({porStatus.REJEITADA.length} nota
              {porStatus.REJEITADA.length !== 1 ? 's' : ''})
            </span>
          </div>
        </div>
        <div className="nfce-card-resumo nfce-card-resumo--canceladas">
          <div className="nfce-card-resumo__icon">
            <XCircle size={22} strokeWidth={1.8} />
          </div>
          <div className="nfce-card-resumo__content">
            <span className="nfce-card-resumo__label">Canceladas</span>
            <span className="nfce-card-resumo__value">R$ {totalCanceladas.toFixed(2)}</span>
            <span className="nfce-card-resumo__count">
              ({porStatus.CANCELADA.length} nota
              {porStatus.CANCELADA.length !== 1 ? 's' : ''})
            </span>
          </div>
        </div>
        <div className="nfce-card-resumo nfce-card-resumo--autorizadas">
          <div className="nfce-card-resumo__icon">
            <CheckCircle size={22} strokeWidth={1.8} />
          </div>
          <div className="nfce-card-resumo__content">
            <span className="nfce-card-resumo__label">Autorizadas</span>
            <span className="nfce-card-resumo__value">R$ {totalAutorizadas.toFixed(2)}</span>
            <span className="nfce-card-resumo__count">
              ({porStatus.AUTORIZADA.length} nota
              {porStatus.AUTORIZADA.length !== 1 ? 's' : ''})
            </span>
          </div>
        </div>
        <div className="nfce-card-resumo nfce-card-resumo--total">
          <div className="nfce-card-resumo__icon">
            <FileCheck size={22} strokeWidth={1.8} />
          </div>
          <div className="nfce-card-resumo__content">
            <span className="nfce-card-resumo__label">Total</span>
            <span className="nfce-card-resumo__value">R$ {totalGeral.toFixed(2)}</span>
            <span className="nfce-card-resumo__count">
              ({list.length} nota{list.length !== 1 ? 's' : ''})
            </span>
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
            onChange={(e) =>
              setSituacao((e.target.value || '') as '' | NfeStatus)
            }
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
              title="Reenvia metadados de todas as NFC-e/NF-e desta loja para o Supabase."
            >
              {backfillMirror ? 'Enviando...' : 'Nuvem: reenviar notas'}
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            leftIcon={<FileText size={14} />}
            onClick={() => navigate('/nfe/criar')}
          >
            Nova NF-e
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

      <Dialog
        open={danfePreview !== null}
        onClose={() => setDanfePreview(null)}
        title="DANFE NF-e"
        size="large"
        footer={
          danfePreview ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                leftIcon={<Printer size={16} />}
                onClick={async () => {
                  if (!danfePreview) return
                  setDanfePrinting(true)
                  setMessage(null)
                  try {
                    const apiNfe: any = window.electronAPI?.nfe
                    if (typeof apiNfe?.imprimirDanfeA4 !== 'function') {
                      // Fallback: sem suporte no preload, abre janela de DANFE com botão de imprimir
                      await apiNfe?.gerarDanfeA4?.(danfePreview.vendaId)
                      setDanfePreview(null)
                      return
                    }

                    const r = await apiNfe.imprimirDanfeA4(danfePreview.vendaId)
                    if (!r.ok) setMessage({ type: 'error', text: r.error ?? 'Falha ao abrir impressão.' })
                    setDanfePreview(null)
                  } finally {
                    setDanfePrinting(false)
                  }
                }}
                disabled={danfePrinting}
              >
                {danfePrinting ? 'Imprimindo...' : 'Imprimir'}
              </Button>
              <Button variant="secondary" onClick={() => setDanfePreview(null)} disabled={danfePrinting}>
                Fechar
              </Button>
            </div>
          ) : null
        }
      >
        <div style={{ width: '100%' }}>
          {danfePreviewLoading ? (
            <p style={{ color: 'var(--color-text-muted)', padding: 16 }}>Carregando pré-visualização...</p>
          ) : danfePreview ? (
            <div style={{ width: '100%', height: '70vh', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              <embed
                title="Pré-visualização DANFE NF-e"
                src={danfePreview.dataUrl}
                type="application/pdf"
                style={{ width: '100%', height: '100%', border: 0 }}
              />
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', padding: 16 }}>Pré-visualização indisponível.</p>
          )}
        </div>
      </Dialog>

      <div className="nfce-table-wrap">
        {loading ? (
          <p className="nfce-loading">Carregando...</p>
        ) : list.length === 0 ? (
          <p className="nfce-empty">
            Nenhuma NF-e no período com os filtros aplicados.
          </p>
        ) : (
          <>
            <div className="table-responsive">
              <table className="nfce-table">
                <thead>
                  <tr>
                    <th className="nfce-table__th--tipo">Tipo</th>
                    <th className="nfce-table__th--finalidade">Finalidade</th>
                    <th className="nfce-table__th--numero">Número</th>
                    <th className="nfce-table__th--data">Emissão</th>
                    <th className="nfce-table__th--data">Data Venda</th>
                    <th className="nfce-table__th--dest">Destinatário</th>
                    <th className="nfce-table__th--valor">Valor total</th>
                    <th className="nfce-table__th--situacao">Situação</th>
                    <th className="nfce-table__th--acoes">Operações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((row) => (
                    <tr key={row.venda_id} className="nfce-table__row">
                      <td className="nfce-table__tipo">
                        <span className="nfce-badge-tipo">N</span>
                      </td>
                      <td className="nfce-table__finalidade">
                        <span className="nfce-pill nfce-pill--finalidade">
                          NF-e normal
                        </span>
                      </td>
                      <td className="nfce-table__numero">
                        1-{String(row.numero_nfe).padStart(5, '0')}
                      </td>
                      <td className="nfce-table__data">{formatNfeListDate(row.nfe_created_at)}</td>
                      <td className="nfce-table__data">{formatNfeListDate(row.venda_created_at)}</td>
                      <td className="nfce-table__dest">
                        {row.cliente_nome || '—'}
                      </td>
                      <td className="nfce-table__valor">
                        R$ {row.venda_total.toFixed(2)}
                      </td>
                      <td className="nfce-table__situacao">
                        <span
                          className={`nfce-pill nfce-pill--${row.status.toLowerCase()}`}
                        >
                          {row.status === 'PENDENTE' && 'Em aberto'}
                          {row.status === 'ERRO' && 'Em processo'}
                          {row.status === 'REJEITADA' && 'Rejeitada'}
                          {row.status === 'CANCELADA' && 'Cancelada'}
                          {row.status === 'AUTORIZADA' && 'Autorizada'}
                        </span>
                      </td>
                      <td className="nfce-table__acoes">
                        {row.status === 'AUTORIZADA' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            leftIcon={<FileText size={14} />}
                            onClick={() => handleAbrirDanfe(row.venda_id)}
                            title="Abrir DANFE NF-e"
                          >
                            Abrir DANFE
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
                {list.length} registro{list.length !== 1 ? 's' : ''} em{' '}
                {totalPages} página{totalPages !== 1 ? 's' : ''}
              </span>
              <div className="nfce-pagination__controls">
                <Select
                  value={String(porPagina)}
                  onChange={(e) => {
                    setPorPagina(Number(e.target.value))
                    setPage(1)
                  }}
                  options={REGISTROS_POR_PAGINA.map((n) => ({
                    value: String(n),
                    label: `${n} por página`,
                  }))}
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
    </Layout>
  )
}

