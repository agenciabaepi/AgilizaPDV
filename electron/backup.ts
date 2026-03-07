import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { copyFileSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getDbPath, closeDb, initDb } from '../backend/db'
import * as empresasService from '../backend/services/empresas.service'

const BACKUP_BUCKET = 'pdv-backups'
const BACKUP_FILE_NAME = 'backup.db'
const BACKUP_PREFIX = 'backups'
const BACKUP_REGISTRY_TABLE = 'pdv_backup_registry'

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_ANON_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key)
}

function backupTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '-').replace(' ', '_')
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

// ---------------------------------------------------------------------------
// Backup automático por empresa (estrutura backups/empresa_id/data_hora.db)
// ---------------------------------------------------------------------------

export type AutoBackupResult = { ok: boolean; count?: number; error?: string }

/**
 * Gera backup completo do banco e envia para o Storage em pasta por empresa.
 * Registra cada envio em pdv_backup_registry. Executar em segundo plano.
 */
export async function runAutoBackup(): Promise<AutoBackupResult> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' }
  const dbPath = getDbPath()
  if (!dbPath || !existsSync(dbPath)) return { ok: false, error: 'Banco não encontrado.' }

  const empresas = empresasService.listEmpresas()
  if (empresas.length === 0) return { ok: true, count: 0 }

  const buffer = readFileSync(dbPath)
  const fileSize = buffer.length
  const ts = backupTimestamp()
  const fileName = `${ts}.db`
  let count = 0

  for (const emp of empresas) {
    const filePath = `${BACKUP_PREFIX}/${emp.id}/${fileName}`
    try {
      const { error: upErr } = await supabase.storage
        .from(BACKUP_BUCKET)
        .upload(filePath, buffer, { upsert: true, contentType: 'application/octet-stream' })
      if (upErr) continue
      await supabase.from(BACKUP_REGISTRY_TABLE).insert({
        empresa_id: emp.id,
        file_path: filePath,
        backup_date: new Date().toISOString(),
        file_size_bytes: fileSize,
        status: 'ok'
      })
      count++
    } catch {
      // ignora falha por empresa e segue
    }
  }
  return { ok: true, count }
}

/**
 * Gera backup manual do banco e envia para o Storage apenas da empresa informada.
 * Útil para suporte fazer backup de uma empresa específica.
 */
export async function runManualBackupForEmpresa(empresaId: string): Promise<AutoBackupResult> {
  if (!empresaId.trim()) return { ok: false, error: 'Empresa não informada.' }
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' }
  const dbPath = getDbPath()
  if (!dbPath || !existsSync(dbPath)) return { ok: false, error: 'Banco não encontrado.' }

  const buffer = readFileSync(dbPath)
  const fileSize = buffer.length
  const ts = backupTimestamp()
  const fileName = `${ts}.db`
  const filePath = `${BACKUP_PREFIX}/${empresaId}/${fileName}`

  try {
    const { error: upErr } = await supabase.storage
      .from(BACKUP_BUCKET)
      .upload(filePath, buffer, { upsert: true, contentType: 'application/octet-stream' })
    if (upErr) return { ok: false, error: upErr.message }
    await supabase.from(BACKUP_REGISTRY_TABLE).insert({
      empresa_id: empresaId,
      file_path: filePath,
      backup_date: new Date().toISOString(),
      file_size_bytes: fileSize,
      status: 'ok'
    })
    return { ok: true, count: 1 }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao enviar backup.' }
  }
}

export type BackupRegistryEntry = {
  id: string
  empresa_id: string
  file_path: string
  backup_date: string
  file_size_bytes: number | null
  status: string
}

/**
 * Lista empresas do espelho no Supabase (para suporte escolher e listar backups).
 */
export async function listEmpresasFromSupabase(): Promise<{ id: string; nome: string }[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase.from('empresas').select('id, nome').order('nome')
  if (error || !data) return []
  return (data as { id: string; nome: string }[]) ?? []
}

/**
 * Lista backups registrados para uma empresa (para suporte).
 */
export async function listBackupsByEmpresa(empresaId: string): Promise<BackupRegistryEntry[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from(BACKUP_REGISTRY_TABLE)
    .select('id, empresa_id, file_path, backup_date, file_size_bytes, status')
    .eq('empresa_id', empresaId)
    .order('backup_date', { ascending: false })
  if (error || !data) return []
  return (data as BackupRegistryEntry[]) ?? []
}

/**
 * Baixa um arquivo de backup do Storage para a pasta escolhida (suporte).
 */
export async function downloadBackupToPath(filePath: string, destPath: string): Promise<BackupResult> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' }
  try {
    const { data, error } = await supabase.storage.from(BACKUP_BUCKET).download(filePath)
    if (error || !data) return { ok: false, error: error?.message ?? 'Arquivo não encontrado.' }
    const buf = Buffer.from(await data.arrayBuffer())
    writeFileSync(destPath, buf)
    return { ok: true, path: destPath }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao baixar.' }
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
