import { getDb, getDbPath } from '../db'
import { getVendaById } from './vendas.service'
import { getFiscalConfig, getEmpresaConfig } from './empresas.service'
import { getClienteById } from './clientes.service'
import { buildNfePayload } from './nfe-builder'
import { getVendaItensParaNfce, getVendaPagamentosParaNfce } from './nfce-builder'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../electron/supabase-config.generated'

/** NFeWizard (nfewizard-io) é carregado sob demanda para evitar erro de bindings nativos no startup. */
async function loadNFeWizard(): Promise<typeof import('nfewizard-io').default> {
  const mod = await import('nfewizard-io')
  return mod.default
}

const NFE_XML_BUCKET = 'nfe-xml'

function getSupabaseForNfeXml() {
  const url = SUPABASE_URL ?? ''
  const key = SUPABASE_ANON_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key)
}

function formatProviderLimitError(message: string): string | null {
  // Mensagem típica quando a API/portal do provedor está com quota/rate-limit:
  // "You've hit your limit. resets 2pm (America/Sao_Paulo)"
  if (!/(hit your limit|you have hit your limit|resets\s+\S+)/i.test(message)) return null

  const m = message.match(/resets\s+(.+?)\s*\(([^)]+)\)/i)
  if (m?.[1] && m?.[2]) {
    const reset = m[1].trim()
    const tz = m[2].trim()
    return `Limite do provedor de NF-e atingido. O limite será reiniciado em ${reset} (${tz}). Aguarde e tente novamente.`
  }

  return 'Limite do provedor de NF-e atingido. Aguarde o reset do limite e tente novamente.'
}

export type NfeStatus = 'PENDENTE' | 'AUTORIZADA' | 'REJEITADA' | 'ERRO' | 'CANCELADA'

export type StatusNfe = {
  emitida: boolean
  status: NfeStatus | null
  chave: string | null
  protocolo: string | null
  numero_nfe: number | null
  mensagem: string | null
  xml_local_path?: string | null
}

export type EmitirNfeResult = {
  ok: boolean
  chave?: string
  protocolo?: string
  error?: string
}

