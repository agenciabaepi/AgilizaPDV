import { platform } from 'os'
import type { PrinterInfo, PrinterStatus } from '../types'
import { OsSpoolerPrintAdapter } from './os-spooler'

export interface PrintAdapter {
  listPrinters(): Promise<PrinterInfo[]>
  /** Lista todas as impressoras do sistema (sem filtro de etiquetas). Usado para cupom. */
  listAllPrinters(): Promise<PrinterInfo[]>
  getPrinterStatus(printerName: string): Promise<PrinterStatus>
  sendRaw(printerName: string, payload: Buffer): Promise<void>
}

export function createPrintAdapter(): PrintAdapter {
  const currentPlatform = platform()
  if (currentPlatform === 'darwin' || currentPlatform === 'linux' || currentPlatform === 'win32') {
    return new OsSpoolerPrintAdapter(currentPlatform)
  }
  throw new Error(`Plataforma sem suporte de impressão no MVP: ${currentPlatform}`)
}
