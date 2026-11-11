import type { UsuarioSession } from '../vite-env'

const SESSION_KEY = 'agiliza_etiqueta_session'

export function loadSession(): UsuarioSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as UsuarioSession
  } catch {
    return null
  }
}

export function saveSession(session: UsuarioSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
