import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, Copy, MessageCircle } from 'lucide-react'
import { buildPedidoWhatsAppMessage } from '../../lib/loja-online-api'
import { clearCheckoutPedidoId } from '../../lib/loja-online-checkout-session'
import { formatCurrency, formatWhatsAppLink } from '../../lib/loja-online'
import type { LojaOnlinePedido, LojaOnlinePedidoItem } from '../../lib/loja-online-types'
import { pedidoAguardandoPagamentoOnline } from '../../lib/loja-online-types'
import { useLojaOnlineConfirmacaoPagamento } from '../../hooks/useLojaOnlineConfirmacaoPagamento'

type PixData = {
  qrCodeImage: string
  copyPaste: string
  expirationDate: string
}

export function LojaOnlineCheckoutSuccess({
  pedido,
  itens,
  titulo,
  slug,
  link,
  whatsapp,
  mensagemCheckout,
  clienteLogado,
  pix,
  empresaId,
  onAbandon,
}: {
  pedido: LojaOnlinePedido
  itens: LojaOnlinePedidoItem[]
  titulo: string
  slug: string
  link: (path?: string) => string
  whatsapp: string | null | undefined
  mensagemCheckout: string | null | undefined
  clienteLogado: boolean
  pix?: PixData | null
  empresaId?: string
  onAbandon?: () => void
}) {
  const navigate = useNavigate()
  const { pago, verificando, verificarAgora } = useLojaOnlineConfirmacaoPagamento(pedido, slug, {
    pix: !!pix,
    empresaId,
  })
  const [copied, setCopied] = useState(false)
  const [redirecionando, setRedirecionando] = useState(false)
  const aguardandoOnline = pedidoAguardandoPagamentoOnline(pedido) && !pago

  useEffect(() => {
    if (!pago) return
    window.dispatchEvent(new CustomEvent('agiliza:lojaOnlinePedidosUpdated'))
  }, [pago])

  useEffect(() => {
    if (!pago || !clienteLogado || redirecionando) return
    setRedirecionando(true)
    const t = window.setTimeout(() => {
      navigate(
        link(`conta?pagamento=confirmado&pedido=${encodeURIComponent(pedido.id)}`),
        { replace: true }
      )
    }, 900)
    return () => window.clearTimeout(t)
  }, [pago, clienteLogado, redirecionando, pedido.id, link, navigate])

  const wa = whatsapp
    ? formatWhatsAppLink(whatsapp, buildPedidoWhatsAppMessage(pedido, itens, titulo))
    : ''

  const copyPix = async () => {
    if (!pix?.copyPaste) return
    await navigator.clipboard.writeText(pix.copyPaste)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="loja-store-page loja-store-success">
      {pago ? (
        <CheckCircle size={56} className="loja-store-success-icon" />
      ) : pix ? (
        <Clock size={48} className="loja-store-success-icon" />
      ) : aguardandoOnline ? (
        <Clock size={48} className="loja-store-success-icon" />
      ) : (
        <CheckCircle size={56} className="loja-store-success-icon" />
      )}
      <h1>
        {pago
          ? 'Pagamento confirmado!'
          : pix
            ? 'Aguardando pagamento PIX'
            : aguardandoOnline
              ? 'Pedido aguardando pagamento'
              : 'Pedido enviado!'}
      </h1>
      <p>
        Pedido <strong>#{pedido.id.slice(0, 8).toUpperCase()}</strong> — {formatCurrency(pedido.total)}
      </p>
      {pago && clienteLogado && (
        <p className="loja-online-hint loja-store-success-redirect-hint">Redirecionando para seus pedidos…</p>
      )}

      {pix && !pago && (
        <div className="loja-store-pix-box">
          <img src={pix.qrCodeImage} alt="QR Code PIX" className="loja-store-pix-qr" />
          <button type="button" className="loja-store-btn-outline loja-store-btn-block" onClick={copyPix}>
            <Copy size={16} /> {copied ? 'Código copiado!' : 'Copiar código PIX'}
          </button>
          <p className="loja-online-hint">O pedido será confirmado automaticamente após o pagamento.</p>
          {clienteLogado && (
            <Link to={link(`conta/pedido/${pedido.id}/pagar`)} className="loja-store-link-muted loja-store-pix-retomar">
              Fechar e pagar depois em Meus pedidos
            </Link>
          )}
          {onAbandon && (
            <button type="button" className="loja-store-link-muted" onClick={onAbandon}>
              Continuar comprando sem pagar agora
            </button>
          )}
        </div>
      )}

      {aguardandoOnline && !pix && !pago && (
        <div className="loja-store-checkout-verify">
          <p className="loja-online-hint loja-store-checkout-verify-hint">
            Seu pedido foi registrado. Você pode pagar agora, pagar depois em Meus pedidos, ou seguir comprando.
          </p>
          <button
            type="button"
            className="loja-store-btn-outline loja-store-btn-sm"
            onClick={() => void verificarAgora()}
            disabled={verificando}
          >
            {verificando ? 'Verificando…' : 'Já paguei — verificar agora'}
          </button>
          {clienteLogado && (
            <Link to={link(`conta/pedido/${pedido.id}/pagar`)} className="loja-store-link-muted">
              Abrir tela de pagamento do pedido
            </Link>
          )}
          {onAbandon && (
            <button type="button" className="loja-store-btn-primary loja-store-btn-inline" onClick={onAbandon}>
              Fazer outra compra
            </button>
          )}
        </div>
      )}

      {mensagemCheckout && <p className="loja-store-checkout-msg">{mensagemCheckout}</p>}

      <div className="loja-store-success-actions">
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="loja-store-btn-primary loja-store-btn-inline">
            <MessageCircle size={18} /> Enviar no WhatsApp
          </a>
        )}
        <Link
          to={link()}
          className="loja-store-link-muted"
          onClick={() => {
            if (empresaId) clearCheckoutPedidoId(empresaId)
          }}
        >
          Voltar à loja
        </Link>
        {clienteLogado && (
          <Link
            to={link('conta')}
            className="loja-store-link-muted"
            onClick={() => {
              if (empresaId) clearCheckoutPedidoId(empresaId)
            }}
          >
            Ver meus pedidos
          </Link>
        )}
      </div>
    </div>
  )
}
