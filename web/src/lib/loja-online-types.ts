import type { PagamentoMeioVenda } from './pagamento-meio'
import type { BannerStudioDocument } from './loja-online-banner-studio'
import { hasRestorableBannerStudio, isBannerStudioDocument } from './loja-online-banner-studio'

export type LojaOnlineFormaPagamento = 'manual' | 'asaas_pix' | 'mercadopago'

export type LojaOnlinePagamentoStatus = 'pendente' | 'pago' | 'cancelado' | 'na_entrega'

export type LojaOnlinePagamentosPublicos = {
  manual: boolean
  asaasPix: boolean
  mercadopago: boolean
  mercadopagoPublicKey: string | null
}

export type LojaOnlineBannerVariant = 'desktop' | 'mobile'

export type LojaOnlineBanner = {
  id: string
  imagem: string
  /** Arte exclusiva para celular. Se vazia, a vitrine reutiliza `imagem`. */
  imagemMobile?: string | null
  link?: string | null
  ordem?: number
  /** Tamanho/resolução usados no Banner Studio (desktop) */
  tamanho?: LojaOnlineBannerTamanho
  /** Tamanho/resolução do Banner Studio no celular */
  tamanhoMobile?: LojaOnlineBannerTamanho
  /** Projeto completo do Banner Studio (camadas, animações, dimensões) */
  studio?: BannerStudioDocument | null
  /** Projeto do Banner Studio na versão celular */
  studioMobile?: BannerStudioDocument | null
}

export type LojaOnlineFaixaAviso = {
  id: string
  texto: string
  link?: string | null
  ordem?: number
}

export type LojaOnlineFaixaEfeito = 'alternar' | 'correr'
export type LojaOnlineFaixaSentido = 'esquerda' | 'direita'
export type LojaOnlineFaixaVelocidade = 'lenta' | 'media' | 'rapida'

export type LojaOnlineFaixaConfig = {
  avisos: LojaOnlineFaixaAviso[]
  efeito: LojaOnlineFaixaEfeito
  sentido: LojaOnlineFaixaSentido
  velocidade: LojaOnlineFaixaVelocidade
  cor: string | null
}

export const LOJA_ONLINE_FAIXA_VELOCIDADE_PX_S: Record<LojaOnlineFaixaVelocidade, number> = {
  lenta: 45,
  media: 85,
  rapida: 140,
}

const LOJA_ONLINE_FAIXA_DEFAULT: Omit<LojaOnlineFaixaConfig, 'avisos'> = {
  efeito: 'correr',
  sentido: 'esquerda',
  velocidade: 'media',
  cor: null,
}

function normalizeFaixaCor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toLowerCase()
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const h = v.slice(1)
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase()
  }
  return null
}

function normalizeFaixaEfeito(value: unknown): LojaOnlineFaixaEfeito {
  return value === 'correr' ? 'correr' : 'alternar'
}

function normalizeFaixaSentido(value: unknown): LojaOnlineFaixaSentido {
  return value === 'direita' ? 'direita' : 'esquerda'
}

function normalizeFaixaVelocidade(value: unknown): LojaOnlineFaixaVelocidade {
  if (value === 'lenta' || value === 'rapida') return value
  return 'media'
}

function normalizeFaixaAvisosList(parsed: unknown): LojaOnlineFaixaAviso[] {
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((item, i) => {
      if (!item || typeof item !== 'object') return null
      const a = item as Record<string, unknown>
      const texto = typeof a.texto === 'string' ? a.texto.trim() : ''
      if (!texto) return null
      const link = typeof a.link === 'string' ? a.link.trim() : ''
      return {
        id: typeof a.id === 'string' && a.id ? a.id : `aviso-${i}`,
        texto,
        link: link || null,
        ordem: typeof a.ordem === 'number' ? a.ordem : i,
      }
    })
    .filter((a): a is LojaOnlineFaixaAviso => a != null)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
}

export type LojaOnlineBannerTamanho = 'pequeno' | 'medio' | 'grande'

export type LojaOnlineBannerSpec = {
  id: LojaOnlineBannerTamanho
  label: string
  description: string
  ratioLabel: string
  aspect: { w: number; h: number }
  recommendedPx: { width: number; height: number }
  maxHeightPx: number
}

