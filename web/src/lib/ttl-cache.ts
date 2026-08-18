type CacheEntry<T> = { at: number; data: T; inflight?: Promise<T> }

/** Cache em memória com TTL e deduplicação de requisições em voo. */
export function createTtlCache<T>(ttlMs: number) {
  const map = new Map<string, CacheEntry<T>>()

  return {
    peek(key: string): T | undefined {
      const entry = map.get(key)
      if (!entry || entry.at <= 0) return undefined
      if (Date.now() - entry.at >= ttlMs) return undefined
      return entry.data
    },
    get(key: string, loader: () => Promise<T>): Promise<T> {
      const cached = map.get(key)
      const now = Date.now()
      if (cached && cached.at > 0 && now - cached.at < ttlMs) return Promise.resolve(cached.data)
      if (cached?.inflight) return cached.inflight

      const inflight = loader()
        .then((data) => {
          map.set(key, { at: Date.now(), data })
          return data
        })
        .catch((err) => {
          const prev = map.get(key)
          if (prev?.inflight === inflight) {
            map.set(key, { at: prev.at, data: prev.data })
          }
          throw err
        })

      map.set(key, {
        at: cached?.at ?? 0,
        data: (cached?.data ?? undefined) as T,
        inflight,
      })
      return inflight
    },
    set(key: string, data: T) {
      map.set(key, { at: Date.now(), data })
    },
    invalidate(prefix?: string) {
      if (!prefix) {
        map.clear()
        return
      }
      for (const key of [...map.keys()]) {
        if (key === prefix || key.startsWith(prefix)) map.delete(key)
      }
    },
  }
}
