import type { LojaOnlinePedido } from '../../lib/loja-online-types'
import { LojaOnlinePedidoProgressTracker } from './LojaOnlinePedidoProgressTracker'

/** @deprecated Use LojaOnlinePedidoProgressTracker */
export function LojaOnlinePedidoMiniTimeline({
  pedido,
  animate = false,
}: {
  pedido: LojaOnlinePedido
  animate?: boolean
}) {
  return <LojaOnlinePedidoProgressTracker pedido={pedido} animate={animate} />
}
