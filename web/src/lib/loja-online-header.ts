export type LojaOnlineHeaderMobileId = 'classic' | 'center' | 'inverted'

export type LojaOnlineHeaderMobileSpec = {
  id: LojaOnlineHeaderMobileId
  label: string
  description: string
  /** Ordem da barra superior no celular: menu, logo, carrinho */
  row: ['menu' | 'brand' | 'cart', 'menu' | 'brand' | 'cart', 'menu' | 'brand' | 'cart']
}

export const LOJA_ONLINE_HEADER_MOBILE_PADRAO: LojaOnlineHeaderMobileId = 'classic'

export const LOJA_ONLINE_HEADER_MOBILE_TEMPLATES: LojaOnlineHeaderMobileSpec[] = [
  {
    id: 'classic',
    label: 'Clássico',
    description: 'Menu à esquerda, logo no centro, carrinho à direita. Busca embaixo.',
    row: ['menu', 'brand', 'cart'],
  },
  {
    id: 'center',
    label: 'Menu no centro',
    description: 'Logo à esquerda, menu no centro, carrinho à direita. Busca embaixo.',
    row: ['brand', 'menu', 'cart'],
  },
  {
    id: 'inverted',
    label: 'Invertido',
    description: 'Carrinho à esquerda, logo no centro, menu à direita. Busca embaixo.',
    row: ['cart', 'brand', 'menu'],
  },
]

export function parseLojaOnlineHeaderMobile(
  value: string | null | undefined
): LojaOnlineHeaderMobileId {
  const id = (value ?? '').trim().toLowerCase()
  if (id === 'center' || id === 'inverted' || id === 'classic') return id
  return LOJA_ONLINE_HEADER_MOBILE_PADRAO
}

export const LOJA_ONLINE_LOGO_HEADER_SIZE_MIN = 24
export const LOJA_ONLINE_LOGO_HEADER_SIZE_MAX = 72
export const LOJA_ONLINE_LOGO_HEADER_SIZE_PADRAO = 36

export function parseLojaOnlineLogoHeaderSize(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n)) return LOJA_ONLINE_LOGO_HEADER_SIZE_PADRAO
  return Math.min(
    LOJA_ONLINE_LOGO_HEADER_SIZE_MAX,
    Math.max(LOJA_ONLINE_LOGO_HEADER_SIZE_MIN, Math.round(n))
  )
}
