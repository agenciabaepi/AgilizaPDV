import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Card, CardHeader, CardBody, Button, Input, Alert } from '../components/ui'
import {
  Globe,
  Save,
  ExternalLink,
  Upload,
  X,
  Image,
  Eye,
  LayoutTemplate,
  ShoppingBag,
  PanelBottom,
  CreditCard,
  Tag,
  Megaphone,
  MessageCircle,
  Percent,
  Plus,
  Palette,
  Truck,
  LayoutGrid,
  FileText,
  Search,
  BarChart3,
  Sparkles,
  Pencil,
  Copy,
  Check,
  RefreshCw,
  Monitor,
  Smartphone,
} from 'lucide-react'
import type { EmpresaConfig, UpdateEmpresaConfigInput } from '../vite-env'
import type { LojaOnlineBanner, LojaOnlineFaixaAviso, LojaOnlineBannerTamanho, LojaOnlineBannerVariant, LojaOnlineFaixaEfeito, LojaOnlineFaixaSentido, LojaOnlineFaixaVelocidade } from '../lib/loja-online-types'
import {
  LOJA_ONLINE_BANNER_TAMANHOS,
  LOJA_ONLINE_BANNER_TAMANHOS_MOBILE,
  getLojaOnlineBannerSpec,
  parseLojaOnlineBanners,
  parseLojaOnlineFaixaConfig,
  serializeLojaOnlineFaixaConfig,
  parseLojaOnlineCheckoutOferta,
  serializeLojaOnlineCheckoutOferta,
  LOJA_ONLINE_CHECKOUT_OFERTA_DEFAULT,
  resolveLojaOnlineBannerTamanho,
} from '../lib/loja-online-types'
import {
  LOJA_ONLINE_DOMAIN,
  LOJA_ONLINE_CNAME_TARGET,
  LOJA_ONLINE_APEX_A_RECORD,
  normalizeLojaOnlineSlug,
  validateLojaOnlineSlug,
  normalizeLojaOnlineCustomDomain,
  validateLojaOnlineCustomDomain,
  getLojaOnlineSubdomainUrl,
  getLojaOnlineCustomDomainUrl,
  getLojaOnlineCustomDomainDns,
  getLojaOnlinePathUrl,
  LOJA_ONLINE_CORES_PRESET,
  LOJA_ONLINE_CORES_FUNDO_PRESET,
  LOJA_ONLINE_COR_FUNDO_PADRAO,
  LOJA_ONLINE_COR_HEADER_PADRAO,
  LOJA_ONLINE_COR_MENU_PADRAO,
  normalizeLojaOnlineHexColor,
} from '../lib/loja-online'
import { LojaOnlinePedidosAdmin } from './LojaOnlinePedidosAdmin'
import { LojaOnlineCuponsAdmin } from './LojaOnlineCuponsAdmin'
import { LojaOnlineOrderBumpsAdmin } from './LojaOnlineOrderBumpsAdmin'
import { BannerStudioModal, type BannerStudioSavePayload } from '../components/loja-online/BannerStudioModal'
import {
  estimateBannerJsonBytes,
  formatBannerDimensions,
  formatBannerJsonLimitLabel,
  LOJA_ONLINE_BANNERS_JSON_MAX_BYTES,
} from '../lib/loja-online-banner-studio'
import {
  defaultLojaOnlineCardsConfig,
  LOJA_ONLINE_CATALOGO_COLUNAS_OPCOES,
  parseLojaOnlineCardsConfig,
  serializeLojaOnlineCardsConfig,
  type LojaOnlineCardsConfig,
} from '../lib/loja-online-cards'
import { LojaOnlineCardsConfigEditor } from '../components/loja-online/LojaOnlineCardsConfigEditor'
import { LojaOnlineHeaderMobileEditor } from '../components/loja-online/LojaOnlineHeaderMobileEditor'
import {
  parseLojaOnlineHeaderMobile,
  parseLojaOnlineLogoHeaderSize,
  LOJA_ONLINE_LOGO_HEADER_SIZE_PADRAO,
  type LojaOnlineHeaderMobileId,
} from '../lib/loja-online-header'
import { expandStudioFromTransfer } from '@banner-root/features/editor/services/studio-transfer.helpers'
import {
  LOJA_ONLINE_ADMIN_DEFAULT_SECTION,
  getLojaOnlineAdminNavItem,
  resolveLojaOnlineAdminSection,
  type LojaOnlineAdminSectionId,
} from '../lib/loja-online-admin-nav'
import {
  fetchLojaOnlineDominioStatus,
  syncLojaOnlineCustomDomain,
  type LojaOnlineDominioStatus,
} from '../lib/loja-online-dominio-api'

function LojaAdminSectionIntro({ section }: { section: LojaOnlineAdminSectionId }) {
  const intro = getLojaOnlineAdminNavItem(section).intro
  return (
    <div className="loja-admin-tab-intro">
      <h2>{intro.title}</h2>
      <p>{intro.description}</p>
    </div>
  )
}

function readImageFile(file: File, maxKb: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Arquivo inválido'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const data = reader.result as string
      if (data.length > maxKb * 1024) reject(new Error(`Imagem muito grande. Use até ${maxKb}KB.`))
      else resolve(data)
    }
    reader.onerror = () => reject(new Error('Erro ao ler imagem'))
    reader.readAsDataURL(file)
  })
}

function mpCredentialMode(value: string): 'test' | 'live' | null {
  const v = value.trim()
  if (v.startsWith('TEST-')) return 'test'
  if (v.startsWith('APP_USR-')) return 'live'
  return null
}

function mpAmbienteLabel(mode: 'test' | 'live' | null): string {
  if (mode === 'test') return 'Teste (TEST-...)'
  if (mode === 'live') return 'Produção (APP_USR-...)'
  return 'Não identificado'
}

