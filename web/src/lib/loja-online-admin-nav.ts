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
  Search,
  Megaphone,
  MessageCircle,
  Percent,
  Layers,
  LayoutDashboard,
  Users,
  Brain,
  Smartphone,
} from 'lucide-react'
import { createElement } from 'react'

export type LojaOnlineAdminSectionId =
  | 'dashboard'
  | 'inteligencia'
  | 'anuncios'
  | 'pedidos'
  | 'clientes'
  | 'envios'
  | 'publicacao'
  | 'seo'
  | 'aparencia'
  | 'cabecalho'
  | 'banners'
  | 'faixa'
  | 'catalogo'
  | 'contato'
  | 'institucional'
  | 'checkout'
  | 'ofertas'
  | 'orderbumps'
  | 'colecoes'
  | 'capas'
  | 'cupons'
  | 'entrega'
  | 'pagamentos'

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

export const LOJA_ONLINE_ADMIN_DEFAULT_SECTION: LojaOnlineAdminSectionId = 'dashboard'

/** URLs antigas continuam funcionando após reorganização. */
export const LOJA_ONLINE_ADMIN_LEGACY_TAB_MAP: Record<string, LojaOnlineAdminSectionId> = {
  vitrine: 'aparencia',
  visual: 'aparencia',
  rodape: 'institucional',
  marketing: 'seo',
  analytics: 'seo',
}

