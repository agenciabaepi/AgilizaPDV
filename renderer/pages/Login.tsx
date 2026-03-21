import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Lottie from 'lottie-react'
import { useAuth } from '../hooks/useAuth'
import { useEmpresaTheme } from '../hooks/useEmpresaTheme'
import type { Empresa } from '../vite-env'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import uploadAnimation from '../../upload.json'
import logoAgiliza from '../../SVG/logo.svg'

export function Login() {
  const { session, loading, login, supportLogin } = useAuth()
  const { config: empresaTheme, setEmpresaIdForTheme } = useEmpresaTheme()
  const navigate = useNavigate()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [loginVal, setLoginVal] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [modoSuporte, setModoSuporte] = useState(false)
  const [authPhase, setAuthPhase] = useState<'idle' | 'updating' | 'signing'>('idle')
  const [showLoginAnimation, setShowLoginAnimation] = useState(false)
  const [installMode, setInstallMode] = useState<'server' | 'terminal' | 'unknown'>('unknown')
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [localIpv4s, setLocalIpv4s] = useState<string[]>([])
  const [terminalDiscoverBusy, setTerminalDiscoverBusy] = useState(false)
  const [terminalDiscoverError, setTerminalDiscoverError] = useState('')
  const [manualServerOpen, setManualServerOpen] = useState(false)
  const [manualServerUrl, setManualServerUrl] = useState('')
  const [pastTerminalGrace, setPastTerminalGrace] = useState(false)

  useEffect(() => {
    if (!session) return
    if ('suporte' in session && session.suporte) {
      navigate('/configuracoes', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }, [session, navigate])

  const isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined'

  useEffect(() => {
    if (!isElectron || !window.electronAPI?.empresas?.list) return
    window.electronAPI.empresas.list().then((list: Empresa[]) => {
      setEmpresas(list)
      if (list.length === 1) setEmpresaId(list[0].id)
    }).catch(() => setEmpresas([]))
  }, [isElectron])

  useEffect(() => {
    if (modoSuporte) {
      setEmpresaIdForTheme(empresas.length > 0 ? empresas[0].id : null)
    } else if (empresaId) {
      setEmpresaIdForTheme(empresaId)
    } else {
      setEmpresaIdForTheme(null)
    }
  }, [modoSuporte, empresaId, empresas, setEmpresaIdForTheme])
  useEffect(() => {
    if (!isElectron || typeof window.electronAPI?.app?.getInstallMode !== 'function') return
    window.electronAPI.app.getInstallMode().then(setInstallMode).catch(() => setInstallMode('unknown'))
  }, [isElectron])
  useEffect(() => {
    if (!isElectron || typeof window.electronAPI?.app?.getVersion !== 'function') return
    window.electronAPI.app.getVersion().then(setAppVersion).catch(() => setAppVersion(null))
  }, [isElectron])
  useEffect(() => {
    if (!isElectron || typeof window.electronAPI?.server?.getUrl !== 'function') return
    window.electronAPI.server.getUrl().then(setServerUrl).catch(() => setServerUrl(null))
  }, [isElectron])

  useEffect(() => {
    if (!isElectron || installMode !== 'terminal' || serverUrl) {
      setPastTerminalGrace(false)
      return
    }
    setPastTerminalGrace(false)
    const id = window.setTimeout(() => setPastTerminalGrace(true), 12000)
    return () => window.clearTimeout(id)
  }, [isElectron, installMode, serverUrl])

  useEffect(() => {
    if (!isElectron || installMode !== 'terminal' || serverUrl) return
    const id = window.setInterval(() => {
      void window.electronAPI.server.getUrl().then((u) => {
        if (u) setServerUrl(u)
      })
    }, 800)
    return () => window.clearInterval(id)
  }, [isElectron, installMode, serverUrl])

  useEffect(() => {
    if (!isElectron) return
    const sub = window.electronAPI.server.onUrlUpdated
    if (typeof sub !== 'function') return
    const unsub = sub((url) => setServerUrl(url))
    return () => {
      unsub()
    }
  }, [isElectron])

  useEffect(() => {
    if (!isElectron || installMode !== 'terminal') return
    void window.electronAPI.network.getLocalIPv4s().then(setLocalIpv4s).catch(() => setLocalIpv4s([]))
  }, [isElectron, installMode])

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
    if (authPhase !== 'idle') return
    setError('')
    const playAnimationBeforeLogin = async () => {
      setShowLoginAnimation(true)
      await new Promise((resolve) => setTimeout(resolve, 3000))
      setShowLoginAnimation(false)
    }
    const runPreLoginUpdate = async () => {
      if (!window.electronAPI?.sync?.run) return
      try {
        setAuthPhase('updating')
        await window.electronAPI.sync.run()
      } catch {
        // Falha de sync (ex.: offline) não deve bloquear o login
      }
    }
    if (modoSuporte) {
      setAuthPhase('updating')
      try {
        await playAnimationBeforeLogin()
        await runPreLoginUpdate()
        setAuthPhase('signing')
        const ok = await supportLogin(loginVal, senha)
        if (ok) navigate('/configuracoes', { replace: true })
        else setError('Login ou senha de suporte inválidos.')
      } finally {
        setAuthPhase('idle')
      }
      return
    }
    if (!empresaId) {
      setError('Selecione a empresa.')
      return
    }
    setAuthPhase('updating')
    try {
      await playAnimationBeforeLogin()
      await runPreLoginUpdate()
      setAuthPhase('signing')
      const ok = await login(empresaId, loginVal, senha)
      if (ok) navigate('/dashboard', { replace: true })
      else setError('Login ou senha inválidos.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg || 'Erro ao autenticar no modo web.')
    } finally {
      setAuthPhase('idle')
    }
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-loading">Carregando...</div>
      </div>
    )
  }
  const isBusy = authPhase !== 'idle' || showLoginAnimation
  const modeLabel =
    installMode === 'server'
      ? 'Servidor'
      : installMode === 'terminal'
        ? 'Terminal'
        : 'Nao identificado'
  const modeTitle =
    installMode === 'server'
      ? 'Este computador esta no modo Servidor'
      : installMode === 'terminal'
        ? 'Este computador esta no modo Terminal'
        : 'Modo nao identificado neste ambiente'
  const modeColor = installMode === 'server' ? '#065f46' : installMode === 'terminal' ? '#1d4ed8' : '#6b7280'
  const modeBackground =
    installMode === 'server'
      ? 'rgba(16, 185, 129, 0.15)'
      : installMode === 'terminal'
        ? 'rgba(59, 130, 246, 0.15)'
        : 'rgba(107, 114, 128, 0.15)'

  const renderShell = (children: React.ReactNode) => (
    <div className="login-page">
      <div className="login-card login-card--simple">
        {showLoginAnimation && (
          <div className="login-enter-overlay" aria-live="polite">
            <div className="login-enter-panel">
              <div className="login-enter-lottie-wrap">
                <Lottie
                  animationData={uploadAnimation}
                  loop
                  autoplay
                  className="login-enter-lottie"
                />
              </div>
              <h3 className="login-enter-title">Entrando no Agiliza</h3>
              <p className="login-enter-subtitle">Preparando ambiente e atualizando dados...</p>
              <div className="login-enter-progress">
                <span className="login-enter-progress-bar" />
              </div>
            </div>
          </div>
        )}
        <div className="login-card-inner">
          <div className="login-logo-box">
            <img src={empresaTheme?.logo ?? logoAgiliza} alt={empresaTheme?.nome ?? 'Agiliza'} className="login-logo-image" />
          </div>
          {appVersion && <p className="login-version">v{appVersion}</p>}
          <div
            title={modeTitle}
            style={{
              marginTop: 'var(--space-2)',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: modeColor,
              background: modeBackground
            }}
          >
            Modo: {modeLabel}
          </div>
          {children}
        </div>
      </div>
    </div>
  )

  const handleTerminalRetryDiscover = async (): Promise<void> => {
    if (!window.electronAPI?.server?.discover) return
    setTerminalDiscoverError('')
    setTerminalDiscoverBusy(true)
    try {
      console.log('[Login] Procurando servidor…')
      const r = await window.electronAPI.server.discover()
      if (r.found) {
        console.log('[Login] Servidor encontrado em', r.url)
        setServerUrl(r.url)
        return
      }
      const fallback = await window.electronAPI.server.getUrl()
      if (fallback) {
        setServerUrl(fallback)
        return
      }
      console.warn('[Login] Falha ao conectar / descobrir servidor')
      setTerminalDiscoverError(
        'Não foi possível localizar o servidor. Confira firewall (UDP 41234 e TCP da API, padrão 3000), Wi‑Fi isolado (AP) e se o PC servidor está ligado.'
      )
    } finally {
      setTerminalDiscoverBusy(false)
    }
  }

  const handleSaveManualServerUrl = async (): Promise<void> => {
    const u = manualServerUrl.trim()
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      setTerminalDiscoverError('Informe a URL completa (ex.: http://192.168.0.10:3000).')
      return
    }
    setTerminalDiscoverError('')
    await window.electronAPI.config.set({ serverUrl: u })
    const next = await window.electronAPI.server.getUrl()
    if (next) {
      setServerUrl(next)
      setManualServerOpen(false)
    } else {
      setTerminalDiscoverError('Não foi possível salvar a URL. Tente novamente.')
    }
  }

  if (installMode === 'terminal' && !serverUrl) {
    return renderShell(
      <>
        <p className="login-card-subtitle" style={{ marginTop: 'var(--space-4)' }}>
          {!pastTerminalGrace || terminalDiscoverBusy
            ? 'Procurando servidor na rede (pode levar até ~15 s na primeira vez)…'
            : 'Nenhum servidor encontrado na rede.'}
        </p>
        {localIpv4s.length > 0 && (
          <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            IP deste terminal: <strong>{localIpv4s.join(', ')}</strong>
          </p>
        )}
        <div style={{ marginTop: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button type="button" fullWidth variant="primary" disabled={terminalDiscoverBusy || isBusy} onClick={() => void handleTerminalRetryDiscover()}>
            {terminalDiscoverBusy ? 'Procurando servidor…' : 'Tentar novamente'}
          </Button>
          <Button
            type="button"
            fullWidth
            variant="secondary"
            disabled={isBusy}
            onClick={() => {
              setManualServerOpen((o) => !o)
              setTerminalDiscoverError('')
            }}
          >
            {manualServerOpen ? 'Ocultar configuração manual' : 'Configurar IP manualmente'}
          </Button>
        </div>
        {manualServerOpen && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Input
              label="URL do servidor"
              placeholder="http://192.168.0.10:3000"
              value={manualServerUrl}
              onChange={(e) => setManualServerUrl(e.currentTarget.value)}
              disabled={isBusy}
            />
            <Button type="button" fullWidth style={{ marginTop: 12 }} disabled={isBusy} onClick={() => void handleSaveManualServerUrl()}>
              Salvar e conectar
            </Button>
          </div>
        )}
        {(terminalDiscoverError || (pastTerminalGrace && !terminalDiscoverBusy)) && (
          <Alert variant="error" style={{ marginTop: 'var(--space-4)' }}>
            {terminalDiscoverError ||
              'Este terminal está no modo Terminal mas não encontrou o servidor da loja. Verifique se o computador servidor está ligado, na mesma rede e se o serviço da loja está em execução.'}
          </Alert>
        )}
      </>
    )
  }

  if (!modoSuporte && (empresas.length === 0 || !isElectron)) {
    return renderShell(
      <>
        <p className="login-card-subtitle" style={{ marginTop: 'var(--space-4)' }}>
          {isElectron
            ? 'Nenhuma empresa cadastrada. Use o acesso de suporte para criar a primeira empresa.'
            : 'Abra o aplicativo desktop Agiliza PDV para usar o sistema. No navegador não há acesso ao banco de dados.'}
        </p>
        <Alert variant="info" style={{ marginTop: 'var(--space-4)' }}>
          {isElectron
            ? 'Clique em \"Acesso suporte\" abaixo para entrar com o login de suporte e configurar o sistema.'
            : 'O banco de dados local só está disponível no app desktop.'}
        </Alert>
        {isElectron && installMode !== 'terminal' && (
          <button
            type="button"
            onClick={() => setModoSuporte(true)}
            className="login-support-toggle"
            disabled={isBusy}
          >
            Acesso suporte
          </button>
        )}
      </>
    )
  }

  return renderShell(
    <>
      <p className="login-card-subtitle" style={{ marginTop: 'var(--space-2)' }}>
        {modoSuporte ? 'Entre com o login de suporte.' : 'Entre com seu usuário para acessar o sistema.'}
      </p>
      <form onSubmit={handleLogin} className="login-form" style={{ marginTop: 'var(--space-5)' }}>
        {!modoSuporte && empresas.length > 1 && (
          <Select
            label="Empresa"
            required
            value={empresaId}
            onChange={(e) => setEmpresaId(e.currentTarget.value)}
            options={empresas.map((e) => ({ value: e.id, label: e.nome }))}
            placeholder="Selecione a empresa"
            disabled={isBusy}
          />
        )}
        <Input
          label="Login"
          placeholder={modoSuporte ? 'Login de suporte' : 'Seu login'}
          value={loginVal}
          onChange={(e) => setLoginVal(e.currentTarget.value)}
          required
          autoComplete="username"
          disabled={isBusy}
        />
        <Input
          label="Senha"
          type="password"
          placeholder="Sua senha"
          value={senha}
          onChange={(e) => setSenha(e.currentTarget.value)}
          required
          autoComplete="current-password"
          disabled={isBusy}
        />
        {error && <Alert variant="error">{error}</Alert>}
        <Button type="submit" fullWidth size="lg" disabled={isBusy}>
          <span className={isBusy ? 'login-btn-content login-btn-content--loading' : 'login-btn-content'}>
            {isBusy && <span className="login-spinner" />}
            {showLoginAnimation ? 'Carregando...' : authPhase === 'updating' ? 'Atualizando banco...' : authPhase === 'signing' ? 'Entrando...' : 'Entrar'}
          </span>
        </Button>
        {installMode !== 'terminal' && (
          <button
            type="button"
            onClick={() => { setModoSuporte(!modoSuporte); setError(''); setLoginVal(''); setSenha(''); }}
            className="login-support-toggle"
            disabled={isBusy}
          >
            {modoSuporte ? 'Voltar ao login normal' : 'Acesso suporte'}
          </button>
        )}
      </form>
    </>
  )
}
