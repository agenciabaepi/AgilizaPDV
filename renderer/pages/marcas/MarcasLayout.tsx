import { NavLink, Outlet } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { PageTitle } from '../../components/ui'
import { List, LayoutGrid } from 'lucide-react'

export function MarcasLayout() {
  return (
    <Layout>
      <PageTitle
        className="categorias-page-title"
        title="Marcas"
        subtitle="Cadastro de marcas dos produtos e mapa de estoque por marca"
      />

      <div className="page-tabs-strip">
        <div className="form-tabs-list" role="tablist">
          <NavLink
            to="/marcas"
            end
            className={({ isActive }) => `form-tab-btn ${isActive ? 'form-tab-btn--active' : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
          >
            <List size={18} />
            Cadastro
          </NavLink>
          <NavLink
            to="/marcas/mapa"
            className={({ isActive }) => `form-tab-btn ${isActive ? 'form-tab-btn--active' : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
          >
            <LayoutGrid size={18} />
            Mapa por marca
          </NavLink>
        </div>
      </div>

      <Outlet />
    </Layout>
  )
}
