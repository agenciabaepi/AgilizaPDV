import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, Heart, LogOut, Package, Wallet } from 'lucide-react'
import { sincronizarPagamentosLojaOnline } from '../../lib/loja-online-pagamentos-api'
import {
  fetchLojaOnlineFavoritos,
  fetchLojaOnlinePedidosCliente,
  fetchLojaOnlinePedidosItensBatch,
} from '../../lib/loja-online-api'
import { fetchCashbackSaldoOnline } from '../../lib/loja-online-cashback'
import type { LojaOnlineFavorito, LojaOnlinePedido, LojaOnlinePedidoItemComImagem } from '../../lib/loja-online-types'
import { formatCurrency } from '../../lib/loja-online'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { LojaOnlinePedidoListCard } from '../../components/loja-online/LojaOnlinePedidoListCard'

type ContaTab = 'pedidos' | 'cashback' | 'favoritos'

function readPedidoCelebracao(searchParams: URLSearchParams): string | null {
  if (searchParams.get('pagamento') !== 'confirmado') return null
  return searchParams.get('pedido')
}

export function LojaOnlineContaPage() {
  const { store, link, slug } = useLojaOnlineStore()
  const { cliente, logout, loading: authLoading } = useLojaOnlineClienteAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<ContaTab>('pedidos')
  const [pedidos, setPedidos] = useState<LojaOnlinePedido[]>([])
  const [pedidosItens, setPedidosItens] = useState<Record<string, LojaOnlinePedidoItemComImagem[]>>({})
  const [favoritos, setFavoritos] = useState<LojaOnlineFavorito[]>([])
  const [cashbackSaldo, setCashbackSaldo] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [celebratingPedidoId, setCelebratingPedidoId] = useState<string | null>(() =>
    readPedidoCelebracao(searchParams)
  )
  const [showConfirmBanner, setShowConfirmBanner] = useState(() => !!readPedidoCelebracao(searchParams))
  const pedidoCardRefs = useRef<Record<string, HTMLElement | null>>({})

  const clearCelebracaoParams = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('pedido')
    next.delete('pagamento')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!store?.empresa_id || !cliente?.id) return
    setLoading(true)
    const sync = slug
      ? sincronizarPagamentosLojaOnline({ slug }).catch(() => null)
      : Promise.resolve(null)
    sync
      .then(() =>
        Promise.all([
          fetchLojaOnlinePedidosCliente(store.empresa_id, cliente.id),
          store.loja_online_cashback_ativo === 1 && cliente.cliente_pdv_id
            ? fetchCashbackSaldoOnline(store.empresa_id, cliente.cliente_pdv_id)
            : Promise.resolve(null),
          fetchLojaOnlineFavoritos(store.empresa_id, cliente.id),
        ])
      )
      .then(([p, cb, fav]) => {
        const lista = p ?? []
        setPedidos(lista)
        setCashbackSaldo(cb?.saldo_disponivel ?? null)
        setFavoritos(fav ?? [])
        if (lista.length === 0) {
          setPedidosItens({})
          return
        }
        return fetchLojaOnlinePedidosItensBatch(lista.map((ped) => ped.id)).then(setPedidosItens)
      })
      .finally(() => setLoading(false))
  }, [store?.empresa_id, store?.loja_online_cashback_ativo, cliente?.id, cliente?.cliente_pdv_id, slug])

  useEffect(() => {
    const id = readPedidoCelebracao(searchParams)
    if (id) {
      setCelebratingPedidoId(id)
      setShowConfirmBanner(true)
      setTab('pedidos')
    }
  }, [searchParams])

  useEffect(() => {
    if (!celebratingPedidoId || loading) return
    const el = pedidoCardRefs.current[celebratingPedidoId]
    if (!el) return
    const scrollT = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    const bannerT = window.setTimeout(() => setShowConfirmBanner(false), 7000)
    const highlightT = window.setTimeout(() => {
      setCelebratingPedidoId(null)
      clearCelebracaoParams()
    }, 10000)
    return () => {
      window.clearTimeout(scrollT)
      window.clearTimeout(bannerT)
      window.clearTimeout(highlightT)
    }
  }, [celebratingPedidoId, loading, pedidos, clearCelebracaoParams])

  if (authLoading) {
    return <p className="loja-catalogo-empty">Carregando…</p>
  }

  if (!cliente) {
    return <Navigate to={link('entrar')} replace state={{ from: link('conta') }} />
  }

  return (
    <div className="loja-store-page">
      <div className="loja-store-conta-header">
        <div>
          <h1>Olá, {cliente.nome.split(' ')[0]}</h1>
          <p>{cliente.email}</p>
        </div>
        <button type="button" className="loja-store-btn-outline" onClick={logout}>
          <LogOut size={16} /> Sair
        </button>
      </div>

      {showConfirmBanner && celebratingPedidoId && (
        <div className="loja-store-pagamento-confirmado-banner" role="status">
          <CheckCircle size={22} className="loja-store-pagamento-confirmado-icon" aria-hidden />
          <div>
            <strong>Pagamento confirmado!</strong>
            <p>Seu pedido foi registrado e já aparece abaixo.</p>
          </div>
        </div>
      )}

      <nav className="loja-store-conta-tabs">
        <button type="button" className={tab === 'pedidos' ? 'is-active' : ''} onClick={() => setTab('pedidos')}>
          <Package size={16} /> Pedidos
        </button>
        {store?.loja_online_cashback_ativo === 1 && (
          <button type="button" className={tab === 'cashback' ? 'is-active' : ''} onClick={() => setTab('cashback')}>
            <Wallet size={16} /> Cashback
          </button>
        )}
        <button type="button" className={tab === 'favoritos' ? 'is-active' : ''} onClick={() => setTab('favoritos')}>
          <Heart size={16} /> Favoritos
        </button>
      </nav>

      {loading ? (
        <p className="loja-catalogo-empty">Carregando…</p>
      ) : tab === 'pedidos' ? (
        pedidos.length === 0 ? (
          <p className="loja-catalogo-empty">
            Você ainda não fez pedidos. <Link to={link()}>Ver produtos</Link>
          </p>
        ) : (
          <div className="loja-store-pedidos-list">
            {pedidos.map((p) => (
              <LojaOnlinePedidoListCard
                key={p.id}
                ref={(el) => {
                  pedidoCardRefs.current[p.id] = el
                }}
                pedido={p}
                itens={pedidosItens[p.id] ?? []}
                link={link}
                celebrating={celebratingPedidoId === p.id}
              />
            ))}
          </div>
        )
      ) : tab === 'cashback' ? (
        <div className="loja-store-cashback-box">
          <p className="loja-store-cashback-saldo">{formatCurrency(cashbackSaldo ?? 0)}</p>
          <p className="loja-store-cashback-hint">Saldo disponível para usar nas próximas compras.</p>
        </div>
      ) : favoritos.length === 0 ? (
        <p className="loja-catalogo-empty">
          Nenhum favorito ainda. <Link to={link()}>Explorar produtos</Link>
        </p>
      ) : (
        <div className="loja-store-favoritos-grid">
          {favoritos.map((f) =>
            f.produto ? (
              <Link key={f.id} to={link(`produto/${f.produto.id}`)} className="loja-store-favorito-card">
                {f.produto.imagem ? (
                  <img src={f.produto.imagem} alt="" />
                ) : (
                  <div className="loja-catalogo-produto-placeholder"><Package size={24} /></div>
                )}
                <span>{f.produto.nome}</span>
                <strong>{formatCurrency(f.produto.preco)}</strong>
              </Link>
            ) : null
          )}
        </div>
      )}
    </div>
  )
}
