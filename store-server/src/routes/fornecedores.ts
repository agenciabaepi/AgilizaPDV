import { Router } from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne, run } from '../db'
import { requireAuth } from '../auth'

const r = Router()

const SELECT_COLS = `
  id, empresa_id, razao_social, cnpj, contato, observacoes, created_at,
  tipo_cadastro, nome_fantasia, nome_responsavel, inscricao_estadual, inscricao_municipal,
  indicador_contribuinte, ativo, fornecedor_principal, categoria_fornecedor,
  updated_at, created_by, updated_by,
  telefone_principal, telefone_secundario, celular_whatsapp, email_principal, email_financeiro,
  site, nome_contato_comercial, nome_contato_financeiro,
  endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro,
  endereco_cidade, endereco_estado, endereco_pais, endereco_referencia,
  prazo_medio_pagamento, condicao_pagamento_padrao, limite_credito, vendedor_representante,
  segmento_fornecedor, origem_fornecedor, observacoes_comerciais, produtos_servicos_fornecidos,
  banco, agencia, conta, tipo_conta, chave_pix, favorecido, documento_favorecido,
  regime_tributario, retencoes_aplicaveis, observacoes_fiscais, tipo_operacao_comum, natureza_fornecimento,
  observacoes_internas, tags, bloqueio_compras, motivo_bloqueio, avaliacao_interna, prazo_medio_entrega, score_classificacao
`

r.use((_req, _res, next) => {
  requireAuth(_req)
  next()
})

r.get('/', async (req, res) => {
  const user = requireAuth(req)
  const empresaId = (req.query.empresaId as string) || user.empresa_id
  const rows = await query<Record<string, unknown>>(
    `SELECT ${SELECT_COLS} FROM fornecedores WHERE empresa_id = $1 ORDER BY razao_social`,
    [empresaId]
  )
  res.json(rows)
})

r.get('/:id/historico', async (req, res) => {
  const rows = await query<Record<string, unknown>>(
    `SELECT id, fornecedor_id, empresa_id, operacao, campos_alterados, usuario_id, created_at
     FROM fornecedores_historico WHERE fornecedor_id = $1 ORDER BY created_at DESC`,
    [req.params.id]
  )
  res.json(rows)
})

