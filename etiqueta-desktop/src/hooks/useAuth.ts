import { useCallback, useEffect, useState } from 'react'
import { clearSession, loadSession, saveSession } from '../lib/session'
import type { UsuarioSession } from '../vite-env'

export function useAuth() {
  const [session, setSession] = useState<UsuarioSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setSession(loadSession())
    setLoading(false)
  }, [])

  const login = useCallback(async (email: string, senha: string) => {
    const result = await window.etiquetaAPI.auth.login(email, senha)
    saveSession(result)
    setSession(result)
    return result
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  return { session, loading, login, logout }
}
