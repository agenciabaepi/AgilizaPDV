import { app, BrowserWindow, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

export type UpdateState = {
  phase: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
  message?: string
  version?: string
  percent?: number
}

let started = false
let checkTimer: NodeJS.Timeout | null = null
let state: UpdateState = { phase: 'idle', message: 'Atualizacao automatica aguardando.' }

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
      message: 'Atualizacao automatica disponivel apenas no app instalado no Windows.'
    }
    setState(localState, getWindow)
    return localState
  }
  setState({ phase: 'checking', message: 'Verificando atualizacoes...' }, getWindow)
  try {
    await autoUpdater.checkForUpdates()
    return state
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const next: UpdateState = { phase: 'error', message: `Falha ao verificar atualizacao: ${message}` }
    setState(next, getWindow)
    return next
  }
}

export function installDownloadedUpdate(): { ok: boolean; message: string } {
  if (state.phase !== 'downloaded') {
    return { ok: false, message: 'Nenhuma atualizacao pronta para instalar.' }
  }
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true)
  })
  return { ok: true, message: 'Instalando atualizacao. O aplicativo sera reiniciado.' }
}

export function startAutoUpdater(getWindow: () => BrowserWindow | null): void {
  if (started) return
  started = true

  if (!app.isPackaged || process.platform !== 'win32') {
    setState(
      { phase: 'not-available', message: 'Atualizacao automatica ativa somente no app instalado no Windows.' },
      getWindow
    )
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    setState({ phase: 'checking', message: 'Verificando atualizacoes...' }, getWindow)
  })

  autoUpdater.on('update-available', (info) => {
    setState(
      {
        phase: 'available',
        message: `Atualizacao encontrada (${info.version}). Baixando...`,
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
        message: `Baixando atualizacao: ${percent}%`,
        percent
      },
      getWindow
    )
  })

  autoUpdater.on('update-not-available', (info) => {
    setState(
      {
        phase: 'not-available',
        message: `Aplicativo ja esta atualizado (v${info.version}).`,
        version: info.version
      },
      getWindow
    )
  })

  autoUpdater.on('update-downloaded', (info) => {
    setState(
      {
        phase: 'downloaded',
        message: `Atualizacao v${info.version} pronta para instalar. Reinicie o app para aplicar.`,
        version: info.version
      },
      getWindow
    )

    const win = getWindow()
    if (!win || win.isDestroyed()) return
    dialog
      .showMessageBox(win, {
        type: 'info',
        buttons: ['Reiniciar agora', 'Depois'],
        defaultId: 0,
        cancelId: 1,
        title: 'Atualizacao pronta',
        message: `A versao ${info.version} foi baixada.`,
        detail: 'Deseja reiniciar agora para aplicar a atualizacao?'
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall(false, true)
        }
      })
      .catch(() => {
        // ignore prompt failures
      })
  })

  autoUpdater.on('error', (error) => {
    const message = error instanceof Error ? error.message : String(error)
    setState({ phase: 'error', message: `Erro no auto-update: ${message}` }, getWindow)
  })

  // Primeira checagem após a UI subir e checagens periódicas.
  setTimeout(() => {
    void checkForAppUpdates(getWindow)
  }, 15000)

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

