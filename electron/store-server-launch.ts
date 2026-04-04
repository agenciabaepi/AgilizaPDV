import { spawn, type ChildProcess } from 'child_process'
import dotenv from 'dotenv'
import { app } from 'electron'
import { delimiter, join } from 'path'
import { existsSync } from 'fs'
import { getInstallMode } from './install-mode'
import { mergeBuildSupabaseIntoEnvIfMissing } from './merge-build-supabase-env'

let embeddedChild: ChildProcess | null = null

function programDataStoreServerEnv(): string {
  return join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'AgilizaPDV', 'store-server.env')
}

function userDataStoreServerEnv(): string {
  return join(app.getPath('userData'), 'store-server.env')
}

/** Mesma ordem de carga que `main.ts` no ramo `--store-server`. */
function buildStoreServerProcessEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  const pd = programDataStoreServerEnv()
  const ud = userDataStoreServerEnv()
  if (app.isPackaged && process.platform === 'win32') {
    if (existsSync(ud)) dotenv.config({ path: ud, processEnv: env })
    if (existsSync(pd)) dotenv.config({ path: pd, processEnv: env, override: true })
  } else {
    if (existsSync(pd)) dotenv.config({ path: pd, processEnv: env })
    if (existsSync(ud)) dotenv.config({ path: ud, processEnv: env, override: true })
  }
  const ssRoot = join(process.resourcesPath, 'store-server')
  const ssNodeModules = join(ssRoot, 'node_modules')
  if (existsSync(ssNodeModules)) {
    const prev = env.NODE_PATH || ''
    env.NODE_PATH = prev ? `${ssNodeModules}${delimiter}${prev}` : ssNodeModules
  }
  return env
}

function findStoreServerEntry(): string | null {
  const candidates = [
    join(process.resourcesPath, 'store-server', 'dist', 'index.js'),
    join(app.getAppPath(), 'store-server', 'dist', 'index.js')
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

function parsePort(env: NodeJS.ProcessEnv): number {
  const n = Number(env.PORT || 3000)
  return Number.isFinite(n) && n > 0 && n < 65536 ? n : 3000
}

async function storeServerHealthOk(port: number): Promise<boolean> {
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 1000)
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: ac.signal })
    clearTimeout(t)
    return res.ok
  } catch {
    return false
  }
}

/**
 * No PC em modo **servidor** (instalação empacotada), sobe o store-server em processo filho
 * (`ELECTRON_RUN_AS_NODE`) para não depender de atalho separado. Ignora se `/health` já responder.
 */
export async function startStoreServerChildIfNeeded(): Promise<void> {
  if (!app.isPackaged) return
  if (getInstallMode() !== 'server') return
  if (process.argv.includes('--no-embed-store-server')) return
  if (embeddedChild) return

  const entry = findStoreServerEntry()
  if (!entry) {
    console.warn('[Agiliza PDV] Store-server não encontrado no pacote; inicie com o atalho do servidor ou --store-server.')
    return
  }

  const childEnv = buildStoreServerProcessEnv()
  mergeBuildSupabaseIntoEnvIfMissing(childEnv)
  const port = parsePort(childEnv)
  if (await storeServerHealthOk(port)) {
    console.log(`[Agiliza PDV] Store-server já ativo em 127.0.0.1:${port}; não iniciando outro processo.`)
    return
  }

  try {
    embeddedChild = spawn(process.execPath, [entry], {
      env: { ...childEnv, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'ignore',
      windowsHide: true,
      detached: false
    })
  } catch (e) {
    console.error('[Agiliza PDV] Falha ao iniciar store-server embutido:', e)
    embeddedChild = null
    return
  }

  embeddedChild.on('error', (err) => {
    console.error('[Agiliza PDV] Erro no processo do store-server:', err)
    embeddedChild = null
  })
  embeddedChild.on('exit', (code, signal) => {
    embeddedChild = null
    if (code !== 0 && code !== null) {
      console.warn('[Agiliza PDV] Store-server embutido encerrou com código', code, signal ?? '')
    }
  })

  console.log(`[Agiliza PDV] Store-server embutido iniciado (porta ${port}).`)
}

export function stopStoreServerChild(): void {
  if (!embeddedChild) return
  try {
    embeddedChild.removeAllListeners()
    embeddedChild.kill()
  } catch {
    // ignore
  }
  embeddedChild = null
}
