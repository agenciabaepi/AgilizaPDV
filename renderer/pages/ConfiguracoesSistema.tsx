import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LayoutSuporte } from '../components/LayoutSuporte'
import { PageTitle, Card, CardHeader, CardBody, Button, Input, Alert, Select, useToast } from '../components/ui'
import {
  Settings,
  FolderOpen,
  Save,
  CloudUpload,
  CloudDownload,
  ArchiveRestore,
  Search,
  Server,
  Store,
  Database,
  Download,
  Import,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { BackupRegistryEntry } from '../vite-env'

const backupCloudTableHeadCell: CSSProperties = {
  position: 'sticky',
  top: 0,
  background: 'var(--color-surface)',
  zIndex: 1,
  boxShadow: '0 1px 0 var(--color-border)',
  padding: '8px 12px',
}

export function ConfiguracoesSistema() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [dbPath, setDbPath] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [syncOnChange, setSyncOnChange] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [dbFolder, setDbFolder] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [backupLoading, setBackupLoading] = useState<string | null>(null)
  const [discoveringServer, setDiscoveringServer] = useState(false)
  const [installMode, setInstallMode] = useState<'server' | 'terminal' | 'unknown'>('unknown')
  const modeLabel = installMode === 'server' ? 'Servidor' : installMode === 'terminal' ? 'Terminal' : 'Nao identificado'
  const [updateState, setUpdateState] = useState<{
    phase: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
    message?: string
    version?: string
    percent?: number
  }>({ phase: 'idle' })
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateActionMessage, setUpdateActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([])
  const [empresaRecuperar, setEmpresaRecuperar] = useState('')
  const [recuperarMessage, setRecuperarMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [recuperando, setRecuperando] = useState(false)
  const [empresaBackupSelected, setEmpresaBackupSelected] = useState('')
  const [backupsList, setBackupsList] = useState<BackupRegistryEntry[]>([])
  const [backupListLoading, setBackupListLoading] = useState(false)
  const [backupDownloadingId, setBackupDownloadingId] = useState<string | null>(null)
  const [backupSuporteMessage, setBackupSuporteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [runBackupLoading, setRunBackupLoading] = useState(false)
  const [empresasBackupOptions, setEmpresasBackupOptions] = useState<{ id: string; nome: string }[]>([])
  const [empresasBackupOptionsLoaded, setEmpresasBackupOptionsLoaded] = useState(false)
  const [sqliteImportPath, setSqliteImportPath] = useState<string | null>(null)
  const [sqliteImportResolvedPath, setSqliteImportResolvedPath] = useState('')
  const [sqliteImportEmpresas, setSqliteImportEmpresas] = useState<{ id: string; nome: string }[]>([])
  const [sqliteImportSelectedIds, setSqliteImportSelectedIds] = useState<string[]>([])
  const [sqliteImportListLoading, setSqliteImportListLoading] = useState(false)
  const [sqliteImportRunning, setSqliteImportRunning] = useState(false)
  const [sqliteImportDbUrl, setSqliteImportDbUrl] = useState('')
  const [sqliteImportMessage, setSqliteImportMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  )

  const isSuporte = session && 'suporte' in session && session.suporte
  const toast = useToast()

  const loadSyncCounts = useCallback(() => {
    window.electronAPI.sync.getPendingCount().then(setPendingCount)
    window.electronAPI.sync.getErrorCount().then(setErrorCount)
  }, [])

  useEffect(() => {
    if (!isSuporte) {
      navigate('/dashboard', { replace: true })
      return
    }
    setEmpresasBackupOptionsLoaded(false)
    const loadLocal = window.electronAPI.empresas.list().then((list: { id: string; nome: string }[]) => list).catch(() => [] as { id: string; nome: string }[])
    const loadSupabase = typeof window.electronAPI?.backup?.listEmpresasSupabase === 'function'
      ? window.electronAPI.backup.listEmpresasSupabase().then((list) => list).catch(() => [] as { id: string; nome: string }[])
      : Promise.resolve([] as { id: string; nome: string }[])
    Promise.all([loadLocal, loadSupabase]).then(([localList, supabaseList]) => {
      setEmpresas(localList)
      const byId = new Map<string, { id: string; nome: string }>()
      localList.forEach((e) => byId.set(e.id, e))
      supabaseList.forEach((e) => { if (!byId.has(e.id)) byId.set(e.id, e) })
      const merged = Array.from(byId.values()).sort((a, b) => a.nome.localeCompare(b.nome))
      setEmpresasBackupOptions(merged)
      setEmpresasBackupOptionsLoaded(true)
      if (localList.length === 1) setEmpresaRecuperar(localList[0].id)
      if (merged.length === 1) setEmpresaBackupSelected(merged[0].id)
    })
    window.electronAPI.config.get().then((c) => {
      setDbPath(c?.dbPath ?? '')
      setServerUrl(c?.serverUrl ?? '')
      setSyncOnChange(c?.syncOnChange !== false)
    })
    window.electronAPI.app.getInstallMode().then(setInstallMode).catch(() => setInstallMode('unknown'))
    window.electronAPI.backup.getDbPath().then((r) => setDbFolder(r.folder ?? null))
    window.electronAPI.app.getUpdateState().then(setUpdateState).catch(() => undefined)
    const unsubUpdate = window.electronAPI.app.onUpdateStatusChange?.((payload) => setUpdateState(payload))
    loadSyncCounts()
    return () => {
      unsubUpdate?.()
    }
  }, [isSuporte, navigate, loadSyncCounts])

  const loadSqliteImportEmpresas = useCallback(async () => {
    const api = window.electronAPI?.importSqliteToPostgres
    if (!api) return
    setSqliteImportListLoading(true)
    setSqliteImportMessage(null)
    try {
      const r = await api.listEmpresas(sqliteImportPath)
      setSqliteImportResolvedPath(r.path)
      if (r.ok) {
        setSqliteImportEmpresas(r.empresas)
        setSqliteImportSelectedIds([])
      } else {
        setSqliteImportEmpresas([])
        setSqliteImportMessage({ type: 'error', text: r.error })
      }
    } catch (err) {
      setSqliteImportEmpresas([])
      setSqliteImportMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao ler o SQLite.',
      })
    } finally {
      setSqliteImportListLoading(false)
    }
  }, [sqliteImportPath])

  useEffect(() => {
    if (!isSuporte || typeof window.electronAPI?.importSqliteToPostgres?.listEmpresas !== 'function') return
    void loadSqliteImportEmpresas()
  }, [isSuporte, loadSqliteImportEmpresas])

  // Atualiza contadores ao voltar para a aba/janela e a cada 5s
  useEffect(() => {
    if (!isSuporte) return
    const onFocus = () => loadSyncCounts()
    window.addEventListener('focus', onFocus)
    const interval = setInterval(loadSyncCounts, 5000)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [isSuporte, loadSyncCounts])

  useEffect(() => {
    if (!isSuporte || !empresaBackupSelected || typeof window.electronAPI?.backup?.listBackupsByEmpresa !== 'function') {
      setBackupsList([])
      return
    }
    setBackupListLoading(true)
    window.electronAPI.backup.listBackupsByEmpresa(empresaBackupSelected).then(setBackupsList).catch(() => setBackupsList([])).finally(() => setBackupListLoading(false))
  }, [isSuporte, empresaBackupSelected])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const r = await window.electronAPI.config.set({
        dbPath: dbPath.trim() || null,
        serverUrl: serverUrl.trim() || null
      })
      if (!r.ok) {
        setMessage({ type: 'error', text: r.error ?? 'Erro ao salvar.' })
        return
      }
      setMessage({
        type: 'success',
        text: 'Configuração salva. Reinicie o aplicativo para aplicar alterações de pasta do banco.'
      })
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDiscoverServer = async () => {
    setDiscoveringServer(true)
    setMessage(null)
    try {
      const result = await window.electronAPI.server.discover()
      if (!result.found) {
        setMessage({ type: 'error', text: 'Nenhum servidor encontrado na rede local.' })
        return
      }
      setServerUrl(result.url)
      setMessage({ type: 'success', text: `Servidor encontrado: ${result.name} (${result.url})` })
    } finally {
      setDiscoveringServer(false)
    }
  }

  const handleOpenDbFolder = async () => {
    const r = await window.electronAPI.backup.openDbFolder()
    if (!r.ok) setBackupMessage({ type: 'error', text: r.error ?? 'Erro ao abrir pasta' })
  }

  const handleExportToFolder = async () => {
    setBackupLoading('export')
    setBackupMessage(null)
    try {
      const r = await window.electronAPI.backup.exportToFolder()
      if (r.ok) setBackupMessage({ type: 'success', text: r.path ? `Backup salvo em: ${r.path}` : 'Backup salvo.' })
      else setBackupMessage({ type: 'error', text: r.error ?? 'Erro ao salvar backup' })
    } finally {
      setBackupLoading(null)
    }
  }

  const handleUploadToSupabase = async () => {
    setBackupLoading('upload')
    setBackupMessage(null)
    try {
      const r = await window.electronAPI.backup.uploadToSupabase()
      if (r.ok) setBackupMessage({ type: 'success', text: 'Backup enviado para a nuvem com sucesso.' })
      else setBackupMessage({ type: 'error', text: r.error ?? 'Erro ao enviar backup' })
    } finally {
      setBackupLoading(null)
    }
  }

  const handleRestoreFromFile = async () => {
    setBackupLoading('restoreFile')
    setBackupMessage(null)
    try {
      const r = await window.electronAPI.backup.restoreFromFile()
      if (r.ok) setBackupMessage({ type: 'success', text: 'Backup restaurado. Recarregue a página (F5) para usar os dados.' })
      else setBackupMessage({ type: 'error', text: r.error ?? 'Erro ao restaurar' })
    } finally {
      setBackupLoading(null)
    }
  }

  const handleRestoreFromSupabase = async () => {
    setBackupLoading('restoreCloud')
    setBackupMessage(null)
    try {
      const r = await window.electronAPI.backup.restoreFromSupabase()
      if (r.ok) setBackupMessage({ type: 'success', text: 'Backup da nuvem restaurado. Recarregue a página (F5) para usar os dados.' })
      else setBackupMessage({ type: 'error', text: r.error ?? 'Erro ao restaurar' })
    } finally {
      setBackupLoading(null)
    }
  }

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true)
    setUpdateActionMessage(null)
    try {
      const state = await window.electronAPI.app.checkForUpdates()
      setUpdateState(state)
      if (state.phase === 'available' || state.phase === 'downloading' || state.phase === 'downloaded') {
        toast.addToast('success', state.message ?? 'Nova versão disponível.')
      } else if (state.phase === 'not-available') {
        toast.addToast('info', state.message ?? 'Aplicativo já está atualizado.')
      } else if (state.phase === 'error') {
        toast.addToast('error', state.message ?? 'Erro ao verificar atualização.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao verificar atualizacao.'
      setUpdateActionMessage({ type: 'error', text: message })
      toast.addToast('error', message)
    } finally {
      setCheckingUpdate(false)
    }
  }

  const handleInstallUpdateNow = async () => {
    setUpdateActionMessage(null)
    try {
      const result = await window.electronAPI.app.installUpdateNow()
      setUpdateActionMessage({ type: result.ok ? 'success' : 'error', text: result.message })
      toast.addToast(result.ok ? 'success' : 'error', result.message)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao instalar atualizacao.'
      setUpdateActionMessage({ type: 'error', text: message })
      toast.addToast('error', message)
    }
  }

  const handleRetryErrors = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const result = await window.electronAPI.sync.resetErrorsAndRun()
      setSyncMessage(result.message)
      loadSyncCounts()
    } finally {
      setSyncing(false)
    }
  }

  const handlePullFromSupabase = async () => {
    setPulling(true)
    setSyncMessage(null)
    try {
      const result = await window.electronAPI.sync.pullFromSupabase()
      setSyncMessage(result.message)
      loadSyncCounts()
    } finally {
      setPulling(false)
    }
  }

  if (!isSuporte) return null

  return (
    <LayoutSuporte>
      <PageTitle
        title="Configurações do sistema"
        subtitle="Acesso restrito ao suporte. Altere com cuidado."
      />
      <div className="suporte-config-stack">
        <Alert variant="info">
          Modo instalado neste computador: <strong>{modeLabel}</strong>.
        </Alert>

        <Card className="page-card suporte-config-card">
          <CardHeader>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Store size={20} />
              Configurar loja
            </span>
          </CardHeader>
          <CardBody>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
              Personalize dados da empresa, logo, cor do sistema e módulos para cada loja.
            </p>
            <Link to="/configuracoes/loja">
              <Button variant="secondary" leftIcon={<Store size={18} />}>
                Abrir Configurar Loja
              </Button>
            </Link>
          </CardBody>
        </Card>

        <Card className="page-card suporte-config-card">
          <CardHeader>Recuperar acesso da empresa</CardHeader>
          <CardBody>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
              Se o usuário <strong>admin</strong> não conseguir entrar (ex.: após sincronizar com o Supabase), selecione a empresa e clique no botão para criar ou redefinir o usuário admin com senha <strong>admin</strong>. Abaixo do botão aparecerá uma mensagem de sucesso ou erro. Se nada aparecer, reinicie o app e tente de novo.
            </p>
            <Select
              label="Empresa"
              value={empresaRecuperar}
              onChange={(e) => setEmpresaRecuperar(e.target.value)}
              options={empresas.map((e) => ({ value: e.id, label: e.nome }))}
              placeholder="Selecione a empresa"
              style={{ marginBottom: 12, maxWidth: 320 }}
            />
            <Button
              onClick={async () => {
                if (!empresaRecuperar) return
                if (typeof window.electronAPI?.auth?.ensureAdminUser !== 'function') {
                  setRecuperarMessage({ type: 'error', text: 'Função não disponível. Reinicie o app e tente de novo.' })
                  return
                }
                setRecuperando(true)
                setRecuperarMessage(null)
                try {
                  const r = await window.electronAPI.auth.ensureAdminUser(empresaRecuperar)
                  setRecuperarMessage({ type: r.ok ? 'success' : 'error', text: r.message })
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err)
                  setRecuperarMessage({ type: 'error', text: msg || 'Erro ao executar. Tente novamente.' })
                } finally {
                  setRecuperando(false)
                }
              }}
              disabled={recuperando || !empresaRecuperar}
            >
              {recuperando ? 'Aplicando…' : 'Criar ou redefinir admin (login: admin, senha: admin)'}
            </Button>
            {recuperarMessage && (
              <Alert variant={recuperarMessage.type} style={{ marginTop: 12 }}>
                {recuperarMessage.text}
              </Alert>
            )}
          </CardBody>
        </Card>

        <Card className="page-card suporte-config-card">
          <CardHeader>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={20} />
              Backups na nuvem (por empresa)
            </span>
          </CardHeader>
          <CardBody>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
              Backups automáticos do banco local são enviados ao Supabase Storage por empresa. Selecione uma empresa para listar e baixar backups (somente suporte).
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
              {!empresasBackupOptionsLoaded ? (
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Carregando empresas…</span>
              ) : empresasBackupOptions.length === 0 ? (
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Nenhuma empresa no banco local nem no Supabase. Cadastre uma empresa no modo PDV ou verifique a configuração do Supabase (env.install).</span>
              ) : (
                <Select
                  label="Empresa"
                  value={empresaBackupSelected}
                  onChange={(e) => setEmpresaBackupSelected(e.target.value)}
                  options={empresasBackupOptions.map((e) => ({ value: e.id, label: e.nome }))}
                  placeholder="Selecione a empresa"
                  style={{ minWidth: 220 }}
                />
              )}
              {typeof window.electronAPI?.backup?.runManualBackupForEmpresa === 'function' && (
                <Button
                  variant="secondary"
                  leftIcon={<CloudUpload size={18} />}
                  onClick={async () => {
                    if (!empresaBackupSelected) return
                    setRunBackupLoading(true)
                    setBackupSuporteMessage(null)
                    try {
                      const r = await window.electronAPI.backup.runManualBackupForEmpresa(empresaBackupSelected)
                      setBackupSuporteMessage({
                        type: r.ok ? 'success' : 'error',
                        text: r.ok ? 'Backup da empresa enviado com sucesso.' : (r.error ?? 'Erro ao executar backup.')
                      })
                      if (r.ok) {
                        const list = await window.electronAPI.backup.listBackupsByEmpresa(empresaBackupSelected)
                        setBackupsList(list)
                      }
                    } catch {
                      setBackupSuporteMessage({ type: 'error', text: 'Erro ao executar backup.' })
                    } finally {
                      setRunBackupLoading(false)
                    }
                  }}
                  disabled={runBackupLoading || !empresaBackupSelected}
                >
                  {runBackupLoading ? 'Enviando…' : 'Fazer backup desta empresa'}
                </Button>
              )}
              {typeof window.electronAPI?.backup?.runAutoBackup === 'function' && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    setRunBackupLoading(true)
                    setBackupSuporteMessage(null)
                    try {
                      const r = await window.electronAPI.backup.runAutoBackup()
                      setBackupSuporteMessage({
                        type: r.ok ? 'success' : 'error',
                        text: r.ok ? `Backup enviado para ${r.count ?? 0} empresa(s).` : (r.error ?? 'Erro ao executar backup.')
                      })
                      if (r.ok && empresaBackupSelected) {
                        const list = await window.electronAPI.backup.listBackupsByEmpresa(empresaBackupSelected)
                        setBackupsList(list)
                      }
                    } catch {
                      setBackupSuporteMessage({ type: 'error', text: 'Erro ao executar backup.' })
                    } finally {
                      setRunBackupLoading(false)
                    }
                  }}
                  disabled={runBackupLoading}
                >
                  {runBackupLoading ? 'Enviando…' : 'Backup de todas as empresas'}
                </Button>
              )}
            </div>
            {backupSuporteMessage && (
              <Alert variant={backupSuporteMessage.type} style={{ marginBottom: 12 }}>
                {backupSuporteMessage.text}
              </Alert>
            )}
            {empresaBackupSelected && (
              <>
                {backupListLoading ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Carregando backups…</p>
                ) : backupsList.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Nenhum backup registrado para esta empresa.</p>
                ) : (
                  <div
                    style={{
                      maxHeight: 'min(52vh, 380px)',
                      overflowY: 'auto',
                      overflowX: 'auto',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      WebkitOverflowScrolling: 'touch',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <th style={{ ...backupCloudTableHeadCell, textAlign: 'left' }}>Data</th>
                          <th style={{ ...backupCloudTableHeadCell, textAlign: 'right' }}>Tamanho</th>
                          <th style={{ ...backupCloudTableHeadCell, textAlign: 'left' }}>Status</th>
                          <th style={backupCloudTableHeadCell} />
                        </tr>
                      </thead>
                      <tbody>
                        {backupsList.map((b) => (
                          <tr key={b.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '8px 12px' }}>
                              {new Date(b.backup_date).toLocaleString('pt-BR')}
                            </td>
                            <td style={{ textAlign: 'right', padding: '8px 12px' }}>
                              {b.file_size_bytes != null ? `${(b.file_size_bytes / 1024 / 1024).toFixed(2)} MB` : '—'}
                            </td>
                            <td style={{ padding: '8px 12px' }}>{b.status}</td>
                            <td style={{ padding: '8px 12px' }}>
                              {typeof window.electronAPI?.backup?.downloadBackup === 'function' && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  leftIcon={<Download size={14} />}
                                  onClick={async () => {
                                    setBackupDownloadingId(b.id)
                                    setBackupSuporteMessage(null)
                                    try {
                                      const r = await window.electronAPI.backup.downloadBackup(b.file_path)
                                      setBackupSuporteMessage(r.ok ? { type: 'success', text: 'Backup salvo.' } : { type: 'error', text: r.error ?? 'Erro ao baixar.' })
                                    } catch {
                                      setBackupSuporteMessage({ type: 'error', text: 'Erro ao baixar.' })
                                    } finally {
                                      setBackupDownloadingId(null)
                                    }
                                  }}
                                  disabled={backupDownloadingId === b.id}
                                >
                                  {backupDownloadingId === b.id ? 'Baixando…' : 'Baixar'}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>

        <Card className="page-card suporte-config-card">
          <CardHeader>Atualizacao do aplicativo</CardHeader>
          <CardBody>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              {updateState.message ?? 'Verifique e aplique novas versoes sem reinstalar manualmente.'}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={handleCheckUpdate} disabled={checkingUpdate}>
                {checkingUpdate ? 'Verificando...' : 'Verificar atualizacoes'}
              </Button>
              {updateState.phase === 'downloaded' && (
                <Button onClick={handleInstallUpdateNow}>
                  Reiniciar e instalar agora
                </Button>
              )}
            </div>
            {updateActionMessage && (
              <Alert variant={updateActionMessage.type} style={{ marginTop: 8 }}>
                {updateActionMessage.text}
              </Alert>
            )}
          </CardBody>
        </Card>

        <Card className="page-card suporte-config-card">
          <CardHeader>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={20} />
              Pasta do banco de dados
            </span>
          </CardHeader>
          <CardBody>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
              Caminho da pasta onde o arquivo <code>pdv.db</code> é salvo. Deixe em branco para usar a pasta padrão do aplicativo.
            </p>
            <Input
              label="Pasta"
              placeholder="Ex.: C:\Dados\AgilizaPDV"
              value={dbPath}
              onChange={(e) => setDbPath(e.currentTarget.value)}
              style={{ marginBottom: 16 }}
            />
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
            {message && (
              <Alert variant={message.type} style={{ marginTop: 16 }}>
                {message.text}
              </Alert>
            )}
          </CardBody>
        </Card>

        {typeof window.electronAPI?.importSqliteToPostgres?.run === 'function' && (
          <Card className="page-card suporte-config-card suporte-config-card--full">
            <CardHeader>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Import size={20} />
                Importar SQLite (pdv.db) para o Postgres do servidor
              </span>
            </CardHeader>
            <CardBody>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
                Use na máquina onde roda o store-server. Os dados são enviados direto ao Postgres (mesma conexão de{' '}
                <code>DATABASE_URL</code> no <code>store-server.env</code>). Linhas com o mesmo <code>id</code> são
                atualizadas (<code>ON CONFLICT</code>). Selecione uma ou mais empresas do arquivo SQLite.
              </p>
              <p
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-sm)',
                  marginBottom: 12,
                  wordBreak: 'break-all',
                }}
              >
                <strong>Arquivo:</strong> {sqliteImportResolvedPath || '…'}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={sqliteImportListLoading}
                  onClick={() => {
                    setSqliteImportPath(null)
                  }}
                >
                  Usar pdv.db da pasta configurada
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<FolderOpen size={18} />}
                  disabled={sqliteImportListLoading}
                  onClick={async () => {
                    const r = await window.electronAPI.importSqliteToPostgres.pickSqliteFile()
                    if (r.ok && 'path' in r) {
                      setSqliteImportPath(r.path)
                    }
                  }}
                >
                  Escolher arquivo…
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={sqliteImportListLoading}
                  onClick={() => void loadSqliteImportEmpresas()}
                >
                  {sqliteImportListLoading ? 'Carregando…' : 'Recarregar lista'}
                </Button>
              </div>
              <Input
                label="DATABASE_URL (opcional)"
                placeholder="Vazio = store-server.env ou padrão local"
                value={sqliteImportDbUrl}
                onChange={(e) => setSqliteImportDbUrl(e.target.value)}
                style={{ marginBottom: 16 }}
              />
              {sqliteImportListLoading ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Lendo empresas…</p>
              ) : sqliteImportEmpresas.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                  Nenhuma empresa encontrada neste arquivo (ou arquivo inacessível).
                </p>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginBottom: 12,
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Empresas no SQLite</span>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setSqliteImportSelectedIds(sqliteImportEmpresas.map((e) => e.id))}
                    >
                      Selecionar todas
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setSqliteImportSelectedIds([])}>
                      Limpar
                    </Button>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      maxHeight: 'min(40vh, 280px)',
                      overflowY: 'auto',
                      marginBottom: 16,
                      padding: '4px 0',
                    }}
                  >
                    {sqliteImportEmpresas.map((e) => {
                      const checked = sqliteImportSelectedIds.includes(e.id)
                      return (
                        <label
                          key={e.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            cursor: 'pointer',
                            fontSize: 'var(--text-sm)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSqliteImportSelectedIds((prev) =>
                                checked ? prev.filter((id) => id !== e.id) : [...prev, e.id]
                              )
                            }}
                          />
                          <span>{e.nome}</span>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>({e.id})</span>
                        </label>
                      )
                    })}
                  </div>
                  <Button
                    type="button"
                    leftIcon={<Import size={18} />}
                    disabled={sqliteImportRunning || sqliteImportSelectedIds.length === 0}
                    onClick={async () => {
                      setSqliteImportRunning(true)
                      setSqliteImportMessage(null)
                      try {
                        const r = await window.electronAPI.importSqliteToPostgres.run({
                          sqlitePath: sqliteImportPath,
                          empresaIds: sqliteImportSelectedIds,
                          databaseUrl: sqliteImportDbUrl.trim() || null,
                        })
                        const preview = r.databaseUrlPreview ? ` Destino: ${r.databaseUrlPreview}` : ''
                        if (r.ok) {
                          const lines = Object.entries(r.imported ?? {}).map(([empId, tbl]) => {
                            const total = Object.values(tbl).reduce((a, b) => a + b, 0)
                            return `${empId.slice(0, 8)}… → ${total} linha(s) (soma das tabelas)`
                          })
                          setSqliteImportMessage({
                            type: 'success',
                            text: `Importação concluída.${preview}${lines.length ? ` ${lines.join(' | ')}` : ''}`,
                          })
                        } else {
                          const errParts: string[] = []
                          if (r.error) errParts.push(r.error)
                          if (r.empresaErrors && Object.keys(r.empresaErrors).length) {
                            errParts.push(
                              Object.entries(r.empresaErrors)
                                .map(([id, msg]) => `${id.slice(0, 8)}…: ${msg}`)
                                .join(' ')
                            )
                          }
                          setSqliteImportMessage({
                            type: r.imported && Object.keys(r.imported).length > 0 ? 'info' : 'error',
                            text:
                              (r.imported && Object.keys(r.imported).length > 0 ? 'Importação parcial. ' : '') +
                              (errParts.join(' ') || 'Falha na importação.') +
                              preview,
                          })
                        }
                      } catch (err) {
                        setSqliteImportMessage({
                          type: 'error',
                          text: err instanceof Error ? err.message : 'Erro na importação.',
                        })
                      } finally {
                        setSqliteImportRunning(false)
                      }
                    }}
                  >
                    {sqliteImportRunning ? 'Importando…' : 'Importar empresas selecionadas'}
                  </Button>
                </>
              )}
              {sqliteImportMessage && (
                <Alert
                  variant={
                    sqliteImportMessage.type === 'success'
                      ? 'success'
                      : sqliteImportMessage.type === 'info'
                        ? 'info'
                        : 'error'
                  }
                  style={{ marginTop: 16 }}
                >
                  {sqliteImportMessage.text}
                </Alert>
              )}
            </CardBody>
          </Card>
        )}

        <Card className="page-card suporte-config-card">
          <CardHeader>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={20} />
              Servidor da loja
            </span>
          </CardHeader>
          <CardBody>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
              URL da API do servidor local da loja. Em modo terminal, o app usa este endereço para operar no banco central.
            </p>
            <Input
              label="URL do servidor"
              placeholder="Ex.: http://192.168.0.10:3000"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.currentTarget.value)}
              style={{ marginBottom: 12 }}
            />
            <Button
              variant="secondary"
              leftIcon={<Search size={18} />}
              onClick={handleDiscoverServer}
              disabled={discoveringServer}
            >
              {discoveringServer ? 'Buscando servidor...' : 'Descobrir automaticamente'}
            </Button>
          </CardBody>
        </Card>

        <Card className="page-card suporte-config-card suporte-config-card--full">
          <CardHeader>Backup do banco de dados</CardHeader>
          <CardBody>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>
              O banco fica salvo localmente nesta pasta:
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 12, wordBreak: 'break-all' }}>
              {dbFolder ?? '…'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <Button variant="secondary" leftIcon={<FolderOpen size={18} />} onClick={handleOpenDbFolder}>
                Abrir pasta
              </Button>
              <Button
                variant="secondary"
                leftIcon={<Save size={18} />}
                onClick={handleExportToFolder}
                disabled={!!backupLoading}
              >
                {backupLoading === 'export' ? 'Salvando…' : 'Salvar backup em uma pasta'}
              </Button>
              <Button
                variant="secondary"
                leftIcon={<CloudUpload size={18} />}
                onClick={handleUploadToSupabase}
                disabled={!!backupLoading}
              >
                {backupLoading === 'upload' ? 'Enviando…' : 'Enviar backup para a nuvem'}
              </Button>
              <Button
                variant="secondary"
                leftIcon={<ArchiveRestore size={18} />}
                onClick={handleRestoreFromFile}
                disabled={!!backupLoading}
              >
                {backupLoading === 'restoreFile' ? 'Restaurando…' : 'Restaurar de um arquivo'}
              </Button>
              <Button
                variant="secondary"
                leftIcon={<CloudDownload size={18} />}
                onClick={handleRestoreFromSupabase}
                disabled={!!backupLoading}
              >
                {backupLoading === 'restoreCloud' ? 'Restaurando…' : 'Restaurar do backup na nuvem'}
              </Button>
            </div>
            {backupMessage && (
              <Alert variant={backupMessage.type === 'success' ? 'success' : 'error'} style={{ marginTop: 8 }}>
                {backupMessage.text}
              </Alert>
            )}
          </CardBody>
        </Card>

        <Card className="page-card suporte-config-card">
          <CardHeader>Sincronização automática</CardHeader>
          <CardBody>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={syncOnChange}
                onChange={(e) => {
                  const v = e.target.checked
                  setSyncOnChange(v)
                  window.electronAPI.config.set({ syncOnChange: v })
                }}
              />
              <span style={{ fontSize: 'var(--text-sm)' }}>Sincronizar em tempo real (empresas, categorias, produtos, estoque, vendas)</span>
            </label>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              Quando ativo, cada criação ou alteração envia os dados para o Supabase automaticamente.
            </p>
          </CardBody>
        </Card>

        <Card className="page-card suporte-config-card suporte-config-card--full">
          <CardHeader>Sincronização Supabase</CardHeader>
          <CardBody>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>
              Eventos pendentes: <strong>{pendingCount}</strong>
              {errorCount > 0 && (
                <span style={{ marginLeft: 12, color: 'var(--color-error, #dc2626)' }}>
                  Eventos com erro: <strong>{errorCount}</strong>
                </span>
              )}
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
              Cada criação ou edição (empresa, categoria, produto, movimento de estoque, venda) entra na fila. Com "Sincronizar em tempo real" ativo, o envio é automático. Se aparecer 0 pendentes, não há nada na fila (já foi enviado ou ainda não houve alteração).
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 16 }}>
              Configure SUPABASE_URL e SUPABASE_ANON_KEY (variáveis de ambiente) e crie as tabelas no Supabase (veja docs/supabase-sync.md e supabase-mirror-tables.sql).
            </p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
              Alterou algo no painel do Supabase? Clique em <strong>Buscar do Supabase</strong> para atualizar o banco local. O app também busca sozinho a cada ~20 s quando não há alterações pendentes.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                leftIcon={<CloudDownload size={18} />}
                onClick={handlePullFromSupabase}
                disabled={pulling}
              >
                {pulling ? 'Buscando…' : 'Buscar do Supabase'}
              </Button>
              {errorCount > 0 && (
                <Button variant="secondary" onClick={handleRetryErrors} disabled={syncing}>
                  Tentar novamente ({errorCount} com erro)
                </Button>
              )}
            </div>
            {syncMessage && (
              <Alert
                variant={pendingCount > 0 || errorCount > 0 ? 'info' : 'success'}
                style={{ marginTop: 16 }}
              >
                {syncMessage}
              </Alert>
            )}
          </CardBody>
        </Card>
      </div>
    </LayoutSuporte>
  )
}
