import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  loginLojaOnlineUgcCriador,
  registerLojaOnlineUgcCriador,
  updateLojaOnlineUgcCriadorPerfil,
} from '../lib/loja-online-ugc-api'
import type { LojaOnlineUgcCriadorSession } from '../lib/loja-online-types'
import { useLojaOnlineStore } from './useLojaOnlineStore'

type LojaOnlineUgcAuthContextValue = {
  criador: LojaOnlineUgcCriadorSession | null
  loading: boolean
  login: (email: string, senha: string) => Promise<boolean>
  register: (data: {
    nome: string
    email: string
    senha: string
    telefone?: string
    instagram?: string
    tiktok?: string
    youtube?: string
    pix_chave?: string
  }) => Promise<boolean>
  logout: () => void
  updateLocal: (patch: Partial<LojaOnlineUgcCriadorSession>) => void
  updateProfile: (patch: {
    nome?: string
    telefone?: string | null
    instagram?: string | null
    tiktok?: string | null
    youtube?: string | null
    pix_chave?: string | null
  }) => Promise<LojaOnlineUgcCriadorSession>
}

const LojaOnlineUgcAuthContext = createContext<LojaOnlineUgcAuthContextValue | null>(null)

function sessionKey(empresaId: string) {
  return `agiliza:loja-ugc:${empresaId}`
}

function readStoredSession(empresaId: string): LojaOnlineUgcCriadorSession | null {
  if (!empresaId || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(sessionKey(empresaId))
    return raw ? (JSON.parse(raw) as LojaOnlineUgcCriadorSession) : null
  } catch {
    return null
  }
}

export function LojaOnlineUgcAuthProvider({ children }: { children: ReactNode }) {
  const { store } = useLojaOnlineStore()
  const empresaId = store?.empresa_id ?? ''
  const [criador, setCriador] = useState<LojaOnlineUgcCriadorSession | null>(() =>
    readStoredSession(empresaId)
  )
  const [loading, setLoading] = useState(() => !empresaId)

  useEffect(() => {
    if (!empresaId) {
      setCriador(null)
      setLoading(true)
      return
    }
    setCriador(readStoredSession(empresaId))
    setLoading(false)
  }, [empresaId])

  const persist = useCallback(
    (session: LojaOnlineUgcCriadorSession | null) => {
      setCriador(session)
      if (!empresaId) return
      if (session) localStorage.setItem(sessionKey(empresaId), JSON.stringify(session))
      else localStorage.removeItem(sessionKey(empresaId))
    },
    [empresaId]
  )

  const login = useCallback(
    async (email: string, senha: string) => {
      if (!empresaId) return false
      const session = await loginLojaOnlineUgcCriador({ empresaId, email, senha })
      persist(session)
      return true
    },
    [empresaId, persist]
  )

  const register = useCallback(
    async (data: {
      nome: string
      email: string
      senha: string
      telefone?: string
      instagram?: string
      tiktok?: string
      youtube?: string
      pix_chave?: string
    }) => {
      if (!empresaId) return false
      const session = await registerLojaOnlineUgcCriador({ empresaId, ...data })
      persist(session)
      return true
    },
    [empresaId, persist]
  )

  const logout = useCallback(() => persist(null), [persist])

  const updateLocal = useCallback(
    (patch: Partial<LojaOnlineUgcCriadorSession>) => {
      setCriador((prev) => {
        if (!prev) return prev
        const next = { ...prev, ...patch }
        if (empresaId) localStorage.setItem(sessionKey(empresaId), JSON.stringify(next))
        return next
      })
    },
    [empresaId]
  )

  const updateProfile = useCallback(
    async (patch: {
      nome?: string
      telefone?: string | null
      instagram?: string | null
      tiktok?: string | null
      youtube?: string | null
      pix_chave?: string | null
    }) => {
      if (!empresaId || !criador) throw new Error('Não autenticado.')
      const session = await updateLojaOnlineUgcCriadorPerfil(criador.id, empresaId, patch)
      persist(session)
      return session
    },
    [empresaId, criador, persist]
  )

  const value = useMemo(
    () => ({ criador, loading, login, register, logout, updateLocal, updateProfile }),
    [criador, loading, login, register, logout, updateLocal, updateProfile]
  )

  return <LojaOnlineUgcAuthContext.Provider value={value}>{children}</LojaOnlineUgcAuthContext.Provider>
}

export function useLojaOnlineUgcAuth() {
  const ctx = useContext(LojaOnlineUgcAuthContext)
  if (!ctx) throw new Error('useLojaOnlineUgcAuth deve ser usado dentro de LojaOnlineUgcAuthProvider')
  return ctx
}
