import { useState, useEffect } from 'react'
import { Dialog } from './ui'
import type { VendaDetalhes } from '../vite-env'
import { PEDIDO_STATUS_LABEL } from '../lib/loja-online-pedidos-utils'
import type { LojaOnlinePedido } from '../lib/loja-online-types'

const PAGAMENTO_STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  cancelado: 'Cancelado',
  na_entrega: 'Na entrega',
}

const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  manual: 'Manual',
  asaas_pix: 'PIX (Asaas)',
  mercadopago: 'Mercado Pago',
}

function labelPedidoStatus(status: string): string {
  return PEDIDO_STATUS_LABEL[status as LojaOnlinePedido['status']] ?? status
}

export type VendaDetalhesComissaoInfo = {
  percentual: number
  valor: number
}

export function VendaDetalhesDialog({
  vendaId,
  onClose,
  comissao,
}: {
  vendaId: string | null
  onClose: () => void
  comissao?: VendaDetalhesComissaoInfo | null
}) {
  const [detalhes, setDetalhes] = useState<VendaDetalhes | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!vendaId) {
      setDetalhes(null)
      setLoading(false)
      return
    }
    setDetalhes(null)
    setLoading(true)
    window.electronAPI.cupom
      .getDetalhes(vendaId)
      .then((det) => setDetalhes(det ? (det as VendaDetalhes) : null))
      .catch(() => setDetalhes(null))
      .finally(() => setLoading(false))
  }, [vendaId])

  return (
    <Dialog open={vendaId !== null} onClose={onClose} title="Detalhes da venda" size="large">
      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Carregando...</p>
      ) : !detalhes ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Não foi possível carregar os detalhes da venda.</p>
      ) : (
        <div className="vendas-detalhes">
          <div className="vendas-detalhes-header">
            <div>
              <div className="vendas-detalhes-empresa">{detalhes.empresa_nome}</div>
              <div className="vendas-detalhes-info">
                <span>Venda #{detalhes.venda.numero}</span>
                <span>
                  {new Date(detalhes.venda.created_at).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {detalhes.cupom_empresa?.vendedor_nome && (
                  <span>Vendedor: {detalhes.cupom_empresa.vendedor_nome}</span>
                )}
              </div>
            </div>
            <div className="vendas-detalhes-totais">
              <div>
                <span className="label">Subtotal</span>
                <span className="value">R$ {detalhes.venda.subtotal.toFixed(2)}</span>
              </div>
              <div>
                <span className="label">Desconto</span>
                <span className="value">R$ {detalhes.venda.desconto_total.toFixed(2)}</span>
              </div>
              <div>
                <span className="label">Total</span>
                <span className="value destaque">R$ {detalhes.venda.total.toFixed(2)}</span>
              </div>
              {comissao != null && (
                <div>
                  <span className="label">Comissão ({comissao.percentual.toFixed(1).replace('.', ',')}%)</span>
                  <span className="value destaque" style={{ color: 'var(--color-success)' }}>
                    R$ {comissao.valor.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {detalhes.pedido_online && (
            <div className="vendas-detalhes-pedido-grid">
              <div className="vendas-detalhes-card">
                <h4>Pedido online</h4>
                <dl className="vendas-detalhes-dl">
                  <div>
                    <dt>Código</dt>
                    <dd>#{detalhes.pedido_online.id.slice(0, 8).toUpperCase()}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{labelPedidoStatus(detalhes.pedido_online.status)}</dd>
                  </div>
                  <div>
                    <dt>Data do pedido</dt>
                    <dd>
                      {new Date(detalhes.pedido_online.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt>Entrega</dt>
                    <dd>
                      {detalhes.pedido_online.forma_entrega === 'entrega'
                        ? 'Delivery'
                        : detalhes.pedido_online.forma_entrega === 'retirada'
                          ? 'Retirada na loja'
                          : '—'}
                    </dd>
                  </div>
                  {detalhes.pedido_online.forma_pagamento && (
                    <div>
                      <dt>Pagamento</dt>
                      <dd>
                        {FORMA_PAGAMENTO_LABEL[detalhes.pedido_online.forma_pagamento] ??
                          detalhes.pedido_online.forma_pagamento}
                        {detalhes.pedido_online.pagamento_status
                          ? ` · ${PAGAMENTO_STATUS_LABEL[detalhes.pedido_online.pagamento_status] ?? detalhes.pedido_online.pagamento_status}`
                          : ''}
                      </dd>
                    </div>
                  )}
                  {detalhes.pedido_online.cupom_codigo && (
                    <div>
                      <dt>Cupom</dt>
                      <dd>{detalhes.pedido_online.cupom_codigo}</dd>
                    </div>
                  )}
                  {detalhes.pedido_online.observacoes && (
                    <div>
                      <dt>Observações</dt>
                      <dd>{detalhes.pedido_online.observacoes}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="vendas-detalhes-card">
                <h4>Cliente</h4>
                <dl className="vendas-detalhes-dl">
                  <div>
                    <dt>Nome</dt>
                    <dd>{detalhes.pedido_online.cliente_nome ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>E-mail</dt>
                    <dd>{detalhes.pedido_online.cliente_email ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Telefone</dt>
                    <dd>{detalhes.pedido_online.cliente_telefone ?? '—'}</dd>
                  </div>
                </dl>
              </div>

              <div className="vendas-detalhes-card vendas-detalhes-card--endereco">
                <h4>Endereço</h4>
                {detalhes.pedido_online.endereco_entrega ? (
                  <dl className="vendas-detalhes-dl">
                    {detalhes.pedido_online.cep_destino && (
                      <div>
                        <dt>CEP</dt>
                        <dd>{detalhes.pedido_online.cep_destino}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Endereço completo</dt>
                      <dd>{detalhes.pedido_online.endereco_entrega}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="vendas-detalhes-empty">
                    {detalhes.pedido_online.forma_entrega === 'retirada'
                      ? 'Retirada na loja — sem endereço de entrega.'
                      : 'Endereço não informado.'}
                  </p>
                )}
                {(detalhes.pedido_online.valor_frete != null && detalhes.pedido_online.valor_frete > 0) ||
                (detalhes.pedido_online.valor_desconto != null && detalhes.pedido_online.valor_desconto > 0) ||
                (detalhes.pedido_online.cashback_usado != null && detalhes.pedido_online.cashback_usado > 0) ? (
                  <dl className="vendas-detalhes-dl vendas-detalhes-dl--resumo">
                    {detalhes.pedido_online.valor_frete != null && detalhes.pedido_online.valor_frete > 0 && (
                      <div>
                        <dt>Frete</dt>
                        <dd>R$ {detalhes.pedido_online.valor_frete.toFixed(2)}</dd>
                      </div>
                    )}
                    {detalhes.pedido_online.valor_desconto != null && detalhes.pedido_online.valor_desconto > 0 && (
                      <div>
                        <dt>Desconto</dt>
                        <dd>R$ {detalhes.pedido_online.valor_desconto.toFixed(2)}</dd>
                      </div>
                    )}
                    {detalhes.pedido_online.cashback_usado != null && detalhes.pedido_online.cashback_usado > 0 && (
                      <div>
                        <dt>Cashback usado</dt>
                        <dd>R$ {detalhes.pedido_online.cashback_usado.toFixed(2)}</dd>
                      </div>
                    )}
                  </dl>
                ) : null}
              </div>
            </div>
          )}

          <div className="vendas-detalhes-grid">
            <div className="vendas-detalhes-card">
              <h4>Itens</h4>
              {detalhes.itens.length === 0 ? (
                <p className="vendas-detalhes-empty">Nenhum item.</p>
              ) : (
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Qtd</th>
                      <th>V. unit.</th>
                      <th>Desc.</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalhes.itens.map((i, idx) => (
                      <tr key={`${i.descricao}-${idx}`}>
                        <td>{i.descricao}</td>
                        <td>{i.quantidade}</td>
                        <td>R$ {i.preco_unitario.toFixed(2)}</td>
                        <td>{i.desconto ? `R$ ${i.desconto.toFixed(2)}` : '-'}</td>
                        <td>R$ {i.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="vendas-detalhes-card">
              <h4>Pagamentos</h4>
              {detalhes.pagamentos.length === 0 ? (
                <p className="vendas-detalhes-empty">Nenhum pagamento registrado.</p>
              ) : (
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Forma</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalhes.pagamentos.map((p, idx) => (
                      <tr key={`${p.forma}-${idx}`}>
                        <td>{p.forma}</td>
                        <td>R$ {p.valor.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="vendas-detalhes-resumo-pag">
                <span>Total pago</span>
                <span>R$ {detalhes.pagamentos.reduce((acc, p) => acc + p.valor, 0).toFixed(2)}</span>
              </div>
              {detalhes.venda.troco > 0 && (
                <div className="vendas-detalhes-resumo-pag troco">
                  <span>Troco</span>
                  <span>R$ {detalhes.venda.troco.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}