export const LOJA_ONLINE_BANNER_TAMANHOS: LojaOnlineBannerSpec[] = [
  {
    id: 'pequeno',
    label: 'Pequeno',
    description: 'Faixa compacta no topo — ideal para avisos e promoções rápidas.',
    ratioLabel: '4:1',
    aspect: { w: 4, h: 1 },
    recommendedPx: { width: 1200, height: 300 },
    maxHeightPx: 160,
  },
  {
    id: 'medio',
    label: 'Médio',
    description: 'Tamanho padrão, equilíbrio entre destaque e espaço para produtos.',
    ratioLabel: '3:1',
    aspect: { w: 3, h: 1 },
    recommendedPx: { width: 1200, height: 400 },
    maxHeightPx: 320,
  },
  {
    id: 'grande',
    label: 'Grande',
    description: 'Banner em destaque, estilo vitrine de grandes lojas.',
    ratioLabel: '2:1',
    aspect: { w: 2, h: 1 },
    recommendedPx: { width: 1200, height: 600 },
    maxHeightPx: 480,
  },
]

/** Proporções verticais para celular — o recorte widescreen do desktop não serve no telefone. */
export const LOJA_ONLINE_BANNER_TAMANHOS_MOBILE: LojaOnlineBannerSpec[] = [
  {
    id: 'pequeno',
    label: 'Pequeno',
    description: 'Faixa compacta no celular — avisos e promoções rápidas.',
    ratioLabel: '16:9',
    aspect: { w: 16, h: 9 },
    recommendedPx: { width: 800, height: 450 },
    maxHeightPx: 180,
  },
  {
    id: 'medio',
    label: 'Médio',
    description: 'Tamanho padrão no celular, equilíbrio entre destaque e catálogo.',
    ratioLabel: '4:3',
    aspect: { w: 4, h: 3 },
    recommendedPx: { width: 800, height: 600 },
    maxHeightPx: 260,
  },
  {
    id: 'grande',
    label: 'Grande',
    description: 'Banner em destaque no celular, ocupa mais da tela.',
    ratioLabel: '1:1',
    aspect: { w: 1, h: 1 },
    recommendedPx: { width: 800, height: 800 },
    maxHeightPx: 360,
  },
]

const BANNER_TAMANHO_IDS = new Set<LojaOnlineBannerTamanho>(
  LOJA_ONLINE_BANNER_TAMANHOS.map((t) => t.id)
)

export function resolveLojaOnlineBannerTamanho(
  value: string | null | undefined
): LojaOnlineBannerTamanho {
  if (value && BANNER_TAMANHO_IDS.has(value as LojaOnlineBannerTamanho)) {
    return value as LojaOnlineBannerTamanho
  }
  return 'medio'
}

export function getLojaOnlineBannerSpec(
  tamanho: LojaOnlineBannerTamanho,
  variant: LojaOnlineBannerVariant = 'desktop'
): LojaOnlineBannerSpec {
  const list = variant === 'mobile' ? LOJA_ONLINE_BANNER_TAMANHOS_MOBILE : LOJA_ONLINE_BANNER_TAMANHOS
  return list.find((t) => t.id === tamanho) ?? list[1]
}

/** Escolhe arte, studio e tamanho do banner conforme o viewport. */
export function resolveLojaOnlineBannerForViewport(
  banner: LojaOnlineBanner,
  isMobile: boolean
): LojaOnlineBanner {
  if (!isMobile) return banner
  const studioMobile = hasRestorableBannerStudio(banner.studioMobile) ? banner.studioMobile : null
  if (studioMobile) {
    return {
      ...banner,
      imagem: banner.imagemMobile || banner.imagem,
      studio: studioMobile,
      tamanho: banner.tamanhoMobile ?? banner.tamanho,
    }
  }
  if (banner.imagemMobile) {
    return {
      ...banner,
      imagem: banner.imagemMobile,
      studio: null,
      tamanho: banner.tamanhoMobile ?? banner.tamanho,
    }
  }
  return banner
}

/** @deprecated Use getLojaOnlineBannerSpec('medio') */
export const LOJA_ONLINE_BANNER_ASPECT = LOJA_ONLINE_BANNER_TAMANHOS[1].aspect
/** @deprecated Use getLojaOnlineBannerSpec */
export const LOJA_ONLINE_BANNER_RATIO_LABEL = LOJA_ONLINE_BANNER_TAMANHOS[1].ratioLabel
/** @deprecated Use getLojaOnlineBannerSpec */
export const LOJA_ONLINE_BANNER_RECOMMENDED_PX = LOJA_ONLINE_BANNER_TAMANHOS[1].recommendedPx
/** @deprecated Use getLojaOnlineBannerSpec */
export const LOJA_ONLINE_BANNER_MAX_HEIGHT_PX = LOJA_ONLINE_BANNER_TAMANHOS[1].maxHeightPx

