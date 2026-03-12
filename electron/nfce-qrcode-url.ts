/**
 * Gera a URL do QR Code da NFC-e no formato aceito pela SEFAZ (versão 2.0, emissão online).
 * Formato do parâmetro p: chave|2|tpAmb|idCsc|hash (hash = SHA-1 em hex de baseString + CSC).
 */

import { createHash } from 'crypto'

const URL_QRCODE_SP = 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx'

export type ParamsQRCodeNfce = {
  chave: string
  ambiente: 'homologacao' | 'producao'
  csc_id_nfce: string
  csc_nfce: string
}

/**
 * Retorna a URL completa para o QR Code da NFC-e (SP e demais UFs que usam o mesmo formato).
 * Se CSC não estiver configurado, retorna null.
 */
export function buildNfceQRCodeUrl(params: ParamsQRCodeNfce | null): string | null {
  if (!params?.chave?.trim() || !params.csc_nfce?.trim()) return null
  const chave = params.chave.replace(/\s/g, '').replace(/^NFe/i, '')
  if (chave.length !== 44) return null
  const tpAmb = params.ambiente === 'producao' ? 1 : 2
  const idCsc = String(parseInt(params.csc_id_nfce, 10) || 1).replace(/^0+/, '') || '1'
  const csc = params.csc_nfce.trim()
  const baseString = `${chave}|2|${tpAmb}|${idCsc}`
  const stringToHash = baseString + csc
  const hash = createHash('sha1').update(stringToHash, 'utf8').digest('hex')
  return `${URL_QRCODE_SP}?p=${baseString}|${hash}`
}