export const LOJA_ONLINE_ADMIN_NAV_GROUPS: LojaOnlineAdminNavGroup[] = [
  {
    label: 'Operação',
    items: [
      {
        id: 'dashboard',
        path: '/loja-online/dashboard',
        label: 'Dashboard',
        icon: icon(createElement(LayoutDashboard, { size: 18 })),
        intro: {
          title: 'Dashboard da loja',
          description: 'Acessos, vendas, conversão e saúde SEO da loja online.',
        },
        noSave: true,
      },
      {
        id: 'inteligencia',
        path: '/loja-online/inteligencia',
        label: 'Inteligência IA',
        icon: icon(createElement(Brain, { size: 18 })),
        intro: {
          title: 'Inteligência da loja',
          description:
            'Cliques, mapa de calor, abandono de carrinho, frete, fotos, regiões e idade — com diagnóstico profundo do ChatGPT.',
        },
        noSave: true,
      },
      {
        id: 'anuncios',
        path: '/loja-online/anuncios',
        label: 'Anúncios Meta',
        icon: icon(createElement(Megaphone, { size: 18 })),
        intro: {
          title: 'Anúncios Meta',
          description: 'Conecte o Gerenciador de Anúncios, escolha a conta e acompanhe campanhas e demografia.',
        },
        noSave: true,
      },
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
        id: 'clientes',
        path: '/loja-online/clientes',
        label: 'Clientes',
        icon: icon(createElement(Users, { size: 18 })),
        intro: {
          title: 'Clientes da loja online',
          description: 'Quem se cadastrou na vitrine: contato, pedidos e vínculo com o PDV.',
        },
        noSave: true,
      },
      {
        id: 'envios',
        path: '/loja-online/envios',
        label: 'Etiquetas e envios',
        icon: icon(createElement(Truck, { size: 18 })),
        intro: {
          title: 'Etiquetas e envios',
          description: 'Gere e imprima etiquetas PAC/SEDEX dos pedidos pagos, como na Shopee.',
        },
        noSave: true,
      },
    ],
  },
  {
    label: 'Loja',
    items: [
      {
        id: 'publicacao',
        path: '/loja-online/publicacao',
        label: 'Publicação',
        icon: icon(createElement(Globe, { size: 18 })),
        intro: {
          title: 'Publicação',
          description: 'Ative a loja, defina o endereço (subdomínio) e configure domínio próprio.',
        },
      },
      {
        id: 'seo',
        path: '/loja-online/seo',
        label: 'SEO e marketing',
        icon: icon(createElement(Search, { size: 18 })),
        intro: {
          title: 'SEO e marketing',
          description: 'Título e descrição para o Google, Analytics e Meta Pixel.',
        },
      },
    ],
  },
  {
    label: 'Aparência',
    items: [
      {
        id: 'aparencia',
        path: '/loja-online/aparencia',
        label: 'Identidade',
        icon: icon(createElement(Palette, { size: 18 })),
        intro: {
          title: 'Identidade visual',
          description: 'Nome da loja, descrição e cores principais da vitrine.',
        },
      },
      {
        id: 'cabecalho',
        path: '/loja-online/cabecalho',
        label: 'Cabeçalho',
        icon: icon(createElement(PanelTop, { size: 18 })),
        intro: {
          title: 'Cabeçalho',
          description: 'Modelo no celular, logo e cores do menu.',
        },
      },
      {
        id: 'banners',
        path: '/loja-online/banners',
        label: 'Banners',
        icon: icon(createElement(Image, { size: 18 })),
        intro: {
          title: 'Banners da vitrine',
          description: 'Carrossel principal: Banner Studio ou imagens prontas para desktop e celular.',
        },
      },
      {
        id: 'faixa',
        path: '/loja-online/faixa',
        label: 'Faixa de avisos',
        icon: icon(createElement(Megaphone, { size: 18 })),
        intro: {
          title: 'Faixa de avisos',
          description: 'Barra no topo da loja para cupons, frete grátis e promoções.',
        },
      },
      {
        id: 'catalogo',
        path: '/loja-online/catalogo',
        label: 'Catálogo',
        icon: icon(createElement(LayoutGrid, { size: 18 })),
        intro: {
          title: 'Catálogo',
          description: 'Modelo dos cards, colunas, preços e estoque na vitrine.',
        },
      },
    ],
  },
  {
    label: 'Conteúdo',
    items: [
      {
        id: 'contato',
        path: '/loja-online/contato',
        label: 'Contato',
        icon: icon(createElement(MessageCircle, { size: 18 })),
        intro: {
          title: 'Contato e redes',
          description: 'WhatsApp, botão flutuante, e-mail e redes sociais.',
        },
      },
      {
        id: 'institucional',
        path: '/loja-online/institucional',
        label: 'Rodapé e legais',
        icon: icon(createElement(FileText, { size: 18 })),
        intro: {
          title: 'Rodapé e páginas legais',
          description: 'Texto do rodapé, privacidade, termos, trocas e entrega.',
        },
      },
      {
        id: 'colecoes',
        path: '/loja-online/colecoes',
        label: 'Coleções',
        icon: icon(createElement(Layers, { size: 18 })),
        intro: {
          title: 'Coleções',
          description: 'Agrupe produtos em temas como Marvel, cristã ou católica, com foto de capa e produtos da coleção.',
        },
        noSave: true,
      },
      {
        id: 'capas',
        path: '/loja-online/capas',
        label: 'Capa personalizada',
        icon: icon(createElement(Smartphone, { size: 18 })),
        intro: {
          title: 'Capa personalizada',
          description:
            'O cliente monta a própria capa no editor e compra. Escolha os modelos visíveis, preço e estoque de cada um e baixe as artes dos pedidos.',
        },
        noSave: true,
      },
    ],
  },
  {
    label: 'Vendas',
    items: [
      {
        id: 'checkout',
        path: '/loja-online/checkout',
        label: 'Checkout',
        icon: icon(createElement(ShoppingBag, { size: 18 })),
        intro: {
          title: 'Checkout',
          description: 'Cadastro do cliente, cashback e mensagem após o pedido.',
        },
      },
      {
        id: 'ofertas',
        path: '/loja-online/ofertas',
        label: 'Ofertas no checkout',
        icon: icon(createElement(Percent, { size: 18 })),
        intro: {
          title: 'Ofertas no checkout',
          description: 'Faixa, cronômetro e banner de urgência antes do pagamento.',
        },
      },
      {
        id: 'orderbumps',
        path: '/loja-online/orderbumps',
        label: 'Order bump',
        icon: icon(createElement(Sparkles, { size: 18 })),
        intro: {
          title: 'Order bump',
          description: 'Produtos extras no checkout: ofertas fixas ou por produto do carrinho.',
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
          description: 'Códigos promocionais para o checkout.',
        },
        noSave: true,
      },
      {
        id: 'entrega',
        path: '/loja-online/entrega',
        label: 'Entrega e frete',
        icon: icon(createElement(Truck, { size: 18 })),
        intro: {
          title: 'Entrega e frete',
          description: 'Retirada, entrega, cálculo de frete e frete grátis.',
        },
      },
      {
        id: 'pagamentos',
        path: '/loja-online/pagamentos',
        label: 'Pagamentos',
        icon: icon(createElement(CreditCard, { size: 18 })),
        intro: {
          title: 'Pagamentos',
          description: 'Gateways e métodos aceitos no checkout.',
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