export type LojaOnlineStoreConfig = {
  empresa_id: string
  loja_online_slug: string | null
  loja_online_titulo: string | null
  loja_online_descricao: string | null
  loja_online_whatsapp: string | null
  loja_online_whatsapp_flutuante?: number | null
  loja_online_whatsapp_flutuante_msg?: string | null
  loja_online_mostrar_preco: number | null
  loja_online_ocultar_sem_estoque: number | null
  loja_online_banner: string | null
  loja_online_banners_json: string | null
  loja_online_banner_tamanho: string | null
  loja_online_banner_tamanho_mobile?: string | null
  loja_online_faixa_ativa: number | null
  loja_online_faixa_avisos_json: string | null
  loja_online_rodape_texto: string | null
  loja_online_instagram: string | null
  loja_online_facebook: string | null
  loja_online_email_contato: string | null
  loja_online_exigir_cadastro: number | null
  loja_online_permitir_retirada: number | null
  loja_online_permitir_entrega: number | null
  loja_online_mensagem_checkout: string | null
  loja_online_checkout_oferta_json?: string | null
  loja_online_pag_manual: number | null
  loja_online_pag_asaas: number | null
  loja_online_pag_mercadopago: number | null
  loja_online_mercadopago_public_key: string | null
  loja_online_mp_pronto: number | null
  loja_online_asaas_pronto: number | null
  loja_online_frete_tipo: string | null
  loja_online_frete_valor_fixo: number | null
  loja_online_frete_cep_origem: string | null
  loja_online_frete_peso_padrao: number | null
  loja_online_frete_gratis_ativo?: number | null
  loja_online_frete_gratis_minimo?: number | null
  loja_online_cashback_ativo: number | null
  loja_online_cor_primaria: string | null
  loja_online_cor_fundo: string | null
  loja_online_cor_header: string | null
  loja_online_cor_menu: string | null
  loja_online_categorias_titulo: string | null
  loja_online_cards_config_json: string | null
  loja_online_seo_titulo: string | null
  loja_online_seo_descricao: string | null
  loja_online_politica_privacidade: string | null
  loja_online_termos_uso: string | null
  loja_online_politica_trocas: string | null
  loja_online_politica_entrega: string | null
  loja_online_ga4_id: string | null
  loja_online_meta_pixel_id: string | null
  loja_online_dominio_custom: string | null
  loja_online_header_mobile: string | null
  loja_online_logo_header: string | null
  loja_online_logo_header_size: number | null
  logo: string | null
  cor_primaria: string | null
  telefone: string | null
  endereco: string | null
  empresas: { nome: string } | null
}

export type LojaOnlineCheckoutOferta = {
  banner: string | null
  faixaAtiva: boolean
  faixaTexto: string
  cronometroAtivo: boolean
  cronometroTexto: string
  cronometroMinutos: number
}

export const LOJA_ONLINE_CHECKOUT_OFERTA_DEFAULT: LojaOnlineCheckoutOferta = {
  banner: null,
  faixaAtiva: false,
  faixaTexto: 'Promoção especial',
  cronometroAtivo: false,
  cronometroTexto: 'Oferta termina em',
  cronometroMinutos: 15,
}

export function parseLojaOnlineCheckoutOferta(json: string | null | undefined): LojaOnlineCheckoutOferta {
  const base = { ...LOJA_ONLINE_CHECKOUT_OFERTA_DEFAULT }
  if (!json?.trim()) return base
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>
    const minutos = Number(parsed.cronometroMinutos)
    return {
      banner: typeof parsed.banner === 'string' && parsed.banner.trim() ? parsed.banner : null,
      faixaAtiva: parsed.faixaAtiva === true,
      faixaTexto: typeof parsed.faixaTexto === 'string' && parsed.faixaTexto.trim()
        ? parsed.faixaTexto.trim()
        : base.faixaTexto,
      cronometroAtivo: parsed.cronometroAtivo === true,
      cronometroTexto: typeof parsed.cronometroTexto === 'string' && parsed.cronometroTexto.trim()
        ? parsed.cronometroTexto.trim()
        : base.cronometroTexto,
      cronometroMinutos: Number.isFinite(minutos) && minutos > 0 ? Math.min(24 * 60, Math.round(minutos)) : 15,
    }
  } catch {
    return base
  }
}

