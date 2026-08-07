import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { EmpresaConfig } from '../vite-env'

type EmpresaThemeContextValue = {
  config: EmpresaConfig | null
  setEmpresaIdForTheme: (empresaId: string | null) => void
}

const EmpresaThemeContext = createContext<EmpresaThemeContextValue | null>(null)

export function useEmpresaTheme() {
  const ctx = useContext(EmpresaThemeContext)
  return ctx ?? { config: null, setEmpresaIdForTheme: () => {} }
}

export function EmpresaThemeProvider({ children }: { children: React.ReactNode }) {
  const [empresaIdForTheme, setEmpresaIdForTheme] = useState<string | null>(null)
  const [config, setConfig] = useState<EmpresaConfig | null>(null)

  useEffect(() => {
    if (!empresaIdForTheme || typeof window.electronAPI?.empresas?.getConfig !== 'function') {
      setConfig(null)
      return
    }
    window.electronAPI.empresas.getConfig(empresaIdForTheme).then(setConfig).catch(() => setConfig(null))
  }, [empresaIdForTheme])

  useEffect(() => {
    const cor = config?.cor_primaria?.trim()
    const root = document.documentElement
    if (cor && /^#[0-9A-Fa-f]{6}$/.test(cor)) {
      root.style.setProperty('--color-primary', cor)
      root.style.setProperty('--color-primary-hover', cor)
      root.style.setProperty('--color-primary-light', `color-mix(in srgb, ${cor} 8%, transparent)`)
    } else {
      root.style.removeProperty('--color-primary')
      root.style.removeProperty('--color-primary-hover')
      root.style.removeProperty('--color-primary-light')
    }
    return () => {
      root.style.removeProperty('--color-primary')
      root.style.removeProperty('--color-primary-hover')
      root.style.removeProperty('--color-primary-light')
    }
  }, [config?.cor_primaria])

  const handleSyncDataUpdated = useCallback(() => {
    if (empresaIdForTheme) {
      window.electronAPI?.empresas?.getConfig(empresaIdForTheme).then(setConfig).catch(() => {})
    }
  }, [empresaIdForTheme])

  useEffect(() => {
    window.addEventListener('agiliza:syncDataUpdated', handleSyncDataUpdated)
    return () => window.removeEventListener('agiliza:syncDataUpdated', handleSyncDataUpdated)
  }, [handleSyncDataUpdated])

  const value: EmpresaThemeContextValue = {
    config,
    setEmpresaIdForTheme,
  }

  return (
    <EmpresaThemeContext.Provider value={value}>
      {children}
    </EmpresaThemeContext.Provider>
  )
}
