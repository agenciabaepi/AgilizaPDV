import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, Input } from './ui'
import {
  emptyEixo,
  emptyValor,
  eixosTemplateCapaCelular,
  generateVariacaoCombinacoes,
  labelCombinacao,
  MAX_VARIACAO_COMBINACOES,
  mergeSkusComCombinacoes,
  resolverEixosMarcaModelo,
  type VariacaoEixo,
  type VariacaoSkuDraft,
} from '../lib/produto-variacoes'
import { eventChecked, eventValue } from '../lib/dom-event'

type Props = {
  eixos: VariacaoEixo[]
  skus: VariacaoSkuDraft[]
  precoPadrao: number
  onChange: (next: { eixos: VariacaoEixo[]; skus: VariacaoSkuDraft[] }) => void
}

function ensureMarcaModelo(eixos: VariacaoEixo[]): VariacaoEixo[] {
  if (eixos.length === 0) return eixosTemplateCapaCelular()
  const { marca, modelo } = resolverEixosMarcaModelo(eixos)
  if (marca && modelo) {
    return eixos.map((e) => {
      if (e.id === marca.id) return { ...e, nome: e.nome.trim() || 'Marca' }
      if (e.id === modelo.id) {
        return {
          ...e,
          nome: e.nome.trim() || 'Modelo',
          dependeDeEixoId: marca.id,
        }
      }
      return e
    })
  }
  return eixosTemplateCapaCelular()
}

