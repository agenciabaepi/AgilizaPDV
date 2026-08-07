import { mkdtempSync, writeFileSync, unlinkSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  CERT_BUCKET,
  getSupabase,
  NFCE_XML_BUCKET,
  NFE_DANFE_BUCKET,
  NFE_XML_BUCKET,
} from './config'
import { decryptCertSenha } from './cert-crypto'
import { buildNfcePayload, buildNfePayload, type FiscalConfig, type ProdutoFiscal } from './builders'

type EmitResult = { ok: boolean; chave?: string; protocolo?: string; error?: string }

function rowToFiscalConfig(row: Record<string, unknown> | null): FiscalConfig & {
  ultimo_numero_nfce: number
  ultimo_numero_nfe: number
  csc_nfce: string | null
  csc_id_nfce: string | null
} {
  return {
    ambiente: row?.ambiente_fiscal === 0 ? 'homologacao' : 'producao',
    serie_nfce: Number(row?.serie_nfce ?? 1),
    serie_nfe: Number(row?.serie_nfe ?? 1),
    ultimo_numero_nfce: Number(row?.ultimo_numero_nfce ?? 0),
    ultimo_numero_nfe: Number(row?.ultimo_numero_nfe ?? 0),
    uf_emitente: String(row?.uf_emitente ?? 'SP').toUpperCase().slice(0, 2),
    ie_emitente: String(row?.ie_emitente ?? 'ISENTO'),
    c_mun_emitente: row?.c_mun_emitente != null ? Number(row.c_mun_emitente) : null,
    ncm_padrao: row?.ncm_padrao != null ? String(row.ncm_padrao) : null,
    csc_nfce: row?.csc_nfce != null ? String(row.csc_nfce) : null,
    csc_id_nfce: row?.csc_id_nfce != null ? String(row.csc_id_nfce) : null,
  }
}

function parseProt(first: unknown): {
  chave: string | null
  protocolo: string | null
  xMotivo: string
  cStat: string
  xmlAutorizado: string | null
  protNFe: unknown
} {
  const obj = first as {
    xml?: string
    protNFe?: { infProt?: { chNFe?: string; nProt?: string; xMotivo?: string; cStat?: string } | Array<{ chNFe?: string; nProt?: string; xMotivo?: string; cStat?: string }> }
  } | string | undefined
  const infProtRaw = obj && typeof obj === 'object' ? obj.protNFe?.infProt : undefined
  const infProt = Array.isArray(infProtRaw) ? infProtRaw[0] : infProtRaw
  let xmlAutorizado: string | null = null
  if (typeof first === 'string') xmlAutorizado = first
  else if (obj && typeof obj === 'object' && typeof obj.xml === 'string') xmlAutorizado = obj.xml
  return {
    chave: infProt?.chNFe ?? null,
    protocolo: infProt?.nProt ?? null,
    xMotivo: infProt?.xMotivo ?? 'Autorizada',
    cStat: infProt?.cStat != null ? String(infProt.cStat).trim() : '',
    xmlAutorizado,
    protNFe: obj && typeof obj === 'object' ? obj.protNFe : undefined,
  }
}

async function loadCertToTemp(empresaId: string): Promise<{ certPath: string; certSenha: string; cleanup: () => void } | { error: string }> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('empresa_certificado')
    .select('storage_path, senha_encrypted')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (error || !data?.storage_path) {
    return { error: 'Certificado digital não instalado. Envie o PFX em Configurações de Notas Fiscais.' }
  }
  const senha = data.senha_encrypted ? await decryptCertSenha(empresaId, String(data.senha_encrypted)) : null
  if (!senha) return { error: 'Não foi possível descriptografar a senha do certificado.' }

  const { data: fileData, error: dlErr } = await supabase.storage.from(CERT_BUCKET).download(String(data.storage_path))
  if (dlErr || !fileData) return { error: dlErr?.message || 'Erro ao baixar certificado.' }

  const dir = mkdtempSync(join(tmpdir(), 'agiliza-cert-'))
  const certPath = join(dir, 'cert.pfx')
  const buf = Buffer.from(await fileData.arrayBuffer())
  writeFileSync(certPath, buf)
  return {
    certPath,
    certSenha: senha,
    cleanup: () => {
      try { unlinkSync(certPath); rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    },
  }
}

