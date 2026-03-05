import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const CONFIG_FILENAME = 'agiliza-pdv-config.json'

export type AppConfig = {
  dbPath?: string
  /** Sincronizar com Supabase a cada alteração. Se false, desativa; se undefined/true, sincroniza em tempo real. */
  syncOnChange?: boolean
}

function getConfigPath(): string {
  return join(app.getPath('userData'), CONFIG_FILENAME)
}

/**
 * Retorna a pasta onde o banco deve ficar.
 * Se houver dbPath no config, usa; senão usa userData.
 */
export function getDbFolderFromConfig(): string {
  const userData = app.getPath('userData')
  const config = getConfig()
  if (config?.dbPath?.trim()) return config.dbPath.trim()
  return userData
}

export function getConfig(): AppConfig | null {
  try {
    const path = getConfigPath()
    if (!existsSync(path)) return null
    const raw = readFileSync(path, 'utf-8')
    return JSON.parse(raw) as AppConfig
  } catch {
    return null
  }
}

export function setConfig(partial: Partial<AppConfig>): void {
  const path = getConfigPath()
  const current = getConfig() ?? {}
  const next: AppConfig = { ...current, ...partial }
  writeFileSync(path, JSON.stringify(next, null, 2), 'utf-8')
}

export function setDbPath(folderPath: string | null): void {
  if (folderPath === null || folderPath.trim() === '') {
    const current = getConfig()
    if (current?.dbPath !== undefined) {
      const { dbPath: _, ...rest } = current
      writeFileSync(getConfigPath(), Object.keys(rest).length ? JSON.stringify(rest, null, 2) : '{}', 'utf-8')
    }
    return
  }
  setConfig({ dbPath: folderPath.trim() })
}