export function ProdutoVariacoesEditor({ eixos, skus, precoPadrao, onChange }: Props) {
  const base = useMemo(() => ensureMarcaModelo(eixos), [eixos])
  const { marca, modelo, extras } = useMemo(() => resolverEixosMarcaModelo(base), [base])
  const [marcaAtivaId, setMarcaAtivaId] = useState<string>('')
  const [novaMarca, setNovaMarca] = useState('')
  const [novoModelo, setNovoModelo] = useState('')
  const [novaCor, setNovaCor] = useState({ nome: '', hex: '#111111' })
  const [mostrarCores, setMostrarCores] = useState(() => extras.some((e) => e.tipo === 'cor' || e.nome.toLowerCase().includes('cor')))

  const comboCount = useMemo(() => generateVariacaoCombinacoes(base).length, [base])

  const emit = (nextEixos: VariacaoEixo[], nextSkus = skus) => {
    const normalized = ensureMarcaModelo(nextEixos)
    onChange({
      eixos: normalized,
      skus: mergeSkusComCombinacoes(normalized, nextSkus, precoPadrao),
    })
  }

  if (!marca || !modelo) {
    return (
      <div className="produto-variacoes">
        <p className="input-hint">Não foi possível carregar as variações.</p>
        <Button type="button" variant="secondary" size="sm" onClick={() => emit(eixosTemplateCapaCelular(), [])}>
          Começar com Marca e Modelo
        </Button>
      </div>
    )
  }

  const marcaSelecionadaId = marcaAtivaId && marca.valores.some((v) => v.id === marcaAtivaId)
    ? marcaAtivaId
    : marca.valores[0]?.id ?? ''

  const modelosDaMarca = modelo.valores.filter((v) => v.parentValorId === marcaSelecionadaId)
  const corEixo = extras.find((e) => e.tipo === 'cor' || e.nome.toLowerCase().includes('cor')) ?? null

  const addMarca = () => {
    const nome = novaMarca.trim()
    if (!nome) return
    if (marca.valores.some((v) => v.nome.toLowerCase() === nome.toLowerCase())) {
      setNovaMarca('')
      return
    }
    const valor = emptyValor({ nome })
    emit(
      base.map((e) => (e.id === marca.id ? { ...e, valores: [...e.valores, valor] } : e))
    )
    setMarcaAtivaId(valor.id)
    setNovaMarca('')
  }

  const removeMarca = (marcaId: string) => {
    emit(
      base.map((e) => {
        if (e.id === marca.id) return { ...e, valores: e.valores.filter((v) => v.id !== marcaId) }
        if (e.id === modelo.id) {
          return { ...e, valores: e.valores.filter((v) => v.parentValorId !== marcaId) }
        }
        return e
      })
    )
    if (marcaSelecionadaId === marcaId) setMarcaAtivaId('')
  }

  const addModelo = () => {
    const nome = novoModelo.trim()
    if (!nome || !marcaSelecionadaId) return
    if (
      modelo.valores.some(
        (v) => v.parentValorId === marcaSelecionadaId && v.nome.toLowerCase() === nome.toLowerCase()
      )
    ) {
      setNovoModelo('')
      return
    }
    const valor = emptyValor({ nome, parentValorId: marcaSelecionadaId })
    emit(
      base.map((e) => (e.id === modelo.id ? { ...e, valores: [...e.valores, valor] } : e))
    )
    setNovoModelo('')
  }

  const removeModelo = (modeloId: string) => {
    emit(
      base.map((e) =>
        e.id === modelo.id ? { ...e, valores: e.valores.filter((v) => v.id !== modeloId) } : e
      )
    )
  }

  const enableCores = () => {
    setMostrarCores(true)
    if (corEixo) return
    const cor = emptyEixo({
      nome: 'Cor',
      tipo: 'cor',
      valores: [
        emptyValor({ nome: 'Preto', hex: '#111111' }),
        emptyValor({ nome: 'Branco', hex: '#f5f5f5' }),
        emptyValor({ nome: 'Azul', hex: '#1d4ed8' }),
      ],
    })
    emit([...base, cor])
  }

  const disableCores = () => {
    setMostrarCores(false)
    if (!corEixo) return
    emit(base.filter((e) => e.id !== corEixo.id))
  }

  const addCor = () => {
    if (!corEixo) return
    const nome = novaCor.nome.trim()
    if (!nome) return
    const valor = emptyValor({ nome, hex: novaCor.hex || '#111111' })
    emit(
      base.map((e) => (e.id === corEixo.id ? { ...e, valores: [...e.valores, valor] } : e))
    )
    setNovaCor({ nome: '', hex: '#111111' })
  }

  const removeCor = (corId: string) => {
    if (!corEixo) return
    emit(
      base.map((e) =>
        e.id === corEixo.id ? { ...e, valores: e.valores.filter((v) => v.id !== corId) } : e
      )
    )
  }

  const updateSku = (chave: string, patch: Partial<VariacaoSkuDraft>) => {
    onChange({
      eixos: base,
      skus: skus.map((s) => (s.chave === chave ? { ...s, ...patch } : s)),
    })
  }

  const marcaNome = marca.valores.find((v) => v.id === marcaSelecionadaId)?.nome

  return (
    <div className="produto-variacoes">
      <p className="input-hint" style={{ marginBottom: 16 }}>
        Cadastre as <strong>marcas</strong> e, para cada marca, os <strong>modelos</strong>.
        Cada combinação vira um SKU com preço e estoque próprios na loja.
      </p>

      {eixos.length === 0 && (
        <div className="produto-variacoes-toolbar" style={{ marginBottom: 16 }}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<Plus size={16} />}
            onClick={() => emit(eixosTemplateCapaCelular(), [])}
          >
            Ativar variações (Marca + Modelo)
          </Button>
        </div>
      )}

      {eixos.length > 0 && (
        <>
          <section className="produto-variacoes-step">
            <h3 className="form-section-title">1. Marcas</h3>
            <div className="produto-variacoes-valores">
              {marca.valores.map((valor) => (
                <button
                  key={valor.id}
                  type="button"
                  className={`produto-variacoes-marca-btn${marcaSelecionadaId === valor.id ? ' is-selected' : ''}`}
                  onClick={() => setMarcaAtivaId(valor.id)}
                >
                  {valor.nome}
                  <span
                    role="button"
                    tabIndex={0}
                    className="produto-variacoes-marca-remove"
                    aria-label={`Remover ${valor.nome}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeMarca(valor.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        removeMarca(valor.id)
                      }
                    }}
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
            <div className="produto-variacoes-add-valor">
              <Input
                placeholder="Ex.: iPhone, Samsung, Motorola…"
                value={novaMarca}
                onChange={(e) => setNovaMarca(eventValue(e))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addMarca()
                  }
                }}
              />
              <Button type="button" variant="secondary" size="sm" onClick={addMarca}>
                Adicionar marca
              </Button>
            </div>
          </section>

          <section className="produto-variacoes-step">
            <h3 className="form-section-title">
              2. Modelos{marcaNome ? ` de ${marcaNome}` : ''}
            </h3>
            {!marcaSelecionadaId ? (
              <p className="input-hint">Adicione uma marca primeiro.</p>
            ) : (
              <>
                <div className="produto-variacoes-valores">
                  {modelosDaMarca.length === 0 && (
                    <p className="input-hint" style={{ margin: 0 }}>
                      Nenhum modelo nesta marca ainda.
                    </p>
                  )}
                  {modelosDaMarca.map((valor) => (
                    <span key={valor.id} className="produto-variacoes-chip">
                      {valor.nome}
                      <button type="button" onClick={() => removeModelo(valor.id)} aria-label="Remover modelo">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="produto-variacoes-add-valor">
                  <Input
                    placeholder={`Ex.: ${marcaNome} 13, ${marcaNome} 14 Pro…`}
                    value={novoModelo}
                    onChange={(e) => setNovoModelo(eventValue(e))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addModelo()
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={addModelo}>
                    Adicionar modelo
                  </Button>
                </div>
              </>
            )}
          </section>

          <section className="produto-variacoes-step">
            <div className="produto-variacoes-step-head">
              <h3 className="form-section-title" style={{ margin: 0 }}>
                3. Cores (opcional)
              </h3>
              {!mostrarCores ? (
                <Button type="button" variant="ghost" size="sm" onClick={enableCores}>
                  Adicionar cores
                </Button>
              ) : (
                <Button type="button" variant="ghost" size="sm" onClick={disableCores}>
                  Remover cores
                </Button>
              )}
            </div>
            {mostrarCores && corEixo && (
              <>
                <div className="produto-variacoes-valores">
                  {corEixo.valores.map((valor) => (
                    <span key={valor.id} className="produto-variacoes-chip">
                      <span
                        className="produto-variacoes-swatch"
                        style={{ background: valor.hex || '#111' }}
                        aria-hidden
                      />
                      {valor.nome}
                      <button type="button" onClick={() => removeCor(valor.id)} aria-label="Remover cor">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="produto-variacoes-add-valor">
                  <Input
                    placeholder="Nome da cor"
                    value={novaCor.nome}
                    onChange={(e) => setNovaCor((prev) => ({ ...prev, nome: eventValue(e) }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCor()
                      }
                    }}
                  />
                  <input
                    type="color"
                    className="produto-variacoes-color"
                    value={novaCor.hex}
                    onChange={(e) => setNovaCor((prev) => ({ ...prev, hex: eventValue(e) }))}
                    aria-label="Cor"
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={addCor}>
                    Adicionar cor
                  </Button>
                </div>
              </>
            )}
          </section>

          {skus.length > 0 && (
            <div className="form-section" style={{ marginTop: 8 }}>
              <h3 className="form-section-title">4. Preço e estoque por combinação</h3>
              <p className="input-hint" style={{ marginBottom: 12 }}>
                {comboCount} combinação{comboCount === 1 ? '' : 'ões'}
                {comboCount >= MAX_VARIACAO_COMBINACOES ? ` (limite de ${MAX_VARIACAO_COMBINACOES})` : ''}.
                Desmarque as que não vender.
              </p>
              <div className="table-wrap produto-variacoes-table-wrap">
                <table className="table produto-variacoes-table">
                  <thead>
                    <tr>
                      <th>Ativo</th>
                      <th>Combinação</th>
                      <th>SKU</th>
                      <th>Preço</th>
                      <th>Estoque</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skus.map((sku, skuIndex) => (
                      <tr key={sku.chave || sku.id || `sku-${skuIndex}`} className={sku.ativo ? undefined : 'is-off'}>
                        <td>
                          <input
                            type="checkbox"
                            checked={sku.ativo}
                            onChange={(e) => updateSku(sku.chave, { ativo: eventChecked(e) })}
                          />
                        </td>
                        <td>{labelCombinacao(base, sku.valores) || '—'}</td>
                        <td>
                          <input
                            className="input-el"
                            value={sku.sku}
                            onChange={(e) => updateSku(sku.chave, { sku: eventValue(e) })}
                            placeholder="Opcional"
                          />
                        </td>
                        <td>
                          <input
                            className="input-el"
                            type="number"
                            min={0}
                            step="0.01"
                            value={sku.preco}
                            onChange={(e) => updateSku(sku.chave, { preco: Number(eventValue(e)) || 0 })}
                          />
                        </td>
                        <td>
                          <input
                            className="input-el"
                            type="number"
                            min={0}
                            step="1"
                            value={sku.estoque}
                            onChange={(e) => updateSku(sku.chave, { estoque: Number(eventValue(e)) || 0 })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
