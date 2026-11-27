import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Sends bytes straight to the Windows spooler with the RAW datatype, bypassing
// the driver's rendering, so ESC/POS commands reach the printer untouched.
// Messages stay ASCII because PowerShell's stderr encoding is unreliable.
const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class AgilizaRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }

  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern int StartDocPrinter(IntPtr handle, int level, [In] DOCINFO info);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool WritePrinter(IntPtr handle, byte[] data, int count, out int written);

  public static void Send(string printer, string document, byte[] data) {
    IntPtr handle;
    if (!OpenPrinter(printer, out handle, IntPtr.Zero))
      throw new Win32Exception(Marshal.GetLastWin32Error(), "PRINTER_NOT_FOUND");
    try {
      if (StartDocPrinter(handle, 1, new DOCINFO { pDocName = document, pDataType = "RAW" }) == 0)
        throw new Win32Exception(Marshal.GetLastWin32Error(), "START_DOC_FAILED");
      try {
        StartPagePrinter(handle);
        int written;
        if (!WritePrinter(handle, data, data.Length, out written) || written != data.Length)
          throw new Win32Exception(Marshal.GetLastWin32Error(), "WRITE_FAILED");
        EndPagePrinter(handle);
      } finally {
        EndDocPrinter(handle);
      }
    } finally {
      ClosePrinter(handle);
    }
  }
}
'@
[AgilizaRawPrinter]::Send($env:AGILIZA_PRINTER, $env:AGILIZA_DOC, [System.IO.File]::ReadAllBytes($env:AGILIZA_FILE))
`;

const ENCODED_SCRIPT = Buffer.from(SCRIPT, "utf16le").toString("base64");

const MESSAGES = {
  PRINTER_NOT_FOUND: "Impressora não encontrada no Windows. Confira se está instalada e ligada.",
  START_DOC_FAILED: "O Windows recusou a impressão. Confira a fila da impressora.",
  WRITE_FAILED: "Falha ao enviar dados para a impressora.",
};

export async function printRaw(printerName, data, documentName = "Agiliza") {
  const file = path.join(os.tmpdir(), `agiliza-${randomUUID()}.bin`);
  await fs.writeFile(file, data);
  try {
    await new Promise((resolve, reject) => {
      execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", ENCODED_SCRIPT],
        {
          windowsHide: true,
          timeout: 30_000,
          env: { ...process.env, AGILIZA_PRINTER: printerName, AGILIZA_DOC: documentName, AGILIZA_FILE: file },
        },
        (error, _stdout, stderr) => {
          if (!error) return resolve();
          const output = `${stderr}\n${error.message}`;
          const known = Object.keys(MESSAGES).find((k) => output.includes(k));
          reject(new Error(known ? MESSAGES[known] : `Falha ao imprimir: ${stderr.trim().split("\n")[0] || error.message}`));
        },
      );
    });
  } finally {
    await fs.rm(file, { force: true });
  }
}
