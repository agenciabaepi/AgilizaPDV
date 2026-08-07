import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LayoutSuporte } from '../components/LayoutSuporte'
import { PageTitle, Card, CardHeader, CardBody, Button, Alert, Select, useToast } from '../components/ui'
import { Building2, Users, Copy, RefreshCw, KeyRound, LogIn } from 'lucide-react'
import type { Empresa, Usuario } from '../vite-env'

const th: CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  borderBottom: '1px solid var(--color-border)',
}
const td: CSSProperties = {
  padding: '10px 12px',
  fontSize: 'var(--text-sm)',
  borderBottom: '1px solid var(--color-border)',
}

function roleLabel(role: string): string {
  const r = role?.toLowerCase()
  if (r === 'admin') return 'Administrador'
  if (r === 'gerente') return 'Gerente'
  if (r === 'caixa') return 'Caixa'
  if (r === 'estoque') return 'Estoque'
  return role
}

function isAdminLogin(login: string): boolean {
  return login.trim().toLowerCase() === 'admin'
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

export function EmpresasSuporte() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const isSuporte = session && 'suporte' in session && session.suporte

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('')
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [ensureBusy, setEnsureBusy] = useState(false)
  const [ensureMessage, setEnsureMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadEmpresas = useCallback(() => {
    setListLoading(true)
    setListError(null)
    window.electronAPI.empresas
      .list()
      .then((list: Empresa[]) => {
        const arr = Array.isArray(list) ? list : []
        setEmpresas(arr)
        setSelectedEmpresaId((prev) => {
          if (prev && arr.some((e) => e.id === prev)) return prev
          if (arr.length === 1) return arr[0].id
          return ''
        })
      })
      .catch((e: unknown) => {
        setEmpresas([])
        setListError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setListLoading(false))
  }, [])

  useEffect(() => {
    if (!isSuporte) {
      navigate('/dashboard', { replace: true })
      return
    }
    loadEmpresas()
  }, [isSuporte, navigate, loadEmpresas])

  useEffect(() => {
    if (!selectedEmpresaId) {
      setUsuarios([])
      setUsersError(null)
      return
    }
    setUsersLoading(true)
    setUsersError(null)
    window.electronAPI.usuarios
      .list(selectedEmpresaId)
      .then((rows: Usuario[]) => setUsuarios(Array.isArray(rows) ? rows : []))
      .catch((e: unknown) => {
        setUsuarios([])
        setUsersError(e instanceof Error ? e.message : 'Erro ao carregar usuários.')
      })
      .finally(() => setUsersLoading(false))
  }, [selectedEmpresaId])

  const handleCopyId = async (id: string) => {
    const ok = await copyText(id)
    toast.addToast(ok ? 'success' : 'error', ok ? 'ID copiado.' : 'Não foi possível copiar.')
  }

  const handleCopyCodigo = async (codigo: number) => {
    const ok = await copyText(String(codigo))
    toast.addToast(ok ? 'success' : 'error', ok ? 'Número copiado.' : 'Não foi possível copiar.')
  }

  const handleEnsureAdmin = async () => {
    if (!selectedEmpresaId) return
    if (typeof window.electronAPI?.auth?.ensureAdminUser !== 'function') {
      setEnsureMessage({ type: 'error', text: 'Função indisponível neste ambiente.' })
      return
    }
    setEnsureBusy(true)
    setEnsureMessage(null)
    try {
      const r = await window.electronAPI.auth.ensureAdminUser(selectedEmpresaId)
      setEnsureMessage({ type: r.ok ? 'success' : 'error', text: r.message })
      if (r.ok) {
        toast.addToast('success', 'Usuário admin atualizado.')
        const rows = await window.electronAPI.usuarios.list(selectedEmpresaId)
        setUsuarios(Array.isArray(rows) ? rows : [])
      }
    } catch (e) {
      setEnsureMessage({ type: 'error', text: e instanceof Error ? e.message : 'Erro ao redefinir admin.' })
    } finally {
      setEnsureBusy(false)
    }
  }

  if (!isSuporte) return null

  return (
    <LayoutSuporte>
      <PageTitle
        title="Empresas e acesso"
        subtitle="Lista de lojas cadastradas, usuários do PDV e como fazer login. Senhas não ficam em texto claro no banco."
      />
      <div className="suporte-config-stack">
        <Card className="page-card suporte-config-card">
          <CardHeader>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LogIn size={20} />
              Como o cliente entra no PDV
            </span>
          </CardHeader>
          <CardBody>
            <ol style={{ margin: 0, paddingLeft: 22, color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
              <li>Na tela de <strong>login</strong>, desative o modo suporte e digite o <strong>número da empresa</strong> (coluna abaixo — o cliente não vê a lista nem os nomes das outras lojas).</li>
              <li>Em seguida, <strong>usuário</strong> e <strong>senha</strong> cadastrados para essa empresa.</li>
              <li>
                <strong>Senhas</strong> são guardadas com hash: não dá para “ver” a senha de ninguém aqui. Se o usuário for <code>admin</code> e você usar{' '}
                <strong>Redefinir admin (admin/admin)</strong> abaixo, a senha passa a ser <strong>admin</strong> até o cliente alterar em Usuários.
              </li>
            </ol>
          </CardBody>
        </Card>

        <Card className="page-card suporte-config-card">
          <CardHeader>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={20} />
                Empresas cadastradas
              </span>
              <Button type="button" variant="secondary" size="sm" leftIcon={<RefreshCw size={16} />} onClick={loadEmpresas} disabled={listLoading}>
                Atualizar lista
              </Button>
            </span>
          </CardHeader>
          <CardBody>
            {listError && <Alert variant="error">{listError}</Alert>}
            {listLoading ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Carregando empresas…</p>
            ) : empresas.length === 0 ? (
              <Alert variant="info">
                Nenhuma empresa no banco.{' '}
                <Link to="/configuracoes/nova-empresa">Cadastre uma nova empresa</Link>.
              </Alert>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Número (login)</th>
                      <th style={th}>Nome</th>
                      <th style={th}>CNPJ</th>
                      <th style={th}>ID interno</th>
                      <th style={th}>Cadastro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empresas.map((e) => (
                      <tr
                        key={e.id}
                        onClick={() => setSelectedEmpresaId(e.id)}
                        style={{
                          cursor: 'pointer',
                          background: selectedEmpresaId === e.id ? 'var(--color-primary-light)' : undefined,
                        }}
                      >
                        <td style={td}>
                          {e.codigo_acesso != null ? (
                            <>
                              <strong>{e.codigo_acesso}</strong>
                              <button
                                type="button"
                                title="Copiar número"
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  void handleCopyCodigo(e.codigo_acesso!)
                                }}
                                style={{
                                  marginLeft: 8,
                                  verticalAlign: 'middle',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 4,
                                  color: 'var(--color-primary)',
                                }}
                              >
                                <Copy size={16} />
                              </button>
                            </>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={td}>
                          <strong>{e.nome}</strong>
                        </td>
                        <td style={td}>{e.cnpj?.trim() || '—'}</td>
                        <td style={td}>
                          <code style={{ fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>{e.id}</code>
                          <button
                            type="button"
                            title="Copiar ID interno"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              void handleCopyId(e.id)
                            }}
                            style={{
                              marginLeft: 8,
                              verticalAlign: 'middle',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 4,
                              color: 'var(--color-primary)',
                            }}
                          >
                            <Copy size={16} />
                          </button>
                        </td>
                        <td style={td}>
                          {e.created_at
                            ? new Date(e.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p style={{ marginTop: 12, marginBottom: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Clique em uma linha para ver os usuários dessa empresa abaixo.
            </p>
          </CardBody>
        </Card>

        <Card className="page-card suporte-config-card">
          <CardHeader>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={20} />
              Usuários do PDV
            </span>
          </CardHeader>
          <CardBody>
            <Select
              label="Empresa selecionada"
              value={selectedEmpresaId}
              onChange={(ev) => setSelectedEmpresaId(ev.target.value)}
              options={empresas.map((e) => ({ value: e.id, label: e.nome }))}
              placeholder="Selecione uma empresa"
              style={{ maxWidth: 420, marginBottom: 16 }}
            />

            {!selectedEmpresaId ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Selecione uma empresa na tabela acima ou no campo acima.</p>
            ) : usersLoading ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Carregando usuários…</p>
            ) : usersError ? (
              <Alert variant="error">{usersError}</Alert>
            ) : usuarios.length === 0 ? (
              <Alert variant="info">
                Nenhum usuário nesta empresa. Use <strong>Redefinir admin (admin/admin)</strong> abaixo para criar o primeiro acesso.
              </Alert>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Nome</th>
                      <th style={th}>Login (usuário na tela de login)</th>
                      <th style={th}>Perfil</th>
                      <th style={th}>Senha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => (
                      <tr key={u.id}>
                        <td style={td}>{u.nome}</td>
                        <td style={td}>
                          <code>{u.login}</code>
                        </td>
                        <td style={td}>{roleLabel(u.role)}</td>
                        <td style={{ ...td, maxWidth: 280 }}>
                          {isAdminLogin(u.login) ? (
                            <span style={{ fontSize: 'var(--text-sm)' }}>
                              Se você acabou de usar <strong>Redefinir admin</strong> ou criou a empresa com essa opção: senha <strong>admin</strong>. Caso contrário, é a senha que o cliente definiu (não recuperável aqui).
                            </span>
                          ) : (
                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                              Não exibida (armazenada com hash). O cliente deve usar a senha cadastrada ou pedir a um administrador para alterar em <strong>Usuários</strong>.
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedEmpresaId && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                  Cria ou redefine o usuário <code>admin</code> com senha <code>admin</code> nesta empresa (mesma ação de &quot;Recuperar acesso&quot; nas configurações do sistema).
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<KeyRound size={18} />}
                  onClick={handleEnsureAdmin}
                  disabled={ensureBusy}
                >
                  {ensureBusy ? 'Aplicando…' : 'Redefinir admin (admin/admin)'}
                </Button>
                {ensureMessage && (
                  <Alert variant={ensureMessage.type} style={{ marginTop: 12 }}>
                    {ensureMessage.text}
                  </Alert>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          <Link to="/configuracoes/nova-empresa">+ Nova empresa</Link>
          {' · '}
          <Link to="/configuracoes/loja">Configurar Loja</Link>
        </p>
      </div>
    </LayoutSuporte>
  )
}
