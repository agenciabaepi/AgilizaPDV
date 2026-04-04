import { Router } from 'express'
import { query } from '../db'
import { requireAuth } from '../auth'

const r = Router()

r.use((_req, _res, next) => {
  requireAuth(_req)
  next()
})

/** Lista NFC-e (Postgres) — espelha a lógica de `nfce.service.listNfce` para terminais remotos. */
r.get('/', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const limitRaw = req.query.limit != null ? Number(req.query.limit) : 1000
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 5000) : 1000
  const dataInicio = req.query.dataInicio as string | undefined
  const dataFim = req.query.dataFim as string | undefined
  const status = req.query.status as string | undefined
  const search = (req.query.search as string | undefined)?.trim()

  let sql = `
    SELECT n.venda_id, n.numero_nfce, n.status, n.chave, n.mensagem_sefaz,
           v.numero AS venda_numero, v.created_at AS venda_created_at, v.total AS venda_total,
           c.nome AS cliente_nome
    FROM venda_nfce n
    INNER JOIN vendas v ON v.id = n.venda_id
    LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE v.empresa_id = $1`
  const params: unknown[] = [empresaId]
  let i = 2

  if (dataInicio) {
    sql += ` AND v.created_at >= $${i++}`
    params.push(dataInicio)
  }
  if (dataFim) {
    sql += ` AND v.created_at <= $${i++}`
    params.push(dataFim)
  }
  if (status) {
    sql += ` AND n.status = $${i++}`
    params.push(status)
  }
  if (search) {
    const term = `%${search}%`
    sql += ` AND (n.numero_nfce::text ILIKE $${i} OR v.numero::text ILIKE $${i} OR COALESCE(c.nome, '') ILIKE $${i})`
    params.push(term)
    i++
  }
  sql += ` ORDER BY v.created_at DESC LIMIT $${i}`
  params.push(limit)

  try {
    const rows = await query<Record<string, unknown>>(sql, params)
    res.json(
      rows.map((row) => ({
        venda_id: row.venda_id as string,
        numero_nfce: Number(row.numero_nfce),
        status: row.status,
        chave: row.chave ?? null,
        mensagem_sefaz: row.mensagem_sefaz ?? null,
        venda_numero: Number(row.venda_numero),
        venda_created_at: row.venda_created_at as string,
        venda_total: Number(row.venda_total),
        cliente_nome: row.cliente_nome ?? null
      }))
    )
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao listar NFC-e.' })
  }
})

export default r
