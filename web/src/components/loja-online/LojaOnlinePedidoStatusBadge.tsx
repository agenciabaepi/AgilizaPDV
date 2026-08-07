import { CheckCircle } from 'lucide-react'
import type { LojaOnlinePedido } from '../../lib/loja-online-types'
import { pedidoAguardandoPagamentoOnline } from '../../lib/loja-online-types'
import { pedidoDisplayStatusLabel, pedidoStoreStatusClass } from '../../lib/loja-online-pedido-status'

export function LojaOnlinePedidoStatusBadge({
  pedido,
  celebrate = false,
}: {
  pedido: LojaOnlinePedido
  celebrate?: boolean
}) {
  const label = pedidoDisplayStatusLabel(pedido)
  const isPositive =
    pedido.status !== 'cancelado' &&
    pedido.status !== 'pagamento_recusado' &&
    pedido.status !== 'reembolsado' &&
    !pedidoAguardandoPagamentoOnline(pedido)

  return (
    <span
      className={`${pedidoStoreStatusClass(pedido)}${celebrate ? ' loja-store-status--celebrate' : ''}`}
    >
      {celebrate && isPositive && <CheckCircle size={14} className="loja-store-status-check" aria-hidden />}
      {label}
    </span>
  )
}
