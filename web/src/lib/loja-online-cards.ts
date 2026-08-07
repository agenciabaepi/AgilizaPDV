export type LojaOnlineCardSlot = 'produto' | 'categoria'

export type LojaOnlineCardTemplateId =
  | 'galaxy'
  | 'minimal'
  | 'classic'
  | 'eco'
  | 'compact'
  | 'banner'

export type LojaOnlineCardTemplateSpec = {
  id: LojaOnlineCardTemplateId
  label: string
  description: string
  /** Disponível para seleção na loja (demais aparecem como "Em breve") */
  available: boolean
  previewCorFundo: string
  previewCorCta: string
}

export type LojaOnlineCardStyleConfig = {
  template: LojaOnlineCardTemplateId
  corFundo: string
  corCta: string
}

export type LojaOnlineCatalogoColunas = 2 | 3 | 4

export type LojaOnlineCardsConfig = {
  v: 1
  produto: LojaOnlineCardStyleConfig
  categoria: LojaOnlineCardStyleConfig
  /** Colunas do grid de produtos no catálogo (desktop) */
  catalogoColunas: LojaOnlineCatalogoColunas
}

export const LOJA_ONLINE_CATALOGO_COLUNAS_PADRAO: LojaOnlineCatalogoColunas = 4

export const LOJA_ONLINE_CATALOGO_COLUNAS_OPCOES: {
  value: LojaOnlineCatalogoColunas
  label: string
  hint: string
}[] = [
  { value: 2, label: '2 por linha', hint: 'Cards maiores, ideal para poucos produtos' },
  { value: 3, label: '3 por linha', hint: 'Equilíbrio entre tamanho e quantidade' },
  { value: 4, label: '4 por linha', hint: 'Estilo vitrine compacta (Samsung)' },
]

export const LOJA_ONLINE_CARD_COR_FUNDO_PADRAO = '#f5f5f5'
export const LOJA_ONLINE_CARD_COR_CTA_PADRAO = '#000000'
export const LOJA_ONLINE_CARD_CATEGORIA_COR_FUNDO_PADRAO = '#ffffff'

export const LOJA_ONLINE_CARD_CORES_FUNDO_PRESET = [
  '#f5f5f5',
  '#ffffff',
  '#eef2ff',
  '#fef3c7',
  '#ecfdf5',
  '#fce7f3',
  '#1a1a1a',
] as const

export const LOJA_ONLINE_CARD_CORES_CTA_PRESET = [
  '#000000',
  '#1d4ed8',
  '#059669',
  '#dc2626',
  '#7c3aed',
  '#ffffff',
] as const

export const LOJA_ONLINE_CARD_TEMPLATES: Record<LojaOnlineCardSlot, LojaOnlineCardTemplateSpec[]> = {
  produto: [
    {
      id: 'galaxy',
      label: 'Galaxy',
      description: 'Catálogo e carrossel Destaques da semana — preço, parcelas e botão Comprar.',
      available: true,
      previewCorFundo: '#f5f5f5',
      previewCorCta: '#000000',
    },
    {
      id: 'minimal',
      label: 'Minimal',
      description: 'Visual limpo, sem fundo — ideal para catálogos premium.',
      available: false,
      previewCorFundo: '#ffffff',
      previewCorCta: '#000000',
    },
    {
      id: 'classic',
      label: 'Classic',
      description: 'Borda sutil e sombra leve, estilo e-commerce tradicional.',
      available: false,
      previewCorFundo: '#ffffff',
      previewCorCta: '#1d4ed8',
    },
  ],
  categoria: [
    {
      id: 'eco',
      label: 'Eco',
      description: 'Imagem centralizada, subtítulo e botão Comprar.',
      available: true,
      previewCorFundo: '#ffffff',
      previewCorCta: '#000000',
    },
    {
      id: 'compact',
      label: 'Compact',
      description: 'Cards menores em fileira — mais categorias visíveis.',
      available: false,
      previewCorFundo: '#f5f5f5',
      previewCorCta: '#000000',
    },
    {
      id: 'banner',
      label: 'Banner',
      description: 'Imagem em destaque com overlay de texto.',
      available: false,
      previewCorFundo: '#eef2ff',
      previewCorCta: '#000000',
    },
  ],
}

