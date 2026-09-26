import { useEffect } from 'react'
import { LandingStaticPage } from '../components/landing/LandingStaticPage'

export function PoliticaPrivacidadePage() {
  useEffect(() => {
    const previous = document.title
    document.title = 'Política de Privacidade | Agiliza PDV'
    return () => {
      document.title = previous
    }
  }, [])

  return (
    <LandingStaticPage
      eyebrow="Privacidade"
      title="Política de Privacidade"
      lead="Esta política explica como o Agiliza PDV trata dados pessoais de quem usa o sistema e de quem compra nas lojas online publicadas por ele."
    >
      <p className="landing-static-updated">Última atualização: 26 de setembro de 2026.</p>

      <div className="landing-static-block">
        <h2>Quem é o responsável</h2>
        <p>
          O Agiliza PDV é um sistema web de ponto de venda, gestão e loja online, disponível em{' '}
          <a href="https://agilizapdv.app">agilizapdv.app</a>. Para assuntos de privacidade, escreva para{' '}
          <a href="mailto:contato@agilizapdv.com.br">contato@agilizapdv.com.br</a>.
        </p>
        <p>
          Em relação à conta da loja, planos e uso do painel, o Agiliza PDV atua como controlador. Em
          relação aos clientes finais da loja online, o lojista é o controlador dos dados da operação
          dele, e o Agiliza PDV trata esses dados como operador, para prestar o serviço contratado.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Dados que coletamos</h2>
        <ul className="landing-static-list">
          <li>
            <strong>Conta e empresa:</strong> nome, e-mail, senha, nome da empresa, CNPJ e, quando
            preenchidos, endereço, telefone e demais dados cadastrais da loja.
          </li>
          <li>
            <strong>Operação:</strong> produtos, estoque, clientes, fornecedores, vendas, caixa,
            financeiro, usuários da equipe e registros necessários para o funcionamento do PDV.
          </li>
          <li>
            <strong>Assinatura:</strong> plano escolhido, status da cobrança e dados de pagamento
            tratados pelo processador (PIX). Não armazenamos a senha bancária do lojista.
          </li>
          <li>
            <strong>Notas fiscais:</strong> dados fiscais da empresa e, quando enviados, o certificado
            digital A1. A senha do certificado é armazenada de forma criptografada.
          </li>
          <li>
            <strong>Loja online:</strong> dados informados pelo comprador para cadastro, pedido,
            entrega e pagamento, além de avaliações e mensagens enviadas à loja.
          </li>
          <li>
            <strong>Uso técnico:</strong> registros de acesso, identificador de sessão e dados de
            navegação usados para manter o login, a segurança e o funcionamento do site.
          </li>
        </ul>
      </div>

      <div className="landing-static-block">
        <h2>Para que usamos os dados</h2>
        <ul className="landing-static-list">
          <li>Criar e autenticar a conta, liberar o teste e operar o plano contratado.</li>
          <li>Processar vendas, estoque, financeiro, comissões e emissão de documentos fiscais.</li>
          <li>Publicar a loja online, receber pedidos e encaminhar pagamentos ao meio escolhido pela loja.</li>
          <li>Cobrar a assinatura, prevenir fraude e cumprir obrigações legais.</li>
          <li>Responder contatos e comunicar avisos sobre a conta ou o serviço.</li>
        </ul>
        <p>
          As bases usadas, conforme o caso, são a execução do contrato, o cumprimento de obrigação
          legal e o legítimo interesse em manter o serviço seguro e funcional.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Com quem os dados são compartilhados</h2>
        <p>Compartilhamos dados apenas com quem precisa deles para o serviço funcionar:</p>
        <ul className="landing-static-list">
          <li>Infraestrutura de hospedagem e banco de dados que mantém o sistema no ar.</li>
          <li>Processador de pagamento da assinatura do Agiliza PDV, para cobrança via PIX.</li>
          <li>
            Mercado Pago, quando a loja ativa esse meio na loja online. O pagamento do pedido é
            processado na conta Mercado Pago configurada pelo próprio lojista.
          </li>
          <li>
            Autoridades fiscais e prestadores ligados à emissão de NFC-e e NF-e, quando a loja emite
            documento fiscal.
          </li>
          <li>Autoridades públicas, quando houver obrigação legal ou ordem válida.</li>
        </ul>
        <p>Não vendemos dados pessoais.</p>
      </div>

      <div className="landing-static-block">
        <h2>Loja online</h2>
        <p>
          Cada loja publicada no Agiliza PDV é operada pelo lojista. Cabe a ele informar aos clientes
          a política de privacidade, os termos, as trocas e a entrega da própria loja. O comprador da
          loja online se relaciona com o lojista para pedidos, entregas e atendimento.
        </p>
        <p>
          Dados de cartão informados no checkout do Mercado Pago são tratados por esse processador.
          O Agiliza PDV não guarda o número completo do cartão.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Por quanto tempo guardamos</h2>
        <p>
          Mantemos os dados enquanto a conta estiver ativa e pelo prazo necessário para cumprir
          obrigações legais, fiscais e de defesa de direitos. Dados da operação da loja permanecem
          disponíveis ao lojista enquanto a conta existir. Depois do encerramento, podemos reter o
          mínimo exigido por lei ou para resolver pendências de cobrança e segurança.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Segurança</h2>
        <p>
          Usamos conexão criptografada (HTTPS), controle de acesso por conta e criptografia da senha
          do certificado digital. Nenhum sistema é livre de risco. O lojista deve proteger o acesso
          dos usuários da equipe e as credenciais de integrações, como Mercado Pago.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Cookies e armazenamento local</h2>
        <p>
          Usamos armazenamento no navegador para manter a sessão de login e preferências necessárias
          ao funcionamento do painel e da loja online. Não usamos esse mecanismo para vender perfis
          de navegação a terceiros.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Direitos de quem tem dados pessoais</h2>
        <p>
          Você pode pedir confirmação de tratamento, acesso, correção, portabilidade, informação
          sobre compartilhamentos e, quando cabível, exclusão ou oposição. Pedidos da conta do
          Agiliza PDV podem ser enviados para{' '}
          <a href="mailto:contato@agilizapdv.com.br">contato@agilizapdv.com.br</a>. Pedidos sobre uma
          compra feita em uma loja online devem ser direcionados primeiro ao lojista responsável
          pela loja.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Crianças e adolescentes</h2>
        <p>
          O Agiliza PDV é um serviço para empresas. Não coletamos intencionalmente dados de crianças.
          Se você acredita que dados de um menor foram enviados sem a base adequada, entre em contato
          para que possamos avaliar a exclusão.
        </p>
      </div>

      <div className="landing-static-block">
        <h2>Alterações</h2>
        <p>
          Esta política pode ser atualizada quando o serviço ou a lei mudarem. A data no topo da
          página indica a versão vigente. O uso continuado do Agiliza PDV depois da publicação vale
          como ciência da versão atual.
        </p>
      </div>

      <div className="landing-static-actions">
        <a href="/termos-servico" className="btn btn--outline btn--md">
          Termos de serviço
        </a>
        <a href="/#/contato" className="btn btn--primary btn--md">
          Falar com a gente
        </a>
      </div>
    </LandingStaticPage>
  )
}
