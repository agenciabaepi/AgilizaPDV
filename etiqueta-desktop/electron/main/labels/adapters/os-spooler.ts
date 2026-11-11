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
  'os-214', 'os214', 'x-2000', 'zpl', 'intermec', 'cab', 'citizen', 'bixolon',
  // Fila "Genérico / Somente texto" na mesma porta: pass-through RAW quando o driver da térmica engole jobs do app
  'generic', 'text only', 'somente texto'
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

/** PPLA usa STX (0x02) — não converter para ASCII puro. PPLB normaliza CRLF. */
function normalizeRawPayload(payload: Buffer): Buffer {
  if (payload.includes(0x02)) return Buffer.from(payload)
  const raw = payload.toString('latin1')
  return Buffer.from(raw.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), 'latin1')
}

async function sendRawLpFile(printerName: string, payload: Buffer, lpArgs: string[]): Promise<void> {
  const payloadPath = join(tmpdir(), `agiliza-label-${Date.now()}-${Math.random().toString(36).slice(2)}.raw`)
  await fs.writeFile(payloadPath, payload)
  try {
    await execFileAsync(LP_CMD, [...lpArgs, payloadPath])
  } finally {
    await fs.unlink(payloadPath).catch(() => undefined)
  }
}

async function cancelStuckJobs(printerName: string): Promise<void> {
  try {
    await execFileAsync('cancel', ['-a', printerName]).catch(async () => {
      await execFileAsync('/usr/bin/cancel', ['-a', printerName])
    })
  } catch {
    // Melhor esforço: fila pode não ter jobs.
  }
}