async function loadVendaContext(vendaId: string, empresaId: string) {
  const supabase = getSupabase()
  const { data: venda, error: vErr } = await supabase.from('vendas').select('*').eq('id', vendaId).maybeSingle()
  if (vErr || !venda) return { error: 'Venda não encontrada.' }
  if (String(venda.empresa_id) !== empresaId) return { error: 'Venda não pertence à empresa.' }
  if (venda.status !== 'CONCLUIDA') return { error: 'Apenas vendas concluídas podem emitir nota fiscal.' }

  const [{ data: empresa }, { data: config }, { data: itens }, { data: pagamentos }] = await Promise.all([
    supabase.from('empresas').select('id, nome, cnpj').eq('id', empresaId).maybeSingle(),
    supabase.from('empresas_config').select('*').eq('empresa_id', empresaId).maybeSingle(),
    supabase.from('venda_itens').select('produto_id, descricao, preco_unitario, quantidade, desconto, total').eq('venda_id', vendaId),
    supabase.from('pagamentos').select('forma, valor').eq('venda_id', vendaId),
  ])

  if (!empresa) return { error: 'Empresa não encontrada.' }
  const fiscal = rowToFiscalConfig((config ?? {}) as Record<string, unknown>)
  const mergedEmpresa = {
    nome: empresa.nome,
    razao_social: config?.razao_social ?? empresa.nome,
    cnpj: empresa.cnpj,
    endereco: config?.endereco ?? null,
  }

  const produtoIds = [...new Set((itens ?? []).map((i: Record<string, unknown>) => String(i.produto_id)).filter(Boolean))]
  const produtosMap = new Map<string, ProdutoFiscal>()
  if (produtoIds.length) {
    const { data: prods } = await supabase.from('produtos').select('id, codigo, ncm, cfop').in('id', produtoIds)
    for (const p of prods ?? []) produtosMap.set(String(p.id), p as ProdutoFiscal)
  }

  return {
    venda,
    fiscal,
    empresa: mergedEmpresa,
    itens: (itens ?? []).map((i: Record<string, unknown>) => ({
      produto_id: String(i.produto_id),
      descricao: String(i.descricao),
      preco_unitario: Number(i.preco_unitario),
      quantidade: Number(i.quantidade),
      desconto: Number(i.desconto ?? 0),
      total: Number(i.total),
    })),
    pagamentos: (pagamentos ?? []).map((p: Record<string, unknown>) => ({ forma: String(p.forma), valor: Number(p.valor) })),
    produtoById: (id: string) => produtosMap.get(id) ?? null,
  }
}

