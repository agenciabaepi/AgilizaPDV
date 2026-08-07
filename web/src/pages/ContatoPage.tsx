import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LandingStaticPage } from '../components/landing/LandingStaticPage'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function ContatoPage() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviado, setEnviado] = useState(false)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const assunto = encodeURIComponent('Contato — Agiliza PDV')
    const corpo = encodeURIComponent(
      `Nome: ${nome}\nE-mail: ${email}\n\n${mensagem}`
    )
    window.location.href = `mailto:contato@agilizapdv.com.br?subject=${assunto}&body=${corpo}`
    setEnviado(true)
  }

  return (
    <LandingStaticPage
      eyebrow="Contato"
      title="Fale com nosso time"
      lead="Tire dúvidas sobre planos, implantação ou recursos do sistema. Respondemos o mais rápido possível."
    >
      <div className="landing-contact-grid">
        <div className="landing-static-block">
          <h2>Canais</h2>
          <ul className="landing-static-list landing-static-list--contact">
            <li>
              <strong>E-mail</strong>
              <a href="mailto:contato@agilizapdv.com.br">contato@agilizapdv.com.br</a>
            </li>
            <li>
              <strong>Horário</strong>
              <span>Segunda a sexta, das 9h às 18h</span>
            </li>
            <li>
              <strong>Comercial</strong>
              <span>Planos, demonstração e onboarding</span>
            </li>
            <li>
              <strong>Suporte</strong>
              <span>Clientes ativos: acesse pelo painel após o login</span>
            </li>
          </ul>
        </div>

        <form className="landing-contact-form" onSubmit={handleSubmit}>
          <Input
            label="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            autoComplete="name"
          />
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <label className="input-label" htmlFor="contato-mensagem">
            Mensagem
          </label>
          <textarea
            id="contato-mensagem"
            className="input-el landing-contact-textarea"
            rows={5}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            required
            placeholder="Como podemos ajudar?"
          />
          <Button type="submit" variant="primary">
            Enviar mensagem
          </Button>
          {enviado ? (
            <p className="landing-contact-note">
              Se o seu cliente de e-mail não abriu, escreva para{' '}
              <a href="mailto:contato@agilizapdv.com.br">contato@agilizapdv.com.br</a>.
            </p>
          ) : null}
        </form>
      </div>

      <div className="landing-static-actions">
        <Link to="/cadastro" className="btn btn--primary btn--md">
          Criar conta grátis
        </Link>
        <Link to="/" className="btn btn--outline btn--md">
          Voltar ao início
        </Link>
      </div>
    </LandingStaticPage>
  )
}
