import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Package, Truck } from 'lucide-react'
import {
  fetchLojaOnlinePedidoCliente,
  fetchLojaOnlinePedidoItens,
} from '../../lib/loja-online-api'
import type { LojaOnlinePedido, LojaOnlinePedidoItem } from '../../lib/loja-online-types'
import { pedidoAguardandoPagamentoOnline } from '../../lib/loja-online-types'
import { formatCurrency } from '../../lib/loja-online'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { useLojaOnlineSeo } from '../../hooks/useLojaOnlineSeo'

import { LojaOnlinePedidoProgressTracker } from '../../components/loja-online/LojaOnlinePedidoProgressTracker'
import { pedidoDisplayStatusLabel } from '../../lib/loja-online-pedido-status'

export function LojaOnlinePedidoDetailPage() {
  const { pedidoId } = useParams<{ pedidoId: string }>()
  const { store, link } = useLojaOnlineStore()
  const { cliente, loading: authLoading } = useLojaOnlineClienteAuth()
  const [pedido, setPedido] = useState<LojaOnlinePedido | null>(null)
  const [itens, setItens] = useState<LojaOnlinePedidoItem[]>([])
  const [loading, setLoading] = useState(true)

  useLojaOnlineSeo(pedido ? { title: `Pedido #${pedido.id.slice(0, 8)}` } : null)

  useEffect(() => {
    if (!store?.empresa_id || !cliente?.id || !pedidoId) return
    setLoading(true)
    Promise.all([
      fetchLojaOnlinePedidoCliente(store.empresa_id, cliente.id, pedidoId),
      fetchLojaOnlinePedidoItens(pedidoId),
    ])
      .then(([p, i]) => {
        setPedido(p)
        setItens(i ?? [])
      })
      .finally(() => setLoading(false))
  }, [store?.empresa_id, cliente?.id, pedidoId])

  if (authLoading) return <p className="loja-catalogo-empty">Carregando…</p>
  if (!cliente) return <Navigate to={link('entrar')} replace state={{ from: link(`conta/pedido/${pedidoId}`) }} />

  if (loading) return <p className="loja-catalogo-empty">Carregando pedido…</p>
  if (!pedido) {
    return (
      <div className="loja-store-page">
        <p className="loja-catalogo-empty">Pedido não encontrado.</p>
        <Link to={link('conta')} className="loja-store-back-link"><ArrowLeft size={16} /> Minha conta</Link>
      </div>
    )
  }

  const aguardandoPag = pedidoAguardandoPagamentoOnline(pedido)
  const statusLabel = pedidoDisplayStatusLabel(pedido)

  return (
    <div className="loja-store-page loja-store-pedido-detail">
      <Link to={link('conta')} className="loja-store-back-link"><ArrowLeft size={16} /> Voltar aos pedidos</Link>
      <h1>Pedido #{pedido.id.slice(0, 8).toUpperCase()}</h1>
      <p className="loja-store-pedido-detail-date">
        {new Date(pedido.created_at).toLocaleString('pt-BR')}
      </p>
      <p className="loja-store-pedido-detail-status">{statusLabel}</p>

      <LojaOnlinePedidoProgressTracker pedido={pedido} />

      {aguardandoPag && (
        <Link to={link(`conta/pedido/${pedido.id}/pagar`)} className="loja-store-btn-primary loja-store-btn-inline">
          Pagar pedido
        </Link>
      )}

      {pedido.codigo_rastreio && (
        <div className="loja-store-pedido-rastreio">
          <Truck size={18} />
          <div>
            <strong>Rastreio</strong>
            <p>{pedido.codigo_rastreio}</p>
          </div>
        </div>
      )}

      <section className="loja-store-pedido-detail-section">
        <h2>Itens</h2>
        <ul className="loja-store-pedido-detail-itens">
          {itens.map((item) => (
            <li key={item.id}>
              <Package size={16} />
              <span>{item.nome} × {item.quantidade}</span>
              <strong>{formatCurrency(item.subtotal)}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="loja-store-pedido-detail-section loja-store-pedido-detail-totais">
        {pedido.valor_desconto ? <p>Desconto: −{formatCurrency(pedido.valor_desconto)}</p> : null}
        {pedido.valor_frete ? <p>Frete: {formatCurrency(pedido.valor_frete)}</p> : null}
        {pedido.cashback_usado ? <p>Cashback usado: −{formatCurrency(pedido.cashback_usado)}</p> : null}
        <p className="loja-store-pedido-detail-total">Total: <strong>{formatCurrency(pedido.total)}</strong></p>
      </section>

      {pedido.endereco_entrega && (
        <section className="loja-store-pedido-detail-section">
          <h2>Entrega</h2>
          <p>{pedido.endereco_entrega}</p>
        </section>
      )}
    </div>
  )
}
