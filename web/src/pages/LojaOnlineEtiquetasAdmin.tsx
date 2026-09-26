import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Printer, RefreshCw, Truck } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, useToast } from '../components/ui'
import { gerarEtiquetaLojaOnline, sincronizarRastreioLojaOnline } from '../lib/loja-online-etiquetas-api'
import { fetchLojaOnlinePedidosAdmin, notifyLojaOnlinePedidosUpdated } from '../lib/loja-online-api'
import { PEDIDO_STATUS_LABEL } from '../lib/loja-online-pedido-status'
import type { LojaOnlinePedido } from '../lib/loja-online-types'
import { formatCurrency } from '../lib/loja-online'

function etiquetaLabel(status: string | null | undefined): string {
  if (status === 'gerada') return 'Pronta para impressão'
  if (status === 'processando') return 'Gerando…'
  if (status === 'erro') return 'Falhou'
  return 'Aguardando geração'
}

function etiquetaClass(status: string | null | undefined): string {
  if (status === 'gerada') return 'loja-admin-etiqueta-badge loja-admin-etiqueta-badge--ok'
  if (status === 'processando') return 'loja-admin-etiqueta-badge loja-admin-etiqueta-badge--wait'
  if (status === 'erro') return 'loja-admin-etiqueta-badge loja-admin-etiqueta-badge--err'
  return 'loja-admin-etiqueta-badge'
}

function etiquetaRank(p: LojaOnlinePedido): number {
  if (p.melhor_envio_status === 'erro') return 0
  if (p.melhor_envio_etiqueta_url && p.melhor_envio_status === 'gerada') return 2
  return 1
}

