import dgram from 'dgram'
import http from 'http'
import os from 'os'
import Bonjour from 'bonjour-service'
import {
  AGILIZA_DEFAULT_STORE_HTTP_PORT,
  AGILIZA_DISCOVER_MESSAGE_V1,
  AGILIZA_DISCOVERY_UDP_PORT
} from './discovery-constants'

export type DiscoveredServer = {
  name: string
  url: string
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function rejectIfNull(p: Promise<DiscoveredServer | null>): Promise<DiscoveredServer> {
  return p.then((v) => (v ? v : Promise.reject(new Error('discover-null'))))
}

function getIpv4BroadcastTargets(): string[] {
  const targets = new Set<string>(['255.255.255.255'])
  const nets = os.networkInterfaces()
  for (const addrs of Object.values(nets)) {
    for (const a of addrs || []) {
      const fam = a.family
      if ((fam !== 'IPv4' && fam !== 4) || a.internal) continue
      const parts = a.address.split('.')
      if (parts.length !== 4) continue
      targets.add(`${parts[0]}.${parts[1]}.${parts[2]}.255`)
    }
  }
  return [...targets]
}

function getLocalSubnets(): string[] {
  const subnets = new Set<string>()
  const nets = os.networkInterfaces()
  for (const addrs of Object.values(nets)) {
    for (const a of addrs || []) {
      const fam = a.family
      if ((fam !== 'IPv4' && fam !== 4) || a.internal) continue
      const parts = a.address.split('.')
      if (parts.length !== 4) continue
      subnets.add(`${parts[0]}.${parts[1]}.${parts[2]}`)
    }
  }
  return [...subnets]
}

function probeStoreHealth(ip: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://${ip}:${port}/health`, { timeout: timeoutMs }, (res) => {
      let data = ''
      res.on('data', (c) => {
        data += c
      })
      res.on('end', () => {
        try {
          const j = JSON.parse(data) as { ok?: boolean }
          resolve(res.statusCode === 200 && j.ok === true)
        } catch {
          resolve(false)
        }
      })
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

function discoverViaUdp(timeoutMs: number, defaultHttpPort: number): Promise<DiscoveredServer | null> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4')
    let settled = false
    const finish = (v: DiscoveredServer | null): void => {
      if (settled) return
      settled = true
      try {
        socket.close()
      } catch {
        // ignore
      }
      resolve(v)
    }

    socket.on('error', (err) => {
      console.warn('[Agiliza PDV][discovery-udp] socket:', err.message)
      finish(null)
    })

    socket.on('message', (msg, rinfo) => {
      try {
        const j = JSON.parse(msg.toString('utf8')) as { name?: string; port?: number }
        const port = Number(j.port) || defaultHttpPort
        const name = typeof j.name === 'string' ? j.name : 'AGILIZA-SERVER'
        const url = normalizeUrl(`http://${rinfo.address}:${port}`)
        console.log('[Agiliza PDV][discovery-udp] Servidor encontrado em', url)
        finish({ name, url })
      } catch {
        // pacote inválido
      }
    })

    socket.bind(0, () => {
      try {
        socket.setBroadcast(true)
      } catch {
        // ignore
      }
      const payload = Buffer.from(AGILIZA_DISCOVER_MESSAGE_V1, 'utf8')
      const targets = getIpv4BroadcastTargets()
      let pending = targets.length
      if (pending === 0) {
        finish(null)
        return
      }
      for (const host of targets) {
        socket.send(payload, 0, payload.length, AGILIZA_DISCOVERY_UDP_PORT, host, (err) => {
          if (err) console.warn('[Agiliza PDV][discovery-udp] envio para', host, err.message)
          pending -= 1
          if (pending === 0 && !settled) {
            console.log('[Agiliza PDV][discovery-udp] Broadcast enviado; aguardando resposta…')
          }
        })
      }
    })

    setTimeout(() => finish(null), timeoutMs)
  })
}

