import { Router } from 'express'
import { query } from '../db'
import { requireAuth } from '../auth'
import {
  getVendaPrazoConfig,
  updateVendaPrazoConfig,
  getTotalAbertoCliente,
  receberContaReceberPg,
  getReciboRecebimentoCupomDataPg
} from '../services/contas-receber'

const r = Router()

r.use((_req, _res, next) => {
  requireAuth(_req)
  next()
})

r.get('/venda-prazo-config', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const cfg = await getVendaPrazoConfig(empresaId)
  res.json(cfg)
})

r.put('/venda-prazo-config', async (req, res) => {
  const user = requireAuth(req)
  const body = req.body as { empresaId?: string; usar_limite_credito?: boolean; bloquear_inadimplente?: boolean }
  const empresaId = body.empresaId || user.empresa_id
  const cfg = await updateVendaPrazoConfig(empresaId, {
    usar_limite_credito: body.usar_limite_credito,
    bloquear_inadimplente: body.bloquear_inadimplente
  })
  res.json(cfg)
})

r.get('/', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const clienteId = req.query.clienteId as string | undefined
  const status = req.query.status as string | undefined
  const limit = req.query.limit != null ? Number(req.query.limit) : 500

  let sql = `
    SELECT c.*, cl.nome AS cliente_nome, v.numero AS venda_numero
    FROM contas_receber c
    JOIN clientes cl ON cl.id = c.cliente_id
    JOIN vendas v ON v.id = c.venda_id
    WHERE c.empresa_id = $1
  `
  const params: unknown[] = [empresaId]
  let i = 2
  if (clienteId) {
    sql += ` AND c.cliente_id = $${i}`
    params.push(clienteId)
    i++
  }
  if (status === 'aberto') {
    sql += ` AND c.status = 'PENDENTE'`
  } else if (status && status !== 'aberto') {
    sql += ` AND c.status = $${i}`
    params.push(status)
    i++
  }
  sql += ` ORDER BY c.vencimento ASC, c.created_at DESC LIMIT $${i}`
  params.push(limit)

  const rows = await query<Record<string, unknown>>(sql, params)
  res.json(
    rows.map((r) => ({
      ...r,
      valor: Number(r.valor),
      venda_numero: Number(r.venda_numero)
    }))
  )
})

r.post('/receber', async (req, res) => {
  const body = req.body as {
    conta_id: string
    empresa_id: string
    caixa_id: string
    usuario_id: string
    forma: string
  }
  try {
    const row = await receberContaReceberPg(body)
    res.json(row)
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) })
  }
})

r.get('/recibo-data/:contaId', async (req, res) => {
  try {
    const data = await getReciboRecebimentoCupomDataPg(req.params.contaId)
    if (!data) {
      res.status(404).json({ error: 'Conta não encontrada ou ainda não recebida.' })
      return
    }
    res.json(data)
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) })
  }
})

r.get('/total-aberto', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const clienteId = req.query.clienteId as string
  if (!clienteId) {
    res.status(400).json({ error: 'clienteId é obrigatório' })
    return
  }
  const total = await getTotalAbertoCliente(empresaId, clienteId)
  res.json({ total })
})

r.get('/historico-prazo', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const clienteId = req.query.clienteId as string
  if (!clienteId) {
    res.status(400).json({ error: 'clienteId é obrigatório' })
    return
  }
  const rows = await query<Record<string, unknown>>(
    `
    SELECT v.id AS venda_id, v.numero, v.total, v.data_vencimento, v.created_at,
           cr.status AS conta_status, cr.valor AS valor_conta
    FROM vendas v
    JOIN contas_receber cr ON cr.venda_id = v.id
    WHERE v.empresa_id = $1 AND v.cliente_id = $2 AND COALESCE(v.venda_a_prazo, 0) = 1
    ORDER BY v.created_at DESC
    LIMIT 200
  `,
    [empresaId, clienteId]
  )
  res.json(
    rows.map((r) => ({
      venda_id: r.venda_id,
      numero: Number(r.numero),
      total: Number(r.total),
      data_vencimento: r.data_vencimento ?? null,
      created_at: r.created_at,
      conta_status: r.conta_status,
      valor_conta: Number(r.valor_conta)
    }))
  )
})

export default r
