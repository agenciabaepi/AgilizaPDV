/**
 * Gera BMPs 24bpp exigidos pelo NSIS (electron-builder) para branding do instalador,
 * alinhado ao layout do app: topbar slate + acento primario #1d4ed8 + wordmark.
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
const WHITE = { r: 248, g: 250, b: 252 } // #f8fafc

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

function makeCanvas(width, height) {
  const data = new Uint8Array(width * height * 3)
  return { width, height, data }
}

function setPixel(canvas, x, y, c) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return
  const i = (y * canvas.width + x) * 3
  canvas.data[i] = c.r
  canvas.data[i + 1] = c.g
  canvas.data[i + 2] = c.b
}

function fillRect(canvas, x, y, w, h, c) {
  const x0 = Math.max(0, x)
  const y0 = Math.max(0, y)
  const x1 = Math.min(canvas.width, x + w)
  const y1 = Math.min(canvas.height, y + h)
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) setPixel(canvas, px, py, c)
  }
}

function fillRoundedRect(canvas, x, y, w, h, radius, c) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const dx = Math.min(px - x, x + w - 1 - px)
      const dy = Math.min(py - y, y + h - 1 - py)
      if (dx >= radius || dy >= radius) {
        setPixel(canvas, px, py, c)
        continue
      }
      const rx = radius - dx - 0.5
      const ry = radius - dy - 0.5
      if (rx * rx + ry * ry <= radius * radius) setPixel(canvas, px, py, c)
    }
  }
}

/**
 * BMP 24-bit, linhas de baixo para cima no arquivo; y=0 no topo da imagem logica.
 */
function writeBmp24(filepath, canvas) {
  const { width, height, data } = canvas
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
    const yTop = height - 1 - row // BMP guarda de baixo para cima
    const offset = 54 + row * rowStride
    for (let x = 0; x < width; x++) {
      const i = (yTop * width + x) * 3
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      buf[offset + x * 3] = b
      buf[offset + x * 3 + 1] = g
      buf[offset + x * 3 + 2] = r
    }
    for (let p = width * 3; p < rowStride; p++) buf[offset + p] = 0
  }

  fs.mkdirSync(path.dirname(filepath), { recursive: true })
  fs.writeFileSync(filepath, buf)
}

/** Fonte bitmap 5x7 para escrever AGILIZA PDV sem dependencias externas. */
const FONT_5x7 = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  V: ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
}

function drawText5x7(canvas, text, x, y, scale, color) {
  let cursor = x
  for (const ch of text) {
    const key = typeof ch === 'string' ? ch.toUpperCase() : ch
    const glyph = FONT_5x7[key] ?? FONT_5x7[' ']
    for (let gy = 0; gy < glyph.length; gy++) {
      for (let gx = 0; gx < glyph[gy].length; gx++) {
        if (glyph[gy][gx] === '1') {
          fillRect(canvas, cursor + gx * scale, y + gy * scale, scale, scale, color)
        }
      }
    }
    cursor += (5 + 1) * scale
  }
}

/** Sidebar assistente: 164x314 - propositalmente neutra (para "sumir" visualmente). */
function drawSidebar(canvas) {
  const { width: w, height: h } = canvas
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      setPixel(canvas, x, y, WHITE)
    }
  }
}

/** Cabecalho paginas internas: 150x57 - slate + faixa inferior + logo centralizado. */
function drawHeader(canvas) {
  const { width: w, height: h } = canvas
  fillRect(canvas, 0, 0, w, h, SLATE_TOP)
  fillRect(canvas, 0, h - 4, w, 4, PRIMARY)

  // Logo textual (bitmap) centralizado.
  const text = 'agiliza'
  const scale = 2
  const textWidth = text.length * (5 + 1) * scale
  const startX = Math.floor((w - textWidth) / 2)
  const textHeight = 7 * scale
  const startY = Math.floor((h - textHeight) / 2)

  drawText5x7(canvas, text, startX, startY, scale, WHITE)
}

function main() {
  const sidebarPath = path.join(outDir, 'installerSidebar.bmp')
  const headerPath = path.join(outDir, 'installerHeader.bmp')

  const SW = 164
  const SH = 314
  const sidebar = makeCanvas(SW, SH)
  drawSidebar(sidebar)
  writeBmp24(sidebarPath, sidebar)

  const HW = 150
  const HH = 57
  const header = makeCanvas(HW, HH)
  drawHeader(header)
  writeBmp24(headerPath, header)

  console.log(`NSIS bitmaps: ${sidebarPath} (${SW}×${SH}), ${headerPath} (${HW}×${HH})`)
}

main()
