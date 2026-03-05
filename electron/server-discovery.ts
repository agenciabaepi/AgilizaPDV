import Bonjour from 'bonjour-service'

export type DiscoveredServer = {
  name: string
  url: string
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export async function discoverLocalServer(timeoutMs = 3500): Promise<DiscoveredServer | null> {
  return new Promise((resolve) => {
    const bonjour = new Bonjour()
    const browser = bonjour.find({ type: 'agilizapdv' })
    let done = false

    const finish = (value: DiscoveredServer | null): void => {
      if (done) return
      done = true
      try {
        browser?.stop?.()
      } catch {
        // ignore
      }
      try {
        bonjour?.destroy?.()
      } catch {
        // ignore
      }
      resolve(value)
    }

    browser.on('up', (service: { name?: string; host?: string; port?: number; addresses?: string[]; referer?: { address?: string } }) => {
      const host =
        service.referer?.address ||
        (Array.isArray(service.addresses) ? service.addresses.find(Boolean) : undefined) ||
        service.host
      if (!host) return
      const port = service.port ?? 3000
      finish({
        name: service.name || 'AGILIZA-SERVER',
        url: normalizeUrl(`http://${host}:${port}`)
      })
    })

    setTimeout(() => finish(null), timeoutMs)
  })
}

export function normalizeServerUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  return normalizeUrl(url)
}

