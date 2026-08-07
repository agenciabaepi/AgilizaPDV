import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaasAuth } from '../../hooks/useSaasAuth'
import { AuthLayout } from '../../components/AuthLayout'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'

export function SaasLogin() {
  const { session, loading, login } = useSaasAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (session) navigate('/saas', { replace: true })
  }, [session, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const ok = await login(email.trim(), password)
      if (ok) navigate('/saas', { replace: true })
      else setError('Credenciais inválidas ou API SaaS não configurada.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao autenticar.')
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
    <AuthLayout subtitle="Painel de gestão SaaS — acesso restrito.">
      <form onSubmit={handleSubmit} className="login-form" style={{ marginTop: 'var(--space-5)' }}>
        <Input
          label="E-mail administrador"
          type="email"
          placeholder="admin@agilizapdv.app"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
          autoComplete="email"
          disabled={busy}
        />
        <Input
          label="Senha"
          type="password"
          placeholder="Senha do painel SaaS"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          required
          autoComplete="current-password"
          disabled={busy}
        />
        {error && <Alert variant="error">{error}</Alert>}
        <Button type="submit" fullWidth disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar no painel SaaS'}
        </Button>
      </form>
    </AuthLayout>
  )
}
