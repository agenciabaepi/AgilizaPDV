import {
  Ban,
  CheckCircle,
  CreditCard,
  Home,
  Package,
  Truck,
} from 'lucide-react'
import type { LojaOnlinePedido } from '../../lib/loja-online-types'
import {
  getPedidoFluxo,
  getPedidoFluxoAtivoIndex,
  type PedidoFluxoEtapa,
} from '../../lib/loja-online-pedido-status'

function stepIcon(id: PedidoFluxoEtapa) {
  switch (id) {
    case 'aguardando_pagamento':
      return CreditCard
    case 'pedido_recebido':
    case 'preparacao':
      return Package
    case 'envio':
      return Truck
    case 'retirada':
      return CheckCircle
    case 'entregue':
      return Home
    case 'problema':
      return Ban
    case 'cancelado':
      return Ban
    default:
      return Package
  }
}

export function LojaOnlinePedidoProgressTracker({
  pedido,
  animate = false,
}: {
  pedido: LojaOnlinePedido
  animate?: boolean
}) {
  const steps = getPedidoFluxo(pedido)
  const activeIndex = getPedidoFluxoAtivoIndex(pedido, steps)

  if (pedido.status === 'cancelado' || pedido.status === 'pagamento_recusado' || pedido.status === 'reembolsado') {
    return (
      <div className="loja-store-pedido-progress loja-store-pedido-progress--cancelado" aria-label="Pedido cancelado">
        <div className="loja-store-pedido-progress-step is-active is-cancelado">
          <span className="loja-store-pedido-progress-dot">
            <Ban size={14} />
          </span>
          <span className="loja-store-pedido-progress-label">
            {pedido.status === 'reembolsado' ? 'Reembolsado' : pedido.status === 'pagamento_recusado' ? 'Pagamento recusado' : 'Cancelado'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <ol
      className={`loja-store-pedido-progress${animate ? ' loja-store-pedido-progress--animate' : ''}`}
      aria-label="Status do pedido"
    >
      {steps.map((step, i) => {
        const done = i < activeIndex
        const active = i === activeIndex
        const Icon = stepIcon(step.id)
        return (
          <li
            key={step.id}
            className={`loja-store-pedido-progress-step${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}
          >
            <span className="loja-store-pedido-progress-dot" aria-hidden>
              {done || active ? <Icon size={14} /> : <span className="loja-store-pedido-progress-dot-empty" />}
            </span>
            <span className="loja-store-pedido-progress-label">{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
