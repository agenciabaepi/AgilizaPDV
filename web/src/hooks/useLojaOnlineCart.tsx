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
import type { LojaOnlineCartItem, LojaOnlineProduto } from '../lib/loja-online-types'
import { cartTotal } from '../lib/loja-online-types'
import { useLojaOnlineStore } from './useLojaOnlineStore'
import { LojaOnlineAddToCartFly } from '../components/loja-online/LojaOnlineAddToCartFly'

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
  addItem: (produto: LojaOnlineProduto, quantidade?: number, origin?: HTMLElement | null) => void
  setQuantity: (produtoId: string, quantidade: number) => void
  removeItem: (produtoId: string) => void
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
        imagem: produto.imagem,
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
    (produto: LojaOnlineProduto, quantidade = 1, origin?: HTMLElement | null) => {
      const maxStock =
        produto.controla_estoque ? Math.max(0, produto.estoque_atual ?? 0) : null
      if (maxStock !== null && maxStock <= 0) return

      const qty = Math.max(1, quantidade)
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.produtoId === produto.id)
        let nextQty = idx >= 0 ? prev[idx].quantidade + qty : qty
        if (maxStock !== null) nextQty = Math.min(nextQty, maxStock)
        if (nextQty <= 0) return prev

        let next: LojaOnlineCartItem[]
        if (idx >= 0) {
          next = prev.map((i, n) =>
            n === idx
              ? {
                  ...i,
                  quantidade: nextQty,
                  controla_estoque: produto.controla_estoque,
                  estoque_atual: produto.estoque_atual,
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
              imagem: produto.imagem,
              quantidade: nextQty,
              controla_estoque: produto.controla_estoque,
              estoque_atual: produto.estoque_atual,
            },
          ]
        }
        if (empresaId) localStorage.setItem(storageKey(empresaId), JSON.stringify(next))
        return next
      })
      if (origin) triggerFly(produto, origin)
      setCartBurst({ id: crypto.randomUUID(), x: 0, y: 0 })
      pulseBadge()
    },
    [empresaId, triggerFly, pulseBadge]
  )

  const setQuantity = useCallback(
    (produtoId: string, quantidade: number) => {
      setItems((prev) => {
        const item = prev.find((i) => i.produtoId === produtoId)
        let qty = quantidade
        if (item?.controla_estoque && item.estoque_atual != null) {
          qty = Math.min(qty, Math.max(0, item.estoque_atual))
        }
        const next =
          qty <= 0
            ? prev.filter((i) => i.produtoId !== produtoId)
            : prev.map((i) => (i.produtoId === produtoId ? { ...i, quantidade: qty } : i))
        if (empresaId) localStorage.setItem(storageKey(empresaId), JSON.stringify(next))
        return next
      })
    },
    [empresaId]
  )

  const removeItem = useCallback(
    (produtoId: string) => {
      setItems((prev) => {
        const next = prev.filter((i) => i.produtoId !== produtoId)
        if (empresaId) localStorage.setItem(storageKey(empresaId), JSON.stringify(next))
        return next
      })
    },
    [empresaId]
  )

  const clear = useCallback(() => {
    setItems([])
    if (empresaId) localStorage.removeItem(storageKey(empresaId))
  }, [empresaId])

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
