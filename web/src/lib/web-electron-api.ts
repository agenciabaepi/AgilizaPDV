/**
 * Implementação da electronAPI usando Supabase diretamente para o modo web (browser).
 * Injeta window.electronAPI quando o app não está rodando dentro do Electron.
 */
import { supabase } from './supabase'
import { createTtlCache } from './ttl-cache'
import { invalidateLojaOnlineCatalogCache } from './loja-online-catalog-cache'
import {
  cupomToHtml,
  cupomNaoFiscalDocumentHtml,
  CUPOM_NAO_FISCAL_STYLES,
  reciboRecebimentoToHtml,
  type ReciboRecebimentoCupomData,
} from './cupom-html'
import { WEB_SESSION_KEY } from './auth-session'
import { hashSenhaWeb, verificarSenhaWeb } from './web-crypto'
import { encryptCertSenha } from './web-cert-crypto'
import { nfceCupomDocumentHtml, nfceCupomToHtml } from './nfce-cupom'
import { buildNfceQRCodeUrl } from './nfce-qrcode-url'
import { computeTributosAproxNfceCupom } from './nfce-tributos-cupom'
import { parseLojaOnlineLogoHeaderSize } from './loja-online-header'
import { normalizeLojaOnlineSlug, validateLojaOnlineSlug, normalizeLojaOnlineCustomDomain, validateLojaOnlineCustomDomain, lojaOnlineCustomDomainVariants } from './loja-online'
import { webPrintHtml, webPrintPdfDataUrl } from './web-print'
import {
  assertEmpresaConfigUpdateAllowed,
  assertUsuarioUpdateAllowed,
} from './empresa-dados-protegidos'
import { isValidCNPJ, isValidEmail, onlyDigits } from './validators'
import { defaultModulosRecord } from './modulos'
import type { ModuloId } from './modulos'
import type {
  Empresa,
  EmpresaConfig,
  EmpresaFiscalConfig,
  UpdateEmpresaConfigInput,
  UpdateFiscalConfigInput,
  Usuario,
  UsuarioSession,
  RegisterInput,
  AppSession,
  Produto,
  CreateProdutoInput,
  UpdateProdutoInput,
  Cliente,
  Fornecedor,
  FornecedorHistoricoItem,
  CreateFornecedorInput,
  UpdateFornecedorInput,
  Categoria,
  CategoriaTreeNode,
  Marca,
  EstoqueMovimento,
  ProdutoSaldo,
  RegistrarMovimentoInput,
  Caixa,
  CaixaMovimento,
  RegistrarMovimentoCaixaInput,
  CaixaResumoFechamento,
  Venda,
  VendaComNfce,
  VendaDetalhes,
  FinalizarVendaInput,
  NfceListItem,
  NfeListItem,
  NfeStatus,
  StatusNfce,
} from '../vite-env'

function saveSession(session: AppSession | null): void {
  if (session) {
    localStorage.setItem(WEB_SESSION_KEY, JSON.stringify(session))
  } else {
    localStorage.removeItem(WEB_SESSION_KEY)
  }
}

function loadSession(): AppSession | null {
  try {
    const raw = localStorage.getItem(WEB_SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AppSession
  } catch {
    return null
  }
}

function notSupported(name: string): never {
  throw new Error(`[web mode] ${name} não disponível no modo web.`)
}

function contribuicaoSaldoFromTipo(tipo: string, quantidade: number): number {
  switch (tipo) {
    case 'ENTRADA':
    case 'DEVOLUCAO':
      return quantidade
    case 'SAIDA':
      return -quantidade
    case 'AJUSTE':
      return quantidade
    default:
      return 0
  }
}

/** Nome do cliente em join `vendas → clientes` (Supabase pode devolver objeto ou array de 1). */
function webClienteNomeFromJoin(clientes: unknown): string | null {
  if (clientes == null) return null
  if (Array.isArray(clientes)) {
    const first = clientes[0] as { nome?: string } | undefined
    const n = first?.nome?.trim()
    return n || null
  }
  const n = (clientes as { nome?: string }).nome?.trim()
  return n || null
}

const WEB_IN_CHUNK = 100
const CERT_STORAGE_BUCKET = 'certificados'
const MAX_CERT_BYTES = 5 * 1024 * 1024

const FISCAL_DEFAULTS: EmpresaFiscalConfig = {
  ambiente: 'producao',
  serie_nfe: 1,
  ultimo_numero_nfe: 0,
  serie_nfce: 1,
  ultimo_numero_nfce: 0,
  csc_nfce: null,
  csc_id_nfce: null,
  indicar_fonte_ibpt: true,
  xml_autorizados: [],
  uf_emitente: 'SP',
  ie_emitente: 'ISENTO',
  c_mun_emitente: null,
  ncm_padrao: '21069090',
  tributo_aprox_federal_pct: 0,
  tributo_aprox_estadual_pct: 0,
  tributo_aprox_municipal_pct: 0,
}

type FiscalConfigRow = {
  ambiente_fiscal?: number | null
  serie_nfe?: number | null
  ultimo_numero_nfe?: number | null
  serie_nfce?: number | null
  ultimo_numero_nfce?: number | null
  csc_nfce?: string | null
  csc_id_nfce?: string | null
  indicar_fonte_ibpt?: number | null
  xml_autorizados_json?: string | null
  uf_emitente?: string | null
  ie_emitente?: string | null
  c_mun_emitente?: number | null
  ncm_padrao?: string | null
  tributo_aprox_federal_pct?: number | null
  tributo_aprox_estadual_pct?: number | null
  tributo_aprox_municipal_pct?: number | null
}

function rowToFiscalConfig(row: FiscalConfigRow | null | undefined): EmpresaFiscalConfig {
  if (!row) return { ...FISCAL_DEFAULTS }
  let xml_autorizados: string[] = []
  if (row.xml_autorizados_json?.trim()) {
    try {
      const parsed = JSON.parse(row.xml_autorizados_json) as unknown
      xml_autorizados = Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      xml_autorizados = []
    }
  }
  return {
    ambiente: row.ambiente_fiscal === 0 ? 'homologacao' : 'producao',
    serie_nfe: row.serie_nfe ?? FISCAL_DEFAULTS.serie_nfe,
    ultimo_numero_nfe: row.ultimo_numero_nfe ?? FISCAL_DEFAULTS.ultimo_numero_nfe,
    serie_nfce: row.serie_nfce ?? FISCAL_DEFAULTS.serie_nfce,
    ultimo_numero_nfce: row.ultimo_numero_nfce ?? FISCAL_DEFAULTS.ultimo_numero_nfce,
    csc_nfce: row.csc_nfce?.trim() || null,
    csc_id_nfce: row.csc_id_nfce?.trim() || null,
    indicar_fonte_ibpt: row.indicar_fonte_ibpt !== 0,
    xml_autorizados,
    uf_emitente: (row.uf_emitente?.trim() || FISCAL_DEFAULTS.uf_emitente).toUpperCase().slice(0, 2),
    ie_emitente: row.ie_emitente?.trim() || FISCAL_DEFAULTS.ie_emitente,
    c_mun_emitente: row.c_mun_emitente != null ? row.c_mun_emitente : FISCAL_DEFAULTS.c_mun_emitente,
    ncm_padrao: row.ncm_padrao?.trim() || FISCAL_DEFAULTS.ncm_padrao,
    tributo_aprox_federal_pct: row.tributo_aprox_federal_pct ?? 0,
    tributo_aprox_estadual_pct: row.tributo_aprox_estadual_pct ?? 0,
    tributo_aprox_municipal_pct: row.tributo_aprox_municipal_pct ?? 0,
  }
}

function fiscalInputToRowUpdate(
  d: UpdateFiscalConfigInput,
  current: EmpresaFiscalConfig
): Record<string, unknown> {
  const ambiente = d.ambiente ?? current.ambiente
  const xml_autorizados = d.xml_autorizados ?? current.xml_autorizados
  return {
    ambiente_fiscal: ambiente === 'homologacao' ? 0 : 1,
    serie_nfe: d.serie_nfe ?? current.serie_nfe,
    ultimo_numero_nfe: d.ultimo_numero_nfe ?? current.ultimo_numero_nfe,
    serie_nfce: d.serie_nfce ?? current.serie_nfce,
    ultimo_numero_nfce: d.ultimo_numero_nfce ?? current.ultimo_numero_nfce,
    csc_nfce: d.csc_nfce !== undefined ? d.csc_nfce?.trim() || null : current.csc_nfce,
    csc_id_nfce: d.csc_id_nfce !== undefined ? d.csc_id_nfce?.trim() || null : current.csc_id_nfce,
    indicar_fonte_ibpt: (d.indicar_fonte_ibpt ?? current.indicar_fonte_ibpt) ? 1 : 0,
    xml_autorizados_json: JSON.stringify(Array.isArray(xml_autorizados) ? xml_autorizados : []),
    uf_emitente: (d.uf_emitente ?? current.uf_emitente)?.trim()?.toUpperCase()?.slice(0, 2) || 'SP',
    ie_emitente: (d.ie_emitente ?? current.ie_emitente)?.trim() || 'ISENTO',
    c_mun_emitente: d.c_mun_emitente !== undefined ? d.c_mun_emitente : current.c_mun_emitente,
    ncm_padrao: d.ncm_padrao !== undefined ? d.ncm_padrao?.trim() || null : current.ncm_padrao,
    tributo_aprox_federal_pct: d.tributo_aprox_federal_pct ?? current.tributo_aprox_federal_pct,
    tributo_aprox_estadual_pct: d.tributo_aprox_estadual_pct ?? current.tributo_aprox_estadual_pct,
    tributo_aprox_municipal_pct: d.tributo_aprox_municipal_pct ?? current.tributo_aprox_municipal_pct,
    updated_at: new Date().toISOString(),
  }
}

function certStoragePath(empresaId: string): string {
  return `${empresaId}/certificado.pfx`
}

async function fetchFiscalConfig(empresaId: string): Promise<EmpresaFiscalConfig | null> {
  const { data, error } = await supabase
    .from('empresas_config')
    .select(
      'ambiente_fiscal, serie_nfe, ultimo_numero_nfe, serie_nfce, ultimo_numero_nfce, csc_nfce, csc_id_nfce, indicar_fonte_ibpt, xml_autorizados_json, uf_emitente, ie_emitente, c_mun_emitente, ncm_padrao, tributo_aprox_federal_pct, tributo_aprox_estadual_pct, tributo_aprox_municipal_pct'
    )
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (error) throw error
  return rowToFiscalConfig(data as FiscalConfigRow | null)
}

function isCertTableMissingError(message: string): boolean {
  return message.includes('empresa_certificado') && (message.includes('PGRST205') || message.includes('does not exist'))
}

function isCertBucketMissingError(message: string): boolean {
  return message.includes('Bucket not found') || message.includes('certificados')
}

const SKU_PRODUTO_NFE_AVULSA = '__AGILIZA_NFE_AVULSA__'
const NFE_DANFE_BUCKET = 'nfe-danfe'
const NFCE_XML_BUCKET = 'nfce-xml'

function fiscalSessionHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem(WEB_SESSION_KEY)
    if (!raw) return {}
    return { 'X-Agiliza-Session': btoa(raw) }
  } catch {
    return {}
  }
}

async function fiscalApiPost<T extends { ok: boolean; error?: string }>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`/api/fiscal/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...fiscalSessionHeaders() },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!text.trim()) {
    return {
      ok: false,
      error:
        res.status === 404
          ? 'API fiscal não encontrada. Reinicie o servidor de desenvolvimento ou use o app em produção.'
          : `Servidor fiscal retornou resposta vazia (HTTP ${res.status}).`,
    } as T
  }
  try {
    return JSON.parse(text) as T
  } catch {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 120)
    const fromVercel = snippet.includes('FUNCTION_INVOCATION_FAILED')
    return {
      ok: false,
      error: fromVercel
        ? 'Erro interno na API fiscal. Verifique certificado, CSC e configuração fiscal.'
        : `Resposta inválida do servidor fiscal: ${snippet}`,
    } as T
  }
}

function bufferToDataUrl(buf: ArrayBuffer, mime: string): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${mime};base64,${btoa(binary)}`
}

async function webGetStatusNfce(vendaId: string): Promise<StatusNfce | null> {
  const { data, error } = await supabase
    .from('venda_nfce')
    .select('numero_nfce, status, chave, protocolo, mensagem_sefaz, xml_supabase_path')
    .eq('venda_id', vendaId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    return {
      emitida: false,
      status: null,
      chave: null,
      protocolo: null,
      numero_nfce: null,
      mensagem: null,
      xml_local_path: null,
    }
  }
  return {
    emitida: data.status === 'AUTORIZADA',
    status: data.status as StatusNfce['status'],
    chave: data.chave ?? null,
    protocolo: data.protocolo ?? null,
    numero_nfce: data.numero_nfce ?? null,
    mensagem: data.mensagem_sefaz ?? null,
    xml_local_path: data.xml_supabase_path ?? null,
  }
}

async function webBuildNfceCupomHtml(vendaId: string): Promise<string | null> {
  const detalhes = await webGetVendaDetalhes(vendaId)
  if (!detalhes) return null
  const status = await webGetStatusNfce(vendaId)
  if (!status?.emitida) return null

  const empresaId = detalhes.venda.empresa_id
  const [{ data: empresa }, { data: config }, fiscal] = await Promise.all([
    supabase.from('empresas').select('id, nome, cnpj').eq('id', empresaId).maybeSingle(),
    supabase.from('empresas_config').select('razao_social, endereco').eq('empresa_id', empresaId).maybeSingle(),
    fetchFiscalConfig(empresaId),
  ])

  const empresaParaCupom = empresa
    ? {
        nome: empresa.nome,
        razao_social: config?.razao_social ?? empresa.nome,
        endereco: config?.endereco ?? null,
        cnpj: empresa.cnpj,
        ie_emitente: fiscal?.ie_emitente,
      }
    : null

  let qrCodeDataUrl: string | undefined
  if (status.chave && fiscal?.csc_nfce && fiscal.csc_id_nfce) {
    const consultaUrl = await buildNfceQRCodeUrl({
      chave: status.chave,
      ambiente: fiscal.ambiente,
      csc_id_nfce: fiscal.csc_id_nfce,
      csc_nfce: fiscal.csc_nfce,
    })
    if (consultaUrl) {
      try {
        const QRCode = await import('qrcode')
        qrCodeDataUrl = await QRCode.toDataURL(consultaUrl, { width: 200, margin: 1 })
      } catch {
        qrCodeDataUrl = undefined
      }
    }
  }

  const tributosAprox =
    fiscal != null
      ? computeTributosAproxNfceCupom(detalhes, fiscal, {
          usarExemploQuandoGlobalZero: !!(
            fiscal.indicar_fonte_ibpt &&
            (Number(fiscal.tributo_aprox_federal_pct) || 0) +
              (Number(fiscal.tributo_aprox_estadual_pct) || 0) +
              (Number(fiscal.tributo_aprox_municipal_pct) || 0) <=
              0
          ),
        })
      : undefined

  const html = nfceCupomToHtml(detalhes, status, empresaParaCupom, {
    indicar_fonte_ibpt: fiscal?.indicar_fonte_ibpt ?? false,
    qrCodeDataUrl,
    tributosAprox,
  })
  return nfceCupomDocumentHtml(html)
}

async function webGetDanfePdfDataUrl(vendaId: string): Promise<{ ok: boolean; dataUrl?: string; error?: string }> {
  const { data: venda } = await supabase.from('vendas').select('empresa_id').eq('id', vendaId).maybeSingle()
  const { data: nfe } = await supabase.from('venda_nfe').select('chave, status').eq('venda_id', vendaId).maybeSingle()
  if (!venda || !nfe?.chave || nfe.status !== 'AUTORIZADA') {
    return { ok: false, error: 'NF-e não autorizada para esta venda.' }
  }
  const path = `${venda.empresa_id}/${nfe.chave}.pdf`
  const { data, error } = await supabase.storage.from(NFE_DANFE_BUCKET).download(path)
  if (error || !data) return { ok: false, error: 'DANFE não encontrado. Tente reemitir ou aguarde a geração.' }
  return { ok: true, dataUrl: bufferToDataUrl(await data.arrayBuffer(), 'application/pdf') }
}

