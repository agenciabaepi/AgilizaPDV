import { Layout } from '../components/Layout'
import { PageTitle, Card, CardBody } from '../components/ui'

export function Clientes() {
  return (
    <Layout>
      <PageTitle title="Clientes" subtitle="Cadastro de clientes (em breve)" />
      <Card style={{ width: '100%' }}>
        <CardBody>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            O cadastro de clientes será disponibilizado em uma próxima etapa.
          </p>
        </CardBody>
      </Card>
    </Layout>
  )
}
