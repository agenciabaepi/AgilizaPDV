import { useState, useEffect } from 'react'

const SYNC_DATA_EVENT = 'agiliza:syncDataUpdated'

/**
 * Retorna uma chave que muda sempre que os dados forem atualizados pelo sync em tempo real
 * (ex.: alteração feita no painel web). Use como dependência em useEffects que carregam listas.
 */
export function useSyncDataRefresh(): number {
  const [refreshKey, setRefreshKey] = useState(0)
  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1)
    window.addEventListener(SYNC_DATA_EVENT, handler)
    return () => window.removeEventListener(SYNC_DATA_EVENT, handler)
  }, [])
  return refreshKey
}
