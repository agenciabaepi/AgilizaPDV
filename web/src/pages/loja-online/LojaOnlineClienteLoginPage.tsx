import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'

export function LojaOnlineClienteLoginPage() {
  const { link } = useLojaOnlineStore()
  const { login, cliente, loading: authLoading } = useLojaOnlineClienteAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? link('conta')

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email, senha)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return <p className="loja-catalogo-empty">Carregando…</p>
  }

  if (cliente) {
    return <Navigate to={from} replace />
  }

  return (
    <div className="loja-store-page loja-store-auth">
      <h1>Entrar</h1>
      <p className="loja-store-auth-sub">Acesse sua conta para acompanhar pedidos.</p>
      <form onSubmit={handleSubmit} className="loja-store-auth-form">
        <label className="input-wrap">
          <span className="input-label">E-mail</span>
          <input className="input-el" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="input-wrap">
          <span className="input-label">Senha</span>
          <input className="input-el" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </label>
        {error && <p className="loja-online-field-error">{error}</p>}
        <button type="submit" className="loja-store-btn-primary loja-store-btn-block" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="loja-store-auth-footer">
        Não tem conta? <Link to={link('cadastro')}>Criar conta</Link>
      </p>
    </div>
  )
}
