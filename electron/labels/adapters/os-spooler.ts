import { execFile, spawn } from 'child_process'
import type { PrinterInfo, PrinterStatus } from '../types'
import type { PrintAdapter } from './print-adapter'

type PlatformName = 'darwin' | 'linux' | 'win32'

/** Palavras-chave no nome da impressora para considerar como PPLA/PPLB (etiquetas térmicas). */
const LABEL_PRINTER_KEYWORDS = [
  'argox', 'zebra', 'tsc', 'bematech', 'elgin', 'datamax', 'godex', 'sato',
  'ppla', 'pplb', 'etiqueta', 'label', 'thermal', 'térmic', 'termic', 'barcode',
  'os-214', 'os214', 'x-2000', 'zpl', 'intermec', 'cab', 'citizen', 'bixolon'
]

function isLabelPrinter(name: string): boolean {
  const lower = name.toLowerCase().normalize('NFD').replace(/\u0300/g, '')
  return LABEL_PRINTER_KEYWORDS.some((kw) => lower.includes(kw))
}

function filterLabelPrinters(printers: PrinterInfo[]): PrinterInfo[] {
  const filtered = printers.filter((p) => isLabelPrinter(p.name))
  return filtered.length > 0 ? filtered : printers
}

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

function sendRawLpStdin(printerName: string, payload: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('lp', ['-d', printerName, '-o', 'raw'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })
    const stderrChunks: Buffer[] = []
    child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk))
    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        const stderr = Buffer.concat(stderrChunks).toString('utf8').trim()
        reject(new Error(stderr || `lp encerrou com código ${code}`))
      }
    })
    child.stdin.write(payload, (err) => {
      if (err) {
        child.kill()
        reject(err)
        return
      }
      child.stdin.end()
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
      return filterLabelPrinters(printers)
    }

    const raw = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      'Get-CimInstance Win32_Printer | Select-Object Name,Default | ConvertTo-Json -Compress'
    ])
    const parsed = JSON.parse(raw) as { Name: string; Default?: boolean } | { Name: string; Default?: boolean }[]
    const items = Array.isArray(parsed) ? parsed : [parsed]
    const printers = items.map((item) => ({ name: item.Name, isDefault: Boolean(item.Default) }))
    return filterLabelPrinters(printers)
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
    if (this.currentPlatform === 'darwin' || this.currentPlatform === 'linux') {
      if (!payload?.length) {
        throw new Error('Nenhum dado para enviar à impressora.')
      }
      await sendRawLpStdin(printerName, payload)
      return
    }

    throw new Error('Impressão RAW no Windows ainda não está disponível. Use macOS ou Linux para etiquetas térmicas.')
  }
}
