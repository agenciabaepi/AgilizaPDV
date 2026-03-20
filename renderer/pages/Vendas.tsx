import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import type { VendaComNfce, StatusNfce } from '../vite-env'
import { PageTitle, Button, ConfirmDialog, Dialog } from '../components/ui'
import { Printer, Trash2, Calendar, Receipt, DollarSign, CheckCircle, XCircle, FileCheck, Eye, ExternalLink } from 'lucide-react'

type Periodo = 'hoje' | 'semana' | 'mes'

function getPeriodoRange(periodo: Periodo): { dataInicio: string; dataFim: string } {
  const now = new Date()
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (periodo === 'hoje') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    return { dataInicio: start.toISOString(), dataFim: endOfToday.toISOString() }
  }

  if (periodo === 'semana') {
    const day = now.getDay()
    const startSemana = new Date(now)
    startSemana.setDate(now.getDate() - day)
    startSemana.setHours(0, 0, 0, 0)
    return { dataInicio: startSemana.toISOString(), dataFim: endOfToday.toISOString() }
  }

  // mês
  const startMes = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  return { dataInicio: startMes.toISOString(), dataFim: endOfToday.toISOString() }
}

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mês' },
]

export function Vendas() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const navigate = useNavigate()
  const userId = session?.id ?? ''

  const [periodo, setPeriodo] = useState<Periodo>('hoje')
  const [vendas, setVendas] = useState<VendaComNfce[]>([])
  const [loading, setLoading] = useState(true)
  const [imprimindoId, setImprimindoId] = useState<string | null>(null)
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)
  const [cancelarVendaId, setCancelarVendaId] = useState<string | null>(null)
  const [emitindoNfceId, setEmitindoNfceId] = useState<string | null>(null)
  const [nfceMessage, setNfceMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [visualizarNfceVendaId, setVisualizarNfceVendaId] = useState<string | null>(null)
  const [visualizarVendaId, setVisualizarVendaId] = useState<string | null>(null)
  type DetalhesVenda = {
    empresa_nome: string
    venda: { numero: number; total: number; subtotal: number; desconto_total: number; troco: number; created_at: string }
    itens: { descricao: string; preco_unitario: number; quantidade: number; desconto: number; total: number }[]
    pagamentos: { forma: string; valor: number }[]
  }
  const [detalhesVenda, setDetalhesVenda] = useState<DetalhesVenda | null>(null)
  type NfceViewData = {
    detalhes: { venda: { numero: number; total: number; subtotal: number; desconto_total: number; troco: number; created_at: string }; empresa_nome: string; itens: { descricao: string; quantidade: number; total: number }[]; pagamentos: { forma: string; valor: number }[] }
    status: StatusNfce
  }
  const [nfceDetalhes, setNfceDetalhes] = useState<NfceViewData | null>(null)
  const [cupomPreviewHtml, setCupomPreviewHtml] = useState<string | null>(null)
  const [imprimindoNfceId, setImprimindoNfceId] = useState<string | null>(null)
  const nfcePrintRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visualizarVendaId) {
      setDetalhesVenda(null)
      return
    }
    setDetalhesVenda(null)
    window.electronAPI.cupom
      .getDetalhes(visualizarVendaId)
      .then((det) => {
        if (det) {
          setDetalhesVenda(det as DetalhesVenda)
        }
      })
      .catch(() => {
        setDetalhesVenda(null)
      })
  }, [visualizarVendaId])

  const loadVendas = useCallback(() => {
    if (!empresaId) return
    setLoading(true)
    const options = periodo === 'hoje'
      ? { periodo: 'hoje' as const }
      : (() => {
          const { dataInicio, dataFim } = getPeriodoRange(periodo)
          return { dataInicio, dataFim }
        })()
    window.electronAPI.vendas
      .list(empresaId, options)
      .then(setVendas)
      .finally(() => setLoading(false))
  }, [empresaId, periodo])

  useEffect(() => {
    loadVendas()
  }, [loadVendas])

  useEffect(() => {
    if (!visualizarNfceVendaId) {
      setNfceDetalhes(null)
      setCupomPreviewHtml(null)
      return
    }
    setNfceDetalhes(null)
    setCupomPreviewHtml(null)
    Promise.all([
      window.electronAPI.cupom.getDetalhes(visualizarNfceVendaId),
      window.electronAPI.vendas.getStatusNfce(visualizarNfceVendaId),
    ]).then(([detalhes, status]) => {
      if (detalhes && status?.emitida) {
        setNfceDetalhes({ detalhes: detalhes as NfceViewData['detalhes'], status })
        window.electronAPI.cupom.getHtmlNfce(visualizarNfceVendaId).then((html) => setCupomPreviewHtml(html ?? null))
      }
    })
  }, [visualizarNfceVendaId])

  const handleImprimirCupomNfce = async (vendaId: string) => {
    setImprimindoNfceId(vendaId)
    setNfceMessage(null)
    try {
      const result = await window.electronAPI.cupom.imprimirNfce(vendaId)
      if (result.ok) {
        setNfceMessage({ type: 'success', text: 'Cupom fiscal NFC-e enviado para impressão.' })
      } else {
        setNfceMessage({ type: 'error', text: result.error ?? 'Falha ao imprimir.' })
      }
    } catch {
      setNfceMessage({ type: 'error', text: 'Erro ao imprimir cupom fiscal.' })
    } finally {
      setImprimindoNfceId(null)
    }
  }

  const handleImprimirResumo = () => {
    if (!nfcePrintRef.current) return
    document.title = 'NFC-e'
    window.print()
    document.title = 'Agiliza PDV'
  }

  const getConsultaNfceUrl = (chave: string | null): string => {
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

  const handleImprimir = async (vendaId: string) => {
    setImprimindoId(vendaId)
    try {
      await window.electronAPI.cupom.imprimir(vendaId)
    } finally {
      setImprimindoId(null)
    }
  }

  const handleCancelar = async (vendaId: string) => {
    setCancelandoId(vendaId)
    try {
      await window.electronAPI.vendas.cancelar(vendaId, userId)
      setCancelarVendaId(null)
      loadVendas()
    } finally {
      setCancelandoId(null)
    }
  }

  const handleEmitirNfce = async (vendaId: string) => {
    setEmitindoNfceId(vendaId)
    setNfceMessage(null)
    try {
      const result = await window.electronAPI.vendas.emitirNfce(vendaId)
      if (result.ok) {
        setNfceMessage({ type: 'success', text: 'NFC-e emitida com sucesso.' })
        loadVendas()
        setVisualizarNfceVendaId(vendaId)
      } else {
        setNfceMessage({ type: 'error', text: result.error ?? 'Erro ao emitir NFC-e.' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setNfceMessage({ type: 'error', text: msg || 'Erro ao emitir NFC-e.' })
    } finally {
      setEmitindoNfceId(null)
    }
  }

  const handleEmitirOuVisualizarNfe = async (venda: VendaComNfce) => {
    if (venda.nfe_emitida && window.electronAPI?.nfe?.gerarDanfeA4) {
      try {
        const result = await window.electronAPI.nfe.gerarDanfeA4(venda.id)
        if (!result.ok) {
          setNfceMessage({ type: 'error', text: result.error ?? 'Erro ao gerar a DANFE NF-e.' })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setNfceMessage({ type: 'error', text: msg || 'Erro ao gerar a DANFE NF-e.' })
      }
      return
    }
    navigate(`/nfe/criar?vendaId=${encodeURIComponent(venda.id)}`)
  }

  const totalPeriodo = vendas.reduce((acc, v) => acc + v.total, 0)
  const totalConcluidas = vendas.filter((v) => v.status === 'CONCLUIDA').length
  const totalCanceladas = vendas.filter((v) => v.status === 'CANCELADA').length

  if (!empresaId) {
    return (
      <Layout>
        <PageTitle title="Vendas" subtitle="Sessão inválida." />
      </Layout>
    )
  }

  return (
    <Layout>
      <PageTitle
        title="Vendas"
        subtitle="Consulte as vendas por período e gerencie cupons e cancelamentos"
      />

      <div className="vendas-cards-resumo">
        <div className="vendas-card-resumo vendas-card-resumo--vendas">
          <div className="vendas-card-resumo__icon">
            <Receipt size={22} strokeWidth={1.8} />
          </div>
          <div className="vendas-card-resumo__content">
            <span className="vendas-card-resumo__label">Vendas</span>
            <span className="vendas-card-resumo__value">{vendas.length}</span>
          </div>
        </div>
        <div className="vendas-card-resumo vendas-card-resumo--total">
          <div className="vendas-card-resumo__icon">
            <DollarSign size={22} strokeWidth={1.8} />
          </div>
          <div className="vendas-card-resumo__content">
            <span className="vendas-card-resumo__label">Total</span>
            <span className="vendas-card-resumo__value">R$ {totalPeriodo.toFixed(2)}</span>
          </div>
        </div>
        <div className="vendas-card-resumo vendas-card-resumo--concluidas">
          <div className="vendas-card-resumo__icon">
            <CheckCircle size={22} strokeWidth={1.8} />
          </div>
          <div className="vendas-card-resumo__content">
            <span className="vendas-card-resumo__label">Concluídas</span>
            <span className="vendas-card-resumo__value">{totalConcluidas}</span>
          </div>
        </div>
        <div className="vendas-card-resumo vendas-card-resumo--canceladas">
          <div className="vendas-card-resumo__icon">
            <XCircle size={22} strokeWidth={1.8} />
          </div>
          <div className="vendas-card-resumo__content">
            <span className="vendas-card-resumo__label">Canceladas</span>
            <span className="vendas-card-resumo__value">{totalCanceladas}</span>
          </div>
        </div>
      </div>

      <div className="vendas-toolbar">
        <div className="vendas-periodos">
          <Calendar size={20} />
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`btn btn--secondary btn--sm ${periodo === p.id ? 'vendas-periodo-ativo' : ''}`}
              onClick={() => setPeriodo(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {nfceMessage && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 8,
            background: nfceMessage.type === 'success' ? 'var(--color-success-light, #d1fae5)' : 'var(--color-error-light, #fee2e2)',
            color: nfceMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {nfceMessage.text}
        </div>
      )}

      <div className="vendas-table-wrap">
        <h3 className="vendas-lista-title">Cupons</h3>
        <p className="vendas-lista-subtitle" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 12 }}>
          Para vendas concluídas, use &quot;Emitir NFC-e&quot; para gerar a nota fiscal na SEFAZ (emissão manual).
        </p>
        {loading ? (
          <p className="vendas-loading">Carregando...</p>
        ) : vendas.length === 0 ? (
          <p className="vendas-empty">Nenhuma venda no período selecionado.</p>
        ) : (
          <div className="table-responsive">
            <table className="vendas-table">
              <thead>
                <tr>
                  <th className="vendas-table__th--numero">Nº</th>
                  <th className="vendas-table__th--data">Data / Hora</th>
                  <th className="vendas-table__th--valor">Valor total</th>
                  <th className="vendas-table__th--situacao">Situação</th>
                  <th className="vendas-table__th--nfce">NFC-e</th>
                  <th className="vendas-table__th--acoes">Operações</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.id} className="vendas-table__row">
                    <td className="vendas-table__numero">#{v.numero}</td>
                    <td className="vendas-table__data">
                      {new Date(v.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="vendas-table__valor">R$ {v.total.toFixed(2)}</td>
                    <td className="vendas-table__situacao">
                      <span className={`nfce-pill nfce-pill--${v.status === 'CONCLUIDA' ? 'autorizada' : 'cancelada'}`}>
                        {v.status === 'CONCLUIDA' ? 'Concluída' : 'Cancelada'}
                      </span>
                    </td>
                    <td className="vendas-table__nfce">
                      {v.status === 'CONCLUIDA' && (
                        <span
                          className={v.nfce_emitida ? 'vendas-nfce-badge vendas-nfce-badge--emitida' : 'vendas-nfce-badge vendas-nfce-badge--sem'}
                          title={v.nfce_emitida ? 'NFC-e emitida' : 'NFC-e não emitida'}
                        >
                          {v.nfce_emitida ? <FileCheck size={12} /> : null}
                          {v.nfce_emitida ? 'NFC-e emitida' : 'Sem NFC-e'}
                        </span>
                      )}
                    </td>
                    <td className="vendas-table__acoes">
                      <button
                        type="button"
                        className="vendas-acao-btn vendas-acao-btn--neutra"
                        onClick={() => setVisualizarVendaId(v.id)}
                      >
                        <Eye size={14} />
                        <span>Detalhes</span>
                      </button>
                      {v.status === 'CONCLUIDA' && (
                        <>
                          {v.nfce_emitida ? (
                            <button
                              type="button"
                              className="vendas-acao-btn vendas-acao-btn--nfce"
                              onClick={() => setVisualizarNfceVendaId(v.id)}
                            >
                              <FileCheck size={14} />
                              <span>NFC-e</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="vendas-acao-btn vendas-acao-btn--nfce"
                              onClick={() => handleEmitirNfce(v.id)}
                              disabled={emitindoNfceId === v.id}
                            >
                              <FileCheck size={14} />
                              <span>Emitir NFC-e</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="vendas-acao-btn vendas-acao-btn--nfce"
                            onClick={() => handleEmitirOuVisualizarNfe(v)}
                          >
                            <FileCheck size={14} />
                            <span>{v.nfe_emitida ? 'NF-e' : 'Emitir NF-e'}</span>
                          </button>
                          <button
                            type="button"
                            className="vendas-acao-btn vendas-acao-btn--cupom"
                            onClick={() =>
                              v.nfce_emitida
                                ? handleImprimirCupomNfce(v.id)
                                : handleImprimir(v.id)
                            }
                            disabled={
                              v.nfce_emitida
                                ? imprimindoNfceId === v.id
                                : imprimindoId === v.id
                            }
                          >
                            <Printer size={14} />
                            <span>Cupom</span>
                          </button>
                          <button
                            type="button"
                            className="vendas-acao-btn vendas-acao-btn--danger"
                            onClick={() => setCancelarVendaId(v.id)}
                            disabled={cancelandoId === v.id}
                          >
                            <Trash2 size={14} />
                            <span>Cancelar</span>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog
        open={visualizarVendaId !== null}
        onClose={() => setVisualizarVendaId(null)}
        title="Detalhes da venda"
        size="large"
      >
        {!detalhesVenda ? (
          <p style={{ color: 'var(--color-text-muted)' }}>Carregando...</p>
        ) : (
          <div className="vendas-detalhes">
            <div className="vendas-detalhes-header">
              <div>
                <div className="vendas-detalhes-empresa">{detalhesVenda.empresa_nome}</div>
                <div className="vendas-detalhes-info">
                  <span>Venda #{detalhesVenda.venda.numero}</span>
                  <span>
                    {new Date(detalhesVenda.venda.created_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
              <div className="vendas-detalhes-totais">
                <div>
                  <span className="label">Subtotal</span>
                  <span className="value">
                    R$ {detalhesVenda.venda.subtotal.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="label">Desconto</span>
                  <span className="value">
                    R$ {detalhesVenda.venda.desconto_total.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="label">Total</span>
                  <span className="value destaque">
                    R$ {detalhesVenda.venda.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="vendas-detalhes-grid">
              <div className="vendas-detalhes-card">
                <h4>Itens</h4>
                {detalhesVenda.itens.length === 0 ? (
                  <p className="vendas-detalhes-empty">Nenhum item.</p>
                ) : (
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th>Descrição</th>
                        <th>Qtd</th>
                        <th>V. unit.</th>
                        <th>Desc.</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhesVenda.itens.map((i, idx) => (
                        <tr key={`${i.descricao}-${idx}`}>
                          <td>{i.descricao}</td>
                          <td>{i.quantidade}</td>
                          <td>R$ {i.preco_unitario.toFixed(2)}</td>
                          <td>{i.desconto ? `R$ ${i.desconto.toFixed(2)}` : '-'}</td>
                          <td>R$ {i.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="vendas-detalhes-card">
                <h4>Pagamentos</h4>
                {detalhesVenda.pagamentos.length === 0 ? (
                  <p className="vendas-detalhes-empty">Nenhum pagamento registrado.</p>
                ) : (
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th>Forma</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhesVenda.pagamentos.map((p, idx) => (
                        <tr key={`${p.forma}-${idx}`}>
                          <td>{p.forma}</td>
                          <td>R$ {p.valor.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="vendas-detalhes-resumo-pag">
                  <span>Total pago</span>
                  <span>
                    R${' '}
                    {detalhesVenda.pagamentos
                      .reduce((acc, p) => acc + p.valor, 0)
                      .toFixed(2)}
                  </span>
                </div>
                {detalhesVenda.venda.troco > 0 && (
                  <div className="vendas-detalhes-resumo-pag troco">
                    <span>Troco</span>
                    <span>R$ {detalhesVenda.venda.troco.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={visualizarNfceVendaId !== null}
        onClose={() => setVisualizarNfceVendaId(null)}
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
              onClick={() => visualizarNfceVendaId && handleImprimirCupomNfce(visualizarNfceVendaId)}
              disabled={!visualizarNfceVendaId || imprimindoNfceId === visualizarNfceVendaId}
            >
              {imprimindoNfceId === visualizarNfceVendaId ? 'Imprimindo...' : 'Imprimir cupom fiscal'}
            </Button>
            <Button variant="secondary" onClick={() => setVisualizarNfceVendaId(null)}>
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
              {/* Pré-visualização do cupom fiscal (igual à impressão 80mm) */}
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

              {/* Resumo e chave */}
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

      <ConfirmDialog
        open={cancelarVendaId !== null}
        onClose={() => setCancelarVendaId(null)}
        onConfirm={() =>
          cancelarVendaId ? handleCancelar(cancelarVendaId) : Promise.resolve()
        }
        title="Cancelar venda"
        message="Cancelar esta venda? O estoque dos itens será estornado."
        confirmLabel="Cancelar venda"
        variant="danger"
        loading={cancelandoId !== null}
      />
    </Layout>
  )
}
