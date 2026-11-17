import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineUgcAuth } from '../../hooks/useLojaOnlineUgcAuth'

export function LojaOnlineParceirosLoginPage() {
  const { store, link } = useLojaOnlineStore()
  const { login, criador, loading: authLoading } = useLojaOnlineUgcAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!store) return <p className="loja-catalogo-empty">Carregando…</p>
  if (Number(store.loja_online_ugc_ativo) !== 1) return <Navigate to={link('parceiros')} replace />
  if (authLoading) return <p className="loja-catalogo-empty">Carregando…</p>
  if (criador?.status === 'aprovado') return <Navigate to={link('parceiros/painel')} replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email, senha)
      navigate(link('parceiros/painel'), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="loja-store-page loja-store-auth">
      <h1>Área do parceiro</h1>
      <p className="loja-store-auth-sub">Entre para ver links, comissões e solicitar saque.</p>
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
        Ainda não é parceiro? <Link to={link('parceiros/cadastro')}>Cadastre-se</Link>
      </p>
    </div>
  )
}
