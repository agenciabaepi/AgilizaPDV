import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchPlanosPublic, planosPublicToList, PLANOS_FALLBACK, type PlanoPublic } from '../lib/planos-api'
import { PLANOS_LIST, normalizePlanoId, type PlanoDef, type PlanoId } from '../lib/planos'

type PlanosContextValue = {
  planos: PlanoPublic[]
  planosList: PlanoDef[]
  loading: boolean
  refresh: () => Promise<void>
  getPlano: (id: string | null | undefined) => PlanoDef
}

const PlanosContext = createContext<PlanosContextValue | null>(null)

export function PlanosProvider({ children }: { children: React.ReactNode }) {
  const [planos, setPlanos] = useState<PlanoPublic[]>(PLANOS_FALLBACK)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchPlanosPublic()
      if (res.ok && res.planos?.length) {
        setPlanos(res.planos)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const planosList = useMemo(() => planosPublicToList(planos), [planos])

  const getPlano = useCallback(
    (id: string | null | undefined): PlanoDef => {
      const key = normalizePlanoId(id)
      return planosList.find((p) => p.id === key) ?? PLANOS_LIST.find((p) => p.id === key) ?? PLANOS_LIST[0]
    },
    [planosList]
  )

  return (
    <PlanosContext.Provider value={{ planos, planosList, loading, refresh, getPlano }}>
      {children}
    </PlanosContext.Provider>
  )
}

export function usePlanos(): PlanosContextValue {
  const ctx = useContext(PlanosContext)
  if (!ctx) {
    return {
      planos: PLANOS_FALLBACK,
      planosList: PLANOS_LIST,
      loading: false,
      refresh: async () => undefined,
      getPlano: (id) => PLANOS_LIST.find((p) => p.id === normalizePlanoId(id)) ?? PLANOS_LIST[0],
    }
  }
  return ctx
}

export type { PlanoId }
