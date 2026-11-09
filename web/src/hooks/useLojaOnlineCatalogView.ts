import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LojaOnlineCatalogoColunas } from '../lib/loja-online-cards'
import { useLojaOnlineStore } from './useLojaOnlineStore'

export type LojaOnlineCatalogVista = '2' | '3' | '4' | 'lista'

const STORAGE_KEY = 'agiliza:loja-catalog-vista'

function isVista(value: string | null | undefined): value is LojaOnlineCatalogVista {
  return value === '2' || value === '3' || value === '4' || value === 'lista'
}

function readStoredVista(): LojaOnlineCatalogVista | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return isVista(raw) ? raw : null
  } catch {
    return null
  }
}

function writeStoredVista(vista: LojaOnlineCatalogVista) {
  try {
    sessionStorage.setItem(STORAGE_KEY, vista)
  } catch {
    /* ignore */
  }
}

export function useLojaOnlineCatalogView() {
  const { cardsConfig } = useLojaOnlineStore()
  const defaultCols = cardsConfig.catalogoColunas
  const [vista, setVistaState] = useState<LojaOnlineCatalogVista>(() => {
    const stored = readStoredVista()
    if (stored) return stored
    return String(defaultCols) as LojaOnlineCatalogVista
  })

  useEffect(() => {
    if (readStoredVista()) return
    setVistaState(String(defaultCols) as LojaOnlineCatalogVista)
  }, [defaultCols])

  const setVista = useCallback((next: LojaOnlineCatalogVista) => {
    setVistaState(next)
    writeStoredVista(next)
  }, [])

  const gridClassName = useMemo(() => {
    if (vista === 'lista') {
      return 'loja-catalogo-grid loja-catalogo-grid--joog loja-catalogo-grid--lista'
    }
    return `loja-catalogo-grid loja-catalogo-grid--joog loja-catalogo-grid--cols-${vista}`
  }, [vista])

  const cardVariant = vista === 'lista' ? ('list' as const) : ('grid' as const)

  const colunasAtivas: LojaOnlineCatalogoColunas | null =
    vista === 'lista' ? null : (Number(vista) as LojaOnlineCatalogoColunas)

  return { vista, setVista, gridClassName, cardVariant, colunasAtivas }
}
