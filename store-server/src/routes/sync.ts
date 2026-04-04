import { Router } from 'express'
import { runSync } from '../sync-supabase'
import { pullFromSupabaseIntoPostgres } from '../pull-from-supabase'
import { reconcileMirrorDigestFull } from '../mirror-digest-reconcile'
import { getPendingCount, getErrorCount, resetErrorsToPending } from '../outbox'

const r = Router()

r.get('/pending-count', async (_req, res) => {
  const count = await getPendingCount()
  res.json(count)
})

r.get('/error-count', async (_req, res) => {
  const count = await getErrorCount()
  res.json(count)
})

r.post('/run', async (_req, res) => {
  const result = await runSync()
  res.json(result)
})

r.post('/reset-errors', async (_req, res) => {
  await resetErrorsToPending()
  const result = await runSync()
  res.json(result)
})

r.post('/pull-from-supabase', async (_req, res) => {
  const result = await pullFromSupabaseIntoPostgres()
  res.json(result)
})

r.post('/mirror-reconcile', async (_req, res) => {
  const result = await reconcileMirrorDigestFull()
  res.json(result)
})

export default r
