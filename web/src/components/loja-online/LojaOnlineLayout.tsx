import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { User, Search, Menu } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { useLojaOnlineMenuCategorias } from '../../hooks/useLojaOnlineMenuCategorias'
import { useLojaOnlineSeo } from '../../hooks/useLojaOnlineSeo'
import { getLojaOnlineCanonicalUrl } from '../../lib/loja-online-seo'
import { lojaOnlineFreteGratisProgress, resolveLojaOnlineLogoHeader } from '../../lib/loja-online'
import { LojaOnlineAnnouncementBar } from './LojaOnlineAnnouncementBar'
import { LojaOnlineAnalytics } from './LojaOnlineAnalytics'
import { LojaOnlineTracker } from './LojaOnlineTracker'
import { LojaOnlineBannerCarousel } from './LojaOnlineBannerCarousel'
import { LojaOnlineFeaturedSection } from './LojaOnlineFeaturedSection'
import { LojaOnlineCategoriasSection } from './LojaOnlineCategoriasSection'
import { LojaOnlineColecoesSection } from './LojaOnlineColecoesSection'
import { LojaOnlineCategoriasMenu } from './LojaOnlineCategoriasMenu'
import { LojaOnlineMenuDrawer } from './LojaOnlineMenuDrawer'
import { LojaOnlineCartDrawer } from './LojaOnlineCartDrawer'
import { LojaOnlineFooter } from './LojaOnlineFooter'
import { LojaOnlineFreteGratisBar } from './LojaOnlineFreteGratisBar'
import { LojaOnlineWhatsAppFloat } from './LojaOnlineWhatsAppFloat'
import { LojaOnlineCartHeaderIcon } from './LojaOnlineCartHeaderIcon'

function LojaOnlineSearchFields({
  value,
  onChange,
  withSubmit = false,
}: {
  value: string
  onChange: (value: string) => void
  /** Joog: ícone de busca à direita (botão submit). */
  withSubmit?: boolean
}) {
  return (
    <>
      <input
        type="search"
        placeholder="Buscar produto"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Buscar produto"
      />
      {withSubmit ? (
        <button type="submit" className="loja-store-search-submit" aria-label="Buscar produto">
          <Search size={18} strokeWidth={2} />
        </button>
      ) : (
        <Search size={18} strokeWidth={2} aria-hidden />
      )}
    </>
  )
}

