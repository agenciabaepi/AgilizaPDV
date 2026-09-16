import { useEffect, useMemo, useState } from 'react'
import { Layers, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { Button, Dialog, Input, Select, useToast } from '../components/ui'
import { eventValue } from '../lib/dom-event'
import {
  deleteLojaOnlineColecao,
  fetchLojaOnlineCategorias,
  fetchLojaOnlineColecoes,
  fetchLojaOnlineProdutos,
  saveLojaOnlineColecao,
} from '../lib/loja-online-api'
import { isProdutoNaCategoriaMenu } from '../lib/loja-online-categorias'
import { formatCurrency } from '../lib/loja-online'
import type { LojaOnlineCategoria, LojaOnlineColecao, LojaOnlineProduto } from '../lib/loja-online-types'

type Props = { empresaId: string }

const MAX_IMAGEM_BYTES = 1024 * 1024

type FormState = {
  nome: string
  subtitulo: string
  descricao: string
  categoriaId: string
  imagem: string
  imagemCapa: string
  ordem: string
  ativo: boolean
  produtoIds: string[]
}

const emptyForm = (): FormState => ({
  nome: '',
  subtitulo: '',
  descricao: '',
  categoriaId: '',
  imagem: '',
  imagemCapa: '',
  ordem: '0',
  ativo: true,
  produtoIds: [],
})

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Arquivo inválido. Envie uma imagem.'))
      return
    }
    if (file.size > MAX_IMAGEM_BYTES) {
      reject(new Error('Imagem muito grande. Use até 1 MB.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

export function LojaOnlineColecoesAdmin({ empresaId }: Props) {
  const { addToast } = useToast()
  const [colecoes, setColecoes] = useState<LojaOnlineColecao[]>([])
  const [categorias, setCategorias] = useState<LojaOnlineCategoria[]>([])
  const [produtos, setProdutos] = useState<LojaOnlineProduto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<LojaOnlineColecao | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [buscaProduto, setBuscaProduto] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetchLojaOnlineColecoes(empresaId),
      fetchLojaOnlineCategorias(empresaId),
      fetchLojaOnlineProdutos(empresaId, false),
    ])
      .then(([list, cats, prods]) => {
        setColecoes(Array.isArray(list) ? list.filter(Boolean) : [])
        setCategorias(Array.isArray(cats) ? cats.filter(Boolean) : [])
        setProdutos(Array.isArray(prods) ? prods.filter(Boolean) : [])
      })
      .catch((err) => addToast('error', err instanceof Error ? err.message : 'Erro ao carregar coleções.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [empresaId])

  const categoriaOptions = useMemo(
    () =>
      categorias
        .filter((c) => c && typeof c.id === 'string')
        .map((c) => ({ value: c.id, label: c.path || c.nome })),
    [categorias]
  )

  const produtosFiltrados = useMemo(() => {
    const q = buscaProduto.trim().toLowerCase()
    return produtos
      .filter((p) => p && !p.produto_pai_id)
      .filter((p) => {
        if (!form.categoriaId) return true
        return isProdutoNaCategoriaMenu(p, form.categoriaId, categorias)
      })
      .filter((p) => !q || p.nome.toLowerCase().includes(q) || String(p.codigo ?? '').includes(q))
      .slice(0, 80)
  }, [produtos, buscaProduto, form.categoriaId, categorias])

  const produtosSelecionados = useMemo(() => {
    const byId = new Map(produtos.map((p) => [p.id, p]))
    return form.produtoIds.map((id) => byId.get(id)).filter((p): p is LojaOnlineProduto => !!p)
  }, [form.produtoIds, produtos])

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm())
    setBuscaProduto('')
    setModalOpen(true)
  }

  const openEdit = (c: LojaOnlineColecao) => {
    setEditing(c)
    setForm({
      nome: c.nome,
      subtitulo: c.subtitulo ?? '',
      descricao: c.descricao ?? '',
      categoriaId: c.categoria_id ?? '',
      imagem: c.imagem ?? '',
      imagemCapa: c.imagem_capa ?? '',
      ordem: String(c.ordem ?? 0),
      ativo: c.ativo !== 0,
      produtoIds: c.produto_ids ?? [],
    })
    setBuscaProduto('')
    setModalOpen(true)
  }

  const handleImagem = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'imagem' | 'imagemCapa'
  ) => {
    const input = e.currentTarget ?? e.target
    const file = input?.files?.[0]
    if (input) input.value = ''
    if (!file) return
    try {
      const dataUrl = await readImageFile(file)
      setForm((f) => ({ ...f, [field]: dataUrl }))
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao enviar imagem.')
    }
  }

  const toggleProduto = (id: string) => {
    setForm((f) => ({
      ...f,
      produtoIds: f.produtoIds.includes(id)
        ? f.produtoIds.filter((pid) => pid !== id)
        : [...f.produtoIds, id],
    }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim()) {
      addToast('error', 'Nome da coleção é obrigatório.')
      return
    }
    if (form.produtoIds.length === 0) {
      addToast('error', 'Selecione pelo menos um produto da coleção.')
      return
    }
    setSaving(true)
    try {
      await saveLojaOnlineColecao({
        empresaId,
        id: editing?.id,
        nome: form.nome,
        subtitulo: form.subtitulo,
        descricao: form.descricao,
        categoriaId: form.categoriaId || null,
        imagem: form.imagem,
        imagemCapa: form.imagemCapa,
        ordem: Number(form.ordem) || 0,
        ativo: form.ativo,
        produtoIds: form.produtoIds,
        slug: editing?.slug,
      })
      setModalOpen(false)
      addToast('success', editing ? 'Coleção atualizada.' : 'Coleção criada.')
      load()
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao salvar coleção.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteLojaOnlineColecao(id)
      setDeleteConfirm(null)
      addToast('success', 'Coleção excluída.')
      load()
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao excluir coleção.')
    }
  }

  return (
    <div className="loja-colecoes-admin">
      <div className="loja-colecoes-admin-toolbar">
        <Button leftIcon={<Plus size={18} />} onClick={openNew}>
          Nova coleção
        </Button>
      </div>

      {loading ? (
        <p className="loja-online-hint">Carregando coleções…</p>
      ) : colecoes.length === 0 ? (
        <p className="loja-online-hint">
          Nenhuma coleção cadastrada. Crie temas como Marvel, cristã ou católica e escolha os produtos de cada uma.
        </p>
      ) : (
        <div className="loja-colecoes-admin-list">
          {colecoes.map((c) => (
            <article key={c.id} className="loja-colecoes-admin-item">
              <div className="loja-colecoes-admin-thumb">
                {c.imagem ? (
                  <img src={c.imagem} alt="" />
                ) : (
                  <Layers size={28} strokeWidth={1.5} />
                )}
              </div>
              <div className="loja-colecoes-admin-item-body">
                <strong>{c.nome}</strong>
                <span className="loja-cupons-item-meta">
                  {c.produtos_count ?? 0} produto(s)
                  {c.ativo !== 1 ? ' · oculta na vitrine' : ''}
                </span>
              </div>
              <div className="loja-orderbumps-item-actions">
                <Button variant="ghost" size="sm" leftIcon={<Pencil size={14} />} onClick={() => openEdit(c)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Trash2 size={14} />}
                  onClick={() => setDeleteConfirm(c.id)}
                  style={{ color: 'var(--color-error)' }}
                >
                  Excluir
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar coleção' : 'Nova coleção'}
        size="large"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-colecao" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar coleção'}
            </Button>
          </>
        }
      >
        <form id="form-colecao" onSubmit={submit} className="loja-colecoes-form">
          <Input
            label="Nome da coleção"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: eventValue(e) }))}
            required
            placeholder="Ex.: Coleção Marvel, Coleção cristã"
          />
          <Input
            label="Subtítulo do card (opcional)"
            value={form.subtitulo}
            onChange={(e) => setForm((f) => ({ ...f, subtitulo: eventValue(e) }))}
            placeholder="Ex.: Capas com estampa da coleção"
          />
          <div className="input-wrap">
            <label className="input-label">Descrição da página (opcional)</label>
            <textarea
              className="input-el loja-online-textarea"
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: eventValue(e) }))}
              placeholder="Texto exibido na página da coleção."
            />
          </div>
          <div className="loja-colecoes-form-grid">
            <Select
              label="Categoria dos produtos"
              placeholder="Todas as categorias"
              options={categoriaOptions}
              value={form.categoriaId || ''}
              onChange={(e) => setForm((f) => ({ ...f, categoriaId: eventValue(e) }))}
            />
            <Input
              label="Ordem na vitrine"
              value={form.ordem}
              onChange={(e) => setForm((f) => ({ ...f, ordem: eventValue(e).replace(/\D/g, '') }))}
              placeholder="0"
            />
          </div>

          <div className="loja-colecoes-imagens">
            <ImageField
              label="Foto da coleção"
              hint="Aparece no card da home."
              value={form.imagem}
              onFile={(e) => handleImagem(e, 'imagem')}
              onUrl={(url) => setForm((f) => ({ ...f, imagem: url }))}
              onClear={() => setForm((f) => ({ ...f, imagem: '' }))}
            />
            <ImageField
              label="Foto de capa da página"
              hint="Banner no topo da página da coleção."
              value={form.imagemCapa}
              onFile={(e) => handleImagem(e, 'imagemCapa')}
              onUrl={(url) => setForm((f) => ({ ...f, imagemCapa: url }))}
              onClear={() => setForm((f) => ({ ...f, imagemCapa: '' }))}
            />
          </div>

          <div className="loja-colecoes-produtos">
            <h3 className="form-section-title">Produtos da coleção</h3>
            <p className="loja-online-hint" style={{ marginTop: 0 }}>
              {form.categoriaId
                ? 'A lista abaixo mostra produtos da categoria escolhida. Você também pode buscar pelo nome.'
                : 'Selecione a categoria para filtrar, ou busque e marque os produtos.'}
            </p>
            {produtosSelecionados.length > 0 && (
              <div className="loja-colecoes-chips">
                {produtosSelecionados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="loja-colecoes-chip"
                    onClick={() => toggleProduto(p.id)}
                  >
                    {p.nome}
                    <X size={14} />
                  </button>
                ))}
              </div>
            )}
            <Input
              label="Buscar produto"
              value={buscaProduto}
              onChange={(e) => setBuscaProduto(eventValue(e))}
              placeholder="Nome ou código"
            />
            <div className="loja-colecoes-pick-list">
              {produtosFiltrados.length === 0 ? (
                <p className="loja-online-hint">Nenhum produto encontrado.</p>
              ) : (
                produtosFiltrados.map((p) => {
                  const checked = form.produtoIds.includes(p.id)
                  return (
                    <label key={p.id} className={`loja-colecoes-pick${checked ? ' is-checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProduto(p.id)}
                      />
                      {p.imagem ? <img src={p.imagem} alt="" /> : <span className="loja-colecoes-pick-ph" />}
                      <span>
                        <strong>{p.nome}</strong>
                        <small>{formatCurrency(p.preco)}</small>
                      </span>
                    </label>
                  )
                })
              )}
            </div>
            <p className="loja-online-hint">{form.produtoIds.length} produto(s) selecionado(s)</p>
          </div>

          <label className="loja-online-toggle" style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
            />
            <span>Exibir na vitrine da loja online</span>
          </label>
        </form>
      </Dialog>

      {deleteConfirm && (
        <Dialog
          open
          onClose={() => setDeleteConfirm(null)}
          title="Excluir coleção?"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => handleDelete(deleteConfirm)}>
                Excluir
              </Button>
            </>
          }
        >
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            A coleção sai da vitrine. Os produtos continuam cadastrados normalmente.
          </p>
        </Dialog>
      )}
    </div>
  )
}

function ImageField({
  label,
  hint,
  value,
  onFile,
  onUrl,
  onClear,
}: {
  label: string
  hint: string
  value: string
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void
  onUrl: (url: string) => void
  onClear: () => void
}) {
  const safeValue = value ?? ''
  return (
    <div className="form-produto-imagem-block">
      <span className="input-label">{label}</span>
      <p className="loja-online-hint" style={{ margin: '0 0 8px' }}>
        {hint}
      </p>
      <div className="form-produto-imagem-preview">
        {safeValue ? (
          <img src={safeValue} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
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
            onChange={onFile}
            style={{ display: 'none' }}
          />
          <Upload size={18} />
          Enviar imagem
        </label>
        {safeValue ? (
          <Button variant="secondary" leftIcon={<X size={18} />} type="button" onClick={onClear}>
            Remover
          </Button>
        ) : null}
      </div>
      <Input
        label="Ou URL da imagem"
        value={safeValue.startsWith('data:') ? '' : safeValue}
        onChange={(e) => onUrl(eventValue(e))}
        placeholder="https://..."
        disabled={safeValue.startsWith('data:')}
        style={{ marginTop: 12 }}
      />
    </div>
  )
}