r.get('/:id', async (req, res) => {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT ${SELECT_COLS} FROM fornecedores WHERE id = $1`,
    [req.params.id]
  )
  if (!row) return res.status(404).json({ error: 'Não encontrado' })
  res.json(row)
})

r.post('/', async (req, res) => {
  const user = requireAuth(req)
  const body = req.body as Record<string, unknown>
  const empresaId = (body.empresa_id as string) || user.empresa_id
  if (empresaId !== user.empresa_id) {
    return res.status(403).json({ error: 'Empresa inválida.' })
  }
  const razao = String(body.razao_social ?? '').trim()
  if (!razao) return res.status(400).json({ error: 'Razão social ou nome é obrigatório.' })

  const id = randomUUID()
  const now = new Date().toISOString()
  const tipo = body.tipo_cadastro === 'F' ? 'F' : 'J'

  try {
    await run(
      `INSERT INTO fornecedores (
        id, empresa_id, razao_social, cnpj, contato, observacoes, created_at,
        tipo_cadastro, nome_fantasia, nome_responsavel, inscricao_estadual, inscricao_municipal,
        indicador_contribuinte, ativo, fornecedor_principal, categoria_fornecedor,
        updated_at, created_by, updated_by,
        telefone_principal, telefone_secundario, celular_whatsapp, email_principal, email_financeiro,
        site, nome_contato_comercial, nome_contato_financeiro,
        endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro,
        endereco_cidade, endereco_estado, endereco_pais, endereco_referencia,
        prazo_medio_pagamento, condicao_pagamento_padrao, limite_credito, vendedor_representante,
        segmento_fornecedor, origem_fornecedor, observacoes_comerciais, produtos_servicos_fornecidos,
        banco, agencia, conta, tipo_conta, chave_pix, favorecido, documento_favorecido,
        regime_tributario, retencoes_aplicaveis, observacoes_fiscais, tipo_operacao_comum, natureza_fornecimento,
        observacoes_internas, tags, bloqueio_compras, motivo_bloqueio, avaliacao_interna, prazo_medio_entrega, score_classificacao
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,$55,$56,$57,$58,$59,$60,$61,$62,$63
      )`,
      [
        id,
        empresaId,
        razao,
        body.cnpj ?? null,
        body.contato ?? null,
        body.observacoes ?? null,
        now,
        tipo,
        body.nome_fantasia ?? null,
        body.nome_responsavel ?? null,
        body.inscricao_estadual ?? null,
        body.inscricao_municipal ?? null,
        body.indicador_contribuinte ?? '9',
        body.ativo === 0 ? 0 : 1,
        body.fornecedor_principal ? 1 : 0,
        body.categoria_fornecedor ?? null,
        now,
        body.usuario_id ?? user.id,
        body.usuario_id ?? user.id,
        body.telefone_principal ?? null,
        body.telefone_secundario ?? null,
        body.celular_whatsapp ?? null,
        body.email_principal ?? null,
        body.email_financeiro ?? null,
        body.site ?? null,
        body.nome_contato_comercial ?? null,
        body.nome_contato_financeiro ?? null,
        body.endereco_cep ?? null,
        body.endereco_logradouro ?? null,
        body.endereco_numero ?? null,
        body.endereco_complemento ?? null,
        body.endereco_bairro ?? null,
        body.endereco_cidade ?? null,
        body.endereco_estado ?? null,
        body.endereco_pais ?? 'Brasil',
        body.endereco_referencia ?? null,
        body.prazo_medio_pagamento ?? null,
        body.condicao_pagamento_padrao ?? null,
        body.limite_credito ?? null,
        body.vendedor_representante ?? null,
        body.segmento_fornecedor ?? null,
        body.origem_fornecedor ?? null,
        body.observacoes_comerciais ?? null,
        body.produtos_servicos_fornecidos ?? null,
        body.banco ?? null,
        body.agencia ?? null,
        body.conta ?? null,
        body.tipo_conta ?? null,
        body.chave_pix ?? null,
        body.favorecido ?? null,
        body.documento_favorecido ?? null,
        body.regime_tributario ?? null,
        body.retencoes_aplicaveis ?? null,
        body.observacoes_fiscais ?? null,
        body.tipo_operacao_comum ?? null,
        body.natureza_fornecimento ?? null,
        body.observacoes_internas ?? null,
        body.tags ?? null,
        body.bloqueio_compras ? 1 : 0,
        body.motivo_bloqueio ?? null,
        body.avaliacao_interna ?? null,
        body.prazo_medio_entrega ?? null,
        body.score_classificacao ?? null
      ]
    )
    await run(
      `INSERT INTO fornecedores_historico (id, fornecedor_id, empresa_id, operacao, campos_alterados, usuario_id, created_at)
       VALUES ($1,$2,$3,'CREATE',null,$4,$5)`,
      [randomUUID(), id, empresaId, user.id, now]
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(400).json({ error: msg })
  }

  const created = await queryOne<Record<string, unknown>>(
    `SELECT ${SELECT_COLS} FROM fornecedores WHERE id = $1`,
    [id]
  )
  res.status(201).json(created)
})

r.put('/:id', async (req, res) => {
  const user = requireAuth(req)
  const body = req.body as Record<string, unknown>
  const existing = await queryOne<{ empresa_id: string }>(
    'SELECT empresa_id FROM fornecedores WHERE id = $1',
    [req.params.id]
  )
  if (!existing) return res.status(404).json({ error: 'Não encontrado' })
  if (existing.empresa_id !== user.empresa_id) return res.status(403).json({ error: 'Acesso negado.' })

  const now = new Date().toISOString()
  const razao =
    body.razao_social !== undefined ? String(body.razao_social).trim() : undefined
  if (razao === '') return res.status(400).json({ error: 'Razão social ou nome é obrigatório.' })

  try {
    await run(
      `UPDATE fornecedores SET
        razao_social = COALESCE($2, razao_social),
        cnpj = COALESCE($3, cnpj),
        contato = COALESCE($4, contato),
        observacoes = COALESCE($5, observacoes),
        tipo_cadastro = COALESCE($6, tipo_cadastro),
        nome_fantasia = COALESCE($7, nome_fantasia),
        nome_responsavel = COALESCE($8, nome_responsavel),
        inscricao_estadual = COALESCE($9, inscricao_estadual),
        inscricao_municipal = COALESCE($10, inscricao_municipal),
        indicador_contribuinte = COALESCE($11, indicador_contribuinte),
        ativo = COALESCE($12, ativo),
        fornecedor_principal = COALESCE($13, fornecedor_principal),
        categoria_fornecedor = COALESCE($14, categoria_fornecedor),
        updated_at = $15,
        updated_by = $16,
        telefone_principal = COALESCE($17, telefone_principal),
        telefone_secundario = COALESCE($18, telefone_secundario),
        celular_whatsapp = COALESCE($19, celular_whatsapp),
        email_principal = COALESCE($20, email_principal),
        email_financeiro = COALESCE($21, email_financeiro),
        site = COALESCE($22, site),
        nome_contato_comercial = COALESCE($23, nome_contato_comercial),
        nome_contato_financeiro = COALESCE($24, nome_contato_financeiro),
        endereco_cep = COALESCE($25, endereco_cep),
        endereco_logradouro = COALESCE($26, endereco_logradouro),
        endereco_numero = COALESCE($27, endereco_numero),
        endereco_complemento = COALESCE($28, endereco_complemento),
        endereco_bairro = COALESCE($29, endereco_bairro),
        endereco_cidade = COALESCE($30, endereco_cidade),
        endereco_estado = COALESCE($31, endereco_estado),
        endereco_pais = COALESCE($32, endereco_pais),
        endereco_referencia = COALESCE($33, endereco_referencia),
        prazo_medio_pagamento = COALESCE($34, prazo_medio_pagamento),
        condicao_pagamento_padrao = COALESCE($35, condicao_pagamento_padrao),
        limite_credito = COALESCE($36, limite_credito),
        vendedor_representante = COALESCE($37, vendedor_representante),
        segmento_fornecedor = COALESCE($38, segmento_fornecedor),
        origem_fornecedor = COALESCE($39, origem_fornecedor),
        observacoes_comerciais = COALESCE($40, observacoes_comerciais),
        produtos_servicos_fornecidos = COALESCE($41, produtos_servicos_fornecidos),
        banco = COALESCE($42, banco),
        agencia = COALESCE($43, agencia),
        conta = COALESCE($44, conta),
        tipo_conta = COALESCE($45, tipo_conta),
        chave_pix = COALESCE($46, chave_pix),
        favorecido = COALESCE($47, favorecido),
        documento_favorecido = COALESCE($48, documento_favorecido),
        regime_tributario = COALESCE($49, regime_tributario),
        retencoes_aplicaveis = COALESCE($50, retencoes_aplicaveis),
        observacoes_fiscais = COALESCE($51, observacoes_fiscais),
        tipo_operacao_comum = COALESCE($52, tipo_operacao_comum),
        natureza_fornecimento = COALESCE($53, natureza_fornecimento),
        observacoes_internas = COALESCE($54, observacoes_internas),
        tags = COALESCE($55, tags),
        bloqueio_compras = COALESCE($56, bloqueio_compras),
        motivo_bloqueio = COALESCE($57, motivo_bloqueio),
        avaliacao_interna = COALESCE($58, avaliacao_interna),
        prazo_medio_entrega = COALESCE($59, prazo_medio_entrega),
        score_classificacao = COALESCE($60, score_classificacao)
      WHERE id = $1`,
      [
        req.params.id,
        razao ?? null,
        body.cnpj ?? null,
        body.contato ?? null,
        body.observacoes ?? null,
        body.tipo_cadastro ?? null,
        body.nome_fantasia ?? null,
        body.nome_responsavel ?? null,
        body.inscricao_estadual ?? null,
        body.inscricao_municipal ?? null,
        body.indicador_contribuinte ?? null,
        body.ativo !== undefined ? (body.ativo ? 1 : 0) : null,
        body.fornecedor_principal !== undefined ? (body.fornecedor_principal ? 1 : 0) : null,
        body.categoria_fornecedor ?? null,
        now,
        user.id,
        body.telefone_principal ?? null,
        body.telefone_secundario ?? null,
        body.celular_whatsapp ?? null,
        body.email_principal ?? null,
        body.email_financeiro ?? null,
        body.site ?? null,
        body.nome_contato_comercial ?? null,
        body.nome_contato_financeiro ?? null,
        body.endereco_cep ?? null,
        body.endereco_logradouro ?? null,
        body.endereco_numero ?? null,
        body.endereco_complemento ?? null,
        body.endereco_bairro ?? null,
        body.endereco_cidade ?? null,
        body.endereco_estado ?? null,
        body.endereco_pais ?? null,
        body.endereco_referencia ?? null,
        body.prazo_medio_pagamento ?? null,
        body.condicao_pagamento_padrao ?? null,
        body.limite_credito ?? null,
        body.vendedor_representante ?? null,
        body.segmento_fornecedor ?? null,
        body.origem_fornecedor ?? null,
        body.observacoes_comerciais ?? null,
        body.produtos_servicos_fornecidos ?? null,
        body.banco ?? null,
        body.agencia ?? null,
        body.conta ?? null,
        body.tipo_conta ?? null,
        body.chave_pix ?? null,
        body.favorecido ?? null,
        body.documento_favorecido ?? null,
        body.regime_tributario ?? null,
        body.retencoes_aplicaveis ?? null,
        body.observacoes_fiscais ?? null,
        body.tipo_operacao_comum ?? null,
        body.natureza_fornecimento ?? null,
        body.observacoes_internas ?? null,
        body.tags ?? null,
        body.bloqueio_compras !== undefined ? (body.bloqueio_compras ? 1 : 0) : null,
        body.motivo_bloqueio ?? null,
        body.avaliacao_interna ?? null,
        body.prazo_medio_entrega ?? null,
        body.score_classificacao ?? null
      ]
    )
    await run(
      `INSERT INTO fornecedores_historico (id, fornecedor_id, empresa_id, operacao, campos_alterados, usuario_id, created_at)
       VALUES ($1,$2,$3,'UPDATE',$4,$5,$6)`,
      [randomUUID(), req.params.id, existing.empresa_id, 'atualização', user.id, now]
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(400).json({ error: msg })
  }

  const updated = await queryOne<Record<string, unknown>>(
    `SELECT ${SELECT_COLS} FROM fornecedores WHERE id = $1`,
    [req.params.id]
  )
  res.json(updated)
})

r.delete('/:id', async (req, res) => {
  const user = requireAuth(req)
  const row = await queryOne<{ empresa_id: string }>(
    'SELECT empresa_id FROM fornecedores WHERE id = $1',
    [req.params.id]
  )
  if (!row) return res.status(404).json({ error: 'Não encontrado' })
  if (row.empresa_id !== user.empresa_id) return res.status(403).json({ error: 'Acesso negado.' })
  const cnt = await queryOne<{ c: string }>(
    'SELECT COUNT(*)::text as c FROM produtos WHERE fornecedor_id = $1',
    [req.params.id]
  )
  if (Number(cnt?.c ?? 0) > 0) {
    return res.status(400).json({
      error: 'Não é possível excluir: há produtos vinculados. Inative o cadastro.'
    })
  }
  await run('DELETE FROM fornecedores WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

export default r
