import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSyncDataRefresh } from '../../hooks/useSyncDataRefresh'
import { Button, Input, Alert, Dialog, useOperationToast } from '../../components/ui'
import type { Marca } from '../../vite-env'
import { Plus, Pencil, Trash2, Medal } from 'lucide-react'

export function MarcasLista() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const syncRefreshKey = useSyncDataRefresh()
  const op = useOperationToast()
  const [list, setList] = useState<Marca[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Marca | null>(null)
  const [nome, setNome] = useState('')
  const [ativo, setAtivo] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!empresaId) {
      setList([])
      setLoading(false)
      return
    }
    const api = window.electronAPI?.marcas
    if (!api?.list) {
      setList([])
      setLoading(false)
      return
    }
    setLoading(true)
    api.list(empresaId).then(setList).catch(() => setList([])).finally(() => setLoading(false))
  }, [empresaId])

  useEffect(() => {
    load()
  }, [load, syncRefreshKey])

  const openNew = () => {
    setEditing(null)
    setNome('')
    setAtivo(1)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (m: Marca) => {
    setEditing(m)
    setNome(m.nome)
    setAtivo(m.ativo)
    setError('')
    setModalOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!nome.trim()) {
      setError('Nome é obrigatório.')
      return
    }
    const api = window.electronAPI?.marcas
    if (!api?.create || !api?.update) {
      setError('Cadastro de marcas não disponível.')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.update(editing.id, { nome: nome.trim(), ativo })
      } else {
        await api.create({ empresa_id: empresaId, nome: nome.trim(), ativo })
      }
      setModalOpen(false)
      load()
      op.saved(editing ? 'Marca atualizada.' : 'Marca cadastrada.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const api = window.electronAPI?.marcas
    if (!api?.delete) return
    const ok = await api.delete(id)
    if (ok) {
      op.deleted('Marca excluída.')
      setDeleteConfirm(null)
      load()
    } else {
      const msg = 'Não foi possível excluir. Verifique se não há produtos vinculados.'
      op.error(msg)
      setError(msg)
    }
  }

  return (
    <>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
        As marcas podem ser associadas no cadastro de cada produto. Você também pode criar uma marca nova direto na tela de produtos.
      </p>

      <div className="mb-section" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <Button leftIcon={<Plus size={18} />} onClick={openNew}>
          Nova marca
        </Button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>Carregando...</p>
      ) : list.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>Nenhuma marca cadastrada.</p>
      ) : (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--color-surface)' }}>
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr>
                <th>Marca</th>
                <th>Status</th>
                <th style={{ width: 200 }} />
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id}>
                  <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Medal size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                    {m.nome}
                  </td>
                  <td>{m.ativo === 1 ? 'Ativa' : 'Inativa'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <Button variant="ghost" size="sm" leftIcon={<Pencil size={14} />} onClick={() => openEdit(m)}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => setDeleteConfirm(m.id)} style={{ color: 'var(--color-error)' }}>
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar marca' : 'Nova marca'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-marca" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        <form id="form-marca" onSubmit={submit}>
          <Input label="Nome" value={nome} onChange={(e) => setNome(e.currentTarget.value)} required placeholder="Ex: Marca do fabricante" />
          {editing && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              <input type="checkbox" checked={ativo === 1} onChange={(e) => setAtivo(e.target.checked ? 1 : 0)} />
              Ativa (aparece na lista ao cadastrar produto)
            </label>
          )}
          {error && <Alert variant="error" style={{ marginTop: 16 }}>{error}</Alert>}
        </form>
      </Dialog>

      {deleteConfirm && (
        <Dialog
          open={true}
          onClose={() => setDeleteConfirm(null)}
          title="Excluir marca?"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
              <Button variant="danger" onClick={() => handleDelete(deleteConfirm)}>Excluir</Button>
            </>
          }
        >
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            Só é possível excluir marcas sem produtos vinculados.
          </p>
        </Dialog>
      )}
    </>
  )
}
