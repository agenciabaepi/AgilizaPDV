import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Layout } from '../components/Layout'
import { PageTitle, Card, CardHeader, CardBody, Button, Alert } from '../components/ui'
import { Monitor, RefreshCw } from 'lucide-react'
import type { TerminaiConectado } from '../vite-env'

function formatMode(m?: string): string {
  if (m === 'server') return 'Servidor'
  if (m === 'terminal') return 'Terminal'
  if (m === 'unknown') return 'Não identificado'
  return m ?? '—'
}

function formatPlatform(p?: string): string {
  if (p === 'win32') return 'Windows'
  if (p === 'darwin') return 'macOS'
  if (p === 'linux') return 'Linux'
  return p ?? '—'
}

function formatWhen(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR')
  } catch {
    return iso
  }
}

/** PDVs no store-server — admin da loja: Configurações (F6) → Terminais na rede ou /configuracoes-loja/terminal */
export function ConfiguracoesTerminal() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lista, setLista] = useState<TerminaiConectado[]>([])
  const [total, setTotal] = useState(0)
  const [serverHint, setServerHint] = useState<string | null>(null)

  const isAdmin = session && 'role' in session && session.role?.toLowerCase() === 'admin'

  const load = useCallback(async (isRefresh: boolean) => {
    if (typeof window.electronAPI?.terminais?.listConectados !== 'function') {
      setError('Função não disponível neste ambiente.')
      setLista([])
      setTotal(0)
      return
    }
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const r = await window.electronAPI.terminais.listConectados()
      if (!r.ok) {
        setError(r.error)
        setLista([])
        setTotal(0)
        return
      }
      setLista(r.terminais)
      setTotal(r.total)
      setServerHint(
        r.total === 0
          ? 'Nenhuma conexão WebSocket ativa. Os PDVs precisam estar abertos e apontando para o mesmo servidor da loja; o app registra a conexão ao iniciar.'
          : null
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setLista([])
      setTotal(0)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) {
      navigate('/configuracoes-loja', { replace: true })
      return
    }
    void load(false)
  }, [isAdmin, navigate, load])

  useEffect(() => {
    if (!isAdmin) return
    const id = window.setInterval(() => void load(true), 8000)
    return () => window.clearInterval(id)
  }, [isAdmin, load])

  if (!isAdmin) return null

  return (
    <Layout>
      <PageTitle
        title="Terminais na rede"
        subtitle="PDVs conectados ao servidor da loja via WebSocket (tempo real)."
      />
      <div className="suporte-config-stack">
        <Card className="page-card suporte-config-card suporte-config-card--full">
          <CardHeader>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Monitor size={20} />
              Conexões ativas
            </span>
          </CardHeader>
          <CardBody>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
              <Button
                type="button"
                variant="secondary"
                leftIcon={<RefreshCw size={18} className={refreshing ? 'login-spinner' : undefined} />}
                disabled={refreshing || loading}
                onClick={() => void load(true)}
              >
                {refreshing ? 'Atualizando…' : 'Atualizar agora'}
              </Button>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                Total: <strong>{total}</strong>
                {loading && !refreshing ? ' — carregando…' : ''}
              </span>
            </div>

            {error && (
              <Alert variant="error" style={{ marginBottom: 16 }}>
                {error}
              </Alert>
            )}
            {serverHint && !error && (
              <Alert variant="info" style={{ marginBottom: 16 }}>
                {serverHint}
              </Alert>
            )}

            {!loading && lista.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table className="terminais-table">
                  <thead>
                    <tr>
                      <th>Computador</th>
                      <th>Endereço IP</th>
                      <th>Modo</th>
                      <th>Versão</th>
                      <th>Sistema</th>
                      <th>Conectado desde</th>
                      <th>Último registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((t) => (
                      <tr key={t.id}>
                        <td>{t.hostname ?? '—'}</td>
                        <td>
                          {t.remoteAddress ?? '—'}
                          {t.remotePort != null ? ` :${t.remotePort}` : ''}
                        </td>
                        <td>{formatMode(t.installMode)}</td>
                        <td>{t.appVersion ?? '—'}</td>
                        <td>{formatPlatform(t.platform)}</td>
                        <td>{formatWhen(t.connectedAt)}</td>
                        <td>{formatWhen(t.lastHelloAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Alert variant="info">
          Esta lista reflete o <strong>store-server</strong> (API da loja). No PC servidor, use a URL configurada ou{' '}
          <code style={{ fontSize: '0.9em' }}>http://127.0.0.1:3000</code> quando o serviço estiver no ar. A rota HTTP{' '}
          <code style={{ fontSize: '0.9em' }}>/terminais/conectados</code> é destinada à rede local.
        </Alert>
      </div>
    </Layout>
  )
}
