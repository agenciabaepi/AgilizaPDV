import { randomUUID } from 'crypto'
import { query, queryOne, run, withTransaction } from '../db'
import type { PoolClient } from 'pg'

export type VendaPrazoConfig = {
  usar_limite_credito: boolean
  bloquear_inadimplente: boolean
}

export async function getVendaPrazoConfig(empresaId: string): Promise<VendaPrazoConfig> {
  const row = await queryOne<{
    venda_prazo_usar_limite_credito: number | null
    venda_prazo_bloquear_inadimplente: number | null
  }>(
    `SELECT venda_prazo_usar_limite_credito, venda_prazo_bloquear_inadimplente FROM empresas WHERE id = $1`,
    [empresaId]
  )
  return {
    usar_limite_credito: Number(row?.venda_prazo_usar_limite_credito) === 1,
    bloquear_inadimplente: Number(row?.venda_prazo_bloquear_inadimplente) === 1
  }
}

export async function updateVendaPrazoConfig(empresaId: string, data: Partial<VendaPrazoConfig>): Promise<VendaPrazoConfig> {
  const cur = await getVendaPrazoConfig(empresaId)
  const usar = data.usar_limite_credito !== undefined ? data.usar_limite_credito : cur.usar_limite_credito
  const bloq = data.bloquear_inadimplente !== undefined ? data.bloquear_inadimplente : cur.bloquear_inadimplente
  await run(
    `UPDATE empresas SET venda_prazo_usar_limite_credito = $1, venda_prazo_bloquear_inadimplente = $2 WHERE id = $3`,
    [usar ? 1 : 0, bloq ? 1 : 0, empresaId]
  )
  return getVendaPrazoConfig(empresaId)
}

export async function getTotalAbertoCliente(empresaId: string, clienteId: string): Promise<number> {
  const row = await queryOne<{ s: string }>(
    `SELECT COALESCE(SUM(valor), 0)::text AS s FROM contas_receber WHERE empresa_id = $1 AND cliente_id = $2 AND status = 'PENDENTE'`,
    [empresaId, clienteId]
  )
  return Number(row?.s) || 0
}

export async function clienteTemInadimplencia(empresaId: string, clienteId: string): Promise<boolean> {
  const row = await queryOne(
    `SELECT 1 FROM contas_receber WHERE empresa_id = $1 AND cliente_id = $2 AND status = 'PENDENTE' AND vencimento < CURRENT_DATE LIMIT 1`,
    [empresaId, clienteId]
  )
  return Boolean(row)
}

export async function assertPodeVenderAPrazo(empresaId: string, clienteId: string, valorNovaVenda: number): Promise<void> {
  const cfg = await getVendaPrazoConfig(empresaId)
  const cli = await queryOne<{ limite_credito: string | null }>(
    `SELECT limite_credito::text FROM clientes WHERE id = $1 AND empresa_id = $2`,
    [clienteId, empresaId]
  )
  if (!cli) throw new Error('Cliente inválido.')

  if (cfg.bloquear_inadimplente && (await clienteTemInadimplencia(empresaId, clienteId))) {
    throw new Error('Cliente com parcelas vencidas em aberto. Quite ou receba os títulos antes de nova venda a prazo.')
  }

  if (cfg.usar_limite_credito && cli.limite_credito != null && cli.limite_credito !== '') {
    const limite = Number(cli.limite_credito)
    if (Number.isFinite(limite)) {
      const aberto = await getTotalAbertoCliente(empresaId, clienteId)
      if (aberto + valorNovaVenda > limite + 0.01) {
        throw new Error(
          `Limite de crédito excedido. Em aberto: R$ ${aberto.toFixed(2)}; limite: R$ ${limite.toFixed(2)}; esta venda: R$ ${valorNovaVenda.toFixed(2)}.`
        )
      }
    }
  }
}

export async function createContaReceberVenda(
  client: PoolClient,
  input: { empresa_id: string; venda_id: string; cliente_id: string; valor: number; vencimento: string }
): Promise<void> {
  const id = randomUUID()
  await client.query(
    `INSERT INTO contas_receber (id, empresa_id, venda_id, cliente_id, valor, vencimento, status)
     VALUES ($1, $2, $3, $4, $5, $6::date, 'PENDENTE')`,
    [id, input.empresa_id, input.venda_id, input.cliente_id, input.valor, input.vencimento]
  )
}

