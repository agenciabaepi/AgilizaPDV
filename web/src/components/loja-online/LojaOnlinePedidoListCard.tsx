import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard } from 'lucide-react'
import type { LojaOnlinePedido, LojaOnlinePedidoItemComImagem } from '../../lib/loja-online-types'
import { pedidoAguardandoPagamentoOnline } from '../../lib/loja-online-types'
import { formatCurrency } from '../../lib/loja-online'
import { LojaOnlinePedidoProgressTracker } from './LojaOnlinePedidoProgressTracker'
import { LojaOnlinePedidoStatusBadge } from './LojaOnlinePedidoStatusBadge'
import { LojaOnlinePedidoThumbs } from './LojaOnlinePedidoThumbs'

type Props = {
  pedido: LojaOnlinePedido
  itens: LojaOnlinePedidoItemComImagem[]
  link: (path?: string) => string
  celebrating?: boolean
}

export const LojaOnlinePedidoListCard = forwardRef<HTMLElement, Props>(function LojaOnlinePedidoListCard(
  { pedido, itens, link, celebrating = false },
  ref
) {
  const aguardandoPag = pedidoAguardandoPagamentoOnline(pedido)
  const itemCount = itens.reduce((acc, i) => acc + i.quantidade, 0)
  const itemLabel = itemCount === 1 ? '1 item' : `${itemCount} itens`

  return (
    <article
      ref={ref}
      id={`pedido-${pedido.id}`}
      className={`loja-store-pedido-card${celebrating ? ' loja-store-pedido-card--celebrate' : ''}`}
    >
      <div className="loja-store-pedido-card-media">
        <LojaOnlinePedidoThumbs itens={itens} />
      </div>

      <div className="loja-store-pedido-card-body">
        <header className="loja-store-pedido-card-header">
          <div className="loja-store-pedido-card-title">
            <strong>#{pedido.id.slice(0, 8).toUpperCase()}</strong>
            <LojaOnlinePedidoStatusBadge pedido={pedido} celebrate={celebrating} />
          </div>
          <time className="loja-store-pedido-card-date" dateTime={pedido.created_at}>
            {new Date(pedido.created_at).toLocaleString('pt-BR')}
          </time>
        </header>

        <p className="loja-store-pedido-card-meta">
          <span>{formatCurrency(pedido.total)}</span>
          <span className="loja-store-pedido-card-sep">·</span>
          <span>{pedido.forma_entrega === 'entrega' ? 'Entrega' : 'Retirada'}</span>
          <span className="loja-store-pedido-card-sep">·</span>
          <span>{itemLabel}</span>
          {pedido.cupom_codigo && (
            <>
              <span className="loja-store-pedido-card-sep">·</span>
              <span>Cupom {pedido.cupom_codigo}</span>
            </>
          )}
        </p>

        {itens.length > 0 && (
          <p className="loja-store-pedido-card-produtos">
            {itens.slice(0, 2).map((i) => i.nome).join(', ')}
            {itens.length > 2 ? ` +${itens.length - 2}` : ''}
          </p>
        )}

        <LojaOnlinePedidoProgressTracker pedido={pedido} animate={celebrating} />

        <footer className="loja-store-pedido-card-actions">
          <Link to={link(`conta/pedido/${pedido.id}`)} className="loja-store-pedido-card-link">
            Ver detalhes
          </Link>
          {aguardandoPag && (
            <Link to={link(`conta/pedido/${pedido.id}/pagar`)} className="loja-store-btn-primary loja-store-pedido-pagar">
              <CreditCard size={16} /> Pagar agora
            </Link>
          )}
        </footer>
      </div>
    </article>
  )
})
