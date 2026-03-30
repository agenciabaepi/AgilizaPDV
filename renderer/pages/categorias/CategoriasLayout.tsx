import { NavLink, Outlet } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { PageTitle } from '../../components/ui'
import { FolderTree, LayoutGrid } from 'lucide-react'

export function CategoriasLayout() {
  return (
    <Layout>
      <PageTitle
        className="categorias-page-title"
        title="Categorias"
        subtitle="Grupos, categorias e subcategorias (até 3 níveis) e visualização dos produtos por classificação"
      />

      <div className="page-tabs-strip">
        <div className="form-tabs-list" role="tablist">
          <NavLink
            to="/categorias"
            end
            className={({ isActive }) => `form-tab-btn ${isActive ? 'form-tab-btn--active' : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
          >
            <FolderTree size={18} />
            Estrutura
          </NavLink>
          <NavLink
            to="/categorias/mapa"
            className={({ isActive }) => `form-tab-btn ${isActive ? 'form-tab-btn--active' : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
          >
            <LayoutGrid size={18} />
            Mapa de produtos
          </NavLink>
        </div>
      </div>

      <Outlet />
    </Layout>
  )
}
