import { app, BrowserWindow, Notification } from 'electron'
import { autoUpdater } from 'electron-updater'

/** Canal próprio para não conflitar com o `latest.yml` do Agiliza PDV no mesmo repositório. */
const GITHUB_FEED = {
  provider: 'github' as const,
  owner: 'agenciabaepi',
  repo: 'AgilizaPDV',
  channel: 'etiquetas'
}

export type UpdateState = {
  phase: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
  message?: string
  version?: string
  percent?: number
}

let started = false
let checkTimer: NodeJS.Timeout | null = null
let state: UpdateState = { phase: 'idle', message: 'Atualização automática aguardando.' }

function setState(next: UpdateState, getWindow: () => BrowserWindow | null): void {
  state = next
  const win = getWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send('app:updateStatus', state)
}

export function getUpdateState(): UpdateState {
  return state
}

export async function checkForAppUpdates(getWindow: () => BrowserWindow | null): Promise<UpdateState> {
  if (!app.isPackaged || process.platform !== 'win32') {
    const localState: UpdateState = {
      phase: 'not-available',
      message: 'Atualização automática disponível apenas no app instalado no Windows.'
    }
    setState(localState, getWindow)
    return localState
  }
  setState({ phase: 'checking', message: 'Verificando atualizações...' }, getWindow)
  try {
    await autoUpdater.checkForUpdates()
    return state
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const next: UpdateState = { phase: 'error', message: `Falha ao verificar atualização: ${message}` }
    setState(next, getWindow)
    return next
  }
}

export function installDownloadedUpdate(): { ok: boolean; message: string } {
  if (state.phase !== 'downloaded') {
    return { ok: false, message: 'Nenhuma atualização pronta para instalar.' }
  }
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true)
  })
  return { ok: true, message: 'Instalando atualização. O aplicativo será reiniciado.' }
}

export function startAutoUpdater(getWindow: () => BrowserWindow | null): void {
  if (started) return
  started = true

  if (!app.isPackaged || process.platform !== 'win32') {
    setState(
      {
        phase: 'not-available',
        message: 'Atualização automática ativa somente no app instalado no Windows.'
      },
      getWindow
    )
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.channel = 'etiquetas'
  try {
    autoUpdater.setFeedURL(GITHUB_FEED)
  } catch {
    // mantém app-update.yml embutido pelo electron-builder
  }

  autoUpdater.logger = {
    info: (m: unknown) => console.info('[autoUpdater]', m),
    warn: (m: unknown) => console.warn('[autoUpdater]', m),
    error: (m: unknown) => console.error('[autoUpdater]', m),
    debug: (m: unknown) => console.debug('[autoUpdater]', m)
  }

  autoUpdater.on('checking-for-update', () => {
    setState({ phase: 'checking', message: 'Verificando atualizações...' }, getWindow)
  })

  autoUpdater.on('update-available', (info) => {
    setState(
      {
        phase: 'available',
        message: `Atualização encontrada (${info.version}). Baixando...`,
        version: info.version
      },
      getWindow
    )
  })

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.max(0, Math.min(100, Number(progress.percent.toFixed(1))))
    setState(
      {
        phase: 'downloading',
        message: `Baixando atualização: ${percent}%`,
        percent,
        version: state.version
      },
      getWindow
    )
  })

  autoUpdater.on('update-not-available', (info) => {
    setState(
      {
        phase: 'not-available',
        message: `Aplicativo já está atualizado (v${info.version}).`,
        version: info.version
      },
      getWindow
    )
  })

  autoUpdater.on('update-downloaded', (info) => {
    setState(
      {
        phase: 'downloaded',
        message: `Atualização v${info.version} pronta para instalar.`,
        version: info.version
      },
      getWindow
    )
    try {
      if (Notification.isSupported()) {
        new Notification({
          title: 'Agiliza Etiquetas — atualização pronta',
          body: `Versão ${info.version} baixada. Reinicie o app para instalar.`
        }).show()
      }
    } catch {
      // ignore
    }
  })

  autoUpdater.on('error', (error) => {
    const message = error instanceof Error ? error.message : String(error)
    setState({ phase: 'error', message: `Erro no auto-update: ${message}` }, getWindow)
  })

  setTimeout(() => {
    void checkForAppUpdates(getWindow)
  }, 4000)

  checkTimer = setInterval(() => {
    void checkForAppUpdates(getWindow)
  }, 30 * 60 * 1000)
}

export function stopAutoUpdater(): void {
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
  }
}
