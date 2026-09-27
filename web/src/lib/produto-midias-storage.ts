import { supabase } from './supabase'

export const PRODUTO_MIDIAS_BUCKET = 'produto-midias'
/** Limite do app; o plano Free do Supabase ainda pode cortar em ~50 MB. */
export const MAX_PRODUTO_VIDEO_BYTES = 500 * 1024 * 1024
/** Teto típico do Storage no plano Free (quando o bucket/plano rejeita). */
const FREE_PLAN_HINT_BYTES = 50 * 1024 * 1024

const MSG_BUCKET =
  'Bucket de mídias não configurado. Execute web/sql/supabase-produto-midias-storage.sql no Supabase (SQL Editor).'

function isBucketMissingError(message: string): boolean {
  const msg = message.toLowerCase()
  return (
    msg.includes('bucket') ||
    msg.includes('not found') ||
    msg.includes('does not exist') ||
    msg.includes('row-level security') ||
    msg.includes('policy')
  )
}

function isTooLargeError(message: string): boolean {
  const msg = message.toLowerCase()
  return (
    msg.includes('maximum allowed size') ||
    msg.includes('exceeded') ||
    msg.includes('too large') ||
    msg.includes('payload too large') ||
    msg.includes('entity too large')
  )
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)
}

function extensionFromFile(file: File): string {
  const fromName = file.name.split('.').pop()?.trim().toLowerCase()
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName
  const mime = file.type.toLowerCase()
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('quicktime')) return 'mov'
  if (mime.includes('ogg')) return 'ogv'
  if (mime.includes('matroska')) return 'mkv'
  if (mime.includes('avi')) return 'avi'
  return 'mp4'
}

export function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true
  return /\.(mp4|webm|mov|m4v|ogg|ogv|mkv|avi|3gp)$/i.test(file.name)
}

export async function uploadProdutoVideo(params: {
  empresaId: string
  file: File
}): Promise<string> {
  return uploadProdutoMidiaFile({ ...params, folder: 'produtos', kind: 'video' })
}

/** Limite de vídeo em avaliações de clientes (mais leve que galeria do produto). */
export const MAX_AVALIACAO_VIDEO_BYTES = 80 * 1024 * 1024
export const MAX_AVALIACAO_MIDIAS = 6
export const MAX_AVALIACAO_VIDEOS = 1

export async function uploadAvaliacaoMidia(params: {
  empresaId: string
  file: File | Blob
  kind: 'image' | 'video'
  ext?: string
}): Promise<string> {
  const { empresaId, file, kind } = params
  if (kind === 'video') {
    if (file.size > MAX_AVALIACAO_VIDEO_BYTES) {
      throw new Error(
        `Vídeo com ${formatMb(file.size)} MB. Nas avaliações o limite é ${formatMb(MAX_AVALIACAO_VIDEO_BYTES)} MB.`
      )
    }
  }
  const asFile =
    file instanceof File
      ? file
      : new File([file], `avaliacao.${params.ext ?? (kind === 'video' ? 'mp4' : 'jpg')}`, {
          type: file.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
        })
  return uploadProdutoMidiaFile({
    empresaId,
    file: asFile,
    folder: 'avaliacoes',
    kind,
  })
}

export function isImagemBase64(url: string | null | undefined): boolean {
  return Boolean(url?.trim().startsWith('data:image/'))
}

/**
 * Envia para o Storage as fotos que ainda estão em base64 (data URL) e devolve os links.
 * Foto em base64 dentro da linha do produto deixa a loja e o PDV lentos para carregar.
 */
