import { getDb, getDbPath } from '../db'
import { getVendaById } from './vendas.service'
import { getFiscalConfig } from './empresas.service'
import { getEmpresaConfig } from './empresas.service'
import { buildNFePayload, getVendaItensParaNfce, getVendaPagamentosParaNfce } from './nfce-builder'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../electron/supabase-config.generated'

/** NFCEWizard é carregado sob demanda para evitar erro de bindings nativos (libxmljs2) no startup do Electron. */
async function loadNFCEWizard(): Promise<typeof import('@nfewizard/nfce').NFCEWizard> {
  const mod = await import('@nfewizard/nfce')
  return mod.NFCEWizard
}

export type StatusNfce = {
  emitida: boolean
  status: 'PENDENTE' | 'AUTORIZADA' | 'REJEITADA' | 'ERRO' | 'CANCELADA' | null
  chave: string | null
  protocolo: string | null
  numero_nfce: number | null
  mensagem: string | null
  /** Caminho local do XML autorizado da NFC-e (se salvo). */
  xml_local_path?: string | null
}

/** Retorna o status da NFC-e da venda (se existir). */
export function getStatusNfce(vendaId: string): StatusNfce | null {
  const db = getDb()
  if (!db) return null
  const venda = getVendaById(vendaId)
  if (!venda) return null

  const row = db.prepare(`
    SELECT numero_nfce, status, chave, protocolo, mensagem_sefaz, xml_local_path
    FROM venda_nfce WHERE venda_id = ?
  `).get(vendaId) as {
    numero_nfce: number
    status: string
    chave: string | null
    protocolo: string | null
    mensagem_sefaz: string | null
    xml_local_path: string | null
  } | undefined

  if (!row) {
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
    emitida: row.status === 'AUTORIZADA',
    status: row.status as StatusNfce['status'],
    chave: row.chave ?? null,
    protocolo: row.protocolo ?? null,
    numero_nfce: row.numero_nfce,
    mensagem: row.mensagem_sefaz ?? null,
    xml_local_path: row.xml_local_path ?? null,
  }
}

export type EmitirNfceResult = {
  ok: boolean
  chave?: string
  protocolo?: string
  error?: string
}

const NFCE_XML_BUCKET = 'nfce-xml'

function getSupabaseForNfceXml(): SupabaseClient | null {
  const url = SUPABASE_URL ?? ''
  const key = SUPABASE_ANON_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key)
}

function formatProviderLimitError(message: string): string | null {
  if (!/(hit your limit|you have hit your limit|resets\s+\S+)/i.test(message)) return null

  const m = message.match(/resets\s+(.+?)\s*\(([^)]+)\)/i)
  if (m?.[1] && m?.[2]) {
    const reset = m[1].trim()
    const tz = m[2].trim()
    return `Limite do provedor de NFC-e atingido. O limite será reiniciado em ${reset} (${tz}). Aguarde e tente novamente.`
  }

  return 'Limite do provedor de NFC-e atingido. Aguarde o reset do limite e tente novamente.'
}

/** Converte ISO (ex: 2026-03-04T03:00:00.000Z) para formato SQLite (YYYY-MM-DD HH:MM:SS). */
function isoToSqliteDatetime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

export type NfceStatus = 'PENDENTE' | 'AUTORIZADA' | 'REJEITADA' | 'ERRO' | 'CANCELADA'

export type NfceListItem = {
  venda_id: string
  numero_nfce: number
  status: NfceStatus
  chave: string | null
  mensagem_sefaz: string | null
  venda_numero: number
  venda_created_at: string
  venda_total: number
  cliente_nome: string | null
}

export type ListNfceOptions = {
  dataInicio?: string
  dataFim?: string
  status?: NfceStatus
  search?: string
  limit?: number
}

/** Lista todas as NFC-e da empresa (venda_nfce + vendas + cliente), com filtros opcionais. */
export function listNfce(empresaId: string, options?: ListNfceOptions): NfceListItem[] {
  const db = getDb()
  if (!db) return []
  const limit = options?.limit ?? 1000
  const conditions: string[] = ['v.empresa_id = ?']
  const params: (string | number)[] = [empresaId]
  if (options?.dataInicio) {
    conditions.push("v.created_at >= ?")
    params.push(isoToSqliteDatetime(options.dataInicio))
  }
  if (options?.dataFim) {
    conditions.push("v.created_at <= ?")
    params.push(isoToSqliteDatetime(options.dataFim))
  }
  if (options?.status) {
    conditions.push('n.status = ?')
    params.push(options.status)
  }
  if (options?.search?.trim()) {
    const term = `%${options.search.trim()}%`
    conditions.push('(CAST(n.numero_nfce AS TEXT) LIKE ? OR CAST(v.numero AS TEXT) LIKE ? OR c.nome LIKE ?)')
    params.push(term, term, term)
  }
  const where = conditions.join(' AND ')
  const sql = `
    SELECT n.venda_id, n.numero_nfce, n.status, n.chave, n.mensagem_sefaz,
           v.numero AS venda_numero, v.created_at AS venda_created_at, v.total AS venda_total,
           c.nome AS cliente_nome
    FROM venda_nfce n
    INNER JOIN vendas v ON v.id = n.venda_id
    LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE ${where}
    ORDER BY v.created_at DESC
    LIMIT ?
  `
  params.push(limit)
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map((r) => ({
    venda_id: r.venda_id as string,
    numero_nfce: r.numero_nfce as number,
    status: r.status as NfceStatus,
    chave: (r.chave as string) ?? null,
    mensagem_sefaz: (r.mensagem_sefaz as string) ?? null,
    venda_numero: r.venda_numero as number,
    venda_created_at: r.venda_created_at as string,
    venda_total: r.venda_total as number,
    cliente_nome: (r.cliente_nome as string) ?? null,
  }))
}

