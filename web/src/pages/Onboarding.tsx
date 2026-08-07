import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, CheckCircle2, ChevronRight, UserCircle } from 'lucide-react'
import { AuthLayout } from '../components/AuthLayout'
import { Button, Input, Alert } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useOnboarding } from '../hooks/useOnboarding'
import {
  formatCNPJ,
  formatPhone,
  isValidCNPJ,
  isValidEmail,
  isValidPhone,
  onlyDigits,
} from '../lib/validators'

type StepId = 'empresa' | 'usuario' | 'concluido'

export function Onboarding() {
  const navigate = useNavigate()
  const { session, refreshSession } = useAuth()
  const { status, refresh } = useOnboarding()

  const empresaId = session && !('suporte' in session) ? session.empresa_id : null
  const userId = session && !('suporte' in session) ? session.id : null
  const isAdmin = session && 'role' in session && session.role?.toLowerCase() === 'admin'

  const [step, setStep] = useState<StepId>('empresa')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [nome, setNome] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [emailEmpresa, setEmailEmpresa] = useState('')
  const [telefone, setTelefone] = useState('')
  const [endereco, setEndereco] = useState('')

  const [nomeUsuario, setNomeUsuario] = useState('')
  const [emailUsuario, setEmailUsuario] = useState('')

  const steps = useMemo(() => {
    const list: { id: StepId; label: string; icon: React.ReactNode }[] = []
    if (isAdmin) {
      list.push({ id: 'empresa', label: 'Empresa', icon: <Building2 size={18} /> })
    }
    list.push({ id: 'usuario', label: 'Seu perfil', icon: <UserCircle size={18} /> })
    list.push({ id: 'concluido', label: 'Pronto', icon: <CheckCircle2 size={18} /> })
    return list
  }, [isAdmin])

  const loadData = useCallback(async () => {
    if (!empresaId || !userId) return
    setLoading(true)
    try {
      const [config, user] = await Promise.all([
        window.electronAPI.empresas.getConfig(empresaId),
        window.electronAPI.usuarios.get(userId),
      ])
      if (config) {
        setNome(config.nome ?? '')
        setRazaoSocial(config.razao_social ?? '')
        setCnpj(config.cnpj ? formatCNPJ(config.cnpj) : '')
        setEmailEmpresa(config.email ?? '')
        setTelefone(config.telefone ? formatPhone(config.telefone) : '')
        setEndereco(config.endereco ?? '')
      }
      if (user) {
        setNomeUsuario(user.nome ?? '')
        setEmailUsuario(user.email ?? '')
      } else if (session && 'nome' in session) {
        setNomeUsuario(session.nome ?? '')
        setEmailUsuario(session.email ?? '')
      }
    } finally {
      setLoading(false)
    }
  }, [empresaId, userId, session])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!status) return
    if (status.completo) {
      navigate('/dashboard', { replace: true })
      return
    }
    if (isAdmin && !status.empresaCompleta) {
      setStep('empresa')
      return
    }
    if (!status.usuarioCompleto) {
      setStep('usuario')
    }
  }, [status, isAdmin, navigate])

  const saveEmpresa = async () => {
    if (!empresaId) return
    setError('')

    const nomeTrim = nome.trim()
    const razaoTrim = razaoSocial.trim()
    const emailTrim = emailEmpresa.trim().toLowerCase()
    const cnpjDigits = onlyDigits(cnpj)

    if (!nomeTrim) {
      setError('Informe o nome fantasia da empresa.')
      return
    }
    if (!razaoTrim) {
      setError('Informe a razão social.')
      return
    }
    if (!cnpjDigits) {
      setError('Informe o CNPJ.')
      return
    }
    if (!isValidCNPJ(cnpjDigits)) {
      setError('CNPJ inválido. Verifique os números informados.')
      return
    }
    if (!emailTrim) {
      setError('Informe o e-mail da empresa.')
      return
    }
    if (!isValidEmail(emailTrim)) {
      setError('E-mail da empresa inválido.')
      return
    }
    if (!telefone.trim()) {
      setError('Informe o telefone da empresa.')
      return
    }
    if (!isValidPhone(telefone)) {
      setError('Telefone inválido (use 10 ou 11 dígitos).')
      return
    }
    if (!endereco.trim()) {
      setError('Informe o endereço da empresa.')
      return
    }

    setSaving(true)
    try {
      await window.electronAPI.empresas.updateConfig(empresaId, {
        nome: nomeTrim,
        razao_social: razaoTrim,
        cnpj: cnpjDigits,
        email: emailTrim,
        telefone: onlyDigits(telefone),
        endereco: endereco.trim(),
      })
      await refresh()
      setStep('usuario')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar dados da empresa.')
    } finally {
      setSaving(false)
    }
  }

  const saveUsuario = async () => {
    if (!userId) return
    setError('')

    const nomeTrim = nomeUsuario.trim()
    const emailTrim = emailUsuario.trim().toLowerCase()

    if (!nomeTrim) {
      setError('Informe seu nome completo.')
      return
    }
    if (!emailTrim) {
      setError('Informe seu e-mail.')
      return
    }
    if (!isValidEmail(emailTrim)) {
      setError('E-mail inválido.')
      return
    }

    setSaving(true)
    try {
      await window.electronAPI.usuarios.update(userId, {
        nome: nomeTrim,
        login: session && 'login' in session ? session.login : emailTrim.split('@')[0],
        email: emailTrim,
      })
      await refreshSession()
      await refresh()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar seu perfil.')
    } finally {
      setSaving(false)
    }
  }

  const finish = () => {
    navigate('/dashboard', { replace: true })
  }

  if (!empresaId || !userId) {
    return (
      <AuthLayout subtitle="Complete seu cadastro para usar o Agiliza PDV.">
        <Alert variant="error">Faça login para continuar.</Alert>
      </AuthLayout>
    )
  }

  const stepIndex = steps.findIndex((s) => s.id === step)

  return (
    <AuthLayout wide subtitle="Complete seu cadastro para usar o Agiliza PDV sem interrupções.">
      <div className="onboarding-wizard">
        <div className="onboarding-steps" aria-label="Progresso">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`onboarding-step${i <= stepIndex ? ' onboarding-step--active' : ''}${i === stepIndex ? ' onboarding-step--current' : ''}`}
            >
              <span className="onboarding-step__icon">{s.icon}</span>
              <span className="onboarding-step__label">{s.label}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <p className="onboarding-loading">Carregando dados...</p>
        ) : (
          <>
            {step === 'empresa' && isAdmin && (
              <div className="onboarding-panel">
                <h2 className="onboarding-panel__title">Dados da empresa</h2>
                <p className="onboarding-panel__desc">
                  Essas informações são usadas na assinatura, notas fiscais e comunicação com clientes.
                </p>
                {status && status.camposEmpresaFaltando.length > 0 && (
                  <Alert variant="warning">
                    Pendente: {status.camposEmpresaFaltando.join(', ')}
                  </Alert>
                )}
                <div className="onboarding-form-grid">
                  <Input label="Nome fantasia" value={nome} onChange={(e) => setNome(e.target.value)} required />
                  <Input label="Razão social" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} required />
                  <Input
                    label="CNPJ"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    onBlur={() => setCnpj(formatCNPJ(cnpj))}
                    inputMode="numeric"
                    required
                  />
                  <Input label="E-mail" type="email" value={emailEmpresa} onChange={(e) => setEmailEmpresa(e.target.value)} required />
                  <Input
                    label="Telefone"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    onBlur={() => setTelefone(formatPhone(telefone))}
                    inputMode="tel"
                    required
                  />
                  <Input
                    label="Endereço"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Rua, número, bairro, cidade"
                    className="onboarding-form-grid__full"
                    required
                  />
                </div>
                {error && <Alert variant="error">{error}</Alert>}
                <Button fullWidth size="lg" onClick={() => void saveEmpresa()} disabled={saving} rightIcon={<ChevronRight size={18} />}>
                  {saving ? 'Salvando...' : 'Continuar'}
                </Button>
              </div>
            )}

            {step === 'empresa' && !isAdmin && (
              <div className="onboarding-panel">
                <Alert variant="warning">
                  Os dados da empresa ainda não foram completados. Peça ao administrador para finalizar o cadastro.
                </Alert>
                {status && (
                  <p className="onboarding-panel__desc">
                    Pendências: {status.camposEmpresaFaltando.join(', ')}
                  </p>
                )}
                <Button fullWidth onClick={() => setStep('usuario')}>
                  Continuar para meu perfil
                </Button>
              </div>
            )}

            {step === 'usuario' && (
              <div className="onboarding-panel">
                <h2 className="onboarding-panel__title">Seu perfil</h2>
                <p className="onboarding-panel__desc">
                  Confirme seus dados de acesso. O e-mail também é usado para recuperação e comunicações.
                </p>
                {status && status.camposUsuarioFaltando.length > 0 && (
                  <Alert variant="warning">
                    Pendente: {status.camposUsuarioFaltando.join(', ')}
                  </Alert>
                )}
                <div className="onboarding-form-grid onboarding-form-grid--single">
                  <Input label="Nome completo" value={nomeUsuario} onChange={(e) => setNomeUsuario(e.target.value)} required />
                  <Input label="E-mail" type="email" value={emailUsuario} onChange={(e) => setEmailUsuario(e.target.value)} required />
                </div>
                {error && <Alert variant="error">{error}</Alert>}
                <div className="onboarding-actions">
                  {isAdmin && (
                    <Button variant="outline" onClick={() => setStep('empresa')} disabled={saving}>
                      Voltar
                    </Button>
                  )}
                  <Button fullWidth size="lg" onClick={() => void saveUsuario()} disabled={saving || (!isAdmin && status != null && !status.empresaCompleta)}>
                    {saving ? 'Salvando...' : 'Concluir cadastro'}
                  </Button>
                </div>
                {!isAdmin && status && !status.empresaCompleta && (
                  <p className="onboarding-panel__hint">
                    O cadastro só será liberado quando o administrador completar os dados da empresa.
                  </p>
                )}
              </div>
            )}

            {step === 'concluido' && (
              <div className="onboarding-panel onboarding-panel--center">
                <CheckCircle2 size={48} className="onboarding-done-icon" strokeWidth={1.5} />
                <h2 className="onboarding-panel__title">Tudo pronto!</h2>
                <p className="onboarding-panel__desc">
                  Seu cadastro está completo. Agora você pode usar o sistema, gerar PIX da assinatura e emitir documentos.
                </p>
                <Button fullWidth size="lg" onClick={finish}>
                  Ir para o painel
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AuthLayout>
  )
}
