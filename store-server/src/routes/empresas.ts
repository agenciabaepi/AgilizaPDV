import { Router } from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, run } from '../db'
import { addToOutbox } from '../outbox'

const r = Router()

r.get('/count', async (_req, res) => {
  const row = await queryOne<{ c: string }>('SELECT COUNT(*)::text AS c FROM empresas')
  const n = row ? parseInt(row.c, 10) : 0
  res.json(Number.isFinite(n) ? n : 0)
})

r.get('/', async (_req, res) => {
  const rows = await query<{ id: string; nome: string; cnpj: string | null; codigo_acesso: number | null; created_at: string }>(
    'SELECT id, nome, cnpj, codigo_acesso, created_at FROM empresas ORDER BY nome'
  )
  res.json(rows)
})

async function nextCodigoAcessoDisponivel(): Promise<number> {
  const row = await queryOne<{ m: number | null }>('SELECT MAX(codigo_acesso) AS m FROM empresas')
  let candidate = Math.max(1000, (row?.m ?? 999) + 1)
  while (await queryOne<{ one: number }>('SELECT 1 AS one FROM empresas WHERE codigo_acesso = $1', [candidate])) {
    candidate += 1
  }
  return candidate
}

r.post('/', async (req, res) => {
  const { nome, cnpj, codigo_acesso } = req.body as { nome: string; cnpj?: string; codigo_acesso?: number | null }
  if (!nome?.trim()) {
    res.status(400).json({ error: 'Nome é obrigatório' })
    return
  }
  let codigo: number
  if (codigo_acesso != null && Number.isInteger(codigo_acesso) && codigo_acesso >= 1) {
    const clash = await queryOne<{ id: string }>('SELECT id FROM empresas WHERE codigo_acesso = $1', [codigo_acesso])
    if (clash) {
      res.status(400).json({ error: `Código ${codigo_acesso} já está em uso` })
      return
    }
    codigo = codigo_acesso
  } else {
    codigo = await nextCodigoAcessoDisponivel()
  }
  const id = randomUUID()
  await run(
    'INSERT INTO empresas (id, nome, cnpj, codigo_acesso) VALUES ($1, $2, $3, $4)',
    [id, nome.trim(), cnpj?.trim() || null, codigo]
  )
  const row = await queryOne<{ id: string; nome: string; cnpj: string | null; codigo_acesso: number | null; created_at: string }>(
    'SELECT id, nome, cnpj, codigo_acesso, created_at FROM empresas WHERE id = $1',
    [id]
  )
  if (row) await addToOutbox('empresas', id, 'CREATE', row)
  res.status(201).json(row)
})

export default r
