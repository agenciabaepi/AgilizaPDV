import { query, run } from '../db'

type TipoMovimento = 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'DEVOLUCAO'

function contribuicaoSaldo(tipo: TipoMovimento, quantidade: number): number {
  switch (tipo) {
    case 'ENTRADA':
    case 'DEVOLUCAO':
      return quantidade
    case 'SAIDA':
      return -quantidade
    case 'AJUSTE':
      return quantidade
    default:
      return 0
  }
}

export async function getSaldo(empresaId: string, produtoId: string): Promise<number> {
  const rows = await query<{ tipo: string; quantidade: string }>(
    'SELECT tipo, quantidade FROM estoque_movimentos WHERE empresa_id = $1 AND produto_id = $2',
    [empresaId, produtoId]
  )
  return rows.reduce((acc, r) => acc + contribuicaoSaldo(r.tipo as TipoMovimento, Number(r.quantidade)), 0)
}

/** Atualiza produtos.estoque_atual conforme a soma dos movimentos (coluna pode não existir em DBs muito antigos). */
export async function syncProdutoEstoqueAtual(empresaId: string, produtoId: string): Promise<void> {
  const saldo = await getSaldo(empresaId, produtoId)
  await run(
    'UPDATE produtos SET estoque_atual = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND empresa_id = $3',
    [saldo, produtoId, empresaId]
  )
}
