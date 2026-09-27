import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { LojaOnlineCartItem, LojaOnlinePersonalizacao, LojaOnlineProduto } from '../lib/loja-online-types'
import { cartLineKey, cartTotal, resolveLojaOnlineCartImagem } from '../lib/loja-online-types'
import { useLojaOnlineStore } from './useLojaOnlineStore'
import { LojaOnlineAddToCartFly } from '../components/loja-online/LojaOnlineAddToCartFly'
import { trackLojaOnlineEvent } from '../lib/loja-online-track'
import { trackLojaOnlineBehavior } from '../lib/loja-online-behavior'
import { fetchLojaOnlineProduto } from '../lib/loja-online-api'

export type CartFlyItem = {
  id: string
  imagem: string | null
  fromX: number
  fromY: number
  toX: number
  toY: number
}

export type CartAddBurst = {
  id: string
  x: number
  y: number
}

type LojaOnlineCartContextValue = {
  items: LojaOnlineCartItem[]
  count: number
  total: number
  badgePulse: boolean
  flyItems: CartFlyItem[]
  cartBurst: CartAddBurst | null
  addItem: (
    produto: LojaOnlineProduto,
    quantidade?: number,
    origin?: HTMLElement | null,
    extra?: { produtoPaiId?: string; variacaoLabel?: string; personalizacao?: LojaOnlinePersonalizacao }
  ) => void
  /** `lineKey` vem de `cartLineKey(item)`; para itens comuns é o próprio produtoId. */
  setQuantity: (lineKey: string, quantidade: number) => void
  removeItem: (lineKey: string) => void
  /** Soma das quantidades do SKU em todas as linhas do carrinho. */
  quantidadeDoProduto: (produtoId: string) => number
  clear: () => void
  registerCartIcon: (el: HTMLElement | null) => void
  dismissFly: (id: string) => void
  dismissCartBurst: () => void
}

const LojaOnlineCartContext = createContext<LojaOnlineCartContextValue | null>(null)

function storageKey(empresaId: string) {
  return `agiliza:loja-cart:${empresaId}`
}

