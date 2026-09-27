import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Package, Star, Truck } from 'lucide-react'
import {
  fetchLojaOnlinePedidoAvaliacaoInfo,
  fetchLojaOnlinePedidoCliente,
  fetchLojaOnlinePedidoItens,
  type LojaOnlinePedidoAvaliacaoInfo,
} from '../../lib/loja-online-api'
import { LojaOnlineAvaliacaoForm } from '../../components/loja-online/LojaOnlineAvaliacaoForm'
import type { LojaOnlinePedido, LojaOnlinePedidoItem } from '../../lib/loja-online-types'
import { pedidoAguardandoPagamentoOnline } from '../../lib/loja-online-types'
import { formatCurrency } from '../../lib/loja-online'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { useLojaOnlineSeo } from '../../hooks/useLojaOnlineSeo'

import { LojaOnlinePedidoProgressTracker } from '../../components/loja-online/LojaOnlinePedidoProgressTracker'
import { normalizePedidoStatus, pedidoDisplayStatusLabel } from '../../lib/loja-online-pedido-status'

export function LojaOnlinePedidoDetailPage() {
  const { pedidoId } = useParams<{ pedidoId: string }>()
  const { store, link } = useLojaOnlineStore()
  const { cliente, loading: authLoading } = useLojaOnlineClienteAuth()
  const [pedido, setPedido] = useState<LojaOnlinePedido | null>(null)
  const [itens, setItens] = useState<LojaOnlinePedidoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [avaliacaoInfo, setAvaliacaoInfo] = useState<LojaOnlinePedidoAvaliacaoInfo | null>(null)
  const [avaliandoItemId, setAvaliandoItemId] = useState<string | null>(null)

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

  const pedidoEntregue = pedido ? normalizePedidoStatus(pedido.status, pedido) === 'entregue' : false

  useEffect(() => {
    if (!pedidoEntregue || !store?.empresa_id || !cliente?.id || itens.length === 0) {
      setAvaliacaoInfo(null)
      return
    }
    let cancelled = false
    fetchLojaOnlinePedidoAvaliacaoInfo(
      store.empresa_id,
      cliente.id,
      itens.map((i) => i.produto_id)
    )
      .then((info) => {
        if (!cancelled) setAvaliacaoInfo(info)
      })
      .catch(() => {
        if (!cancelled) setAvaliacaoInfo(null)
      })
    return () => {
      cancelled = true
    }
  }, [pedidoEntregue, store?.empresa_id, cliente?.id, itens])

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
  const codigoRastreio = (pedido.codigo_rastreio || pedido.melhor_envio_tracking || '').trim()
  const linkRastreio = codigoRastreio
    ? `https://melhorrastreio.com.br/${encodeURIComponent(codigoRastreio)}`
    : null

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

      {codigoRastreio && (
        <div className="loja-store-pedido-rastreio">
          <Truck size={18} />
          <div>
            <strong>Rastreio</strong>
            <p>{codigoRastreio}</p>
            {linkRastreio && (
              <a href={linkRastreio} target="_blank" rel="noopener noreferrer" className="loja-store-pedido-rastreio-link">
                Acompanhar no Melhor Rastreio
              </a>
            )}
          </div>
        </div>
      )}

      <section className="loja-store-pedido-detail-section">
        <h2>Itens</h2>
        <ul className="loja-store-pedido-detail-itens">
          {itens.map((item) => {
            const produtoAvaliado = avaliacaoInfo?.produtoAvaliadoPorItem[item.produto_id] ?? null
            const jaAvaliou = produtoAvaliado ? avaliacaoInfo?.produtosJaAvaliados.has(produtoAvaliado) : false
            const abrindo = avaliandoItemId === item.id
            return (
              <li key={item.id} className="loja-store-pedido-detail-item">
                <div className="loja-store-pedido-detail-item-row">
                  <Package size={16} />
                  <span>{item.nome} × {item.quantidade}</span>
                  <strong>{formatCurrency(item.subtotal)}</strong>
                </div>
                {pedidoEntregue && produtoAvaliado ? (
                  jaAvaliou ? (
                    <p className="loja-store-pedido-avaliado">
                      <CheckCircle2 size={16} /> Produto avaliado. Obrigado!
                    </p>
                  ) : abrindo && store?.empresa_id ? (
                    <LojaOnlineAvaliacaoForm
                      empresaId={store.empresa_id}
                      produtoId={produtoAvaliado}
                      pedidoId={pedido.id}
                      produtoNome={item.nome}
                      onCancel={() => setAvaliandoItemId(null)}
                      onDone={() => {
                        setAvaliandoItemId(null)
                        setAvaliacaoInfo((cur) =>
                          cur
                            ? { ...cur, produtosJaAvaliados: new Set([...cur.produtosJaAvaliados, produtoAvaliado]) }
                            : cur
                        )
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="loja-store-pedido-avaliar-btn"
                      onClick={() => setAvaliandoItemId(item.id)}
                    >
                      <Star size={16} /> Avaliar produto
                    </button>
                  )
                ) : null}
              </li>
            )
          })}
        </ul>
        {!pedidoEntregue && !['cancelado', 'reembolsado', 'pagamento_recusado'].includes(pedido.status) ? (
          <p className="loja-online-hint">
            Depois que o pedido for entregue, você poderá avaliar os produtos e enviar fotos ou vídeo.
          </p>
        ) : null}
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
