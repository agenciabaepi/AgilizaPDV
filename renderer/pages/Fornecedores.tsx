import { Layout } from '../components/Layout'
import { PageTitle, Card, CardBody } from '../components/ui'

export function Fornecedores() {
  return (
    <Layout>
      <PageTitle title="Fornecedores" subtitle="Cadastro de fornecedores (em breve)" />
      <Card style={{ width: '100%' }}>
        <CardBody>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            O cadastro de fornecedores será disponibilizado em uma próxima etapa.
          </p>
        </CardBody>
      </Card>
    </Layout>
  )
}