export function LojaOnlineEtiquetasAdmin({ empresaId }: { empresaId: string }) {
  const { addToast } = useToast()
  const [pedidos, setPedidos] = useState<LojaOnlinePedido[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const data = await fetchLojaOnlinePedidosAdmin(empresaId)
      const envios = data
        .filter((p) => p.forma_entrega === 'entrega' && p.pagamento_status === 'pago')
        .sort((a, b) => etiquetaRank(a) - etiquetaRank(b) || +new Date(b.created_at) - +new Date(a.created_at))
      setPedidos(envios)
    } catch {
      if (!opts?.silent) addToast('error', 'Erro ao carregar envios.')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [empresaId, addToast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onUpd = () => void load({ silent: true })
    window.addEventListener('agiliza:lojaOnlinePedidosUpdated', onUpd)
    return () => window.removeEventListener('agiliza:lojaOnlinePedidosUpdated', onUpd)
  }, [load])

  const resumo = useMemo(() => {
    const prontas = pedidos.filter((p) => p.melhor_envio_status === 'gerada' && p.melhor_envio_etiqueta_url).length
    return { total: pedidos.length, prontas, pendentes: pedidos.length - prontas }
  }, [pedidos])

  const aguardarRastreio = async (pedidoId: string) => {
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000))
      try {
        const tracking = await sincronizarRastreioLojaOnline(empresaId, pedidoId)
        if (tracking) {
          setPedidos((prev) =>
            prev.map((p) =>
              p.id === pedidoId ? { ...p, codigo_rastreio: tracking, melhor_envio_tracking: tracking } : p
            )
          )
          notifyLojaOnlinePedidosUpdated()
          addToast('success', `Código de rastreio ${tracking} adicionado ao pedido.`)
          return
        }
      } catch {
        return
      }
    }
  }

  const gerar = async (pedido: LojaOnlinePedido) => {
    setBusyId(pedido.id)
    try {
      const res = await gerarEtiquetaLojaOnline(empresaId, pedido.id)
      setPedidos((prev) =>
        prev.map((p) =>
          p.id === pedido.id
            ? {
                ...p,
                melhor_envio_status: 'gerada',
                melhor_envio_cart_id: res.cartId ?? p.melhor_envio_cart_id,
                melhor_envio_etiqueta_url: res.url ?? p.melhor_envio_etiqueta_url,
                melhor_envio_tracking: res.tracking ?? p.melhor_envio_tracking,
                codigo_rastreio: res.tracking ?? p.codigo_rastreio,
                melhor_envio_erro: null,
              }
            : p
        )
      )
      notifyLojaOnlinePedidosUpdated()
      addToast('success', res.url ? 'Etiqueta gerada.' : 'Envio criado. O PDF pode levar alguns segundos.')
      if (res.url) window.open(res.url, '_blank', 'noopener,noreferrer')
      if (!res.tracking && res.cartId) void aguardarRastreio(pedido.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao gerar etiqueta.'
      setPedidos((prev) =>
        prev.map((p) =>
          p.id === pedido.id ? { ...p, melhor_envio_status: 'erro', melhor_envio_erro: msg } : p
        )
      )
      addToast('error', msg)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card className="page-card loja-admin-pedidos-card">
      <CardHeader className="loja-admin-envios-header">
        <span>
          <Truck size={20} /> Pedidos pagos para envio
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw size={14} />}
          onClick={() => void load()}
          disabled={loading}
        >
          Atualizar
        </Button>
      </CardHeader>
      <CardBody className="loja-admin-pedidos-card-body">
        <div className="loja-admin-pedidos-resumo">
          <div className="loja-admin-pedidos-resumo-card">
            <strong>{resumo.total}</strong>
            <span>Pagos para enviar</span>
          </div>
          <div className="loja-admin-pedidos-resumo-card">
            <strong>{resumo.prontas}</strong>
            <span>Etiquetas prontas</span>
          </div>
          <div className="loja-admin-pedidos-resumo-card loja-admin-pedidos-resumo-card--warn">
            <strong>{resumo.pendentes}</strong>
            <span>Sem etiqueta</span>
          </div>
        </div>

        <p className="loja-online-hint">
          Pedidos com entrega e pagamento confirmado entram aqui. A etiqueta é gerada no Melhor Envio (saldo da
          carteira) e o PDF abre neste sistema, para imprimir como na Shopee. Configure o token em{' '}
          <Link to="/loja-online/entrega">Entrega e frete</Link> com as permissões de cotação, carrinho, compra,
          geração e impressão.
        </p>

        {loading ? (
          <p className="loja-online-hint">Carregando envios…</p>
        ) : pedidos.length === 0 ? (
          <p className="loja-online-hint">Nenhum pedido pago com entrega ainda.</p>
        ) : (
          <div className="loja-admin-envios-list">
            {pedidos.map((p) => (
              <article key={p.id} className="loja-admin-envio">
                <div className="loja-admin-envio-main">
                  <div className="loja-admin-envio-title">
                    <strong>#{p.id.slice(0, 8).toUpperCase()}</strong>
                    <span className={etiquetaClass(p.melhor_envio_status)}>{etiquetaLabel(p.melhor_envio_status)}</span>
                  </div>
                  <p>
                    {p.cliente_nome ?? 'Cliente'} · {(p.tipo_frete || 'PAC').toUpperCase()} · {formatCurrency(p.total)}
                  </p>
                  <p>{p.endereco_entrega || p.cep_destino || 'Sem endereço'}</p>
                  <p>Pedido: {PEDIDO_STATUS_LABEL[p.status]}</p>
                  {(p.melhor_envio_tracking || p.codigo_rastreio) && (
                    <p>Rastreio: {p.melhor_envio_tracking || p.codigo_rastreio}</p>
                  )}
                  {p.melhor_envio_erro && <p className="loja-admin-envio-erro">{p.melhor_envio_erro}</p>}
                </div>
                <div className="loja-admin-envio-actions">
                  {p.melhor_envio_etiqueta_url && (
                    <a
                      className="btn btn--primary btn--md"
                      href={p.melhor_envio_etiqueta_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Printer size={16} /> Imprimir
                    </a>
                  )}
                  {(!p.melhor_envio_etiqueta_url || p.melhor_envio_status === 'erro') && (
                    <Button
                      type="button"
                      variant={p.melhor_envio_etiqueta_url ? 'secondary' : 'primary'}
                      leftIcon={busyId === p.id ? <RefreshCw size={16} /> : <Printer size={16} />}
                      onClick={() => void gerar(p)}
                      disabled={busyId === p.id}
                    >
                      {busyId === p.id ? 'Gerando…' : p.melhor_envio_etiqueta_url ? 'Tentar de novo' : 'Gerar etiqueta'}
                    </Button>
                  )}
                  {p.melhor_envio_cart_id && (
                    <a
                      className="loja-admin-envio-me-link"
                      href="https://melhorenvio.com.br/painel/gerenciar/envios"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver no Melhor Envio <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