export async function emitirNfceWeb(vendaId: string, empresaId: string): Promise<EmitResult> {
  const ctx = await loadVendaContext(vendaId, empresaId)
  if ('error' in ctx) return { ok: false, error: ctx.error }

  const { venda, fiscal, empresa, itens, pagamentos, produtoById } = ctx
  if (!fiscal.csc_nfce?.trim() || !fiscal.csc_id_nfce?.trim()) {
    return { ok: false, error: 'Configure o CSC e o ID do token em Notas Fiscais.' }
  }
  if (!empresa.cnpj?.replace(/\D/g, '')) return { ok: false, error: 'CNPJ da empresa não configurado.' }
  if (!itens.length) return { ok: false, error: 'Venda sem itens.' }
  if (!pagamentos.length) return { ok: false, error: 'Venda sem pagamentos.' }

  const supabase = getSupabase()
  const { data: existing } = await supabase.from('venda_nfce').select('status').eq('venda_id', vendaId).maybeSingle()
  if (existing?.status === 'AUTORIZADA') return { ok: false, error: 'Esta venda já possui NFC-e autorizada.' }

  const numeroNfce = fiscal.ultimo_numero_nfce + 1
  const now = new Date().toISOString()
  await supabase.from('venda_nfce').upsert(
    { venda_id: vendaId, numero_nfce: numeroNfce, status: 'PENDENTE', updated_at: now },
    { onConflict: 'venda_id' }
  )

  const cert = await loadCertToTemp(empresaId)
  if ('error' in cert) {
    await supabase.from('venda_nfce').update({ status: 'ERRO', mensagem_sefaz: cert.error, updated_at: now }).eq('venda_id', vendaId)
    return { ok: false, error: cert.error }
  }

  try {
    const { NFCEWizard } = await import('@nfewizard/nfce')
    const wizard = new NFCEWizard()
    const cnpjNumeros = String(empresa.cnpj).replace(/\D/g, '')
    await wizard.NFE_LoadEnvironment({
      config: {
        dfe: {
          pathCertificado: cert.certPath,
          senhaCertificado: cert.certSenha,
          UF: fiscal.uf_emitente,
          CPFCNPJ: cnpjNumeros,
        },
        nfe: {
          ambiente: fiscal.ambiente === 'homologacao' ? 2 : 1,
          versaoDF: '4.00',
          tokenCSC: fiscal.csc_nfce,
          idCSC: parseInt(fiscal.csc_id_nfce!, 10) || 1,
        },
        lib: { useOpenSSL: false, useForSchemaValidation: 'validateSchemaJsBased' },
      },
    })

    const payload = buildNfcePayload({
      venda: { id: vendaId, empresa_id: empresaId, desconto_total: venda.desconto_total, troco: venda.troco },
      numeroNfce,
      fiscal,
      empresa,
      itens,
      pagamentos,
      produtoById,
    })

    const xmls = await wizard.NFCE_Autorizacao(payload)
    if (!xmls?.length) {
      const msg = 'SEFAZ não retornou protocolo.'
      await supabase.from('venda_nfce').update({ status: 'ERRO', mensagem_sefaz: msg, updated_at: now }).eq('venda_id', vendaId)
      return { ok: false, error: msg }
    }

    const { chave, protocolo, xMotivo, cStat, xmlAutorizado } = parseProt(xmls[0])
    if (cStat && cStat !== '100') {
      const msg = xMotivo || `SEFAZ retornou cStat ${cStat}.`
      await supabase.from('venda_nfce').update({ status: 'REJEITADA', mensagem_sefaz: msg, updated_at: now }).eq('venda_id', vendaId)
      return { ok: false, error: msg }
    }

    let xmlSupabasePath: string | null = null
    if (xmlAutorizado && chave) {
      xmlSupabasePath = `${empresaId}/${chave}.xml`
      await supabase.storage.from(NFCE_XML_BUCKET).upload(xmlSupabasePath, Buffer.from(xmlAutorizado, 'utf-8'), {
        upsert: true,
        contentType: 'application/xml',
      })
    }

    await supabase.from('venda_nfce').update({
      status: 'AUTORIZADA',
      chave,
      protocolo,
      mensagem_sefaz: xMotivo,
      xml_supabase_path: xmlSupabasePath,
      updated_at: now,
    }).eq('venda_id', vendaId)

    await supabase.from('empresas_config').upsert({
      empresa_id: empresaId,
      ultimo_numero_nfce: numeroNfce,
      updated_at: now,
    }, { onConflict: 'empresa_id' })

    return { ok: true, chave: chave ?? undefined, protocolo: protocolo ?? undefined }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase.from('venda_nfce').update({ status: 'REJEITADA', mensagem_sefaz: message, updated_at: now }).eq('venda_id', vendaId)
    return { ok: false, error: message }
  } finally {
    cert.cleanup()
  }
}

