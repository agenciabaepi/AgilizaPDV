import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Copy, CheckCircle2, RefreshCw, ShieldAlert, Receipt, Check, PartyPopper } from 'lucide-react'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import { PageTitle, Card, CardBody, CardHeader } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../hooks/useSubscription'
import { fetchAssinaturaCheckout } from '../lib/assinatura-api'
import { loadAssinaturaPagamentos, updateAssinaturaPlano } from '../lib/assinatura-status'
import { usePlanos } from '../hooks/usePlanos'
import { normalizePlanoId, type PlanoId } from '../lib/planos'
import { firePaymentConfetti } from '../lib/confetti'
import type { AssinaturaPagamento, AssinaturaPixQrCode } from '../vite-env'

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPaymentStatus(status: string): string {
  const s = status.toUpperCase()
  if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(s)) return 'Pago'
  if (s === 'PENDING') return 'Pendente'
  if (s === 'OVERDUE') return 'Vencido'
  if (s === 'REFUNDED') return 'Estornado'
  if (s === 'CANCELLED') return 'Cancelado'
  return status
}

function paymentStatusClass(status: string): string {
  const s = status.toUpperCase()
  if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(s)) return 'assinatura-pagamento-status assinatura-pagamento-status--ok'
  if (s === 'PENDING' || s === 'OVERDUE') return 'assinatura-pagamento-status assinatura-pagamento-status--pending'
  return 'assinatura-pagamento-status'
}

