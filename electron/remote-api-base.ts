import { app } from 'electron'
import { getConfig } from './config'
import { getInstallMode } from './install-mode'

/**
 * URL base do store-server para chamadas HTTP (dados da loja em Postgres).
 * - Terminal: `serverUrl` em agiliza-pdv-config.json
 * - Servidor: sem URL salva → http://127.0.0.1:3000 (store-server no mesmo PC)
 * - Dev: AGILIZA_PDV_USE_LOCAL_DB=1 → null (força só SQLite local)
 */
export function getEffectiveRemoteBaseUrl(): string | null {
  if (!app.isPackaged) {
    const raw = process.env.AGILIZA_PDV_USE_LOCAL_DB
    const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
    if (v === '1' || v === 'true' || v === 'yes') return null
  }
  const url = getConfig()?.serverUrl?.trim()
  if (url) return url.replace(/\/+$/, '')
  if (getInstallMode() === 'server') return 'http://127.0.0.1:3000'
  return null
}
