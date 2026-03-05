import { createClient } from '@supabase/supabase-js'
import { copyFileSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getDbPath, closeDb, initDb } from '../backend/db'

const BACKUP_BUCKET = 'pdv-backups'
const BACKUP_FILE_NAME = 'backup.db'

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_ANON_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key)
}

export type BackupResult = { ok: boolean; path?: string; error?: string }

/**
 * Copia o banco atual para uma pasta com nome datado.
 * @param destDir - Pasta de destino (ex.: escolhida no dialog)
 */
export function exportToFolder(destDir: string): BackupResult {
  const dbPath = getDbPath()
  if (!dbPath || !existsSync(dbPath)) {
    return { ok: false, error: 'Banco de dados não encontrado.' }
  }
  const date = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '-').replace(' ', '_')
  const fileName = `AgilizaPDV-backup-${date}.db`
  const destPath = join(destDir, fileName)
  try {
    copyFileSync(dbPath, destPath)
    return { ok: true, path: destPath }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao copiar arquivo.' }
  }
}

/**
 * Envia cópia do banco para o Supabase Storage (bucket pdv-backups).
 */
export async function uploadToSupabase(): Promise<BackupResult> {
  const supabase = getSupabase()
  if (!supabase) {
    return { ok: false, error: 'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY.' }
  }
  const dbPath = getDbPath()
  if (!dbPath || !existsSync(dbPath)) {
    return { ok: false, error: 'Banco de dados não encontrado.' }
  }
  try {
    const buffer = readFileSync(dbPath)
    const { error } = await supabase.storage
      .from(BACKUP_BUCKET)
      .upload(BACKUP_FILE_NAME, buffer, { upsert: true, contentType: 'application/octet-stream' })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao enviar backup.' }
  }
}

/**
 * Baixa o backup do Supabase para um arquivo temporário.
 */
export async function downloadFromSupabase(tempDir: string): Promise<BackupResult> {
  const supabase = getSupabase()
  if (!supabase) {
    return { ok: false, error: 'Supabase não configurado.' }
  }
  try {
    const { data, error } = await supabase.storage.from(BACKUP_BUCKET).download(BACKUP_FILE_NAME)
    if (error || !data) return { ok: false, error: error?.message ?? 'Backup não encontrado na nuvem.' }
    const buf = Buffer.from(await data.arrayBuffer())
    const tempPath = join(tempDir, `restore-${Date.now()}.db`)
    writeFileSync(tempPath, buf)
    return { ok: true, path: tempPath }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao baixar backup.' }
  }
}

/**
 * Restaura o banco a partir de um arquivo de backup e reinicializa o banco.
 */
export function restoreFromFile(
  backupFilePath: string,
  userDataPath: string,
  migrationsDir: string
): BackupResult {
  if (!existsSync(backupFilePath)) {
    return { ok: false, error: 'Arquivo de backup não encontrado.' }
  }
  const dbPath = join(userDataPath, 'pdv.db')
  try {
    closeDb()
    copyFileSync(backupFilePath, dbPath)
    initDb(userDataPath, migrationsDir)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao restaurar.' }
  }
}

/**
 * Restaura o banco a partir do backup na nuvem (Supabase Storage).
 */
export async function restoreFromSupabase(
  userDataPath: string,
  migrationsDir: string,
  tempDir: string
): Promise<BackupResult> {
  const download = await downloadFromSupabase(tempDir)
  if (!download.ok || !download.path) return download
  return restoreFromFile(download.path, userDataPath, migrationsDir)
}
