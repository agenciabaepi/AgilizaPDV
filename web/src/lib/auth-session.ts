import type { AppSession } from '../vite-env'

export const WEB_SESSION_KEY = 'agiliza_web_session'

/** Lê sessão em cache (localStorage) de forma síncrona — evita flash de login no refresh. */
export function readWebStoredSession(): AppSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(WEB_SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AppSession
  } catch {
    return null
  }
}
