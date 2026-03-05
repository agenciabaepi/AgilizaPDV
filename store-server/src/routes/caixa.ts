import { Router } from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, run } from '../db'
import { emitCaixa } from '../ws'
import { requireAuth } from '../auth'

const r = Router()

r.use((_req, _res, next) => {
  requireAuth(_req)
  next()
})

function rowToCaixa(r: Record<string, unknown>) {
  return {
    id: r.id,
    empresa_id: r.empresa_id,
    usuario_id: r.usuario_id,
    status: r.status,
    valor_inicial: Number(r.valor_inicial ?? 0),
    aberto_em: r.aberto_em,
    fechado_em: r.fechado_em ?? null
  }
}

function rowToMovimento(r: Record<string, unknown>) {
  return {
    id: r.id,
    empresa_id: r.empresa_id,
    caixa_id: r.caixa_id,
    tipo: r.tipo,
    valor: Number(r.valor),
    motivo: r.motivo ?? null,
    usuario_id: r.usuario_id,
    created_at: r.created_at
  }
}

r.get('/aberto', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const row = await queryOne<Record<string, unknown>>(
    `SELECT id, empresa_id, usuario_id, status, valor_inicial, aberto_em, fechado_em
     FROM caixas WHERE empresa_id = $1 AND status = 'ABERTO' ORDER BY aberto_em DESC LIMIT 1`,
    [empresaId]
  )
  res.json(row ? rowToCaixa(row) : null)
})

r.post('/abrir', async (req, res) => {
  const user = requireAuth(req)
  const { empresaId, usuarioId, valorInicial } = req.body as { empresaId: string; usuarioId: string; valorInicial: number }
  const empresa_id = empresaId || user.empresa_id
  const usuario_id = usuarioId || user.id
  const aberto = await queryOne(
    `SELECT 1 FROM caixas WHERE empresa_id = $1 AND status = 'ABERTO' LIMIT 1`,
    [empresa_id]
  )
  if (aberto) {
    res.status(400).json({ error: 'Já existe um caixa aberto. Feche-o antes de abrir outro.' })
    return
  }
  const id = randomUUID()
  await run(
    `INSERT INTO caixas (id, empresa_id, usuario_id, status, valor_inicial) VALUES ($1, $2, $3, 'ABERTO', $4)`,
    [id, empresa_id, usuario_id, valorInicial >= 0 ? valorInicial : 0]
  )
  const row = await queryOne<Record<string, unknown>>(
    'SELECT id, empresa_id, usuario_id, status, valor_inicial, aberto_em, fechado_em FROM caixas WHERE id = $1',
    [id]
  )
  emitCaixa(empresa_id, 'abrir')
  res.status(201).json(rowToCaixa(row!))
})

r.post('/fechar', async (req, res) => {
  const { caixaId } = req.body as { caixaId: string }
  if (!caixaId) {
    res.status(400).json({ error: 'caixaId é obrigatório' })
    return
  }
  const current = await queryOne<Record<string, unknown>>('SELECT id, status, empresa_id FROM caixas WHERE id = $1', [caixaId])
  if (!current || current.status !== 'ABERTO') {
    res.status(400).json({ error: 'Caixa não encontrado ou já fechado' })
    return
  }
  const now = new Date().toISOString()
  await run('UPDATE caixas SET status = $1, fechado_em = $2 WHERE id = $3', ['FECHADO', now, caixaId])
  const row = await queryOne<Record<string, unknown>>(
    'SELECT id, empresa_id, usuario_id, status, valor_inicial, aberto_em, fechado_em FROM caixas WHERE id = $1',
    [caixaId]
  )
  emitCaixa(current.empresa_id as string, 'fechar')
  res.json(rowToCaixa(row!))
})

r.get('/list', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const limit = Number(req.query.limit) || 50
  const rows = await query<Record<string, unknown>>(
    `SELECT id, empresa_id, usuario_id, status, valor_inicial, aberto_em, fechado_em
     FROM caixas WHERE empresa_id = $1 ORDER BY aberto_em DESC LIMIT $2`,
    [empresaId, limit]
  )
  res.json(rows.map(rowToCaixa))
})

r.get('/:caixaId/saldo', async (req, res) => {
  const caixa = await queryOne<{ valor_inicial: string }>('SELECT valor_inicial FROM caixas WHERE id = $1', [req.params.caixaId])
  if (!caixa) {
    res.status(404).json({ error: 'Caixa não encontrado' })
    return
  }
  const movimentos = await query<{ tipo: string; valor: string }>(
    'SELECT tipo, valor FROM caixa_movimentos WHERE caixa_id = $1',
    [req.params.caixaId]
  )
  const soma = movimentos.reduce((acc, m) => acc + (m.tipo === 'SUPRIMENTO' ? Number(m.valor) : -Number(m.valor)), 0)
  const saldo = Number(caixa.valor_inicial) + soma
  res.json(saldo)
})

r.get('/:caixaId/movimentos', async (req, res) => {
  const rows = await query<Record<string, unknown>>(
    `SELECT id, empresa_id, caixa_id, tipo, valor, motivo, usuario_id, created_at
     FROM caixa_movimentos WHERE caixa_id = $1 ORDER BY created_at DESC`,
    [req.params.caixaId]
  )
  res.json(rows.map(rowToMovimento))
})

r.post('/movimento', async (req, res) => {
  const user = requireAuth(req)
  const body = req.body as { caixa_id: string; empresa_id: string; tipo: 'SANGRIA' | 'SUPRIMENTO'; valor: number; motivo?: string; usuario_id: string }
  const caixa = await queryOne<Record<string, unknown>>('SELECT id, status, empresa_id FROM caixas WHERE id = $1', [body.caixa_id])
  if (!caixa || caixa.status !== 'ABERTO') {
    res.status(400).json({ error: 'Caixa não está aberto.' })
    return
  }
  if (body.valor <= 0) {
    res.status(400).json({ error: 'Valor deve ser positivo.' })
    return
  }
  if (body.tipo === 'SANGRIA') {
    const movimentos = await query<{ tipo: string; valor: string }>('SELECT tipo, valor FROM caixa_movimentos WHERE caixa_id = $1', [body.caixa_id])
    const soma = movimentos.reduce((acc, m) => acc + (m.tipo === 'SUPRIMENTO' ? Number(m.valor) : -Number(m.valor)), 0)
    const saldo = Number(caixa.valor_inicial) + soma
    if (saldo < body.valor) {
      res.status(400).json({ error: `Saldo insuficiente no caixa (R$ ${saldo.toFixed(2)}).` })
      return
    }
  }
  const id = randomUUID()
  await run(
    `INSERT INTO caixa_movimentos (id, empresa_id, caixa_id, tipo, valor, motivo, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, body.empresa_id, body.caixa_id, body.tipo, body.valor, body.motivo ?? null, body.usuario_id || user.id]
  )
  const row = await queryOne<Record<string, unknown>>(
    'SELECT id, empresa_id, caixa_id, tipo, valor, motivo, usuario_id, created_at FROM caixa_movimentos WHERE id = $1',
    [id]
  )
  emitCaixa(body.empresa_id, 'movimento')
  res.status(201).json(rowToMovimento(row!))
})

export default r
