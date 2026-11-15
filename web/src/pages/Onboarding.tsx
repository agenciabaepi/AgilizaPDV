import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  FileKey2,
  Image,
  ShoppingBag,
  Upload,
  UserCircle,
  Users,
  X,
} from 'lucide-react'
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
import {
  getSetupWizardState,
  isSetupWizardPending,
  markSetupWizardDone,
  markSetupWizardPending,
} from '../lib/setup-wizard'
import {
  LOJA_ONLINE_DOMAIN,
  normalizeLojaOnlineSlug,
  validateLojaOnlineSlug,
} from '../lib/loja-online'
import { DEFAULT_MODULOS_BY_ROLE } from '../lib/modulos'

type StepId = 'empresa' | 'usuario' | 'equipe' | 'logo' | 'fiscal' | 'loja' | 'concluido'
type EquipeTamanho = '1' | '2-5' | '6+'

const MAX_CERT_MB = 5
const MAX_LOGO_BYTES = 500 * 1024

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

  const [equipeTamanho, setEquipeTamanho] = useState<EquipeTamanho | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const [novoLogin, setNovoLogin] = useState('')
  const [novoSenha, setNovoSenha] = useState('')
  const [equipeMsg, setEquipeMsg] = useState('')

  const [logo, setLogo] = useState<string | null>(null)

  const [emitirNotas, setEmitirNotas] = useState<boolean | null>(null)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [certSenha, setCertSenha] = useState('')
  const [certStatus, setCertStatus] = useState<{ hasCertificado: boolean; updatedAt: string | null }>({
    hasCertificado: false,
    updatedAt: null,
  })
  const certFileRef = useRef<HTMLInputElement>(null)

  const [habilitarLoja, setHabilitarLoja] = useState<boolean | null>(null)
  const [lojaSlug, setLojaSlug] = useState('')

  const steps = useMemo(() => {
    const list: { id: StepId; label: string; icon: React.ReactNode }[] = []
    if (isAdmin) {
      list.push({ id: 'empresa', label: 'Empresa', icon: <Building2 size={18} /> })
    }
    list.push({ id: 'usuario', label: 'Perfil', icon: <UserCircle size={18} /> })
    if (isAdmin) {
      list.push({ id: 'equipe', label: 'Equipe', icon: <Users size={18} /> })
      list.push({ id: 'logo', label: 'Logo', icon: <Image size={18} /> })
      list.push({ id: 'fiscal', label: 'Notas', icon: <FileKey2 size={18} /> })
      list.push({ id: 'loja', label: 'Loja', icon: <ShoppingBag size={18} /> })
    }
    list.push({ id: 'concluido', label: 'Pronto', icon: <CheckCircle2 size={18} /> })
    return list
  }, [isAdmin])

  const goNextFrom = useCallback(
    (current: StepId) => {
      const idx = steps.findIndex((s) => s.id === current)
      const next = steps[idx + 1]
      if (next) setStep(next.id)
    },
    [steps]
  )

  const goPrevFrom = useCallback(
    (current: StepId) => {
      const idx = steps.findIndex((s) => s.id === current)
      const prev = steps[idx - 1]
      if (prev) setStep(prev.id)
    },
    [steps]
  )

  const finishWizard = useCallback(() => {
    if (empresaId) markSetupWizardDone(empresaId)
    navigate('/dashboard', { replace: true })
  }, [empresaId, navigate])

  const loadData = useCallback(async () => {
    if (!empresaId || !userId) return
    setLoading(true)
    try {
      const [config, user, cert] = await Promise.all([
        window.electronAPI.empresas.getConfig(empresaId),
        window.electronAPI.usuarios.get(userId),
        typeof window.electronAPI?.certificado?.getStatus === 'function'
          ? window.electronAPI.certificado.getStatus(empresaId)
          : Promise.resolve({ hasCertificado: false, path: null, updatedAt: null }),
      ])
      if (config) {
        setNome(config.nome ?? '')
        setRazaoSocial(config.razao_social ?? '')
        setCnpj(config.cnpj ? formatCNPJ(config.cnpj) : '')
        setEmailEmpresa(config.email ?? '')
        setTelefone(config.telefone ? formatPhone(config.telefone) : '')
        setEndereco(config.endereco ?? '')
        setLogo(config.logo ?? null)
        const slug = (config as { loja_online_slug?: string | null }).loja_online_slug
        if (slug) {
          setLojaSlug(slug)
          setHabilitarLoja(true)
        }
        if ((config as { loja_online_ativa?: number | boolean }).loja_online_ativa) {
          setHabilitarLoja(true)
        }
      }
      if (user) {
        setNomeUsuario(user.nome ?? '')
        setEmailUsuario(user.email ?? '')
      } else if (session && 'nome' in session) {
        setNomeUsuario(session.nome ?? '')
        setEmailUsuario(session.email ?? '')
      }
      setCertStatus({
        hasCertificado: !!cert.hasCertificado,
        updatedAt: cert.updatedAt ?? null,
      })
      if (cert.hasCertificado) setEmitirNotas(true)
    } finally {
      setLoading(false)
    }
  }, [empresaId, userId, session])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!status || !empresaId) return

    // Após cadastro: garantir flag de pós-configuração
    if (!status.completo && isAdmin && getSetupWizardState(empresaId) == null) {
      markSetupWizardPending(empresaId)
    }

    if (status.completo && !isSetupWizardPending(empresaId)) {
      // Já terminou tudo — se entrou no onboarding, mostrar concluído
      setStep('concluido')
      return
    }

    if (isAdmin && !status.empresaCompleta) {
      setStep('empresa')
      return
    }
    if (!status.usuarioCompleto) {
      setStep('usuario')
      return
    }

    // Obrigatórios ok: entrar nos passos opcionais do pós-cadastro
    if (isAdmin && isSetupWizardPending(empresaId)) {
      setStep((prev) => {
        if (prev === 'empresa' || prev === 'usuario') return 'equipe'
        return prev
      })
    }
  }, [status, isAdmin, empresaId])

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
      goNextFrom('empresa')
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
      if (empresaId && isAdmin) {
        markSetupWizardPending(empresaId)
        goNextFrom('usuario')
      } else {
        if (empresaId) markSetupWizardDone(empresaId)
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar seu perfil.')
    } finally {
      setSaving(false)
    }
  }

  const saveEquipeContinue = () => {
    setError('')
    if (!equipeTamanho) {
      setError('Selecione quantas pessoas vão usar o sistema.')
      return
    }
    goNextFrom('equipe')
  }

  const addUsuarioRapido = async () => {
    if (!empresaId) return
    setError('')
    setEquipeMsg('')
    const nomeTrim = novoNome.trim()
    const loginTrim = novoLogin.trim().toLowerCase()
    if (!nomeTrim || !loginTrim || novoSenha.length < 6) {
      setError('Preencha nome, login e senha (mín. 6 caracteres) para adicionar.')
      return
    }
    setSaving(true)
    try {
      const modulos = DEFAULT_MODULOS_BY_ROLE.caixa
      await window.electronAPI.usuarios.create({
        empresa_id: empresaId,
        nome: nomeTrim,
        login: loginTrim,
        senha: novoSenha,
        role: 'caixa',
        modulos_json: JSON.stringify(modulos),
      })
      setNovoNome('')
      setNovoLogin('')
      setNovoSenha('')
      setEquipeMsg(`Usuário "${nomeTrim}" criado. Você pode adicionar mais ou continuar.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar usuário.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    setError('')
    if (!file) return
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      setError('Use PNG, JPG ou WebP.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const data = String(reader.result ?? '')
      if (data.length > MAX_LOGO_BYTES * 1.4) {
        setError('Imagem muito grande. Use até 500KB.')
        return
      }
      setLogo(data)
    }
    reader.readAsDataURL(file)
  }

  const saveLogo = async (skip: boolean) => {
    if (!empresaId) return
    setError('')
    if (skip) {
      goNextFrom('logo')
      return
    }
    setSaving(true)
    try {
      await window.electronAPI.empresas.updateConfig(empresaId, {
        logo: logo || null,
      })
      goNextFrom('logo')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar logotipo.')
    } finally {
      setSaving(false)
    }
  }

  const handleCertFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    e.target.value = ''
    setError('')
    if (!file) return
    if (file.size > MAX_CERT_MB * 1024 * 1024) {
      setError(`Arquivo muito grande. Máximo ${MAX_CERT_MB} MB.`)
      return
    }
    setCertFile(file)
  }

  const saveFiscal = async (skip: boolean) => {
    if (!empresaId) return
    setError('')
    if (skip || emitirNotas === false) {
      goNextFrom('fiscal')
      return
    }
    if (emitirNotas === null) {
      setError('Informe se você vai emitir notas fiscais.')
      return
    }
    if (certStatus.hasCertificado) {
      goNextFrom('fiscal')
      return
    }
    if (!certFile || !certSenha.trim()) {
      setError('Envie o certificado A1 e a senha, ou pule para configurar depois.')
      return
    }
    setSaving(true)
    try {
      const uploadCert = window.electronAPI.certificado.selectAndUpload as (
        empresaId: string,
        senha: string,
        file?: File
      ) => Promise<{ ok: boolean; error?: string }>
      const result = await uploadCert(empresaId, certSenha, certFile)
      if (!result.ok) {
        setError(result.error ?? 'Erro ao instalar certificado.')
        return
      }
      setCertStatus({ hasCertificado: true, updatedAt: new Date().toISOString() })
      setCertFile(null)
      setCertSenha('')
      goNextFrom('fiscal')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar certificado.')
    } finally {
      setSaving(false)
    }
  }

  const saveLoja = async (skip: boolean) => {
    if (!empresaId) return
    setError('')
    if (skip || habilitarLoja === false) {
      markSetupWizardDone(empresaId)
      setStep('concluido')
      return
    }
    if (habilitarLoja === null) {
      setError('Informe se deseja habilitar a loja online.')
      return
    }
    const normalized = lojaSlug.trim() ? normalizeLojaOnlineSlug(lojaSlug) : ''
    const slugErr = validateLojaOnlineSlug(normalized)
    if (!normalized) {
      setError('Informe o endereço (slug) da loja online.')
      return
    }
    if (slugErr) {
      setError(slugErr)
      return
    }
    setSaving(true)
    try {
      await window.electronAPI.empresas.updateConfig(empresaId, {
        loja_online_slug: normalized,
        loja_online_ativa: true,
        loja_online_titulo: nome.trim() || undefined,
      } as Parameters<typeof window.electronAPI.empresas.updateConfig>[1])
      markSetupWizardDone(empresaId)
      setStep('concluido')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao configurar loja online.')
    } finally {
      setSaving(false)
    }
  }

  if (!empresaId || !userId) {
    return (
      <AuthLayout subtitle="Complete seu cadastro para usar o Agiliza PDV.">
        <Alert variant="error">Faça login para continuar.</Alert>
      </AuthLayout>
    )
  }

  const stepIndex = steps.findIndex((s) => s.id === step)
  const slugPreview = lojaSlug.trim() ? normalizeLojaOnlineSlug(lojaSlug) : 'sua-loja'

  return (
    <AuthLayout wide subtitle="Finalize a configuração da sua loja. Leva poucos minutos.">
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
                  Usados na assinatura, notas fiscais e comunicação com clientes.
                </p>
                {status && status.camposEmpresaFaltando.length > 0 && (
                  <Alert variant="warning">Pendente: {status.camposEmpresaFaltando.join(', ')}</Alert>
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
                  <Input
                    label="E-mail"
                    type="email"
                    value={emailEmpresa}
                    onChange={(e) => setEmailEmpresa(e.target.value)}
                    required
                  />
                  <Input
                    label="Telefone"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    onBlur={() => setTelefone(formatPhone(telefone))}
                    inputMode="tel"
                    required
                  />
                  <div className="onboarding-form-grid__full">
                    <Input
                      label="Endereço"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      placeholder="Rua, número, bairro, cidade — UF"
                      required
                    />
                  </div>
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
                  <p className="onboarding-panel__desc">Pendências: {status.camposEmpresaFaltando.join(', ')}</p>
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
                  <Alert variant="warning">Pendente: {status.camposUsuarioFaltando.join(', ')}</Alert>
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
                  <Button
                    fullWidth
                    size="lg"
                    onClick={() => void saveUsuario()}
                    disabled={saving || (!isAdmin && status != null && !status.empresaCompleta)}
                    rightIcon={<ChevronRight size={18} />}
                  >
                    {saving ? 'Salvando...' : isAdmin ? 'Continuar' : 'Concluir cadastro'}
                  </Button>
                </div>
                {!isAdmin && status && !status.empresaCompleta && (
                  <p className="onboarding-panel__hint">
                    O cadastro só será liberado quando o administrador completar os dados da empresa.
                  </p>
                )}
              </div>
            )}

            {step === 'equipe' && isAdmin && (
              <div className="onboarding-panel">
                <h2 className="onboarding-panel__title">Equipe</h2>
                <p className="onboarding-panel__desc">
                  Quantas pessoas vão acessar o PDV e o painel? Você pode criar usuários agora ou depois em Usuários.
                </p>
                <div className="onboarding-choice-grid" role="radiogroup" aria-label="Tamanho da equipe">
                  {(
                    [
                      { id: '1' as const, title: 'Só eu', desc: 'Uso individual' },
                      { id: '2-5' as const, title: '2 a 5', desc: 'Pequena equipe' },
                      { id: '6+' as const, title: '6 ou mais', desc: 'Time maior' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`onboarding-choice${equipeTamanho === opt.id ? ' onboarding-choice--selected' : ''}`}
                      onClick={() => setEquipeTamanho(opt.id)}
                    >
                      <strong>{opt.title}</strong>
                      <span>{opt.desc}</span>
                    </button>
                  ))}
                </div>

                {equipeTamanho && equipeTamanho !== '1' && (
                  <div className="onboarding-subpanel">
                    <h3 className="onboarding-subpanel__title">Adicionar usuário (opcional)</h3>
                    <div className="onboarding-form-grid">
                      <Input label="Nome" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Nome do colaborador" />
                      <Input label="Login" value={novoLogin} onChange={(e) => setNovoLogin(e.target.value)} placeholder="login.acesso" autoComplete="off" />
                      <div className="onboarding-form-grid__full">
                        <Input
                          label="Senha provisória"
                          type="password"
                          value={novoSenha}
                          onChange={(e) => setNovoSenha(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                    <Button variant="secondary" onClick={() => void addUsuarioRapido()} disabled={saving}>
                      {saving ? 'Salvando...' : 'Adicionar usuário'}
                    </Button>
                    {equipeMsg && <Alert variant="success">{equipeMsg}</Alert>}
                  </div>
                )}

                {error && <Alert variant="error">{error}</Alert>}
                <div className="onboarding-actions">
                  <Button variant="outline" onClick={() => goPrevFrom('equipe')} disabled={saving}>
                    Voltar
                  </Button>
                  <Button fullWidth size="lg" onClick={saveEquipeContinue} disabled={saving} rightIcon={<ChevronRight size={18} />}>
                    Continuar
                  </Button>
                </div>
              </div>
            )}

            {step === 'logo' && isAdmin && (
              <div className="onboarding-panel">
                <h2 className="onboarding-panel__title">Logotipo</h2>
                <p className="onboarding-panel__desc">
                  Aparece no painel, no PDV e na identificação da loja. PNG ou JPG até 500KB.
                </p>
                <div className="onboarding-logo-row">
                  <div className="onboarding-logo-preview">
                    {logo ? (
                      <img src={logo} alt="Logo da empresa" />
                    ) : (
                      <span>Sem logo</span>
                    )}
                  </div>
                  <div className="onboarding-logo-actions">
                    <label className="btn btn--secondary btn--md onboarding-file-btn">
                      <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleLogoChange} hidden />
                      <Upload size={18} />
                      Enviar imagem
                    </label>
                    {logo && (
                      <Button variant="secondary" leftIcon={<X size={18} />} onClick={() => setLogo(null)}>
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
                {error && <Alert variant="error">{error}</Alert>}
                <div className="onboarding-actions">
                  <Button variant="outline" onClick={() => goPrevFrom('logo')} disabled={saving}>
                    Voltar
                  </Button>
                  <Button variant="ghost" onClick={() => void saveLogo(true)} disabled={saving}>
                    Pular
                  </Button>
                  <Button fullWidth size="lg" onClick={() => void saveLogo(false)} disabled={saving} rightIcon={<ChevronRight size={18} />}>
                    {saving ? 'Salvando...' : 'Continuar'}
                  </Button>
                </div>
              </div>
            )}

            {step === 'fiscal' && isAdmin && (
              <div className="onboarding-panel">
                <h2 className="onboarding-panel__title">Notas fiscais</h2>
                <p className="onboarding-panel__desc">
                  Vai emitir NF-e / NFC-e? Se sim, envie o certificado digital A1 (.pfx). Pode configurar depois.
                </p>
                <div className="onboarding-choice-grid" role="radiogroup" aria-label="Emitir notas">
                  <button
                    type="button"
                    className={`onboarding-choice${emitirNotas === true ? ' onboarding-choice--selected' : ''}`}
                    onClick={() => setEmitirNotas(true)}
                  >
                    <strong>Sim, vou emitir</strong>
                    <span>Configurar certificado A1</span>
                  </button>
                  <button
                    type="button"
                    className={`onboarding-choice${emitirNotas === false ? ' onboarding-choice--selected' : ''}`}
                    onClick={() => setEmitirNotas(false)}
                  >
                    <strong>Ainda não</strong>
                    <span>Configuro depois nas configurações</span>
                  </button>
                </div>

                {emitirNotas && (
                  <div className="onboarding-subpanel">
                    {certStatus.hasCertificado ? (
                      <Alert variant="success">
                        Certificado instalado
                        {certStatus.updatedAt
                          ? ` · atualizado em ${new Date(certStatus.updatedAt).toLocaleString('pt-BR')}`
                          : ''}
                      </Alert>
                    ) : (
                      <>
                        <label
                          className={`onboarding-cert-zone${certFile ? ' onboarding-cert-zone--has-file' : ''}`}
                          onClick={() => certFileRef.current?.click()}
                        >
                          <FileKey2 size={22} />
                          {certFile ? (
                            <>
                              <strong>{certFile.name}</strong>
                              <span>{(certFile.size / 1024).toFixed(1)} KB</span>
                            </>
                          ) : (
                            <>
                              <strong>Selecionar .pfx ou .p12</strong>
                              <span>Clique para escolher · máx. {MAX_CERT_MB} MB</span>
                            </>
                          )}
                          <input
                            ref={certFileRef}
                            type="file"
                            accept=".pfx,.p12,application/x-pkcs12"
                            onChange={handleCertFileChange}
                            hidden
                          />
                        </label>
                        <Input
                          type="password"
                          label="Senha do certificado"
                          value={certSenha}
                          onChange={(e) => setCertSenha(e.target.value)}
                          placeholder="Senha definida na emissão do certificado"
                          autoComplete="new-password"
                        />
                      </>
                    )}
                  </div>
                )}

                {error && <Alert variant="error">{error}</Alert>}
                <div className="onboarding-actions">
                  <Button variant="outline" onClick={() => goPrevFrom('fiscal')} disabled={saving}>
                    Voltar
                  </Button>
                  <Button variant="ghost" onClick={() => void saveFiscal(true)} disabled={saving}>
                    Pular
                  </Button>
                  <Button fullWidth size="lg" onClick={() => void saveFiscal(false)} disabled={saving} rightIcon={<ChevronRight size={18} />}>
                    {saving ? 'Salvando...' : 'Continuar'}
                  </Button>
                </div>
              </div>
            )}

            {step === 'loja' && isAdmin && (
              <div className="onboarding-panel">
                <h2 className="onboarding-panel__title">Loja online</h2>
                <p className="onboarding-panel__desc">
                  Quer vender pelo catálogo online? Defina o endereço da loja. Recursos avançados dependem do plano Ultra.
                </p>
                <div className="onboarding-choice-grid" role="radiogroup" aria-label="Loja online">
                  <button
                    type="button"
                    className={`onboarding-choice${habilitarLoja === true ? ' onboarding-choice--selected' : ''}`}
                    onClick={() => setHabilitarLoja(true)}
                  >
                    <strong>Sim, habilitar</strong>
                    <span>Escolher endereço da loja</span>
                  </button>
                  <button
                    type="button"
                    className={`onboarding-choice${habilitarLoja === false ? ' onboarding-choice--selected' : ''}`}
                    onClick={() => setHabilitarLoja(false)}
                  >
                    <strong>Agora não</strong>
                    <span>Posso ativar depois</span>
                  </button>
                </div>

                {habilitarLoja && (
                  <div className="onboarding-subpanel">
                    <Input
                      label="Endereço da loja"
                      value={lojaSlug}
                      onChange={(e) => setLojaSlug(e.target.value)}
                      onBlur={() => {
                        if (lojaSlug.trim()) setLojaSlug(normalizeLojaOnlineSlug(lojaSlug))
                      }}
                      placeholder="minha-loja"
                    />
                    <p className="onboarding-panel__hint">
                      Sua loja ficará em{' '}
                      <strong>
                        {slugPreview}.{LOJA_ONLINE_DOMAIN}
                      </strong>
                    </p>
                  </div>
                )}

                {error && <Alert variant="error">{error}</Alert>}
                <div className="onboarding-actions">
                  <Button variant="outline" onClick={() => goPrevFrom('loja')} disabled={saving}>
                    Voltar
                  </Button>
                  <Button variant="ghost" onClick={() => void saveLoja(true)} disabled={saving}>
                    Pular
                  </Button>
                  <Button fullWidth size="lg" onClick={() => void saveLoja(false)} disabled={saving}>
                    {saving ? 'Salvando...' : 'Finalizar'}
                  </Button>
                </div>
              </div>
            )}

            {step === 'concluido' && (
              <div className="onboarding-panel onboarding-panel--center">
                <CheckCircle2 size={48} className="onboarding-done-icon" strokeWidth={1.5} />
                <h2 className="onboarding-panel__title">Tudo pronto!</h2>
                <p className="onboarding-panel__desc">
                  Sua conta está configurada. Você pode ajustar logo, notas, loja online e usuários a qualquer momento nas configurações.
                </p>
                <Button fullWidth size="lg" onClick={finishWizard}>
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