/** Gera um PDF de pré-visualização DANFE (sem envio à SEFAZ). */
export async function gerarPreviewDanfePdf(vendaId: string): Promise<{ ok: boolean; pdfPath?: string; error?: string }> {
  const db = getDb()
  if (!db) return { ok: false, error: 'Banco não inicializado.' }

  const venda = getVendaById(vendaId)
  if (!venda) return { ok: false, error: 'Venda não encontrada.' }

  const fiscal = getFiscalConfig(venda.empresa_id)
  if (!fiscal) return { ok: false, error: 'Configuração fiscal não encontrada.' }

  const empresaConfig = getEmpresaConfig(venda.empresa_id)
  if (!empresaConfig?.cnpj?.replace(/\D/g, '')) {
    return { ok: false, error: 'CNPJ da empresa não configurado.' }
  }

  if (!venda.cliente_id) {
    return { ok: false, error: 'Selecione um cliente para pré-visualizar o DANFE (modelo 55).' }
  }
  const cliente = getClienteById(venda.cliente_id)
  if (!cliente) return { ok: false, error: 'Cliente não encontrado.' }

  const itens = getVendaItensParaNfce(vendaId)
  const pagamentos = getVendaPagamentosParaNfce(vendaId)
  if (!itens.length) return { ok: false, error: 'Venda sem itens.' }
  if (!pagamentos.length) return { ok: false, error: 'Venda sem pagamentos.' }

  const payload = buildNfePayload({
    venda,
    numeroNfe: fiscal.ultimo_numero_nfe + 1,
    fiscal,
    empresa: empresaConfig,
    cliente,
    itens,
    pagamentos,
  })

  const dbPath = getDbPath()
  if (!dbPath) return { ok: false, error: 'Banco de dados não inicializado.' }
  const baseDir = dirname(dbPath)
  const previewDir = join(baseDir, 'nfe-danfe-preview', venda.empresa_id)
  if (!existsSync(previewDir)) mkdirSync(previewDir, { recursive: true })

  const pdfPath = join(previewDir, `preview-${vendaId}.pdf`)

  try {
    const { NFE_GerarDanfe } = await import('@nfewizard/danfe')
    const danfeResult = await NFE_GerarDanfe({
      data: {
        NFe: payload.NFe as unknown,
        protNFe: undefined,
        forceTransmitida: true,
      },
      chave: '00000000000000000000000000000000000000000000',
      outputPath: pdfPath,
    })
    if (danfeResult?.success) {
      return { ok: true, pdfPath }
    }
    return { ok: false, error: danfeResult?.message ?? 'Erro ao gerar DANFE de prévia.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

/** Regenera o PDF DANFE de uma NF-e já autorizada, reconstruindo o payload a partir do banco. */
export async function regenerarDanfePdf(vendaId: string): Promise<{ ok: boolean; pdfPath?: string; error?: string }> {
  const db = getDb()
  if (!db) return { ok: false, error: 'Banco não inicializado.' }

  const statusNfe = getStatusNfe(vendaId)
  if (!statusNfe?.emitida || !statusNfe.chave) {
    return { ok: false, error: 'NF-e não autorizada para esta venda.' }
  }

  const venda = getVendaById(vendaId)
  if (!venda) return { ok: false, error: 'Venda não encontrada.' }

  const fiscal = getFiscalConfig(venda.empresa_id)
  if (!fiscal) return { ok: false, error: 'Configuração fiscal não encontrada.' }

  const empresaConfig = getEmpresaConfig(venda.empresa_id)
  if (!empresaConfig) return { ok: false, error: 'Configuração da empresa não encontrada.' }

  const cliente = venda.cliente_id ? getClienteById(venda.cliente_id) : null
  if (!cliente) return { ok: false, error: 'Cliente não encontrado para regerar DANFE.' }

  const itens = getVendaItensParaNfce(vendaId)
  const pagamentos = getVendaPagamentosParaNfce(vendaId)
  if (!itens.length) return { ok: false, error: 'Venda sem itens.' }

  const row = db.prepare('SELECT numero_nfe, protocolo FROM venda_nfe WHERE venda_id = ?').get(vendaId) as
    | { numero_nfe: number; protocolo: string | null }
    | undefined
  if (!row) return { ok: false, error: 'Registro venda_nfe não encontrado.' }

  const payload = buildNfePayload({
    venda,
    numeroNfe: row.numero_nfe,
    fiscal,
    empresa: empresaConfig,
    cliente: cliente!,
    itens,
    pagamentos,
  })

  const dbPath = getDbPath()
  if (!dbPath) return { ok: false, error: 'Banco de dados não inicializado.' }
  const baseDir = dirname(dbPath)
  const empresaDanfeDir = join(baseDir, 'nfe-danfe', venda.empresa_id)
  if (!existsSync(empresaDanfeDir)) mkdirSync(empresaDanfeDir, { recursive: true })

  const pdfPath = join(empresaDanfeDir, `${statusNfe.chave}.pdf`)

  try {
    const { NFE_GerarDanfe } = await import('@nfewizard/danfe')
    const danfeResult = await NFE_GerarDanfe({
      data: {
        NFe: payload.NFe as unknown,
        protNFe: row.protocolo ? { infProt: { nProt: row.protocolo, chNFe: statusNfe.chave } } as unknown : undefined,
        forceTransmitida: true,
      },
      chave: statusNfe.chave,
      outputPath: pdfPath,
    })
    if (danfeResult?.success) {
      return { ok: true, pdfPath }
    }
    return { ok: false, error: danfeResult?.message ?? 'Erro ao regerar DANFE.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

/** Retorna o status da NF-e (modelo 55) vinculada à venda (se existir). */
export function getStatusNfe(vendaId: string): StatusNfe | null {
  const db = getDb()
  if (!db) return null
  const venda = getVendaById(vendaId)
  if (!venda) return null

  const row = db
    .prepare(
      `
      SELECT numero_nfe, status, chave, protocolo, mensagem_sefaz, xml_local_path
      FROM venda_nfe
      WHERE venda_id = ?
    `
    )
    .get(vendaId) as
    | {
        numero_nfe: number
        status: string
        chave: string | null
        protocolo: string | null
        mensagem_sefaz: string | null
        xml_local_path: string | null
      }
    | undefined

  if (!row) {
    return {
      emitida: false,
      status: null,
      chave: null,
      protocolo: null,
      numero_nfe: null,
      mensagem: null,
      xml_local_path: null,
    }
  }

  return {
    emitida: row.status === 'AUTORIZADA',
    status: row.status as NfeStatus,
    chave: row.chave ?? null,
    protocolo: row.protocolo ?? null,
    numero_nfe: row.numero_nfe,
    mensagem: row.mensagem_sefaz ?? null,
    xml_local_path: row.xml_local_path ?? null,
  }
}

export type NfeListItem = {
  venda_id: string
  numero_nfe: number
  status: NfeStatus
  chave: string | null
  mensagem_sefaz: string | null
  venda_numero: number
  venda_created_at: string
  nfe_created_at: string | null
  venda_total: number
  cliente_nome: string | null
}

export type ListNfeOptions = {
  dataInicio?: string
  dataFim?: string
  status?: NfeStatus
  search?: string
  limit?: number
}

/** Converte ISO (ex: 2026-03-04T03:00:00.000Z) para formato SQLite (YYYY-MM-DD HH:MM:SS). */
function isoToSqliteDatetime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes()
  )}:${pad(d.getUTCSeconds())}`
}

/** Lista todas as NF-e da empresa (venda_nfe + vendas + cliente), com filtros opcionais. */
export function listNfe(empresaId: string, options?: ListNfeOptions): NfeListItem[] {
  const db = getDb()
  if (!db) return []

  const limit = options?.limit ?? 1000
  const conditions: string[] = ['v.empresa_id = ?']
  const params: (string | number)[] = [empresaId]

  if (options?.dataInicio) {
    conditions.push('n.created_at >= ?')
    params.push(isoToSqliteDatetime(options.dataInicio))
  }
  if (options?.dataFim) {
    conditions.push('n.created_at <= ?')
    params.push(isoToSqliteDatetime(options.dataFim))
  }
  if (options?.status) {
    conditions.push('n.status = ?')
    params.push(options.status)
  }
  if (options?.search?.trim()) {
    const term = `%${options.search.trim()}%`
    conditions.push('(CAST(n.numero_nfe AS TEXT) LIKE ? OR CAST(v.numero AS TEXT) LIKE ? OR c.nome LIKE ?)')
    params.push(term, term, term)
  }

  const where = conditions.join(' AND ')
  const sql = `
    SELECT n.venda_id, n.numero_nfe, n.status, n.chave, n.mensagem_sefaz,
           n.created_at AS nfe_created_at,
           v.numero AS venda_numero, v.created_at AS venda_created_at, v.total AS venda_total,
           c.nome AS cliente_nome
    FROM venda_nfe n
    INNER JOIN vendas v ON v.id = n.venda_id
    LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE ${where}
    ORDER BY n.created_at DESC
    LIMIT ?
  `
  params.push(limit)
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map((r) => ({
    venda_id: r.venda_id as string,
    numero_nfe: r.numero_nfe as number,
    status: r.status as NfeStatus,
    chave: (r.chave as string) ?? null,
    mensagem_sefaz: (r.mensagem_sefaz as string) ?? null,
    venda_numero: r.venda_numero as number,
    venda_created_at: r.venda_created_at as string,
    nfe_created_at: (r.nfe_created_at as string) ?? null,
    venda_total: r.venda_total as number,
    cliente_nome: (r.cliente_nome as string) ?? null,
  }))
}

/**
 * Stub inicial de emissão de NF-e.
 * Nesta etapa apenas validamos pré-requisitos e reservamos número; integração SEFAZ vem depois.
 */
export async function emitirNfe(vendaId: string, certPath: string, certSenha: string): Promise<EmitirNfeResult> {
  const db = getDb()
  if (!db) return { ok: false, error: 'Banco não inicializado.' }

  const venda = getVendaById(vendaId)
  if (!venda) return { ok: false, error: 'Venda não encontrada.' }
  if (venda.status !== 'CONCLUIDA') {
    return { ok: false, error: 'Apenas vendas concluídas podem emitir NF-e.' }
  }

  const existing = getStatusNfe(vendaId)
  if (existing?.emitida) {
    return { ok: false, error: 'Esta venda já possui NF-e autorizada.' }
  }

  const fiscal = getFiscalConfig(venda.empresa_id)
  if (!fiscal) return { ok: false, error: 'Configuração fiscal não encontrada.' }

  const empresaConfig = getEmpresaConfig(venda.empresa_id)
  if (!empresaConfig?.cnpj?.replace(/\D/g, '')) {
    return { ok: false, error: 'CNPJ da empresa não configurado.' }
  }

  // Para NF-e modelo 55 exigimos um cliente (destinatário) configurado.
  if (!venda.cliente_id) {
    return { ok: false, error: 'Selecione um cliente para emitir NF-e (modelo 55).' }
  }
  const cliente = getClienteById(venda.cliente_id)
  if (!cliente) {
    return { ok: false, error: 'Cliente não encontrado para emissão de NF-e.' }
  }

  // Reserva de número de NF-e (sem envio à SEFAZ por enquanto).
  const numeroNfe = fiscal.ultimo_numero_nfe + 1
  const rowExistente = db.prepare('SELECT numero_nfe, status FROM venda_nfe WHERE venda_id = ?').get(vendaId) as
    | { numero_nfe: number; status: string }
    | undefined

  if (!rowExistente) {
    db.prepare(
      `
      INSERT INTO venda_nfe (venda_id, modelo, serie, numero_nfe, status, updated_at)
      VALUES (?, 55, ?, ?, 'PENDENTE', datetime('now'))
    `
    ).run(vendaId, fiscal.serie_nfe, numeroNfe)
  } else {
    db.prepare(
      `
      UPDATE venda_nfe
      SET serie = ?, numero_nfe = ?, status = 'PENDENTE', mensagem_sefaz = NULL, updated_at = datetime('now')
      WHERE venda_id = ?
    `
    ).run(fiscal.serie_nfe, numeroNfe, vendaId)
  }

  // Atualiza último número de NF-e na config fiscal.
  db.prepare(
    `
    UPDATE empresas_config
    SET ultimo_numero_nfe = ?, updated_at = datetime('now')
    WHERE empresa_id = ?
  `
  ).run(numeroNfe, venda.empresa_id)

  // Monta payload da NF-e modelo 55 (ainda sem envio à SEFAZ).
  const itens = getVendaItensParaNfce(vendaId)
  const pagamentos = getVendaPagamentosParaNfce(vendaId)
  if (!itens.length) {
    return { ok: false, error: 'Venda sem itens. Não é possível emitir NF-e.' }
  }
  if (!pagamentos.length) {
    return { ok: false, error: 'Venda sem pagamentos. Não é possível emitir NF-e.' }
  }

  const payload = buildNfePayload({
    venda,
    numeroNfe,
    fiscal,
    empresa: empresaConfig,
    cliente,
    itens,
    pagamentos,
  })

  const cnpjNumeros = (empresaConfig.cnpj || '').replace(/\D/g, '')

  try {
    const NFeWizard = await loadNFeWizard()
    const wizard = new NFeWizard()
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
        },
        lib: {
          useForSchemaValidation: 'validateSchemaJsBased',
        },
      },
    })

    const xmls = await wizard.NFE_Autorizacao(payload)
    if (!xmls || !Array.isArray(xmls) || xmls.length === 0) {
      const msg = 'SEFAZ não retornou protocolo.'
      db.prepare(
        `UPDATE venda_nfe SET status = 'ERRO', mensagem_sefaz = ?, updated_at = datetime('now') WHERE venda_id = ?`
      ).run(msg, vendaId)
      return { ok: false, error: msg }
    }

    const first = xmls[0] as
      | {
          xml?: string
          protNFe?: {
            infProt?:
              | { chNFe?: string; nProt?: string; xMotivo?: string }
              | Array<{ chNFe?: string; nProt?: string; xMotivo?: string }>
          }
        }
      | string
      | undefined
    const infProtRaw = first && typeof first === 'object' && first.protNFe?.infProt
    const infProt = Array.isArray(infProtRaw) ? infProtRaw[0] : infProtRaw
    const chave = infProt?.chNFe ?? null
    const protocolo = infProt?.nProt ?? null
    const xMotivo = infProt?.xMotivo ?? 'Autorizada'

    let xmlAutorizado: string | null = null
    if (typeof first === 'string') {
      xmlAutorizado = first
    } else if (first && typeof (first as { xml?: string }).xml === 'string') {
      xmlAutorizado = (first as { xml?: string }).xml ?? null
    }

    let xmlLocalPath: string | null = null
    let xmlSupabasePath: string | null = null
    let danfePdfPath: string | null = null
    if (xmlAutorizado && chave) {
      const dbPath = getDbPath()
      if (dbPath) {
        const baseDir = dirname(dbPath)
        const empresaXmlDir = join(baseDir, 'nfe-xml', venda.empresa_id)
        const empresaDanfeDir = join(baseDir, 'nfe-danfe', venda.empresa_id)
        if (!existsSync(empresaXmlDir)) {
          mkdirSync(empresaXmlDir, { recursive: true })
        }
        if (!existsSync(empresaDanfeDir)) {
          mkdirSync(empresaDanfeDir, { recursive: true })
        }
        const xmlFileName = `${chave}.xml`
        const xmlFullPath = join(empresaXmlDir, xmlFileName)
        try {
          writeFileSync(xmlFullPath, xmlAutorizado, { encoding: 'utf-8' })
          xmlLocalPath = xmlFullPath
        } catch {
          xmlLocalPath = null
        }

        // Gera DANFE oficial (PDF) usando @nfewizard/danfe
        try {
          const { NFE_GerarDanfe } = await import('@nfewizard/danfe')
          const pdfPath = join(empresaDanfeDir, `${chave}.pdf`)
          const danfeResult = await NFE_GerarDanfe({
            data: {
              NFe: payload.NFe as unknown,
              protNFe: (first && typeof first === 'object' && first.protNFe) as unknown,
              forceTransmitida: true,
            },
            chave,
            outputPath: pdfPath,
          })
          if (danfeResult?.success) {
            danfePdfPath = pdfPath
          } else {
            console.error('[NF-e] NFE_GerarDanfe retornou falha:', danfeResult?.message)
            danfePdfPath = null
          }
        } catch (danfeErr) {
          const danfeErrMsg = danfeErr instanceof Error ? danfeErr.message : String(danfeErr)
          console.error('[NF-e] Falha ao gerar DANFE PDF:', danfeErrMsg)
          danfePdfPath = null
        }
      }

      const supabase = getSupabaseForNfeXml()
      if (supabase) {
        const remotePath = `${venda.empresa_id}/${chave}.xml`
        try {
          const { error } = await supabase.storage
            .from(NFE_XML_BUCKET)
            .upload(remotePath, Buffer.from(xmlAutorizado, 'utf-8'), {
              upsert: true,
              contentType: 'application/xml',
            })
          if (!error) xmlSupabasePath = remotePath
        } catch {
          xmlSupabasePath = null
        }
      }
    }

    db.prepare(
      `UPDATE venda_nfe SET status = 'AUTORIZADA', chave = ?, protocolo = ?, mensagem_sefaz = ?, xml_local_path = ?, xml_supabase_path = ?, updated_at = datetime('now') WHERE venda_id = ?`
    ).run(chave, protocolo, xMotivo, xmlLocalPath, xmlSupabasePath, vendaId)

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
      ? 'Módulo nativo da emissão NF-e não encontrado. Rode no terminal: npx electron-rebuild'
      : limitMessage ?? message
    const nextStatus: NfeStatus = isLimitError ? 'ERRO' : 'REJEITADA'

    if (isLimitError) {
      console.error('[NF-e] emitNfe: provedor com limite atingido:', message)
    }
    db.prepare(
      `UPDATE venda_nfe SET status = ?, mensagem_sefaz = ?, updated_at = datetime('now') WHERE venda_id = ?`
    ).run(nextStatus, message, vendaId)
    return { ok: false, error: userMessage }
  }
}

