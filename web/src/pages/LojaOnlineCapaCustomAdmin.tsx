import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, ExternalLink, Image as ImageIcon, Palette, RefreshCw, Save, Search, Smartphone } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Input, useToast } from '../components/ui'
import {
  createCapaCustomProduto,
  fetchCapaCustomProduto,
  fetchCapaDesignsAdmin,
  saveCapaCustomProduto,
  updateCapaDesignStatus,
  type CapaDesignAdmin,
  type CapaDesignStatus,
  type CapaModeloConfig,
  type CapaProdutoAdmin,
} from '../lib/capa-custom-admin-api'
import { PHONE_MODELS, SERIES } from '../capa-custom/phoneModels'
import { formatCurrency, getLojaOnlinePublicBaseUrl } from '../lib/loja-online'
import { supabase } from '../lib/supabase'

type Props = { empresaId: string }

const MODEL_BY_ID = new Map(PHONE_MODELS.map((m) => [m.id, m]))

const DESIGN_STATUS_LABEL: Record<CapaDesignStatus, string> = {
  rascunho: 'No carrinho (sem pedido)',
  pedido: 'Aguardando produção',
  produzido: 'Produzida',
  cancelado: 'Cancelada',
}

function parseValor(raw: string): number {
  const n = Number(raw.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function formatValorInput(n: number): string {
  return n ? n.toFixed(2).replace('.', ',') : ''
}

function downloadUrl(url: string, filename: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(filename)}`
}

export function LojaOnlineCapaCustomAdmin({ empresaId }: Props) {
  const { addToast } = useToast()
  const [produto, setProduto] = useState<CapaProdutoAdmin | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lojaUrl, setLojaUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setProduto(await fetchCapaCustomProduto(empresaId))
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao carregar a capa personalizada.')
    } finally {
      setLoading(false)
    }
  }, [empresaId, addToast])

  useEffect(() => {
    void load()
    supabase
      .from('empresas_config')
      .select('loja_online_slug, loja_online_dominio_custom')
      .eq('empresa_id', empresaId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.loja_online_slug || data?.loja_online_dominio_custom) {
          setLojaUrl(getLojaOnlinePublicBaseUrl(data))
        }
      })
  }, [empresaId, load])

  if (loading) {
    return <p className="loja-online-hint">Carregando…</p>
  }

  return (
    <div className="loja-capa-admin">
      {produto ? (
        <CapaProdutoEditor
          key={produto.id}
          produto={produto}
          lojaUrl={lojaUrl}
          saving={saving}
          onSave={async (input) => {
            setSaving(true)
            try {
              await saveCapaCustomProduto({ empresaId, produtoId: produto.id, ...input })
              addToast('success', 'Capa personalizada salva. A loja já mostra os novos modelos, preços e estoques.')
              return true
            } catch (e) {
              addToast('error', e instanceof Error ? e.message : 'Erro ao salvar.')
              return false
            } finally {
              setSaving(false)
            }
          }}
        />
      ) : (
        <CapaProdutoCriar
          saving={saving}
          onCreate={async (input) => {
            setSaving(true)
            try {
              setProduto(await createCapaCustomProduto({ empresaId, ...input }))
              addToast('success', 'Produto "Capa personalizada" criado e publicado na loja.')
            } catch (e) {
              addToast('error', e instanceof Error ? e.message : 'Erro ao criar o produto.')
            } finally {
              setSaving(false)
            }
          }}
        />
      )}

      <CapaDesignsList empresaId={empresaId} />
    </div>
  )
}

function CapaProdutoCriar({
  saving,
  onCreate,
}: {
  saving: boolean
  onCreate: (input: { nome: string; precoPadrao: number; estoquePadrao: number; controlaEstoque: boolean }) => Promise<void>
}) {
  const [nome, setNome] = useState('Capa personalizada')
  const [preco, setPreco] = useState('79,90')
  const [controla, setControla] = useState(true)
  const [estoque, setEstoque] = useState('20')

  return (
    <Card className="page-card config-loja-card">
      <CardHeader>
        <span>
          <Palette size={18} /> Ativar capa personalizada
        </span>
      </CardHeader>
      <CardBody className="loja-online-card-body">
        <p className="loja-online-hint">
          O cliente abre o produto na loja, escolhe o modelo do celular, monta a capa com fotos, textos e cor de fundo no
          editor e adiciona ao carrinho. Cada modelo vira uma variação com preço e estoque próprios, e a arte chega junto
          com o pedido, pronta para imprimir.
        </p>
        <Input label="Nome do produto na loja" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Input
          label="Preço inicial de cada modelo (R$)"
          value={preco}
          inputMode="decimal"
          onChange={(e) => setPreco(e.target.value)}
          hint="Você pode ajustar o preço de cada modelo depois."
        />
        <label className="loja-online-toggle">
          <input type="checkbox" checked={controla} onChange={(e) => setControla(e.target.checked)} />
          <span>Controlar estoque por modelo</span>
        </label>
        {controla && (
          <Input
            label="Estoque inicial de cada modelo"
            value={estoque}
            inputMode="numeric"
            onChange={(e) => setEstoque(e.target.value.replace(/\D/g, ''))}
          />
        )}
        <div>
          <Button
            leftIcon={<Palette size={16} />}
            disabled={saving || parseValor(preco) <= 0}
            onClick={() =>
              void onCreate({
                nome,
                precoPadrao: parseValor(preco),
                estoquePadrao: Number(estoque) || 0,
                controlaEstoque: controla,
              })
            }
          >
            {saving ? 'Criando…' : 'Criar produto Capa personalizada'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

type Filtro = 'todos' | 'visiveis' | 'ocultos'

function CapaProdutoEditor({
  produto,
  lojaUrl,
  saving,
  onSave,
}: {
  produto: CapaProdutoAdmin
  lojaUrl: string | null
  saving: boolean
  onSave: (input: {
    nome: string
    descricao: string | null
    controlaEstoque: boolean
    lojaOnline: boolean
    modelos: CapaModeloConfig[]
  }) => Promise<boolean>
}) {
  const [nome, setNome] = useState(produto.nome)
  const [descricao, setDescricao] = useState(produto.descricao ?? '')
  const [lojaOnline, setLojaOnline] = useState(produto.lojaOnline)
  const [controla, setControla] = useState(produto.controlaEstoque)
  const [modelos, setModelos] = useState<CapaModeloConfig[]>(produto.modelos)
  const [precoTexto, setPrecoTexto] = useState<Record<string, string>>(() =>
    Object.fromEntries(produto.modelos.map((m) => [m.modelId, formatValorInput(m.preco)]))
  )
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [precoLote, setPrecoLote] = useState('')
  const [estoqueLote, setEstoqueLote] = useState('')
  const [dirty, setDirty] = useState(false)

  const touch = () => setDirty(true)

  const updateModelo = (modelId: string, patch: Partial<CapaModeloConfig>) => {
    setModelos((prev) => prev.map((m) => (m.modelId === modelId ? { ...m, ...patch } : m)))
    touch()
  }

  const visiveis = modelos.filter((m) => m.ativo)
  const semPreco = visiveis.filter((m) => m.preco <= 0)

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return SERIES.map((serie) => ({
      serie,
      itens: modelos.filter((m) => {
        const model = MODEL_BY_ID.get(m.modelId)
        if (!model || model.series !== serie) return false
        if (filtro === 'visiveis' && !m.ativo) return false
        if (filtro === 'ocultos' && m.ativo) return false
        return !q || model.name.toLowerCase().includes(q)
      }),
    })).filter((g) => g.itens.length > 0)
  }, [modelos, busca, filtro])

  const aplicarLote = () => {
    const preco = precoLote.trim() ? parseValor(precoLote) : null
    const estoque = estoqueLote.trim() ? Number(estoqueLote) || 0 : null
    if (preco === null && estoque === null) return
    setModelos((prev) =>
      prev.map((m) => (m.ativo ? { ...m, ...(preco !== null ? { preco } : {}), ...(estoque !== null ? { estoque } : {}) } : m))
    )
    if (preco !== null) {
      setPrecoTexto((prev) => {
        const next = { ...prev }
        for (const m of modelos) if (m.ativo) next[m.modelId] = formatValorInput(preco)
        return next
      })
    }
    setPrecoLote('')
    setEstoqueLote('')
    touch()
  }

  const marcarSerie = (serie: number, ativo: boolean) => {
    setModelos((prev) => prev.map((m) => (MODEL_BY_ID.get(m.modelId)?.series === serie ? { ...m, ativo } : m)))
    touch()
  }

  const salvar = () =>
    void onSave({
      nome,
      descricao: descricao || null,
      controlaEstoque: controla,
      lojaOnline,
      modelos,
    }).then((ok) => ok && setDirty(false))

  return (
    <>
      <Card className="page-card config-loja-card">
        <CardHeader>
          <span>
            <Palette size={18} /> Produto na loja
          </span>
          {lojaUrl && (
            <a className="loja-capa-admin-link" href={`${lojaUrl}/produto/${produto.id}`} target="_blank" rel="noreferrer">
              Ver na loja <ExternalLink size={14} />
            </a>
          )}
        </CardHeader>
        <CardBody className="loja-online-card-body">
          <Input
            label="Nome do produto"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value)
              touch()
            }}
          />
          <div className="input-wrap">
            <label className="input-label">Descrição</label>
            <textarea
              className="input-el loja-capa-admin-textarea"
              rows={3}
              value={descricao}
              onChange={(e) => {
                setDescricao(e.target.value)
                touch()
              }}
            />
          </div>
          <label className="loja-online-toggle">
            <input
              type="checkbox"
              checked={lojaOnline}
              onChange={(e) => {
                setLojaOnline(e.target.checked)
                touch()
              }}
            />
            <span>Mostrar a capa personalizada na loja online</span>
          </label>
          <label className="loja-online-toggle">
            <input
              type="checkbox"
              checked={controla}
              onChange={(e) => {
                setControla(e.target.checked)
                touch()
              }}
            />
            <span>Controlar estoque por modelo (modelo sem estoque aparece como esgotado)</span>
          </label>
          <p className="loja-online-hint">
            {produto.imagem ? (
              <>Fotos, categoria e dados fiscais ficam no cadastro do produto em <Link to="/produtos">Produtos</Link>.</>
            ) : (
              <>
                <ImageIcon size={14} /> Adicione uma foto de capa do produto em <Link to="/produtos">Produtos</Link> para
                ele aparecer bonito na vitrine.
              </>
            )}
          </p>
        </CardBody>
      </Card>

      <Card className="page-card config-loja-card">
        <CardHeader>
          <span>
            <Smartphone size={18} /> Modelos, preços e estoque
          </span>
          <span className="loja-capa-admin-count">
            {visiveis.length} de {modelos.length} modelos visíveis
          </span>
        </CardHeader>
        <CardBody className="loja-online-card-body">
          <p className="loja-online-hint">
            Marque os modelos que o cliente pode escolher no editor. Modelos desmarcados não aparecem na loja.
          </p>

          <div className="loja-capa-admin-toolbar">
            <label className="loja-capa-admin-search">
              <Search size={16} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar modelo" />
            </label>
            <div className="loja-capa-admin-filtros">
              {(['todos', 'visiveis', 'ocultos'] as Filtro[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`loja-admin-pedidos-periodo${filtro === f ? ' is-active' : ''}`}
                  onClick={() => setFiltro(f)}
                >
                  {f === 'todos' ? 'Todos' : f === 'visiveis' ? 'Visíveis' : 'Ocultos'}
                </button>
              ))}
            </div>
          </div>

          <div className="loja-capa-admin-lote">
            <span>Aplicar a todos os visíveis:</span>
            <input
              className="input-el"
              placeholder="Preço R$"
              inputMode="decimal"
              value={precoLote}
              onChange={(e) => setPrecoLote(e.target.value)}
            />
            {controla && (
              <input
                className="input-el"
                placeholder="Estoque"
                inputMode="numeric"
                value={estoqueLote}
                onChange={(e) => setEstoqueLote(e.target.value.replace(/\D/g, ''))}
              />
            )}
            <Button variant="secondary" size="sm" onClick={aplicarLote} disabled={!precoLote.trim() && !estoqueLote.trim()}>
              Aplicar
            </Button>
          </div>

          <div className="table-wrap">
            <table className="table loja-capa-admin-table">
              <thead>
                <tr>
                  <th className="loja-capa-admin-col-check">Visível</th>
                  <th>Modelo</th>
                  <th className="loja-capa-admin-col-num">Preço (R$)</th>
                  <th className="loja-capa-admin-col-num">Estoque</th>
                  <th>Situação na loja</th>
                </tr>
              </thead>
              {grupos.map((g) => {
                const todosAtivos = g.itens.every((m) => m.ativo)
                return (
                  <tbody key={g.serie}>
                    <tr className="loja-capa-admin-serie">
                      <td colSpan={5}>
                        <strong>iPhone {g.serie}</strong>
                        <button type="button" onClick={() => marcarSerie(g.serie, !todosAtivos)}>
                          {todosAtivos ? 'Ocultar todos' : 'Mostrar todos'}
                        </button>
                      </td>
                    </tr>
                    {g.itens.map((m) => {
                      const model = MODEL_BY_ID.get(m.modelId)!
                      const situacao = !m.ativo
                        ? { label: 'Oculto', cls: 'is-off' }
                        : m.preco <= 0
                          ? { label: 'Sem preço', cls: 'is-warn' }
                          : controla && m.estoque <= 0
                            ? { label: 'Esgotado', cls: 'is-warn' }
                            : { label: 'À venda', cls: 'is-on' }
                      return (
                        <tr key={m.modelId} className={m.ativo ? '' : 'loja-capa-admin-row-off'}>
                          <td className="loja-capa-admin-col-check">
                            <input
                              type="checkbox"
                              checked={m.ativo}
                              aria-label={`Mostrar ${model.name}`}
                              onChange={(e) => updateModelo(m.modelId, { ativo: e.target.checked })}
                            />
                          </td>
                          <td>{model.name}</td>
                          <td className="loja-capa-admin-col-num">
                            <input
                              className="input-el"
                              inputMode="decimal"
                              value={precoTexto[m.modelId] ?? ''}
                              placeholder="0,00"
                              onChange={(e) => {
                                setPrecoTexto((prev) => ({ ...prev, [m.modelId]: e.target.value }))
                                updateModelo(m.modelId, { preco: parseValor(e.target.value) })
                              }}
                            />
                          </td>
                          <td className="loja-capa-admin-col-num">
                            <input
                              className="input-el"
                              inputMode="numeric"
                              disabled={!controla}
                              value={controla ? String(m.estoque) : '—'}
                              onChange={(e) => updateModelo(m.modelId, { estoque: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                            />
                          </td>
                          <td>
                            <span className={`loja-capa-admin-status ${situacao.cls}`}>{situacao.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                )
              })}
            </table>
          </div>

          {semPreco.length > 0 && (
            <p className="loja-online-hint loja-online-hint--warn">
              {semPreco.length} modelo(s) visível(is) sem preço: {semPreco.map((m) => MODEL_BY_ID.get(m.modelId)?.name).join(', ')}.
            </p>
          )}

          <div className="loja-capa-admin-save">
            <Button leftIcon={<Save size={16} />} onClick={salvar} disabled={saving || !dirty}>
              {saving ? 'Salvando…' : dirty ? 'Salvar alterações' : 'Tudo salvo'}
            </Button>
            {dirty && <span className="loja-online-hint">Há alterações não salvas.</span>}
          </div>
          <p className="loja-online-hint">
            Menor preço entre os modelos visíveis: {visiveis.length ? formatCurrency(Math.min(...visiveis.map((m) => m.preco))) : '—'}.
            Cada modelo vira uma variação do produto, então aparece também em Produtos, Estoque e nas vendas do PDV.
          </p>
        </CardBody>
      </Card>
    </>
  )
}

function CapaDesignsList({ empresaId }: { empresaId: string }) {
  const { addToast } = useToast()
  const [designs, setDesigns] = useState<CapaDesignAdmin[]>([])
  const [tabelaAusente, setTabelaAusente] = useState(false)
  const [loading, setLoading] = useState(true)
  const [incluirRascunhos, setIncluirRascunhos] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchCapaDesignsAdmin(empresaId, { incluirRascunhos })
      setDesigns(res.designs)
      setTabelaAusente(res.tabelaAusente)
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao carregar artes.')
    } finally {
      setLoading(false)
    }
  }, [empresaId, incluirRascunhos, addToast])

  useEffect(() => {
    void load()
  }, [load])

  const mudarStatus = async (id: string, status: CapaDesignStatus) => {
    try {
      await updateCapaDesignStatus(id, status)
      setDesigns((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)))
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Erro ao atualizar arte.')
    }
  }

  return (
    <Card className="page-card config-loja-card">
      <CardHeader>
        <span>
          <ImageIcon size={18} /> Artes para produção
        </span>
        <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14} />} onClick={() => void load()}>
          Atualizar
        </Button>
      </CardHeader>
      <CardBody className="loja-online-card-body">
        {tabelaAusente ? (
          <p className="loja-online-hint loja-online-hint--warn">
            Para salvar as artes dos clientes, execute o arquivo <code>web/sql/supabase-loja-online-capa-personalizada.sql</code> no
            SQL Editor do Supabase.
          </p>
        ) : (
          <>
            <label className="loja-online-toggle">
              <input type="checkbox" checked={incluirRascunhos} onChange={(e) => setIncluirRascunhos(e.target.checked)} />
              <span>Mostrar também artes que ainda não viraram pedido</span>
            </label>
            {loading ? (
              <p className="loja-online-hint">Carregando artes…</p>
            ) : designs.length === 0 ? (
              <p className="loja-online-hint">Nenhuma arte ainda. Elas aparecem aqui assim que um cliente compra uma capa personalizada.</p>
            ) : (
              <div className="loja-capa-admin-designs">
                {designs.map((d) => (
                  <article key={d.id} className="loja-capa-admin-design">
                    <a href={d.preview_url ?? '#'} target="_blank" rel="noreferrer" className="loja-capa-admin-design-img">
                      {d.preview_url ? <img src={d.preview_url} alt={`Arte ${d.modelo_nome}`} loading="lazy" /> : null}
                    </a>
                    <div className="loja-capa-admin-design-body">
                      <strong>{d.modelo_nome}</strong>
                      <span>
                        {d.pedido_id ? `Pedido #${d.pedido_id.slice(0, 8).toUpperCase()}` : 'Sem pedido'} ·{' '}
                        {new Date(d.created_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {d.print_largura && d.print_altura && (
                        <span>
                          PNG {d.print_largura}×{d.print_altura}px{d.print_dpi ? ` · ${d.print_dpi} dpi` : ''}
                        </span>
                      )}
                      <select
                        className="input-el"
                        value={d.status}
                        onChange={(e) => void mudarStatus(d.id, e.target.value as CapaDesignStatus)}
                      >
                        {(Object.keys(DESIGN_STATUS_LABEL) as CapaDesignStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {DESIGN_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                      <div className="loja-capa-admin-design-actions">
                        {d.print_url && (
                          <a className="btn btn--primary btn--sm" href={downloadUrl(d.print_url, `capa-${d.id.slice(0, 8)}.png`)}>
                            <Download size={14} /> Arquivo de impressão
                          </a>
                        )}
                        {(d.assets_json ?? []).map((url, i) => (
                          <a key={url} className="btn btn--secondary btn--sm" href={downloadUrl(url, `foto-${d.id.slice(0, 8)}-${i + 1}`)}>
                            Foto {i + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  )
}
