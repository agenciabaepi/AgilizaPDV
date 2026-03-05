import { Router } from 'express'
import { query } from '../db'
import { requireAuth } from '../auth'

const r = Router()
const COLS = 'id, empresa_id, nome, cpf_cnpj, telefone, email, endereco, observacoes, created_at'

r.use((_req, _res, next) => {
  requireAuth(_req)
  next()
})

r.get('/', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const rows = await query<Record<string, unknown>>(
    `SELECT ${COLS} FROM clientes WHERE empresa_id = $1 ORDER BY nome`,
    [empresaId]
  )
  res.json(rows)
})

export default r