function discoverViaBonjour(timeoutMs: number): Promise<DiscoveredServer | null> {
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

    browser.on(
      'up',
      (service: {
        name?: string
        host?: string
        port?: number
        addresses?: string[]
        referer?: { address?: string }
      }) => {
        const host =
          service.referer?.address ||
          (Array.isArray(service.addresses) ? service.addresses.find(Boolean) : undefined) ||
          service.host
        if (!host) return
        const port = service.port ?? AGILIZA_DEFAULT_STORE_HTTP_PORT
        const url = normalizeUrl(`http://${host}:${port}`)
        console.log('[Agiliza PDV][discovery-mdns] Servidor encontrado em', url)
        finish({
          name: service.name || 'AGILIZA-SERVER',
          url
        })
      }
    )

    setTimeout(() => finish(null), timeoutMs)
  })
}

function discoverViaSubnetScan(httpPort: number, overallTimeoutMs: number, perHostMs: number): Promise<DiscoveredServer | null> {
  return new Promise((resolve) => {
    const subnets = getLocalSubnets()
    if (subnets.length === 0) {
      resolve(null)
      return
    }

    const candidates: string[] = []
    for (const s of subnets) {
      for (let last = 1; last <= 254; last += 1) {
        candidates.push(`${s}.${last}`)
      }
    }

    const deadline = Date.now() + overallTimeoutMs
    const batchSize = 40
    let cancelled = false

    const run = async (): Promise<void> => {
      try {
        console.log('[Agiliza PDV][discovery-scan] Varredura /health na rede local (porta', httpPort, ')…')
        for (let i = 0; i < candidates.length && !cancelled; i += batchSize) {
          if (Date.now() > deadline) break
          const batch = candidates.slice(i, i + batchSize)
          const hits = await Promise.all(batch.map((ip) => probeStoreHealth(ip, httpPort, perHostMs)))
          const idx = hits.findIndex(Boolean)
          if (idx >= 0) {
            const ip = batch[idx]
            const url = normalizeUrl(`http://${ip}:${httpPort}`)
            console.log('[Agiliza PDV][discovery-scan] Servidor encontrado em', url)
            cancelled = true
            resolve({ name: 'AGILIZA-SERVER', url })
            return
          }
        }
        if (!cancelled) resolve(null)
      } catch (e) {
        console.warn('[Agiliza PDV][discovery-scan]', e instanceof Error ? e.message : e)
        if (!cancelled) resolve(null)
      }
    }

    void run()
  })
}

/**
 * Descobre o store-server na LAN: UDP broadcast, mDNS (Bonjour) e, por último, varredura HTTP em /health.
 * Qualquer método que encontrar primeiro encerra os demais do ponto de vista do chamador (Promise.any).
 */
export async function discoverLocalServer(overallTimeoutMs = 15000): Promise<DiscoveredServer | null> {
  const httpPort = AGILIZA_DEFAULT_STORE_HTTP_PORT
  console.log('[Agiliza PDV] Procurando servidor da loja (UDP', AGILIZA_DISCOVERY_UDP_PORT, '+ mDNS + varredura)…')

  const udpMs = Math.min(6000, overallTimeoutMs)
  const mdnsMs = Math.min(8000, overallTimeoutMs)
  const scanMs = Math.max(2000, overallTimeoutMs - 1000)

  try {
    return await Promise.any([
      rejectIfNull(discoverViaUdp(udpMs, httpPort)),
      rejectIfNull(discoverViaBonjour(mdnsMs)),
      rejectIfNull(discoverViaSubnetScan(httpPort, scanMs, 350))
    ])
  } catch {
    console.warn('[Agiliza PDV] Nenhum servidor encontrado após descoberta (UDP/mDNS/varredura).')
    return null
  }
}

export function normalizeServerUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  return normalizeUrl(url)
}

export function getLocalIPv4Addresses(): string[] {
  const out: string[] = []
  const nets = os.networkInterfaces()
  for (const addrs of Object.values(nets)) {
    for (const a of addrs || []) {
      const fam = a.family
      if ((fam !== 'IPv4' && fam !== 4) || a.internal) continue
      if (a.address) out.push(a.address)
    }
  }
  return out
}