export async function cancelarContaReceberVenda(client: PoolClient, vendaId: string): Promise<void> {
  const res = await client.query(`SELECT id, status FROM contas_receber WHERE venda_id = $1`, [vendaId])
  const row = res.rows[0] as { id: string; status: string } | undefined
  if (!row) return
  if (row.status === 'RECEBIDA') throw new Error('Não é possível cancelar: conta a receber já foi recebida.')
  await client.query(`UPDATE contas_receber SET status = 'CANCELADA' WHERE venda_id = $1`, [vendaId])
}

export async function receberContaReceberPg(input: {
  conta_id: string
  empresa_id: string
  caixa_id: string
  usuario_id: string
  forma: string
}): Promise<Record<string, unknown>> {
  const caixa = await queryOne<{ id: string; status: string; empresa_id: string }>(
    `SELECT id, status, empresa_id FROM caixas WHERE id = $1`,
    [input.caixa_id]
  )
  if (!caixa || caixa.status !== 'ABERTO' || caixa.empresa_id !== input.empresa_id) {
    throw new Error('Recebimento deve ser feito no caixa aberto atual.')
  }
  const row = await queryOne<Record<string, unknown>>(`SELECT * FROM contas_receber WHERE id = $1`, [input.conta_id])
  if (!row) throw new Error('Conta a receber não encontrada.')
  if ((row.empresa_id as string) !== input.empresa_id) throw new Error('Conta não pertence à empresa.')
  if ((row.status as string) !== 'PENDENTE') throw new Error('Esta conta já foi recebida ou cancelada.')

  const now = new Date().toISOString()
  await run(
    `UPDATE contas_receber SET status = 'RECEBIDA', recebido_em = $1, recebimento_caixa_id = $2, forma_recebimento = $3, usuario_recebimento_id = $4
     WHERE id = $5`,
    [now, input.caixa_id, input.forma, input.usuario_id, input.conta_id]
  )
  const updated = await queryOne<Record<string, unknown>>(`SELECT * FROM contas_receber WHERE id = $1`, [input.conta_id])
  const raw = updated ?? row
  return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>
}

export type ReciboRecebimentoCupomData = {
  empresa_id: string
  empresa_nome: string
  cliente_nome: string
  cliente_doc: string | null
  venda_numero: number
  valor: number
  forma_recebimento: string
  recebido_em: string
  conta_id: string
}

export async function getReciboRecebimentoCupomDataPg(contaId: string): Promise<ReciboRecebimentoCupomData | null> {
  const row = await queryOne<Record<string, unknown>>(
    `
    SELECT c.id AS conta_id, c.empresa_id, c.valor, c.forma_recebimento, c.recebido_em,
      cl.nome AS cliente_nome, cl.cpf_cnpj AS cliente_doc,
      v.numero AS venda_numero,
      e.nome AS empresa_nome
    FROM contas_receber c
    JOIN clientes cl ON cl.id = c.cliente_id
    JOIN vendas v ON v.id = c.venda_id
    JOIN empresas e ON e.id = c.empresa_id
    WHERE c.id = $1 AND c.status = 'RECEBIDA'
  `,
    [contaId]
  )
  if (!row) return null
  const recebido =
    row.recebido_em instanceof Date
      ? row.recebido_em.toISOString()
      : String(row.recebido_em ?? '')
  return {
    empresa_id: String(row.empresa_id ?? ''),
    empresa_nome: String(row.empresa_nome ?? 'Empresa'),
    cliente_nome: String(row.cliente_nome ?? ''),
    cliente_doc: row.cliente_doc ? String(row.cliente_doc).trim() || null : null,
    venda_numero: Number(row.venda_numero) || 0,
    valor: Number(row.valor) || 0,
    forma_recebimento: String(row.forma_recebimento ?? ''),
    recebido_em: recebido,
    conta_id: String(row.conta_id),
  }
}
