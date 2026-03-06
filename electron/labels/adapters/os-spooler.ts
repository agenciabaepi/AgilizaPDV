import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execFile } from 'child_process'
import type { PrinterInfo, PrinterStatus } from '../types'
import type { PrintAdapter } from './print-adapter'

type PlatformName = 'darwin' | 'linux' | 'win32'

function execFileAsync(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message))
        return
      }
      resolve(stdout)
    })
  })
}

async function parseCupsPrinters(): Promise<{ printers: PrinterInfo[]; defaultName: string | null }> {
  const [printersRaw, defaultRaw] = await Promise.all([
    execFileAsync('lpstat', ['-p']),
    execFileAsync('lpstat', ['-d']).catch(() => '')
  ])

  const defaultNameMatch = defaultRaw.match(/destination:\s*(.+)\s*$/m)
  const defaultName = defaultNameMatch?.[1]?.trim() || null
  const printers: PrinterInfo[] = printersRaw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('printer '))
    .map((line) => {
      const tokens = line.split(/\s+/)
      const name = tokens[1]
      return { name, isDefault: defaultName === name }
    })

  return { printers, defaultName }
}

export class OsSpoolerPrintAdapter implements PrintAdapter {
  constructor(private readonly currentPlatform: PlatformName) {}

  async listPrinters(): Promise<PrinterInfo[]> {
    if (this.currentPlatform === 'darwin' || this.currentPlatform === 'linux') {
      const { printers } = await parseCupsPrinters()
      return printers
    }

    const raw = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      'Get-CimInstance Win32_Printer | Select-Object Name,Default | ConvertTo-Json -Compress'
    ])
    const parsed = JSON.parse(raw) as { Name: string; Default?: boolean } | { Name: string; Default?: boolean }[]
    const items = Array.isArray(parsed) ? parsed : [parsed]
    return items.map((item) => ({ name: item.Name, isDefault: Boolean(item.Default) }))
  }

  async getPrinterStatus(printerName: string): Promise<PrinterStatus> {
    if (this.currentPlatform === 'darwin' || this.currentPlatform === 'linux') {
      const raw = await execFileAsync('lpstat', ['-p', printerName])
      const line = raw.trim().split('\n')[0] ?? ''
      const offline = /disabled/i.test(line)
      return {
        name: printerName,
        online: !offline,
        detail: offline ? line || 'Impressora desabilitada no spooler.' : line || 'Impressora disponível.'
      }
    }

    const raw = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Get-CimInstance Win32_Printer -Filter "Name='${printerName.replace(/'/g, "''")}'" | Select-Object Name,WorkOffline,PrinterStatus | ConvertTo-Json -Compress`
    ])
    const parsed = JSON.parse(raw) as { Name: string; WorkOffline?: boolean; PrinterStatus?: number } | null
    if (!parsed?.Name) {
      return { name: printerName, online: false, detail: 'Impressora não encontrada.' }
    }
    const isOffline = Boolean(parsed.WorkOffline)
    return {
      name: parsed.Name,
      online: !isOffline,
      detail: isOffline ? 'Impressora offline no spooler.' : `Status ${parsed.PrinterStatus ?? 'desconhecido'}`
    }
  }

  async sendRaw(printerName: string, payload: Buffer): Promise<void> {
    const tempPath = join(tmpdir(), `agiliza-label-${Date.now()}.pplb`)
    await fs.writeFile(tempPath, payload)
    try {
      if (this.currentPlatform === 'darwin' || this.currentPlatform === 'linux') {
        await execFileAsync('lp', ['-d', printerName, '-o', 'raw', tempPath])
        return
      }

      throw new Error('Envio RAW para spooler no Windows ainda não está disponível neste MVP.')
    } finally {
      await fs.unlink(tempPath).catch(() => undefined)
    }
  }
}
