import { Link } from 'react-router-dom'
import { LandingStaticPage } from '../components/landing/LandingStaticPage'

export function QuemSomosPage() {
  return (
    <LandingStaticPage
      eyebrow="Quem somos"
      title="Tecnologia web para o varejo brasileiro"
      lead="O Agiliza PDV nasceu para simplificar a operação de lojas que precisam vender rápido no balcão e crescer no digital — sem instalar nada."
    >
      <div className="landing-static-block">
        <h2>Nossa missão</h2>
        <p>
          Centralizar vendas, estoque, clientes e financeiro em um único sistema online, acessível de
          qualquer lugar, com planos que acompanham o tamanho do seu negócio.
        </p>
      </div>
      <div className="landing-static-block">
        <h2>O que entregamos</h2>
        <ul className="landing-static-list">
          <li>PDV web rápido para o dia a dia do caixa</li>
          <li>Gestão completa de produtos, clientes e fornecedores</li>
          <li>Fluxo de caixa integrado às vendas</li>
          <li>Emissão fiscal nos planos Pro e Ultra</li>
          <li>Loja online no plano Ultra</li>
        </ul>
      </div>
      <div className="landing-static-block">
        <h2>Para quem é</h2>
        <p>
          Lojas de varejo, boutiques, mercados de bairro e negócios que querem sair das planilhas e
          ganhar controle real da operação — com teste grátis de 7 dias para conhecer o sistema.
        </p>
      </div>
      <div className="landing-static-actions">
        <Link to="/cadastro" className="btn btn--primary btn--md">
          Começar teste grátis
        </Link>
        <Link to="/contato" className="btn btn--outline btn--md">
          Falar com a gente
        </Link>
      </div>
    </LandingStaticPage>
  )
}
