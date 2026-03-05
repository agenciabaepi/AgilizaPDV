import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { PageTitle } from '../components/ui'

export function Dashboard() {
  const { session } = useAuth()

  return (
    <Layout>
      <PageTitle
        title="Dashboard"
        subtitle={`Bem-vindo, ${session && 'nome' in session ? session.nome : ''}. Visão geral do PDV.`}
      />
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
        Use o menu acima para acessar Produtos, Clientes, Estoque, Caixa e PDV.
      </p>
    </Layout>
  )
}
