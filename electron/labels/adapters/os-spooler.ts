import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execFile, spawn } from 'child_process'
import type { PrinterInfo, PrinterStatus } from '../types'
import type { PrintAdapter } from './print-adapter'

type PlatformName = 'darwin' | 'linux' | 'win32'

const LPSTAT_CMD = process.platform === 'darwin' ? '/usr/sbin/lpstat' : 'lpstat'
const LP_CMD = process.platform === 'darwin' ? '/usr/bin/lp' : 'lp'

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

function execFileAsync(
  command: string,
  args: string[],
  options?: { env?: NodeJS.ProcessEnv }
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true, ...options }, (error, stdout, stderr) => {
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
    const child = spawn(LP_CMD, ['-d', printerName, '-o', 'raw'], {
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

const WINDOWS_RAW_PRINT_SCRIPT = `
param([string]$PrinterName, [string]$FilePath)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrinterSend {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public struct DOC_INFO_1 {
    public string pDocName;
    public string pOutputFile;
    public string pDataType;
  }
  [DllImport("winspool.Drv", SetLastError = true, CharSet = CharSet.Auto)]
  public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pd);
  [DllImport("winspool.Drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", SetLastError = true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, ref DOC_INFO_1 pDocInfo);
  [DllImport("winspool.Drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  [DllImport("kernel32.dll")]
  public static extern uint GetLastError();
  public static bool SendRaw(string printerName, byte[] bytes) {
    IntPtr hPrinter = IntPtr.Zero;
    try {
      if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
      DOC_INFO_1 di = new DOC_INFO_1();
      di.pDocName = "Agiliza Etiqueta";
      di.pOutputFile = null;
      di.pDataType = "RAW";
      if (!StartDocPrinter(hPrinter, 1, ref di)) return false;
      if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); return false; }
      int written = 0;
      IntPtr pBytes = Marshal.AllocCoTaskMem(bytes.Length);
      Marshal.Copy(bytes, 0, pBytes, bytes.Length);
      bool ok = WritePrinter(hPrinter, pBytes, bytes.Length, out written);
      Marshal.FreeCoTaskMem(pBytes);
      EndPagePrinter(hPrinter);
      EndDocPrinter(hPrinter);
      return ok && written == bytes.Length;
    } finally {
      if (hPrinter != IntPtr.Zero) ClosePrinter(hPrinter);
    }
  }
}
"@
$bytes = [System.IO.File]::ReadAllBytes($FilePath)
if (-not [RawPrinterSend]::SendRaw($PrinterName, $bytes)) {
  Write-Error "Falha ao enviar dados para a impressora."
  exit 1
}
exit 0
`.trim()

async function sendRawWindows(printerName: string, payload: Buffer): Promise<void> {
  const payloadPath = join(tmpdir(), `agiliza-label-${Date.now()}.pplb`)
  const scriptPath = join(tmpdir(), `agiliza-raw-print-${Date.now()}.ps1`)
  const rawStr = payload.toString('ascii')
  const winPayload = Buffer.from(rawStr.replace(/\r\n/g, '\n').replace(/\n/g, '\r'), 'ascii')
  await fs.writeFile(payloadPath, winPayload)
  await fs.writeFile(scriptPath, WINDOWS_RAW_PRINT_SCRIPT, 'utf8')
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          scriptPath,
          '-PrinterName',
          printerName,
          '-FilePath',
          payloadPath
        ],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
      )
      const stderrChunks: Buffer[] = []
      child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk))
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) resolve()
        else {
          const msg = Buffer.concat(stderrChunks).toString('utf8').trim()
          reject(new Error(msg || `Impressão RAW falhou (código ${code}). Verifique se a impressora está online e aceita dados RAW.`))
        }
      })
    })
  } finally {
    await fs.unlink(payloadPath).catch(() => undefined)
    await fs.unlink(scriptPath).catch(() => undefined)
  }
}

const DARWIN_PATH = '/usr/bin:/usr/sbin:/bin:/usr/local/bin'

function execFileWithEnv(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return execFileAsync(command, args, { env: { ...process.env, ...env } })
}

function runViaShMac(commandLine: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PATH: DARWIN_PATH }
    execFile('/bin/sh', ['-c', commandLine], { env }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr?.trim() || error.message))
      else resolve(stdout)
    })
  })
}