export function serializeLojaOnlineCheckoutOferta(oferta: LojaOnlineCheckoutOferta): string {
  return JSON.stringify({
    banner: oferta.banner,
    faixaAtiva: oferta.faixaAtiva,
    faixaTexto: oferta.faixaTexto.trim() || LOJA_ONLINE_CHECKOUT_OFERTA_DEFAULT.faixaTexto,
    cronometroAtivo: oferta.cronometroAtivo,
    cronometroTexto: oferta.cronometroTexto.trim() || LOJA_ONLINE_CHECKOUT_OFERTA_DEFAULT.cronometroTexto,
    cronometroMinutos: oferta.cronometroMinutos,
  })
}

export type LojaOnlineProduto = {
  id: string
  empresa_id: string
  nome: string
  descricao: string | null
  imagem: string | null
  preco: number
  unidade: string
  estoque_atual: number
  controla_estoque: number
  categoria_id: string | null
  codigo: number | null
  marca_id?: string | null
  /** Preenchido quando a query inclui join `marcas(nome)` */
  marcas?: { nome: string } | null
  loja_online_destaque?: number
  loja_online_destaque_ordem?: number
  loja_online_imagens_json?: string | null
  loja_online_preco_de?: number | null
  loja_online_card_json?: string | null
}

export type LojaOnlineAvaliacao = {
  id: string
  empresa_id: string
  produto_id: string
  cliente_id: string | null
  cliente_nome: string
  nota: number
  comentario: string | null
  created_at: string
}

export type LojaOnlineCategoria = {
  id: string
  nome: string
  parent_id: string | null
  ordem: number
  path: string
  imagem?: string | null
  loja_online_subtitulo?: string | null
  loja_online_vitrine?: number
}

export type LojaOnlineCartItem = {
  produtoId: string
  nome: string
  preco: number
  unidade: string
  imagem: string | null
  quantidade: number
  controla_estoque?: number
  estoque_atual?: number
}

export type LojaOnlineClienteSession = {
  id: string
  empresa_id: string
  nome: string
  email: string
  telefone: string | null
  endereco: string | null
  cpf_cnpj: string | null
  cep: string | null
  cliente_pdv_id: string | null
}

export type LojaOnlineFreteTipo = 'fixo' | 'correios' | 'gratis'

export type LojaOnlineOpcaoFrete = {
  servico: string
  codigo: string
  nome: string
  valor: number
  prazo: number
}

export type LojaOnlineCupom = {
  id: string
  empresa_id: string
  codigo: string
  tipo: 'percentual' | 'fixo'
  valor: number
  valor_minimo: number
  uso_maximo: number | null
  usos_atual: number
  ativo: number
  valido_ate: string | null
  created_at: string
}

export type LojaOnlineOrderBumpTipo = 'fixo' | 'personalizado'

export type LojaOnlineOrderBump = {
  id: string
  empresa_id: string
  tipo: LojaOnlineOrderBumpTipo
  produto_id: string
  trigger_produto_id: string | null
  titulo: string | null
  descricao: string | null
  preco_especial: number | null
  ativo: number
  ordem: number
  created_at: string
  produto?: LojaOnlineProduto | null
  trigger_produto?: LojaOnlineProduto | null
}

export type LojaOnlineOrderBumpOferta = {
  bumpId: string
  tipo: LojaOnlineOrderBumpTipo
  titulo: string
  descricao: string | null
  preco: number
  precoOriginal: number | null
  produto: LojaOnlineProduto
}

export type LojaOnlineCupomValidado = {
  id: string
  codigo: string
  tipo: 'percentual' | 'fixo'
  valor: number
  desconto: number
}

export type LojaOnlineFavorito = {
  id: string
  empresa_id: string
  cliente_id: string
  produto_id: string
  created_at: string
  produto?: LojaOnlineProduto | null
}

export type LojaOnlinePedidoStatus = import('./loja-online-pedido-status').LojaOnlinePedidoStatus