function allowedTemplatesForSlot(slot: LojaOnlineCardSlot): Set<string> {
  return new Set(LOJA_ONLINE_CARD_TEMPLATES[slot].map((t) => t.id))
}

const PRODUTO_TEMPLATES = allowedTemplatesForSlot('produto')
const CATEGORIA_TEMPLATES = allowedTemplatesForSlot('categoria')

export function defaultLojaOnlineCardsConfig(): LojaOnlineCardsConfig {
  return {
    v: 1,
    produto: {
      template: 'galaxy',
      corFundo: LOJA_ONLINE_CARD_COR_FUNDO_PADRAO,
      corCta: LOJA_ONLINE_CARD_COR_CTA_PADRAO,
    },
    categoria: {
      template: 'eco',
      corFundo: LOJA_ONLINE_CARD_CATEGORIA_COR_FUNDO_PADRAO,
      corCta: LOJA_ONLINE_CARD_COR_CTA_PADRAO,
    },
    catalogoColunas: LOJA_ONLINE_CATALOGO_COLUNAS_PADRAO,
  }
}

function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const v = value.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toLowerCase()
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const h = v.slice(1)
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase()
  }
  return fallback
}

function normalizeTemplate(
  value: unknown,
  allowed: Set<string>,
  fallback: LojaOnlineCardTemplateId
): LojaOnlineCardTemplateId {
  if (typeof value === 'string' && allowed.has(value)) {
    return value as LojaOnlineCardTemplateId
  }
  return fallback
}

function normalizeSlot(
  raw: unknown,
  slot: LojaOnlineCardSlot,
  defaults: LojaOnlineCardStyleConfig
): LojaOnlineCardStyleConfig {
  const allowed = slot === 'produto' ? PRODUTO_TEMPLATES : CATEGORIA_TEMPLATES
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const template = normalizeTemplate(row.template, allowed, defaults.template)
  const spec = LOJA_ONLINE_CARD_TEMPLATES[slot].find((t) => t.id === template)
  const resolvedTemplate = spec?.available ? template : defaults.template
  return {
    template: resolvedTemplate,
    corFundo: normalizeHex(row.corFundo, defaults.corFundo),
    corCta: normalizeHex(row.corCta, defaults.corCta),
  }
}

function normalizeCatalogoColunas(
  value: unknown,
  fallback: LojaOnlineCatalogoColunas
): LojaOnlineCatalogoColunas {
  const n = Number(value)
  if (n === 2 || n === 3 || n === 4) return n
  return fallback
}

export function parseLojaOnlineCardsConfig(
  json: string | null | undefined
): LojaOnlineCardsConfig {
  const defaults = defaultLojaOnlineCardsConfig()
  if (!json?.trim()) return defaults
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>
    return {
      v: 1,
      produto: normalizeSlot(parsed.produto, 'produto', defaults.produto),
      categoria: normalizeSlot(parsed.categoria, 'categoria', defaults.categoria),
      catalogoColunas: normalizeCatalogoColunas(parsed.catalogoColunas, defaults.catalogoColunas),
    }
  } catch {
    return defaults
  }
}

export function serializeLojaOnlineCardsConfig(config: LojaOnlineCardsConfig): string {
  return JSON.stringify(config)
}

export function getLojaOnlineCardTemplateSpec(
  slot: LojaOnlineCardSlot,
  templateId: LojaOnlineCardTemplateId
): LojaOnlineCardTemplateSpec | undefined {
  return LOJA_ONLINE_CARD_TEMPLATES[slot].find((t) => t.id === templateId)
}

export function lojaOnlineCardsCssVars(config: LojaOnlineCardsConfig): Record<string, string> {
  return {
    '--loja-card-produto-cor': config.produto.corFundo,
    '--loja-card-produto-cta': config.produto.corCta,
    '--loja-card-categoria-cor': config.categoria.corFundo,
    '--loja-card-categoria-cta': config.categoria.corCta,
    '--loja-catalogo-colunas': String(config.catalogoColunas),
  }
}