async function sendRawUnixWithFallback(printerName: string, payload: Buffer): Promise<void> {
  const queue = sanitizeCupsQueueName(printerName)
  const status = await getCupsPrinterStatus(queue)
  if (!status.online) {
    throw new Error(
      status.detail ||
        'Impressora offline/desconectada. Conecte o USB da Argox e cancele jobs travados na fila do macOS.'
    )
  }

  // Jobs "(stdin)" travados em "Enviando dados" bloqueiam a USB — limpa antes de reenviar.
  await cancelStuckJobs(queue)

  const normalized = normalizeRawPayload(payload)
  const attempts: Array<() => Promise<void>> = [
    // Arquivo + raw (evita job nomeado "(stdin)" e é mais estável no CUPS/macOS)
    () =>
      sendRawLpFile(queue, normalized, [
        '-d',
        queue,
        '-o',
        'raw',
        '-t',
        'Agiliza-Etiqueta'
      ]),
    () =>
      sendRawLpFile(queue, normalized, [
        '-d',
        queue,
        '-oraw',
        '-t',
        'Agiliza-Etiqueta'
      ]),
    () =>
      sendRawLpFile(queue, normalized, [
        '-d',
        queue,
        '-l',
        '-t',
        'Agiliza-Etiqueta'
      ])
  ]
  let lastError: Error | null = null
  for (const run of attempts) {
    try {
      await run()
      return
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw (
    lastError ??
    new Error(
      'Falha ao enviar RAW. No macOS, se a fila Argox travar, crie uma impressora "Genérico / Somente texto" na mesma porta USB e selecione essa fila.'
    )
  )
}

async function getCupsPrinterStatus(printerName: string): Promise<PrinterStatus> {
  const queue = sanitizeCupsQueueName(printerName)
  let detailLines = ''
  try {
    detailLines = await runLpstat(['-l', '-p', queue])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { name: queue, online: false, detail: msg || 'Impressora não encontrada no CUPS.' }
  }

  let reasons = ''
  try {
    const opts = await execFileAsync(
      process.platform === 'darwin' ? '/usr/bin/lpoptions' : 'lpoptions',
      ['-p', queue]
    )
    const match = opts.match(/printer-state-reasons=([^\s]+)/i)
    reasons = match?.[1] ?? ''
  } catch {
    // opcional
  }

  const combined = `${detailLines}\n${reasons}`
  const offline =
    /offline-report|offline|desconect|unable to locate|não foi possível|nao foi possivel|paused|pausad|disabled|desabilitad|desativad|error-printing/i.test(
      combined
    )

  // USB: se a URI é usb:// e o dispositivo sumiu de lpinfo -v, está desconectado.
  let usbMissing = false
  try {
    const devices = await runLpstat(['-v', queue]).catch(() => '')
    const uriMatch = devices.match(/:\s*(usb:\/\/\S+)/i) || devices.match(/(usb:\/\/\S+)/i)
    if (uriMatch?.[1]) {
      const lpinfoCmd = process.platform === 'darwin' ? '/usr/sbin/lpinfo' : 'lpinfo'
      const listed = await execFileAsync(lpinfoCmd, ['-v']).catch(() => '')
      const needle = decodeURIComponent(uriMatch[1].replace(/^usb:\/\//i, '')).toLowerCase()
      const shortName = needle.split('/')[0]?.split('?')[0] ?? ''
      if (shortName && !listed.toLowerCase().includes(shortName.slice(0, 12))) {
        // Fallback: procura "argox" em lpinfo
        if (!/argox/i.test(listed)) usbMissing = true
      }
    }
  } catch {
    // ignora
  }

  const isOffline = offline || usbMissing
  let detail =
    detailLines.trim().split('\n').find((l) => /alerta|offline|disabled|desabilit|ociosa|idle|printing|imprim/i.test(l)) ??
    detailLines.trim().split('\n')[0] ??
    ''
  if (reasons) detail = detail ? `${detail} (${reasons})` : reasons
  if (usbMissing) detail = 'USB desconectado — reconecte o cabo da Argox.'
  else if (isOffline && !detail) detail = 'Impressora offline no sistema.'
  else if (!isOffline && !detail) detail = 'Impressora disponível.'

  return {
    name: queue,
    online: !isOffline,
    detail
  }
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
  const winPayload = normalizeRawPayload(payload)
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

/** CUPS: "printer" (en) ou "impressora" (pt_BR no macOS). */
const CUPS_QUEUE_PREFIX = '(?:printer|impressora)'

/**
 * pt_BR: linhas como "impressora FILA agora  está ociosa" — às vezes o parse antigo incluía " agora" no nome.
 * lpstat -d também pode trazer "... FILA agora" na mesma linha.
 */
function sanitizeCupsQueueName(name: string): string {
  return name
    .trim()
    .replace(/\s+agora\s*$/i, '')
    .replace(/\s+now\s*$/i, '')
    .trim()
}

function parseLpstatA(output: string): string[] {
  const names: string[] = []
  const reAccepting = new RegExp(`^${CUPS_QUEUE_PREFIX}\\s+(.+?)\\s+(not\\s+)?accepting\\b`, 'i')
  const reAceitando = new RegExp(`^${CUPS_QUEUE_PREFIX}\\s+(.+?)\\s+(n[aã]o\\s+)?aceitando\\b`, 'i')
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const accepting = trimmed.match(reAccepting)
    if (accepting) {
      names.push(sanitizeCupsQueueName(accepting[1]))
      continue
    }
    const pt = trimmed.match(reAceitando)
    if (pt) {
      names.push(sanitizeCupsQueueName(pt[1]))
      continue
    }
    const idx = trimmed.toLowerCase().indexOf(' accepting')
    if (idx > 0) names.push(sanitizeCupsQueueName(trimmed.slice(0, idx)))
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

/** Extrai nome da fila de uma linha "lpstat -p" (en: printer … / pt_BR: impressora …). */
function extractPrinterNameFromLpstatPLine(line: string): string | null {
  const trimmed = line.trim()
  const prefix = new RegExp(`^${CUPS_QUEUE_PREFIX}\\s+`, 'i')
  if (!prefix.test(trimmed)) return null
  // Inglês: printer NAME is idle/...
  const en = trimmed.match(new RegExp(`^${CUPS_QUEUE_PREFIX}\\s+(.+?)\\s+is\\s+`, 'i'))
  if (en) return sanitizeCupsQueueName(en[1])
  // pt_BR: "impressora FILA está ..." ou "impressora FILA agora  está ..." (CUPS macOS)
  const pt = trimmed.match(
    new RegExp(`^${CUPS_QUEUE_PREFIX}\\s+(.+?)\\s+(?:agora\\s+)?est[aá]\\s+`, 'i')
  )
  if (pt) return sanitizeCupsQueueName(pt[1])
  // Espaço duplo após o nome (último recurso; nomes de fila costumam ser um token)
  const loose = trimmed.match(new RegExp(`^${CUPS_QUEUE_PREFIX}\\s+(\\S+)\\s{2,}`, 'i'))
  if (loose) return sanitizeCupsQueueName(loose[1])
  return null
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
    // Só retornar lista vazia quando o CUPS realmente não está disponível (evita engolir outros erros com "exit" genérico).
    if (
      process.platform === 'darwin' &&
      (msg.includes('Unable to connect') ||
        msg.includes('No destinations') ||
        /connection refused/i.test(msg) ||
        /can\'t connect/i.test(msg))
    ) {
      return { printers: [], defaultName: null }
    }
    throw err
  }

  const defaultNameMatch = defaultRaw.match(
    /(?:destination|system default destination|destino padr[aã]o|destino)\s*(?:do sistema)?\s*:\s*(.+)\s*$/im
  )
  let defaultName: string | null = defaultNameMatch?.[1] ? sanitizeCupsQueueName(defaultNameMatch[1]) : null
  if (defaultName !== null && defaultName.length === 0) defaultName = null
  const lineLooksLikeQueue = new RegExp(`^${CUPS_QUEUE_PREFIX}\\s+`, 'i')
  let printers: PrinterInfo[] = printersRaw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => lineLooksLikeQueue.test(line))
    .map((line) => {
      const name = extractPrinterNameFromLpstatPLine(line) ?? ''
      return { name, isDefault: defaultName === name }
    })
    .filter((p) => p.name.length > 0)

  // macOS/Linux: se -p não listou nada (locale/formato), tenta -a e -v
  if ((process.platform === 'darwin' || process.platform === 'linux') && printers.length === 0) {
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
    const all = await this.listAllPrinters()
    return filterLabelPrinters(all)
  }

  async listAllPrinters(): Promise<PrinterInfo[]> {
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
      return getCupsPrinterStatus(printerName)
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
      await sendRawUnixWithFallback(sanitizeCupsQueueName(printerName), payload)
      return
    }
    if (this.currentPlatform === 'win32') {
      await sendRawWindows(printerName, payload)
      return
    }
    throw new Error('Plataforma sem suporte para impressão RAW.')
  }
}
