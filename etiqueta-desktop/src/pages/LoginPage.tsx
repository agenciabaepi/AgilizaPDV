import { useState, type FormEvent } from 'react'
import logoAgiliza from '../assets/logo.svg'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

type Props = {
  onSuccess: () => void
  login: (email: string, senha: string) => Promise<unknown>
}

export function LoginPage({ onSuccess, login }: Props) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await login(email.trim(), senha)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao autenticar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card login-card--simple">
        <div className="login-card-inner">
          <div className="login-logo-box">
            <img src={logoAgiliza} alt="Agiliza" className="login-logo-image" />
          </div>
          <p className="login-card-subtitle" style={{ marginTop: 'var(--space-4)' }}>
            Entre com seu e-mail e senha.
          </p>
          <form onSubmit={handleSubmit} className="login-form" style={{ marginTop: 'var(--space-5)' }}>
            <Input
              label="E-mail"
              type="text"
              autoComplete="username"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
              disabled={busy}
            />
            <Input
              label="Senha"
              type="password"
              autoComplete="current-password"
              placeholder="Sua senha"
              value={senha}
              onChange={(e) => setSenha(e.currentTarget.value)}
              required
              disabled={busy}
            />
            {error ? <Alert variant="error">{error}</Alert> : null}
            <Button type="submit" fullWidth size="lg" disabled={busy}>
              {busy ? (
                <span className="login-btn-content login-btn-content--loading">
                  <span className="login-spinner" />
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