export async function emitirNfeWeb(vendaId: string, empresaId: string): Promise<EmitResult> {
  const ctx = await loadVendaContext(vendaId, empresaId)
  if ('error' in ctx) return { ok: false, error: ctx.error }

  const { venda, fiscal, empresa, itens, pagamentos, produtoById } = ctx
  if (!empresa.cnpj?.replace(/\D/g, '')) return { ok: false, error: 'CNPJ da empresa não configurado.' }
  if (!venda.cliente_id) return { ok: false, error: 'Selecione um cliente para emitir NF-e (modelo 55).' }
  if (!itens.length) return { ok: false, error: 'Venda sem itens.' }
  if (!pagamentos.length) return { ok: false, error: 'Venda sem pagamentos.' }

  const supabase = getSupabase()
  const { data: cliente } = await supabase.from('clientes').select('*').eq('id', venda.cliente_id).maybeSingle()
  if (!cliente) return { ok: false, error: 'Cliente não encontrado.' }

  const { data: existing } = await supabase.from('venda_nfe').select('status').eq('venda_id', vendaId).maybeSingle()
  if (existing?.status === 'AUTORIZADA') return { ok: false, error: 'Esta venda já possui NF-e autorizada.' }

  const numeroNfe = fiscal.ultimo_numero_nfe + 1
  const now = new Date().toISOString()
  await supabase.from('venda_nfe').upsert({
    venda_id: vendaId,
    modelo: 55,
    serie: fiscal.serie_nfe,
    numero_nfe: numeroNfe,
    status: 'PENDENTE',
    updated_at: now,
  }, { onConflict: 'venda_id' })

  const cert = await loadCertToTemp(empresaId)
  if ('error' in cert) {
    await supabase.from('venda_nfe').update({ status: 'ERRO', mensagem_sefaz: cert.error, updated_at: now }).eq('venda_id', vendaId)
    return { ok: false, error: cert.error }
  }

  try {
    const NFeWizard = (await import('nfewizard-io')).default
    const wizard = new NFeWizard()
    const cnpjNumeros = String(empresa.cnpj).replace(/\D/g, '')
    await wizard.NFE_LoadEnvironment({
      config: {
        dfe: {
          pathCertificado: cert.certPath,
          senhaCertificado: cert.certSenha,
          UF: fiscal.uf_emitente,
          CPFCNPJ: cnpjNumeros,
        },
        nfe: {
          ambiente: fiscal.ambiente === 'homologacao' ? 2 : 1,
          versaoDF: '4.00',
        },
        lib: { useOpenSSL: false, useForSchemaValidation: 'validateSchemaJsBased' },
      },
    })

    const payload = buildNfePayload({
      venda: { id: vendaId, empresa_id: empresaId, desconto_total: venda.desconto_total, troco: venda.troco },
      numeroNfe,
      fiscal,
      empresa,
      cliente: cliente as Parameters<typeof buildNfePayload>[0]['cliente'],
      itens,
      pagamentos,
      produtoById,
    })

    const xmls = await wizard.NFE_Autorizacao(payload)
    if (!xmls?.length) {
      const msg = 'SEFAZ não retornou protocolo.'
      await supabase.from('venda_nfe').update({ status: 'ERRO', mensagem_sefaz: msg, updated_at: now }).eq('venda_id', vendaId)
      return { ok: false, error: msg }
    }

    const { chave, protocolo, xMotivo, cStat, xmlAutorizado, protNFe } = parseProt(xmls[0])
    if (cStat && cStat !== '100') {
      const msg = xMotivo || `SEFAZ retornou cStat ${cStat}.`
      await supabase.from('venda_nfe').update({ status: 'REJEITADA', mensagem_sefaz: msg, updated_at: now }).eq('venda_id', vendaId)
      return { ok: false, error: msg }
    }

    let xmlSupabasePath: string | null = null
    if (xmlAutorizado && chave) {
      xmlSupabasePath = `${empresaId}/${chave}.xml`
      await supabase.storage.from(NFE_XML_BUCKET).upload(xmlSupabasePath, Buffer.from(xmlAutorizado, 'utf-8'), {
        upsert: true,
        contentType: 'application/xml',
      })
    }

    if (chave && xmlAutorizado) {
      try {
        const { NFE_GerarDanfe } = await import('@nfewizard/danfe')
        const pdfPath = join(mkdtempSync(join(tmpdir(), 'agiliza-danfe-')), `${chave}.pdf`)
        const danfeResult = await NFE_GerarDanfe({
          data: { NFe: payload.NFe, protNFe: protNFe as never, forceTransmitida: true },
          chave,
          outputPath: pdfPath,
        })
        if (danfeResult?.success) {
          const pdfBuf = readFileSync(pdfPath)
          await supabase.storage.from(NFE_DANFE_BUCKET).upload(`${empresaId}/${chave}.pdf`, pdfBuf, {
            upsert: true,
            contentType: 'application/pdf',
          })
          try { unlinkSync(pdfPath) } catch { /* ignore */ }
        }
      } catch {
        /* DANFE opcional — emissão já autorizada */
      }
    }

    await supabase.from('venda_nfe').update({
      status: 'AUTORIZADA',
      chave,
      protocolo,
      mensagem_sefaz: xMotivo,
      xml_supabase_path: xmlSupabasePath,
      updated_at: now,
    }).eq('venda_id', vendaId)

    await supabase.from('empresas_config').upsert({
      empresa_id: empresaId,
      ultimo_numero_nfe: numeroNfe,
      updated_at: now,
    }, { onConflict: 'empresa_id' })

    return { ok: true, chave: chave ?? undefined, protocolo: protocolo ?? undefined }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase.from('venda_nfe').update({ status: 'REJEITADA', mensagem_sefaz: message, updated_at: now }).eq('venda_id', vendaId)
    return { ok: false, error: message }
  } finally {
    cert.cleanup()
  }
}
