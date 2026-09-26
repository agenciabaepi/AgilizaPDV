import { heicTo, isHeic } from 'heic-to'

/** Limite do arquivo original (foto do celular / HEIC). */
export const MAX_PRODUTO_IMAGEM_BYTES = 15 * 1024 * 1024

const ACCEPT_IMAGE =
  'image/png,image/jpeg,image/jpg,image/webp,image/gif,image/heic,image/heif,.heic,.heif'

export const PRODUTO_IMAGEM_ACCEPT = ACCEPT_IMAGE
export const PRODUTO_MIDIA_ACCEPT = `${ACCEPT_IMAGE},video/*,.mp4,.mov,.webm,.m4v,.ogg,.ogv,.mkv,.avi,.3gp`

const MAX_OUTPUT_EDGE = 1920
const JPEG_QUALITY = 0.85

export function isProdutoImageFile(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  if (type.startsWith('image/')) return true
  return /\.(jpe?g|png|gif|webp|bmp|avif|hei[cf])$/i.test(file.name)
}

export function isHeicFile(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  if (type === 'image/heic' || type === 'image/heif') return true
  return /\.hei[cf]$/i.test(file.name)
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Erro ao ler imagem.'))
    reader.readAsDataURL(blob)
  })
}

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Não foi possível abrir a imagem.'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = JPEG_QUALITY): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Falha ao gerar JPEG.'))
      },
      'image/jpeg',
      quality
    )
  })
}

function drawBitmapToJpeg(bitmap: ImageBitmap): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas indisponível.'))
  ctx.drawImage(bitmap, 0, 0)
  return canvasToJpegBlob(canvas)
}

/** Safari / Electron / Chrome recentes podem decodificar HEIC nativamente. */
async function tryNativeDecode(file: Blob): Promise<Blob | null> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file)
      try {
        return await drawBitmapToJpeg(bitmap)
      } finally {
        bitmap.close()
      }
    }
  } catch {
    /* segue */
  }

  try {
    const img = await loadImageFromBlob(file)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    return await canvasToJpegBlob(canvas)
  } catch {
    return null
  }
}

async function convertWithHeicTo(file: File): Promise<Blob> {
  // bitmap → canvas costuma ser mais estável que jpeg direto em alguns browsers
  try {
    const bitmap = await heicTo({ blob: file, type: 'bitmap' })
    try {
      return await drawBitmapToJpeg(bitmap)
    } finally {
      bitmap.close()
    }
  } catch {
    /* tenta jpeg direto */
  }

  const jpeg = await heicTo({
    blob: file,
    type: 'image/jpeg',
    quality: JPEG_QUALITY,
  })
  if (!(jpeg instanceof Blob)) throw new Error('Conversão HEIC inválida.')
  return jpeg
}

async function heicToJpegBlob(file: File): Promise<Blob> {
  const native = await tryNativeDecode(file)
  if (native) return native

  try {
    // Alguns apps salvam JPG com extensão .HEIC — isHeic detecta o container real
    const reallyHeic = await isHeic(file).catch(() => true)
    if (!reallyHeic) {
      const asNormal = await tryNativeDecode(file)
      if (asNormal) return asNormal
      return file
    }
    return await convertWithHeicTo(file)
  } catch (err) {
    const detail = err instanceof Error && err.message ? ` ${err.message}` : ''
    throw new Error(
      `Não foi possível converter HEIC.${detail} No iPhone: Ajustes → Câmera → Formatos → Mais Compatível, ou compartilhe como JPG.`
    )
  }
}

/** Redimensiona e grava como JPEG para caber no banco sem estourar sync. */
async function compressImageBlob(blob: Blob): Promise<string> {
  const img = await loadImageFromBlob(blob)
  const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a imagem.')
  ctx.drawImage(img, 0, 0, width, height)
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  if (!dataUrl.startsWith('data:image/')) throw new Error('Falha ao converter a imagem.')
  return dataUrl
}

/**
 * Lê foto do produto (inclui HEIC): valida tamanho, converte HEIC → JPEG
 * e comprime para data URL adequada ao cadastro.
 */
export async function readProdutoImagemFile(file: File): Promise<string> {
  if (!isProdutoImageFile(file)) {
    throw new Error('Arquivo inválido. Use PNG, JPG, WebP ou HEIC.')
  }
  if (file.size > MAX_PRODUTO_IMAGEM_BYTES) {
    throw new Error(
      `Imagem muito grande. Use até ${MAX_PRODUTO_IMAGEM_BYTES / (1024 * 1024)} MB.`
    )
  }

  // Tenta abrir direto (JPG disfarçado de HEIC, Safari com decoder nativo, etc.)
  if (!isHeicFile(file)) {
    try {
      return await compressImageBlob(file)
    } catch {
      return blobToDataUrl(file)
    }
  }

  const jpegBlob = await heicToJpegBlob(file)
  try {
    return await compressImageBlob(jpegBlob)
  } catch {
    return blobToDataUrl(jpegBlob)
  }
}
