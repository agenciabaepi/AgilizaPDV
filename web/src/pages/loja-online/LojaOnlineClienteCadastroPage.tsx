import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useLojaOnlineStore } from '../../hooks/useLojaOnlineStore'
import { useLojaOnlineClienteAuth } from '../../hooks/useLojaOnlineClienteAuth'

function maskCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function maskCep(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export function LojaOnlineClienteCadastroPage() {
  const { link } = useLojaOnlineStore()
  const { register, cliente, loading: authLoading } = useLojaOnlineClienteAuth()
  const navigate = useNavigate()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cep, setCep] = useState('')
  const [endereco, setEndereco] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (senha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (cpf.replace(/\D/g, '').length !== 11) {
      setError('Informe um CPF válido (11 dígitos).')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await register({ nome, email, senha, telefone, endereco, cpf_cnpj: cpf, cep })
      navigate(link('conta'), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return <p className="loja-catalogo-empty">Carregando…</p>
  }

  if (cliente) {
    return <Navigate to={link('conta')} replace />
  }

  return (
    <div className="loja-store-page loja-store-auth">
      <h1>Criar conta</h1>
      <p className="loja-store-auth-sub">Cadastre-se para comprar, acompanhar pedidos e usar cashback.</p>
      <form onSubmit={handleSubmit} className="loja-store-auth-form">
        <label className="input-wrap">
          <span className="input-label">Nome completo</span>
          <input className="input-el" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </label>
        <label className="input-wrap">
          <span className="input-label">CPF</span>
          <input className="input-el" value={maskCpf(cpf)} onChange={(e) => setCpf(e.target.value)} required />
        </label>
        <label className="input-wrap">
          <span className="input-label">E-mail</span>
          <input className="input-el" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="input-wrap">
          <span className="input-label">Senha</span>
          <input className="input-el" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </label>
        <label className="input-wrap">
          <span className="input-label">Telefone / WhatsApp</span>
          <input className="input-el" value={telefone} onChange={(e) => setTelefone(e.target.value)} required />
        </label>
        <label className="input-wrap">
          <span className="input-label">CEP</span>
          <input className="input-el" value={maskCep(cep)} onChange={(e) => setCep(e.target.value)} />
        </label>
        <label className="input-wrap">
          <span className="input-label">Endereço</span>
          <textarea className="input-el loja-online-textarea" rows={2} value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        </label>
        {error && <p className="loja-online-field-error">{error}</p>}
        <button type="submit" className="loja-store-btn-primary loja-store-btn-block" disabled={loading}>
          {loading ? 'Criando…' : 'Criar conta'}
        </button>
      </form>
      <p className="loja-store-auth-footer">
        Já tem conta? <Link to={link('entrar')}>Entrar</Link>
      </p>
    </div>
  )
}