export function Assinatura() {
  const { planosList, getPlano } = usePlanos()
  const location = useLocation()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { status, bloqueado, refresh } = useSubscription()
  const upgradeHint = (location.state as { upgrade?: string } | null)?.upgrade

  const wasBloqueadoRef = useRef<boolean | null>(null)
  const prevStatusRef = useRef<string | null>(null)
  const [paymentCelebration, setPaymentCelebration] = useState(false)

  const [pix, setPix] = useState<AssinaturaPixQrCode | null>(null)
  const [pixValor, setPixValor] = useState<number | null>(null)
  const [pagamentos, setPagamentos] = useState<AssinaturaPagamento[]>([])
  const [loadingPagamentos, setLoadingPagamentos] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [polling, setPolling] = useState(false)
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoId>('basic')

  const empresaId = session && !('suporte' in session) ? session.empresa_id : null

  useEffect(() => {
    if (status?.plano) setPlanoSelecionado(normalizePlanoId(status.plano))
  }, [status?.plano])

  useEffect(() => {
    if (upgradeHint === 'notasFiscais') setPlanoSelecionado('pro')
    if (upgradeHint === 'lojaOnline') setPlanoSelecionado('ultra')
  }, [upgradeHint])

  const loadPagamentos = useCallback(async () => {
    if (!empresaId) return
    setLoadingPagamentos(true)
    try {
      const rows = await loadAssinaturaPagamentos(empresaId)
      setPagamentos(rows)
    } catch {
      setPagamentos([])
    } finally {
      setLoadingPagamentos(false)
    }
  }, [empresaId])

  const loadCheckout = useCallback(async () => {
    if (!empresaId) return
    if (status?.status === 'active' && !bloqueado) {
      setError('Sua assinatura já está ativa. Aguarde o vencimento para renovar via PIX.')
      return
    }
    setBusy(true)
    setError('')
    setPix(null)
    setPixValor(null)
    try {
      if (!bloqueado) {
        await updateAssinaturaPlano(empresaId, planoSelecionado)
      }
      const res = await fetchAssinaturaCheckout(empresaId, planoSelecionado)
      if (!res.ok) {
        setError(
          res.error ??
            'Não foi possível gerar o PIX. Configure ASAAS_API_KEY em web/.env.local e reinicie o npm run dev.'
        )
        return
      }
      if (res.pix) setPix(res.pix)
      setPixValor(res.valor ?? null)
      await refresh()
      await loadPagamentos()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar PIX.')
    } finally {
      setBusy(false)
    }
  }, [empresaId, refresh, loadPagamentos, bloqueado, planoSelecionado, status?.status])

  const handleRefresh = useCallback(async () => {
    await refresh()
    await loadPagamentos()
  }, [refresh, loadPagamentos])

  useEffect(() => {
    void loadPagamentos()
  }, [loadPagamentos])

  useEffect(() => {
    if (!status) return

    const wasBlocked = wasBloqueadoRef.current
    const prevStatus = prevStatusRef.current
    const becameActive =
      status.status === 'active' &&
      !bloqueado &&
      prevStatus !== 'active' &&
      prevStatus !== null

    const shouldCelebrate =
      becameActive &&
      (wasBlocked === true ||
        prevStatus === 'pending_payment' ||
        prevStatus === 'trial' ||
        prevStatus === 'expired' ||
        prevStatus === 'cancelled')

    if (shouldCelebrate) {
      firePaymentConfetti()
      setPaymentCelebration(true)
      setPix(null)
      setPixValor(null)
      setError('')
    }

    wasBloqueadoRef.current = bloqueado
    prevStatusRef.current = status.status
  }, [bloqueado, status])

  useEffect(() => {
    if (!paymentCelebration) return
    const id = window.setTimeout(() => setPaymentCelebration(false), 12000)
    return () => window.clearTimeout(id)
  }, [paymentCelebration])

  useEffect(() => {
    if (status?.status === 'active' && !bloqueado) {
      setPix(null)
      setPixValor(null)
    }
  }, [status?.status, bloqueado])

  useEffect(() => {
    if (!bloqueado || !empresaId) return
    setPolling(true)
    const id = window.setInterval(() => {
      void handleRefresh()
    }, 8000)
    return () => {
      window.clearInterval(id)
      setPolling(false)
    }
  }, [bloqueado, empresaId, handleRefresh])

  const handleCopy = async () => {
    if (!pix?.payload) return
    try {
      await navigator.clipboard.writeText(pix.payload)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setError('Não foi possível copiar o código PIX.')
    }
  }

  if (!empresaId) {
    return (
      <Layout>
        <div className="assinatura-page">
          <Alert variant="error">Faça login para gerenciar sua assinatura.</Alert>
        </div>
      </Layout>
    )
  }

  const valor = getPlano(planoSelecionado).valor ?? status?.valorMensal ?? 89.9
  const showQr = pix?.encodedImage
  const assinaturaAtiva = status?.status === 'active' && !bloqueado
  const podeGerarPix = !assinaturaAtiva
  const podeTrocarPlano = status?.status !== 'cancelled' && !assinaturaAtiva

  return (
    <Layout>
      {paymentCelebration && (
        <div className="assinatura-celebration" role="dialog" aria-live="polite" aria-label="Pagamento confirmado">
          <div className="assinatura-celebration__card">
            <div className="assinatura-celebration__icon-wrap">
              <PartyPopper size={36} strokeWidth={1.75} aria-hidden />
            </div>
            <h2 className="assinatura-celebration__title">Pagamento confirmado!</h2>
            <p className="assinatura-celebration__text">
              Plano <strong>{status?.planoNome}</strong> ativo. Seu acesso ao sistema foi liberado.
            </p>
            {status?.periodoFim && (
              <p className="assinatura-celebration__meta">
                Próxima renovação em <strong>{formatDate(status.periodoFim)}</strong>
              </p>
            )}
            <div className="assinatura-celebration__actions">
              <Button size="lg" onClick={() => navigate('/dashboard', { replace: true })}>
                Ir para o painel
              </Button>
              <Button variant="ghost" onClick={() => setPaymentCelebration(false)}>
                Continuar aqui
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="assinatura-page">
        <div className="assinatura-page__inner assinatura-page__inner--wide">
          <PageTitle
            className="assinatura-page__header"
            title="Assinatura"
            subtitle="Escolha o plano ideal e renove via PIX."
          />

          {upgradeHint === 'notasFiscais' && (
            <Alert variant="info">
              Emissão de notas fiscais disponível nos planos <strong>Pro</strong> e <strong>Ultra</strong>.
            </Alert>
          )}
          {upgradeHint === 'lojaOnline' && (
            <Alert variant="info">
              Loja online disponível no plano <strong>Ultra</strong>.
            </Alert>
          )}

          {bloqueado ? (
            <Alert variant="warning">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={18} />
                {status?.mensagem ?? 'Seu acesso está bloqueado até a confirmação do pagamento.'}
              </span>
            </Alert>
          ) : (
            !upgradeHint && (
              <Alert variant="info">{status?.mensagem ?? 'Verificando assinatura...'}</Alert>
            )
          )}

          {assinaturaAtiva && status?.periodoFim && (
            <Alert variant="success">
              Assinatura <strong>{status.planoNome}</strong> ativa até{' '}
              <strong>{formatDate(status.periodoFim)}</strong>. Novo PIX só será necessário após essa data.
            </Alert>
          )}

          <div className="assinatura-planos-grid">
            {planosList.map((plano) => {
              const selected = planoSelecionado === plano.id
              const atual = status?.plano === plano.id && status.status === 'active'
              return (
                <button
                  key={plano.id}
                  type="button"
                  className={`assinatura-plano-card${selected ? ' assinatura-plano-card--selected' : ''}${plano.destaque ? ' assinatura-plano-card--destaque' : ''}${atual ? ' assinatura-plano-card--atual' : ''}`}
                  onClick={() => {
                    if (podeTrocarPlano) setPlanoSelecionado(plano.id)
                  }}
                  disabled={!podeTrocarPlano}
                >
                  <div className="assinatura-plano-card__badges">
                    {atual && <span className="assinatura-plano-card__badge assinatura-plano-card__badge--atual">Plano atual</span>}
                    {plano.destaque && (
                      <span className="assinatura-plano-card__badge assinatura-plano-card__badge--popular">Popular</span>
                    )}
                  </div>
                  <div className="assinatura-plano-card__head">
                    <h3 className="assinatura-plano-card__nome">{plano.nome}</h3>
                    <p className="assinatura-plano-card__valor">
                      {formatCurrency(plano.valor)}
                      <span>/mês</span>
                    </p>
                  </div>
                  <p className="assinatura-plano-card__desc">{plano.descricao}</p>
                  <ul className="assinatura-plano-card__lista">
                    {plano.recursos.map((item) => (
                      <li key={item}>
                        <Check size={16} strokeWidth={2.5} aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              )
            })}
          </div>

          {status?.status === 'trial' && status.trialFim && (
            <p className="assinatura-page__plan-meta assinatura-page__plan-meta--center">
              Teste gratuito até <strong>{formatDate(status.trialFim)}</strong>
              {status.diasRestantes != null && status.diasRestantes >= 0 && (
                <> ({status.diasRestantes} dia{status.diasRestantes === 1 ? '' : 's'} restante{status.diasRestantes === 1 ? '' : 's'})</>
              )}
            </p>
          )}

          {status?.status === 'active' && status.periodoFim && (
            <p className="assinatura-page__plan-meta assinatura-page__plan-meta--center">
              Plano <strong>{status.planoNome}</strong> — próxima renovação em{' '}
              <strong>{formatDate(status.periodoFim)}</strong>
            </p>
          )}

          {error && <Alert variant="error">{error}</Alert>}

          {showQr && (
            <Card>
              <CardBody className="assinatura-page__qr">
                <p className="assinatura-page__qr-title">
                  Escaneie o QR Code ou copie o código PIX
                </p>
                {pixValor != null && (
                  <p className="assinatura-page__qr-value">
                    Valor do PIX: <strong>{formatCurrency(pixValor)}</strong>
                  </p>
                )}
                <img
                  src={`data:image/png;base64,${pix.encodedImage}`}
                  alt="QR Code PIX"
                  className="assinatura-page__qr-image"
                />
                <Button
                  variant="outline"
                  fullWidth
                  leftIcon={copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                  onClick={() => void handleCopy()}
                >
                  {copied ? 'Código copiado!' : 'Copiar código PIX'}
                </Button>
                {pix.expirationDate && (
                  <p className="assinatura-page__qr-expiry">
                    Válido até {formatDate(pix.expirationDate)}
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          <div className="assinatura-page__actions">
            {podeGerarPix && (
              <Button
                fullWidth
                leftIcon={<RefreshCw size={18} />}
                onClick={() => void loadCheckout()}
                disabled={busy}
              >
                {busy ? 'Gerando PIX...' : `Gerar PIX — ${formatCurrency(valor)}`}
              </Button>
            )}

            <Button
              variant="secondary"
              fullWidth
              leftIcon={<RefreshCw size={18} className={polling ? 'spin' : undefined} />}
              onClick={() => void handleRefresh()}
            >
              Atualizar status
            </Button>
          </div>

          <Card>
            <CardHeader className="assinatura-page__history-header">
              <Receipt size={18} strokeWidth={1.75} />
              <span>Histórico de pagamentos</span>
            </CardHeader>
            <CardBody className="assinatura-page__history-body">
              {loadingPagamentos ? (
                <p className="assinatura-page__history-empty">Carregando pagamentos...</p>
              ) : pagamentos.length === 0 ? (
                <p className="assinatura-page__history-empty">
                  Nenhum pagamento registrado ainda.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="table table--compact assinatura-page__table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Valor</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagamentos.map((p) => (
                        <tr key={p.id}>
                          <td>{formatDateTime(p.pago_em ?? p.created_at)}</td>
                          <td>{formatCurrency(p.valor)}</td>
                          <td>
                            <span className={paymentStatusClass(p.status)}>
                              {formatPaymentStatus(p.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          <p className="assinatura-page__footer">
            Pagamento processado com segurança via Asaas. Após a confirmação do PIX, o acesso é liberado
            automaticamente.
          </p>
        </div>
      </div>
    </Layout>
  )
}