export type LojaOnlinePedido = {
  id: string
  empresa_id: string
  cliente_id: string | null
  status: LojaOnlinePedidoStatus
  subtotal: number | null
  total: number
  valor_frete: number | null
  valor_desconto: number | null
  cashback_usado: number | null
  cupom_codigo: string | null
  cupom_id: string | null
  tipo_frete: string | null
  cep_destino: string | null
  observacoes: string | null
  endereco_entrega: string | null
  forma_entrega: 'retirada' | 'entrega' | null
  cliente_nome: string | null
  cliente_email: string | null
  cliente_telefone: string | null
  venda_id: string | null
  forma_pagamento: LojaOnlineFormaPagamento | null
  pagamento_status: LojaOnlinePagamentoStatus | null
  gateway_payment_id: string | null
  gateway_checkout_url: string | null
  pagamento_meio: PagamentoMeioVenda | null
  codigo_rastreio: string | null
  created_at: string
}

/** Pedido aguardando confirmação de pagamento online (PIX/cartão). */
export function pedidoAguardandoPagamentoOnline(pedido: {
  status: string
  forma_pagamento?: string | null
  pagamento_status?: string | null
}): boolean {
  if (pedido.status === 'cancelado' || pedido.status === 'pagamento_recusado' || pedido.status === 'reembolsado') {
    return false
  }
  if (pedido.status === 'aguardando_pagamento') return true
  if (pedido.pagamento_status === 'pago' || pedido.pagamento_status === 'na_entrega') return false
  const forma = pedido.forma_pagamento ?? 'manual'
  return forma === 'mercadopago' || forma === 'asaas_pix'
}

export {
  pedidoPrecisaAcaoAdmin,
  pedidoElegivelParaVenda,
  pedidoStatusEmAberto,
} from './loja-online-pedido-status'

export type LojaOnlinePedidoItem = {
  id: string
  pedido_id: string
  produto_id: string
  nome: string
  preco: number
  quantidade: number
  subtotal: number
  unidade: string
}

export type LojaOnlinePedidoItemComImagem = LojaOnlinePedidoItem & {
  imagem: string | null
}

export function parseLojaOnlineBanners(
  bannersJson: string | null | undefined,
  legacyBanner: string | null | undefined
): LojaOnlineBanner[] {
  if (bannersJson?.trim()) {
    try {
      const parsed = JSON.parse(bannersJson) as LojaOnlineBanner[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((b) => b?.imagem)
          .map((banner, index) => normalizeLojaOnlineBanner(banner, index))
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      }
    } catch {
      /* fallback */
    }
  }
  if (legacyBanner?.trim()) {
    return [{ id: 'legacy', imagem: legacyBanner, ordem: 0 }]
  }
  return []
}

function normalizeLojaOnlineBanner(banner: LojaOnlineBanner, index: number): LojaOnlineBanner {
  const studio = banner.studio && isBannerStudioDocument(banner.studio) ? banner.studio : null
  const studioMobile =
    banner.studioMobile && isBannerStudioDocument(banner.studioMobile) ? banner.studioMobile : null
  const tamanho =
    banner.tamanho ??
    studio?.tamanho ??
    undefined
  const tamanhoMobile =
    banner.tamanhoMobile ??
    studioMobile?.tamanho ??
    undefined
  const imagemMobile =
    typeof banner.imagemMobile === 'string' && banner.imagemMobile.trim()
      ? banner.imagemMobile
      : null
  return {
    id: banner.id || `banner-${index}`,
    imagem: banner.imagem,
    imagemMobile,
    link: banner.link?.trim() || null,
    ordem: banner.ordem ?? index,
    tamanho,
    tamanhoMobile,
    studio,
    studioMobile,
  }
}

export function parseLojaOnlineFaixaConfig(json: string | null | undefined): LojaOnlineFaixaConfig {
  if (!json?.trim()) return { avisos: [], ...LOJA_ONLINE_FAIXA_DEFAULT }
  try {
    const parsed = JSON.parse(json) as unknown
    if (Array.isArray(parsed)) {
      return { avisos: normalizeFaixaAvisosList(parsed), ...LOJA_ONLINE_FAIXA_DEFAULT }
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>
      const avisos = normalizeFaixaAvisosList(obj.avisos)
      return {
        avisos,
        efeito: normalizeFaixaEfeito(obj.efeito),
        sentido: normalizeFaixaSentido(obj.sentido),
        velocidade: normalizeFaixaVelocidade(obj.velocidade),
        cor: normalizeFaixaCor(obj.cor),
      }
    }
    return { avisos: [], ...LOJA_ONLINE_FAIXA_DEFAULT }
  } catch {
    return { avisos: [], ...LOJA_ONLINE_FAIXA_DEFAULT }
  }
}

