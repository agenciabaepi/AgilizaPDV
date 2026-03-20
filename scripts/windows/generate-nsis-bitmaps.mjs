/**
 * Gera BMPs 24bpp exigidos pelo NSIS (electron-builder) para branding do instalador,
 * alinhado ao layout do app: topbar slate + acento primário #1d4ed8.
 * @see https://www.electron.build/nsis
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')
const outDir = path.join(root, 'build')

/** App design tokens (renderer/index.css) */
const SLATE_TOP = { r: 30, g: 41, b: 59 } // #1e293b
const SLATE_DEEP = { r: 15, g: 23, b: 42 } // #0f172a
const PRIMARY = { r: 29, g: 78, b: 216 } // #1d4ed8

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t)
}

function lerpColor(c0, c1, t) {
  return {
    r: lerp(c0.r, c1.r, t),
    g: lerp(c0.g, c1.g, t),
    b: lerp(c0.b, c1.b, t),
  }
}

/**
 * BMP 24-bit, linhas de baixo para cima no arquivo; y=0 no topo da imagem lógica.
 */
function writeBmp24(filepath, width, height, pixelAt) {
  const rowStride = Math.ceil((width * 3) / 4) * 4
  const pixelBytes = rowStride * height
  const fileSize = 14 + 40 + pixelBytes
  const buf = Buffer.alloc(fileSize)

  buf.write('BM', 0)
  buf.writeUInt32LE(fileSize, 2)
  buf.writeUInt32LE(0, 6)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(width, 18)
  buf.writeInt32LE(height, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(0, 30)
  buf.writeUInt32LE(pixelBytes, 34)

  for (let row = 0; row < height; row++) {
    const yTop = height - 1 - row
    const offset = 54 + row * rowStride
    for (let x = 0; x < width; x++) {
      const { r, g, b } = pixelAt(x, yTop)
      buf[offset + x * 3] = b
      buf[offset + x * 3 + 1] = g
      buf[offset + x * 3 + 2] = r
    }
    for (let p = width * 3; p < rowStride; p++) buf[offset + p] = 0
  }

  fs.mkdirSync(path.dirname(filepath), { recursive: true })
  fs.writeFileSync(filepath, buf)
}

/** Sidebar assistente: 164×314 — faixa superior (topbar) + gradiente + acento à direita. */
function sidebarPixel(x, y, w, h) {
  const topBarEnd = Math.floor(h * 0.18)
  const accentLineY0 = topBarEnd + 1
  const accentLineY1 = topBarEnd + 3

  // Acento primário na borda direita (fita contínua)
  if (x >= w - 10) return PRIMARY

  // Região tipo app-topbar
  if (y <= topBarEnd) return SLATE_TOP

  // Linha de destaque sob a topbar (eco da aba ativa #1d4ed8)
  if (y >= accentLineY0 && y <= accentLineY1 && x < w - 10) return PRIMARY

  const t = h > 1 ? (y - topBarEnd) / Math.max(1, h - topBarEnd - 1) : 0
  return lerpColor(SLATE_TOP, SLATE_DEEP, t * 0.9)
}

/** Cabeçalho páginas internas: 150×57 — slate + faixa inferior primária. */
function headerPixel(x, y, w, h) {
  if (y >= h - 4) return PRIMARY
  return SLATE_TOP
}

function main() {
  const sidebarPath = path.join(outDir, 'installerSidebar.bmp')
  const headerPath = path.join(outDir, 'installerHeader.bmp')

  const SW = 164
  const SH = 314
  writeBmp24(sidebarPath, SW, SH, (x, y) => sidebarPixel(x, y, SW, SH))

  const HW = 150
  const HH = 57
  writeBmp24(headerPath, HW, HH, (x, y) => headerPixel(x, y, HW, HH))

  console.log(`NSIS bitmaps: ${sidebarPath} (${SW}×${SH}), ${headerPath} (${HW}×${HH})`)
}

main()
