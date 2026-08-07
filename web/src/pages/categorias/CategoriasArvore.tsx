import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSyncDataRefresh } from '../../hooks/useSyncDataRefresh'
import { Button, Input, Alert, Dialog, useOperationToast } from '../../components/ui'
import type { CategoriaTreeNode } from '../../vite-env'
import { Plus, Pencil, Trash2, FolderOpen, ChevronRight, ChevronDown, Tag, Upload, X } from 'lucide-react'

const MAX_CATEGORIA_IMAGEM_BYTES = 1024 * 1024

const NIVEL_LABEL: Record<number, string> = {
  1: 'Grupo',
  2: 'Categoria',
  3: 'Subcategoria'
}

const MAX_NIVEL = 3

export function CategoriasArvore() {
  const { session } = useAuth()
  const empresaId = session?.empresa_id ?? ''
  const syncRefreshKey = useSyncDataRefresh()
  const op = useOperationToast()
  const [tree, setTree] = useState<CategoriaTreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CategoriaTreeNode | null>(null)
  const [parentNode, setParentNode] = useState<CategoriaTreeNode | null>(null)
  const [nome, setNome] = useState('')
  const [ativo, setAtivo] = useState(1)
  const [imagem, setImagem] = useState('')
  const [lojaOnlineSubtitulo, setLojaOnlineSubtitulo] = useState('')
  const [lojaOnlineVitrine, setLojaOnlineVitrine] = useState(0)
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
  }, [load, syncRefreshKey])

  const openNew = (parent: CategoriaTreeNode | null) => {
    setEditing(null)
    setParentNode(parent)
    setNome('')
    setAtivo(1)
    setImagem('')
    setLojaOnlineSubtitulo('')
    setLojaOnlineVitrine(0)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (c: CategoriaTreeNode) => {
    setEditing(c)
    setParentNode(null)
    setNome(c.nome)
    setAtivo(c.ativo)
    setImagem((c as CategoriaTreeNode & { imagem?: string | null }).imagem ?? '')
    setLojaOnlineSubtitulo(
      (c as CategoriaTreeNode & { loja_online_subtitulo?: string | null }).loja_online_subtitulo ?? ''
    )
    setLojaOnlineVitrine(
      Number((c as CategoriaTreeNode & { loja_online_vitrine?: number }).loja_online_vitrine) === 1 ? 1 : 0
    )
    setError('')
    setModalOpen(true)
  }

  const handleImagemFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > MAX_CATEGORIA_IMAGEM_BYTES) {
      setError(`Imagem muito grande. Use até ${MAX_CATEGORIA_IMAGEM_BYTES / (1024 * 1024)} MB.`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImagem(reader.result as string)
      setError('')
    }
    reader.readAsDataURL(file)
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
      const payload = {
        nome: nome.trim(),
        imagem: imagem.trim() || null,
        loja_online_subtitulo: lojaOnlineSubtitulo.trim() || null,
        loja_online_vitrine: lojaOnlineVitrine ? 1 : 0,
      }
      if (editing) {
        await api.update(editing.id, { ...payload, ativo })
      } else {
        await api.create({
          empresa_id: empresaId,
          parent_id: parentNode?.id ?? undefined,
          ativo,
          ...payload,
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
      op.deleted('Categoria excluída com sucesso.')
      setDeleteConfirm(null)
      load()
    } else {
      const msg = 'Não foi possível excluir. Verifique se não há subcategorias ou produtos vinculados.'
      op.error(msg)
      setError(msg)
    }
  }

  const canAddChild = (node: CategoriaTreeNode) => node.nivel < MAX_NIVEL

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
        Edite grupos, categorias e subcategorias usados no cadastro de produtos.
      </p>

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
            expandedIds={expandedIds}
            onToggleExpand={toggleExpanded}
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

          <div className="form-section" style={{ marginTop: 24 }}>
            <h3 className="form-section-title">Loja online</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: '0 0 16px' }}>
              Imagem e textos exibidos na seção de categorias da vitrine. Marque &quot;Exibir na vitrine&quot; para
              aparecer na home da loja.
            </p>
            <div className="form-produto-imagem-block">
              <div className="form-produto-imagem-preview">
                {imagem ? (
                  <img
                    src={imagem}
                    alt=""
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
                  />
                ) : (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', padding: 8, textAlign: 'center' }}>
                    Sem imagem
                  </span>
                )}
              </div>
              <div className="form-produto-imagem-actions">
                <label className="btn btn--secondary btn--md" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content' }}>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    onChange={handleImagemFile}
                    style={{ display: 'none' }}
                  />
                  <Upload size={18} />
                  Enviar imagem
                </label>
                {imagem ? (
                  <Button variant="secondary" leftIcon={<X size={18} />} type="button" onClick={() => setImagem('')}>
                    Remover
                  </Button>
                ) : null}
              </div>
            </div>
            <Input
              label="Ou URL da imagem"
              value={imagem.startsWith('data:') ? '' : imagem}
              onChange={(e) => setImagem(e.currentTarget.value)}
              placeholder="https://..."
              disabled={imagem.startsWith('data:')}
              style={{ marginTop: 12 }}
            />
            <Input
              label="Subtítulo do card"
              value={lojaOnlineSubtitulo}
              onChange={(e) => setLojaOnlineSubtitulo(e.currentTarget.value)}
              placeholder="Ex.: Pague em até 18x | Frete grátis"
              style={{ marginTop: 12 }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={lojaOnlineVitrine === 1}
                onChange={(e) => setLojaOnlineVitrine(e.target.checked ? 1 : 0)}
              />
              Exibir na vitrine da loja online
            </label>
          </div>

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
    </>
  )
}

function CategoriaTree({
  nodes,
  onAdd,
  onEdit,
  onDelete,
  canAddChild,
  expandedIds,
  onToggleExpand,
  depth = 0
}: {
  nodes: CategoriaTreeNode[]
  onAdd: (parent: CategoriaTreeNode | null) => void
  onEdit: (c: CategoriaTreeNode) => void
  onDelete: (id: string) => void
  canAddChild: (node: CategoriaTreeNode) => boolean
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
  depth?: number
}) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0
        const isOpen = expandedIds.has(node.id)
        return (
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
            {hasChildren ? (
              <button
                type="button"
                aria-expanded={isOpen}
                aria-label={isOpen ? 'Recolher' : 'Expandir'}
                title={isOpen ? 'Recolher' : 'Expandir'}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleExpand(node.id)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  flexShrink: 0
                }}
              >
                {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
            ) : (
              <span style={{ width: 28, flexShrink: 0 }} aria-hidden />
            )}
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
          {hasChildren && isOpen && (
            <CategoriaTree
              nodes={node.children}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              canAddChild={canAddChild}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
            />
          )}
        </li>
        )
      })}
    </ul>
  )
}
