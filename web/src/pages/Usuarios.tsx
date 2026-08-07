import { useState, useEffect, useCallback } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useSyncDataRefresh } from '../hooks/useSyncDataRefresh'
import { PageTitle, Button, Input, Alert, Dialog, Card, CardBody, useOperationToast } from '../components/ui'
import type { Usuario } from '../vite-env'
import {
  DEFAULT_MODULOS_BY_ROLE,
  MODULOS_USUARIO,
  defaultModulosRecord,
  parseModulos,
  type ModuloId,
} from '../lib/modulos'
import { isValidEmail } from '../lib/validators'
import { Plus, Pencil, UserCircle } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  caixa: 'Caixa / Vendedor',
  estoque: 'Estoque / Funcionário',
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'caixa', label: 'Caixa / Vendedor' },
  { value: 'estoque', label: 'Estoque / Funcionário' },
]

export function Usuarios() {
  const { session, refreshSession } = useAuth()
  const empresaId = session && 'empresa_id' in session ? session.empresa_id : ''
  const role = session && 'role' in session ? String(session.role).toLowerCase() : ''
  const canManage = role === 'admin' || role === 'gerente'
  const op = useOperationToast()

  const syncRefreshKey = useSyncDataRefresh()
  const [list, setList] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Usuario | null>(null)
  const [form, setForm] = useState({ nome: '', login: '', email: '', senha: '', role: 'caixa', comissao_percentual: '', meta_vendas_mes: '' })
  const [modulos, setModulos] = useState<Record<ModuloId, boolean>>(defaultModulosRecord)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    if (!empresaId) return
    const api = window.electronAPI?.usuarios
    if (!api?.list) {
      setList([])
      setLoading(false)
      return
    }
    api.list(empresaId).then((arr: unknown) => {
      const raw = Array.isArray(arr) ? arr : []
      const items = raw.filter((u): u is Usuario => u != null && typeof u === 'object') as Usuario[]
      setList(items)
    }).catch(() => setList([])).finally(() => setLoading(false))
  }, [empresaId])

  useEffect(() => {
    load()
  }, [load, syncRefreshKey])

  const openNew = () => {
    setEditing(null)
    setForm({ nome: '', login: '', email: '', senha: '', role: 'caixa', comissao_percentual: '', meta_vendas_mes: '' })
    setModulos(DEFAULT_MODULOS_BY_ROLE.caixa)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (u: Usuario) => {
    setEditing(u)
    setForm({
      nome: u.nome ?? '',
      login: u.login ?? '',
      email: u.email ?? '',
      senha: '',
      role: (u.role && ['admin', 'gerente', 'caixa', 'estoque'].includes(u.role) ? u.role : 'caixa'),
      comissao_percentual: u.comissao_percentual != null ? String(u.comissao_percentual) : '',
      meta_vendas_mes: u.meta_vendas_mes != null ? String(u.meta_vendas_mes) : '',
    })
    setModulos(parseModulos(u.modulos_json))
    setError('')
    setModalOpen(true)
  }

  const toggleModulo = (id: ModuloId) => {
    setModulos((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
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
    if (!editing && !form.senha) {
      setError('Senha é obrigatória ao criar usuário.')
      return
    }
    const api = window.electronAPI?.usuarios
    if (!api) {
      setError('Recurso de usuários não disponível.')
      return
    }
    setSaving(true)
    try {
      const modulosJson = JSON.stringify(modulos)
      if (editing) {
        const payload: {
          nome: string
          login: string
          email: string | null
          role: string
          senha?: string
          modulos_json: string
          comissao_percentual?: number | null
          meta_vendas_mes?: number | null
        } = {
          nome: form.nome.trim(),
          login: form.login.trim(),
          email: form.email.trim().toLowerCase() || null,
          role: form.role,
          modulos_json: modulosJson,
        }
        if (form.comissao_percentual.trim() !== '') {
          const pct = parseFloat(form.comissao_percentual.replace(',', '.'))
          payload.comissao_percentual = Number.isNaN(pct) ? null : pct
        } else {
          payload.comissao_percentual = null
        }
        if (form.meta_vendas_mes.trim() !== '') {
          const meta = parseFloat(form.meta_vendas_mes.replace(',', '.'))
          payload.meta_vendas_mes = Number.isNaN(meta) ? null : meta
        } else {
          payload.meta_vendas_mes = null
        }
        if (form.senha) payload.senha = form.senha
        await api.update(editing.id, payload)
        op.saved('Usuário atualizado com sucesso.')
      } else {
        await api.create({
          empresa_id: empresaId,
          nome: form.nome.trim(),
          login: form.login.trim(),
          email: form.email.trim().toLowerCase() || null,
          senha: form.senha,
          role: form.role as 'admin' | 'gerente' | 'caixa' | 'estoque',
          modulos_json: modulosJson,
        })
        op.created('Usuário cadastrado com sucesso.')
      }
      setModalOpen(false)
      load()
      void refreshSession()
    } catch (err) {
      op.failed(err, 'Erro ao salvar usuário.')
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout>
      <PageTitle
        title="Usuários"
        subtitle="Cadastro de vendedores, funcionários e perfis de acesso ao sistema"
      />

      <div className="mb-section" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        {canManage && (
          <Button leftIcon={<Plus size={18} />} onClick={openNew}>
            Novo usuário
          </Button>
        )}
        {!canManage && (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Apenas administradores e gerentes podem criar ou editar usuários.
          </p>
        )}
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>Carregando...</p>
      ) : list.length === 0 ? (
        <Card style={{ width: '100%' }}>
          <CardBody>
            <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
              Nenhum usuário cadastrado nesta empresa.
              {canManage && ' Clique em "Novo usuário" para adicionar vendedores e funcionários.'}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--color-surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-elevated)' }}>
                <th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>Nome</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>Login</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>E-mail</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>Perfil</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>Comissão</th>
                {canManage && (
                  <th style={{ width: 80, padding: 'var(--space-3) var(--space-4)' }} />
                )}
              </tr>
            </thead>
            <tbody>
              {list.map((u, idx) => (
                <tr key={u?.id ?? `user-${idx}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserCircle size={20} style={{ color: 'var(--color-text-muted)' }} />
                    {u?.nome ?? '—'}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>{u?.login ?? '—'}</td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)' }}>{u?.email ?? '—'}</td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 500,
                        background: 'var(--color-surface-elevated)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {ROLE_LABELS[u?.role] ?? (u?.role || '—')}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)' }}>
                    {u?.comissao_percentual != null ? `${u.comissao_percentual}%` : 'Padrão'}
                    {u?.meta_vendas_mes != null && u.meta_vendas_mes > 0 && (
                      <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        Meta: R$ {u.meta_vendas_mes.toFixed(2)}
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        leftIcon={<Pencil size={14} />}
                        onClick={() => u && openEdit(u)}
                      >
                        Editar
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar usuário' : 'Novo usuário'}
        size="wide"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-usuario" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        <form id="form-usuario" onSubmit={submit}>
          <Input
            label="Nome completo"
            value={form.nome}
            onChange={(e) => {
              const v = (e.target as HTMLInputElement | null)?.value ?? ''
              setForm((f) => ({ ...f, nome: v }))
            }}
            placeholder="Ex: Maria Silva"
            required
          />
          <Input
            label="Login"
            value={form.login}
            onChange={(e) => {
              const v = (e.target as HTMLInputElement | null)?.value ?? ''
              setForm((f) => ({ ...f, login: v }))
            }}
            placeholder="Ex: maria.silva"
            required
            autoComplete="username"
          />
          <Input
            label="E-mail (opcional)"
            type="email"
            value={form.email}
            onChange={(e) => {
              const v = (e.target as HTMLInputElement | null)?.value ?? ''
              setForm((f) => ({ ...f, email: v }))
            }}
            placeholder="maria@loja.com"
            autoComplete="email"
          />
          <Input
            label={editing ? 'Nova senha (deixe em branco para não alterar)' : 'Senha'}
            type="password"
            value={form.senha}
            onChange={(e) => {
              const v = (e.target as HTMLInputElement | null)?.value ?? ''
              setForm((f) => ({ ...f, senha: v }))
            }}
            placeholder={editing ? '••••••••' : 'Mínimo 1 caractere'}
            required={!editing}
            autoComplete={editing ? 'new-password' : 'new-password'}
          />
          <label style={{ display: 'block', marginTop: 16, marginBottom: 6, fontSize: 'var(--text-sm)', fontWeight: 500 }}>
            Perfil / Função
          </label>
          <select
            value={form.role ?? 'caixa'}
            onChange={(e) => {
              const r = (e.target as HTMLSelectElement)?.value ?? 'caixa'
              setForm((f) => ({ ...f, role: r }))
              if (!editing) setModulos(DEFAULT_MODULOS_BY_ROLE[r] ?? DEFAULT_MODULOS_BY_ROLE.caixa)
            }}
            style={{
              width: '100%',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              fontSize: 'var(--text-base)',
            }}
          >
            {ROLE_OPTIONS.filter((opt) => opt != null).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="input-hint" style={{ marginTop: 8 }}>
            Admin: acesso total. Gerente: gerencia cadastros e usuários. Caixa: opera o PDV. Estoque: movimenta estoque.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <Input
              label="Comissão (%)"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.comissao_percentual}
              onChange={(e) => {
                const v = (e.target as HTMLInputElement | null)?.value ?? ''
                setForm((f) => ({ ...f, comissao_percentual: v }))
              }}
              placeholder="Usar padrão da empresa"
            />
            <Input
              label="Meta de vendas mensal (R$)"
              type="number"
              min={0}
              step={0.01}
              value={form.meta_vendas_mes}
              onChange={(e) => {
                const v = (e.target as HTMLInputElement | null)?.value ?? ''
                setForm((f) => ({ ...f, meta_vendas_mes: v }))
              }}
              placeholder="Opcional"
            />
          </div>
          <p className="input-hint" style={{ marginTop: 8 }}>
            Deixe a comissão em branco para usar o percentual padrão configurado em Financeiro → Comissões.
          </p>

          <div style={{ marginTop: 24 }}>
            <label style={{ display: 'block', marginBottom: 12, fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              Permissões de acesso
            </label>
            <p className="input-hint" style={{ marginBottom: 12 }}>
              Marque os módulos que este usuário poderá acessar. Se nenhum for marcado, ele usará as permissões padrão da empresa.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {MODULOS_USUARIO.map((m) => (
                <label
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: modulos[m.id] ? 'var(--color-primary-light, rgba(29,78,216,0.08))' : 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={modulos[m.id] !== false}
                    onChange={() => toggleModulo(m.id)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          {error && <Alert variant="error" style={{ marginTop: 16 }}>{error}</Alert>}
        </form>
      </Dialog>
    </Layout>
  )
}
