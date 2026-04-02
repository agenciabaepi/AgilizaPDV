import { app } from 'electron'
import { spawnSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export type InstallMode = 'server' | 'terminal' | 'unknown'

function readModeFile(path: string): InstallMode | null {
  try {
    if (!existsSync(path)) return null
    const raw = readFileSync(path, 'utf-8').trim().toLowerCase()
    if (raw === 'server') return 'server'
    if (raw === 'terminal') return 'terminal'
    return null
  } catch {
    return null
  }
}

function readModeFromWindowsRegistry(): InstallMode | null {
  if (process.platform !== 'win32') return null
  try {
    const result = spawnSync('reg', ['query', 'HKCU\\Software\\AgilizaPDV', '/v', 'InstallMode'], {
      encoding: 'utf-8',
      windowsHide: true
    })
    const stdout = result.stdout || ''
    const m = stdout.match(/InstallMode\s+REG_\w+\s+(\S+)/i)
    if (!m) return null
    const val = m[1].trim().toLowerCase()
    if (val === 'server') return 'server'
    if (val === 'terminal') return 'terminal'
    return null
  } catch {
    return null
  }
}

export function getInstallMode(): InstallMode {
  if (process.argv.includes('--store-server')) return 'server'

  /** `npm run dev` no Mac/Linux: use AGILIZA_INSTALL_MODE=server|terminal no .env ou no comando. Ignorado no app empacotado. */
  if (!app.isPackaged) {
    const raw = process.env.AGILIZA_INSTALL_MODE?.trim().toLowerCase()
    if (raw === 'server' || raw === 'terminal') return raw
  }

  const programDataMode = readModeFile(join(process.env.PROGRAMDATA || '', 'AgilizaPDV', 'install-mode.txt'))
  if (programDataMode) return programDataMode

  const fromRegistry = readModeFromWindowsRegistry()
  if (fromRegistry) return fromRegistry

  const candidates = [
    join(app.getPath('userData'), 'install-mode.txt'),
    join(process.env.APPDATA || '', 'agiliza-pdv', 'install-mode.txt')
  ].filter(Boolean)

  for (const file of candidates) {
    const mode = readModeFile(file)
    if (mode) return mode
  }
  return 'unknown'
}

