import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { getConfig } from './config'
import { getInstallMode } from './install-mode'

/**
 * `localhost` / `::1` podem falhar no fetch do Electron no Windows (IPv6 vs servidor só em 0.0.0.0).
 */
function normalizeRemoteBase(url: string): string {
  const trimmed = url.replace(/\/+$/, '')
  try {
    const parsed = new URL(trimmed)
    if (parsed.hostname === 'localhost' || parsed.hostname === '::1') {
      parsed.hostname = '127.0.0.1'
    }
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return trimmed
  }
}

function parsePortFromStoreServerEnvFile(filePath: string): number | null {
  try {
    if (!existsSync(filePath)) return null
    const text = readFileSync(filePath, 'utf-8')
    const m = text.match(/^\s*PORT\s*=\s*(\d+)/im)
    if (!m) return null
    const n = Number(m[1])
    return Number.isFinite(n) && n > 0 && n < 65536 ? n : null
  } catch {
    return null
  }
}

function programDataStoreServerEnvPath(): string | null {
  if (process.platform !== 'win32') return null
  return join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'AgilizaPDV', 'store-server.env')
}

function userDataStoreServerEnvPath(): string {
  return join(app.getPath('userData'), 'store-server.env')
}

function storeServerEnvCandidates(): string[] {
  const paths: string[] = []
  const pd = programDataStoreServerEnvPath()
  if (pd) paths.push(pd)
  paths.push(userDataStoreServerEnvPath())
  return paths
}

/** Porta HTTP do store-server: lê PORT dos .env conhecidos ou 3000. */
function portForLocalStoreServer(): number {
  for (const p of storeServerEnvCandidates()) {
    const port = parsePortFromStoreServerEnvFile(p)
    if (port != null) return port
  }
  return 3000
}

function hasAnyStoreServerEnvFile(): boolean {
  return storeServerEnvCandidates().some((p) => existsSync(p))
}

/**
 * URL base do store-server para chamadas HTTP (dados da loja em Postgres).
 * - Terminal: `serverUrl` em agiliza-pdv-config.json (ou descoberta → salva aí)
 * - Servidor: sem URL salva → http://127.0.0.1:PORT (store-server no mesmo PC)
 * - Modo `unknown` + app empacotado + `store-server.env` em ProgramData/userData: trata como
 *   máquina que hospeda a API (ex.: install-runtime não gravou install-mode.txt, mas o .env existe).
 * - Dev: AGILIZA_PDV_USE_LOCAL_DB=1 → null (força só SQLite local)
 */
export function getEffectiveRemoteBaseUrl(): string | null {
  if (!app.isPackaged) {
    const raw = process.env.AGILIZA_PDV_USE_LOCAL_DB
    const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
    if (v === '1' || v === 'true' || v === 'yes') return null
  }
  const cfgUrl = getConfig()?.serverUrl?.trim()
  if (cfgUrl) return normalizeRemoteBase(cfgUrl)

  const mode = getInstallMode()
  const localBase = (): string => normalizeRemoteBase(`http://127.0.0.1:${portForLocalStoreServer()}`)

  if (mode === 'server') return localBase()

  if (mode === 'terminal') return null

  if (app.isPackaged && hasAnyStoreServerEnvFile()) return localBase()

  return null
}
