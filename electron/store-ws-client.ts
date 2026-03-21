import { app } from 'electron'
import os from 'os'
import WebSocket from 'ws'
import { getConfig } from './config'
import { getInstallMode } from './install-mode'

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let stopped = false

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

/**
 * Mantém um WebSocket com o store-server para receber eventos em tempo real e aparecer no painel Terminais.
 */
export function startStoreWebSocketClient(): void {
  stopped = false
  const scheduleReconnect = (): void => {
    if (stopped) return
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, 5000)
  }

  function connect(): void {
    if (stopped) return
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    const base = getStoreHttpBase()
    if (!base) return

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
        scheduleReconnect()
      })
      s.on('error', () => {
        // encerramento vem em 'close'
      })
    } catch {
      scheduleReconnect()
    }
  }

  connect()
}

export function stopStoreWebSocketClient(): void {
  stopped = true
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
