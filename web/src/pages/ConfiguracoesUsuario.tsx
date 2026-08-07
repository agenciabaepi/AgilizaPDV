import { useState, useEffect, useCallback } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { PageTitle, Card, CardHeader, CardBody, Button, Input, Alert, useOperationToast } from '../components/ui'
import { UserCircle, Save } from 'lucide-react'
import { isValidEmail } from '../lib/validators'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  caixa: 'Caixa / Vendedor',
  estoque: 'Estoque / Funcionário',
}

export function ConfiguracoesUsuario() {
  const { session, refreshSession } = useAuth()
  const op = useOperationToast()
  const userId = session && 'id' in session && !('suporte' in session) ? session.id : null

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ nome: '', login: '', email: '', senha: '', confirmSenha: '' })
  const [role, setRole] = useState('')

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    const api = window.electronAPI?.usuarios
    if (!api?.get) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const user = await api.get(userId)
      if (user) {
        setForm({
          nome: user.nome ?? '',
          login: user.login ?? '',
          email: user.email ?? '',
          senha: '',
          confirmSenha: '',
        })
        setRole(user.role ?? '')
      }
    } catch {
      setError('Não foi possível carregar seus dados.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!userId) return
    if (!form.nome.trim()) {
      setError('Nome é obrigatório.')
      return
    }
    if (!form.login.trim()) {
      setError('Login é obrigatório.')
      return
    }
    if (form.email.trim() && !isValidEmail(form.email.trim())) {
      setError('E-mail inválido.')
      return
    }
    if (form.senha && form.senha.length < 4) {
      setError('A nova senha deve ter pelo menos 4 caracteres.')
      return
    }
    if (form.senha !== form.confirmSenha) {
      setError('As senhas não coincidem.')
      return
    }

    const api = window.electronAPI?.usuarios
    if (!api?.update) {
      setError('Recurso de usuários não disponível.')
      return
    }

    setSaving(true)
    try {
      const payload: { nome: string; login: string; email: string | null; senha?: string } = {
        nome: form.nome.trim(),
        login: form.login.trim(),
        email: form.email.trim().toLowerCase() || null,
      }
      if (form.senha) payload.senha = form.senha
      await api.update(userId, payload)
      setForm((prev) => ({ ...prev, senha: '', confirmSenha: '' }))
      await refreshSession()
      op.saved('Dados atualizados com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  if (!userId) {
    return (
      <Layout>
        <PageTitle title="Minha conta" />
        <Alert variant="error">Sessão inválida. Faça login novamente.</Alert>
      </Layout>
    )
  }

  return (
    <Layout>
      <PageTitle
        title="Minha conta"
        subtitle="Atualize seu nome, login, e-mail e senha de acesso."
      />

      <Card style={{ maxWidth: 560 }}>
        <CardHeader>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 'var(--font-semibold)' }}>
            <UserCircle size={20} strokeWidth={1.75} />
            Dados pessoais
          </span>
        </CardHeader>
        <CardBody>
          {loading ? (
            <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Carregando...</p>
          ) : (
            <form
              onSubmit={(e) => void submit(e)}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
            >
              {error && <Alert variant="error">{error}</Alert>}

              <Input
                label="Nome"
                value={form.nome}
                onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                required
                autoComplete="name"
              />

              <Input
                label="Login"
                value={form.login}
                onChange={(e) => setForm((prev) => ({ ...prev, login: e.target.value }))}
                required
                autoComplete="username"
              />

              <Input
                label="E-mail"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                autoComplete="email"
              />

              {role && (
                <div>
                  <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-1)' }}>
                    Perfil
                  </span>
                  <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: 'var(--text-sm)' }}>
                    {ROLE_LABELS[role] ?? role}
                  </p>
                </div>
              )}

              <Input
                label="Nova senha"
                type="password"
                value={form.senha}
                onChange={(e) => setForm((prev) => ({ ...prev, senha: e.target.value }))}
                autoComplete="new-password"
                placeholder="Deixe em branco para manter a atual"
              />

              <Input
                label="Confirmar nova senha"
                type="password"
                value={form.confirmSenha}
                onChange={(e) => setForm((prev) => ({ ...prev, confirmSenha: e.target.value }))}
                autoComplete="new-password"
              />

              <div>
                <Button type="submit" disabled={saving} leftIcon={<Save size={16} strokeWidth={1.75} />}>
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </Layout>
  )
}
