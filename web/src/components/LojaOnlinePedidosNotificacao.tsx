import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Package, ShoppingBag, Truck, X } from 'lucide-react'
import {
  fetchLojaOnlinePedidosItensBatch,
} from '../lib/loja-online-api'
import type { LojaOnlinePedido, LojaOnlinePedidoItemComImagem } from '../lib/loja-online-types'
import { formatCurrency } from '../lib/loja-online'

function pedidoResumoItens(itens: LojaOnlinePedidoItemComImagem[]): string {
  if (itens.length === 0) return 'Ver produtos do pedido'
  const nomes = itens.slice(0, 2).map((i) => i.nome)
  if (itens.length > 2) return `${nomes.join(', ')} +${itens.length - 2}`
  return nomes.join(', ')
}

function PedidoBubble({
  pedido,
  itens,
  onDismiss,
  pulse,
}: {
  pedido: LojaOnlinePedido
  itens: LojaOnlinePedidoItemComImagem[]
  onDismiss: () => void
  pulse?: boolean
}) {
  const thumb = itens.find((i) => i.imagem)?.imagem
  const isEntrega = pedido.forma_entrega === 'entrega'

  return (
    <div className={`loja-pedidos-bubble${pulse ? ' loja-pedidos-bubble--pulse' : ''}`}>
      <div className="loja-pedidos-bubble-header">
        <span className="loja-pedidos-bubble-badge">
          <ShoppingBag size={14} aria-hidden />
          Nova venda online
        </span>
        <button
          type="button"
          className="loja-pedidos-bubble-close"
          onClick={onDismiss}
          aria-label="Ocultar notificação deste pedido"
        >
          <X size={16} />
        </button>
      </div>

      <Link to="/loja-online/pedidos" className="loja-pedidos-bubble-body">
        <div className="loja-pedidos-bubble-media">
          {thumb ? (
            <img src={thumb} alt="" className="loja-pedidos-bubble-thumb" loading="lazy" />
          ) : (
            <div className="loja-pedidos-bubble-thumb loja-pedidos-bubble-thumb--placeholder">
              <Package size={20} />
            </div>
          )}
        </div>
        <div className="loja-pedidos-bubble-info">
          <strong>#{pedido.id.slice(0, 8).toUpperCase()}</strong>
          <span className="loja-pedidos-bubble-total">{formatCurrency(pedido.total)}</span>
          <p className="loja-pedidos-bubble-cliente">{pedido.cliente_nome ?? 'Cliente'}</p>
          <p className="loja-pedidos-bubble-itens">{pedidoResumoItens(itens)}</p>
          <p className="loja-pedidos-bubble-meta">
            {isEntrega ? (
              <>
                <Truck size={13} aria-hidden /> Entrega
              </>
            ) : (
              'Retirada na loja'
            )}
            <span>·</span>
            {new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </Link>

      <Link to="/loja-online/pedidos" className="loja-pedidos-bubble-action">
        Preparar envio
        <ChevronRight size={16} aria-hidden />
      </Link>
    </div>
  )
}

export function LojaOnlinePedidosNotificacao({
  pedidos,
  pulse,
  onDismiss,
}: {
  pedidos: LojaOnlinePedido[]
  pulse?: boolean
  onDismiss: (pedidoId: string) => void
}) {
  const [itensMap, setItensMap] = useState<Record<string, LojaOnlinePedidoItemComImagem[]>>({})

  useEffect(() => {
    if (pedidos.length === 0) {
      setItensMap({})
      return
    }
    const ids = pedidos.map((p) => p.id)
    let cancelled = false
    fetchLojaOnlinePedidosItensBatch(ids)
      .then((map) => {
        if (!cancelled) setItensMap(map)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pedidos])

  if (pedidos.length === 0) return null

  const featured = pedidos.slice(0, 2)
  const restantes = pedidos.length - featured.length

  return (
    <div className="loja-pedidos-bubble-stack" aria-live="polite">
      {featured.map((pedido, index) => (
        <PedidoBubble
          key={pedido.id}
          pedido={pedido}
          itens={itensMap[pedido.id] ?? []}
          onDismiss={() => onDismiss(pedido.id)}
          pulse={pulse && index === 0}
        />
      ))}
      {restantes > 0 && (
        <Link to="/loja-online/pedidos" className="loja-pedidos-bubble-more">
          +{restantes} {restantes === 1 ? 'pedido' : 'pedidos'} aguardando
          <ChevronRight size={16} aria-hidden />
        </Link>
      )}
    </div>
  )
}
