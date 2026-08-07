const SAAS_SESSION_KEY = 'agiliza_saas_admin'

export type SaasSession = {
  token: string
  email: string
}

export function readSaasSession(): SaasSession | null {
  try {
    const raw = localStorage.getItem(SAAS_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SaasSession
    if (!parsed?.token || !parsed?.email) return null
    return parsed
  } catch {
    return null
  }
}

export function saveSaasSession(session: SaasSession | null): void {
  if (!session) {
    localStorage.removeItem(SAAS_SESSION_KEY)
    return
  }
  localStorage.setItem(SAAS_SESSION_KEY, JSON.stringify(session))
}
