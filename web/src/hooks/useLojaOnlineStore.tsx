import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchLojaOnlineStore } from '../lib/loja-online-api'
import type { LojaOnlineStoreConfig } from '../lib/loja-online-types'
import { parseLojaOnlineBanners, parseLojaOnlineFaixaAvisos, resolveLojaOnlineBannerTamanho, type LojaOnlineBannerTamanho } from '../lib/loja-online-types'
import { getMainAppUrl, resolveLojaOnlineCorFundo, resolveLojaOnlineCorPrimaria } from '../lib/loja-online'
import {
  lojaOnlineCardsCssVars,
  parseLojaOnlineCardsConfig,
  type LojaOnlineCardsConfig,
} from '../lib/loja-online-cards'

export type LojaOnlineMode = 'subdomain' | 'path'

type LojaOnlineStoreContextValue = {
  slug: string
  mode: LojaOnlineMode
  store: LojaOnlineStoreConfig | null
  loading: boolean
  error: string | null
  titulo: string
  corPrimaria: string
  mostrarPreco: boolean
  ocultarSemEstoque: boolean
  banners: ReturnType<typeof parseLojaOnlineBanners>
  bannerTamanho: LojaOnlineBannerTamanho
  faixaAtiva: boolean
  faixaAvisos: ReturnType<typeof parseLojaOnlineFaixaAvisos>
  cardsConfig: LojaOnlineCardsConfig
  link: (path?: string) => string
  reload: () => void
}

const LojaOnlineStoreContext = createContext<LojaOnlineStoreContextValue | null>(null)

export function LojaOnlineStoreProvider({
  slug,
  mode,
  children,
}: {
  slug: string
  mode: LojaOnlineMode
  children: ReactNode
}) {
  const [store, setStore] = useState<LojaOnlineStoreConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!slug?.trim()) {
      setError('Loja não encontrada.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    fetchLojaOnlineStore(slug)
      .then((data) => {
        if (!data?.empresa_id) {
          setStore(null)
          setError('Esta loja não existe ou não está publicada.')
          return
        }
        setStore(data)
      })
      .catch(() => {
        setStore(null)
        setError('Não foi possível carregar a loja.')
      })
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  const link = useCallback(
    (path = '') => {
      const p = path.startsWith('/') ? path : path ? `/${path}` : ''
      if (mode === 'subdomain') return p || '/'
      return `/loja/${slug}${p}`
    },
    [mode, slug]
  )

  const titulo = store?.loja_online_titulo?.trim() || store?.empresas?.nome || 'Loja'
  const corPrimaria = store
    ? resolveLojaOnlineCorPrimaria(store)
    : '#1d4ed8'
  const corFundo = store ? resolveLojaOnlineCorFundo(store) : '#f7f7f7'
  const mostrarPreco = store?.loja_online_mostrar_preco !== 0
  const ocultarSemEstoque = !!store?.loja_online_ocultar_sem_estoque
  const banners = parseLojaOnlineBanners(store?.loja_online_banners_json, store?.loja_online_banner)
  const bannerTamanho = resolveLojaOnlineBannerTamanho(store?.loja_online_banner_tamanho)
  const faixaAtiva = store?.loja_online_faixa_ativa === 1
  const faixaAvisos = parseLojaOnlineFaixaAvisos(store?.loja_online_faixa_avisos_json)
  const cardsConfig = useMemo(
    () => parseLojaOnlineCardsConfig(store?.loja_online_cards_config_json),
    [store?.loja_online_cards_config_json]
  )
  const cardCssVars = useMemo(() => lojaOnlineCardsCssVars(cardsConfig), [cardsConfig])

  const value = useMemo(
    () => ({
      slug,
      mode,
      store,
      loading,
      error,
      titulo,
      corPrimaria,
      mostrarPreco,
      ocultarSemEstoque,
      banners,
      bannerTamanho,
      faixaAtiva,
      faixaAvisos,
      cardsConfig,
      link,
      reload: load,
    }),
    [slug, mode, store, loading, error, titulo, corPrimaria, mostrarPreco, ocultarSemEstoque, banners, bannerTamanho, faixaAtiva, faixaAvisos, cardsConfig, link, load]
  )

  return (
    <LojaOnlineStoreContext.Provider value={value}>
      <div
        className={`loja-store loja-catalogo-cols-${cardsConfig.catalogoColunas} loja-card-template-produto-${cardsConfig.produto.template} loja-card-template-categoria-${cardsConfig.categoria.template}`}
        style={
          {
            '--loja-cor': corPrimaria,
            '--loja-cor-fundo': corFundo,
            ...cardCssVars,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </LojaOnlineStoreContext.Provider>
  )
}

export function useLojaOnlineStore() {
  const ctx = useContext(LojaOnlineStoreContext)
  if (!ctx) throw new Error('useLojaOnlineStore deve ser usado dentro de LojaOnlineStoreProvider')
  return ctx
}

export function LojaOnlineStoreShell({
  children,
  errorAction,
}: {
  children: ReactNode
  errorAction?: ReactNode
}) {
  const { loading, error, store } = useLojaOnlineStore()
  if (loading) {
    return (
      <div className="loja-catalogo loja-catalogo--loading">
        <p>Carregando loja…</p>
      </div>
    )
  }
  if (error || !store) {
    return (
      <div className="loja-catalogo loja-catalogo--error">
        <h1>Loja não encontrada</h1>
        <p>{error ?? 'Verifique o endereço e tente novamente.'}</p>
        {errorAction ?? (
          <a href={getMainAppUrl('/')} className="loja-catalogo-back">
            Voltar ao Agiliza PDV
          </a>
        )}
      </div>
    )
  }
  return <>{children}</>
}
