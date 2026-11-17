import { useCallback, useEffect, useState } from 'react'
import { Alert } from './ui'
import { formatCurrency } from '../lib/dashboard-utils'
import {
  labelOrigemPreco,
  labelReferenciaMovimento,
  labelTipoMovimento,
  listProdutoEstoqueMovimentos,
  listProdutoPrecoHistorico,
  type ProdutoPrecoHistorico,
} from '../lib/produto-historico'
import type { EstoqueMovimento } from '../vite-env'

type Props = {
  empresaId: string
  produtoId: string
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDelta(anterior: number | null, novo: number | null): string {
  if (anterior == null || novo == null) return '—'
  const diff = novo - anterior
  if (Math.abs(diff) < 0.00005) return '—'
  const sign = diff > 0 ? '+' : ''
  return `${sign}${formatCurrency(diff)}`
}

function tipoMovimentoClass(tipo: string): string {
  if (tipo === 'ENTRADA' || tipo === 'DEVOLUCAO') return 'produto-hist-badge--entrada'
  if (tipo === 'SAIDA') return 'produto-hist-badge--saida'
  return 'produto-hist-badge--ajuste'
}

export function ProdutoHistoricoPanel({ empresaId, produtoId }: Props) {
  const [movimentos, setMovimentos] = useState<EstoqueMovimento[]>([])
  const [precos, setPrecos] = useState<ProdutoPrecoHistorico[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!empresaId || !produtoId) return
    setLoading(true)
    setErro(null)
    try {
      const [m, p] = await Promise.all([
        listProdutoEstoqueMovimentos(empresaId, produtoId, { limit: 150 }),
        listProdutoPrecoHistorico(produtoId, { limit: 150 }),
      ])
      setMovimentos(m)
      setPrecos(p)
    } catch (err) {
      setMovimentos([])
      setPrecos([])
      setErro(err instanceof Error ? err.message : 'Erro ao carregar histórico.')
    } finally {
      setLoading(false)
    }
  }, [empresaId, produtoId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return <p className="vendas-loading">Carregando histórico...</p>
  }

  if (erro) {
    return <Alert variant="error">{erro}</Alert>
  }

  return (
    <div className="produto-historico">
      <section className="form-section">
        <h3 className="form-section-title">Histórico de preço</h3>
        <p className="input-hint" style={{ marginBottom: 12 }}>
          Alterações de preço de venda, custo e markup registradas no cadastro.
        </p>
        {precos.length === 0 ? (
          <p className="comissoes-empty">Nenhuma alteração de preço registrada ainda.</p>
        ) : (
          <div className="fluxo-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th style={{ textAlign: 'right' }}>Preço anterior</th>
                  <th style={{ textAlign: 'right' }}>Preço novo</th>
                  <th style={{ textAlign: 'right' }}>Δ Preço</th>
                  <th style={{ textAlign: 'right' }}>Custo novo</th>
                  <th style={{ textAlign: 'right' }}>Markup novo</th>
                  <th>Origem</th>
                  <th>Usuário</th>
                </tr>
              </thead>
              <tbody>
                {precos.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.created_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {row.preco_anterior == null ? '—' : formatCurrency(row.preco_anterior)}
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(row.preco_novo)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {formatDelta(row.preco_anterior, row.preco_novo)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {row.custo_novo == null ? '—' : formatCurrency(row.custo_novo)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {row.markup_novo == null
                        ? '—'
                        : `${Number(row.markup_novo).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`}
                    </td>
                    <td>
                      <span className="produto-hist-badge">{labelOrigemPreco(row.origem)}</span>
                    </td>
                    <td>{row.usuario_nome || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="form-section" style={{ marginTop: 28 }}>
        <h3 className="form-section-title">Movimentação de estoque</h3>
        <p className="input-hint" style={{ marginBottom: 12 }}>
          Entradas, saídas, ajustes e devoluções deste produto.
        </p>
        {movimentos.length === 0 ? (
          <p className="comissoes-empty">Nenhuma movimentação de estoque para este produto.</p>
        ) : (
          <div className="fluxo-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: 'right' }}>Quantidade</th>
                  <th style={{ textAlign: 'right' }}>Custo unit.</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Referência</th>
                </tr>
              </thead>
              <tbody>
                {movimentos.map((m) => {
                  const custo = m.custo_unitario ?? 0
                  const total = Math.abs(m.quantidade) * custo
                  return (
                    <tr key={m.id}>
                      <td>{formatDateTime(m.created_at)}</td>
                      <td>
                        <span className={`produto-hist-badge ${tipoMovimentoClass(m.tipo)}`}>
                          {labelTipoMovimento(m.tipo)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {m.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {m.custo_unitario == null ? '—' : formatCurrency(m.custo_unitario)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {m.custo_unitario == null ? '—' : formatCurrency(total)}
                      </td>
                      <td>{labelReferenciaMovimento(m.referencia_tipo, m.referencia_id)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