/**
 * Tenta emitir NFC-e para a venda (integração SEFAZ).
 * Certificado (path e senha) deve ser passado pelo processo main (Electron) após descriptografar.
 */
export async function emitirNfce(
  vendaId: string,
  certPath: string,
  certSenha: string
): Promise<EmitirNfceResult> {
  const db = getDb()
  if (!db) return { ok: false, error: 'Banco não inicializado.' }

  const venda = getVendaById(vendaId)
  if (!venda) return { ok: false, error: 'Venda não encontrada.' }
  if (venda.status !== 'CONCLUIDA') {
    return { ok: false, error: 'Apenas vendas concluídas podem emitir NFC-e.' }
  }

  const existing = getStatusNfce(vendaId)
  if (existing?.emitida) {
    return { ok: false, error: 'Esta venda já possui NFC-e autorizada.' }
  }

  const fiscal = getFiscalConfig(venda.empresa_id)
  if (!fiscal) return { ok: false, error: 'Configuração fiscal não encontrada.' }
  if (!fiscal.csc_nfce || !fiscal.csc_id_nfce) {
    return { ok: false, error: 'Configure o CSC e o ID do token na página Notas fiscais.' }
  }

  const empresaConfig = getEmpresaConfig(venda.empresa_id)
  if (!empresaConfig?.cnpj?.replace(/\D/g, '')) {
    return { ok: false, error: 'CNPJ da empresa não configurado.' }
  }

  const itens = getVendaItensParaNfce(vendaId)
  const pagamentos = getVendaPagamentosParaNfce(vendaId)
  if (!itens.length) return { ok: false, error: 'Venda sem itens.' }
  if (!pagamentos.length) return { ok: false, error: 'Venda sem pagamentos.' }

  // Sempre usar o próximo número sequencial (evita duplicidade quando há tentativas anteriores
  // ou quando outra venda já usou o número que estava na linha de venda_nfce).
  const numeroNfce = fiscal.ultimo_numero_nfce + 1
  const rowExistente = db.prepare('SELECT numero_nfce, status FROM venda_nfce WHERE venda_id = ?').get(vendaId) as
    | { numero_nfce: number; status: string }
    | undefined

  if (!rowExistente) {
    db.prepare(`
      INSERT INTO venda_nfce (venda_id, numero_nfce, status, updated_at)
      VALUES (?, ?, 'PENDENTE', datetime('now'))
    `).run(vendaId, numeroNfce)
  } else {
    db.prepare(`
      UPDATE venda_nfce SET numero_nfce = ?, status = 'PENDENTE', mensagem_sefaz = NULL, updated_at = datetime('now') WHERE venda_id = ?
    `).run(numeroNfce, vendaId)
  }

  const cnpjNumeros = empresaConfig.cnpj.replace(/\D/g, '')
  const idCSC = parseInt(fiscal.csc_id_nfce, 10) || 1

  try {
    const NFCEWizard = await loadNFCEWizard()
    const wizard = new NFCEWizard()
    await wizard.NFE_LoadEnvironment({
      config: {
        dfe: {
          pathCertificado: certPath,
          senhaCertificado: certSenha,
          UF: fiscal.uf_emitente,
          CPFCNPJ: cnpjNumeros,
        },
        nfe: {
          ambiente: fiscal.ambiente === 'homologacao' ? 2 : 1,
          versaoDF: '4.00',
          tokenCSC: fiscal.csc_nfce,
          idCSC,
        },
        lib: {
          useForSchemaValidation: 'validateSchemaJsBased',
        },
      },
    })

    const payload = buildNFePayload({
      venda,
      numeroNfce,
      fiscal,
      empresa: empresaConfig,
      itens,
      pagamentos,
    })

    const xmls = await wizard.NFCE_Autorizacao(payload)
    if (!xmls || !Array.isArray(xmls) || xmls.length === 0) {
      const msg = 'SEFAZ não retornou protocolo.'
      db.prepare(`UPDATE venda_nfce SET status = 'ERRO', mensagem_sefaz = ?, updated_at = datetime('now') WHERE venda_id = ?`).run(msg, vendaId)
      return { ok: false, error: msg }
    }

    const first = xmls[0] as {
      xml?: string
      protNFe?: { infProt?: { chNFe?: string; nProt?: string; xMotivo?: string } | Array<{ chNFe?: string; nProt?: string; xMotivo?: string }> }
    } | string | undefined
    const infProtRaw = first?.protNFe?.infProt
    const infProt = Array.isArray(infProtRaw) ? infProtRaw[0] : infProtRaw
    const chave = infProt?.chNFe ?? null
    const protocolo = infProt?.nProt ?? null
    const xMotivo = infProt?.xMotivo ?? 'Autorizada'

    // Extrai XML autorizado (se disponível)
    let xmlAutorizado: string | null = null
    if (typeof first === 'string') {
      xmlAutorizado = first
    } else if (first && typeof (first as { xml?: string }).xml === 'string') {
      xmlAutorizado = (first as { xml?: string }).xml ?? null
    }

    // Salva XML localmente (pasta ao lado do banco, por empresa)
    let xmlLocalPath: string | null = null
    let xmlSupabasePath: string | null = null
    if (xmlAutorizado && chave) {
      const dbPath = getDbPath()
      if (dbPath) {
        const baseDir = dirname(dbPath)
        const empresaDir = join(baseDir, 'nfce-xml', venda.empresa_id)
        if (!existsSync(empresaDir)) {
          mkdirSync(empresaDir, { recursive: true })
        }
        const fileName = `${chave}.xml`
        const fullPath = join(empresaDir, fileName)
        try {
          writeFileSync(fullPath, xmlAutorizado, { encoding: 'utf-8' })
          xmlLocalPath = fullPath
        } catch {
          xmlLocalPath = null
        }
      }

      // Envia cópia para Supabase Storage (se configurado)
      const supabase = getSupabaseForNfceXml()
      if (supabase) {
        const remotePath = `${venda.empresa_id}/${chave}.xml`
        try {
          const { error } = await supabase.storage
            .from(NFCE_XML_BUCKET)
            .upload(remotePath, Buffer.from(xmlAutorizado, 'utf-8'), {
              upsert: true,
              contentType: 'application/xml',
            })
          if (!error) {
            xmlSupabasePath = remotePath
          }
        } catch {
          xmlSupabasePath = null
        }
      }
    }

    db.prepare(`
      UPDATE venda_nfce SET status = 'AUTORIZADA', chave = ?, protocolo = ?, mensagem_sefaz = ?, xml_local_path = ?, xml_supabase_path = ?, updated_at = datetime('now') WHERE venda_id = ?
    `).run(chave, protocolo, xMotivo, xmlLocalPath, xmlSupabasePath, vendaId)

    // Sempre atualiza o último número de NFC-e autorizado para a empresa,
    // garantindo que a próxima emissão use o próximo número sequencial.
    db.prepare(`UPDATE empresas_config SET ultimo_numero_nfce = ?, updated_at = datetime('now') WHERE empresa_id = ?`).run(
      numeroNfce,
      venda.empresa_id
    )

    return {
      ok: true,
      chave: chave ?? undefined,
      protocolo: protocolo ?? undefined,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const isBindingsError = /bindings file|libxmljs2|Could not locate/.test(message)
    const limitMessage = formatProviderLimitError(message)
    const isLimitError = limitMessage != null
    const userMessage = isBindingsError
      ? 'Módulo nativo da emissão NFC-e não encontrado. Rode no terminal: npx electron-rebuild'
      : limitMessage ?? message
    const nextStatus: StatusNfce['status'] = isLimitError ? 'ERRO' : 'REJEITADA'

    if (isLimitError) {
      console.error('[NFC-e] emitirNfce: provedor com limite atingido:', message)
    }
    db.prepare(`
      UPDATE venda_nfce SET status = ?, mensagem_sefaz = ?, updated_at = datetime('now') WHERE venda_id = ?
    `).run(nextStatus, message, vendaId)
    return { ok: false, error: userMessage }
  }
}

export type NfceXmlRow = {
  venda_id: string
  chave: string | null
  xml_local_path: string | null
}

/** Retorna os caminhos locais dos XML das NFC-e autorizadas para os IDs de venda informados. */
export function getNfceXmlRowsForVendas(empresaId: string, vendaIds: string[]): NfceXmlRow[] {
  const db = getDb()
  if (!db) return []
  if (!vendaIds.length) return []

  const placeholders = vendaIds.map(() => '?').join(',')
  const sql = `
    SELECT n.venda_id, n.chave, n.xml_local_path
    FROM venda_nfce n
    INNER JOIN vendas v ON v.id = n.venda_id
    WHERE v.empresa_id = ?
      AND n.status = 'AUTORIZADA'
      AND n.venda_id IN (${placeholders})
  `
  const rows = db.prepare(sql).all(empresaId, ...vendaIds) as {
    venda_id: string
    chave: string | null
    xml_local_path: string | null
  }[]
  return rows
}
