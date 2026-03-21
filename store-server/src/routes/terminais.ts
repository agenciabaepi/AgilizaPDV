import { Router } from 'express'
import { listTerminaisConectados } from '../ws'

const r = Router()

/** Lista PDVs conectados via WebSocket ao servidor da loja (rede local). Sem auth: use apenas em LAN. */
r.get('/conectados', (_req, res) => {
  const terminais = listTerminaisConectados()
  res.json({ ok: true, total: terminais.length, terminais })
})

export default r
