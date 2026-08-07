import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { AuthLayout } from '../components/AuthLayout'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'

export function Login() {
  const { session, loading, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!session) return
    if ('suporte' in session && session.suporte) {
      navigate('/configuracoes', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }, [session, navigate])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const ok = await login(email.trim(), senha)
      if (ok) navigate('/dashboard', { replace: true })
      else setError('E-mail ou senha inválidos.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || 'Erro ao autenticar.')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !session) {
    return (
      <AuthLayout>
        <div className="login-loading">Carregando...</div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout subtitle="Entre com seu e-mail e senha.">
      <form onSubmit={handleLogin} className="login-form" style={{ marginTop: 'var(--space-5)' }}>
        <Input
          label="E-mail"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
          autoComplete="email"
          disabled={busy}
        />
        <Input
          label="Senha"
          type="password"
          placeholder="Sua senha"
          value={senha}
          onChange={(e) => setSenha(e.currentTarget.value)}
          required
          autoComplete="current-password"
          disabled={busy}
        />
        {error && <Alert variant="error">{error}</Alert>}
        <Button type="submit" fullWidth size="lg" disabled={busy}>
          {busy ? 'Entrando...' : 'Entrar'}
        </Button>
        <p className="login-auth-footer">
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="login-auth-link">
            Criar conta
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
