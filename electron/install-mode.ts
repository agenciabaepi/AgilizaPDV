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
    const output = `${result.stdout || ''}\n${result.stderr || ''}`.toLowerCase()
    if (output.includes('server')) return 'server'
    if (output.includes('terminal')) return 'terminal'
    return null
  } catch {
    return null
  }
}

export function getInstallMode(): InstallMode {
  if (process.argv.includes('--store-server')) return 'server'

  const candidates = [
    join(app.getPath('userData'), 'install-mode.txt'),
    join(process.env.APPDATA || '', 'agiliza-pdv', 'install-mode.txt'),
    join(process.env.PROGRAMDATA || '', 'AgilizaPDV', 'install-mode.txt')
  ].filter(Boolean)

  for (const file of candidates) {
    const mode = readModeFile(file)
    if (mode) return mode
  }
  const fromRegistry = readModeFromWindowsRegistry()
  if (fromRegistry) return fromRegistry
  return 'unknown'
}

