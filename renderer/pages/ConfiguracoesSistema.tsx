import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LayoutSuporte } from '../components/LayoutSuporte'
import { PageTitle, Card, CardHeader, CardBody, Button, Input, Alert } from '../components/ui'
import { Settings, FolderOpen, Save, CloudUpload, CloudDownload, ArchiveRestore, RefreshCw } from 'lucide-react'

export function ConfiguracoesSistema() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const [dbPath, setDbPath] = useState('')
  const [syncOnChange, setSyncOnChange] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [dbFolder, setDbFolder] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [backupLoading, setBackupLoading] = useState<string | null>(null)

  const isSuporte = session && 'suporte' in session && session.suporte

  const loadSyncCounts = useCallback(() => {
    window.electronAPI.sync.getPendingCount().then(setPendingCount)
    window.electronAPI.sync.getErrorCount().then(setErrorCount)
  }, [])

  useEffect(() => {
    if (!isSuporte) {
      navigate('/dashboard', { replace: true })
      return
    }
    window.electronAPI.config.get().then((c) => {
      setDbPath(c?.dbPath ?? '')
      setSyncOnChange(c?.syncOnChange !== false)
    })
    window.electronAPI.backup.getDbPath().then((r) => setDbFolder(r.folder ?? null))
    loadSyncCounts()
  }, [isSuporte, navigate, loadSyncCounts])

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

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await window.electronAPI.config.setDbPath(dbPath.trim() || null)
      setMessage({
        type: 'success',
        text: 'Configuração salva. Reinicie o aplicativo para que a pasta do banco seja alterada.'
      })
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar.' })
    } finally {
      setSaving(false)
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

  const handleSync = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const result = await window.electronAPI.sync.run()
      setSyncMessage(result.message)
      loadSyncCounts()
    } finally {
      setSyncing(false)
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

  if (!isSuporte) return null

  return (
    <LayoutSuporte>
      <PageTitle
        title="Configurações do sistema"
        subtitle="Acesso restrito ao suporte. Altere com cuidado."
      />

        <Card className="page-card" style={{ maxWidth: 560, marginTop: 0 }}>
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

        <Card className="page-card" style={{ maxWidth: 560, marginTop: 24 }}>
          <CardHeader>Backup do banco de dados</CardHeader>
          <CardBody>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>
              O banco fica salvo localmente nesta pasta:
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', marginBottom: 12, wordBreak: 'break-all' }}>
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

        <Card className="page-card" style={{ maxWidth: 560, marginTop: 24 }}>
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
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
              Quando ativo, cada criação ou alteração envia os dados para o Supabase automaticamente.
            </p>
          </CardBody>
        </Card>

        <Card className="page-card" style={{ maxWidth: 560, marginTop: 24 }}>
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
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', marginBottom: 12 }}>
              Cada criação ou edição (empresa, categoria, produto, movimento de estoque, venda) entra na fila. Com "Sincronizar em tempo real" ativo, o envio é automático. Se aparecer 0 pendentes, não há nada na fila (já foi enviado ou ainda não houve alteração).
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', marginBottom: 16 }}>
              Configure SUPABASE_URL e SUPABASE_ANON_KEY (variáveis de ambiente) e crie as tabelas no Supabase (veja docs/supabase-sync.md e supabase-mirror-tables.sql).
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                leftIcon={<RefreshCw size={18} />}
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
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
    </LayoutSuporte>
  )
}
