import dotenv from 'dotenv'
import { app, BrowserWindow, dialog, ipcMain, net } from 'electron'
import { delimiter, join, resolve } from 'path'
import { pathToFileURL } from 'url'

// Carrega .env: 1) diretório atual (npm run dev na raiz), 2) relativo ao main (out/main), 3) userData em whenReady()
dotenv.config({ path: resolve(process.cwd(), '.env') })
const getMainDir = (): string => {
  if (typeof __dirname !== 'undefined') return __dirname
  const { fileURLToPath } = require('url')
  return require('path').dirname(fileURLToPath(import.meta.url))
}
dotenv.config({ path: resolve(getMainDir(), '../../.env') })
import { appendFileSync, copyFileSync, existsSync, mkdirSync } from 'fs'
import { initDb, closeDb } from '../backend/db'
import { registerIpcHandlers } from './ipc'
import { runSync, startRealtimeSync, stopRealtimeSync } from '../sync/sync-engine'
import { getDbFolderFromConfig, getConfig, setConfig } from './config'
import * as empresasService from '../backend/services/empresas.service'
import * as usuariosService from '../backend/services/usuarios.service'
import * as suporteService from '../backend/services/suporte.service'
import { discoverLocalServer } from './server-discovery'
import { startStoreWebSocketClient, stopStoreWebSocketClient } from './store-ws-client'
import { startAutoUpdater, stopAutoUpdater } from './updater'
import * as backup from './backup'
import { SUPABASE_URL as SUPABASE_URL_BUILD } from './supabase-config.generated'
import { mergeBuildSupabaseIntoEnvIfMissing } from './merge-build-supabase-env'
import { startStoreServerChildIfNeeded, stopStoreServerChild } from './store-server-launch'

let mainWindow: BrowserWindow | null = null
let onlineStatusInterval: ReturnType<typeof setInterval> | null = null
let dbInitialized = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    resizable: false,
    fullscreenable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.setMenuBarVisibility(false)
    mainWindow?.setFullScreen(true)
    mainWindow?.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../../out/renderer/index.html'))
  }

  // Detecção em tempo real: net.isOnline() a cada 1,5s; notifica o renderer quando muda
  let lastOnline: boolean | null = null
  onlineStatusInterval = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const isOnline = net.isOnline()
    if (lastOnline !== isOnline) {
      lastOnline = isOnline
      mainWindow.webContents.send('sync:onlineStatus', isOnline)
    }
  }, 1500)

  mainWindow.on('closed', () => {
    if (onlineStatusInterval) {
      clearInterval(onlineStatusInterval)
      onlineStatusInterval = null
    }
    mainWindow = null
  })
}

/** Cria empresa e usuário de teste apenas em desenvolvimento (app não empacotado). Nunca roda em produção. */
function seedTeste(): boolean {
  if (app.isPackaged) return false
  if (empresasService.listEmpresas().length > 0) return false
  const empresa = empresasService.createEmpresa({ nome: 'Empresa Teste' })
  usuariosService.createUsuario({
    empresa_id: empresa.id,
    nome: 'Admin',
    login: 'admin',
    senha: 'admin',
    role: 'admin'
  })
  return true
}

function getMigrationsDir(): string {
  return join(app.getAppPath(), 'backend', 'db', 'migrations')
}

function seedSuporte(): void {
  if (suporteService.countSuporteUsuarios() > 0) return
  suporteService.createSuporteUsuario({ nome: 'Suporte', login: 'suporte', senha: 'suporte' })
}