async function webGerarNfceDanfeA4(vendaId: string): Promise<{ ok: boolean; error?: string }> {
  const detalhes = await webGetVendaDetalhes(vendaId)
  if (!detalhes) return { ok: false, error: 'Venda não encontrada.' }
  const status = await webGetStatusNfce(vendaId)
  if (!status?.emitida || !status.chave) {
    return { ok: false, error: 'NFC-e não autorizada para esta venda.' }
  }

  const empresaId = detalhes.venda.empresa_id
  const [{ data: empresa }, { data: config }] = await Promise.all([
    supabase.from('empresas').select('nome, cnpj').eq('id', empresaId).maybeSingle(),
    supabase.from('empresas_config').select('razao_social').eq('empresa_id', empresaId).maybeSingle(),
  ])

  const emitente = config?.razao_social ?? empresa?.nome ?? detalhes.empresa_nome ?? '-'
  const cnpj = empresa?.cnpj ?? '-'
  const dataHora = new Date(detalhes.venda.created_at).toLocaleString('pt-BR')
  const chaveFmt = status.chave.replace(/(.{4})/g, '$1 ').trim()

  const itensRows = detalhes.itens
    .map(
      (i, idx) =>
        `<tr>
           <td>${idx + 1}</td>
           <td>${i.descricao}</td>
           <td style="text-align:right;">${i.quantidade}</td>
           <td style="text-align:right;">${(i.total / (i.quantidade || 1)).toFixed(2)}</td>
           <td style="text-align:right;">${i.total.toFixed(2)}</td>
         </tr>`
    )
    .join('')

  const pagRows = detalhes.pagamentos
    .map(
      (p) =>
        `<tr>
           <td>${p.forma}</td>
           <td style="text-align:right;">${p.valor.toFixed(2)}</td>
         </tr>`
    )
    .join('')

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>DANFE NFC-e</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 16px; }
      .danfe-container { width: 800px; margin: 0 auto; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      h2 { font-size: 14px; margin: 8px 0 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #999; padding: 4px; }
      th { background: #f5f5f5; }
      .totais { margin-top: 8px; float: right; width: 260px; }
    </style>
  </head>
  <body>
    <div class="danfe-container">
      <h1>DANFE NFC-e (A4 simplificada)</h1>
      <div><strong>Emitente:</strong> ${emitente}</div>
      <div><strong>CNPJ:</strong> ${cnpj}</div>
      <div><strong>Data/Hora:</strong> ${dataHora}</div>
      <div><strong>Chave de acesso:</strong> ${chaveFmt}</div>
      ${status.protocolo ? `<div><strong>Protocolo:</strong> ${status.protocolo}</div>` : ''}
      <h2>Produtos</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Descrição</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr>
        </thead>
        <tbody>${itensRows}</tbody>
      </table>
      <h2>Pagamentos</h2>
      <table>
        <thead><tr><th>Forma</th><th>Valor</th></tr></thead>
        <tbody>${pagRows}</tbody>
      </table>
      <div class="totais">
        <table>
          <tr><td><strong>Total</strong></td><td style="text-align:right;"><strong>${Number(detalhes.venda.total).toFixed(2)}</strong></td></tr>
        </table>
      </div>
    </div>
  </body>
</html>`

  return webPrintHtml(html)
}

async function webExportNfceXmlZip(
  empresaId: string,
  vendaIds: string[]
): Promise<{ ok: boolean; count?: number; error?: string }> {
  if (!Array.isArray(vendaIds) || vendaIds.length === 0) {
    return { ok: false, error: 'Nenhuma NFC-e selecionada.' }
  }

  const rows = await supabaseSelectInChunks<{
    venda_id: string
    chave: string | null
    xml_supabase_path: string | null
    status: string
  }>(
    'venda_nfce',
    'venda_id, chave, xml_supabase_path, status',
    'venda_id',
    vendaIds,
    (q) => q.eq('status', 'AUTORIZADA')
  )

  const withXml = rows.filter((r) => r.xml_supabase_path)
  if (withXml.length === 0) {
    return { ok: false, error: 'Nenhum XML autorizado encontrado para as NFC-e selecionadas.' }
  }

  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  let added = 0

  for (const row of withXml) {
    const path = row.xml_supabase_path!
    if (!path.startsWith(`${empresaId}/`)) continue
    const { data, error } = await supabase.storage.from(NFCE_XML_BUCKET).download(path)
    if (error || !data) continue
    const xmlContent = await data.text()
    const fileName =
      row.chave && row.chave.length >= 44 ? `${row.chave}.xml` : `${row.venda_id}.xml`
    zip.file(fileName, xmlContent)
    added++
  }

  if (added === 0) {
    return { ok: false, error: 'Não foi possível baixar os XMLs do armazenamento.' }
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nfce-xml-${new Date().toISOString().slice(0, 10)}.zip`
  a.click()
  URL.revokeObjectURL(url)
  return { ok: true, count: added }
}

async function supabaseSelectInChunks<T>(
  table: string,
  selectFields: string,
  inColumn: string,
  ids: string[],
  extra?: (q: ReturnType<(typeof supabase)['from']>) => ReturnType<(typeof supabase)['from']>
): Promise<T[]> {
  if (ids.length === 0) return []
  const acc: T[] = []
  for (let i = 0; i < ids.length; i += WEB_IN_CHUNK) {
    const slice = ids.slice(i, i + WEB_IN_CHUNK)
    let q = supabase.from(table).select(selectFields).in(inColumn, slice)
    if (extra) q = extra(q)
    const { data, error } = await q
    if (error) return []
    acc.push(...((data ?? []) as T[]))
  }
  return acc
}

/** Saldo = soma dos movimentos (igual ao backend local). */
async function getSaldoProdutoFromMovimentos(empresaId: string, produtoId: string): Promise<number> {
  const { data, error } = await supabase
    .from('estoque_movimentos')
    .select('tipo, quantidade')
    .eq('empresa_id', empresaId)
    .eq('produto_id', produtoId)
  if (error) throw error
  let acc = 0
  for (const row of data ?? []) {
    const r = row as { tipo?: string; quantidade?: unknown }
    const q = Number(r.quantidade)
    if (!Number.isFinite(q)) continue
    acc += contribuicaoSaldoFromTipo(String(r.tipo ?? ''), q)
  }
  return acc
}

async function webAjustarSaldoPara(empresaId: string, produtoId: string, novoSaldo: number): Promise<void> {
  const saldoAtual = await getSaldoProdutoFromMovimentos(empresaId, produtoId)
  const delta = novoSaldo - saldoAtual
  if (delta === 0) return

  const session = loadSession()
  const { error } = await supabase.from('estoque_movimentos').insert({
    id: crypto.randomUUID(),
    empresa_id: empresaId,
    produto_id: produtoId,
    tipo: 'AJUSTE',
    quantidade: delta,
    usuario_id: session && 'id' in session ? session.id : null,
    created_at: new Date().toISOString(),
  })
  if (error) throw error

  const up = await supabase
    .from('produtos')
    .update({ estoque_atual: novoSaldo })
    .eq('id', produtoId)
    .eq('empresa_id', empresaId)
  if (up.error) throw up.error
  invalidateLojaOnlineCatalogCache(empresaId)
}

async function supabaseSelectUsuarios(
  applyFilters: (query: ReturnType<(typeof supabase)['from']>) => ReturnType<(typeof supabase)['from']>,
  includeSenhaHash = false
): Promise<Record<string, unknown>[]> {
  const authExtra = includeSenhaHash ? ', senha_hash' : ''
  const selectVariants = [
    `id, empresa_id, nome, login, email, role, modulos_json, created_at, comissao_percentual, meta_vendas_mes${authExtra}`,
    `id, empresa_id, nome, login, email, role, modulos_json, created_at${authExtra}`,
    `id, empresa_id, nome, login, role, modulos_json, created_at${authExtra}`,
    `id, empresa_id, nome, login, email, role, created_at${authExtra}`,
    `id, empresa_id, nome, login, role, created_at${authExtra}`,
  ]

  let lastError: { message: string } | null = null
  for (const selectFields of selectVariants) {
    const query = applyFilters(supabase.from('usuarios').select(selectFields))
    const { data, error } = await query
    if (!error) return (data ?? []) as Record<string, unknown>[]
    lastError = error
    const msg = error.message ?? ''
    if (!msg.includes('email') && !msg.includes('modulos_json') && !msg.includes('comissao') && !msg.includes('meta_vendas')) break
  }
  throw new Error(`Falha ao consultar usuarios no Supabase: ${lastError?.message ?? 'erro desconhecido'}`)
}

async function selectUsuariosByEmailOrLogin(normalizedEmail: string): Promise<Record<string, unknown>[]> {
  const byEmail = await supabaseSelectUsuarios(
    (q) => q.ilike('email', normalizedEmail),
    true
  ).catch((err) => {
    const msg = String(err instanceof Error ? err.message : err)
    if (msg.includes('email')) return [] as Record<string, unknown>[]
    throw err
  })
  if (byEmail.length > 0) return byEmail

  return supabaseSelectUsuarios((q) => q.ilike('login', normalizedEmail), true)
}

async function selectUsuariosByEmpresa(empresaId: string): Promise<Record<string, unknown>[]> {
  return supabaseSelectUsuarios((q) => q.eq('empresa_id', empresaId).order('nome'))
}

async function selectUsuarioById(id: string): Promise<Record<string, unknown> | null> {
  const rows = await supabaseSelectUsuarios((q) => q.eq('id', id).limit(1))
  return rows[0] ?? null
}

function mapUsuarioRow(row: Record<string, unknown>): Usuario {
  return {
    id: row.id as string,
    empresa_id: row.empresa_id as string,
    nome: row.nome as string,
    login: row.login as string,
    email: (row.email as string | null) ?? null,
    role: row.role as string,
    modulos_json: (row.modulos_json as string | null) ?? null,
    comissao_percentual: row.comissao_percentual != null ? Number(row.comissao_percentual) : null,
    meta_vendas_mes: row.meta_vendas_mes != null ? Number(row.meta_vendas_mes) : null,
    created_at: String(row.created_at ?? ''),
  }
}

function rowToUsuarioSession(row: Record<string, unknown>): UsuarioSession {
  return {
    id: row.id as string,
    empresa_id: row.empresa_id as string,
    nome: row.nome as string,
    login: row.login as string,
    email: (row.email as string | null) ?? null,
    role: row.role as string,
    modulos_json: (row.modulos_json as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
  }
}

async function authenticateByEmail(email: string, senha: string): Promise<UsuarioSession> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) throw new Error('Informe o e-mail.')

  const candidateRows = await selectUsuariosByEmailOrLogin(normalizedEmail)
  const rowsByEmail = candidateRows.filter((r) => {
    const dbEmail = String(r.email ?? '').trim().toLowerCase()
    const dbLogin = String(r.login ?? '').trim().toLowerCase()
    return dbEmail === normalizedEmail || dbLogin === normalizedEmail
  })
  if (rowsByEmail.length === 0) throw new Error('E-mail não encontrado.')

  let row: Record<string, unknown> | null = null
  for (const candidate of rowsByEmail) {
    const senhaHash = candidate.senha_hash as string | null
    if (!senhaHash) continue
    const ok = await verificarSenhaWeb(senha, senhaHash)
    if (ok) {
      row = candidate
      break
    }
  }
  if (!row) throw new Error('Senha inválida.')
  return rowToUsuarioSession(row)
}

function buildCategoriaTree(categorias: Categoria[]): CategoriaTreeNode[] {
  const map = new Map<string, CategoriaTreeNode>()
  for (const cat of categorias) {
    map.set(cat.id, { ...cat, children: [] })
  }
  const roots: CategoriaTreeNode[] = []
  for (const node of map.values()) {
    if (node.parent_id) {
      const parent = map.get(node.parent_id)
      if (parent) parent.children.push(node)
      else roots.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

async function webGetMaxProdutoCodigo(empresaId: string): Promise<number> {
  const { data, error } = await supabase
    .from('produtos')
    .select('codigo')
    .eq('empresa_id', empresaId)
    .not('codigo', 'is', null)
    .order('codigo', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  const n = data?.codigo
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

async function webNextProdutoCodigo(empresaId: string): Promise<number> {
  return (await webGetMaxProdutoCodigo(empresaId)) + 1
}

/** Atribui código sequencial a produtos legados criados sem `codigo`. */
async function webBackfillProdutosCodigo(empresaId: string, produtos: Produto[]): Promise<Produto[]> {
  const semCodigo = produtos
    .filter((p) => p.codigo == null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  if (semCodigo.length === 0) return produtos

  let next = await webNextProdutoCodigo(empresaId)
  const assigned = new Map<string, number>()
  for (const p of semCodigo) {
    assigned.set(p.id, next)
    const { error } = await supabase.from('produtos').update({ codigo: next }).eq('id', p.id)
    if (error) throw error
    next += 1
  }
  return produtos.map((p) => (assigned.has(p.id) ? { ...p, codigo: assigned.get(p.id)! } : p))
}

function rowToVenda(r: Record<string, unknown>): Venda {
  return {
    id: r.id as string,
    empresa_id: r.empresa_id as string,
    caixa_id: r.caixa_id as string,
    usuario_id: r.usuario_id as string,
    cliente_id: (r.cliente_id as string | null) ?? null,
    numero: Number(r.numero),
    status: r.status as string,
    subtotal: Number(r.subtotal),
    desconto_total: Number(r.desconto_total),
    total: Number(r.total),
    troco: Number(r.troco),
    cashback_gerado: Number(r.cashback_gerado) || 0,
    cashback_usado: Number(r.cashback_usado) || 0,
    created_at: r.created_at as string,
    venda_a_prazo: Number(r.venda_a_prazo) === 1 ? 1 : 0,
    data_vencimento: (r.data_vencimento as string | null) ?? null,
    venda_online: Number(r.venda_online) === 1 ? 1 : 0,
  }
}

const PRODUTOS_LIST_TTL_MS = 90_000
const PRODUTOS_SESSION_TTL_MS = 120_000
const PRODUTOS_SESSION_PREFIX = 'agiliza.produtos.catalogo.v1.'

const produtosListCache = createTtlCache<Produto[]>(PRODUTOS_LIST_TTL_MS)
const produtoImagemCache = new Map<string, { at: number; data: string | null }>()

const PRODUTO_SELECT_SLIM =
  'id, empresa_id, codigo, nome, sku, codigo_barras, preco, unidade, ativo, controla_estoque, estoque_minimo, categoria_id, marca_id, fornecedor_id'

const PRODUTO_SELECT_CADASTRO =
  'id, empresa_id, codigo, nome, sku, codigo_barras, fornecedor_id, categoria_id, marca_id, descricao, custo, markup, preco, unidade, controla_estoque, estoque_minimo, ativo, loja_online, loja_online_destaque, loja_online_destaque_ordem, ncm, cfop, cashback_ativo, cashback_percentual, permitir_resgate_cashback_no_produto, cashback_observacao, created_at, updated_at'

const PRODUTO_SELECT_CADASTRO_LEGACY =
  'id, empresa_id, codigo, nome, sku, codigo_barras, fornecedor_id, categoria_id, marca_id, descricao, custo, markup, preco, unidade, controla_estoque, estoque_minimo, ativo, ncm, cfop, created_at, updated_at'

type ProdutoCadastroSelect = 'cadastro' | 'legacy'
let produtoCadastroSelect: ProdutoCadastroSelect | null = null

function isMissingColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    msg.includes('does not exist') ||
    (msg.includes('column') && msg.includes('schema'))
  )
}

function produtosListCacheKey(
  empresaId: string,
  options?: { apenasAtivos?: boolean; completo?: boolean }
): string {
  return `${empresaId}:${options?.apenasAtivos ? '1' : '0'}:${options?.completo ? 'c' : 's'}`
}

function produtosSessionKey(empresaId: string): string {
  return `${PRODUTOS_SESSION_PREFIX}${empresaId}`
}

function readProdutosSessionCatalog(empresaId: string): Produto[] | null {
  try {
    const raw = sessionStorage.getItem(produtosSessionKey(empresaId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at?: number; data?: Produto[] }
    if (!parsed?.at || !Array.isArray(parsed.data)) return null
    if (Date.now() - parsed.at >= PRODUTOS_SESSION_TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeProdutosSessionCatalog(empresaId: string, data: Produto[]) {
  try {
    sessionStorage.setItem(produtosSessionKey(empresaId), JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* quota / private mode */
  }
}

function clearProdutosSessionCatalog(empresaId?: string) {
  try {
    if (empresaId) {
      sessionStorage.removeItem(produtosSessionKey(empresaId))
      return
    }
    const toRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(PRODUTOS_SESSION_PREFIX)) toRemove.push(key)
    }
    for (const key of toRemove) sessionStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export function invalidateProdutosCaches(empresaId?: string) {
  produtosListCache.invalidate(empresaId)
  clearProdutosSessionCatalog(empresaId)
  if (!empresaId) produtoImagemCache.clear()
  invalidateLojaOnlineCatalogCache(empresaId)
}

export function peekProdutosCatalogo(empresaId: string): Produto[] | null {
  const key = produtosListCacheKey(empresaId, { apenasAtivos: true })
  return produtosListCache.peek(key) ?? readProdutosSessionCatalog(empresaId)
}

export function prefetchProdutosCatalogo(empresaId: string): void {
  if (!empresaId) return
  const key = produtosListCacheKey(empresaId, { apenasAtivos: true })
  void produtosListCache
    .get(key, () => listProdutosUncached(empresaId, { apenasAtivos: true }))
    .then((data) => writeProdutosSessionCatalog(empresaId, data))
    .catch(() => {})
}

if (typeof window !== 'undefined') {
  window.addEventListener('agiliza:syncDataUpdated', () => invalidateProdutosCaches())
}

const PRODUTO_CAMPOS_TEXTO_NULO = new Set([
  'sku',
  'codigo_barras',
  'fornecedor_id',
  'marca_id',
  'categoria_id',
  'descricao',
  'imagem',
  'ncm',
  'cfop',
  'cashback_observacao',
  'loja_online_imagens_json',
])

function sanitizeProdutoWrite(d: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(d)) {
    if (value === undefined) continue
    if (PRODUTO_CAMPOS_TEXTO_NULO.has(key) && (value === null || (typeof value === 'string' && value.trim() === ''))) {
      out[key] = null
      continue
    }
    out[key] = value
  }
  return out
}

function rowToProduto(r: Record<string, unknown>): Produto {
  return {
    id: String(r.id),
    empresa_id: String(r.empresa_id),
    codigo: r.codigo != null ? Number(r.codigo) : null,
    nome: String(r.nome ?? ''),
    sku: (r.sku as string | null) ?? null,
    codigo_barras: (r.codigo_barras as string | null) ?? null,
    fornecedor_id: (r.fornecedor_id as string | null) ?? null,
    categoria_id: (r.categoria_id as string | null) ?? null,
    marca_id: (r.marca_id as string | null) ?? null,
    descricao: (r.descricao as string | null) ?? null,
    imagem: (r.imagem as string | null) ?? null,
    custo: Number(r.custo) || 0,
    markup: Number(r.markup) || 0,
    preco: Number(r.preco) || 0,
    unidade: String(r.unidade ?? 'UN'),
    controla_estoque: Number(r.controla_estoque) || 0,
    estoque_minimo: Number(r.estoque_minimo) || 0,
    ativo: Number(r.ativo) || 0,
    loja_online: r.loja_online != null ? Number(r.loja_online) : 1,
    loja_online_destaque: Number(r.loja_online_destaque) || 0,
    loja_online_destaque_ordem: Number(r.loja_online_destaque_ordem) || 0,
    loja_online_imagens_json: (r.loja_online_imagens_json as string | null) ?? null,
    ncm: (r.ncm as string | null) ?? null,
    cfop: (r.cfop as string | null) ?? null,
    cashback_ativo: Number(r.cashback_ativo) || 0,
    cashback_percentual: r.cashback_percentual != null ? Number(r.cashback_percentual) : null,
    permitir_resgate_cashback_no_produto: Number(r.permitir_resgate_cashback_no_produto) || 0,
    cashback_observacao: (r.cashback_observacao as string | null) ?? null,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

type ListProdutosOptions = {
  search?: string
  apenasAtivos?: boolean
  ordenarPorMaisVendidos?: boolean
  completo?: boolean
  comImagem?: boolean
  limit?: number
}

function canCacheProdutosList(options?: ListProdutosOptions): boolean {
  return !options?.search?.trim() && !options?.ordenarPorMaisVendidos && !options?.limit && !options?.comImagem
}

async function queryProdutosRows(
  empresaId: string,
  select: string,
  options?: ListProdutosOptions
) {
  let query = supabase.from('produtos').select(select as '*').eq('empresa_id', empresaId)
  if (options?.apenasAtivos) query = query.eq('ativo', 1)
  if (options?.search?.trim()) {
    const term = options.search.trim()
    query = query.or(`nome.ilike.%${term}%,sku.ilike.%${term}%,codigo_barras.ilike.%${term}%`)
  }
  if (options?.limit) query = query.limit(options.limit)
  return query.order('nome')
}

async function listProdutosUncached(empresaId: string, options?: ListProdutosOptions): Promise<Produto[]> {
  let data: unknown[] | null = null
  let error: { message?: string; code?: string } | null = null

  if (options?.comImagem) {
    const result = await queryProdutosRows(empresaId, '*', options)
    data = result.data
    error = result.error
  } else if (options?.completo) {
    const modes: ProdutoCadastroSelect[] = produtoCadastroSelect ? [produtoCadastroSelect] : ['cadastro', 'legacy']
    for (const mode of modes) {
      const select = mode === 'cadastro' ? PRODUTO_SELECT_CADASTRO : PRODUTO_SELECT_CADASTRO_LEGACY
      const result = await queryProdutosRows(empresaId, select, options)
      if (!result.error) {
        produtoCadastroSelect = mode
        data = result.data
        error = null
        break
      }
      error = result.error
      if (!isMissingColumnError(result.error)) break
      produtoCadastroSelect = null
    }
  } else {
    const result = await queryProdutosRows(empresaId, PRODUTO_SELECT_SLIM, options)
    data = result.data
    error = result.error
  }

  if (error) throw error
  let produtos = (data ?? []).map((r) => rowToProduto(r as Record<string, unknown>))

  if (options?.ordenarPorMaisVendidos && produtos.length > 0) {
    const { data: vendas } = await supabase
      .from('vendas')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('status', 'CONCLUIDA')
    const qtyMap = new Map<string, number>()
    const vendaIds = (vendas ?? []).map((v) => String(v.id))
    for (let i = 0; i < vendaIds.length; i += 200) {
      const chunk = vendaIds.slice(i, i + 200)
      const { data: itens } = await supabase
        .from('venda_itens')
        .select('produto_id, quantidade')
        .in('venda_id', chunk)
      for (const item of itens ?? []) {
        if (!item.produto_id) continue
        const pid = String(item.produto_id)
        qtyMap.set(pid, (qtyMap.get(pid) ?? 0) + Number(item.quantidade))
      }
    }
    produtos = [...produtos].sort((a, b) => {
      const qa = qtyMap.get(a.id) ?? 0
      const qb = qtyMap.get(b.id) ?? 0
      if (qb !== qa) return qb - qa
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }

  if (options?.completo || options?.comImagem) {
    produtos = await webBackfillProdutosCodigo(empresaId, produtos)
  }

  return produtos
}

async function webNextNumeroVenda(empresaId: string): Promise<number> {
  const { data, error } = await supabase
    .from('vendas')
    .select('numero')
    .eq('empresa_id', empresaId)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  const n = data?.numero
  return typeof n === 'number' && Number.isFinite(n) ? n + 1 : 1
}

async function webRegistrarSaidaEstoque(params: {
  empresa_id: string
  produto_id: string
  quantidade: number
  custo_unitario: number
  venda_id: string
  usuario_id: string
}): Promise<void> {
  const { error } = await supabase.from('estoque_movimentos').insert({
    id: crypto.randomUUID(),
    empresa_id: params.empresa_id,
    produto_id: params.produto_id,
    tipo: 'SAIDA',
    quantidade: params.quantidade,
    custo_unitario: params.custo_unitario,
    referencia_tipo: 'VENDA',
    referencia_id: params.venda_id,
    usuario_id: params.usuario_id,
    created_at: new Date().toISOString(),
  })
  if (error) throw error
  const novoSaldo = await getSaldoProdutoFromMovimentos(params.empresa_id, params.produto_id)
  const { error: upErr } = await supabase
    .from('produtos')
    .update({ estoque_atual: novoSaldo })
    .eq('id', params.produto_id)
    .eq('empresa_id', params.empresa_id)
  if (upErr) throw upErr
}

async function webGetVendaPrazoConfig(empresaId: string): Promise<{
  usar_limite_credito: boolean
  bloquear_inadimplente: boolean
}> {
  const { data, error } = await supabase
    .from('empresas_config')
    .select('venda_prazo_usar_limite_credito, venda_prazo_bloquear_inadimplente')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (error) throw error
  return {
    usar_limite_credito: Number(data?.venda_prazo_usar_limite_credito) === 1,
    bloquear_inadimplente: Number(data?.venda_prazo_bloquear_inadimplente) === 1,
  }
}

type WebContaReceberRow = {
  id: string
  empresa_id: string
  venda_id: string
  cliente_id: string
  valor: number
  vencimento: string
  status: string
  recebido_em: string | null
  forma_recebimento: string | null
  cliente_nome: string
  venda_numero: number
  created_at: string
}

function parseContaVencimento(raw: unknown): string {
  if (raw == null) return ''
  const s = String(raw).trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : s.slice(0, 10)
}

function webNomeFromJoin(row: unknown): string {
  if (row == null) return '—'
  if (Array.isArray(row)) {
    const first = row[0] as { nome?: string } | undefined
    return first?.nome?.trim() || '—'
  }
  return (row as { nome?: string }).nome?.trim() || '—'
}

function webNumeroFromJoin(row: unknown): number {
  if (row == null) return 0
  if (Array.isArray(row)) {
    const first = row[0] as { numero?: number } | undefined
    return Number(first?.numero) || 0
  }
  return Number((row as { numero?: number }).numero) || 0
}

function webRowToContaReceber(r: Record<string, unknown>): WebContaReceberRow {
  return {
    id: String(r.id),
    empresa_id: String(r.empresa_id),
    venda_id: String(r.venda_id),
    cliente_id: String(r.cliente_id),
    valor: Number(r.valor) || 0,
    vencimento: parseContaVencimento(r.vencimento),
    status: String(r.status ?? 'PENDENTE'),
    recebido_em: r.recebido_em != null ? String(r.recebido_em) : null,
    forma_recebimento: r.forma_recebimento != null ? String(r.forma_recebimento) : null,
    cliente_nome: webNomeFromJoin(r.clientes),
    venda_numero: webNumeroFromJoin(r.vendas),
    created_at: String(r.created_at ?? ''),
  }
}

async function webUpdateVendaPrazoConfig(
  empresaId: string,
  data: Partial<{ usar_limite_credito: boolean; bloquear_inadimplente: boolean }>
): Promise<{ usar_limite_credito: boolean; bloquear_inadimplente: boolean }> {
  const cur = await webGetVendaPrazoConfig(empresaId)
  const usar = data.usar_limite_credito !== undefined ? data.usar_limite_credito : cur.usar_limite_credito
  const bloq = data.bloquear_inadimplente !== undefined ? data.bloquear_inadimplente : cur.bloquear_inadimplente
  const { error } = await supabase.from('empresas_config').upsert(
    {
      empresa_id: empresaId,
      venda_prazo_usar_limite_credito: usar ? 1 : 0,
      venda_prazo_bloquear_inadimplente: bloq ? 1 : 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'empresa_id' }
  )
  if (error) throw error
  return { usar_limite_credito: usar, bloquear_inadimplente: bloq }
}

async function webListContasReceber(
  empresaId: string,
  options?: {
    cliente_id?: string
    status?: string
    limit?: number
    vencimento_de?: string
    vencimento_ate?: string
  }
): Promise<WebContaReceberRow[]> {
  const limit = options?.limit != null ? Math.min(Math.max(options.limit, 1), 2000) : 500
  let query = supabase
    .from('contas_receber')
    .select('*, clientes(nome), vendas(numero)')
    .eq('empresa_id', empresaId)

  if (options?.cliente_id) query = query.eq('cliente_id', options.cliente_id)
  if (options?.status === 'aberto' || options?.status === 'PENDENTE') {
    query = query.eq('status', 'PENDENTE')
  } else if (options?.status && options.status !== 'todas') {
    query = query.eq('status', options.status)
  }
  if (options?.vencimento_de) query = query.gte('vencimento', options.vencimento_de)
  if (options?.vencimento_ate) query = query.lte('vencimento', options.vencimento_ate)

  if (options?.status === 'RECEBIDA') {
    query = query.order('recebido_em', { ascending: false })
  } else {
    query = query.order('vencimento', { ascending: true }).order('created_at', { ascending: false })
  }

  const { data, error } = await query.limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => webRowToContaReceber(r as Record<string, unknown>))
}

async function webGetTotalAbertoCliente(empresaId: string, clienteId: string): Promise<number> {
  const { data, error } = await supabase
    .from('contas_receber')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('cliente_id', clienteId)
    .eq('status', 'PENDENTE')
  if (error) throw error
  return (data ?? []).reduce((s, r) => s + Number((r as { valor: number }).valor), 0)
}

async function webListHistoricoPrazo(empresaId: string, clienteId: string) {
  const { data, error } = await supabase
    .from('vendas')
    .select('id, numero, total, data_vencimento, created_at, contas_receber(status, valor)')
    .eq('empresa_id', empresaId)
    .eq('cliente_id', clienteId)
    .eq('venda_a_prazo', 1)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const crRaw = r.contas_receber
    const cr = Array.isArray(crRaw) ? (crRaw[0] as Record<string, unknown> | undefined) : (crRaw as Record<string, unknown> | null)
    return {
      venda_id: String(r.id),
      numero: Number(r.numero) || 0,
      total: Number(r.total) || 0,
      data_vencimento: r.data_vencimento != null ? String(r.data_vencimento) : null,
      created_at: String(r.created_at ?? ''),
      conta_status: String(cr?.status ?? 'PENDENTE'),
      valor_conta: Number(cr?.valor) || Number(r.total) || 0,
    }
  })
}

async function webReceberConta(data: {
  conta_id: string
  empresa_id: string
  caixa_id: string
  usuario_id: string
  forma: string
}): Promise<WebContaReceberRow> {
  const { data: caixa, error: cxErr } = await supabase
    .from('caixas')
    .select('id, status, empresa_id')
    .eq('id', data.caixa_id)
    .maybeSingle()
  if (cxErr) throw cxErr
  if (!caixa || caixa.status !== 'ABERTO' || caixa.empresa_id !== data.empresa_id) {
    throw new Error('Recebimento deve ser feito no caixa aberto atual.')
  }

  const { data: conta, error: cErr } = await supabase
    .from('contas_receber')
    .select('*')
    .eq('id', data.conta_id)
    .maybeSingle()
  if (cErr) throw cErr
  if (!conta) throw new Error('Conta a receber não encontrada.')
  if (conta.empresa_id !== data.empresa_id) throw new Error('Conta não pertence à empresa.')
  if (conta.status !== 'PENDENTE') throw new Error('Esta conta já foi recebida ou cancelada.')

  const now = new Date().toISOString()
  const { data: updated, error: upErr } = await supabase
    .from('contas_receber')
    .update({
      status: 'RECEBIDA',
      recebido_em: now,
      recebimento_caixa_id: data.caixa_id,
      forma_recebimento: data.forma,
      usuario_recebimento_id: data.usuario_id,
    })
    .eq('id', data.conta_id)
    .select('*, clientes(nome), vendas(numero)')
    .single()
  if (upErr) throw upErr
  return webRowToContaReceber(updated as Record<string, unknown>)
}

async function webGetReciboRecebimentoCupomData(contaId: string): Promise<ReciboRecebimentoCupomData | null> {
  const { data: row, error } = await supabase
    .from('contas_receber')
    .select(
      'id, empresa_id, valor, forma_recebimento, recebido_em, status, clientes(nome, cpf_cnpj), vendas(numero), empresas(nome)'
    )
    .eq('id', contaId)
    .maybeSingle()
  if (error || !row || row.status !== 'RECEBIDA') return null
  const r = row as Record<string, unknown>
  const cli = Array.isArray(r.clientes) ? (r.clientes[0] as Record<string, unknown> | undefined) : (r.clientes as Record<string, unknown> | null)
  const ven = Array.isArray(r.vendas) ? (r.vendas[0] as Record<string, unknown> | undefined) : (r.vendas as Record<string, unknown> | null)
  const emp = Array.isArray(r.empresas) ? (r.empresas[0] as Record<string, unknown> | undefined) : (r.empresas as Record<string, unknown> | null)
  const doc = cli?.cpf_cnpj != null ? String(cli.cpf_cnpj).trim() || null : null
  return {
    empresa_id: String(r.empresa_id ?? ''),
    empresa_nome: String(emp?.nome ?? 'Empresa'),
    cliente_nome: String(cli?.nome ?? ''),
    cliente_doc: doc,
    venda_numero: Number(ven?.numero) || 0,
    valor: Number(r.valor) || 0,
    forma_recebimento: String(r.forma_recebimento ?? ''),
    recebido_em: String(r.recebido_em ?? ''),
    conta_id: String(r.id),
  }
}

async function webAssertPodeVenderAPrazo(
  empresaId: string,
  clienteId: string,
  valorNovaVenda: number
): Promise<void> {
  const cfg = await webGetVendaPrazoConfig(empresaId)
  const { data: cli, error: cliErr } = await supabase
    .from('clientes')
    .select('id, limite_credito')
    .eq('id', clienteId)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (cliErr) throw cliErr
  if (!cli) throw new Error('Cliente inválido.')

  if (cfg.bloquear_inadimplente) {
    const hoje = new Date().toISOString().slice(0, 10)
    const { data: inad, error: inadErr } = await supabase
      .from('contas_receber')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('cliente_id', clienteId)
      .eq('status', 'PENDENTE')
      .lt('vencimento', hoje)
      .limit(1)
    if (inadErr) throw inadErr
    if (inad && inad.length > 0) {
      throw new Error(
        'Cliente com parcelas vencidas em aberto. Quite ou receba os títulos antes de nova venda a prazo.'
      )
    }
  }

  if (cfg.usar_limite_credito && cli.limite_credito != null) {
    const limite = Number(cli.limite_credito)
    if (Number.isFinite(limite)) {
      const { data: abertoRows, error: abErr } = await supabase
        .from('contas_receber')
        .select('valor')
        .eq('empresa_id', empresaId)
        .eq('cliente_id', clienteId)
        .eq('status', 'PENDENTE')
      if (abErr) throw abErr
      const aberto = (abertoRows ?? []).reduce((s, r) => s + Number((r as { valor: number }).valor), 0)
      if (aberto + valorNovaVenda > limite + 0.01) {
        throw new Error(
          `Limite de crédito excedido. Em aberto: R$ ${aberto.toFixed(2)}; limite: R$ ${limite.toFixed(2)}; esta venda: R$ ${valorNovaVenda.toFixed(2)}.`
        )
      }
    }
  }
}

function parseDataVencimentoCupom(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : s.slice(0, 10)
}

async function webGetVendaDetalhes(vendaId: string): Promise<VendaDetalhes | null> {
  const { data: vendaRaw, error: vErr } = await supabase.from('vendas').select('*').eq('id', vendaId).maybeSingle()
  if (vErr || !vendaRaw) return null

  let dataVenc = parseDataVencimentoCupom((vendaRaw as { data_vencimento?: string | null }).data_vencimento)
  if (!dataVenc) {
    const { data: cr } = await supabase
      .from('contas_receber')
      .select('vencimento')
      .eq('venda_id', vendaId)
      .limit(1)
      .maybeSingle()
    if (cr?.vencimento != null) dataVenc = parseDataVencimentoCupom(String(cr.vencimento))
  }

  const raw = vendaRaw as Record<string, unknown>
  const venda: Venda = {
    id: String(raw.id),
    empresa_id: String(raw.empresa_id),
    caixa_id: String(raw.caixa_id),
    usuario_id: String(raw.usuario_id),
    cliente_id: raw.cliente_id != null ? String(raw.cliente_id) : null,
    numero: Number(raw.numero),
    status: String(raw.status),
    subtotal: Number(raw.subtotal),
    desconto_total: Number(raw.desconto_total),
    total: Number(raw.total),
    troco: Number(raw.troco ?? 0),
    cashback_gerado: Number(raw.cashback_gerado ?? 0),
    cashback_usado: Number(raw.cashback_usado ?? 0),
    created_at: String(raw.created_at),
    venda_a_prazo: raw.venda_a_prazo != null ? Number(raw.venda_a_prazo) : undefined,
    data_vencimento: dataVenc ?? (raw.data_vencimento != null ? String(raw.data_vencimento) : null),
    venda_online: Number(raw.venda_online) === 1 ? 1 : 0,
  }

  let clienteNomeCupom: string | null = null
  let clienteDocCupom: string | null = null
  if (venda.cliente_id) {
    const { data: c } = await supabase
      .from('clientes')
      .select('nome, cpf_cnpj')
      .eq('id', venda.cliente_id)
      .maybeSingle()
    if (c) {
      clienteNomeCupom = c.nome?.trim() || null
      clienteDocCupom = c.cpf_cnpj?.trim() || null
    }
  }

  const pedidoOnlinePromise =
    venda.venda_online === 1
      ? supabase
          .from('loja_online_pedidos')
          .select(
            'id, status, created_at, forma_entrega, endereco_entrega, cep_destino, observacoes, cliente_nome, cliente_email, cliente_telefone, subtotal, valor_frete, valor_desconto, cashback_usado, cupom_codigo, forma_pagamento, pagamento_status'
          )
          .eq('venda_id', vendaId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })

  const [{ data: empresa }, { data: config }, { data: itens }, { data: pagamentos }, { data: vendedor }, { data: pedidoRaw }] =
    await Promise.all([
      supabase.from('empresas').select('nome, cnpj').eq('id', venda.empresa_id).maybeSingle(),
      supabase
        .from('empresas_config')
        .select('razao_social, endereco, telefone')
        .eq('empresa_id', venda.empresa_id)
        .maybeSingle(),
      supabase
        .from('venda_itens')
        .select('produto_id, descricao, preco_unitario, quantidade, desconto, total')
        .eq('venda_id', vendaId),
      supabase.from('pagamentos').select('forma, valor').eq('venda_id', vendaId),
      supabase.from('usuarios').select('nome').eq('id', venda.usuario_id).maybeSingle(),
      pedidoOnlinePromise,
    ])

  const pedido_online =
    pedidoRaw != null
      ? {
          id: String(pedidoRaw.id),
          status: String(pedidoRaw.status),
          created_at: String(pedidoRaw.created_at),
          forma_entrega: (pedidoRaw.forma_entrega as 'retirada' | 'entrega' | null) ?? null,
          endereco_entrega: pedidoRaw.endereco_entrega != null ? String(pedidoRaw.endereco_entrega) : null,
          cep_destino: pedidoRaw.cep_destino != null ? String(pedidoRaw.cep_destino) : null,
          observacoes: pedidoRaw.observacoes != null ? String(pedidoRaw.observacoes) : null,
          cliente_nome: pedidoRaw.cliente_nome != null ? String(pedidoRaw.cliente_nome) : null,
          cliente_email: pedidoRaw.cliente_email != null ? String(pedidoRaw.cliente_email) : null,
          cliente_telefone: pedidoRaw.cliente_telefone != null ? String(pedidoRaw.cliente_telefone) : null,
          subtotal: pedidoRaw.subtotal != null ? Number(pedidoRaw.subtotal) : null,
          valor_frete: pedidoRaw.valor_frete != null ? Number(pedidoRaw.valor_frete) : null,
          valor_desconto: pedidoRaw.valor_desconto != null ? Number(pedidoRaw.valor_desconto) : null,
          cashback_usado: pedidoRaw.cashback_usado != null ? Number(pedidoRaw.cashback_usado) : null,
          cupom_codigo: pedidoRaw.cupom_codigo != null ? String(pedidoRaw.cupom_codigo) : null,
          forma_pagamento: pedidoRaw.forma_pagamento != null ? String(pedidoRaw.forma_pagamento) : null,
          pagamento_status: pedidoRaw.pagamento_status != null ? String(pedidoRaw.pagamento_status) : null,
        }
      : null

  return {
    venda,
    empresa_nome: empresa?.nome?.trim() || 'Empresa',
    itens: (itens ?? []).map((i) => ({
      produto_id: i.produto_id != null ? String(i.produto_id) : undefined,
      descricao: String(i.descricao),
      preco_unitario: Number(i.preco_unitario),
      quantidade: Number(i.quantidade),
      desconto: Number(i.desconto ?? 0),
      total: Number(i.total),
    })),
    pagamentos: (pagamentos ?? []).map((p) => ({
      forma: String(p.forma),
      valor: Number(p.valor),
    })),
    cashback_cupom: null,
    cliente_nome_cupom: clienteNomeCupom,
    cliente_documento_cupom: clienteDocCupom,
    pedido_online,
    cupom_empresa: {
      razao_social: config?.razao_social ?? null,
      cnpj: empresa?.cnpj ?? null,
      endereco: config?.endereco ?? null,
      telefone: config?.telefone ?? null,
      vendedor_nome: vendedor?.nome?.trim() ?? null,
    },
  }
}

async function webFinalizarVenda(data: FinalizarVendaInput): Promise<Venda> {
  const empresa_id = data.empresa_id
  const usuario_id = data.usuario_id

  const { data: caixaRows, error: caixaErr } = await supabase
    .from('caixas')
    .select('id')
    .eq('empresa_id', empresa_id)
    .eq('status', 'ABERTO')
    .order('aberto_em', { ascending: false })
    .limit(1)
  if (caixaErr) throw caixaErr
  const caixa = caixaRows?.[0] as { id: string } | undefined
  if (!caixa) throw new Error('Não há caixa aberto. Abra o caixa antes de vender.')

  if (!data.itens.length) throw new Error('Adicione ao menos um item à venda.')
  if (!data.pagamentos.length) throw new Error('Adicione ao menos uma forma de pagamento.')

  if (data.pagamentos.some((p) => p.forma === 'CASHBACK')) {
    throw new Error(
      'Pagamento com cashback exige o PDV no modo local (banco SQLite). No modo web, use outras formas de pagamento.'
    )
  }

  const subtotal = data.itens.reduce((acc, i) => acc + i.preco_unitario * i.quantidade - (i.desconto ?? 0), 0)
  const descontoTotal = data.desconto_total ?? 0
  const total = subtotal - descontoTotal
  const totalPagamentos = data.pagamentos.reduce((acc, p) => acc + p.valor, 0)
  if (Math.abs(totalPagamentos - total) > 0.01) {
    throw new Error(
      `Total dos pagamentos (R$ ${totalPagamentos.toFixed(2)}) deve ser igual ao total da venda (R$ ${total.toFixed(2)}).`
    )
  }

  const troco = data.troco ?? 0
  const temPrazo = data.pagamentos.some((p) => p.forma === 'A_PRAZO')
  if (temPrazo) {
    if (data.pagamentos.length !== 1 || data.pagamentos[0].forma !== 'A_PRAZO') {
      throw new Error('Venda a prazo deve ser quitada em uma única forma de pagamento (A prazo) pelo valor total.')
    }
    if (Math.abs(data.pagamentos[0].valor - total) > 0.01) {
      throw new Error('O valor em A prazo deve ser igual ao total da venda.')
    }
    if (!data.cliente_id) throw new Error('Selecione o cliente para venda a prazo.')
    const dv = data.data_vencimento?.trim()
    if (!dv || !/^\d{4}-\d{2}-\d{2}$/.test(dv)) {
      throw new Error('Informe a data de vencimento (venda a prazo).')
    }
    if (troco > 0.01) throw new Error('Venda a prazo não gera troco.')
    await webAssertPodeVenderAPrazo(empresa_id, data.cliente_id, total)
  }

  const vendaId = crypto.randomUUID()
  const numero = await webNextNumeroVenda(empresa_id)
  const vendaAPrazoFlag = temPrazo ? 1 : 0
  const dataVencimentoSql = temPrazo ? data.data_vencimento!.trim() : null

  const { error: vendaErr } = await supabase.from('vendas').insert({
    id: vendaId,
    empresa_id,
    caixa_id: caixa.id,
    usuario_id,
    cliente_id: data.cliente_id ?? null,
    numero,
    status: 'CONCLUIDA',
    subtotal,
    desconto_total: descontoTotal,
    total,
    troco,
    venda_a_prazo: vendaAPrazoFlag,
    data_vencimento: dataVencimentoSql,
    cashback_gerado: 0,
    cashback_usado: 0,
    created_at: new Date().toISOString(),
  })
  if (vendaErr) throw new Error(`Falha ao registrar venda: ${vendaErr.message}`)

  const itensRows = data.itens.map((item) => ({
    id: crypto.randomUUID(),
    empresa_id,
    venda_id: vendaId,
    produto_id: item.produto_id,
    descricao: item.descricao,
    preco_unitario: item.preco_unitario,
    quantidade: item.quantidade,
    desconto: item.desconto ?? 0,
    total: item.preco_unitario * item.quantidade - (item.desconto ?? 0),
  }))
  const { error: itensErr } = await supabase.from('venda_itens').insert(itensRows)
  if (itensErr) throw new Error(`Falha ao registrar itens: ${itensErr.message}`)

  const produtoIds = [...new Set(data.itens.map((i) => i.produto_id))]
  const { data: produtos, error: prodErr } = await supabase
    .from('produtos')
    .select('id, controla_estoque, custo')
    .in('id', produtoIds)
  if (prodErr) throw prodErr
  const prodMap = new Map(
    (produtos ?? []).map((p) => [
      (p as { id: string }).id,
      p as { id: string; controla_estoque: number; custo: number },
    ])
  )

  for (const item of data.itens) {
    const produto = prodMap.get(item.produto_id)
    if (produto && Number(produto.controla_estoque) === 1) {
      await webRegistrarSaidaEstoque({
        empresa_id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        custo_unitario: Number(produto.custo) || 0,
        venda_id: vendaId,
        usuario_id,
      })
    }
  }

  const pagRows = data.pagamentos.map((pag) => ({
    id: crypto.randomUUID(),
    empresa_id,
    venda_id: vendaId,
    forma: pag.forma,
    valor: pag.valor,
  }))
  const { error: pagErr } = await supabase.from('pagamentos').insert(pagRows)
  if (pagErr) throw new Error(`Falha ao registrar pagamentos: ${pagErr.message}`)

  if (temPrazo && data.cliente_id && dataVencimentoSql) {
    const { error: crErr } = await supabase.from('contas_receber').insert({
      id: crypto.randomUUID(),
      empresa_id,
      venda_id: vendaId,
      cliente_id: data.cliente_id,
      valor: total,
      vencimento: dataVencimentoSql,
      status: 'PENDENTE',
    })
    if (crErr) throw new Error(`Falha ao registrar conta a receber: ${crErr.message}`)
  }

  const { data: vendaRow, error: fetchErr } = await supabase.from('vendas').select('*').eq('id', vendaId).single()
  if (fetchErr) throw fetchErr
  return rowToVenda(vendaRow as Record<string, unknown>)
}

const DEFAULT_MODULOS_JSON = JSON.stringify(defaultModulosRecord(true) as Record<ModuloId, boolean>)

async function fetchEmpresaConfig(empresaId: string): Promise<EmpresaConfig | null> {
  const { data: empresa, error: errEmpresa } = await supabase
    .from('empresas')
    .select('id, nome, cnpj, codigo_acesso, created_at')
    .eq('id', empresaId)
    .maybeSingle()
  if (errEmpresa) throw errEmpresa
  if (!empresa) return null

  const { data: config, error: errConfig } = await supabase
    .from('empresas_config')
    .select('*')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (errConfig) throw errConfig

  const merged = { ...(empresa as Record<string, unknown>), ...(config ?? {}) } as Record<string, unknown>
  const rawLayout = merged.cupom_layout_pagina
  if (typeof rawLayout !== 'string' || !String(rawLayout).trim()) {
    merged.cupom_layout_pagina = 'compat'
  }
  if (merged.cupom_fiscal_auto_emitir === undefined || merged.cupom_fiscal_auto_emitir === null) {
    merged.cupom_fiscal_auto_emitir = 0
  }
  return merged as EmpresaConfig
}

export const webElectronAPI: Window['electronAPI'] = {
  ping: async () => 'pong',

  // ── Empresas ─────────────────────────────────────────────────────────────
  empresas: {
    list: async (): Promise<Empresa[]> => {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome, cnpj, codigo_acesso, created_at')
        .order('nome')
      if (error) throw error
      return (data ?? []) as Empresa[]
    },
    count: async (): Promise<number> => {
      const { count, error } = await supabase.from('empresas').select('*', { count: 'exact', head: true })
      if (error) throw error
      return count ?? 0
    },
    create: async (d) => {
      const { data, error } = await supabase
        .from('empresas')
        .insert({
          id: crypto.randomUUID(),
          nome: d.nome,
          cnpj: d.cnpj ?? null,
          codigo_acesso: d.codigo_acesso ?? null,
        })
        .select('id, nome, cnpj, codigo_acesso, created_at')
        .single()
      if (error) throw error
      return data as Empresa
    },
    getConfig: async (empresaId): Promise<EmpresaConfig | null> => fetchEmpresaConfig(empresaId),
    updateConfig: async (empresaId, d: UpdateEmpresaConfigInput): Promise<EmpresaConfig | null> => {
      const currentConfig = await fetchEmpresaConfig(empresaId)
      if (!currentConfig) return null

      const session = loadSession()
      const bypassDadosProtegidos = Boolean(session && 'suporte' in session && session.suporte)
      assertEmpresaConfigUpdateAllowed(currentConfig, d, { bypassDadosProtegidos })

      // Atualiza `empresas` (nome/cnpj) e `empresas_config` (fiscal/design/etc) separadamente.
      const empresaUpdates: Record<string, unknown> = {}
      const configUpdates: Record<string, unknown> = {}

      if (d.nome !== undefined) empresaUpdates.nome = d.nome
      if (d.cnpj !== undefined) empresaUpdates.cnpj = d.cnpj
      if (d.codigo_acesso !== undefined) empresaUpdates.codigo_acesso = d.codigo_acesso

      if (d.razao_social !== undefined) configUpdates.razao_social = d.razao_social
      if (d.endereco !== undefined) configUpdates.endereco = d.endereco
      if (d.telefone !== undefined) configUpdates.telefone = d.telefone
      if (d.email !== undefined) configUpdates.email = d.email
      if (d.logo !== undefined) configUpdates.logo = d.logo
      if (d.cor_primaria !== undefined) configUpdates.cor_primaria = d.cor_primaria
      if ((d as { impressora_cupom?: unknown }).impressora_cupom !== undefined) {
        configUpdates.impressora_cupom = (d as { impressora_cupom?: unknown }).impressora_cupom
      }
      if ((d as { cupom_layout_pagina?: unknown }).cupom_layout_pagina !== undefined) {
        configUpdates.cupom_layout_pagina = (d as { cupom_layout_pagina?: unknown }).cupom_layout_pagina
      }
      if (d.cupom_fiscal_auto_emitir !== undefined) {
        configUpdates.cupom_fiscal_auto_emitir = d.cupom_fiscal_auto_emitir ? 1 : 0
      }
      if (d.cupom_fiscal_auto_formas_json !== undefined) {
        configUpdates.cupom_fiscal_auto_formas_json = d.cupom_fiscal_auto_formas_json
      }

      if (d.loja_online_ativa !== undefined) configUpdates.loja_online_ativa = d.loja_online_ativa ? 1 : 0
      if (d.loja_online_slug !== undefined) {
        const slug = d.loja_online_slug?.trim() ? normalizeLojaOnlineSlug(d.loja_online_slug) : null
        if (slug) {
          const err = validateLojaOnlineSlug(slug)
          if (err) throw new Error(err)
          const { data: taken } = await supabase
            .from('empresas_config')
            .select('empresa_id')
            .eq('loja_online_slug', slug)
            .neq('empresa_id', empresaId)
            .maybeSingle()
          if (taken) throw new Error('Este endereço já está em uso por outra loja.')
        }
        configUpdates.loja_online_slug = slug
      }
      if (d.loja_online_ativa && d.loja_online_slug !== undefined && !configUpdates.loja_online_slug) {
        throw new Error('Informe o endereço (subdomínio) da loja online para publicar o catálogo.')
      }
      if (d.loja_online_titulo !== undefined) configUpdates.loja_online_titulo = d.loja_online_titulo?.trim() || null
      if (d.loja_online_descricao !== undefined) configUpdates.loja_online_descricao = d.loja_online_descricao
      if (d.loja_online_whatsapp !== undefined) configUpdates.loja_online_whatsapp = d.loja_online_whatsapp?.trim() || null
      if (d.loja_online_whatsapp_flutuante !== undefined) {
        configUpdates.loja_online_whatsapp_flutuante = d.loja_online_whatsapp_flutuante ? 1 : 0
      }
      if (d.loja_online_whatsapp_flutuante_msg !== undefined) {
        configUpdates.loja_online_whatsapp_flutuante_msg = d.loja_online_whatsapp_flutuante_msg?.trim() || null
      }
      if (d.loja_online_mostrar_preco !== undefined) {
        configUpdates.loja_online_mostrar_preco = d.loja_online_mostrar_preco ? 1 : 0
      }
      if (d.loja_online_ocultar_sem_estoque !== undefined) {
        configUpdates.loja_online_ocultar_sem_estoque = d.loja_online_ocultar_sem_estoque ? 1 : 0
      }
      if (d.loja_online_banner !== undefined) configUpdates.loja_online_banner = d.loja_online_banner
      if (d.loja_online_banners_json !== undefined) configUpdates.loja_online_banners_json = d.loja_online_banners_json
      if (d.loja_online_banner_tamanho !== undefined) {
        const t = d.loja_online_banner_tamanho?.trim()
        configUpdates.loja_online_banner_tamanho =
          t === 'pequeno' || t === 'medio' || t === 'grande' ? t : 'medio'
      }
      if (d.loja_online_banner_tamanho_mobile !== undefined) {
        const t = d.loja_online_banner_tamanho_mobile?.trim()
        configUpdates.loja_online_banner_tamanho_mobile =
          t === 'pequeno' || t === 'medio' || t === 'grande' ? t : 'medio'
      }
      if (d.loja_online_faixa_ativa !== undefined) {
        configUpdates.loja_online_faixa_ativa = d.loja_online_faixa_ativa ? 1 : 0
      }
      if (d.loja_online_faixa_avisos_json !== undefined) {
        configUpdates.loja_online_faixa_avisos_json = d.loja_online_faixa_avisos_json
      }
      if (d.loja_online_rodape_texto !== undefined) configUpdates.loja_online_rodape_texto = d.loja_online_rodape_texto?.trim() || null
      if (d.loja_online_instagram !== undefined) configUpdates.loja_online_instagram = d.loja_online_instagram?.trim() || null
      if (d.loja_online_facebook !== undefined) configUpdates.loja_online_facebook = d.loja_online_facebook?.trim() || null
      if (d.loja_online_email_contato !== undefined) configUpdates.loja_online_email_contato = d.loja_online_email_contato?.trim() || null
      if (d.loja_online_exigir_cadastro !== undefined) {
        configUpdates.loja_online_exigir_cadastro = d.loja_online_exigir_cadastro ? 1 : 0
      }
      if (d.loja_online_permitir_retirada !== undefined) {
        configUpdates.loja_online_permitir_retirada = d.loja_online_permitir_retirada ? 1 : 0
      }
      if (d.loja_online_permitir_entrega !== undefined) {
        configUpdates.loja_online_permitir_entrega = d.loja_online_permitir_entrega ? 1 : 0
      }
      if (d.loja_online_mensagem_checkout !== undefined) {
        configUpdates.loja_online_mensagem_checkout = d.loja_online_mensagem_checkout?.trim() || null
      }
      if (d.loja_online_checkout_oferta_json !== undefined) {
        configUpdates.loja_online_checkout_oferta_json = d.loja_online_checkout_oferta_json?.trim() || null
      }
      if (d.loja_online_pag_manual !== undefined) {
        configUpdates.loja_online_pag_manual = d.loja_online_pag_manual ? 1 : 0
      }
      if (d.loja_online_pag_asaas !== undefined) {
        configUpdates.loja_online_pag_asaas = d.loja_online_pag_asaas ? 1 : 0
      }
      if (d.loja_online_asaas_api_key !== undefined && d.loja_online_asaas_api_key?.trim()) {
        configUpdates.loja_online_asaas_api_key = d.loja_online_asaas_api_key.trim()
        configUpdates.loja_online_asaas_pronto = 1
      }
      if (d.loja_online_asaas_sandbox !== undefined) {
        configUpdates.loja_online_asaas_sandbox = d.loja_online_asaas_sandbox ? 1 : 0
      }
      if (d.loja_online_pag_mercadopago !== undefined) {
        configUpdates.loja_online_pag_mercadopago = d.loja_online_pag_mercadopago ? 1 : 0
      }
      if (d.loja_online_mercadopago_public_key !== undefined) {
        configUpdates.loja_online_mercadopago_public_key = d.loja_online_mercadopago_public_key?.trim() || null
      }
      if (d.loja_online_mercadopago_access_token !== undefined && d.loja_online_mercadopago_access_token?.trim()) {
        configUpdates.loja_online_mercadopago_access_token = d.loja_online_mercadopago_access_token.trim()
        configUpdates.loja_online_mp_pronto = 1
      }
      if (d.loja_online_mp_pronto !== undefined) {
        configUpdates.loja_online_mp_pronto = d.loja_online_mp_pronto ? 1 : 0
      }
      if (d.loja_online_asaas_pronto !== undefined) {
        configUpdates.loja_online_asaas_pronto = d.loja_online_asaas_pronto ? 1 : 0
      }
      if (d.loja_online_frete_tipo !== undefined) {
        configUpdates.loja_online_frete_tipo = d.loja_online_frete_tipo
      }
      if (d.loja_online_frete_valor_fixo !== undefined) {
        configUpdates.loja_online_frete_valor_fixo = d.loja_online_frete_valor_fixo
      }
      if (d.loja_online_frete_cep_origem !== undefined) {
        configUpdates.loja_online_frete_cep_origem = d.loja_online_frete_cep_origem?.replace(/\D/g, '') || null
      }
      if (d.loja_online_frete_peso_padrao !== undefined) {
        configUpdates.loja_online_frete_peso_padrao = d.loja_online_frete_peso_padrao
      }
      if (d.loja_online_frete_gratis_ativo !== undefined) {
        configUpdates.loja_online_frete_gratis_ativo = d.loja_online_frete_gratis_ativo ? 1 : 0
      }
      if (d.loja_online_frete_gratis_minimo !== undefined) {
        configUpdates.loja_online_frete_gratis_minimo = d.loja_online_frete_gratis_minimo
      }
      if (d.loja_online_melhor_envio_token !== undefined && d.loja_online_melhor_envio_token?.trim()) {
        configUpdates.loja_online_melhor_envio_token = d.loja_online_melhor_envio_token.trim()
      }
      if (d.loja_online_melhor_envio_sandbox !== undefined) {
        configUpdates.loja_online_melhor_envio_sandbox = d.loja_online_melhor_envio_sandbox ? 1 : 0
      }
      if (d.loja_online_cashback_ativo !== undefined) {
        configUpdates.loja_online_cashback_ativo = d.loja_online_cashback_ativo ? 1 : 0
      }
      if (d.loja_online_cor_primaria !== undefined) {
        const cor = d.loja_online_cor_primaria?.trim()
        configUpdates.loja_online_cor_primaria =
          cor && /^#[0-9A-Fa-f]{6}$/.test(cor) ? cor.toLowerCase() : null
      }
      if (d.loja_online_cor_fundo !== undefined) {
        const cor = d.loja_online_cor_fundo?.trim()
        configUpdates.loja_online_cor_fundo =
          cor && /^#[0-9A-Fa-f]{6}$/.test(cor) ? cor.toLowerCase() : null
      }
      if (d.loja_online_cor_header !== undefined) {
        const cor = d.loja_online_cor_header?.trim()
        configUpdates.loja_online_cor_header =
          cor && /^#[0-9A-Fa-f]{6}$/.test(cor) ? cor.toLowerCase() : null
      }
      if (d.loja_online_cor_menu !== undefined) {
        const cor = d.loja_online_cor_menu?.trim()
        configUpdates.loja_online_cor_menu =
          cor && /^#[0-9A-Fa-f]{6}$/.test(cor) ? cor.toLowerCase() : null
      }
      if (d.loja_online_categorias_titulo !== undefined) {
        configUpdates.loja_online_categorias_titulo = d.loja_online_categorias_titulo?.trim() || null
      }
      if (d.loja_online_cards_config_json !== undefined) {
        configUpdates.loja_online_cards_config_json = d.loja_online_cards_config_json?.trim() || null
      }
      if (d.loja_online_seo_titulo !== undefined) {
        configUpdates.loja_online_seo_titulo = d.loja_online_seo_titulo?.trim() || null
      }
      if (d.loja_online_seo_descricao !== undefined) {
        configUpdates.loja_online_seo_descricao = d.loja_online_seo_descricao?.trim() || null
      }
      if (d.loja_online_politica_privacidade !== undefined) {
        configUpdates.loja_online_politica_privacidade = d.loja_online_politica_privacidade?.trim() || null
      }
      if (d.loja_online_termos_uso !== undefined) {
        configUpdates.loja_online_termos_uso = d.loja_online_termos_uso?.trim() || null
      }
      if (d.loja_online_politica_trocas !== undefined) {
        configUpdates.loja_online_politica_trocas = d.loja_online_politica_trocas?.trim() || null
      }
      if (d.loja_online_politica_entrega !== undefined) {
        configUpdates.loja_online_politica_entrega = d.loja_online_politica_entrega?.trim() || null
      }
      if (d.loja_online_ga4_id !== undefined) {
        configUpdates.loja_online_ga4_id = d.loja_online_ga4_id?.trim() || null
      }
      if (d.loja_online_meta_pixel_id !== undefined) {
        configUpdates.loja_online_meta_pixel_id = d.loja_online_meta_pixel_id?.trim() || null
      }
      if (d.loja_online_dominio_custom !== undefined) {
        const domain = d.loja_online_dominio_custom?.trim()
          ? normalizeLojaOnlineCustomDomain(d.loja_online_dominio_custom)
          : null
        if (domain) {
          const err = validateLojaOnlineCustomDomain(domain)
          if (err) throw new Error(err)
          const variants = lojaOnlineCustomDomainVariants(domain)
          const { data: taken } = await supabase
            .from('empresas_config')
            .select('empresa_id')
            .in('loja_online_dominio_custom', variants)
            .neq('empresa_id', empresaId)
            .limit(1)
            .maybeSingle()
          if (taken) throw new Error('Este domínio já está em uso por outra loja.')
        }
        configUpdates.loja_online_dominio_custom = domain
      }
      if (d.loja_online_header_mobile !== undefined) {
        const header = String(d.loja_online_header_mobile ?? '').trim().toLowerCase()
        configUpdates.loja_online_header_mobile =
          header === 'center' || header === 'inverted' || header === 'classic' ? header : 'classic'
      }
      if (d.loja_online_logo_header !== undefined) {
        const logo = d.loja_online_logo_header?.trim() || null
        configUpdates.loja_online_logo_header = logo && logo.startsWith('data:image/') ? logo : null
      }
      if (d.loja_online_logo_header_size !== undefined) {
        configUpdates.loja_online_logo_header_size = parseLojaOnlineLogoHeaderSize(
          d.loja_online_logo_header_size
        )
      }

      if (d.modulos !== undefined) {
        configUpdates.modulos_json = JSON.stringify(d.modulos)
      }

      if (Object.keys(empresaUpdates).length > 0) {
        const { error: errEmpresa } = await supabase
          .from('empresas')
          .update(empresaUpdates)
          .eq('id', empresaId)
        if (errEmpresa) throw errEmpresa
      }

      if (Object.keys(configUpdates).length > 0) {
        const payload = { empresa_id: empresaId, ...configUpdates }

        const upsertAttempt = async (p: Record<string, unknown>) => {
          const { error: errCfg } = await supabase
            .from('empresas_config')
            .upsert(p, { onConflict: 'empresa_id' })
          if (errCfg) throw errCfg
        }

        let attemptPayload: Record<string, unknown> = { ...payload }
        for (let attempt = 0; attempt < 13; attempt++) {
          try {
            await upsertAttempt(attemptPayload)
            break
          } catch (err) {
            const msg = String((err as { message?: unknown })?.message ?? err)
            if (
              msg.toLowerCase().includes('loja_online_dominio_custom') ||
              msg.toLowerCase().includes('idx_empresas_config_loja_online_dominio_custom')
            ) {
              throw new Error('Este domínio já está em uso por outra loja.')
            }
            if (msg.includes('impressora_cupom')) {
              const { impressora_cupom: _i, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            if (msg.includes('cupom_layout_pagina')) {
              const { cupom_layout_pagina: _c, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            if (msg.includes('cupom_fiscal_auto_emitir')) {
              const { cupom_fiscal_auto_emitir: _e, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            if (msg.includes('cupom_fiscal_auto_formas_json')) {
              const { cupom_fiscal_auto_formas_json: _f, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            if (msg.includes('loja_online_header_mobile')) {
              const { loja_online_header_mobile: _h, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            if (msg.includes('loja_online_cor_header')) {
              const { loja_online_cor_header: _ch, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            if (msg.includes('loja_online_cor_menu')) {
              const { loja_online_cor_menu: _cm, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            if (msg.includes('loja_online_logo_header_size')) {
              const { loja_online_logo_header_size: _ls, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            if (msg.includes('loja_online_logo_header')) {
              const { loja_online_logo_header: _lh, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            if (msg.includes('loja_online_banner_tamanho_mobile')) {
              const { loja_online_banner_tamanho_mobile: _btm, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            if (msg.includes('loja_online_frete_gratis_ativo')) {
              const { loja_online_frete_gratis_ativo: _fga, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            if (msg.includes('loja_online_frete_gratis_minimo')) {
              const { loja_online_frete_gratis_minimo: _fgm, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            if (msg.includes('loja_online_checkout_oferta_json')) {
              const { loja_online_checkout_oferta_json: _cof, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            if (msg.includes('loja_online_whatsapp_flutuante_msg')) {
              const { loja_online_whatsapp_flutuante_msg: _wam, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            if (msg.includes('loja_online_whatsapp_flutuante')) {
              const { loja_online_whatsapp_flutuante: _waf, ...rest } = attemptPayload
              attemptPayload = rest
              continue
            }
            throw err
          }
        }
      }

      // Recarrega a configuração completa (gera resposta consistente com o getConfig).
      const { data: empresa, error: errEmpresa } = await supabase
        .from('empresas')
        .select('id, nome, cnpj, codigo_acesso, created_at')
        .eq('id', empresaId)
        .maybeSingle()
      if (errEmpresa) throw errEmpresa
      if (!empresa) return null

      const { data: config, error: errConfig } = await supabase
        .from('empresas_config')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle()
      if (errConfig) throw errConfig

      const merged = { ...(empresa as Record<string, unknown>), ...(config ?? {}) } as Record<string, unknown>
      const rawLayout = merged.cupom_layout_pagina
      if (typeof rawLayout !== 'string' || !String(rawLayout).trim()) {
        merged.cupom_layout_pagina = 'compat'
      }
      if (merged.cupom_fiscal_auto_emitir === undefined || merged.cupom_fiscal_auto_emitir === null) {
        merged.cupom_fiscal_auto_emitir = 0
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agiliza:syncDataUpdated'))
      }
      return merged as EmpresaConfig
    },
    getFiscalConfig: async (empresaId): Promise<EmpresaFiscalConfig | null> => fetchFiscalConfig(empresaId),
    updateFiscalConfig: async (empresaId, d: UpdateFiscalConfigInput): Promise<EmpresaFiscalConfig | null> => {
      const current = await fetchFiscalConfig(empresaId)
      if (!current) return null
      const payload = {
        empresa_id: empresaId,
        ...fiscalInputToRowUpdate(d, current),
      }
      const { error } = await supabase.from('empresas_config').upsert(payload, { onConflict: 'empresa_id' })
      if (error) throw error
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agiliza:syncDataUpdated'))
      }
      return fetchFiscalConfig(empresaId)
    },
  },

  // ── Usuários ──────────────────────────────────────────────────────────────
  usuarios: {
    list: async (empresaId): Promise<Usuario[]> => {
      const rows = await selectUsuariosByEmpresa(empresaId)
      return rows.map(mapUsuarioRow)
    },
    get: async (id): Promise<Usuario | null> => {
      const row = await selectUsuarioById(id)
      if (!row) return null
      return mapUsuarioRow(row)
    },
    create: async (d) => {
      // Hashing de senha não disponível no frontend - requer backend/Edge Function
      notSupported('usuarios.create')
    },
    update: async (id, d) => {
      const current = await selectUsuarioById(id)
      if (!current) return null

      const session = loadSession()
      const bypassDadosProtegidos = Boolean(session && 'suporte' in session && session.suporte)
      assertUsuarioUpdateAllowed(
        { nome: String(current.nome ?? ''), email: (current.email as string | null) ?? null },
        { nome: d.nome, email: d.email },
        { bypassDadosProtegidos }
      )

      const empresaId = current.empresa_id as string

      if (d.login !== undefined && d.login.trim() !== '') {
        const newLogin = d.login.trim()
        const currentLogin = String(current.login ?? '').trim()
        if (newLogin.toLowerCase() !== currentLogin.toLowerCase()) {
          const rows = await supabaseSelectUsuarios(
            (q) =>
              q
                .eq('empresa_id', empresaId)
                .ilike('login', newLogin)
                .limit(5)
          )
          const conflict = rows.find((r) => String(r.id) !== String(id))
          if (conflict) {
            throw new Error('Já existe um usuário com este login nesta empresa.')
          }
        }
      }

      const payload: Record<string, unknown> = {}
      if (d.nome !== undefined) payload.nome = d.nome.trim()
      if (d.login !== undefined) payload.login = d.login.trim()
      if (d.email !== undefined) payload.email = d.email?.trim().toLowerCase() || null
      if (d.role !== undefined) payload.role = d.role
      if (d.modulos_json !== undefined) payload.modulos_json = d.modulos_json
      if (d.comissao_percentual !== undefined) {
        payload.comissao_percentual =
          d.comissao_percentual == null ? null : Math.max(0, Math.min(100, Number(d.comissao_percentual)))
      }
      if (d.meta_vendas_mes !== undefined) {
        payload.meta_vendas_mes =
          d.meta_vendas_mes == null ? null : Math.max(0, Number(d.meta_vendas_mes))
      }
      if (d.senha !== undefined && d.senha !== '') {
        payload.senha_hash = await hashSenhaWeb(d.senha)
      }
      if (Object.keys(payload).length === 0) return mapUsuarioRow(current)

      const { data, error } = await supabase
        .from('usuarios')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error

      const usuario = mapUsuarioRow(data as Record<string, unknown>)
      if (session && !('suporte' in session) && session.id === id) {
        saveSession(rowToUsuarioSession(data as Record<string, unknown>))
      }
      return usuario
    },
  },

  // ── Produtos ──────────────────────────────────────────────────────────────
  produtos: {
    list: async (empresaId, options): Promise<Produto[]> => {
      if (!canCacheProdutosList(options)) {
        return listProdutosUncached(empresaId, options)
      }
      const key = produtosListCacheKey(empresaId, options)
      const produtos = await produtosListCache.get(key, () => listProdutosUncached(empresaId, options))
      if (!options?.completo && options?.apenasAtivos) {
        writeProdutosSessionCatalog(empresaId, produtos)
      }
      return produtos
    },
    getImagens: async (ids: string[]): Promise<Record<string, string | null>> => {
      if (ids.length === 0) return {}
      const now = Date.now()
      const map: Record<string, string | null> = {}
      const missing: string[] = []
      for (const id of ids) {
        const cached = produtoImagemCache.get(id)
        if (cached && now - cached.at < PRODUTOS_LIST_TTL_MS) {
          map[id] = cached.data
        } else {
          missing.push(id)
        }
      }
      if (missing.length === 0) return map

      const { data, error } = await supabase.from('produtos').select('id, imagem').in('id', missing)
      if (error) throw error
      const found = new Set<string>()
      for (const row of data ?? []) {
        const id = String(row.id)
        const imagem = row.imagem
        const value = typeof imagem === 'string' && imagem.trim() ? imagem : null
        map[id] = value
        produtoImagemCache.set(id, { at: Date.now(), data: value })
        found.add(id)
      }
      for (const id of missing) {
        if (found.has(id)) continue
        map[id] = null
        produtoImagemCache.set(id, { at: Date.now(), data: null })
      }
      return map
    },
    get: async (id): Promise<Produto | null> => {
      const { data, error } = await supabase.from('produtos').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data ? rowToProduto(data as Record<string, unknown>) : null
    },
    getNextCodigo: async (empresaId): Promise<number> => {
      return webNextProdutoCodigo(empresaId)
    },
    create: async (d: CreateProdutoInput): Promise<Produto> => {
      const codigo = await webNextProdutoCodigo(d.empresa_id)
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('produtos')
        .insert({ ...sanitizeProdutoWrite(d as Record<string, unknown>), id: crypto.randomUUID(), codigo, created_at: now, updated_at: now })
        .select('*')
        .single()
      if (error) throw error
      invalidateProdutosCaches(d.empresa_id)
      return rowToProduto(data as Record<string, unknown>)
    },
    update: async (id, d: UpdateProdutoInput): Promise<Produto | null> => {
      const { data: current, error: curErr } = await supabase
        .from('produtos')
        .select('codigo, empresa_id')
        .eq('id', id)
        .maybeSingle()
      if (curErr) throw curErr

      const patch: Record<string, unknown> = {
        ...sanitizeProdutoWrite(d as Record<string, unknown>),
        updated_at: new Date().toISOString(),
      }
      if (current && current.codigo == null && current.empresa_id) {
        patch.codigo = await webNextProdutoCodigo(String(current.empresa_id))
      }

      const { data, error } = await supabase
        .from('produtos')
        .update(patch)
        .eq('id', id)
        .select('*')
        .maybeSingle()
      if (error) throw error
      produtoImagemCache.delete(id)
      if (current?.empresa_id) invalidateProdutosCaches(String(current.empresa_id))
      else invalidateProdutosCaches()
      return data ? rowToProduto(data as Record<string, unknown>) : null
    },
    ensureNfeAvulsa: async (empresaId: string) => {
      const { data: existing } = await supabase
        .from('produtos')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('sku', SKU_PRODUTO_NFE_AVULSA)
        .maybeSingle()
      if (existing?.id) return { ok: true as const, produtoId: String(existing.id) }
      const id = crypto.randomUUID()
      const { error } = await supabase.from('produtos').insert({
        id,
        empresa_id: empresaId,
        nome: 'Item diversos (NF-e avulsa)',
        sku: SKU_PRODUTO_NFE_AVULSA,
        descricao: 'Produto interno do sistema para itens de nota sem cadastro vinculado.',
        preco: 0,
        controla_estoque: 0,
        ativo: 1,
        ncm: '21069090',
        cfop: '5102',
        custo: 0,
        unidade: 'UN',
      })
      if (error) return { ok: false as const, error: error.message }
      invalidateProdutosCaches(empresaId)
      return { ok: true as const, produtoId: id }
    },
    delete: async (id): Promise<{ ok: boolean; error?: string }> => {
      const { data: produto, error: getErr } = await supabase
        .from('produtos')
        .select('id, sku, empresa_id')
        .eq('id', id)
        .maybeSingle()
      if (getErr) throw getErr
      if (!produto) return { ok: false, error: 'Produto não encontrado.' }
      if (produto.sku === SKU_PRODUTO_NFE_AVULSA) {
        return { ok: false, error: 'Produto interno do sistema não pode ser excluído.' }
      }

      const { count, error: vendaErr } = await supabase
        .from('venda_itens')
        .select('id', { count: 'exact', head: true })
        .eq('produto_id', id)
      if (vendaErr) throw vendaErr
      if ((count ?? 0) > 0) {
        return {
          ok: false,
          error: 'Não é possível excluir: produto já foi vendido. Inative o cadastro em vez de excluir.',
        }
      }

      await supabase.from('estoque_movimentos').delete().eq('produto_id', id)
      await supabase.from('cashback_regras').delete().eq('produto_id', id)
      await supabase.from('loja_online_favoritos').delete().eq('produto_id', id)

      const { error } = await supabase.from('produtos').delete().eq('id', id)
      if (error) return { ok: false, error: error.message }
      produtoImagemCache.delete(id)
      if (produto.empresa_id) invalidateProdutosCaches(String(produto.empresa_id))
      else invalidateProdutosCaches()
      return { ok: true }
    },
  },

  // ── Clientes ──────────────────────────────────────────────────────────────
  clientes: {
    list: async (empresaId): Promise<Cliente[]> => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome')
      if (error) throw error
      return (data ?? []) as Cliente[]
    },
    create: async (d) => {
      const { data, error } = await supabase
        .from('clientes')
        .insert({ ...d, id: crypto.randomUUID() })
        .select('*')
        .single()
      if (error) throw error
      return data as Cliente
    },
    update: async (id, d) => {
      const { data, error } = await supabase
        .from('clientes')
        .update(d)
        .eq('id', id)
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as Cliente | null
    },
  },

  // ── Fornecedores ──────────────────────────────────────────────────────────
  fornecedores: {
    list: async (empresaId): Promise<Fornecedor[]> => {
      const { data, error } = await supabase
        .from('fornecedores')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('razao_social')
      if (error) throw error
      return (data ?? []) as Fornecedor[]
    },
    get: async (id): Promise<Fornecedor | null> => {
      const { data, error } = await supabase.from('fornecedores').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data as Fornecedor | null
    },
    historico: async (id): Promise<FornecedorHistoricoItem[]> => {
      const { data, error } = await supabase
        .from('fornecedores_historico')
        .select('*')
        .eq('fornecedor_id', id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as FornecedorHistoricoItem[]
    },
    create: async (d: CreateFornecedorInput): Promise<Fornecedor> => {
      const row = { ...d, id: crypto.randomUUID() }
      const { data, error } = await supabase.from('fornecedores').insert(row).select('*').single()
      if (error) throw error
      return data as Fornecedor
    },
    update: async (id, d: UpdateFornecedorInput): Promise<Fornecedor | null> => {
      const { data, error } = await supabase.from('fornecedores').update(d).eq('id', id).select('*').maybeSingle()
      if (error) throw error
      return data as Fornecedor | null
    },
    delete: async (id): Promise<{ ok: boolean; error?: string }> => {
      const { count, error: errCount } = await supabase
        .from('produtos')
        .select('id', { count: 'exact', head: true })
        .eq('fornecedor_id', id)
      if (errCount) throw errCount
      if ((count ?? 0) > 0) {
        return { ok: false, error: 'Há produtos vinculados. Inative o cadastro em vez de excluir.' }
      }
      const { error } = await supabase.from('fornecedores').delete().eq('id', id)
      if (error) throw error
      return { ok: true }
    },
  },

  // ── Categorias ────────────────────────────────────────────────────────────
  categorias: {
    list: async (empresaId): Promise<Categoria[]> => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('ordem')
      if (error) throw error
      return (data ?? []) as Categoria[]
    },
    listTree: async (empresaId): Promise<CategoriaTreeNode[]> => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('ordem')
      if (error) throw error
      return buildCategoriaTree((data ?? []) as Categoria[])
    },
    listFolha: async (empresaId): Promise<Categoria[]> => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('ordem')
      if (error) throw error
      const all = (data ?? []) as Categoria[]
      const parentIds = new Set(all.map((c) => c.parent_id).filter(Boolean))
      return all.filter((c) => !parentIds.has(c.id))
    },
    get: async (id): Promise<Categoria | null> => {
      const { data, error } = await supabase.from('categorias').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data as Categoria | null
    },
    getPath: async (id): Promise<string> => {
      // Resolve o caminho completo da categoria (pai > filho > ...)
      const parts: string[] = []
      let currentId: string | null = id
      while (currentId) {
        const { data } = await supabase.from('categorias').select('id, nome, parent_id').eq('id', currentId).maybeSingle()
        if (!data) break
        parts.unshift(data.nome as string)
        currentId = data.parent_id as string | null
      }
      return parts.join(' > ')
    },
    create: async (d) => {
      const { data, error } = await supabase
        .from('categorias')
        .insert({ ...d, id: crypto.randomUUID() })
        .select('*')
        .single()
      if (error) throw error
      return data as Categoria
    },
    update: async (id, d) => {
      const { data, error } = await supabase
        .from('categorias')
        .update(d)
        .eq('id', id)
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as Categoria | null
    },
    delete: async (id): Promise<boolean> => {
      const { error } = await supabase.from('categorias').delete().eq('id', id)
      return !error
    },
  },

  // ── Marcas ────────────────────────────────────────────────────────────────
  marcas: {
    list: async (empresaId): Promise<Marca[]> => {
      const { data, error } = await supabase
        .from('marcas')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome')
      if (error) throw error
      return (data ?? []) as Marca[]
    },
    get: async (id): Promise<Marca | null> => {
      const { data, error } = await supabase.from('marcas').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data as Marca | null
    },
    create: async (d) => {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('marcas')
        .insert({ ...d, id: crypto.randomUUID(), created_at: now, updated_at: now })
        .select('*')
        .single()
      if (error) throw error
      return data as Marca
    },
    update: async (id, d) => {
      const { data, error } = await supabase
        .from('marcas')
        .update({ ...d, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as Marca | null
    },
    delete: async (id): Promise<boolean> => {
      const { error } = await supabase.from('marcas').delete().eq('id', id)
      return !error
    },
  },

  // ── Estoque ───────────────────────────────────────────────────────────────
  estoque: {
    listMovimentos: async (empresaId, options): Promise<EstoqueMovimento[]> => {
      let query = supabase
        .from('estoque_movimentos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
      if (options?.produtoId) query = query.eq('produto_id', options.produtoId)
      if (options?.limit) query = query.limit(options.limit)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as EstoqueMovimento[]
    },
    getSaldo: async (empresaId, produtoId): Promise<number> => {
      return getSaldoProdutoFromMovimentos(empresaId, produtoId)
    },
    listSaldos: async (empresaId): Promise<ProdutoSaldo[]> => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, unidade, estoque_minimo, estoque_atual')
        .eq('empresa_id', empresaId)
        .eq('ativo', 1)
        .eq('controla_estoque', 1)
        .order('nome')
      if (error) throw error
      return (data ?? []).map((r: Record<string, unknown>) => ({
        produto_id: r.id as string,
        nome: r.nome as string,
        unidade: r.unidade as string,
        saldo: Number(r.estoque_atual) || 0,
        estoque_minimo: (r.estoque_minimo as number | null) ?? 0,
      }))
    },
    registrarMovimento: async (d: RegistrarMovimentoInput): Promise<EstoqueMovimento> => {
      const { data, error } = await supabase
        .from('estoque_movimentos')
        .insert({ ...d, id: crypto.randomUUID(), created_at: new Date().toISOString() })
        .select('*')
        .single()
      if (error) throw error
      const novoSaldo = await getSaldoProdutoFromMovimentos(d.empresa_id, d.produto_id)
      const up = await supabase
        .from('produtos')
        .update({ estoque_atual: novoSaldo })
        .eq('id', d.produto_id)
        .eq('empresa_id', d.empresa_id)
      if (up.error) throw up.error
      invalidateLojaOnlineCatalogCache(d.empresa_id)
      return data as EstoqueMovimento
    },
    ajustarSaldoPara: webAjustarSaldoPara,
  },

  // ── Caixa ─────────────────────────────────────────────────────────────────
  caixa: {
    getAberto: async (empresaId): Promise<Caixa | null> => {
      const { data, error } = await supabase
        .from('caixas')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('status', 'ABERTO')
        .maybeSingle()
      if (error) throw error
      return data as Caixa | null
    },
    abrir: async (empresaId, usuarioId, valorInicial): Promise<Caixa> => {
      const { data, error } = await supabase
        .from('caixas')
        .insert({
          id: crypto.randomUUID(),
          empresa_id: empresaId,
          usuario_id: usuarioId,
          status: 'ABERTO',
          valor_inicial: valorInicial,
          aberto_em: new Date().toISOString(),
        })
        .select('*')
        .single()
      if (error) throw error
      return data as Caixa
    },
    fechar: async (caixaId): Promise<Caixa | null> => {
      const { data, error } = await supabase
        .from('caixas')
        .update({ status: 'FECHADO', fechado_em: new Date().toISOString() })
        .eq('id', caixaId)
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as Caixa | null
    },
    list: async (empresaId, limit): Promise<Caixa[]> => {
      let query = supabase
        .from('caixas')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('aberto_em', { ascending: false })
      if (limit) query = query.limit(limit)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Caixa[]
    },
    getSaldo: async (caixaId): Promise<number> => {
      const { data: caixa, error: errCaixa } = await supabase
        .from('caixas')
        .select('valor_inicial')
        .eq('id', caixaId)
        .maybeSingle()
      if (errCaixa) throw errCaixa
      const valorInicial = (caixa?.valor_inicial as number | null) ?? 0

      const { data: movs, error: errMovs } = await supabase
        .from('caixa_movimentos')
        .select('tipo, valor')
        .eq('caixa_id', caixaId)
      if (errMovs) throw errMovs

      let saldo = valorInicial
      for (const m of movs ?? []) {
        if ((m as { tipo: string }).tipo === 'SUPRIMENTO') saldo += (m as { valor: number }).valor
        else saldo -= (m as { valor: number }).valor
      }
      return saldo
    },
    getResumoFechamento: async (caixaId): Promise<CaixaResumoFechamento> => {
      const { data: caixa } = await supabase.from('caixas').select('valor_inicial').eq('id', caixaId).maybeSingle()
      const { data: movs } = await supabase.from('caixa_movimentos').select('tipo, valor').eq('caixa_id', caixaId)

      let saldo_base = (caixa?.valor_inicial as number | null) ?? 0
      for (const m of movs ?? []) {
        if ((m as { tipo: string }).tipo === 'SUPRIMENTO') saldo_base += (m as { valor: number }).valor
        else saldo_base -= (m as { valor: number }).valor
      }

      const { data: vendasRows } = await supabase
        .from('vendas')
        .select('id, total, status, venda_a_prazo')
        .eq('caixa_id', caixaId)
        .eq('status', 'CONCLUIDA')

      const vendaIds = (vendasRows ?? []).map((v: { id: string }) => v.id)
      const prazoPorPagamento = new Set<string>()
      if (vendaIds.length > 0) {
        const { data: pagsPrazo } = await supabase.from('pagamentos').select('venda_id').eq('forma', 'A_PRAZO').in('venda_id', vendaIds)
        for (const p of pagsPrazo ?? []) {
          prazoPorPagamento.add((p as { venda_id: string }).venda_id)
        }
      }

      const isVendaPrazo = (v: { id: string; venda_a_prazo?: number }) =>
        Number(v.venda_a_prazo) === 1 || prazoPorPagamento.has(v.id)

      let total_vendas_caixa = 0
      for (const v of vendasRows ?? []) {
        if (!isVendaPrazo(v as { id: string; venda_a_prazo?: number })) {
          total_vendas_caixa += Number((v as { total: number }).total)
        }
      }

      let total_recebimentos_prazo = 0
      const { data: recRows, error: recErr } = await supabase
        .from('contas_receber')
        .select('valor, forma_recebimento')
        .eq('recebimento_caixa_id', caixaId)
        .eq('status', 'RECEBIDA')
      if (!recErr && recRows) {
        for (const r of recRows) {
          total_recebimentos_prazo += Number((r as { valor: number }).valor)
        }
      }

      const saldo_atual = saldo_base + total_vendas_caixa + total_recebimentos_prazo

      const totaisMap: Record<string, number> = {}
      if (vendaIds.length > 0) {
        const { data: pags } = await supabase.from('pagamentos').select('venda_id, forma, valor').in('venda_id', vendaIds)
        for (const p of pags ?? []) {
          const pv = p as { venda_id: string; forma: string; valor: number }
          const rowV = (vendasRows ?? []).find((x: { id: string }) => x.id === pv.venda_id)
          if (!rowV || isVendaPrazo(rowV as { id: string; venda_a_prazo?: number })) continue
          if (pv.forma === 'A_PRAZO') continue
          totaisMap[pv.forma] = (totaisMap[pv.forma] ?? 0) + Number(pv.valor)
        }
        if (!recErr && recRows) {
          for (const r of recRows) {
            const fr = (r as { forma_recebimento: string | null; valor: number }).forma_recebimento
            if (fr) {
              totaisMap[fr] = (totaisMap[fr] ?? 0) + Number((r as { valor: number }).valor)
            }
          }
        }
      }

      const totais_por_forma = Object.entries(totaisMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([forma, total]) => ({
          forma: forma as CaixaResumoFechamento['totais_por_forma'][number]['forma'],
          total,
        }))

      return { saldo_atual, totais_por_forma }
    },
    imprimirFechamento: async () => ({ ok: false, error: 'Impressão não disponível no modo web.' }),
    getHtmlFechamento: async () => null,
    listMovimentos: async (caixaId): Promise<CaixaMovimento[]> => {
      const { data, error } = await supabase
        .from('caixa_movimentos')
        .select('*')
        .eq('caixa_id', caixaId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as CaixaMovimento[]
    },
    registrarMovimento: async (d: RegistrarMovimentoCaixaInput): Promise<CaixaMovimento> => {
      const { data, error } = await supabase
        .from('caixa_movimentos')
        .insert({ ...d, id: crypto.randomUUID(), created_at: new Date().toISOString() })
        .select('*')
        .single()
      if (error) throw error
      return data as CaixaMovimento
    },
  },

  // ── Vendas ────────────────────────────────────────────────────────────────
  vendas: {
    finalizar: webFinalizarVenda,
    list: async (empresaId, options): Promise<VendaComNfce[]> => {
      const lim = options?.limit != null ? Math.min(Math.max(options.limit, 1), 50_000) : 10_000
      let query = supabase
        .from('vendas')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(lim)
      if (options?.dataInicio) query = query.gte('created_at', options.dataInicio)
      if (options?.dataFim) query = query.lte('created_at', options.dataFim)
      if (options?.periodo === 'hoje') {
        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)
        query = query.gte('created_at', hoje.toISOString())
      } else if (options?.periodo === 'semana') {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        query = query.gte('created_at', d.toISOString())
      } else if (options?.periodo === 'mes') {
        const d = new Date()
        d.setDate(1)
        d.setHours(0, 0, 0, 0)
        query = query.gte('created_at', d.toISOString())
      }
      const { data, error } = await query
      if (error) throw error
      const rows = (data ?? []) as VendaComNfce[]
      const ids = rows.map((v) => v.id)
      if (ids.length === 0) return rows
      const { data: pagsPrazo } = await supabase.from('pagamentos').select('venda_id').eq('forma', 'A_PRAZO').in('venda_id', ids)
      const prazoSet = new Set((pagsPrazo ?? []).map((p: { venda_id: string }) => p.venda_id))
      const nfceRows = await supabaseSelectInChunks<{ venda_id: string; status: string }>(
        'venda_nfce',
        'venda_id, status',
        'venda_id',
        ids
      )
      const nfeRows = await supabaseSelectInChunks<{ venda_id: string; status: string }>(
        'venda_nfe',
        'venda_id, status',
        'venda_id',
        ids
      )
      const nfceEmitida = new Set(nfceRows.filter((r) => r.status === 'AUTORIZADA').map((r) => r.venda_id))
      const nfeEmitida = new Set(nfeRows.filter((r) => r.status === 'AUTORIZADA').map((r) => r.venda_id))
      return rows.map((v) => ({
        ...v,
        venda_a_prazo: prazoSet.has(v.id) || Number(v.venda_a_prazo) === 1 ? 1 : 0,
        nfce_emitida: nfceEmitida.has(v.id),
        nfe_emitida: nfeEmitida.has(v.id),
      }))
    },
    get: async (id): Promise<Venda | null> => {
      const { data, error } = await supabase.from('vendas').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data as Venda | null
    },
    cancelar: async (vendaId, _usuarioId): Promise<Venda | null> => {
      const { data, error } = await supabase
        .from('vendas')
        .update({ status: 'CANCELADA' })
        .eq('id', vendaId)
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as Venda | null
    },
    updateCliente: async (vendaId, clienteId): Promise<Venda | null> => {
      const { data, error } = await supabase
        .from('vendas')
        .update({ cliente_id: clienteId })
        .eq('id', vendaId)
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as Venda | null
    },
    getStatusNfce: webGetStatusNfce,
    emitirNfce: async (vendaId: string) => {
      const session = loadSession()
      if (!session || !('empresa_id' in session)) {
        return { ok: false, error: 'Sessão inválida.' }
      }
      return fiscalApiPost('emitir-nfce', { vendaId, empresaId: session.empresa_id })
    },
    emitirNfe: async (vendaId: string) => {
      const session = loadSession()
      if (!session || !('empresa_id' in session)) {
        return { ok: false, error: 'Sessão inválida.' }
      }
      return fiscalApiPost('emitir-nfe', { vendaId, empresaId: session.empresa_id })
    },
  },

  // ── NFC-e ─────────────────────────────────────────────────────────────────
  nfce: {
    list: async (empresaId, options): Promise<NfceListItem[]> => {
      // Espelho Supabase: tabela `venda_nfce` (não `nfce`), FK em `vendas` — alinhado ao SQLite local.
      let vQuery = supabase
        .from('vendas')
        .select('id, numero, created_at, total, cliente_id, clientes(nome)')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
      if (options?.dataInicio) vQuery = vQuery.gte('created_at', options.dataInicio)
      if (options?.dataFim) vQuery = vQuery.lte('created_at', `${options.dataFim}T23:59:59.999`)
      const { data: vendasRows, error: vErr } = await vQuery
      if (vErr || !vendasRows?.length) return []
      const vendaIds = (vendasRows as { id: string }[]).map((v) => v.id)
      const notas = await supabaseSelectInChunks<Record<string, unknown>>(
        'venda_nfce',
        'venda_id, numero_nfce, status, chave, mensagem_sefaz',
        'venda_id',
        vendaIds,
        options?.status ? (q) => q.eq('status', options.status as string) : undefined
      )
      if (!notas.length) return []
      const vmap = new Map((vendasRows as Record<string, unknown>[]).map((v) => [v.id as string, v]))
      let rows: NfceListItem[] = notas.map((n) => {
        const v = vmap.get(n.venda_id as string)
        if (!v) return null
        return {
          venda_id: n.venda_id as string,
          numero_nfce: n.numero_nfce as number,
          status: n.status as NfceListItem['status'],
          chave: (n.chave as string) ?? null,
          mensagem_sefaz: (n.mensagem_sefaz as string) ?? null,
          venda_numero: v.numero as number,
          venda_created_at: String(v.created_at ?? ''),
          venda_total: Number(v.total),
          cliente_nome: webClienteNomeFromJoin(v.clientes),
        }
      }).filter((x): x is NfceListItem => x != null)
      if (options?.search?.trim()) {
        const t = options.search.trim().toLowerCase()
        rows = rows.filter(
          (r) =>
            String(r.numero_nfce).toLowerCase().includes(t) ||
            String(r.venda_numero).toLowerCase().includes(t) ||
            (r.cliente_nome && r.cliente_nome.toLowerCase().includes(t))
        )
      }
      rows.sort((a, b) => {
        const da = new Date(a.venda_created_at).getTime()
        const db = new Date(b.venda_created_at).getTime()
        return (Number.isFinite(db) ? db : 0) - (Number.isFinite(da) ? da : 0)
      })
      const lim = options?.limit ?? 1000
      return rows.slice(0, lim)
    },
    gerarDanfeA4: webGerarNfceDanfeA4,
    exportXmlZip: webExportNfceXmlZip,
  },

  // ── NF-e ──────────────────────────────────────────────────────────────────
  nfe: {
    previewDanfeA4: async (vendaId: string) => {
      const r = await webGetDanfePdfDataUrl(vendaId)
      if (!r.ok || !r.dataUrl) return { ok: false, error: r.error ?? 'DANFE não disponível.' }
      return { ok: true, dataUrl: r.dataUrl }
    },
    getDanfePdfPath: async () => ({ ok: false, error: 'No modo web o PDF fica na nuvem.' }),
    getDanfePdfDataUrl: webGetDanfePdfDataUrl,
    imprimirDanfeA4: async (vendaId: string) => {
      const r = await webGetDanfePdfDataUrl(vendaId)
      if (!r.ok || !r.dataUrl) return { ok: false, error: r.error ?? 'Erro ao obter DANFE.' }
      return webPrintPdfDataUrl(r.dataUrl)
    },
    gerarDanfeA4: webGetDanfePdfDataUrl,
    list: async (empresaId, options): Promise<NfeListItem[]> => {
      // Espelho Supabase: `venda_nfe` (não `nfe`), mesma lógica que NFC-e / backend local.
      let vQuery = supabase
        .from('vendas')
        .select('id, numero, created_at, total, cliente_id, clientes(nome)')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
      if (options?.dataInicio) vQuery = vQuery.gte('created_at', options.dataInicio)
      if (options?.dataFim) vQuery = vQuery.lte('created_at', `${options.dataFim}T23:59:59.999`)
      const { data: vendasRows, error: vErr } = await vQuery
      if (vErr || !vendasRows?.length) return []
      const vendaIds = (vendasRows as { id: string }[]).map((v) => v.id)
      const notas = await supabaseSelectInChunks<Record<string, unknown>>(
        'venda_nfe',
        'venda_id, numero_nfe, status, chave, mensagem_sefaz, created_at',
        'venda_id',
        vendaIds,
        options?.status ? (q) => q.eq('status', options.status as string) : undefined
      )
      if (!notas.length) return []
      const vmap = new Map((vendasRows as Record<string, unknown>[]).map((v) => [v.id as string, v]))
      let rows: NfeListItem[] = notas.map((n) => {
        const v = vmap.get(n.venda_id as string)
        if (!v) return null
        return {
          venda_id: n.venda_id as string,
          numero_nfe: n.numero_nfe as number,
          status: n.status as NfeStatus,
          chave: (n.chave as string) ?? null,
          mensagem_sefaz: (n.mensagem_sefaz as string) ?? null,
          nfe_created_at: n.created_at != null ? String(n.created_at) : null,
          venda_numero: v.numero as number,
          venda_created_at: String(v.created_at ?? ''),
          venda_total: Number(v.total),
          cliente_nome: webClienteNomeFromJoin(v.clientes),
        }
      }).filter((x): x is NfeListItem => x != null)
      if (options?.search?.trim()) {
        const t = options.search.trim().toLowerCase()
        rows = rows.filter(
          (r) =>
            String(r.numero_nfe).toLowerCase().includes(t) ||
            String(r.venda_numero).toLowerCase().includes(t) ||
            (r.cliente_nome && r.cliente_nome.toLowerCase().includes(t))
        )
      }
      rows.sort((a, b) => {
        const da = new Date(a.nfe_created_at || a.venda_created_at).getTime()
        const db = new Date(b.nfe_created_at || b.venda_created_at).getTime()
        return (Number.isFinite(db) ? db : 0) - (Number.isFinite(da) ? da : 0)
      })
      const lim = options?.limit ?? 1000
      return rows.slice(0, lim)
    },
  },

  // ── App ───────────────────────────────────────────────────────────────────
  app: {
    getVersion: async () => 'web',
    getInstallMode: async () => 'unknown' as const,
    getUpdateState: async () => ({ phase: 'idle' as const }),
    checkForUpdates: async () => ({ phase: 'idle' as const }),
    installUpdateNow: async () => ({ ok: false, message: 'Não disponível no modo web.' }),
  },

  // ── Sync ─────────────────────────────────────────────────────────────────
  sync: {
    run: async () => ({ success: true, sent: 0, errors: 0, message: 'Sync não disponível no modo web.' }),
    getPendingCount: async () => 0,
    checkOnline: async () => true,
    mirrorReconcile: async () => ({
      ok: true,
      hadMismatch: false,
      details: [] as string[],
      message: 'Reconciliação espelho só no app Electron.',
    }),
  },

  // ── Cupom ─────────────────────────────────────────────────────────────────
  cupom: {
    imprimir: async (vendaId: string) => {
      const detalhes = await webGetVendaDetalhes(vendaId)
      if (!detalhes) return { ok: false, error: 'Venda não encontrada.' }
      const body = cupomToHtml(detalhes, detalhes.cupom_empresa)
      return webPrintHtml(cupomNaoFiscalDocumentHtml(body))
    },
    imprimirReciboRecebimento: async (contaId: string) => {
      const data = await webGetReciboRecebimentoCupomData(contaId)
      if (!data) return { ok: false, error: 'Comprovante indisponível para esta conta.' }
      const body = reciboRecebimentoToHtml(data)
      return webPrintHtml(cupomNaoFiscalDocumentHtml(body))
    },
    imprimirNfce: async (vendaId: string) => {
      const html = await webBuildNfceCupomHtml(vendaId)
      if (!html) return { ok: false, error: 'NFC-e não emitida ou cupom indisponível.' }
      return webPrintHtml(html)
    },
    getDetalhes: webGetVendaDetalhes,
    getHtml: async (vendaId) => {
      const detalhes = await webGetVendaDetalhes(vendaId)
      if (!detalhes) return null
      return `<style>${CUPOM_NAO_FISCAL_STYLES}</style>${cupomToHtml(detalhes, detalhes.cupom_empresa)}`
    },
    getHtmlNfce: webBuildNfceCupomHtml,
    listPrinters: async () => [],
    getPreviewHtml: async () => '',
  },

  // ── Contas a receber ──────────────────────────────────────────────────────
  contasReceber: {
    getVendaPrazoConfig: webGetVendaPrazoConfig,
    updateVendaPrazoConfig: webUpdateVendaPrazoConfig,
    list: webListContasReceber,
    receber: webReceberConta,
    listHistoricoPrazo: webListHistoricoPrazo,
    getTotalAbertoCliente: webGetTotalAbertoCliente,
  },

  cashback: {
    getConfig: async () => ({}),
    updateConfig: async () => ({}),
    listRegras: async () => [],
    createRegra: async () => ({}),
    deleteRegra: async () => false,
    getSaldoCliente: async () => null,
    getSaldoCpf: async () => null,
    listMovimentacoes: async () => [],
    listClientes: async () => [],
    ajusteManual: async () => ({ ok: false }),
    setBloqueio: async () => ({ ok: false }),
    relatorio: async () => ({
      total_gerado: 0,
      total_usado: 0,
      total_expirado: 0,
      total_ajuste_credito: 0,
      total_ajuste_debito: 0,
    }),
  },

  // ── Etiquetas ─────────────────────────────────────────────────────────────
  etiquetas: {
    listTemplates: async () => [],
    listPrinters: async () => [],
    getPrinterStatus: async (name) => ({ name, online: false, detail: 'Não disponível no modo web.' }),
    preview: async () => notSupported('etiquetas.preview'),
    print: async () => ({ ok: false, error: 'Impressão não disponível no modo web.' }),
    imprimir: async () => ({ ok: false, error: 'Impressão não disponível no modo web.' }),
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: {
    login: async (email: string, senha: string): Promise<UsuarioSession | null> => {
      const session = await authenticateByEmail(email, senha)
      saveSession(session)
      return session
    },
    register: async (data: RegisterInput): Promise<UsuarioSession> => {
      const nome = data.nome.trim()
      const nomeEmpresa = data.nomeEmpresa.trim()
      const email = data.email.trim().toLowerCase()
      const cnpjDigits = onlyDigits(data.cnpj)

      if (!nome) throw new Error('Informe o nome completo.')
      if (!nomeEmpresa) throw new Error('Informe o nome da empresa.')
      if (!email) throw new Error('Informe o e-mail.')
      if (!isValidEmail(email)) throw new Error('E-mail inválido.')
      if (!cnpjDigits) throw new Error('Informe o CNPJ.')
      if (!isValidCNPJ(cnpjDigits)) throw new Error('CNPJ inválido.')
      if (!data.senha || data.senha.length < 6) throw new Error('A senha deve ter no mínimo 6 caracteres.')

      const { data: existingByEmail, error: emailLookupErr } = await supabase
        .from('usuarios')
        .select('id')
        .ilike('email', email)
        .limit(1)
      if (emailLookupErr && !emailLookupErr.message.includes('email')) {
        throw new Error(`Falha ao verificar e-mail: ${emailLookupErr.message}`)
      }
      if ((existingByEmail ?? []).length > 0) throw new Error('Este e-mail já está cadastrado.')

      const { data: existingByLogin, error: loginLookupErr } = await supabase
        .from('usuarios')
        .select('id')
        .ilike('login', email)
        .limit(1)
      if (loginLookupErr) throw new Error(`Falha ao verificar e-mail: ${loginLookupErr.message}`)
      if ((existingByLogin ?? []).length > 0) throw new Error('Este e-mail já está cadastrado.')

      const { data: existingEmpresa, error: empresaLookupErr } = await supabase
        .from('empresas')
        .select('id')
        .eq('cnpj', cnpjDigits)
        .limit(1)
      if (empresaLookupErr) throw new Error(`Falha ao verificar CNPJ: ${empresaLookupErr.message}`)
      if ((existingEmpresa ?? []).length > 0) throw new Error('Este CNPJ já está cadastrado.')

      const empresaId = crypto.randomUUID()
      const usuarioId = crypto.randomUUID()
      const senhaHash = await hashSenhaWeb(data.senha)
      const createdAt = new Date().toISOString()

      const { error: empresaErr } = await supabase.from('empresas').insert({
        id: empresaId,
        nome: nomeEmpresa,
        cnpj: cnpjDigits,
        codigo_acesso: null,
        created_at: createdAt,
      })
      if (empresaErr) throw new Error(`Falha ao criar empresa: ${empresaErr.message}`)

      const { error: configErr } = await supabase.from('empresas_config').insert({
        empresa_id: empresaId,
        razao_social: nomeEmpresa,
        email,
        cor_primaria: '#1d4ed8',
        modulos_json: DEFAULT_MODULOS_JSON,
      })
      if (configErr) throw new Error(`Falha ao configurar empresa: ${configErr.message}`)

      const loginFromEmail = email.split('@')[0] || email
      const { error: usuarioErr } = await supabase.from('usuarios').insert({
        id: usuarioId,
        empresa_id: empresaId,
        nome,
        login: loginFromEmail,
        email,
        role: 'admin',
        senha_hash: senhaHash,
        created_at: createdAt,
      })
      if (usuarioErr) {
        await supabase.from('empresas_config').delete().eq('empresa_id', empresaId)
        await supabase.from('empresas').delete().eq('id', empresaId)
        throw new Error(`Falha ao criar usuário: ${usuarioErr.message}`)
      }

      const trialFim = new Date()
      trialFim.setDate(trialFim.getDate() + 7)
      const { error: assinaturaErr } = await supabase.from('empresa_assinaturas').insert({
        empresa_id: empresaId,
        status: 'trial',
        plano: 'basic',
        valor_mensal: 89.9,
        periodo_inicio: createdAt,
        trial_fim: trialFim.toISOString(),
        created_at: createdAt,
        updated_at: createdAt,
      })
      if (assinaturaErr) {
        console.warn('[web] Falha ao criar assinatura trial:', assinaturaErr.message)
      }

      const session: UsuarioSession = {
        id: usuarioId,
        empresa_id: empresaId,
        nome,
        login: loginFromEmail,
        email,
        role: 'admin',
        modulos_json: null,
        created_at: createdAt,
      }
      saveSession(session)
      return session
    },
    supportLogin: async (_login: string, _senha: string) => {
      // Login de suporte não disponível no modo web (suporte_usuarios não é sincronizado)
      return null
    },
    getSession: async (): Promise<AppSession | null> => {
      const base = loadSession()
      if (!base || 'suporte' in base) return base
      try {
        const row = await selectUsuarioById(base.id)
        if (!row) {
          saveSession(null)
          return null
        }
        const session: UsuarioSession = {
          id: row.id as string,
          empresa_id: row.empresa_id as string,
          nome: row.nome as string,
          login: row.login as string,
          email: (row.email as string | null) ?? null,
          role: row.role as string,
          modulos_json: (row.modulos_json as string | null) ?? null,
          created_at: String(row.created_at ?? ''),
        }
        saveSession(session)
        return session
      } catch {
        return base
      }
    },
    logout: async (): Promise<void> => saveSession(null),
  },

  // ── Backup ───────────────────────────────────────────────────────────────
  backup: {
    getDbPath: async () => ({ path: null, folder: null }),
    openDbFolder: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    exportToFolder: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    uploadToSupabase: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    restoreFromFile: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    restoreFromSupabase: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    listEmpresasSupabase: async () => [],
    listBackupsByEmpresa: async () => [],
    downloadBackup: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    runAutoBackup: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
    runManualBackupForEmpresa: async () => ({ ok: false, error: 'Não disponível no modo web.' }),
  },

  importSqliteToPostgres: {
    listEmpresas: async () => ({ ok: false as const, path: '', error: 'Disponível apenas no app desktop.' }),
    pickSqliteFile: async () => ({ ok: false as const, error: 'Disponível apenas no app desktop.' }),
    run: async () => ({ ok: false, error: 'Disponível apenas no app desktop.' }),
  },

  // ── Certificado ───────────────────────────────────────────────────────────
  certificado: {
    getStatus: async (empresaId: string) => {
      const { data, error } = await supabase
        .from('empresa_certificado')
        .select('storage_path, updated_at')
        .eq('empresa_id', empresaId)
        .maybeSingle()
      if (error) {
        if (isCertTableMissingError(error.message)) {
          return { hasCertificado: false, path: null, updatedAt: null }
        }
        throw error
      }
      if (!data?.storage_path) return { hasCertificado: false, path: null, updatedAt: null }
      return {
        hasCertificado: true,
        path: String(data.storage_path),
        updatedAt: data.updated_at ? String(data.updated_at) : null,
      }
    },
    selectAndUpload: async (empresaId: string, senha: string, file?: File) => {
      try {
        if (!file) {
          return { ok: false, error: 'Selecione o arquivo .pfx ou .p12.' }
        }
        if (!senha.trim()) {
          return { ok: false, error: 'Informe a senha do certificado.' }
        }
        const name = file.name.toLowerCase()
        if (!name.endsWith('.pfx') && !name.endsWith('.p12')) {
          return { ok: false, error: 'Arquivo inválido. Use .pfx ou .p12.' }
        }
        if (file.size > MAX_CERT_BYTES) {
          return { ok: false, error: 'Arquivo muito grande. Máximo 5 MB.' }
        }

        const storagePath = certStoragePath(empresaId)
        const senhaEncrypted = await encryptCertSenha(empresaId, senha)
        const { error: uploadErr } = await supabase.storage
          .from(CERT_STORAGE_BUCKET)
          .upload(storagePath, file, { upsert: true, contentType: 'application/x-pkcs12' })
        if (uploadErr) {
          const msg = uploadErr.message
          if (isCertBucketMissingError(msg) || isCertTableMissingError(msg)) {
            return {
              ok: false,
              error:
                'Infraestrutura de certificado não configurada no Supabase. Execute docs/supabase-empresa-certificado.sql no SQL Editor.',
            }
          }
          return { ok: false, error: msg || 'Erro ao enviar arquivo do certificado.' }
        }

        const { error: dbErr } = await supabase.from('empresa_certificado').upsert(
          {
            empresa_id: empresaId,
            storage_path: storagePath,
            senha_encrypted: senhaEncrypted,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'empresa_id' }
        )
        if (dbErr) {
          if (isCertTableMissingError(dbErr.message)) {
            return {
              ok: false,
              error:
                'Tabela empresa_certificado não encontrada. Execute docs/supabase-empresa-certificado.sql no SQL Editor.',
            }
          }
          return { ok: false, error: dbErr.message || 'Erro ao salvar certificado.' }
        }
        return { ok: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { ok: false, error: msg || 'Erro ao instalar certificado.' }
      }
    },
    remove: async (empresaId: string) => {
      try {
        const { data, error } = await supabase
          .from('empresa_certificado')
          .select('storage_path')
          .eq('empresa_id', empresaId)
          .maybeSingle()
        if (error) {
          if (isCertTableMissingError(error.message)) return { ok: true }
          throw error
        }
        if (data?.storage_path) {
          await supabase.storage.from(CERT_STORAGE_BUCKET).remove([String(data.storage_path)])
        }
        const { error: delErr } = await supabase.from('empresa_certificado').delete().eq('empresa_id', empresaId)
        if (delErr && !isCertTableMissingError(delErr.message)) {
          return { ok: false, error: delErr.message }
        }
        return { ok: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { ok: false, error: msg || 'Erro ao remover certificado.' }
      }
    },
  },

  // ── Config ────────────────────────────────────────────────────────────────
  config: {
    get: async () => null,
    set: async () => ({ ok: false }),
    setDbPath: async () => ({ ok: false }),
  },

  // ── Server ────────────────────────────────────────────────────────────────
  network: {
    getLocalIPv4s: async () => [],
  },
  terminais: {
    listConectados: async () =>
      ({
        ok: false,
        error: 'Disponível apenas no app desktop.',
        terminais: [],
        total: 0,
        apiBase: null,
        installMode: 'unknown' as const,
      } as const),
  },
  server: {
    getUrl: async () => null,
    discover: async () => ({ found: false } as const),
    onUrlUpdated: (_callback: (url: string) => void) => () => {},
  },
}