export function LojaOnlineLayout() {
  const { store, titulo, link, banners, bannerTamanho, bannerTamanhoMobile, slug, headerMobile } = useLojaOnlineStore()
  const { count, badgePulse, registerCartIcon, total: cartSubtotal, openCart } = useLojaOnlineCart()
  const { cliente } = useLojaOnlineClienteAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const isCheckoutPage = pathname === '/checkout' || pathname.endsWith('/checkout')
  const isColecaoPage = pathname.includes('/colecao/')
  const isProdutoPage = pathname.includes('/produto/')
  const isCategoriaPage = !!searchParams.get('categoria')
  const hideHomeVitrines = isCheckoutPage || isColecaoPage || isProdutoPage || isCategoriaPage
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchCollapsed, setSearchCollapsed] = useState(false)
  const searchFocusedRef = useRef(false)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const { menuCategorias, temSemCategoria, loading: categoriasLoading } = useLojaOnlineMenuCategorias()
  const logoHeader = resolveLojaOnlineLogoHeader(store)

  useLojaOnlineSeo(
    store
      ? {
          title: store.loja_online_seo_titulo?.trim() || titulo,
          description:
            store.loja_online_seo_descricao?.trim() ||
            store.loja_online_descricao?.trim() ||
            titulo,
          image: logoHeader,
          favicon: logoHeader,
          url: getLojaOnlineCanonicalUrl(slug, undefined, store.loja_online_dominio_custom),
        }
      : null,
    { keepStorefrontBrand: true }
  )

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    navigate(q ? link(`busca?q=${encodeURIComponent(q)}`) : link('busca'))
    setMenuOpen(false)
  }

  useEffect(() => {
    const root = document.getElementById('root')
    const readY = () => Math.max(window.scrollY || 0, root?.scrollTop || 0)

    let collapsed = false
    let lockedUntil = 0
    let lastY = readY()
    let upDistance = 0
    let raf = 0

    const apply = (next: boolean) => {
      if (next === collapsed) return
      collapsed = next
      lockedUntil = performance.now() + 400
      upDistance = 0
      setSearchCollapsed(next)
    }

    const tick = () => {
      raf = 0
      const y = readY()
      const delta = y - lastY
      lastY = y

      if (searchFocusedRef.current || search.trim()) {
        apply(false)
        return
      }
      if (performance.now() < lockedUntil) {
        lastY = readY()
        return
      }
      if (y <= 16) {
        apply(false)
        return
      }
      if (delta > 6) {
        upDistance = 0
        if (y > 40) apply(true)
      } else if (delta < -6) {
        upDistance += -delta
        if (upDistance > 36) apply(false)
      }
    }

    const onScroll = (event: Event) => {
      const target = event.target
      if (target !== root && target !== document && target !== document.documentElement) return
      if (!raf) raf = requestAnimationFrame(tick)
    }

    root?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root?.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [search])

  const freteGratis = lojaOnlineFreteGratisProgress(store, cartSubtotal)
  const showFreteBar = freteGratis.enabled && count > 0

  return (
    <div className={`loja-store-shell${isCheckoutPage ? ' loja-store-shell--checkout' : ''}`}>
      <LojaOnlineAnalytics />
      <LojaOnlineTracker />
      <div className="loja-store-top-sticky">
        <LojaOnlineAnnouncementBar />
        <div className="loja-store-header-group">
        <header
          className={`loja-store-header loja-store-header--joog loja-store-header--${headerMobile}${searchCollapsed ? ' loja-store-header--search-hidden' : ''}`}
        >
          <div className="loja-store-header-inner">
            <button
              type="button"
              className="loja-store-menu-toggle"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
              aria-controls="loja-store-menu-drawer"
            >
              <Menu size={24} strokeWidth={2} />
            </button>

            <Link to={link()} className="loja-store-brand" onClick={() => setMenuOpen(false)}>
              {logoHeader ? (
                <span
                  className="loja-store-brand-logo-wrap"
                  style={
                    {
                      '--loja-brand-mask': `url(${JSON.stringify(logoHeader)})`,
                    } as CSSProperties
                  }
                >
                  <img
                    src={logoHeader}
                    alt={titulo}
                    className="loja-store-brand-logo loja-store-brand-logo--source"
                  />
                  <span className="loja-store-brand-logo loja-store-brand-logo--tint" aria-hidden />
                </span>
              ) : (
                <span className="loja-store-brand-name">{titulo}</span>
              )}
            </Link>

            <form className="loja-store-search" onSubmit={submitSearch}>
              <LojaOnlineSearchFields value={search} onChange={setSearch} withSubmit />
            </form>

            <button
              type="button"
              className="loja-store-cart-btn"
              onClick={() => {
                setMenuOpen(false)
                openCart()
              }}
              ref={registerCartIcon}
              aria-label={count > 0 ? `Carrinho com ${count} ${count === 1 ? 'item' : 'itens'}` : 'Abrir carrinho'}
              aria-haspopup="dialog"
              aria-controls="loja-store-cart-drawer"
            >
              <LojaOnlineCartHeaderIcon size={24} />
              <span className={`loja-store-badge${badgePulse ? ' loja-store-badge--pulse' : ''}`}>
                {count}
              </span>
            </button>

            <nav className="loja-store-nav">
              <Link to={link()} onClick={closeMenu}>Início</Link>
              <button
                type="button"
                onClick={() => {
                  closeMenu()
                  openCart()
                }}
                className="loja-store-nav-cart"
                ref={registerCartIcon}
                aria-haspopup="dialog"
                aria-controls="loja-store-cart-drawer"
              >
                <LojaOnlineCartHeaderIcon size={22} />
                Carrinho
                {count > 0 && (
                  <span className={`loja-store-badge${badgePulse ? ' loja-store-badge--pulse' : ''}`}>
                    {count}
                  </span>
                )}
              </button>
              {cliente ? (
                <Link to={link('conta')} onClick={closeMenu}>
                  <User size={18} />
                  {cliente.nome.split(' ')[0]}
                </Link>
              ) : (
                <>
                  <Link to={link('entrar')} onClick={closeMenu}>Entrar</Link>
                  <Link to={link('cadastro')} className="loja-store-nav-cta" onClick={closeMenu}>
                    Criar conta
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="loja-store-search-slot">
            <div className="loja-store-search-slot-inner">
              <form
                className="loja-store-search-bar"
                onSubmit={submitSearch}
                aria-hidden={searchCollapsed}
                onFocus={() => {
                  searchFocusedRef.current = true
                  setSearchCollapsed(false)
                }}
                onBlur={(e) => {
                  const next = e.relatedTarget
                  if (!e.currentTarget.contains(next instanceof Node ? next : null)) {
                    searchFocusedRef.current = false
                  }
                }}
              >
                <LojaOnlineSearchFields value={search} onChange={setSearch} withSubmit />
              </form>
            </div>
          </div>
        </header>
        <LojaOnlineCategoriasMenu
          hidden={!!search.trim() || isCheckoutPage}
          menuCategorias={menuCategorias}
          temSemCategoria={temSemCategoria}
          loading={categoriasLoading}
        />
        </div>
      </div>

      {banners.length > 0 && !hideHomeVitrines && (
        <LojaOnlineBannerCarousel
          banners={banners}
          tamanho={bannerTamanho}
          tamanhoMobile={bannerTamanhoMobile}
        />
      )}

      {/* Joog: carrossel de categorias logo abaixo do hero/banner */}
      {!hideHomeVitrines && <LojaOnlineCategoriasSection search={search} />}

      {!hideHomeVitrines && <LojaOnlineFeaturedSection search={search} />}

      {!hideHomeVitrines && <LojaOnlineColecoesSection search={search} />}

      <main className="loja-store-main">
        <Outlet context={{ search }} />
      </main>

      <LojaOnlineFooter />
      {showFreteBar ? <LojaOnlineFreteGratisBar progress={freteGratis} /> : null}
      <LojaOnlineWhatsAppFloat />
      <LojaOnlineMenuDrawer
        open={menuOpen}
        onClose={closeMenu}
        menuCategorias={menuCategorias}
        temSemCategoria={temSemCategoria}
      />
      <LojaOnlineCartDrawer />
    </div>
  )
}

export type LojaOnlineOutletContext = { search: string }
