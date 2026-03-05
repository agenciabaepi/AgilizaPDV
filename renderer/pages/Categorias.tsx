import { useState, useEffect, useCallback } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { PageTitle, Button, Input, Alert, Dialog } from '../components/ui'
import type { CategoriaTreeNode } from '../vite-env'
import { Plus, Pencil, Trash2, FolderOpen, ChevronRight, Tag } from 'lucide-react'

const NIVEL_LABEL: Record<number, string> = {
  1: 'Grupo',
  2: 'Categoria',
  3: 'Subcategoria'
}

const MAX_NIVEL = 3

export function Categorias() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const [tree, setTree] = useState<CategoriaTreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CategoriaTreeNode | null>(null)
  const [parentNode, setParentNode] = useState<CategoriaTreeNode | null>(null)
  const [nome, setNome] = useState('')
  const [ativo, setAtivo] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!empresaId) return
    const api = window.electronAPI?.categorias
    if (!api?.listTree) {
      setTree([])
      setLoading(false)
      return
    }
    api.listTree(empresaId).then(setTree).catch(() => setTree([])).finally(() => setLoading(false))
  }, [empresaId])

  useEffect(() => {
    load()
  }, [load])

  const openNew = (parent: CategoriaTreeNode | null) => {
    setEditing(null)
    setParentNode(parent)
    setNome('')
    setAtivo(1)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (c: CategoriaTreeNode) => {
    setEditing(c)
    setParentNode(null)
    setNome(c.nome)
    setAtivo(c.ativo)
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
    const api = window.electronAPI?.categorias
    if (!api?.create || !api?.update) {
      setError('Recurso de categorias não disponível. Feche o app e abra de novo com npm run dev (ou instale a versão mais recente do instalador).')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.update(editing.id, { nome: nome.trim(), ativo })
      } else {
        await api.create({
          empresa_id: empresaId,
          nome: nome.trim(),
          parent_id: parentNode?.id ?? undefined,
          ativo
        })
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const api = window.electronAPI?.categorias
    if (!api?.delete) return
    const ok = await api.delete(id)
    if (ok) {
      setDeleteConfirm(null)
      load()
    } else {
      setError('Não foi possível excluir. Verifique se não há subcategorias ou produtos vinculados.')
    }
  }

  const canAddChild = (node: CategoriaTreeNode) => node.nivel < MAX_NIVEL

  return (
    <Layout>
      <PageTitle
        title="Categorias"
        subtitle="Grupos, categorias e subcategorias para organizar produtos (até 3 níveis)"
      />

      <div className="mb-section" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <Button leftIcon={<Plus size={18} />} onClick={() => openNew(null)}>
          Novo grupo
        </Button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>Carregando...</p>
      ) : tree.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-4)' }}>
          Nenhuma categoria cadastrada. Crie um grupo para começar.
        </p>
      ) : (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--color-surface)' }}>
          <CategoriaTree
            nodes={tree}
            onAdd={openNew}
            onEdit={openEdit}
            onDelete={(id) => setDeleteConfirm(id)}
            canAddChild={canAddChild}
          />
        </div>
      )}

      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Editar ${NIVEL_LABEL[editing.nivel] ?? 'categoria'}` : parentNode ? `Nova ${NIVEL_LABEL[parentNode.nivel + 1] ?? 'categoria'}` : 'Novo grupo'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-categoria" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </>
        }
      >
        <form id="form-categoria" onSubmit={submit}>
          <Input
            label="Nome"
            value={nome}
            onChange={(e) => setNome(e.currentTarget.value)}
            placeholder={editing ? undefined : parentNode ? 'Ex: iPhone, Cabos' : 'Ex: Eletrônicos, Bebidas'}
            required
          />
          {!editing && (
            <p className="input-hint" style={{ marginTop: 8 }}>
              {!parentNode ? 'Grupo principal (nível 1).' : 'Será criado como filho da categoria selecionada.'}
            </p>
          )}
          {editing && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              <input type="checkbox" checked={ativo === 1} onChange={(e) => setAtivo(e.target.checked ? 1 : 0)} />
              Ativo (visível no cadastro de produtos)
            </label>
          )}
          {error && <Alert variant="error" style={{ marginTop: 16 }}>{error}</Alert>}
        </form>
      </Dialog>

      {deleteConfirm && (
        <Dialog
          open={true}
          onClose={() => setDeleteConfirm(null)}
          title="Excluir categoria?"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
              <Button variant="danger" onClick={() => handleDelete(deleteConfirm)}>Excluir</Button>
            </>
          }
        >
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            Só é possível excluir categorias sem filhos e sem produtos vinculados.
          </p>
        </Dialog>
      )}
    </Layout>
  )
}

function CategoriaTree({
  nodes,
  onAdd,
  onEdit,
  onDelete,
  canAddChild,
  depth = 0
}: {
  nodes: CategoriaTreeNode[]
  onAdd: (parent: CategoriaTreeNode | null) => void
  onEdit: (c: CategoriaTreeNode) => void
  onDelete: (id: string) => void
  canAddChild: (node: CategoriaTreeNode) => boolean
  depth?: number
}) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {nodes.map((node) => (
        <li key={node.id}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 'var(--space-2) var(--space-4)',
              paddingLeft: depth * 24 + 16,
              borderBottom: '1px solid var(--color-border)',
              background: depth % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg)'
            }}
          >
            {depth > 0 && <ChevronRight size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
            {node.nivel === 1 ? <FolderOpen size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} /> : <Tag size={16} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />}
            <span style={{ flex: 1, fontWeight: node.nivel === 1 ? 600 : 500, fontSize: node.nivel === 1 ? 'var(--text-base)' : 'var(--text-sm)' }}>
              {node.nome}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {NIVEL_LABEL[node.nivel]}
            </span>
            {node.ativo === 0 && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 4 }}>
                Inativo
              </span>
            )}
            <div style={{ display: 'flex', gap: 4 }}>
              {canAddChild(node) && (
                <Button variant="ghost" size="sm" leftIcon={<Plus size={14} />} onClick={() => onAdd(node)} title="Adicionar filho">
                  Adicionar
                </Button>
              )}
              <Button variant="ghost" size="sm" leftIcon={<Pencil size={14} />} onClick={() => onEdit(node)} title="Editar">
                Editar
              </Button>
              <Button variant="ghost" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => onDelete(node.id)} title="Excluir" style={{ color: 'var(--color-error)' }}>
                Excluir
              </Button>
            </div>
          </div>
          {node.children.length > 0 && (
            <CategoriaTree
              nodes={node.children}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              canAddChild={canAddChild}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  )
}
