import dotenv from 'dotenv'
import { app, BrowserWindow, ipcMain, net } from 'electron'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'

// Carrega .env: 1) diretório atual (npm run dev na raiz), 2) relativo ao main (out/main), 3) userData em whenReady()
dotenv.config({ path: resolve(process.cwd(), '.env') })
const getMainDir = (): string => {
  if (typeof __dirname !== 'undefined') return __dirname
  const { fileURLToPath } = require('url')
  return require('path').dirname(fileURLToPath(import.meta.url))
}
dotenv.config({ path: resolve(getMainDir(), '../../.env') })
import { existsSync, mkdirSync, copyFileSync } from 'fs'
import { initDb, closeDb } from '../backend/db'
import { registerIpcHandlers } from './ipc'
import { runSync, startRealtimeSync, stopRealtimeSync } from '../sync/sync-engine'
import { getDbFolderFromConfig, getConfig, setConfig } from './config'
import * as empresasService from '../backend/services/empresas.service'
import * as usuariosService from '../backend/services/usuarios.service'
import * as suporteService from '../backend/services/suporte.service'
import { discoverLocalServer } from './server-discovery'
import { startAutoUpdater, stopAutoUpdater } from './updater'
import * as backup from './backup'
import { SUPABASE_URL as SUPABASE_URL_BUILD } from './supabase-config.generated'

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
    const envCandidates = [
      join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'AgilizaPDV', 'store-server.env'),
      join(app.getPath('userData'), 'store-server.env')
    ]
    for (const envPath of envCandidates) {
      dotenv.config({ path: envPath, override: true })
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
  app.whenReady().then(() => {
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
        '[Agiliza PDV] Supabase não configurado no build. Gere o instalador com .env ou variáveis SUPABASE_URL e SUPABASE_ANON_KEY no CI.'
      )
    }
    try {
      mkdirSync(dbFolder, { recursive: true })
    } catch {
      // ignora se não for possível criar (ex.: permissão)
    }
    initDb(dbFolder, getMigrationsDir())
    dbInitialized = true
    seedTeste()
    seedSuporte()
    registerIpcHandlers()
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
  stopAutoUpdater()
  stopRealtimeSync()
  if (dbInitialized) closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('app:ping', () => Promise.resolve('pong'))