export function parseLojaOnlineFaixaAvisos(json: string | null | undefined): LojaOnlineFaixaAviso[] {
  return parseLojaOnlineFaixaConfig(json).avisos
}

export function serializeLojaOnlineFaixaConfig(config: LojaOnlineFaixaConfig): string {
  return JSON.stringify({
    avisos: config.avisos
      .filter((a) => a.texto.trim())
      .map((a, i) => ({ ...a, texto: a.texto.trim(), ordem: i })),
    efeito: config.efeito,
    sentido: config.sentido,
    velocidade: config.velocidade,
    cor: config.cor,
  })
}

export function parseLojaOnlineImagens(
  imagensJson: string | null | undefined,
  imagemPrincipal: string | null | undefined
): string[] {
  const list: string[] = []
  if (imagensJson?.trim()) {
    try {
      const parsed = JSON.parse(imagensJson) as unknown
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string' && item.trim()) list.push(item.trim())
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (imagemPrincipal?.trim() && !list.includes(imagemPrincipal.trim())) {
    list.unshift(imagemPrincipal.trim())
  }
  return list
}

/** Imagens extras da loja online (sem repetir a imagem principal do sistema). */
export function parseLojaOnlineImagensExtras(
  imagensJson: string | null | undefined,
  imagemPrincipal?: string | null
): string[] {
  const main = imagemPrincipal?.trim() ?? ''
  const list: string[] = []
  if (imagensJson?.trim()) {
    try {
      const parsed = JSON.parse(imagensJson) as unknown
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string' && item.trim()) {
            const url = item.trim()
            if (!main || url !== main) list.push(url)
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
  return list
}

export function serializeLojaOnlineImagensExtras(
  imagens: string[],
  imagemPrincipal?: string | null
): string | null {
  const main = imagemPrincipal?.trim() ?? ''
  const list = imagens.map((s) => s.trim()).filter((s) => s && (!main || s !== main))
  return list.length > 0 ? JSON.stringify(list) : null
}

export type LojaOnlineProdutoCardMeta = {
  cores?: { nome: string; hex: string }[]
  armazenamentos?: string[]
  tamanhos?: string[]
  variacoes?: string[]
}

function parseStringArrayField(parsed: Record<string, unknown>, key: string): string[] | undefined {
  if (!Array.isArray(parsed[key])) return undefined
  const values = (parsed[key] as unknown[])
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
  return values.length ? values : undefined
}

export function parseLojaOnlineCardMeta(
  json: string | null | undefined
): LojaOnlineProdutoCardMeta | null {
  if (!json?.trim()) return null
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>
    const meta: LojaOnlineProdutoCardMeta = {}

    if (Array.isArray(parsed.cores)) {
      const cores = parsed.cores
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const row = item as Record<string, unknown>
          const nome = typeof row.nome === 'string' ? row.nome.trim() : ''
          const hex = typeof row.hex === 'string' ? row.hex.trim() : ''
          if (!nome || !hex) return null
          return { nome, hex }
        })
        .filter((item): item is { nome: string; hex: string } => !!item)
      if (cores.length) meta.cores = cores
    }

    const armazenamentos = parseStringArrayField(parsed, 'armazenamentos')
    if (armazenamentos) meta.armazenamentos = armazenamentos

    const tamanhos = parseStringArrayField(parsed, 'tamanhos')
    if (tamanhos) meta.tamanhos = tamanhos

    const variacoes = parseStringArrayField(parsed, 'variacoes')
    if (variacoes) meta.variacoes = variacoes

    return Object.keys(meta).length ? meta : null
  } catch {
    return null
  }
}

export function getLojaOnlineProdutoMarcaNome(produto: LojaOnlineProduto): string | null {
  const nested = produto.marcas?.nome?.trim()
  if (nested) return nested
  return null
}

export function cartItemSubtotal(item: LojaOnlineCartItem): number {
  return item.preco * item.quantidade
}

export function cartTotal(items: LojaOnlineCartItem[]): number {
  return items.reduce((sum, i) => sum + cartItemSubtotal(i), 0)
}

export function pedidoTotalLiquido(input: {
  subtotal: number
  valorFrete: number
  valorDesconto: number
  cashbackUsado: number
}): number {
  const raw = input.subtotal + input.valorFrete - input.valorDesconto - input.cashbackUsado
  return Math.max(0, Math.round(raw * 100) / 100)
}
