import { Link, Outlet, useNavigate } from 'react-router-dom'
import { ShoppingCart, User, Search, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineCart } from '../../hooks/useLojaOnlineCart'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { useLojaOnlineSeo } from '../../hooks/useLojaOnlineSeo'
import { getLojaOnlineCanonicalUrl } from '../../lib/loja-online-seo'
import { LojaOnlineAnnouncementBar } from './LojaOnlineAnnouncementBar'
import { LojaOnlineAnalytics } from './LojaOnlineAnalytics'
import { LojaOnlineBannerCarousel } from './LojaOnlineBannerCarousel'
import { LojaOnlineFeaturedSection } from './LojaOnlineFeaturedSection'
import { LojaOnlineCategoriasSection } from './LojaOnlineCategoriasSection'
import { LojaOnlineCategoriasMenu } from './LojaOnlineCategoriasMenu'
import { LojaOnlineFooter } from './LojaOnlineFooter'

export function LojaOnlineLayout() {
  const { store, titulo, link, banners, bannerTamanho, slug } = useLojaOnlineStore()
  const { count, badgePulse, registerCartIcon } = useLojaOnlineCart()
  const { cliente } = useLojaOnlineClienteAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')

  useLojaOnlineSeo(
    store
      ? {
          title: store.loja_online_seo_titulo?.trim() || titulo,
          description:
            store.loja_online_seo_descricao?.trim() ||
            store.loja_online_descricao?.trim() ||
            titulo,
          image: store.logo,
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

  return (
    <div className="loja-store-shell">
      <LojaOnlineAnalytics />
      <div className="loja-store-top-sticky">
        <LojaOnlineAnnouncementBar />
        <div className="loja-store-header-group">
        <header className="loja-store-header">
          <div className="loja-store-header-inner">
          <Link to={link()} className="loja-store-brand" onClick={() => setMenuOpen(false)}>
            {store?.logo ? (
              <img src={store.logo} alt={titulo} className="loja-store-brand-logo" />
            ) : (
              <span className="loja-store-brand-name">{titulo}</span>
            )}
          </Link>

          <form className="loja-store-search" onSubmit={submitSearch}>
            <Search size={18} />
            <input
              type="search"
              placeholder="Buscar produtos…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar produtos"
            />
          </form>

          <button
            type="button"
            className="loja-store-search-mobile"
            onClick={() => navigate(link('busca'))}
            aria-label="Buscar produtos"
          >
            <Search size={20} />
          </button>

          <nav className={`loja-store-nav ${menuOpen ? 'loja-store-nav--open' : ''}`}>
            <Link to={link()} onClick={() => setMenuOpen(false)}>Início</Link>
            <Link
              to={link('carrinho')}
              onClick={() => setMenuOpen(false)}
              className="loja-store-nav-cart"
              ref={registerCartIcon}
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
              <Link to={link('conta')} onClick={() => setMenuOpen(false)}>
                <User size={18} />
                {cliente.nome.split(' ')[0]}
              </Link>
            ) : (
              <>
                <Link to={link('entrar')} onClick={() => setMenuOpen(false)}>Entrar</Link>
                <Link to={link('cadastro')} className="loja-store-nav-cta" onClick={() => setMenuOpen(false)}>
                  Criar conta
                </Link>
              </>
            )}
          </nav>

          <button
            type="button"
            className="loja-store-menu-toggle"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        </header>
        <LojaOnlineCategoriasMenu hidden={!!search.trim()} />
        </div>
      </div>

      {banners.length > 0 && <LojaOnlineBannerCarousel banners={banners} tamanho={bannerTamanho} />}

      <LojaOnlineFeaturedSection search={search} />

      <LojaOnlineCategoriasSection search={search} />

      <main className="loja-store-main">
        <Outlet context={{ search }} />
      </main>

      <LojaOnlineFooter />
    </div>
  )
}

export type LojaOnlineOutletContext = { search: string }