export async function subirImagensBase64<T extends { url: string }>(params: {
  empresaId: string
  imagem: string
  midias: T[]
}): Promise<{ imagem: string; midias: T[] }> {
  const enviadas = new Map<string, Promise<string>>()
  const enviar = (dataUrl: string) => {
    let p = enviadas.get(dataUrl)
    if (!p) {
      p = fetch(dataUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'
          const file = new File([blob], `foto.${ext}`, { type: blob.type || 'image/jpeg' })
          return uploadProdutoMidiaFile({ empresaId: params.empresaId, file, folder: 'produtos', kind: 'image' })
        })
      enviadas.set(dataUrl, p)
    }
    return p
  }
  const imagem = isImagemBase64(params.imagem) ? await enviar(params.imagem.trim()) : params.imagem
  const midias = await Promise.all(
    params.midias.map(async (m) => (isImagemBase64(m.url) ? { ...m, url: await enviar(m.url.trim()) } : m))
  )
  return { imagem, midias }
}

const DATA_URL_IMAGEM_RE = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g

/** Troca toda imagem em base64 dentro do texto (inclusive JSON) pelo link no Storage. */
export async function subirBase64EmTexto<T extends string | null | undefined>(
  texto: T,
  empresaId: string
): Promise<T> {
  if (typeof texto !== 'string' || !texto.includes('data:image/')) return texto
  let out: string = texto
  for (const dataUrl of new Set(texto.match(DATA_URL_IMAGEM_RE) ?? [])) {
    const blob = await (await fetch(dataUrl)).blob()
    const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'
    const file = new File([blob], `imagem.${ext}`, { type: blob.type || 'image/jpeg' })
    const url = await uploadProdutoMidiaFile({ empresaId, file, folder: 'loja-online', kind: 'image' })
    out = out.split(dataUrl).join(url)
  }
  return out as T
}

async function uploadProdutoMidiaFile(params: {
  empresaId: string
  file: File
  folder: 'produtos' | 'avaliacoes' | 'loja-online'
  kind: 'image' | 'video'
}): Promise<string> {
  const { empresaId, file, folder, kind } = params
  if (!empresaId.trim()) throw new Error('Empresa não identificada.')
  if (kind === 'video') {
    if (!isVideoFile(file)) throw new Error('Arquivo inválido. Use MP4, MOV, WebM ou similar.')
    if (file.size > MAX_PRODUTO_VIDEO_BYTES) {
      throw new Error(
        `Vídeo com ${formatMb(file.size)} MB. O limite é ${formatMb(MAX_PRODUTO_VIDEO_BYTES)} MB. Comprima o arquivo ou use um menor.`
      )
    }
  }

  const imageType = file.type.startsWith('image/') ? file.type : 'image/jpeg'
  const ext =
    kind === 'image'
      ? imageType.includes('png')
        ? 'png'
        : imageType.includes('webp')
          ? 'webp'
          : 'jpg'
      : extensionFromFile(file)
  const path = `${folder}/${empresaId}/${crypto.randomUUID()}.${ext}`
  const contentType =
    kind === 'image'
      ? imageType
      : file.type || `video/${ext === 'mov' ? 'quicktime' : ext}`

  const { error } = await supabase.storage.from(PRODUTO_MIDIAS_BUCKET).upload(path, file, {
    upsert: false,
    contentType,
  })
  if (error) {
    if (isBucketMissingError(error.message)) throw new Error(MSG_BUCKET)
    if (isTooLargeError(error.message)) {
      const freeHint =
        file.size > FREE_PLAN_HINT_BYTES
          ? ` Se o projeto estiver no plano Free, o Supabase corta em ~${formatMb(FREE_PLAN_HINT_BYTES)} MB — aí é preciso plano Pro ou um vídeo menor.`
          : ''
      throw new Error(
        `Arquivo com ${formatMb(file.size)} MB passou do limite do Storage. Rode o SQL supabase-produto-midias-storage.sql no Supabase (SQL Editor).${freeHint}`
      )
    }
    throw new Error(error.message || 'Erro ao enviar mídia.')
  }

  const { data } = supabase.storage.from(PRODUTO_MIDIAS_BUCKET).getPublicUrl(path)
  const url = data.publicUrl?.trim()
  if (!url) throw new Error('Não foi possível obter a URL pública da mídia.')
  return url
}