export function LojaOnlineConfig() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { section: sectionParam } = useParams<{ section: string }>()
  const empresaId = session && 'empresa_id' in session ? session.empresa_id : null
  const isAdmin = session && 'role' in session && session.role?.toLowerCase() === 'admin'

  const section =
    resolveLojaOnlineAdminSection(sectionParam) ?? LOJA_ONLINE_ADMIN_DEFAULT_SECTION
  const [config, setConfig] = useState<EmpresaConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [ativa, setAtiva] = useState(false)
  const [slug, setSlug] = useState('')
  const [slugError, setSlugError] = useState<string | null>(null)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [banners, setBanners] = useState<LojaOnlineBanner[]>([])
  const [bannerTamanho, setBannerTamanho] = useState<LojaOnlineBannerTamanho>('medio')
  const [bannerTamanhoMobile, setBannerTamanhoMobile] = useState<LojaOnlineBannerTamanho>('medio')
  const [faixaAtiva, setFaixaAtiva] = useState(false)
  const [faixaAvisos, setFaixaAvisos] = useState<LojaOnlineFaixaAviso[]>([])
  const [faixaEfeito, setFaixaEfeito] = useState<LojaOnlineFaixaEfeito>('correr')
  const [faixaSentido, setFaixaSentido] = useState<LojaOnlineFaixaSentido>('esquerda')
  const [faixaVelocidade, setFaixaVelocidade] = useState<LojaOnlineFaixaVelocidade>('media')
  const [faixaCor, setFaixaCor] = useState('#1d4ed8')
  const [corPrimaria, setCorPrimaria] = useState('#1d4ed8')
  const [corFundo, setCorFundo] = useState(LOJA_ONLINE_COR_FUNDO_PADRAO)
  const [categoriasTitulo, setCategoriasTitulo] = useState('')
  const [cardsConfig, setCardsConfig] = useState<LojaOnlineCardsConfig>(() => defaultLojaOnlineCardsConfig())
  const [headerMobile, setHeaderMobile] = useState<LojaOnlineHeaderMobileId>('classic')
  const [corHeader, setCorHeader] = useState(LOJA_ONLINE_COR_HEADER_PADRAO)
  const [corMenu, setCorMenu] = useState(LOJA_ONLINE_COR_MENU_PADRAO)
  const [logoHeader, setLogoHeader] = useState<string | null>(null)
  const [logoHeaderSize, setLogoHeaderSize] = useState(LOJA_ONLINE_LOGO_HEADER_SIZE_PADRAO)
  const [seoTitulo, setSeoTitulo] = useState('')
  const [seoDescricao, setSeoDescricao] = useState('')
  const [politicaPrivacidade, setPoliticaPrivacidade] = useState('')
  const [termosUso, setTermosUso] = useState('')
  const [politicaTrocas, setPoliticaTrocas] = useState('')
  const [politicaEntrega, setPoliticaEntrega] = useState('')
  const [ga4Id, setGa4Id] = useState('')
  const [metaPixelId, setMetaPixelId] = useState('')
  const [dominioCustom, setDominioCustom] = useState('')
  const [dominioError, setDominioError] = useState<string | null>(null)
  const [dominioStatus, setDominioStatus] = useState<LojaOnlineDominioStatus | null>(null)
  const [checkingDominio, setCheckingDominio] = useState(false)
  const [copiedDns, setCopiedDns] = useState<string | null>(null)
  const [rodapeTexto, setRodapeTexto] = useState('')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [emailContato, setEmailContato] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [whatsappFlutuante, setWhatsappFlutuante] = useState(false)
  const [whatsappFlutuanteMsg, setWhatsappFlutuanteMsg] = useState('')
  const [mostrarPreco, setMostrarPreco] = useState(true)
  const [ocultarSemEstoque, setOcultarSemEstoque] = useState(false)
  const [exigirCadastro, setExigirCadastro] = useState(true)
  const [permitirRetirada, setPermitirRetirada] = useState(true)
  const [permitirEntrega, setPermitirEntrega] = useState(true)
  const [mensagemCheckout, setMensagemCheckout] = useState('')
  const [checkoutOferta, setCheckoutOferta] = useState(LOJA_ONLINE_CHECKOUT_OFERTA_DEFAULT)
  const [freteTipo, setFreteTipo] = useState<'fixo' | 'correios' | 'gratis'>('fixo')
  const [freteValorFixo, setFreteValorFixo] = useState('0')
  const [freteCepOrigem, setFreteCepOrigem] = useState('')
  const [fretePesoPadrao, setFretePesoPadrao] = useState('0.3')
  const [freteGratisAtivo, setFreteGratisAtivo] = useState(false)
  const [freteGratisMinimo, setFreteGratisMinimo] = useState('100')
  const [melhorEnvioToken, setMelhorEnvioToken] = useState('')
  const [melhorEnvioTokenConfigured, setMelhorEnvioTokenConfigured] = useState(false)
  const [melhorEnvioSandbox, setMelhorEnvioSandbox] = useState(false)
  const [cashbackAtivo, setCashbackAtivo] = useState(false)
  const [pagManual, setPagManual] = useState(true)
  const [pagAsaas, setPagAsaas] = useState(false)
  const [asaasApiKey, setAsaasApiKey] = useState('')
  const [asaasKeyConfigured, setAsaasKeyConfigured] = useState(false)
  const [asaasSandbox, setAsaasSandbox] = useState(false)
  const [pagMercadopago, setPagMercadopago] = useState(false)
  const [mpPublicKey, setMpPublicKey] = useState('')
  const [mpAccessToken, setMpAccessToken] = useState('')
  const [mpTokenConfigured, setMpTokenConfigured] = useState(false)
  const [bannerStudioOpen, setBannerStudioOpen] = useState(false)
  const [bannerStudioEditId, setBannerStudioEditId] = useState<string | null>(null)
  const [bannerStudioVariant, setBannerStudioVariant] = useState<LojaOnlineBannerVariant>('desktop')

  useEffect(() => {
    if (!sectionParam || !resolveLojaOnlineAdminSection(sectionParam)) {
      navigate(`/loja-online/${LOJA_ONLINE_ADMIN_DEFAULT_SECTION}`, { replace: true })
    }
  }, [sectionParam, navigate])

  const loadConfig = useCallback(() => {
    if (!empresaId) {
      setConfig(null)
      return
    }
    setLoading(true)
    window.electronAPI.empresas
      .getConfig(empresaId)
      .then((c) => {
        setConfig(c ?? null)
        if (c) {
          setAtiva(!!c.loja_online_ativa)
          setSlug(c.loja_online_slug ?? '')
          setTitulo(c.loja_online_titulo ?? '')
          setDescricao(c.loja_online_descricao ?? '')
          setBanners(parseLojaOnlineBanners(c.loja_online_banners_json, c.loja_online_banner))
          setBannerTamanho(resolveLojaOnlineBannerTamanho(c.loja_online_banner_tamanho))
          setBannerTamanhoMobile(resolveLojaOnlineBannerTamanho(c.loja_online_banner_tamanho_mobile))
          setFaixaAtiva(c.loja_online_faixa_ativa === 1)
          const faixa = parseLojaOnlineFaixaConfig(c.loja_online_faixa_avisos_json)
          setFaixaAvisos(faixa.avisos)
          setFaixaEfeito(faixa.efeito)
          setFaixaSentido(faixa.sentido)
          setFaixaVelocidade(faixa.velocidade)
          setFaixaCor(
            faixa.cor ??
              normalizeLojaOnlineHexColor(
                c.loja_online_cor_primaria ?? c.cor_primaria ?? '#1d4ed8'
              )
          )
          setCorPrimaria(
            normalizeLojaOnlineHexColor(
              c.loja_online_cor_primaria ?? c.cor_primaria ?? '#1d4ed8'
            )
          )
          setCorFundo(
            normalizeLojaOnlineHexColor(
              c.loja_online_cor_fundo ?? LOJA_ONLINE_COR_FUNDO_PADRAO,
              LOJA_ONLINE_COR_FUNDO_PADRAO
            )
          )
          setCategoriasTitulo(c.loja_online_categorias_titulo ?? '')
          setCardsConfig(parseLojaOnlineCardsConfig(c.loja_online_cards_config_json))
          setHeaderMobile(parseLojaOnlineHeaderMobile(c.loja_online_header_mobile))
          setCorHeader(
            normalizeLojaOnlineHexColor(
              c.loja_online_cor_header ?? LOJA_ONLINE_COR_HEADER_PADRAO,
              LOJA_ONLINE_COR_HEADER_PADRAO
            )
          )
          setCorMenu(
            normalizeLojaOnlineHexColor(
              c.loja_online_cor_menu ?? LOJA_ONLINE_COR_MENU_PADRAO,
              LOJA_ONLINE_COR_MENU_PADRAO
            )
          )
          setLogoHeader(c.loja_online_logo_header?.trim() || null)
          setLogoHeaderSize(parseLojaOnlineLogoHeaderSize(c.loja_online_logo_header_size))
          setSeoTitulo(c.loja_online_seo_titulo ?? '')
          setSeoDescricao(c.loja_online_seo_descricao ?? '')
          setPoliticaPrivacidade(c.loja_online_politica_privacidade ?? '')
          setTermosUso(c.loja_online_termos_uso ?? '')
          setPoliticaTrocas(c.loja_online_politica_trocas ?? '')
          setPoliticaEntrega(c.loja_online_politica_entrega ?? '')
          setGa4Id(c.loja_online_ga4_id ?? '')
          setMetaPixelId(c.loja_online_meta_pixel_id ?? '')
          setDominioCustom(c.loja_online_dominio_custom ?? '')
          setDominioError(null)
          setRodapeTexto(c.loja_online_rodape_texto ?? '')
          setInstagram(c.loja_online_instagram ?? '')
          setFacebook(c.loja_online_facebook ?? '')
          setEmailContato(c.loja_online_email_contato ?? '')
          setWhatsapp(c.loja_online_whatsapp ?? '')
          setWhatsappFlutuante(c.loja_online_whatsapp_flutuante === 1)
          setWhatsappFlutuanteMsg(c.loja_online_whatsapp_flutuante_msg ?? '')
          setMostrarPreco(c.loja_online_mostrar_preco !== 0)
          setOcultarSemEstoque(!!c.loja_online_ocultar_sem_estoque)
          setExigirCadastro(c.loja_online_exigir_cadastro !== 0)
          setPermitirRetirada(c.loja_online_permitir_retirada !== 0)
          setPermitirEntrega(c.loja_online_permitir_entrega !== 0)
          setMensagemCheckout(c.loja_online_mensagem_checkout ?? '')
          setCheckoutOferta(parseLojaOnlineCheckoutOferta(c.loja_online_checkout_oferta_json))
          setFreteTipo((c.loja_online_frete_tipo as 'fixo' | 'correios' | 'gratis') ?? 'fixo')
          setFreteValorFixo(String(c.loja_online_frete_valor_fixo ?? 0))
          setFreteCepOrigem(c.loja_online_frete_cep_origem ?? '')
          setFretePesoPadrao(String(c.loja_online_frete_peso_padrao ?? 0.3))
          setFreteGratisAtivo(c.loja_online_frete_gratis_ativo === 1)
          {
            const min = Number(c.loja_online_frete_gratis_minimo)
            setFreteGratisMinimo(String(min > 0 ? min : 100))
          }
          setMelhorEnvioTokenConfigured(!!c.loja_online_melhor_envio_token)
          setMelhorEnvioToken('')
          setMelhorEnvioSandbox(c.loja_online_melhor_envio_sandbox === 1)
          setCashbackAtivo(c.loja_online_cashback_ativo === 1)
          setPagManual(c.loja_online_pag_manual !== 0)
          setPagAsaas(c.loja_online_pag_asaas === 1)
          setAsaasKeyConfigured(!!c.loja_online_asaas_api_key)
          setAsaasApiKey('')
          setAsaasSandbox(c.loja_online_asaas_sandbox === 1)
          setPagMercadopago(c.loja_online_pag_mercadopago === 1)
          setMpPublicKey(c.loja_online_mercadopago_public_key ?? '')
          setMpTokenConfigured(!!c.loja_online_mercadopago_access_token)
          setMpAccessToken('')
        }
      })
      .catch(() => setConfig(null))
      .finally(() => setLoading(false))
  }, [empresaId])

  useEffect(() => {
    if (!isAdmin || !empresaId) {
      navigate('/dashboard', { replace: true })
      return
    }
    loadConfig()
  }, [isAdmin, empresaId, navigate, loadConfig])

  useEffect(() => {
    const saved = config?.loja_online_dominio_custom?.trim()
    if (!saved) {
      setDominioStatus(null)
      return
    }
    void checkDominioDns(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- verifica só o domínio já salvo
  }, [config?.loja_online_dominio_custom])

  const handleSlugChange = (value: string) => {
    const normalized = normalizeLojaOnlineSlug(value)
    setSlug(normalized)
    setSlugError(normalized ? validateLojaOnlineSlug(normalized) : null)
  }

  const handleDominioChange = (value: string) => {
    setDominioCustom(value)
    setDominioError(value.trim() ? validateLojaOnlineCustomDomain(value) : null)
  }

  const checkDominioDns = async (domain: string) => {
    const normalized = normalizeLojaOnlineCustomDomain(domain)
    if (!normalized) {
      setDominioStatus(null)
      return
    }
    setCheckingDominio(true)
    try {
      setDominioStatus(await fetchLojaOnlineDominioStatus(normalized))
    } catch {
      setDominioStatus(null)
    } finally {
      setCheckingDominio(false)
    }
  }

  const copyDnsValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedDns(value)
      window.setTimeout(() => setCopiedDns(null), 1500)
    } catch {
      setCopiedDns(null)
    }
  }

  const addBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const imagem = await readImageFile(file, 1200)
      setBanners((prev) => [
        ...prev,
        { id: crypto.randomUUID(), imagem, ordem: prev.length },
      ])
      setMessage(null)
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro no upload.' })
    }
    e.target.value = ''
  }

  const openBannerStudio = (editId?: string, variant: LojaOnlineBannerVariant = 'desktop') => {
    setBannerStudioEditId(editId ?? null)
    setBannerStudioVariant(variant)
    setBannerStudioOpen(true)
  }

  const setBannerMobileImage = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const imagemMobile = await readImageFile(file, 1200)
      const nextBanners = banners.map((b) =>
        b.id === id ? { ...b, imagemMobile, studioMobile: null } : b
      )
      if (estimateBannerJsonBytes(nextBanners) > LOJA_ONLINE_BANNERS_JSON_MAX_BYTES) {
        setMessage({
          type: 'error',
          text: `Os banners excedem o limite de ${formatBannerJsonLimitLabel()}. Reduza imagens ou remova banners antigos.`,
        })
      } else {
        setBanners(nextBanners)
        setMessage(null)
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro no upload.' })
    }
    e.target.value = ''
  }

  const clearBannerMobileImage = (id: string) => {
    setBanners((prev) =>
      prev.map((b) => (b.id === id ? { ...b, imagemMobile: null, studioMobile: null } : b))
    )
  }

  const handleBannerStudioSave = (payload: BannerStudioSavePayload) => {
    const studioForDb = expandStudioFromTransfer(payload.studio, payload.imagem)
    const existing = bannerStudioEditId ? banners.find((b) => b.id === bannerStudioEditId) : undefined
    const isMobile = payload.variant === 'mobile'
    if (isMobile && !existing) {
      setMessage({
        type: 'error',
        text: 'Crie o banner no computador antes de adicionar a versão do celular.',
      })
      return
    }
    const nextBanner: LojaOnlineBanner = isMobile
      ? {
          id: existing?.id ?? crypto.randomUUID(),
          imagem: existing?.imagem ?? payload.imagem,
          imagemMobile: payload.imagem,
          ordem: existing?.ordem ?? banners.length,
          tamanho: existing?.tamanho,
          tamanhoMobile: payload.tamanho,
          studio: existing?.studio ?? null,
          studioMobile: studioForDb,
          link: existing?.link ?? null,
        }
      : {
          id: existing?.id ?? crypto.randomUUID(),
          imagem: payload.imagem,
          imagemMobile: existing?.imagemMobile ?? null,
          ordem: existing?.ordem ?? banners.length,
          tamanho: payload.tamanho,
          tamanhoMobile: existing?.tamanhoMobile,
          studio: studioForDb,
          studioMobile: existing?.studioMobile ?? null,
          link: existing?.link ?? null,
        }

    const nextBanners = existing
      ? banners.map((b) => (b.id === existing.id ? { ...b, ...nextBanner } : b))
      : [...banners, nextBanner]

    if (estimateBannerJsonBytes(nextBanners) > LOJA_ONLINE_BANNERS_JSON_MAX_BYTES) {
      setMessage({
        type: 'error',
        text: `Os banners excedem o limite de ${formatBannerJsonLimitLabel()}. Reduza imagens ou remova banners antigos.`,
      })
      return
    }

    setBanners(nextBanners)
    setMessage({
      type: 'success',
      text: 'Banner atualizado. Clique em "Salvar loja online" para publicar no site.',
    })
    setBannerStudioEditId(null)
  }

  const handleSave = async () => {
    if (!empresaId) return
    const normalizedSlug = slug.trim() ? normalizeLojaOnlineSlug(slug) : ''
    const err = normalizedSlug ? validateLojaOnlineSlug(normalizedSlug) : null
    if (ativa && !normalizedSlug) {
      setMessage({ type: 'error', text: 'Informe o endereço da loja para publicar.' })
      return
    }
    if (err) {
      setSlugError(err)
      setMessage({ type: 'error', text: err })
      return
    }

    const normalizedDomain = dominioCustom.trim()
      ? normalizeLojaOnlineCustomDomain(dominioCustom)
      : null
    if (dominioCustom.trim()) {
      const domainErr = validateLojaOnlineCustomDomain(dominioCustom)
      if (domainErr) {
        setDominioError(domainErr)
        setMessage({ type: 'error', text: domainErr })
        return
      }
    }

    if (freteTipo === 'correios') {
      const cep = freteCepOrigem.replace(/\D/g, '')
      if (cep.length !== 8) {
        setMessage({ type: 'error', text: 'Informe o CEP de origem da loja para frete via Correios.' })
        return
      }
      if (!melhorEnvioToken.trim() && !melhorEnvioTokenConfigured) {
        setMessage({
          type: 'error',
          text: 'Informe o token do Melhor Envio (Área Dev) para cotação PAC/SEDEX.',
        })
        return
      }
    }

    if (pagMercadopago) {
      const pk = mpPublicKey.trim()
      const tk = mpAccessToken.trim()
      if (!pk) {
        setMessage({ type: 'error', text: 'Informe a Public Key do Mercado Pago.' })
        return
      }
      if (!tk && !mpTokenConfigured) {
        setMessage({ type: 'error', text: 'Informe o Access Token do Mercado Pago.' })
        return
      }
      if (tk) {
        const pkMode = mpCredentialMode(pk)
        const tkMode = mpCredentialMode(tk)
        if (pkMode && tkMode && pkMode !== tkMode) {
          setMessage({
            type: 'error',
            text:
              pkMode === 'test'
                ? 'Public Key é de teste, mas Access Token é de produção. Use credenciais do mesmo ambiente (ambos TEST-... para testes).'
                : 'Public Key é de produção, mas Access Token é de teste. Use credenciais do mesmo ambiente.',
          })
          return
        }
      }
    }

    setSaving(true)
    setMessage(null)
    try {
      const trimmedCor = corPrimaria.trim()
      if (trimmedCor && !/^#[0-9A-Fa-f]{6}$/.test(trimmedCor)) {
        setMessage({ type: 'error', text: 'Informe uma cor principal válida no formato #RRGGBB.' })
        setSaving(false)
        return
      }
      const trimmedCorFundo = corFundo.trim()
      if (trimmedCorFundo && !/^#[0-9A-Fa-f]{6}$/.test(trimmedCorFundo)) {
        setMessage({ type: 'error', text: 'Informe uma cor de fundo válida no formato #RRGGBB.' })
        setSaving(false)
        return
      }
      const trimmedCorHeader = corHeader.trim()
      if (trimmedCorHeader && !/^#[0-9A-Fa-f]{6}$/.test(trimmedCorHeader)) {
        setMessage({ type: 'error', text: 'Informe uma cor de cabeçalho válida no formato #RRGGBB.' })
        setSaving(false)
        return
      }
      const trimmedCorMenu = corMenu.trim()
      if (trimmedCorMenu && !/^#[0-9A-Fa-f]{6}$/.test(trimmedCorMenu)) {
        setMessage({ type: 'error', text: 'Informe uma cor do menu válida no formato #RRGGBB.' })
        setSaving(false)
        return
      }
      const cor = normalizeLojaOnlineHexColor(trimmedCor)
      const corFundoNorm = normalizeLojaOnlineHexColor(trimmedCorFundo, LOJA_ONLINE_COR_FUNDO_PADRAO)
      const corHeaderNorm = normalizeLojaOnlineHexColor(trimmedCorHeader, LOJA_ONLINE_COR_HEADER_PADRAO)
      const corMenuNorm = normalizeLojaOnlineHexColor(trimmedCorMenu, LOJA_ONLINE_COR_MENU_PADRAO)
      const bannersJson = JSON.stringify(banners)
      if (estimateBannerJsonBytes(banners) > LOJA_ONLINE_BANNERS_JSON_MAX_BYTES) {
        setMessage({
          type: 'error',
          text: `Os banners excedem o limite de ${formatBannerJsonLimitLabel()}. Reduza imagens ou remova banners antigos.`,
        })
        setSaving(false)
        return
      }
      const faixaAvisosJson = serializeLojaOnlineFaixaConfig({
        avisos: faixaAvisos,
        efeito: faixaEfeito,
        sentido: faixaSentido,
        velocidade: faixaVelocidade,
        cor: normalizeLojaOnlineHexColor(faixaCor, corPrimaria),
      })
      const data: UpdateEmpresaConfigInput = {
        loja_online_ativa: ativa,
        loja_online_slug: normalizedSlug || null,
        loja_online_titulo: titulo.trim() || null,
        loja_online_descricao: descricao.trim() || null,
        loja_online_whatsapp: whatsapp.trim() || null,
        loja_online_whatsapp_flutuante: whatsappFlutuante,
        loja_online_whatsapp_flutuante_msg: whatsappFlutuanteMsg.trim() || null,
        loja_online_mostrar_preco: mostrarPreco,
        loja_online_ocultar_sem_estoque: ocultarSemEstoque,
        loja_online_banner: banners[0]?.imagem ?? null,
        loja_online_banners_json: bannersJson,
        loja_online_banner_tamanho: bannerTamanho,
        loja_online_banner_tamanho_mobile: bannerTamanhoMobile,
        loja_online_faixa_ativa: faixaAtiva,
        loja_online_faixa_avisos_json: faixaAvisosJson,
        loja_online_cor_primaria: cor,
        loja_online_cor_fundo: corFundoNorm,
        loja_online_cor_header: corHeaderNorm,
        loja_online_cor_menu: corMenuNorm,
        loja_online_logo_header: logoHeader,
        loja_online_logo_header_size: logoHeaderSize,
        loja_online_categorias_titulo: categoriasTitulo.trim() || null,
        loja_online_cards_config_json: serializeLojaOnlineCardsConfig(cardsConfig),
        loja_online_header_mobile: headerMobile,
        loja_online_seo_titulo: seoTitulo.trim() || null,
        loja_online_seo_descricao: seoDescricao.trim() || null,
        loja_online_politica_privacidade: politicaPrivacidade.trim() || null,
        loja_online_termos_uso: termosUso.trim() || null,
        loja_online_politica_trocas: politicaTrocas.trim() || null,
        loja_online_politica_entrega: politicaEntrega.trim() || null,
        loja_online_ga4_id: ga4Id.trim() || null,
        loja_online_meta_pixel_id: metaPixelId.trim() || null,
        loja_online_dominio_custom: normalizedDomain,
        loja_online_rodape_texto: rodapeTexto.trim() || null,
        loja_online_instagram: instagram.trim() || null,
        loja_online_facebook: facebook.trim() || null,
        loja_online_email_contato: emailContato.trim() || null,
        loja_online_exigir_cadastro: exigirCadastro,
        loja_online_permitir_retirada: permitirRetirada,
        loja_online_permitir_entrega: permitirEntrega,
        loja_online_mensagem_checkout: mensagemCheckout.trim() || null,
        loja_online_checkout_oferta_json: serializeLojaOnlineCheckoutOferta(checkoutOferta),
        loja_online_frete_tipo: freteTipo,
        loja_online_frete_valor_fixo: Number(freteValorFixo.replace(',', '.')) || 0,
        loja_online_frete_cep_origem: freteCepOrigem.replace(/\D/g, '') || null,
        loja_online_frete_peso_padrao: Number(fretePesoPadrao.replace(',', '.')) || 0.3,
        loja_online_frete_gratis_ativo: freteTipo === 'gratis' ? false : freteGratisAtivo,
        loja_online_frete_gratis_minimo: Number(freteGratisMinimo.replace(',', '.')) || 0,
        loja_online_melhor_envio_sandbox: melhorEnvioSandbox,
        loja_online_cashback_ativo: cashbackAtivo,
        loja_online_pag_manual: pagManual,
        loja_online_pag_asaas: pagAsaas,
        loja_online_asaas_sandbox: asaasSandbox,
        loja_online_pag_mercadopago: pagMercadopago,
        loja_online_mercadopago_public_key: mpPublicKey.trim() || null,
        loja_online_mp_pronto: pagMercadopago && (mpAccessToken.trim().length > 0 || mpTokenConfigured),
        loja_online_asaas_pronto: pagAsaas && (asaasApiKey.trim().length > 0 || asaasKeyConfigured),
      }
      if (asaasApiKey.trim()) data.loja_online_asaas_api_key = asaasApiKey.trim()
      if (mpAccessToken.trim()) data.loja_online_mercadopago_access_token = mpAccessToken.trim()
      if (melhorEnvioToken.trim()) data.loja_online_melhor_envio_token = melhorEnvioToken.trim()
      const previousDomain = config?.loja_online_dominio_custom ?? null
      await window.electronAPI.empresas.updateConfig(empresaId, data)
      setDominioCustom(normalizedDomain ?? '')
      try {
        const status = await syncLojaOnlineCustomDomain({
          empresaId,
          previousDomain,
        })
        setDominioStatus(status)
        if (normalizedDomain && status.ready) {
          setMessage({ type: 'success', text: 'Loja online salva. Domínio próprio ativo.' })
        } else if (normalizedDomain) {
          setMessage({
            type: 'success',
            text: 'Loja online salva. Configure o DNS abaixo e aguarde a ativação do HTTPS.',
          })
        } else {
          setMessage({ type: 'success', text: 'Loja online salva com sucesso.' })
        }
      } catch {
        setMessage({
          type: 'success',
          text: normalizedDomain
            ? 'Loja online salva. O DNS ainda precisa ser apontado para ativar o domínio próprio.'
            : 'Loja online salva com sucesso.',
        })
      }
      loadConfig()
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Erro ao salvar.' })
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) return null

  const previewSlug = slug.trim() ? normalizeLojaOnlineSlug(slug) : ''
  const subdomainUrl = previewSlug ? getLojaOnlineSubdomainUrl(previewSlug) : ''
  const pathUrl = previewSlug ? getLojaOnlinePathUrl(previewSlug) : ''
  const previewDomain = dominioCustom.trim() ? normalizeLojaOnlineCustomDomain(dominioCustom) : null
  const customDomainUrl = previewDomain ? getLojaOnlineCustomDomainUrl(previewDomain) : ''
  const customDns = previewDomain ? getLojaOnlineCustomDomainDns(previewDomain) : null
  const mpPublicKeyMode = mpCredentialMode(mpPublicKey)
  const mpAccessTokenMode = mpAccessToken.trim() ? mpCredentialMode(mpAccessToken) : null
  const mpCredenciaisMisturadas =
    !!mpPublicKeyMode &&
    !!mpAccessTokenMode &&
    mpPublicKeyMode !== mpAccessTokenMode

  const bannerSpec = getLojaOnlineBannerSpec(bannerTamanho)
  const bannerSpecMobile = getLojaOnlineBannerSpec(bannerTamanhoMobile, 'mobile')

  return (
    <>
      {message && (
        <Alert variant={message.type === 'success' ? 'success' : 'error'} className="page-alert">
          {message.text}
        </Alert>
      )}

      {section === 'pedidos' && empresaId ? (
        <div className="loja-admin-pedidos-page">
          <LojaAdminSectionIntro section="pedidos" />
          <LojaOnlinePedidosAdmin empresaId={empresaId} />
        </div>
      ) : section === 'cupons' && empresaId ? (
        <>
          <LojaAdminSectionIntro section="cupons" />
          <Card className="page-card config-loja-card loja-online-grid-full">
            <CardHeader><span><Tag size={20} /> Cupons de desconto</span></CardHeader>
            <CardBody className="loja-online-card-body">
              <p className="loja-online-hint">Cadastre códigos promocionais para seus clientes usarem no checkout.</p>
              <LojaOnlineCuponsAdmin empresaId={empresaId} />
            </CardBody>
          </Card>
        </>
      ) : section === 'orderbumps' && empresaId ? (
        <>
          <LojaAdminSectionIntro section="orderbumps" />
          <Card className="page-card config-loja-card loja-online-grid-full">
            <CardHeader><span><Sparkles size={20} /> Order bump</span></CardHeader>
            <CardBody className="loja-online-card-body">
              <p className="loja-online-hint">
                Mostre ofertas extras no checkout, antes do cliente pagar. Use ofertas fixas para todos ou personalizadas por produto do carrinho.
              </p>
              <LojaOnlineOrderBumpsAdmin empresaId={empresaId} />
            </CardBody>
          </Card>
        </>
      ) : (
        <div className="loja-online-grid">
          {section === 'publicacao' && (
            <>
              <LojaAdminSectionIntro section="publicacao" />
              <Card className="page-card config-loja-card loja-online-grid-full">
                <CardHeader><span><Globe size={20} /> Endereço e publicação</span></CardHeader>
                <CardBody className="loja-online-card-body">
                  <label className="loja-online-toggle">
                    <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
                    <span>Loja online ativa</span>
                  </label>
                  <Input
                    label="Subdomínio"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="minhaloja"
                    disabled={loading}
                    hint={`https://minhaloja.${LOJA_ONLINE_DOMAIN}`}
                  />
                  {slugError && <p className="loja-online-field-error">{slugError}</p>}
                  <Input
                    label="Domínio próprio (opcional)"
                    value={dominioCustom}
                    onChange={(e) => handleDominioChange(e.target.value)}
                    placeholder="www.sualoja.com.br"
                    hint="Recomendado usar www.sualoja.com.br"
                  />
                  {dominioError && <p className="loja-online-field-error">{dominioError}</p>}
                  {previewDomain && customDns && !dominioError && (
                    <div className="loja-online-dns">
                      <div className="loja-online-dns-head">
                        <strong>Apontamento DNS</strong>
                        <span
                          className={
                            dominioStatus?.ready
                              ? 'loja-online-dns-badge loja-online-dns-badge--ok'
                              : 'loja-online-dns-badge'
                          }
                        >
                          {checkingDominio
                            ? 'Verificando…'
                            : dominioStatus?.ready
                              ? 'Domínio ativo'
                              : 'Aguardando DNS'}
                        </span>
                      </div>
                      <p className="loja-online-hint">
                        No painel do seu domínio (Registro.br, GoDaddy, Cloudflare…), crie o registro:
                      </p>
                      <div className="loja-online-dns-record">
                        <span>
                          <b>{customDns.type}</b> {customDns.name} → {customDns.value}
                        </span>
                        <button
                          type="button"
                          className="loja-online-dns-copy"
                          onClick={() => copyDnsValue(customDns.value)}
                          aria-label="Copiar destino DNS"
                        >
                          {copiedDns === customDns.value ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                      {customDns.type === 'CNAME' && (
                        <p className="loja-online-hint">
                          Para o endereço sem www, crie também um registro <b>A</b> em <code>@</code> apontando para{' '}
                          <code>{LOJA_ONLINE_APEX_A_RECORD}</code>.
                        </p>
                      )}
                      {customDns.type === 'A' && (
                        <p className="loja-online-hint">
                          Para www, crie um <b>CNAME</b> apontando para <code>{LOJA_ONLINE_CNAME_TARGET}</code>.
                        </p>
                      )}
                      <div className="loja-online-dns-actions">
                        <button
                          type="button"
                          className="loja-online-dns-check"
                          onClick={() => checkDominioDns(previewDomain)}
                          disabled={checkingDominio}
                        >
                          <RefreshCw size={14} /> Verificar DNS
                        </button>
                        {customDomainUrl && (
                          <a
                            href={customDomainUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="loja-online-preview-btn loja-online-preview-btn--muted"
                          >
                            <Globe size={16} /> Abrir {previewDomain}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  {previewSlug && ativa && (
                    <div className="loja-online-preview-links">
                      <a href={customDomainUrl || subdomainUrl} target="_blank" rel="noopener noreferrer" className="loja-online-preview-btn">
                        <Eye size={16} /> Abrir loja
                      </a>
                      <Link to={`/loja/${previewSlug}`} target="_blank" className="loja-online-preview-btn loja-online-preview-btn--muted">
                        <ExternalLink size={16} /> Prévia /#/loja
                      </Link>
                    </div>
                  )}
                  {previewSlug && !ativa && (
                    <p className="loja-online-hint loja-online-hint--warn">
                      Ative e salve para publicar. Prévia: <Link to={`/loja/${previewSlug}`}>{pathUrl}</Link>
                    </p>
                  )}
                </CardBody>
              </Card>
            </>
          )}

          {section === 'seo' && (
            <>
              <LojaAdminSectionIntro section="seo" />
              <Card className="page-card config-loja-card">
                <CardHeader><span><Search size={20} /> SEO</span></CardHeader>
                <CardBody className="loja-online-card-body">
                  <Input label="Título no Google (opcional)" value={seoTitulo} onChange={(e) => setSeoTitulo(e.target.value)} placeholder={titulo || 'Minha Loja'} hint="Aba do navegador e resultados de busca" />
                  <div className="input-wrap">
                    <label className="input-label">Meta descrição</label>
                    <textarea className="input-el loja-online-textarea" rows={3} value={seoDescricao} onChange={(e) => setSeoDescricao(e.target.value)} placeholder="Descrição curta para Google e redes sociais" />
                  </div>
                  {previewSlug && (
                    <p className="loja-online-hint">
                      Sitemap: <code>/api/loja-online/sitemap?slug={previewSlug}</code>
                    </p>
                  )}
                </CardBody>
              </Card>
              <Card className="page-card config-loja-card">
                <CardHeader><span><BarChart3 size={20} /> Analytics</span></CardHeader>
                <CardBody className="loja-online-card-body">
                  <Input label="Google Analytics 4 (ID)" value={ga4Id} onChange={(e) => setGa4Id(e.target.value)} placeholder="G-XXXXXXXXXX" />
                  <Input label="Meta Pixel (ID)" value={metaPixelId} onChange={(e) => setMetaPixelId(e.target.value)} placeholder="1234567890" />
                </CardBody>
              </Card>
            </>
          )}

          {section === 'aparencia' && (
            <>
              <LojaAdminSectionIntro section="aparencia" />
              <Card className="page-card config-loja-card">
                <CardHeader><span><Image size={20} /> Identidade</span></CardHeader>
                <CardBody className="loja-online-card-body">
                  <Input label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={config?.nome ?? ''} />
                  <div className="input-wrap">
                    <label className="input-label">Descrição</label>
                    <textarea className="input-el loja-online-textarea" rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                  </div>
                  <p className="loja-online-hint">
                    O logo do PDV fica em Configurações → Dados da loja. O logo do cabeçalho da loja online é configurado em Cabeçalho.
                  </p>
                </CardBody>
              </Card>
              <Card className="page-card config-loja-card">
                <CardHeader><span><Palette size={20} /> Cores</span></CardHeader>
                <CardBody className="loja-online-card-body">
                  <p className="loja-online-subsection-title">Cor principal</p>
                  <p className="loja-online-hint">
                    Botões, preços, links, faixa de avisos e destaques.
                    É independente da cor do painel do PDV.
                  </p>
                  <div className="config-loja-cor-row">
                    <div className="config-loja-cor-presets">
                      {LOJA_ONLINE_CORES_PRESET.map((cor) => (
                        <button
                          key={cor}
                          type="button"
                          onClick={() => setCorPrimaria(cor)}
                          className="config-loja-cor-swatch"
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 'var(--radius-full)',
                            background: cor,
                            border: corPrimaria === cor ? '3px solid var(--color-text)' : '2px solid transparent',
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)',
                          }}
                          title={cor}
                        />
                      ))}
                    </div>
                    <div className="config-loja-cor-input">
                      <input
                        type="color"
                        value={corPrimaria}
                        onChange={(e) => setCorPrimaria(e.target.value)}
                        style={{ width: 40, height: 32, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                        aria-label="Seletor de cor principal"
                      />
                      <Input
                        value={corPrimaria}
                        onChange={(e) => setCorPrimaria(e.target.value)}
                        placeholder="#1d4ed8"
                        style={{ width: 120 }}
                      />
                    </div>
                  </div>

                  <p className="loja-online-subsection-title loja-online-subsection-title--spaced">Cor de fundo</p>
                  <p className="loja-online-hint">
                    Plano de fundo da vitrine — área atrás dos produtos, entre seções e nas páginas internas.
                  </p>
                  <div className="config-loja-cor-row">
                    <div className="config-loja-cor-presets">
                      {LOJA_ONLINE_CORES_FUNDO_PRESET.map((cor) => (
                        <button
                          key={cor}
                          type="button"
                          onClick={() => setCorFundo(cor)}
                          className="config-loja-cor-swatch"
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 'var(--radius-full)',
                            background: cor,
                            border: corFundo === cor ? '3px solid var(--color-text)' : '2px solid #d4d4d8',
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)',
                          }}
                          title={cor}
                        />
                      ))}
                    </div>
                    <div className="config-loja-cor-input">
                      <input
                        type="color"
                        value={corFundo}
                        onChange={(e) => setCorFundo(e.target.value)}
                        style={{ width: 40, height: 32, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                        aria-label="Seletor de cor de fundo"
                      />
                      <Input
                        value={corFundo}
                        onChange={(e) => setCorFundo(e.target.value)}
                        placeholder={LOJA_ONLINE_COR_FUNDO_PADRAO}
                        style={{ width: 120 }}
                      />
                    </div>
                  </div>

                  <div
                    className="loja-online-cor-preview"
                    style={{ '--loja-cor': corPrimaria, '--loja-cor-fundo': corFundo } as React.CSSProperties}
                  >
                    <div className="loja-online-cor-preview-bar">Cupom de desconto — frete grátis acima de R$ 99</div>
                    <div className="loja-online-cor-preview-body">
                      <span className="loja-online-cor-preview-price">R$ 49,90</span>
                      <button type="button" className="loja-online-cor-preview-btn">Adicionar</button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </>
          )}

          {section === 'faixa' && (
            <>
              <LojaAdminSectionIntro section="faixa" />
              <Card className="page-card config-loja-card loja-online-grid-full">
                <CardHeader><span><Megaphone size={20} /> Faixa de avisos</span></CardHeader>
                <CardBody className="loja-online-card-body">
                  <p className="loja-online-hint">
                    Barra no topo da loja (acima do menu). Os avisos podem alternar ou correr em loop — cupons, frete grátis, promoções etc.
                  </p>
                  <label className="loja-online-toggle">
                    <input type="checkbox" checked={faixaAtiva} onChange={(e) => setFaixaAtiva(e.target.checked)} />
                    <span>Exibir faixa de avisos na loja</span>
                  </label>
                  {faixaAtiva && (
                    <div className="loja-admin-faixa-avisos">
                      <label className="loja-online-toggle">
                        <input
                          type="checkbox"
                          checked={faixaEfeito === 'correr'}
                          onChange={(e) => setFaixaEfeito(e.target.checked ? 'correr' : 'alternar')}
                        />
                        <span>Texto correndo em loop infinito</span>
                      </label>
                      {faixaEfeito === 'correr' && (
                        <div className="loja-admin-faixa-efeito-opts">
                          <label className="input-wrap">
                            <span className="input-label">Sentido</span>
                            <select
                              className="input-el"
                              value={faixaSentido}
                              onChange={(e) => setFaixaSentido(e.target.value as LojaOnlineFaixaSentido)}
                            >
                              <option value="esquerda">Da direita para a esquerda</option>
                              <option value="direita">Da esquerda para a direita</option>
                            </select>
                          </label>
                          <label className="input-wrap">
                            <span className="input-label">Velocidade</span>
                            <select
                              className="input-el"
                              value={faixaVelocidade}
                              onChange={(e) => setFaixaVelocidade(e.target.value as LojaOnlineFaixaVelocidade)}
                            >
                              <option value="lenta">Lenta</option>
                              <option value="media">Média</option>
                              <option value="rapida">Rápida</option>
                            </select>
                          </label>
                        </div>
                      )}
                      <p className="loja-online-subsection-title">Cor de fundo da faixa</p>
                      <p className="loja-online-hint">
                        Independente da cor principal. O texto fica claro ou escuro automaticamente.
                      </p>
                      <div className="config-loja-cor-row">
                        <div className="config-loja-cor-presets">
                          {LOJA_ONLINE_CORES_PRESET.map((cor) => (
                            <button
                              key={cor}
                              type="button"
                              onClick={() => setFaixaCor(cor)}
                              className="config-loja-cor-swatch"
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 'var(--radius-full)',
                                background: cor,
                                border: faixaCor === cor ? '3px solid var(--color-text)' : '2px solid transparent',
                                cursor: 'pointer',
                                boxShadow: 'var(--shadow-sm)',
                              }}
                              title={cor}
                            />
                          ))}
                        </div>
                        <div className="config-loja-cor-input">
                          <input
                            type="color"
                            value={normalizeLojaOnlineHexColor(faixaCor, corPrimaria)}
                            onChange={(e) => setFaixaCor(e.target.value)}
                            style={{ width: 40, height: 32, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                            aria-label="Seletor de cor de fundo da faixa"
                          />
                          <Input
                            value={faixaCor}
                            onChange={(e) => setFaixaCor(e.target.value)}
                            placeholder={corPrimaria}
                            style={{ width: 120 }}
                          />
                        </div>
                      </div>
                      {faixaAvisos.map((aviso, idx) => (
                        <div key={aviso.id} className="loja-admin-faixa-aviso-row">
                          <Input
                            label={`Aviso ${idx + 1}`}
                            value={aviso.texto}
                            onChange={(e) =>
                              setFaixaAvisos((prev) =>
                                prev.map((a) => (a.id === aviso.id ? { ...a, texto: e.target.value } : a))
                              )
                            }
                            placeholder="Ex.: Use o cupom BEMVINDO10 e ganhe 10% de desconto"
                          />
                          <Input
                            label="Link (opcional)"
                            value={aviso.link ?? ''}
                            onChange={(e) =>
                              setFaixaAvisos((prev) =>
                                prev.map((a) => (a.id === aviso.id ? { ...a, link: e.target.value } : a))
                              )
                            }
                            placeholder="https://… ou carrinho"
                            hint="URL externa ou caminho interno (ex.: carrinho, checkout)"
                          />
                          <button
                            type="button"
                            className="loja-admin-faixa-aviso-remove"
                            onClick={() => setFaixaAvisos((prev) => prev.filter((a) => a.id !== aviso.id))}
                            aria-label="Remover aviso"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        leftIcon={<Plus size={16} />}
                        onClick={() =>
                          setFaixaAvisos((prev) => [
                            ...prev,
                            { id: crypto.randomUUID(), texto: '', link: null, ordem: prev.length },
                          ])
                        }
                      >
                        Adicionar aviso
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            </>
          )}

          {section === 'cabecalho' && (
            <>
              <LojaAdminSectionIntro section="cabecalho" />
              <Card className="page-card config-loja-card loja-online-grid-full">
                <CardHeader><span><LayoutTemplate size={20} /> Modelos do cabeçalho</span></CardHeader>
                <CardBody className="loja-online-card-body">
                  <LojaOnlineHeaderMobileEditor
                    value={headerMobile}
                    onChange={setHeaderMobile}
                    titulo={titulo || config?.nome || ''}
                    logoHeader={logoHeader}
                    logoSistema={config?.logo}
                    onLogoHeaderChange={setLogoHeader}
                    logoHeaderSize={logoHeaderSize}
                    onLogoHeaderSizeChange={setLogoHeaderSize}
                    corPrimaria={corPrimaria}
                    corFundo={corFundo}
                    corHeader={corHeader}
                    onCorHeaderChange={setCorHeader}
                    corMenu={corMenu}
                    onCorMenuChange={setCorMenu}
                  />
                </CardBody>
              </Card>
            </>
          )}

          {section === 'banners' && (
            <>
              <LojaAdminSectionIntro section="banners" />
              <Card className="page-card config-loja-card loja-online-grid-full">
                <CardHeader><span><LayoutTemplate size={20} /> Banners da vitrine</span></CardHeader>
                <CardBody className="loja-online-card-body">
                  <p className="loja-online-subsection-title">
                    <Monitor size={16} /> Computador
                  </p>
                  <p className="loja-online-hint">Escolha a altura do banner no computador e telas grandes.</p>
                  <div className="loja-admin-banner-tamanhos" role="radiogroup" aria-label="Tamanho do banner no computador">
                    {LOJA_ONLINE_BANNER_TAMANHOS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={bannerTamanho === opt.id}
                        className={`loja-admin-banner-tamanho${bannerTamanho === opt.id ? ' is-active' : ''}`}
                        onClick={() => setBannerTamanho(opt.id)}
                      >
                        <span
                          className={`loja-admin-banner-tamanho-preview loja-admin-banner-tamanho-preview--${opt.id}`}
                          aria-hidden
                        />
                        <span className="loja-admin-banner-tamanho-label">{opt.label}</span>
                        <span className="loja-admin-banner-tamanho-ratio">{opt.ratioLabel}</span>
                        <span className="loja-admin-banner-tamanho-desc">{opt.description}</span>
                      </button>
                    ))}
                  </div>
                  <p className="loja-online-banner-spec">
                    <span className="loja-online-banner-spec-ratio">{bannerSpec.ratioLabel}</span>
                    <span>
                      Proporção ideal no computador. Recomendado:{' '}
                      <strong>
                        {bannerSpec.recommendedPx.width} × {bannerSpec.recommendedPx.height} px
                      </strong>
                      . Na loja, o banner ocupa a largura da tela (altura máx. {bannerSpec.maxHeightPx} px);
                      imagens fora dessa proporção serão recortadas.
                    </span>
                  </p>

                  <p className="loja-online-subsection-title loja-online-subsection-title--spaced">
                    <Smartphone size={16} /> Celular
                  </p>
                  <p className="loja-online-hint">
                    O celular usa outra proporção. Envie uma arte exclusiva para cada banner; se ficar vazio, a loja
                    reutiliza a imagem do computador.
                  </p>
                  <div className="loja-admin-banner-tamanhos" role="radiogroup" aria-label="Tamanho do banner no celular">
                    {LOJA_ONLINE_BANNER_TAMANHOS_MOBILE.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={bannerTamanhoMobile === opt.id}
                        className={`loja-admin-banner-tamanho${bannerTamanhoMobile === opt.id ? ' is-active' : ''}`}
                        onClick={() => setBannerTamanhoMobile(opt.id)}
                      >
                        <span
                          className={`loja-admin-banner-tamanho-preview loja-admin-banner-tamanho-preview--mobile-${opt.id}`}
                          aria-hidden
                        />
                        <span className="loja-admin-banner-tamanho-label">{opt.label}</span>
                        <span className="loja-admin-banner-tamanho-ratio">{opt.ratioLabel}</span>
                        <span className="loja-admin-banner-tamanho-desc">{opt.description}</span>
                      </button>
                    ))}
                  </div>
                  <p className="loja-online-banner-spec">
                    <span className="loja-online-banner-spec-ratio">{bannerSpecMobile.ratioLabel}</span>
                    <span>
                      Proporção ideal no celular. Recomendado:{' '}
                      <strong>
                        {bannerSpecMobile.recommendedPx.width} × {bannerSpecMobile.recommendedPx.height} px
                      </strong>
                      . No telefone, o banner ocupa a largura da tela (altura máx. {bannerSpecMobile.maxHeightPx} px).
                    </span>
                  </p>

                  <div className="loja-admin-banners">
                    {banners.map((b) => {
                      const previewTamanho = b.tamanho ?? bannerTamanho
                      const previewTamanhoMobile = b.tamanhoMobile ?? bannerTamanhoMobile
                      const dims = formatBannerDimensions(b.studio)
                      const dimsMobile = formatBannerDimensions(b.studioMobile)
                      const spec = getLojaOnlineBannerSpec(previewTamanho)
                      const specMobile = getLojaOnlineBannerSpec(previewTamanhoMobile, 'mobile')
                      const hasMobileArt = Boolean(b.imagemMobile)
                      return (
                      <div key={b.id} className="loja-admin-banner-item">
                        <div className="loja-admin-banner-variants">
                          <div className="loja-admin-banner-variant">
                            <span className="loja-admin-banner-variant-label">
                              <Monitor size={14} /> Computador
                            </span>
                            <div
                              className={`loja-online-banner-preview loja-online-banner-preview--${previewTamanho}`}
                            >
                              <img src={b.imagem} alt="" />
                              <div className="loja-online-banner-actions">
                                <button
                                  type="button"
                                  className="loja-online-banner-action"
                                  onClick={() => openBannerStudio(b.id, 'desktop')}
                                  aria-label="Editar no Banner Studio"
                                  title="Editar no Banner Studio"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="loja-online-banner-remove"
                                  onClick={() => setBanners((p) => p.filter((x) => x.id !== b.id))}
                                  aria-label="Remover banner"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                            <div className="loja-admin-banner-meta">
                              {b.studio ? (
                                <span className="loja-admin-banner-badge">Banner Studio</span>
                              ) : (
                                <span className="loja-admin-banner-badge loja-admin-banner-badge--upload">Imagem</span>
                              )}
                              <span className="loja-admin-banner-meta-text">
                                {dims ?? `${spec.recommendedPx.width} × ${spec.recommendedPx.height} px`}
                                {' · '}
                                {spec.label}
                              </span>
                            </div>
                          </div>
                          <div className="loja-admin-banner-variant">
                            <span className="loja-admin-banner-variant-label">
                              <Smartphone size={14} /> Celular
                            </span>
                            {hasMobileArt ? (
                              <>
                                <div
                                  className={`loja-online-banner-preview loja-online-banner-preview--mobile-${previewTamanhoMobile}`}
                                >
                                  <img src={b.imagemMobile ?? ''} alt="" />
                                  <div className="loja-online-banner-actions">
                                    <button
                                      type="button"
                                      className="loja-online-banner-action"
                                      onClick={() => openBannerStudio(b.id, 'mobile')}
                                      aria-label="Editar versão celular no Banner Studio"
                                      title="Editar no Banner Studio"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      className="loja-online-banner-remove"
                                      onClick={() => clearBannerMobileImage(b.id)}
                                      aria-label="Remover imagem do celular"
                                      title="Remover imagem do celular"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                </div>
                                <div className="loja-admin-banner-meta">
                                  {b.studioMobile ? (
                                    <span className="loja-admin-banner-badge">Banner Studio</span>
                                  ) : (
                                    <span className="loja-admin-banner-badge loja-admin-banner-badge--upload">Imagem</span>
                                  )}
                                  <span className="loja-admin-banner-meta-text">
                                    {dimsMobile ?? `${specMobile.recommendedPx.width} × ${specMobile.recommendedPx.height} px`}
                                    {' · '}
                                    {specMobile.label}
                                  </span>
                                  <label className="loja-admin-banner-replace">
                                    Trocar imagem
                                    <input
                                      type="file"
                                      accept="image/*"
                                      hidden
                                      onChange={(e) => void setBannerMobileImage(b.id, e)}
                                    />
                                  </label>
                                </div>
                              </>
                            ) : (
                              <div
                                className={`loja-online-banner-preview loja-online-banner-preview--mobile-${previewTamanhoMobile} loja-online-banner-preview--empty`}
                              >
                                <label className="loja-online-banner-empty">
                                  <Smartphone size={22} />
                                  <span>Enviar imagem do celular</span>
                                  <span className="loja-online-banner-empty-hint">
                                    {specMobile.recommendedPx.width} × {specMobile.recommendedPx.height} px
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={(e) => void setBannerMobileImage(b.id, e)}
                                  />
                                </label>
                                <button
                                  type="button"
                                  className="loja-online-banner-empty-studio"
                                  onClick={() => openBannerStudio(b.id, 'mobile')}
                                >
                                  <Sparkles size={14} /> Criar no Banner Studio
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                  <div className="loja-admin-banner-actions-row">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      leftIcon={<Sparkles size={16} />}
                      onClick={() => openBannerStudio()}
                    >
                      Criar com Banner Studio
                    </Button>
                    <label className="loja-online-upload loja-online-upload--inline">
                      <Upload size={18} /><span>Enviar imagem (computador)</span>
                      <input type="file" accept="image/*" onChange={addBanner} hidden />
                    </label>
                  </div>
                </CardBody>
              </Card>
            </>
          )}

          {section === 'catalogo' && (
            <>
              <LojaAdminSectionIntro section="catalogo" />
              <Card className="page-card config-loja-card loja-online-grid-full">
                <CardHeader><span><LayoutGrid size={20} /> Seção de categorias</span></CardHeader>
                <CardBody className="loja-online-card-body">
                  <p className="loja-online-hint">
                    Título acima dos cards de categorias na home. Imagem e subtítulo de cada categoria ficam em{' '}
                    <strong>Cadastro → Categorias</strong>.
                  </p>
                  <Input
                    label="Título da seção"
                    value={categoriasTitulo}
                    onChange={(e) => setCategoriasTitulo(e.currentTarget.value)}
                    placeholder="Ex.: Complete seu ecossistema"
                  />
                </CardBody>
              </Card>
              <Card className="page-card config-loja-card loja-online-grid-full">
                <CardHeader>
                  <span>
                    <LayoutTemplate size={20} /> Cards da vitrine
                  </span>
                </CardHeader>
                <CardBody className="loja-online-card-body">
                  <p className="loja-online-hint">
                    Personalize cores e escolha o modelo de cada card. Novos templates serão liberados aqui
                    (estilo Elementor).
                  </p>
                  <LojaOnlineCardsConfigEditor value={cardsConfig} onChange={setCardsConfig} />
                </CardBody>
              </Card>
              <Card className="page-card config-loja-card loja-online-grid-full">
                <CardHeader><span><LayoutGrid size={20} /> Exibição do catálogo</span></CardHeader>
                <CardBody className="loja-online-card-body">
                  <div className="loja-catalogo-cols-field">
                    <p className="loja-online-subsection-title">Produtos por linha</p>
                    <p className="loja-online-hint">
                      Define quantos cards aparecem em cada linha do catálogo e da busca (em telas grandes).
                    </p>
                    <div className="loja-catalogo-cols-picker" role="radiogroup" aria-label="Produtos por linha">
                      {LOJA_ONLINE_CATALOGO_COLUNAS_OPCOES.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={cardsConfig.catalogoColunas === opt.value}
                          className={cardsConfig.catalogoColunas === opt.value ? 'is-active' : ''}
                          onClick={() =>
                            setCardsConfig((prev) => ({ ...prev, catalogoColunas: opt.value }))
                          }
                        >
                          <strong>{opt.label}</strong>
                          <span>{opt.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="loja-online-toggle">
                    <input type="checkbox" checked={mostrarPreco} onChange={(e) => setMostrarPreco(e.target.checked)} />
                    <span>Mostrar preços na vitrine</span>
                  </label>
                  <label className="loja-online-toggle">
                    <input type="checkbox" checked={ocultarSemEstoque} onChange={(e) => setOcultarSemEstoque(e.target.checked)} />
                    <span>Ocultar produtos sem estoque</span>
                  </label>
                  <p className="loja-online-hint">
                    Para exibir um produto na loja, marque <strong>Exibir na loja online</strong> em Produtos → editar produto.
                  </p>
                  <p className="loja-online-hint">
                    Para o carrossel <strong>Produtos em destaque</strong>, use a opção de destaque na aba Loja online do produto.
                  </p>
                </CardBody>
              </Card>
            </>
          )}

          {section === 'contato' && (
            <>
              <LojaAdminSectionIntro section="contato" />
              <Card className="page-card config-loja-card loja-online-grid-full">
                <CardHeader><span><MessageCircle size={20} /> WhatsApp</span></CardHeader>
                <CardBody className="loja-online-card-body">
                  <Input label="WhatsApp para pedidos" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
                  <label className="loja-online-toggle">
                    <input
                      type="checkbox"
                      checked={whatsappFlutuante}
                      onChange={(e) => setWhatsappFlutuante(e.target.checked)}
                    />
                    <span>Botão flutuante de WhatsApp na loja</span>
                  </label>
                  <p className="loja-online-hint">
                    Aparece no canto da loja. Precisa do número preenchido acima.
                  </p>
                  {whatsappFlutuante && (
                    <Input
                      label="Mensagem inicial (opcional)"
                      value={whatsappFlutuanteMsg}
                      onChange={(e) => setWhatsappFlutuanteMsg(e.target.value)}
                      placeholder="Olá! Vim pela loja…"
                      hint="Texto que já vem preenchido quando o cliente abre o WhatsApp."
                    />
                  )}
                </CardBody>
              </Card>
              <Card className="page-card config-loja-card">
                <CardHeader><span><PanelBottom size={20} /> E-mail e redes</span></CardHeader>
                <CardBody className="loja-online-card-body">
                  <Input label="E-mail de contato" value={emailContato} onChange={(e) => setEmailContato(e.target.value)} type="email" />
                  <Input label="Instagram (URL)" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/sualoja" />
                  <Input label="Facebook (URL)" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="https://facebook.com/sualoja" />
                </CardBody>
              </Card>
            </>
          )}

          {section === 'institucional' && (
            <>
              <LojaAdminSectionIntro section="institucional" />
              <Card className="page-card config-loja-card">
                <CardHeader><span><PanelBottom size={20} /> Rodapé</span></CardHeader>
                <CardBody className="loja-online-card-body">
                  <div className="input-wrap">
                    <label className="input-label">Texto do rodapé</label>
                    <textarea className="input-el loja-online-textarea" rows={4} value={rodapeTexto} onChange={(e) => setRodapeTexto(e.target.value)} placeholder="Horário de funcionamento, política de trocas…" />
                  </div>
                </CardBody>
              </Card>
              <Card className="page-card config-loja-card loja-online-grid-full">
                <CardHeader><span><FileText size={20} /> Páginas legais</span></CardHeader>
              <CardBody className="loja-online-card-body">
                <p className="loja-online-hint">Conteúdo das páginas Privacidade, Termos, Trocas e Entrega (links no rodapé da loja).</p>
                {[
                  { label: 'Política de privacidade', value: politicaPrivacidade, set: setPoliticaPrivacidade },
                  { label: 'Termos de uso', value: termosUso, set: setTermosUso },
                  { label: 'Trocas e devoluções', value: politicaTrocas, set: setPoliticaTrocas },
                  { label: 'Política de entrega', value: politicaEntrega, set: setPoliticaEntrega },
                ].map((f) => (
                  <div key={f.label} className="input-wrap">
                    <label className="input-label">{f.label}</label>
                    <textarea className="input-el loja-online-textarea" rows={5} value={f.value} onChange={(e) => f.set(e.target.value)} />
                  </div>
                ))}
              </CardBody>
            </Card>
            </>
          )}

          {section === 'checkout' && (
            <>
              <LojaAdminSectionIntro section="checkout" />
              <Card className="page-card config-loja-card loja-online-grid-full">
                <CardHeader><span><ShoppingBag size={20} /> Experiência de compra</span></CardHeader>
                <CardBody className="loja-online-card-body">
                  <div className="input-wrap">
                    <label className="input-label">Mensagem após pedido</label>
                    <textarea className="input-el loja-online-textarea" rows={3} value={mensagemCheckout} onChange={(e) => setMensagemCheckout(e.target.value)} placeholder="Obrigado! Em breve entraremos em contato." />
                  </div>
                  <label className="loja-online-toggle"><input type="checkbox" checked={exigirCadastro} onChange={(e) => setExigirCadastro(e.target.checked)} /><span>Exigir cadastro para finalizar pedido (recomendado)</span></label>
                  <label className="loja-online-toggle"><input type="checkbox" checked={cashbackAtivo} onChange={(e) => setCashbackAtivo(e.target.checked)} /><span>Ativar cashback na loja online</span></label>
                  <p className="loja-online-hint">O cashback usa as mesmas regras configuradas em Cashback no painel principal.</p>
                </CardBody>
              </Card>
            </>
          )}

          {section === 'ofertas' && (
            <>
              <LojaAdminSectionIntro section="ofertas" />
              <Card className="page-card config-loja-card loja-online-grid-full">
                <CardHeader><span><Percent size={20} /> Urgência e banner</span></CardHeader>
                <CardBody className="loja-online-card-body">
                  <p className="loja-online-hint">
                    Aparecem no topo do checkout, antes do order bump — gatilho mental para converter.
                  </p>
                  <label className="loja-online-toggle">
                    <input
                      type="checkbox"
                      checked={checkoutOferta.faixaAtiva}
                      onChange={(e) => setCheckoutOferta((o) => ({ ...o, faixaAtiva: e.target.checked }))}
                    />
                    <span>Exibir faixa de promoção</span>
                  </label>
                  {checkoutOferta.faixaAtiva && (
                    <Input
                      label="Texto da faixa"
                      value={checkoutOferta.faixaTexto}
                      onChange={(e) => setCheckoutOferta((o) => ({ ...o, faixaTexto: e.target.value }))}
                      placeholder="Promoção de Black Friday"
                    />
                  )}
                  <label className="loja-online-toggle">
                    <input
                      type="checkbox"
                      checked={checkoutOferta.cronometroAtivo}
                      onChange={(e) => setCheckoutOferta((o) => ({ ...o, cronometroAtivo: e.target.checked }))}
                    />
                    <span>Cronômetro de oferta</span>
                  </label>
                  {checkoutOferta.cronometroAtivo && (
                    <>
                      <Input
                        label="Texto do cronômetro"
                        value={checkoutOferta.cronometroTexto}
                        onChange={(e) => setCheckoutOferta((o) => ({ ...o, cronometroTexto: e.target.value }))}
                        placeholder="Oferta termina em"
                      />
                      <Input
                        label="Duração (minutos)"
                        value={String(checkoutOferta.cronometroMinutos)}
                        onChange={(e) =>
                          setCheckoutOferta((o) => ({
                            ...o,
                            cronometroMinutos: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                        hint="Conta a partir da abertura do checkout nesta sessão do navegador."
                      />
                    </>
                  )}
                  <div className="input-wrap">
                    <span className="input-label">Banner do checkout</span>
                    {checkoutOferta.banner ? (
                      <div className="loja-online-checkout-banner-preview">
                        <img src={checkoutOferta.banner} alt="" />
                        <button
                          type="button"
                          className="loja-online-banner-remove"
                          onClick={() => setCheckoutOferta((o) => ({ ...o, banner: null }))}
                          aria-label="Remover banner"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="loja-online-upload">
                        <Upload size={16} /> Enviar imagem
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ''
                            if (!file) return
                            readImageFile(file, 450)
                              .then((data) => setCheckoutOferta((o) => ({ ...o, banner: data })))
                              .catch((err) => setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao ler imagem.' }))
                          }}
                        />
                      </label>
                    )}
                    <p className="loja-online-hint">Recomendado: imagem larga (ex. 1200×320). Até 450 KB.</p>
                  </div>
                  <p className="loja-online-hint">
                    Produtos extras (order bump) ficam em <strong>Vendas → Order bump</strong>.
                  </p>
                </CardBody>
              </Card>
            </>
          )}

          {section === 'entrega' && (
            <>
              <LojaAdminSectionIntro section="entrega" />
              <Card className="page-card config-loja-card loja-online-grid-full">
                <CardHeader><span><Truck size={20} /> Frete e recebimento</span></CardHeader>
                <CardBody className="loja-online-card-body">
                <label className="input-wrap">
                  <span className="input-label">Modo de frete</span>
                  <select className="input-el" value={freteTipo} onChange={(e) => setFreteTipo(e.target.value as 'fixo' | 'correios' | 'gratis')}>
                    <option value="fixo">Valor fixo</option>
                    <option value="correios">Correios (PAC / SEDEX)</option>
                    <option value="gratis">Frete grátis</option>
                  </select>
                </label>
                {freteTipo === 'fixo' && (
                  <Input label="Valor fixo do frete (R$)" value={freteValorFixo} onChange={(e) => setFreteValorFixo(e.target.value)} />
                )}
                {freteTipo === 'correios' && (
                  <>
                    <Input label="CEP de origem (loja)" value={freteCepOrigem} onChange={(e) => setFreteCepOrigem(e.target.value)} placeholder="00000-000" />
                    <Input label="Peso padrão do pacote (kg)" value={fretePesoPadrao} onChange={(e) => setFretePesoPadrao(e.target.value)} hint="Usado quando o produto não tem peso cadastrado" />
                    <Input
                      label="Token Melhor Envio"
                      type="password"
                      value={melhorEnvioToken}
                      onChange={(e) => setMelhorEnvioToken(e.target.value)}
                      placeholder={melhorEnvioTokenConfigured ? '•••••••• (deixe em branco para manter)' : 'Cole o token da Área Dev'}
                      hint="melhorenvio.com.br → Integrações → Área Dev → seu app → Gerar token"
                    />
                    <label className="loja-online-toggle">
                      <input type="checkbox" checked={melhorEnvioSandbox} onChange={(e) => setMelhorEnvioSandbox(e.target.checked)} />
                      <span>Usar sandbox Melhor Envio (testes)</span>
                    </label>
                    <p className="loja-online-hint">
                      A cotação PAC/SEDEX usa o Melhor Envio (conta gratuita). O webservice antigo dos Correios foi descontinuado.
                    </p>
                  </>
                )}
                {freteTipo !== 'gratis' && (
                  <>
                    <h3 className="loja-online-subsection-title">Promoção de frete grátis</h3>
                    <label className="loja-online-toggle">
                      <input
                        type="checkbox"
                        checked={freteGratisAtivo}
                        onChange={(e) => setFreteGratisAtivo(e.target.checked)}
                      />
                      <span>Oferecer frete grátis a partir de um valor no carrinho</span>
                    </label>
                    {freteGratisAtivo && (
                      <Input
                        label="Valor mínimo para frete grátis (R$)"
                        value={freteGratisMinimo}
                        onChange={(e) => setFreteGratisMinimo(e.target.value)}
                        hint="Ex.: 100 — o cliente vê uma barra no rodapé da loja mostrando quanto falta para ganhar o frete."
                      />
                    )}
                  </>
                )}
                <label className="loja-online-toggle"><input type="checkbox" checked={permitirRetirada} onChange={(e) => setPermitirRetirada(e.target.checked)} /><span>Permitir retirada na loja</span></label>
                <label className="loja-online-toggle"><input type="checkbox" checked={permitirEntrega} onChange={(e) => setPermitirEntrega(e.target.checked)} /><span>Permitir entrega</span></label>
              </CardBody>
            </Card>
            </>
          )}

          {section === 'pagamentos' && (
            <>
              <LojaAdminSectionIntro section="pagamentos" />
              <Card className="page-card config-loja-card loja-online-grid-full">
              <CardHeader><span><CreditCard size={20} /> Formas de pagamento no site</span></CardHeader>
              <CardBody className="loja-online-card-body">
                <p className="loja-online-hint">
                  Configure suas credenciais de gateway. As chaves secretas ficam salvas de forma segura e só são usadas no servidor para processar pagamentos.
                </p>

                <label className="loja-online-toggle">
                  <input type="checkbox" checked={pagManual} onChange={(e) => setPagManual(e.target.checked)} />
                  <span>Pagamento manual (combinar / pagar na entrega)</span>
                </label>

                <div className="loja-admin-pagamento-block">
                  <label className="loja-online-toggle">
                    <input type="checkbox" checked={pagAsaas} onChange={(e) => setPagAsaas(e.target.checked)} />
                    <span>PIX via Asaas</span>
                  </label>
                  {pagAsaas && (
                    <div className="loja-admin-pagamento-fields">
                      <Input
                        label="API Key do Asaas"
                        type="password"
                        value={asaasApiKey}
                        onChange={(e) => setAsaasApiKey(e.target.value)}
                        placeholder={asaasKeyConfigured ? '•••••••• (deixe em branco para manter)' : '$aact_...'}
                        hint="Encontre em Integrações → API no painel Asaas"
                      />
                      <label className="loja-online-toggle">
                        <input type="checkbox" checked={asaasSandbox} onChange={(e) => setAsaasSandbox(e.target.checked)} />
                        <span>Usar ambiente sandbox (testes)</span>
                      </label>
                      <p className="loja-online-hint">
                        Webhook Asaas (opcional): <code>{typeof window !== 'undefined' ? `${window.location.origin}/api/loja-online/webhook-asaas` : '/api/loja-online/webhook-asaas'}</code>
                      </p>
                    </div>
                  )}
                </div>

                <div className="loja-admin-pagamento-block">
                  <label className="loja-online-toggle">
                    <input type="checkbox" checked={pagMercadopago} onChange={(e) => setPagMercadopago(e.target.checked)} />
                    <span>Mercado Pago (PIX, cartão e mais)</span>
                  </label>
                  {pagMercadopago && (
                    <div className="loja-admin-pagamento-fields">
                      {mpPublicKey.trim() && (
                        <p className="loja-online-hint">
                          Public Key detectada como: <strong>{mpAmbienteLabel(mpPublicKeyMode)}</strong>
                        </p>
                      )}
                      {mpTokenConfigured && !mpAccessToken.trim() && (
                        <Alert variant="error" className="page-alert">
                          Há um Access Token salvo no banco. Se você alterou a Public Key, cole novamente o Access Token
                          do <strong>mesmo ambiente</strong> ({mpAmbienteLabel(mpPublicKeyMode)}) e salve.
                        </Alert>
                      )}
                      {mpCredenciaisMisturadas && (
                        <Alert variant="error" className="page-alert">
                          Credenciais misturadas: Public Key é de {mpPublicKeyMode === 'test' ? 'teste' : 'produção'}, mas o
                          Access Token informado é de {mpAccessTokenMode === 'test' ? 'teste' : 'produção'}.
                        </Alert>
                      )}
                      <Input
                        label="Public Key"
                        value={mpPublicKey}
                        onChange={(e) => setMpPublicKey(e.target.value)}
                        placeholder="TEST-... (testes) ou APP_USR-... (produção)"
                      />
                      <Input
                        label="Access Token"
                        type="password"
                        value={mpAccessToken}
                        onChange={(e) => setMpAccessToken(e.target.value)}
                        placeholder={mpTokenConfigured ? '•••••••• (deixe em branco para manter)' : 'TEST-... ou APP_USR-...'}
                        hint="Public Key e Access Token devem ser do mesmo ambiente (teste ou produção)"
                      />
                      <p className="loja-online-hint">
                        Webhook MP: <code>{typeof window !== 'undefined' ? `${window.location.origin}/api/loja-online/webhook-mercadopago` : '/api/loja-online/webhook-mercadopago'}</code>
                      </p>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
            </>
          )}
        </div>
      )}

      {!getLojaOnlineAdminNavItem(section).noSave && (
        <div className="config-loja-footer">
          <Button onClick={handleSave} disabled={saving || loading} leftIcon={<Save size={18} />}>
            {saving ? 'Salvando…' : 'Salvar loja online'}
          </Button>
        </div>
      )}

      <BannerStudioModal
        open={bannerStudioOpen}
        tamanho={bannerStudioVariant === 'mobile' ? bannerTamanhoMobile : bannerTamanho}
        variant={bannerStudioVariant}
        banner={
          bannerStudioEditId
            ? banners.find((b) => b.id === bannerStudioEditId) ?? null
            : null
        }
        onClose={() => {
          setBannerStudioOpen(false)
          setBannerStudioEditId(null)
          setBannerStudioVariant('desktop')
        }}
        onSave={handleBannerStudioSave}
        onError={(message) => setMessage({ type: 'error', text: message })}
      />
    </>
  )
}
