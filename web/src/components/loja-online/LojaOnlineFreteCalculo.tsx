import { useState } from 'react'
import { Loader2, Truck } from 'lucide-react'
import { buscarCep } from '../../lib/cep'
import { calcularFreteLojaOnline } from '../../lib/loja-online-checkout-api'
import { lojaOnlineFreteContexto } from '../../lib/loja-online-behavior'
import { formatCurrency, LOJA_ONLINE_OPCAO_FRETE_GRATIS } from '../../lib/loja-online'
import { maskCep } from '../../lib/loja-online-endereco'
import type { LojaOnlineOpcaoFrete, LojaOnlineStoreConfig } from '../../lib/loja-online-types'

type Props = {
  store: LojaOnlineStoreConfig
  slug: string
  produtoId: string
  preco: number
  quantidade?: number
}

function mensagemErroFrete(raw: string): string {
  const msg = (raw || '').toLowerCase()
  if (
    msg.includes('postal_code') ||
    msg.includes('cep_destino') ||
    msg.includes('cep inválido') ||
    msg.includes('cep invalido') ||
    msg.includes('422')
  ) {
    return 'CEP inválido ou sem cobertura de frete. Confira o número e tente de novo.'
  }
  if (msg.includes('melhor envio') || msg.includes('{') || msg.includes('errors')) {
    return 'Não foi possível calcular o frete para este CEP. Tente outro CEP.'
  }
  return raw || 'Erro ao calcular frete.'
}

export function LojaOnlineFreteCalculo({ store, slug, produtoId, preco, quantidade = 1 }: Props) {
  const permitirEntrega = store.loja_online_permitir_entrega !== 0
  const [cep, setCep] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cidade, setCidade] = useState<string | null>(null)
  const [opcoes, setOpcoes] = useState<LojaOnlineOpcaoFrete[]>([])

  if (!permitirEntrega) return null

  const calcular = async () => {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) {
      setError('Informe um CEP válido com 8 dígitos.')
      return
    }
    setLoading(true)
    setError(null)
    setOpcoes([])
    setCidade(null)
    try {
      const endereco = await buscarCep(digits)
      if (!endereco) {
        setError('CEP não encontrado. Confira o número e tente de novo.')
        return
      }
      setCidade([endereco.localidade, endereco.uf].filter(Boolean).join(' - '))

      const subtotal = preco * Math.max(1, quantidade)
      const res = await calcularFreteLojaOnline(
        slug,
        digits,
        undefined,
        subtotal,
        [{ id: produtoId, quantidade: Math.max(1, quantidade), preco }],
        lojaOnlineFreteContexto('produto')
      )
      if (!res.opcoes.length) {
        setError('Não encontramos opções de frete para este CEP.')
        return
      }
      setOpcoes(
        res.opcoes.map((o) =>
          o.valor <= 0 && (o.codigo === 'FIXO' || o.codigo === 'GRATIS') ? { ...LOJA_ONLINE_OPCAO_FRETE_GRATIS } : o
        )
      )
    } catch (err) {
      setError(mensagemErroFrete(err instanceof Error ? err.message : 'Erro ao calcular frete.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="loja-galaxy-pdp-frete">
      <div className="loja-galaxy-pdp-frete-head">
        <Truck size={16} strokeWidth={2.2} aria-hidden />
        <span>Calcular frete</span>
      </div>
      <div className="loja-galaxy-pdp-frete-row">
        <input
          className="input-el"
          value={maskCep(cep)}
          onChange={(e) => {
            setCep(e.target.value)
            setError(null)
            setCidade(null)
            setOpcoes([])
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void calcular()
            }
          }}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          aria-label="CEP para calcular frete"
        />
        <button
          type="button"
          className="loja-store-btn-outline loja-store-btn-sm"
          disabled={loading || cep.replace(/\D/g, '').length !== 8}
          onClick={() => void calcular()}
        >
          {loading ? <Loader2 size={14} className="loja-store-success-icon--spin" /> : 'Calcular'}
        </button>
      </div>
      {cidade && <p className="loja-galaxy-pdp-frete-cidade">{cidade}</p>}
      {error && <p className="loja-online-field-error">{error}</p>}
      {opcoes.length > 0 && (
        <ul className="loja-galaxy-pdp-frete-opcoes">
          {opcoes.map((op) => (
            <li key={op.codigo}>
              <span>
                <strong>{op.nome}</strong>
                {op.prazo > 0 ? <small> até {op.prazo} dia(s) úteis</small> : null}
              </span>
              <strong>{op.valor <= 0 ? 'Grátis' : formatCurrency(op.valor)}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
