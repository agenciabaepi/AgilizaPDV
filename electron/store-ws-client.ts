import { app } from 'electron'
import os from 'os'
import WebSocket from 'ws'
import { getConfig } from './config'
import { getInstallMode } from './install-mode'

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let stopped = false
/** Referência ao `connect` atual para `kickStoreWebSocketReconnect`. */
let activeConnect: (() => void) | null = null

const RECONNECT_AFTER_CLOSE_MS = 5000
const RETRY_WHEN_NO_URL_MS = 8000

function getStoreHttpBase(): string | null {
  const url = getConfig()?.serverUrl?.trim()
  if (url) return url.replace(/\/+$/, '')
  if (getInstallMode() === 'server') return 'http://127.0.0.1:3000'
  return null
}

function httpBaseToWsUrl(httpBase: string): string {
  if (httpBase.startsWith('https://')) return `wss://${httpBase.slice(8)}/ws`
  if (httpBase.startsWith('http://')) return `ws://${httpBase.slice(7)}/ws`
  return `${httpBase}/ws`
}

function sendHello(s: WebSocket): void {
  if (s.readyState !== WebSocket.OPEN) return
  try {
    s.send(
      JSON.stringify({
        type: 'hello',
        appVersion: app.getVersion(),
        installMode: getInstallMode(),
        hostname: os.hostname(),
        platform: process.platform
      })
    )
  } catch {
    // ignore
  }
}

function scheduleConnect(delayMs: number): void {
  if (stopped) return
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(() => activeConnect?.(), delayMs)
}

/**
 * Mantém um WebSocket com o store-server para receber eventos em tempo real e aparecer no painel Terminais.
 */
export function startStoreWebSocketClient(): void {
  stopped = false

  function connect(): void {
    if (stopped) return
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    const base = getStoreHttpBase()
    if (!base) {
      scheduleConnect(RETRY_WHEN_NO_URL_MS)
      return
    }

    const url = httpBaseToWsUrl(base)
    try {
      const s = new WebSocket(url)
      socket = s
      s.on('open', () => sendHello(s))
      s.on('message', () => {
        // eventos de domínio (produto, venda, …) — reservado para uso futuro no renderer
      })
      s.on('close', () => {
        socket = null
        scheduleConnect(RECONNECT_AFTER_CLOSE_MS)
      })
      s.on('error', () => {
        // encerramento vem em 'close'
      })
    } catch {
      scheduleConnect(RECONNECT_AFTER_CLOSE_MS)
    }
  }

  activeConnect = connect
  connect()
}

/** Fecha o socket atual e reconecta já (útil após alterar `serverUrl` em disco). */
export function kickStoreWebSocketReconnect(): void {
  if (stopped || !activeConnect) return
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  try {
    socket?.removeAllListeners()
  } catch {
    // ignore
  }
  try {
    socket?.close()
  } catch {
    // ignore
  }
  socket = null
  activeConnect()
}

export function stopStoreWebSocketClient(): void {
  stopped = true
  activeConnect = null
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  try {
    socket?.close()
  } catch {
    // ignore
  }
  socket = null
}
