import { useEffect, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { User, X } from 'lucide-react'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { lojaOnlineForegroundOn, resolveLojaOnlineCorMenu, resolveLojaOnlineLogoHeader } from '../../lib/loja-online'
import {
  LOJA_ONLINE_SEM_CATEGORIA,
  type LojaOnlineMenuCategoria,
} from '../../lib/loja-online-categorias'

export function LojaOnlineMenuDrawer({
  open,
  onClose,
  menuCategorias,
  temSemCategoria,
}: {
  open: boolean
  onClose: () => void
  menuCategorias: LojaOnlineMenuCategoria[]
  temSemCategoria: boolean
}) {
  const { store, titulo, link, corPrimaria } = useLojaOnlineStore()
  const { cliente } = useLojaOnlineClienteAuth()
  const [searchParams] = useSearchParams()
  const ativa = searchParams.get('categoria')
  const closeRef = useRef<HTMLButtonElement>(null)
  const menuBg = store ? resolveLojaOnlineCorMenu(store) : '#ffffff'
  const menuFg = lojaOnlineForegroundOn(menuBg)
  const logoHeader = resolveLojaOnlineLogoHeader(store)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  const homePath = link()
  const categoriaTo = (categoria: string | null) =>
    categoria ? `${homePath}?categoria=${encodeURIComponent(categoria)}` : homePath

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      id="loja-store-menu-drawer"
      className={`loja-store-menu-drawer${open ? ' is-open' : ''}`}
      aria-hidden={!open}
      style={
        {
          '--loja-cor': corPrimaria,
          '--loja-menu-bg': menuBg,
          '--loja-menu-fg': menuFg,
        } as CSSProperties
      }
    >
      <div
        className="loja-store-menu-drawer-backdrop"
        onClick={onClose}
      />
      <aside
        className="loja-store-menu-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Menu da loja"
      >
        <div className="loja-store-menu-drawer-head">
          <Link to={homePath} className="loja-store-menu-drawer-brand" onClick={onClose}>
            {logoHeader ? (
              <img src={logoHeader} alt={titulo} />
            ) : (
              <span>{titulo}</span>
            )}
          </Link>
          <button
            ref={closeRef}
            type="button"
            className="loja-store-menu-drawer-close"
            onClick={onClose}
            aria-label="Fechar menu"
            tabIndex={open ? 0 : -1}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="loja-store-menu-drawer-nav" aria-label="Menu">
          <Link to={homePath} onClick={onClose} tabIndex={open ? 0 : -1}>
            Início
          </Link>
          {cliente ? (
            <Link to={link('conta')} onClick={onClose} tabIndex={open ? 0 : -1}>
              <User size={18} />
              {cliente.nome.split(' ')[0]}
            </Link>
          ) : (
            <>
              <Link to={link('entrar')} onClick={onClose} tabIndex={open ? 0 : -1}>
                Entrar
              </Link>
              <Link
                to={link('cadastro')}
                className="loja-store-menu-drawer-cta"
                onClick={onClose}
                tabIndex={open ? 0 : -1}
              >
                Criar conta
              </Link>
            </>
          )}
        </nav>

        {(menuCategorias.length > 0 || temSemCategoria) && (
          <div className="loja-store-menu-drawer-section">
            <p className="loja-store-menu-drawer-label">Categorias</p>
            <nav className="loja-store-menu-drawer-list" aria-label="Categorias">
              <Link
                to={categoriaTo(null)}
                className={!ativa ? 'is-active' : ''}
                onClick={onClose}
                tabIndex={open ? 0 : -1}
              >
                Todos
              </Link>
              {menuCategorias.map((cat) => (
                <Link
                  key={cat.id}
                  to={categoriaTo(cat.id)}
                  className={ativa === cat.id ? 'is-active' : ''}
                  onClick={onClose}
                  tabIndex={open ? 0 : -1}
                >
                  {cat.nome}
                </Link>
              ))}
              {temSemCategoria && (
                <Link
                  to={categoriaTo(LOJA_ONLINE_SEM_CATEGORIA)}
                  className={ativa === LOJA_ONLINE_SEM_CATEGORIA ? 'is-active' : ''}
                  onClick={onClose}
                  tabIndex={open ? 0 : -1}
                >
                  Outros
                </Link>
              )}
            </nav>
          </div>
        )}
      </aside>
    </div>,
    document.body
  )
}