function centerOf(el: HTMLElement) {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

export function LojaOnlineCartProvider({ children }: { children: ReactNode }) {
  const { store } = useLojaOnlineStore()
  const empresaId = store?.empresa_id ?? ''
  const [items, setItems] = useState<LojaOnlineCartItem[]>([])
  const [flyItems, setFlyItems] = useState<CartFlyItem[]>([])
  const [cartBurst, setCartBurst] = useState<CartAddBurst | null>(null)
  const [badgePulse, setBadgePulse] = useState(false)
  const cartIconsRef = useRef<HTMLElement[]>([])
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!empresaId) {
      setItems([])
      return
    }
    try {
      const raw = localStorage.getItem(storageKey(empresaId))
      if (raw) setItems(JSON.parse(raw) as LojaOnlineCartItem[])
    } catch {
      setItems([])
    }
  }, [empresaId])

  /** Atualiza fotos do carrinho com a galeria atual do produto (evita imagem legada em cache). */
  useEffect(() => {
    if (!empresaId || items.length === 0) return
    let cancelled = false
    void (async () => {
      const ids = [
        ...new Set(
          items
            .filter((item) => !item.personalizacao)
            .map((item) => item.produtoPaiId || item.produtoId)
            .filter(Boolean)
        ),
      ]
      if (ids.length === 0) return
      const byId = new Map<string, string | null>()
      await Promise.all(
        ids.map(async (id) => {
          try {
            const p = await fetchLojaOnlineProduto(empresaId, id)
            if (p) byId.set(id, resolveLojaOnlineCartImagem(p))
          } catch {
            /* ignore */
          }
        })
      )
      if (cancelled || byId.size === 0) return
      setItems((prev) => {
        let changed = false
        const next = prev.map((item) => {
          if (item.personalizacao) return item
          const key = item.produtoPaiId || item.produtoId
          const fresh = byId.get(key)
          if (fresh == null || fresh === item.imagem) return item
          changed = true
          return { ...item, imagem: fresh }
        })
        if (!changed) return prev
        try {
          localStorage.setItem(storageKey(empresaId), JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    })()
    return () => {
      cancelled = true
    }
    // Só ao carregar / mudar empresa ou composição dos ids — não a cada qty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, items.map((i) => `${i.produtoId}:${i.produtoPaiId ?? ''}`).join('|')])

  const registerCartIcon = useCallback((el: HTMLElement | null) => {
    if (!el) return
    if (!cartIconsRef.current.includes(el)) cartIconsRef.current.push(el)
  }, [])

  const pickCartIcon = useCallback(() => {
    const visible = cartIconsRef.current.find((node) => {
      const r = node.getBoundingClientRect()
      return r.width > 2 && r.height > 2
    })
    return visible ?? cartIconsRef.current[0] ?? null
  }, [])

  const dismissFly = useCallback((id: string) => {
    setFlyItems((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const dismissCartBurst = useCallback(() => {
    setCartBurst(null)
  }, [])

  const triggerFly = useCallback((produto: LojaOnlineProduto, origin: HTMLElement) => {
    const cartEl = pickCartIcon()
    if (!cartEl) return
    const from = centerOf(origin)
    const to = centerOf(cartEl)
    const id = crypto.randomUUID()
    setFlyItems((prev) => [
      ...prev,
      {
        id,
        imagem: resolveLojaOnlineCartImagem(produto),
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
      },
    ])
  }, [pickCartIcon])

  const pulseBadge = useCallback(() => {
    setBadgePulse(true)
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
    pulseTimerRef.current = setTimeout(() => setBadgePulse(false), 480)
  }, [])

  const addItem = useCallback(
    (
      produto: LojaOnlineProduto,
      quantidade = 1,
      origin?: HTMLElement | null,
      extra?: { produtoPaiId?: string; variacaoLabel?: string; personalizacao?: LojaOnlinePersonalizacao }
    ) => {
      const maxStock =
        produto.controla_estoque ? Math.max(0, produto.estoque_atual ?? 0) : null
      if (maxStock !== null && maxStock <= 0) return

      const qty = Math.max(1, quantidade)
      const personalizacao = extra?.personalizacao
      const imagem = personalizacao?.previewUrl ?? resolveLojaOnlineCartImagem(produto)
      setItems((prev) => {
        const lineKey = cartLineKey({ produtoId: produto.id, personalizacao })
        const idx = prev.findIndex((i) => cartLineKey(i) === lineKey)
        const outrasLinhas = prev
          .filter((i, n) => n !== idx && i.produtoId === produto.id)
          .reduce((s, i) => s + i.quantidade, 0)
        let nextQty = idx >= 0 ? prev[idx].quantidade + qty : qty
        if (maxStock !== null) nextQty = Math.min(nextQty, maxStock - outrasLinhas)
        if (nextQty <= 0) return prev

        let next: LojaOnlineCartItem[]
        if (idx >= 0) {
          next = prev.map((i, n) =>
            n === idx
              ? {
                  ...i,
                  quantidade: nextQty,
                  nome: produto.nome,
                  preco: produto.preco,
                  imagem,
                  controla_estoque: produto.controla_estoque,
                  estoque_atual: produto.estoque_atual,
                  produtoPaiId: extra?.produtoPaiId ?? i.produtoPaiId,
                  variacaoLabel: extra?.variacaoLabel ?? i.variacaoLabel,
                }
              : i
          )
        } else {
          next = [
            ...prev,
            {
              produtoId: produto.id,
              nome: produto.nome,
              preco: produto.preco,
              unidade: produto.unidade || 'UN',
              imagem,
              quantidade: nextQty,
              controla_estoque: produto.controla_estoque,
              estoque_atual: produto.estoque_atual,
              produtoPaiId: extra?.produtoPaiId,
              variacaoLabel: extra?.variacaoLabel,
              personalizacao,
            },
          ]
        }
        if (empresaId) localStorage.setItem(storageKey(empresaId), JSON.stringify(next))
        return next
      })
      if (origin) triggerFly(produto, origin)
      setCartBurst({ id: crypto.randomUUID(), x: 0, y: 0 })
      pulseBadge()
      if (empresaId) {
        void trackLojaOnlineEvent({
          empresaId,
          eventName: 'add_to_cart',
          produtoId: produto.id,
          value: produto.preco * qty,
          contentIds: [produto.id],
        })
      }
    },
    [empresaId, triggerFly, pulseBadge]
  )

  const setQuantity = useCallback(
    (lineKey: string, quantidade: number) => {
      const removed = quantidade <= 0 ? items.find((i) => cartLineKey(i) === lineKey) : null
      if (removed) {
        trackLojaOnlineBehavior(
          'remove_from_cart',
          { preco: removed.preco, quantidade: removed.quantidade, nome: removed.nome },
          { produtoId: removed.produtoPaiId || removed.produtoId }
        )
      }
      setItems((prev) => {
        const item = prev.find((i) => cartLineKey(i) === lineKey)
        let qty = quantidade
        if (item?.controla_estoque && item.estoque_atual != null) {
          const outrasLinhas = prev
            .filter((i) => i !== item && i.produtoId === item.produtoId)
            .reduce((s, i) => s + i.quantidade, 0)
          qty = Math.min(qty, Math.max(0, item.estoque_atual - outrasLinhas))
        }
        const next =
          qty <= 0
            ? prev.filter((i) => cartLineKey(i) !== lineKey)
            : prev.map((i) => (cartLineKey(i) === lineKey ? { ...i, quantidade: qty } : i))
        if (empresaId) localStorage.setItem(storageKey(empresaId), JSON.stringify(next))
        return next
      })
    },
    [empresaId, items]
  )

  const removeItem = useCallback(
    (lineKey: string) => {
      const removed = items.find((i) => cartLineKey(i) === lineKey)
      if (removed) {
        trackLojaOnlineBehavior(
          'remove_from_cart',
          { preco: removed.preco, quantidade: removed.quantidade, nome: removed.nome },
          { produtoId: removed.produtoPaiId || removed.produtoId }
        )
      }
      setItems((prev) => {
        const next = prev.filter((i) => cartLineKey(i) !== lineKey)
        if (empresaId) localStorage.setItem(storageKey(empresaId), JSON.stringify(next))
        return next
      })
    },
    [empresaId, items]
  )

  const lastCartSigRef = useRef<string | null>(null)
  useEffect(() => {
    const sig = items.map((i) => `${i.produtoId}:${i.quantidade}`).join('|')
    if (lastCartSigRef.current === null || !empresaId) {
      lastCartSigRef.current = sig
      return
    }
    if (sig === lastCartSigRef.current) return
    lastCartSigRef.current = sig
    trackLojaOnlineBehavior('cart_update', { subtotal: cartTotal(items), itens: items.length })
  }, [items, empresaId])

  const clear = useCallback(() => {
    setItems([])
    if (empresaId) localStorage.removeItem(storageKey(empresaId))
  }, [empresaId])

  const quantidadeDoProduto = useCallback(
    (produtoId: string) => items.filter((i) => i.produtoId === produtoId).reduce((s, i) => s + i.quantidade, 0),
    [items]
  )

  const count = items.reduce((s, i) => s + i.quantidade, 0)
  const total = cartTotal(items)

  const value = useMemo(
    () => ({
      items,
      count,
      total,
      badgePulse,
      flyItems,
      cartBurst,
      addItem,
      setQuantity,
      removeItem,
      quantidadeDoProduto,
      clear,
      registerCartIcon,
      dismissFly,
      dismissCartBurst,
    }),
    [
      items,
      count,
      total,
      badgePulse,
      flyItems,
      cartBurst,
      addItem,
      setQuantity,
      removeItem,
      quantidadeDoProduto,
      clear,
      registerCartIcon,
      dismissFly,
      dismissCartBurst,
    ]
  )

  return (
    <LojaOnlineCartContext.Provider value={value}>
      {children}
      <LojaOnlineAddToCartFly />
    </LojaOnlineCartContext.Provider>
  )
}

export function useLojaOnlineCart() {
  const ctx = useContext(LojaOnlineCartContext)
  if (!ctx) throw new Error('useLojaOnlineCart deve ser usado dentro de LojaOnlineCartProvider')
  return ctx
}