const isSeedOnly = process.argv.includes('--seed')
const isStoreServerMode = process.argv.includes('--store-server')
if (isStoreServerMode) {
  app.whenReady().then(async () => {
    // ProgramData = instalador (servidor). AppData pode ter cópia antiga; se carregar por último com
    // override, sobrescreve a senha correta e o store-server falha no Postgres.
    const programDataEnv = join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'AgilizaPDV', 'store-server.env')
    const userDataEnv = join(app.getPath('userData'), 'store-server.env')
    if (app.isPackaged && process.platform === 'win32') {
      if (existsSync(userDataEnv)) dotenv.config({ path: userDataEnv })
      if (existsSync(programDataEnv)) dotenv.config({ path: programDataEnv, override: true })
    } else {
      if (existsSync(programDataEnv)) dotenv.config({ path: programDataEnv })
      if (existsSync(userDataEnv)) dotenv.config({ path: userDataEnv, override: true })
    }
    mergeBuildSupabaseIntoEnvIfMissing(process.env)
    const ssRoot = join(process.resourcesPath, 'store-server')
    const ssNodeModules = join(ssRoot, 'node_modules')
    if (existsSync(ssNodeModules)) {
      const prev = process.env.NODE_PATH || ''
      process.env.NODE_PATH = prev ? `${ssNodeModules}${delimiter}${prev}` : ssNodeModules
    }
    const entryCandidates = [
      join(process.resourcesPath, 'store-server', 'dist', 'index.js'),
      join(app.getAppPath(), 'store-server', 'dist', 'index.js')
    ]
    const entry = entryCandidates.find((p) => existsSync(p))
    if (!entry) throw new Error('Store-server não encontrado no pacote.')
    await import(pathToFileURL(entry).toString())
  }).catch((err) => {
    console.error('Erro ao iniciar modo store-server', err)
    const detail = err instanceof Error ? `${err.stack || err.message}` : String(err)
    const pd = join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'AgilizaPDV')
    const logFile = join(pd, 'store-server-startup-error.log')
    try {
      mkdirSync(pd, { recursive: true })
      appendFileSync(logFile, `\n--- ${new Date().toISOString()} ---\n${detail}\n`, 'utf-8')
    } catch {
      // ignore
    }
    try {
      dialog.showErrorBox(
        'Agiliza PDV — Servidor da loja',
        `Não foi possível iniciar o store-server (API na porta 3000).\n\n` +
          `Um log foi salvo em:\n${logFile}\n\n` +
          `Resumo: ${err instanceof Error ? err.message : String(err)}`
      )
    } catch {
      // ignore
    }
    app.quit()
  })
} else if (isSeedOnly) {
  app.whenReady().then(() => {
    const dbFolder = getDbFolderFromConfig()
    try {
      mkdirSync(dbFolder, { recursive: true })
    } catch {}
    initDb(dbFolder, getMigrationsDir())
    dbInitialized = true
    const created = seedTeste()
    seedSuporte()
    if (created) {
      console.log('Empresa e usuário de teste criados.')
      console.log('Login: admin | Senha: admin')
    } else {
      console.log('Já existem empresas no banco. Nada foi criado.')
    }
    console.log('Suporte: login suporte | senha suporte (se criado)')
    closeDb()
    app.quit()
  })
} else {
  app.whenReady().then(async () => {
    const userDataPath = app.getPath('userData')
    const userDataEnv = join(userDataPath, '.env')
    // Na instalação: se não existir .env na pasta do app, copia o env.install que veio no pacote
    if (app.isPackaged && !existsSync(userDataEnv)) {
      try {
        mkdirSync(userDataPath, { recursive: true })
        const bundledEnv = join(process.resourcesPath, 'env.install')
        if (existsSync(bundledEnv)) {
          copyFileSync(bundledEnv, userDataEnv)
        }
      } catch {
        // ignora falha ao criar/copiar .env
      }
    }
    const dbFolder = getDbFolderFromConfig()
    // Carrega .env em várias localizações (não sobrescreve se já definido)
    if (!app.isPackaged) {
      // Dev: raiz do projeto e appPath (útil para npm run dev)
      dotenv.config({ path: join(app.getAppPath(), '.env') })
      dotenv.config({ path: resolve(process.cwd(), '.env') })
    }
    // Produção: pasta de dados do app e a pasta do banco (que pode ter sido personalizada)
    dotenv.config({ path: userDataEnv })
    dotenv.config({ path: join(dbFolder, '.env') })
    if (!SUPABASE_URL_BUILD) {
      console.warn(
        '[Agiliza PDV] Supabase não embutido neste instalador: espelho na nuvem, “puxar do Supabase” e backup na nuvem ficam desativados. ' +
          'O PDV local e o modo loja em rede (store-server) funcionam normalmente; configure SUPABASE_* no CI se quiser a nuvem.'
      )
    }
    try {
      mkdirSync(dbFolder, { recursive: true })
    } catch {
      // ignora se não for possível criar (ex.: permissão)
    }
    try {
      initDb(dbFolder, getMigrationsDir())
      dbInitialized = true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[Agiliza PDV] Falha ao iniciar banco local:', err)
      dialog.showErrorBox(
        'Agiliza PDV — erro ao iniciar',
        `Não foi possível abrir o banco de dados neste computador.\n\n${msg}\n\nSe acabou de atualizar o app, anote a mensagem e contate o suporte.`
      )
      app.quit()
      return
    }
    seedTeste()
    seedSuporte()
    await startStoreServerChildIfNeeded()
    registerIpcHandlers()
    startStoreWebSocketClient()
    if (!app.isPackaged && getConfig()?.serverUrl?.trim()) {
      const v = process.env.AGILIZA_PDV_USE_LOCAL_DB?.trim().toLowerCase()
      const forceLocal = v === '1' || v === 'true' || v === 'yes'
      if (!forceLocal) {
        console.info(
          '[Agiliza PDV][dev] serverUrl definida — o app usa o store-server para dados. Sem servidor no Mac, use AGILIZA_PDV_USE_LOCAL_DB=1 no .env ou apague a URL em Configurações do sistema (suporte).'
        )
      }
    }
    // Dispara sync inicial em background para espelhar registros antigos
    // (incluindo usuários que existiam antes do outbox).
    setTimeout(() => {
      runSync().catch(() => {})
    }, 1500)
    // Se não houver servidor configurado, tenta descoberta automática na rede local.
    if (!getConfig()?.serverUrl) {
      discoverLocalServer(15000)
        .then((found) => {
          if (!found?.url) {
            console.warn(
              '[Agiliza PDV] Descoberta automática: nenhum servidor (UDP 41234, mDNS ou /health). Terminal pode usar IP manual em Configurações.'
            )
            return
          }
          console.log('[Agiliza PDV] Servidor da loja encontrado:', found.url)
          setConfig({ serverUrl: found.url })
        })
        .catch(() => {
          // ignore
        })
    }
    createWindow()
    startAutoUpdater(() => mainWindow)
    startRealtimeSync(() => {
      const w = mainWindow ?? BrowserWindow.getAllWindows()[0]
      if (w && !w.isDestroyed()) w.webContents.send('sync:dataUpdated')
    })

    // Backup automático: primeira execução após 1 min, depois a cada 24h (em segundo plano)
    const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000
    setTimeout(() => {
      backup.runAutoBackup().catch(() => {})
    }, 60 * 1000)
    setInterval(() => {
      backup.runAutoBackup().catch(() => {})
    }, BACKUP_INTERVAL_MS)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  stopStoreWebSocketClient()
  stopAutoUpdater()
  stopRealtimeSync()
  if (dbInitialized) closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopStoreWebSocketClient()
  stopStoreServerChild()
})

ipcMain.handle('app:ping', () => Promise.resolve('pong'))
