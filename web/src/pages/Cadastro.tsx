import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { AuthLayout } from '../components/AuthLayout'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import { formatCNPJ, formatPhone, isValidCNPJ, isValidEmail, isValidPhone, onlyDigits } from '../lib/validators'
import { lockDocumentScroll, unlockDocumentScroll } from '../lib/scroll-lock'
import { markSetupWizardPending } from '../lib/setup-wizard'

export function Cadastro() {
  const { session, register } = useAuth()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmSenha, setConfirmSenha] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (session && !('suporte' in session)) {
      navigate('/onboarding', { replace: true })
    }
  }, [session, navigate])

  useEffect(() => {
    lockDocumentScroll()
    return () => {
      unlockDocumentScroll()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')

    const nomeTrim = nome.trim()
    const nomeEmpresaTrim = nomeEmpresa.trim()
    const emailTrim = email.trim().toLowerCase()
    const telefoneDigits = onlyDigits(telefone)

    if (!nomeTrim) {
      setError('Informe o nome completo.')
      return
    }
    if (!nomeEmpresaTrim) {
      setError('Informe o nome da empresa.')
      return
    }
    if (!cnpj.trim()) {
      setError('Informe o CNPJ.')
      return
    }
    if (!isValidCNPJ(cnpj)) {
      setError('CNPJ inválido.')
      return
    }
    if (!telefoneDigits) {
      setError('Informe o telefone da empresa.')
      return
    }
    if (!isValidPhone(telefone)) {
      setError('Telefone inválido (use 10 ou 11 dígitos).')
      return
    }
    if (!emailTrim) {
      setError('Informe o e-mail.')
      return
    }
    if (!isValidEmail(emailTrim)) {
      setError('E-mail inválido.')
      return
    }
    if (senha.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.')
      return
    }
    if (senha !== confirmSenha) {
      setError('As senhas não coincidem.')
      return
    }

    setBusy(true)
    try {
      const ok = await register({
        nome: nomeTrim,
        nomeEmpresa: nomeEmpresaTrim,
        cnpj,
        email: emailTrim,
        senha,
        telefone: telefoneDigits,
      })
      if (ok) {
        const s = await window.electronAPI.auth.getSession()
        if (s && !('suporte' in s)) {
          markSetupWizardPending(s.empresa_id)
        }
        navigate('/onboarding', { replace: true })
      } else {
        setError('Não foi possível concluir o cadastro.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || 'Erro ao criar conta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout wide subtitle="Crie sua conta. Em seguida, finalizamos a configuração da loja juntos.">
      <form onSubmit={handleSubmit} className="login-form cadastro-form" style={{ marginTop: 'var(--space-5)' }}>
        <div className="cadastro-form-grid">
          <Input
            label="Nome completo"
            placeholder="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.currentTarget.value)}
            required
            autoComplete="name"
            disabled={busy}
          />
          <Input
            label="Nome da empresa"
            placeholder="Nome fantasia da loja"
            value={nomeEmpresa}
            onChange={(e) => setNomeEmpresa(e.currentTarget.value)}
            required
            autoComplete="organization"
            disabled={busy}
          />
          <Input
            label="CNPJ"
            placeholder="00.000.000/0001-00"
            value={cnpj}
            onChange={(e) => setCnpj(e.currentTarget.value)}
            onBlur={() => setCnpj(formatCNPJ(cnpj))}
            required
            inputMode="numeric"
            autoComplete="off"
            disabled={busy}
          />
          <Input
            label="Telefone / WhatsApp"
            placeholder="(00) 00000-0000"
            value={telefone}
            onChange={(e) => setTelefone(e.currentTarget.value)}
            onBlur={() => setTelefone(formatPhone(telefone))}
            required
            inputMode="tel"
            autoComplete="tel"
            disabled={busy}
          />
          <div className="cadastro-form-grid__full">
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
          </div>
          <Input
            label="Senha"
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={senha}
            onChange={(e) => setSenha(e.currentTarget.value)}
            required
            autoComplete="new-password"
            disabled={busy}
          />
          <Input
            label="Confirmar senha"
            type="password"
            placeholder="Repita a senha"
            value={confirmSenha}
            onChange={(e) => setConfirmSenha(e.currentTarget.value)}
            required
            autoComplete="new-password"
            disabled={busy}
          />
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <Button type="submit" fullWidth size="lg" disabled={busy}>
          {busy ? 'Criando conta...' : 'Criar conta'}
        </Button>
        <p className="login-auth-footer">
          Já tem conta?{' '}
          <Link to="/login" className="login-auth-link">
            Entrar
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
