import { useEffect } from 'react'
import { LandingStaticPage } from '../components/landing/LandingStaticPage'

export function TermosServicoPage() {
  useEffect(() => {
    const previous = document.title
    document.title = 'Termos de Serviço | Agiliza PDV'
    return () => {
      document.title = previous
    }
  }, [])

  return (
    <LandingStaticPage
      eyebrow="Termos"
      title="Termos de Serviço"
      lead="Estes termos regem o uso do Agiliza PDV, sistema web de PDV, gestão e loja online para o varejo."
    >
      <p className="landing-static-updated">Última atualização: 26 de setembro de 2026.</p>

      <div className="landing-static-block">
        <h2>Aceite</h2>
        <p>
          Ao criar uma conta, iniciar o teste ou usar o Agiliza PDV em{' '}
          <a href="https://agilizapdv.app">agilizapdv.app</a>, você concorda com estes termos e com a{' '}
          <a href="/politica-privacidade">Política de Privacidade</a>. Se você usa o sistema em nome
          de uma empresa, declara ter poderes para contratá-lo por ela.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>O serviço</h2>
        <p>
          O Agiliza PDV é um software acessado pelo navegador. Conforme o plano, ele inclui PDV,
          cadastros, estoque, financeiro, emissão fiscal e loja online. Os recursos de cada plano
          estão descritos na página de planos e podem ser ajustados com aviso no site.
        </p>
        <p>
          O sistema não substitui o contador da loja nem a obrigação do lojista de cumprir regras
          fiscais, de defesa do consumidor e de proteção de dados da própria operação.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Conta</h2>
        <ul className="landing-static-list">
          <li>O cadastro exige dados verdadeiros, inclusive CNPJ válido da empresa.</li>
          <li>O responsável pela conta deve guardar o acesso e as senhas dos usuários da equipe.</li>
          <li>Atividades feitas com o login da conta são de responsabilidade do lojista.</li>
          <li>Avise o suporte se suspeitar de uso indevido da conta.</li>
        </ul>
      </div>

      <div className="landing-static-block">
        <h2>Planos, teste e pagamento</h2>
        <p>
          Novas contas podem começar com período de teste gratuito, quando essa condição estiver
          vigente na página de planos. Depois do teste, o uso pago depende da confirmação da
          assinatura do plano escolhido.
        </p>
        <p>
          A cobrança da assinatura do Agiliza PDV é feita por PIX, por meio de processador de
          pagamento. A falta de pagamento pode suspender o acesso ao painel até a regularização. Troca
          de plano e pendências de cobrança são tratadas na área de assinatura ou pelo contato{' '}
          <a href="mailto:contato@agilizapdv.com.br">contato@agilizapdv.com.br</a>.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Uso aceitável</h2>
        <p>Não é permitido usar o Agiliza PDV para:</p>
        <ul className="landing-static-list">
          <li>Atividade ilícita, fraude ou emissão fiscal irregular.</li>
          <li>Acessar dados de outra conta sem autorização.</li>
          <li>Tentar invadir, sobrecarregar ou contornar a segurança do sistema.</li>
          <li>Revender o acesso ao software como se fosse produto próprio, salvo acordo escrito.</li>
        </ul>
      </div>

      <div className="landing-static-block">
        <h2>Dados e conteúdo da loja</h2>
        <p>
          Produtos, preços, fotos, clientes, vendas e textos da loja pertencem ao lojista. O Agiliza
          PDV recebe licença para hospedar e processar esse conteúdo apenas para prestar o serviço.
          O lojista responde pela legalidade do que publica e dos dados que cadastra.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Loja online e pagamentos de pedidos</h2>
        <p>
          A loja online, quando disponível no plano, é publicada pelo lojista. Preço, estoque, prazo,
          troca, entrega e atendimento ao comprador são de responsabilidade da loja.
        </p>
        <p>
          Pagamentos de pedidos feitos com Mercado Pago ocorrem na conta que o lojista configurar. O
          Agiliza PDV não é parte da venda entre a loja e o cliente final e não guarda o número
          completo do cartão.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Emissão fiscal</h2>
        <p>
          A emissão de NFC-e e NF-e depende de dados fiscais corretos, certificado digital válido e
          das regras do plano. O lojista é o emitente do documento fiscal e responde pelas
          informações enviadas à administração tributária.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Disponibilidade</h2>
        <p>
          Trabalhamos para manter o sistema disponível, mas o serviço pode ser interrompido para
          manutenção, falha de terceiros, caso fortuito ou força maior. Não garantimos operação
          ininterrupta nem que o sistema atenderá a uma exigência fiscal específica sem configuração
          correta da loja.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Propriedade intelectual</h2>
        <p>
          O software, a marca Agiliza PDV, o layout e o código permanecem de titularidade do Agiliza
          PDV. Estes termos não transferem propriedade do sistema ao lojista, apenas o direito de
          usá-lo enquanto a conta estiver regular.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Limitação de responsabilidade</h2>
        <p>
          Na extensão permitida pela lei brasileira, o Agiliza PDV não responde por lucros cessantes,
          decisões fiscais do lojista, conteúdo publicado na loja online ou falhas de meios de
          pagamento, internet e serviços de terceiros. Nada nestes termos afasta direitos do
          consumidor que não possam ser limitados por lei.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Encerramento</h2>
        <p>
          O lojista pode deixar de usar o serviço a qualquer momento. Podemos suspender ou encerrar
          uma conta em caso de inadimplência, uso ilícito ou violação destes termos. Dados podem ser
          mantidos pelo prazo necessário a obrigações legais, como descrito na Política de
          Privacidade.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Lei e foro</h2>
        <p>
          Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro
          da comarca do domicílio do responsável pelo Agiliza PDV, salvo foro obrigatório previsto em
          lei, inclusive o do consumidor quando aplicável.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Contato</h2>
        <p>
          Dúvidas sobre estes termos:{' '}
          <a href="mailto:contato@agilizapdv.com.br">contato@agilizapdv.com.br</a>.
        </p>
      </div>

      <div className="landing-static-actions">
        <a href="/politica-privacidade" className="btn btn--outline btn--md">
          Política de privacidade
        </a>
        <a href="/#/cadastro" className="btn btn--primary btn--md">
          Criar conta
        </a>
      </div>
    </LandingStaticPage>
  )
}
