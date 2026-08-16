import type { ReactNode } from 'react'
import {
  Globe,
  Image,
  LayoutGrid,
  FileText,
  ShoppingBag,
  Truck,
  CreditCard,
  Tag,
  Package,
  Palette,
  PanelTop,
  Sparkles,
} from 'lucide-react'
import { createElement } from 'react'

export type LojaOnlineAdminSectionId =
  | 'publicacao'
  | 'aparencia'
  | 'cabecalho'
  | 'banners'
  | 'catalogo'
  | 'institucional'
  | 'checkout'
  | 'entrega'
  | 'pagamentos'
  | 'cupons'
  | 'orderbumps'
  | 'pedidos'

export type LojaOnlineAdminNavItem = {
  id: LojaOnlineAdminSectionId
  path: string
  label: string
  icon: ReactNode
  intro: { title: string; description: string }
  /** Seções que não usam o botão "Salvar loja online" */
  noSave?: boolean
}

export type LojaOnlineAdminNavGroup = {
  label: string
  items: LojaOnlineAdminNavItem[]
}

const icon = (el: ReactNode) => el

export const LOJA_ONLINE_ADMIN_DEFAULT_SECTION: LojaOnlineAdminSectionId = 'publicacao'

/** URLs antigas (?tab=) continuam funcionando após reorganização. */
export const LOJA_ONLINE_ADMIN_LEGACY_TAB_MAP: Record<string, LojaOnlineAdminSectionId> = {
  vitrine: 'aparencia',
  visual: 'aparencia',
  rodape: 'institucional',
}

export const LOJA_ONLINE_ADMIN_NAV_GROUPS: LojaOnlineAdminNavGroup[] = [
  {
    label: 'Loja',
    items: [
      {
        id: 'publicacao',
        path: '/loja-online/publicacao',
        label: 'Publicação',
        icon: icon(createElement(Globe, { size: 18 })),
        intro: {
          title: 'Publicação e visibilidade',
          description:
            'Endereço da loja, domínio, SEO e ferramentas de marketing para ser encontrado no Google e redes sociais.',
        },
      },
      {
        id: 'aparencia',
        path: '/loja-online/aparencia',
        label: 'Aparência',
        icon: icon(createElement(Palette, { size: 18 })),
        intro: {
          title: 'Identidade visual',
          description: 'Nome, cores e faixa de avisos — a identidade que o cliente vê ao entrar na loja.',
        },
      },
      {
        id: 'cabecalho',
        path: '/loja-online/cabecalho',
        label: 'Cabeçalho',
        icon: icon(createElement(PanelTop, { size: 18 })),
        intro: {
          title: 'Cabeçalho no celular',
          description:
            'Escolha o modelo, o logo, as cores do cabeçalho e do menu lateral. O preview ao lado mostra como fica no celular.',
        },
      },
      {
        id: 'banners',
        path: '/loja-online/banners',
        label: 'Banners',
        icon: icon(createElement(Image, { size: 18 })),
        intro: {
          title: 'Banners da vitrine',
          description:
            'Carrossel principal da loja: crie no Banner Studio ou envie imagens prontas, com artes diferentes para computador e celular.',
        },
      },
      {
        id: 'catalogo',
        path: '/loja-online/catalogo',
        label: 'Catálogo',
        icon: icon(createElement(LayoutGrid, { size: 18 })),
        intro: {
          title: 'Catálogo de produtos',
          description:
            'Modelos e cores dos cards, preços na vitrine e regras de estoque. O cadastro de cada item fica em Produtos.',
        },
      },
      {
        id: 'institucional',
        path: '/loja-online/institucional',
        label: 'Institucional',
        icon: icon(createElement(FileText, { size: 18 })),
        intro: {
          title: 'Contato e informações',
          description: 'Rodapé, redes sociais e páginas legais exibidas no site.',
        },
      },
    ],
  },
  {
    label: 'Vendas',
    items: [
      {
        id: 'pedidos',
        path: '/loja-online/pedidos',
        label: 'Pedidos',
        icon: icon(createElement(Package, { size: 18 })),
        intro: {
          title: 'Pedidos online',
          description: 'Acompanhe, confirme e gerencie os pedidos da loja.',
        },
        noSave: true,
      },
      {
        id: 'cupons',
        path: '/loja-online/cupons',
        label: 'Cupons',
        icon: icon(createElement(Tag, { size: 18 })),
        intro: {
          title: 'Cupons de desconto',
          description: 'Códigos promocionais para usar no checkout.',
        },
        noSave: true,
      },
      {
        id: 'orderbumps',
        path: '/loja-online/orderbumps',
        label: 'Order bump',
        icon: icon(createElement(Sparkles, { size: 18 })),
        intro: {
          title: 'Order bump no checkout',
          description:
            'Ofereça produtos extras antes de finalizar: ofertas fixas para qualquer compra ou personalizadas (ex.: controle de TV → pilhas).',
        },
        noSave: true,
      },
      {
        id: 'checkout',
        path: '/loja-online/checkout',
        label: 'Checkout',
        icon: icon(createElement(ShoppingBag, { size: 18 })),
        intro: {
          title: 'Experiência de compra',
          description: 'Cadastro do cliente, banner, cronômetro de oferta, WhatsApp, cashback e mensagens após o pedido.',
        },
      },
      {
        id: 'entrega',
        path: '/loja-online/entrega',
        label: 'Entrega',
        icon: icon(createElement(Truck, { size: 18 })),
        intro: {
          title: 'Entrega e frete',
          description: 'Formas de recebimento, cálculo de frete e promoção de frete grátis.',
        },
      },
      {
        id: 'pagamentos',
        path: '/loja-online/pagamentos',
        label: 'Pagamentos',
        icon: icon(createElement(CreditCard, { size: 18 })),
        intro: {
          title: 'Formas de pagamento',
          description: 'Gateways e métodos aceitos no checkout da loja.',
        },
      },
    ],
  },
]

export const LOJA_ONLINE_ADMIN_ALL_ITEMS = LOJA_ONLINE_ADMIN_NAV_GROUPS.flatMap((g) => g.items)

export const LOJA_ONLINE_ADMIN_SECTION_IDS = LOJA_ONLINE_ADMIN_ALL_ITEMS.map((i) => i.id)

export function resolveLojaOnlineAdminSection(raw: string | null | undefined): LojaOnlineAdminSectionId | null {
  if (!raw) return null
  const id = (LOJA_ONLINE_ADMIN_LEGACY_TAB_MAP[raw] ?? raw) as LojaOnlineAdminSectionId
  return LOJA_ONLINE_ADMIN_SECTION_IDS.includes(id) ? id : null
}

export function getLojaOnlineAdminNavItem(section: LojaOnlineAdminSectionId): LojaOnlineAdminNavItem {
  return LOJA_ONLINE_ADMIN_ALL_ITEMS.find((i) => i.id === section)!
}

export function getLojaOnlineAdminPageTitle(pathname: string): string | null {
  if (pathname === '/loja-online') return 'Loja online'
  const match = pathname.match(/^\/loja-online\/([^/?#]+)/)
  if (!match) return null
  const section = resolveLojaOnlineAdminSection(match[1])
  if (!section) return 'Loja online'
  return getLojaOnlineAdminNavItem(section).label
}

export function isLojaOnlineAdminPath(pathname: string): boolean {
  return pathname === '/loja-online' || pathname.startsWith('/loja-online/')
}
