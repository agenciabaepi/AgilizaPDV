import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, ExternalLink, Loader2 } from 'lucide-react'
import {
  fetchLojaOnlinePedidoCliente,
  fetchLojaOnlinePedidoItens,
} from '../../lib/loja-online-api'
import {
  pagamentosPublicosFromStore,
  processarPagamentoMpLojaOnline,
  retomarPagamentoLojaOnline,
} from '../../lib/loja-online-pagamentos-api'
import { formatCurrency } from '../../lib/loja-online'
import type { LojaOnlinePedido, LojaOnlinePedidoItem } from '../../lib/loja-online-types'
import { pedidoAguardandoPagamentoOnline } from '../../lib/loja-online-types'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { LojaOnlineCheckoutSuccess } from '../../components/loja-online/LojaOnlineCheckoutSuccess'
import { LojaOnlineMercadoPagoBrick } from '../../components/loja-online/LojaOnlineMercadoPagoBrick'

type PixData = {
  qrCodeImage: string
  copyPaste: string
  expirationDate: string
}

export function LojaOnlinePagarPedidoPage() {
  const { pedidoId } = useParams<{ pedidoId: string }>()
  const { store, titulo, link, slug } = useLojaOnlineStore()
  const { cliente, loading: authLoading } = useLojaOnlineClienteAuth()

  const [pedido, setPedido] = useState<LojaOnlinePedido | null>(null)
  const [itens, setItens] = useState<LojaOnlinePedidoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [payLoading, setPayLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pix, setPix] = useState<PixData | null>(null)
  const [showBrick, setShowBrick] = useState(false)
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [confirmandoPagamento, setConfirmandoPagamento] = useState(false)

  const pagamentos = useMemo(() => (store ? pagamentosPublicosFromStore(store) : null), [store])

  useEffect(() => {
    if (!store?.empresa_id || !cliente?.id || !pedidoId) return
    setLoading(true)
    setError(null)
    fetchLojaOnlinePedidoCliente(store.empresa_id, cliente.id, pedidoId)
      .then(async (p) => {
        setPedido(p)
        if (p) {
          const rows = await fetchLojaOnlinePedidoItens(p.id)
          setItens(rows)
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar pedido.'))
      .finally(() => setLoading(false))
  }, [store?.empresa_id, cliente?.id, pedidoId])

  useEffect(() => {
    if (!pedido || !slug || !pedidoAguardandoPagamentoOnline(pedido)) {
      setPayLoading(false)
      return
    }
    setPayLoading(true)
    setError(null)
    retomarPagamentoLojaOnline(pedido.id, slug)
      .then((result) => {
        if ('alreadyPaid' in result && result.alreadyPaid) {
          setPaid(true)
          setPedido((prev) =>
            prev ? { ...prev, pagamento_status: 'pago', status: 'pagamento_aprovado' } : prev
          )
          return
        }
        if (result.tipo === 'asaas_pix' || result.tipo === 'pix') {
          setPix(result.pix)
          setShowBrick(false)
          return
        }
        if (result.tipo === 'mercadopago_brick') {
          setShowBrick(true)
          return
        }
        if (result.tipo === 'mercadopago_redirect') {
          setRedirectUrl(result.checkoutUrl)
          return
        }
        if (result.tipo === 'mercadopago' && result.checkoutUrl) {
          setRedirectUrl(result.checkoutUrl)
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao preparar pagamento.'))
      .finally(() => setPayLoading(false))
  }, [pedido?.id, slug])

  const handleMpPay = useCallback(
    async (formData: Record<string, unknown>) => {
      if (!pedido || !slug) return
      setProcessing(true)
      setError(null)
      try {
        const pay = await processarPagamentoMpLojaOnline(pedido.id, slug, formData)
        if (pay.status === 'approved') {
          setPaid(true)
          setPedido((prev) =>
            prev ? { ...prev, pagamento_status: 'pago', status: 'pagamento_aprovado' } : prev
          )
          return
        }
        if (pay.pix) {
          setPix(pay.pix)
          setShowBrick(false)
          setConfirmandoPagamento(false)
          setPedido((prev) => (prev ? { ...prev, pagamento_status: 'pendente' } : prev))
          return
        }
        setShowBrick(false)
        setConfirmandoPagamento(true)
        setPedido((prev) => (prev ? { ...prev, pagamento_status: 'pendente' } : prev))
      } finally {
        setProcessing(false)
      }
    },
    [pedido, slug]
  )

  if (!cliente) {
    if (authLoading) {
      return <p className="loja-catalogo-empty">Carregando…</p>
    }
    return <Navigate to={link('entrar')} replace state={{ from: link(`conta/pedido/${pedidoId}/pagar`) }} />
  }

  if (loading) {
    return <p className="loja-catalogo-empty">Carregando pedido…</p>
  }

  if (!pedido) {
    return (
      <div className="loja-store-page">
        <p className="loja-catalogo-empty">Pedido não encontrado.</p>
        <Link to={link('conta')} className="loja-store-back-link">
          <ArrowLeft size={16} /> Voltar aos pedidos
        </Link>
      </div>
    )
  }

  if (paid || pedido.pagamento_status === 'pago') {
    return (
      <LojaOnlineCheckoutSuccess
        pedido={{
          ...pedido,
          pagamento_status: 'pago',
          status:
            pedido.status === 'aguardando_pagamento' || pedido.status === 'pendente'
              ? 'pagamento_aprovado'
              : pedido.status,
        }}
        itens={itens}
        titulo={titulo}
        slug={slug}
        link={link}
        whatsapp={store?.loja_online_whatsapp}
        mensagemCheckout={store?.loja_online_mensagem_checkout}
        clienteLogado
        pix={null}
        empresaId={store?.empresa_id}
      />
    )
  }

  if (!pedidoAguardandoPagamentoOnline(pedido)) {
    return (
      <div className="loja-store-page">
        <p className="loja-catalogo-empty">Este pedido não está aguardando pagamento online.</p>
        <Link to={link('conta')} className="loja-store-back-link">
          <ArrowLeft size={16} /> Voltar aos pedidos
        </Link>
      </div>
    )
  }

  if ((pix || confirmandoPagamento) && !paid) {
    return (
      <LojaOnlineCheckoutSuccess
        pedido={pedido}
        itens={itens}
        titulo={titulo}
        slug={slug}
        link={link}
        whatsapp={store?.loja_online_whatsapp}
        mensagemCheckout={store?.loja_online_mensagem_checkout}
        clienteLogado
        pix={pix}
        empresaId={store?.empresa_id}
      />
    )
  }

  return (
    <div className="loja-store-page loja-store-pagar-pedido">
      <Link to={link('conta')} className="loja-store-back-link">
        <ArrowLeft size={16} /> Meus pedidos
      </Link>

      <h1 className="loja-store-page-title">Concluir pagamento</h1>
      <p className="loja-store-pagar-pedido-meta">
        Pedido <strong>#{pedido.id.slice(0, 8).toUpperCase()}</strong> — {formatCurrency(pedido.total)}
      </p>
      <p className="loja-online-hint">
        Você pode fechar esta página e voltar aqui pelos seus pedidos para pagar quando quiser.
      </p>

      {error && <p className="loja-store-error">{error}</p>}

      {payLoading ? (
        <p className="loja-catalogo-empty loja-store-pagar-loading">
          <Loader2 size={20} className="loja-store-success-icon--spin" /> Preparando pagamento…
        </p>
      ) : redirectUrl ? (
        <div className="loja-store-pagar-actions">
          <a href={redirectUrl} className="loja-store-btn-primary loja-store-btn-inline" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={18} /> Abrir checkout Mercado Pago
          </a>
        </div>
      ) : showBrick && pagamentos?.mercadopagoPublicKey ? (
        <section className="loja-store-form-section">
          <h2>
            <CreditCard size={18} /> Pagamento
          </h2>
          <LojaOnlineMercadoPagoBrick
            publicKey={pagamentos.mercadopagoPublicKey}
            amount={pedido.total}
            email={cliente.email}
            payerName={cliente.nome}
            processing={processing}
            onSubmit={handleMpPay}
            onError={setError}
          />
        </section>
      ) : (
        !error && (
          <p className="loja-catalogo-empty">Não foi possível carregar as opções de pagamento. Tente recarregar a página.</p>
        )
      )}
    </div>
  )
}
