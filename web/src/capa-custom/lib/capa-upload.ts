import { supabase } from '../../lib/supabase'
import type { LojaOnlinePersonalizacao } from '../../lib/loja-online-types'
import type { PrintFile } from '../editor/CaseStage'
import type { PhoneModel } from '../phoneModels'
import type { Design } from '../types'

export const CAPAS_BUCKET = 'capas-personalizadas'

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
}

async function upload(path: string, blob: Blob): Promise<string> {
  const { error } = await supabase.storage.from(CAPAS_BUCKET).upload(path, blob, {
    upsert: false,
    contentType: blob.type || 'image/png',
  })
  if (error) {
    console.error('[capa-personalizada] upload falhou', path, error)
    throw new Error('Não foi possível enviar sua arte agora. Verifique a conexão e tente novamente.')
  }
  return supabase.storage.from(CAPAS_BUCKET).getPublicUrl(path).data.publicUrl
}

/**
 * Envia prévia, arquivo de impressão e fotos originais para o Storage e registra a arte.
 * As fotos vão sem recompressão para permitir reimpressão em alta qualidade.
 */
export async function saveCapaDesign(params: {
  empresaId: string
  produtoId: string
  produtoPaiId: string
  model: PhoneModel
  design: Design
  print: PrintFile
  preview: Blob
  onProgress?: (message: string) => void
}): Promise<LojaOnlinePersonalizacao> {
  const { empresaId, model, design, print, preview, onProgress } = params
  const designId = crypto.randomUUID()
  const base = `${empresaId}/${designId}`

  onProgress?.('Enviando suas fotos…')
  const urlBySrc = new Map<string, string>()
  const assets: string[] = []
  for (const layer of design.layers) {
    if (layer.type !== 'image' || urlBySrc.has(layer.src)) continue
    const blob = await fetch(layer.src).then((r) => r.blob())
    const ext = EXT[blob.type] ?? 'jpg'
    const url = await upload(`${base}/fotos/${assets.length}.${ext}`, blob)
    urlBySrc.set(layer.src, url)
    assets.push(url)
  }

  onProgress?.('Enviando arquivo de impressão…')
  const [previewUrl, printUrl] = await Promise.all([
    upload(`${base}/previa.png`, preview),
    upload(`${base}/impressao.png`, print.blob),
  ])

  const designSalvo: Design = {
    ...design,
    layers: design.layers.map((l) => (l.type === 'image' ? { ...l, src: urlBySrc.get(l.src) ?? l.src } : l)),
  }

  const { error } = await supabase.from('loja_online_capa_designs').insert({
    id: designId,
    empresa_id: empresaId,
    produto_id: params.produtoId,
    produto_pai_id: params.produtoPaiId,
    modelo_id: model.id,
    modelo_nome: model.name,
    design_json: designSalvo,
    preview_url: previewUrl,
    print_url: printUrl,
    print_largura: print.width,
    print_altura: print.height,
    print_dpi: print.dpi,
    assets_json: assets,
  })
  // O item do pedido também guarda os links, então a compra segue mesmo se a tabela falhar.
  if (error) console.error('[capa-personalizada] registro da arte falhou', error)

  return {
    tipo: 'capa_celular',
    designId,
    modeloId: model.id,
    modeloNome: model.name,
    previewUrl,
    printUrl,
  }
}
