import dotenv from 'dotenv'
import { app, BrowserWindow, ipcMain, net } from 'electron'
import { join, resolve } from 'path'

// Carrega .env: 1) diretório atual (npm run dev na raiz), 2) relativo ao main (out/main), 3) userData em whenReady()
dotenv.config({ path: resolve(process.cwd(), '.env') })
const getMainDir = (): string => {
  if (typeof __dirname !== 'undefined') return __dirname
  const { fileURLToPath } = require('url')
  return require('path').dirname(fileURLToPath(import.meta.url))
}
dotenv.config({ path: resolve(getMainDir(), '../../.env') })
import { mkdirSync } from 'fs'
import { initDb, closeDb } from '../backend/db'
import { registerIpcHandlers } from './ipc'
import { getDbFolderFromConfig } from './config'
import * as empresasService from '../backend/services/empresas.service'
import * as usuariosService from '../backend/services/usuarios.service'
import * as suporteService from '../backend/services/suporte.service'

let mainWindow: BrowserWindow | null = null
let onlineStatusInterval: ReturnType<typeof setInterval> | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    resizable: false,
    fullscreenable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => {
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
if (isSeedOnly) {
  app.whenReady().then(() => {
    const dbFolder = getDbFolderFromConfig()
    try {
      mkdirSync(dbFolder, { recursive: true })
    } catch {}
    initDb(dbFolder, getMigrationsDir())
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
    // Carrega .env em várias localizações (não sobrescreve se já definido)
    if (!app.isPackaged) {
      dotenv.config({ path: join(app.getAppPath(), '.env') })
      dotenv.config({ path: resolve(process.cwd(), '.env') })
    }
    dotenv.config({ path: join(app.getPath('userData'), '.env') })
    if (!app.isPackaged && !process.env.SUPABASE_URL) {
      console.warn('[Agiliza PDV] SUPABASE_URL não definida. Coloque o .env na raiz do projeto ou em:', app.getPath('userData'))
    }
    const dbFolder = getDbFolderFromConfig()
    try {
      mkdirSync(dbFolder, { recursive: true })
    } catch {
      // ignora se não for possível criar (ex.: permissão)
    }
    initDb(dbFolder, getMigrationsDir())
    seedTeste()
    seedSuporte()
    registerIpcHandlers()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('app:ping', () => Promise.resolve('pong'))
