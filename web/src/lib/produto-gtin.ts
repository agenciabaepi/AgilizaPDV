/** Consulta de dados do produto pelo código de barras (GTIN/EAN), via /api/produtos/gtin (base Cosmos). */
import { WEB_SESSION_KEY } from './auth-session'

export type ProdutoGtin = {
  /** Base que encontrou o produto (ex.: "Open Food Facts", "UPCitemdb", "Cosmos"). */
  fonte?: string
  nome: string
  marca: string | null
  ncm: string | null
  ncm_descricao: string | null
  cest: string | null
  imagem: string | null
  imagem_data_url: string | null
  preco_medio: number | null
  peso_bruto: number | null
}

export type ResultadoGtin =
  | { status: 'encontrado'; codigo: string; produto: ProdutoGtin }
  | { status: 'nao_encontrado'; codigo: string }
  | { status: 'nao_configurado'; mensagem: string }
  | { status: 'erro'; mensagem: string }

/** Mesmo cabeçalho de sessão usado pela API fiscal (base64 do JSON da sessão, seguro para acentos). */
function sessionHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem(WEB_SESSION_KEY)
    if (!raw) return {}
    const bytes = new TextEncoder().encode(raw)
    let bin = ''
    bytes.forEach((b) => {
      bin += String.fromCharCode(b)
    })
    return { 'X-Agiliza-Session': btoa(bin) }
  } catch {
    return {}
  }
}

export async function buscarProdutoPorGtin(codigoBruto: string): Promise<ResultadoGtin> {
  const codigo = codigoBruto.replace(/\D/g, '')
  if (codigo.length < 8 || codigo.length > 14) {
    return { status: 'erro', mensagem: 'Código de barras inválido. Use EAN-8, EAN-13, UPC ou GTIN-14.' }
  }
  let res: Response
  try {
    res = await fetch(`/api/produtos/gtin?codigo=${encodeURIComponent(codigo)}`, { headers: sessionHeader() })
  } catch {
    return { status: 'erro', mensagem: 'Sem conexão para buscar os dados do produto.' }
  }
  const body = (await res.json().catch(() => null)) as
    | { ok?: boolean; encontrado?: boolean; configurado?: boolean; error?: string; produto?: ProdutoGtin }
    | null
  if (!body) return { status: 'erro', mensagem: `Resposta inválida do servidor (HTTP ${res.status}).` }
  if (body.configurado === false) return { status: 'nao_configurado', mensagem: body.error ?? 'Busca não configurada.' }
  if (!body.ok) return { status: 'erro', mensagem: body.error ?? 'Não foi possível buscar os dados do produto.' }
  if (!body.encontrado || !body.produto) return { status: 'nao_encontrado', codigo }
  return { status: 'encontrado', codigo, produto: body.produto }
}

/** Converte a foto (data URL) em arquivo, para passar pelo mesmo tratamento das fotos enviadas pelo usuário. */
export async function dataUrlParaArquivo(dataUrl: string, nome: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob()
  const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
  return new File([blob], `${nome}.${ext}`, { type: blob.type || 'image/jpeg' })
}
