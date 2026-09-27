import { useEffect, useMemo, useRef, useState } from 'react'
import type { LojaOnlineProduto } from '../../lib/loja-online-types'
import {
  labelCombinacao,
  labelVariacaoSku,
  mergeEixosComSkus,
  parseVariacaoEixos,
  parseVariacaoValores,
  resolverEixosMarcaModelo,
  valorById,
} from '../../lib/produto-variacoes'
import type { LojaOnlineVariacaoSku } from '../../lib/loja-online-api'

function LojaOnlineVariacoesFlat({
  produto,
  skus,
  onSkuChange,
  mostrarErro,
}: {
  produto: LojaOnlineProduto
  skus: LojaOnlineVariacaoSku[]
  onSkuChange: (sku: LojaOnlineVariacaoSku | null, label: string) => void
  mostrarErro: boolean
}) {
  const [selectedId, setSelectedId] = useState<string | null>(skus.length === 1 ? skus[0].id : null)
  const selected = skus.find((s) => s.id === selectedId) ?? null
  const label = selected ? labelVariacaoSku(produto.nome, selected.nome) : ''

  const lastSkuId = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const id = selected?.id ?? null
    if (lastSkuId.current === id) return
    lastSkuId.current = id
    onSkuChange(selected, label)
  }, [selected, label, onSkuChange])

  return (
    <div className={`loja-variacoes${mostrarErro && !selected ? ' has-erro' : ''}`}>
      {mostrarErro && !selected && (
        <p className="loja-variacoes-erro" role="alert">
          Selecione uma opção para continuar.
        </p>
      )}
      <label className="loja-variacoes-select-wrap">
        <span className="loja-variacoes-select-label">Opção</span>
        <select
          className="loja-variacoes-select"
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(e.currentTarget.value || null)}
        >
          <option value="">Selecione…</option>
          {skus.map((sku) => (
            <option key={sku.id} value={sku.id}>
              {labelVariacaoSku(produto.nome, sku.nome)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export function LojaOnlineVariacoesPicker({
  produto,
  skus,
  onSkuChange,
  mostrarErro = false,
}: {
  produto: LojaOnlineProduto
  skus: LojaOnlineVariacaoSku[]
  onSkuChange: (sku: LojaOnlineVariacaoSku | null, label: string) => void
  /** Destaca as opções pendentes (cliente tentou comprar sem escolher). */
  mostrarErro?: boolean
}) {
  const ativos = useMemo(() => skus.filter((s) => Number(s.ativo) === 1), [skus])
  const eixos = useMemo(
    () => mergeEixosComSkus(parseVariacaoEixos(produto.variacao_eixos_json), ativos),
    [produto.variacao_eixos_json, ativos]
  )
  const { marca, modelo, extras } = useMemo(() => resolverEixosMarcaModelo(eixos), [eixos])
  const [selecao, setSelecao] = useState<Record<string, string>>({})

  const marcasDisponiveis = useMemo(() => {
    if (!marca) return []
    return marca.valores.filter((valor) =>
      ativos.some((s) => parseVariacaoValores(s.variacao_valores_json)[marca.id] === valor.id)
    )
  }, [marca, ativos])

  // Só pré-seleciona a marca quando existe uma única opção; o modelo o cliente escolhe
  useEffect(() => {
    if (!marca || marcasDisponiveis.length !== 1) return
    const unica = marcasDisponiveis[0].id
    setSelecao((prev) => (prev[marca.id] ? prev : { ...prev, [marca.id]: unica }))
  }, [marca, marcasDisponiveis])

  const modelosDisponiveis = useMemo(() => {
    if (!modelo || !marca) return []
    const marcaId = selecao[marca.id]
    if (!marcaId) return []
    return modelo.valores.filter((valor) => {
      if (valor.parentValorId && valor.parentValorId !== marcaId) return false
      return ativos.some((s) => {
        const vals = parseVariacaoValores(s.variacao_valores_json)
        return vals[marca.id] === marcaId && vals[modelo.id] === valor.id
      })
    })
  }, [modelo, marca, selecao, ativos])

  const skuAtual = useMemo(() => {
    const keys = eixos.map((e) => e.id)
    if (keys.length === 0 || keys.some((k) => !selecao[k])) return null
    return (
      ativos.find((s) => {
        const vals = parseVariacaoValores(s.variacao_valores_json)
        return keys.every((k) => vals[k] === selecao[k])
      }) ?? null
    )
  }, [ativos, eixos, selecao])

  const label = skuAtual
    ? labelCombinacao(eixos, parseVariacaoValores(skuAtual.variacao_valores_json))
    : ''

  const lastSkuId = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const id = skuAtual?.id ?? null
    if (lastSkuId.current === id) return
    lastSkuId.current = id
    onSkuChange(skuAtual, label)
  }, [skuAtual, label, onSkuChange])

  const setMarca = (marcaValorId: string) => {
    if (!marca) return
    setSelecao((prev) => {
      const next: Record<string, string> = { ...prev, [marca.id]: marcaValorId }
      if (modelo) {
        const modelos = modelo.valores.filter(
          (v) =>
            (!v.parentValorId || v.parentValorId === marcaValorId) &&
            ativos.some((s) => {
              const vals = parseVariacaoValores(s.variacao_valores_json)
              return vals[marca.id] === marcaValorId && vals[modelo.id] === v.id
            })
        )
        if (modelos.length === 1) next[modelo.id] = modelos[0].id
        else if (!modelos.some((m) => m.id === next[modelo.id])) delete next[modelo.id]
      }
      for (const extra of extras) {
        if (extra.dependeDeEixoId === marca.id || extra.dependeDeEixoId === modelo?.id) {
          delete next[extra.id]
        }
      }
      // Se já houver modelo, completa extras disponíveis
      if (modelo && next[modelo.id]) {
        for (const extra of extras) {
          const candidatos = extra.valores.filter((valor) =>
            ativos.some((s) => {
              const vals = parseVariacaoValores(s.variacao_valores_json)
              if (vals[marca.id] !== marcaValorId) return false
              if (vals[modelo.id] !== next[modelo.id]) return false
              return vals[extra.id] === valor.id
            })
          )
          if (candidatos.length === 1) next[extra.id] = candidatos[0].id
          else if (!candidatos.some((c) => c.id === next[extra.id])) delete next[extra.id]
        }
      }
      return next
    })
  }

  const setModelo = (modeloValorId: string) => {
    if (!modelo || !marca) return
    setSelecao((prev) => {
      const next = { ...prev, [modelo.id]: modeloValorId }
      for (const extra of extras) {
        const candidatos = extra.valores.filter((valor) =>
          ativos.some((s) => {
            const vals = parseVariacaoValores(s.variacao_valores_json)
            if (vals[marca.id] !== next[marca.id]) return false
            if (vals[modelo.id] !== modeloValorId) return false
            return vals[extra.id] === valor.id
          })
        )
        if (candidatos.length === 1) next[extra.id] = candidatos[0].id
        else if (!candidatos.some((c) => c.id === next[extra.id])) delete next[extra.id]
      }
      return next
    })
  }

  const setExtra = (eixoId: string, valorId: string) => {
    setSelecao((prev) => ({ ...prev, [eixoId]: valorId }))
  }

  if (ativos.length === 0) return null

  if (!marca || !modelo || marcasDisponiveis.length === 0) {
    return (
      <LojaOnlineVariacoesFlat
        produto={produto}
        skus={ativos}
        onSkuChange={onSkuChange}
        mostrarErro={mostrarErro}
      />
    )
  }

  const marcaAtual = valorById(eixos, marca.id, selecao[marca.id])
  const modeloAtual = valorById(eixos, modelo.id, selecao[modelo.id])
  const pendente = mostrarErro && !skuAtual ? eixos.find((e) => !selecao[e.id]) : undefined
  const eixoClass = (eixoId: string) =>
    `loja-variacoes-eixo${pendente?.id === eixoId ? ' is-pendente' : ''}`

  return (
    <div className={`loja-variacoes${mostrarErro && !skuAtual ? ' has-erro' : ''}`}>
      <p className="loja-variacoes-heading">Escolha as opções</p>
      {mostrarErro && !skuAtual && (
        <p className="loja-variacoes-erro" role="alert">
          Selecione {pendente ? `o ${pendente.nome.toLowerCase()}` : 'uma opção'} para continuar.
        </p>
      )}

      {marcasDisponiveis.length > 0 ? (
        <div className={eixoClass(marca.id)}>
          <p className="loja-variacoes-label">
            {marca.nome}: <strong>{marcaAtual?.nome ?? 'Selecione'}</strong>
          </p>
          <div className="loja-variacoes-marcas" role="list" aria-label={marca.nome}>
            {marcasDisponiveis.map((valor) => {
              const selected = selecao[marca.id] === valor.id
              return (
                <button
                  key={valor.id}
                  type="button"
                  role="listitem"
                  className={`loja-variacoes-marca${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => setMarca(valor.id)}
                >
                  {valor.nome}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className={eixoClass(modelo.id)}>
        <p className="loja-variacoes-label">
          {modelo.nome}: <strong>{modeloAtual?.nome ?? (selecao[marca.id] ? 'Selecione' : 'Escolha a marca')}</strong>
        </p>
        {!selecao[marca.id] ? (
          <p className="loja-variacoes-empty">Escolha a marca primeiro</p>
        ) : modelosDisponiveis.length === 0 ? (
          <p className="loja-variacoes-empty">Nenhum modelo disponível para esta marca</p>
        ) : (
          <div className="loja-variacoes-opcoes loja-variacoes-opcoes--modelos" role="list" aria-label={modelo.nome}>
            {modelosDisponiveis.map((valor) => {
              const selected = selecao[modelo.id] === valor.id
              return (
                <button
                  key={valor.id}
                  type="button"
                  role="listitem"
                  className={`loja-variacoes-opt${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => setModelo(valor.id)}
                >
                  <span>{valor.nome}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {extras.map((eixo) => {
        const valores = eixo.valores.filter((valor) => {
          if (eixo.dependeDeEixoId && selecao[eixo.dependeDeEixoId] !== valor.parentValorId) {
            if (valor.parentValorId) return false
          }
          return ativos.some((s) => {
            const vals = parseVariacaoValores(s.variacao_valores_json)
            if (vals[eixo.id] !== valor.id) return false
            return eixos.every((e) => {
              if (e.id === eixo.id) return true
              if (!selecao[e.id]) return true
              return vals[e.id] === selecao[e.id]
            })
          })
        })
        if (valores.length === 0) return null
        const atual = valorById(eixos, eixo.id, selecao[eixo.id])
        return (
          <div key={eixo.id} className={eixoClass(eixo.id)}>
            <p className="loja-variacoes-label">
              {eixo.nome}: <strong>{atual?.nome ?? 'Selecione'}</strong>
            </p>
            <div className={`loja-variacoes-opcoes${eixo.tipo === 'cor' ? ' is-cores' : ''}`}>
              {valores.map((valor) => {
                const selected = selecao[eixo.id] === valor.id
                return (
                  <button
                    key={valor.id}
                    type="button"
                    className={`loja-variacoes-opt${selected ? ' is-selected' : ''}${eixo.tipo === 'cor' ? ' is-cor' : ''}`}
                    aria-pressed={selected}
                    onClick={() => setExtra(eixo.id, valor.id)}
                  >
                    {eixo.tipo === 'cor' && (
                      <span className="loja-variacoes-swatch" style={{ background: valor.hex || '#ccc' }} />
                    )}
                    <span>{valor.nome}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
