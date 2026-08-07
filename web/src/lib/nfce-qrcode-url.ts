export type ParamsQRCodeNfce = {
  chave: string
  ambiente: 'homologacao' | 'producao'
  csc_id_nfce: string
  csc_nfce: string
}

const URL_QRCODE_SP = 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx'

async function sha1Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function buildNfceQRCodeUrl(params: ParamsQRCodeNfce | null): Promise<string | null> {
  if (!params?.chave?.trim() || !params.csc_nfce?.trim()) return null
  const chave = params.chave.replace(/\s/g, '').replace(/^NFe/i, '')
  if (chave.length !== 44) return null
  const tpAmb = params.ambiente === 'producao' ? 1 : 2
  const idCsc = String(parseInt(params.csc_id_nfce, 10) || 1).replace(/^0+/, '') || '1'
  const csc = params.csc_nfce.trim()
  const baseString = `${chave}|2|${tpAmb}|${idCsc}`
  const hash = await sha1Hex(baseString + csc)
  return `${URL_QRCODE_SP}?p=${baseString}|${hash}`
}
