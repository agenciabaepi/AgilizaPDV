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
  loginLojaOnlineCliente,
  registerLojaOnlineCliente,
} from '../lib/loja-online-api'
import type { LojaOnlineClienteSession } from '../lib/loja-online-types'
import { useLojaOnlineStore } from './useLojaOnlineStore'

type LojaOnlineClienteAuthContextValue = {
  cliente: LojaOnlineClienteSession | null
  loading: boolean
  login: (email: string, senha: string) => Promise<boolean>
  register: (data: {
    nome: string
    email: string
    senha: string
    telefone?: string
    endereco?: string
    cpf_cnpj?: string
    cep?: string
  }) => Promise<boolean>
  logout: () => void
  updateLocal: (patch: Partial<LojaOnlineClienteSession>) => void
}

const LojaOnlineClienteAuthContext = createContext<LojaOnlineClienteAuthContextValue | null>(null)

function sessionKey(empresaId: string) {
  return `agiliza:loja-cliente:${empresaId}`
}

function readStoredSession(empresaId: string): LojaOnlineClienteSession | null {
  if (!empresaId || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(sessionKey(empresaId))
    return raw ? (JSON.parse(raw) as LojaOnlineClienteSession) : null
  } catch {
    return null
  }
}

export function LojaOnlineClienteAuthProvider({ children }: { children: ReactNode }) {
  const { store } = useLojaOnlineStore()
  const empresaId = store?.empresa_id ?? ''
  const [cliente, setCliente] = useState<LojaOnlineClienteSession | null>(() => readStoredSession(empresaId))
  const [loading, setLoading] = useState(() => !empresaId)

  useEffect(() => {
    if (!empresaId) {
      setCliente(null)
      setLoading(true)
      return
    }
    setCliente(readStoredSession(empresaId))
    setLoading(false)
  }, [empresaId])

  const persist = useCallback(
    (session: LojaOnlineClienteSession | null) => {
      setCliente(session)
      if (!empresaId) return
      if (session) localStorage.setItem(sessionKey(empresaId), JSON.stringify(session))
      else localStorage.removeItem(sessionKey(empresaId))
    },
    [empresaId]
  )

  const login = useCallback(
    async (email: string, senha: string) => {
      if (!empresaId) return false
      const session = await loginLojaOnlineCliente({ empresaId, email, senha })
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
      endereco?: string
      cpf_cnpj?: string
      cep?: string
    }) => {
      if (!empresaId) return false
      const session = await registerLojaOnlineCliente({ empresaId, ...data })
      persist(session)
      return true
    },
    [empresaId, persist]
  )

  const logout = useCallback(() => persist(null), [persist])

  const updateLocal = useCallback(
    (patch: Partial<LojaOnlineClienteSession>) => {
      if (!cliente) return
      persist({ ...cliente, ...patch })
    },
    [cliente, persist]
  )

  const value = useMemo(
    () => ({ cliente, loading, login, register, logout, updateLocal }),
    [cliente, loading, login, register, logout, updateLocal]
  )

  return (
    <LojaOnlineClienteAuthContext.Provider value={value}>
      {children}
    </LojaOnlineClienteAuthContext.Provider>
  )
}

export function useLojaOnlineClienteAuth() {
  const ctx = useContext(LojaOnlineClienteAuthContext)
  if (!ctx) throw new Error('useLojaOnlineClienteAuth deve ser usado dentro de LojaOnlineClienteAuthProvider')
  return ctx
}
