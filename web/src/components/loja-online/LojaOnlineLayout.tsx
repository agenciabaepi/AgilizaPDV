import { Link, Outlet, useNavigate } from 'react-router-dom'
import { ShoppingCart, User, Search, Menu } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { useLojaOnlineMenuCategorias } from '../../hooks/useLojaOnlineMenuCategorias'
import { useLojaOnlineSeo } from '../../hooks/useLojaOnlineSeo'
import { getLojaOnlineCanonicalUrl } from '../../lib/loja-online-seo'
import { resolveLojaOnlineLogoHeader } from '../../lib/loja-online'
import { LojaOnlineAnnouncementBar } from './LojaOnlineAnnouncementBar'
import { LojaOnlineAnalytics } from './LojaOnlineAnalytics'
import { LojaOnlineBannerCarousel } from './LojaOnlineBannerCarousel'
import { LojaOnlineFeaturedSection } from './LojaOnlineFeaturedSection'
import { LojaOnlineCategoriasSection } from './LojaOnlineCategoriasSection'
import { LojaOnlineCategoriasMenu } from './LojaOnlineCategoriasMenu'
import { LojaOnlineMenuDrawer } from './LojaOnlineMenuDrawer'
import { LojaOnlineFooter } from './LojaOnlineFooter'

function LojaOnlineSearchFields({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <>
      <Search size={18} />
      <input
        type="search"
        placeholder="Buscar produtos…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Buscar produtos"
      />
    </>
  )
}

export function LojaOnlineLayout() {
  const { store, titulo, link, banners, bannerTamanho, bannerTamanhoMobile, slug, headerMobile } = useLojaOnlineStore()
  const { count, badgePulse, registerCartIcon } = useLojaOnlineCart()
  const { cliente } = useLojaOnlineClienteAuth()
  const navigate = useNavigate()
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
          url: getLojaOnlineCanonicalUrl(slug, undefined, store.loja_online_dominio_custom),
        }
      : null
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

  return (
    <div className="loja-store-shell">
      <LojaOnlineAnalytics />
      <div className="loja-store-top-sticky">
        <LojaOnlineAnnouncementBar />
        <div className="loja-store-header-group">
        <header
          className={`loja-store-header loja-store-header--${headerMobile}${searchCollapsed ? ' loja-store-header--search-hidden' : ''}`}
        >
          <div className="loja-store-header-inner">
          <Link to={link()} className="loja-store-brand" onClick={() => setMenuOpen(false)}>
            {logoHeader ? (
              <img src={logoHeader} alt={titulo} className="loja-store-brand-logo" />
            ) : (
              <span className="loja-store-brand-name">{titulo}</span>
            )}
          </Link>

          <form className="loja-store-search" onSubmit={submitSearch}>
            <LojaOnlineSearchFields value={search} onChange={setSearch} />
          </form>

          <Link
            to={link('carrinho')}
            className="loja-store-cart-btn"
            onClick={() => setMenuOpen(false)}
            ref={registerCartIcon}
            aria-label={count > 0 ? `Carrinho com ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho'}
          >
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className={`loja-store-badge${badgePulse ? ' loja-store-badge--pulse' : ''}`}>
                {count}
              </span>
            )}
          </Link>

          <nav className="loja-store-nav">
            <Link to={link()} onClick={closeMenu}>Início</Link>
            <Link
              to={link('carrinho')}
              onClick={closeMenu}
              className="loja-store-nav-cart"
            >
              <ShoppingCart size={18} />
              Carrinho
              {count > 0 && (
                <span className={`loja-store-badge${badgePulse ? ' loja-store-badge--pulse' : ''}`}>
                  {count}
                </span>
              )}
            </Link>
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

          <button
            type="button"
            className="loja-store-menu-toggle"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            aria-controls="loja-store-menu-drawer"
          >
            <Menu size={22} />
          </button>
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
                <LojaOnlineSearchFields value={search} onChange={setSearch} />
              </form>
            </div>
          </div>
        </header>
        <LojaOnlineCategoriasMenu
          hidden={!!search.trim()}
          menuCategorias={menuCategorias}
          temSemCategoria={temSemCategoria}
          loading={categoriasLoading}
        />
        </div>
      </div>

      {banners.length > 0 && (
        <LojaOnlineBannerCarousel
          banners={banners}
          tamanho={bannerTamanho}
          tamanhoMobile={bannerTamanhoMobile}
        />
      )}

      <LojaOnlineFeaturedSection search={search} />

      <LojaOnlineCategoriasSection search={search} />

      <main className="loja-store-main">
        <Outlet context={{ search }} />
      </main>

      <LojaOnlineFooter />
      <LojaOnlineMenuDrawer
        open={menuOpen}
        onClose={closeMenu}
        menuCategorias={menuCategorias}
        temSemCategoria={temSemCategoria}
      />
    </div>
  )
}

export type LojaOnlineOutletContext = { search: string }