/** No macOS, tenta obter lista de impressoras via lpstat -a (nome até " accepting") quando -p não retorna nada. */
function parseLpstatA(output: string): string[] {
  const names: string[] = []
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    const idx = trimmed.indexOf(' accepting')
    if (idx > 0) names.push(trimmed.slice(0, idx).trim())
  }
  return [...new Set(names)]
}

/** lpstat -v: "device for PRINTER_NAME: ..." */
function parseLpstatV(output: string): string[] {
  const names: string[] = []
  const re = /device for (.+?):/g
  let m: RegExpExecArray | null
  while ((m = re.exec(output)) !== null) names.push(m[1].trim())
  return [...new Set(names)]
}

async function runLpstat(args: string[]): Promise<string> {
  if (process.platform === 'darwin') {
    const cmdLine = `lpstat ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`
    const attempts: Array<() => Promise<string>> = [
      () => execFileAsync(LPSTAT_CMD, args),
      () => execFileWithEnv('lpstat', args, { PATH: DARWIN_PATH }),
      () => runViaShMac(cmdLine),
      () => runViaLoginShellMac(cmdLine)
    ]
    let lastErr: Error | null = null
    for (const run of attempts) {
      try {
        return await run()
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e))
      }
    }
    throw lastErr ?? new Error('lpstat indisponível')
  }
  return execFileAsync(LPSTAT_CMD, args)
}

function runViaLoginShellMac(commandLine: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const shell = process.env.SHELL || '/bin/zsh'
    execFile(shell, ['-l', '-c', commandLine], { env: process.env }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr?.trim() || error.message))
      else resolve(stdout)
    })
  })
}

async function parseCupsPrinters(): Promise<{ printers: PrinterInfo[]; defaultName: string | null }> {
  let printersRaw: string
  let defaultRaw = ''
  try {
    const [p, d] = await Promise.all([
      runLpstat(['-p']),
      runLpstat(['-d']).catch(() => '')
    ])
    printersRaw = p
    defaultRaw = d
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (process.platform === 'darwin' && (msg.includes('Unable to connect') || msg.includes('No destinations') || msg.includes('exit'))) {
      return { printers: [], defaultName: null }
    }
    throw err
  }

  const defaultNameMatch = defaultRaw.match(/destination:\s*(.+)\s*$/m)
  const defaultName = defaultNameMatch?.[1]?.trim() || null
  let printers: PrinterInfo[] = printersRaw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('printer '))
    .map((line) => {
      const match = line.match(/^printer (.+?) is\s+/)
      const name = match ? match[1].trim() : line.replace(/^printer\s+/, '').split(/\s+is\s+/)[0]?.trim() || line.split(/\s+/)[1] || ''
      return { name, isDefault: defaultName === name }
    })
    .filter((p) => p.name.length > 0)

  if (process.platform === 'darwin' && printers.length === 0) {
    try {
      const outA = await runLpstat(['-a']).catch(() => '')
      const namesA = parseLpstatA(outA)
      const outV = await runLpstat(['-v']).catch(() => '')
      const namesV = parseLpstatV(outV)
      const names = namesA.length > 0 ? namesA : namesV
      if (names.length > 0) {
        printers = names.map((name) => ({ name, isDefault: defaultName === name }))
      }
    } catch {
      // mantém lista vazia
    }
  }

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
    const printers = items.map((item) => ({ name: item.Name, isDefault: Boolean(item.Default) }))
    return filterLabelPrinters(printers)
  }

  async getPrinterStatus(printerName: string): Promise<PrinterStatus> {
    if (this.currentPlatform === 'darwin' || this.currentPlatform === 'linux') {
      const raw = await runLpstat(['-p', printerName])
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
    if (!payload?.length) {
      throw new Error('Nenhum dado para enviar à impressora.')
    }
    if (this.currentPlatform === 'darwin' || this.currentPlatform === 'linux') {
      await sendRawLpStdin(printerName, payload)
      return
    }
    if (this.currentPlatform === 'win32') {
      await sendRawWindows(printerName, payload)
      return
    }
    throw new Error('Plataforma sem suporte para impressão RAW.')
  }
}
