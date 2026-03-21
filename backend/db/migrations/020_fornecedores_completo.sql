-- Fornecedores - cadastro completo para ERP/PDV (compras, financeiro, fiscal)
--
-- ⚠️ APENAS SQLite (banco local do Electron / pdv.db).
-- NÃO execute este arquivo no PostgreSQL ou no SQL Editor do Supabase — use:
--   docs/supabase-fornecedores-migracao.sql
--   (ou store-server/src/schema/002_fornecedores_completo.sql)
--
-- Estende a tabela existente mantendo compatibilidade com dados já salvos.
-- cnpj armazena CPF (PF) ou CNPJ (PJ); contato mantido para compatibilidade.

-- Dados principais
-- Em ADD COLUMN o SQLite só aceita DEFAULT constante; CHECK na mesma frase pode falhar em builds antigos.
ALTER TABLE fornecedores ADD COLUMN tipo_cadastro TEXT NOT NULL DEFAULT 'J';
ALTER TABLE fornecedores ADD COLUMN nome_fantasia TEXT;
ALTER TABLE fornecedores ADD COLUMN nome_responsavel TEXT;
ALTER TABLE fornecedores ADD COLUMN inscricao_estadual TEXT;
ALTER TABLE fornecedores ADD COLUMN inscricao_municipal TEXT;
ALTER TABLE fornecedores ADD COLUMN indicador_contribuinte TEXT DEFAULT '9';
ALTER TABLE fornecedores ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1;
ALTER TABLE fornecedores ADD COLUMN fornecedor_principal INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fornecedores ADD COLUMN categoria_fornecedor TEXT;
-- SQLite não permite DEFAULT não constante em ADD COLUMN (ex.: datetime('now')).
ALTER TABLE fornecedores ADD COLUMN updated_at TEXT;
UPDATE fornecedores SET updated_at = datetime('now') WHERE updated_at IS NULL;
ALTER TABLE fornecedores ADD COLUMN created_by TEXT;
ALTER TABLE fornecedores ADD COLUMN updated_by TEXT;

-- Contato
ALTER TABLE fornecedores ADD COLUMN telefone_principal TEXT;
ALTER TABLE fornecedores ADD COLUMN telefone_secundario TEXT;
ALTER TABLE fornecedores ADD COLUMN celular_whatsapp TEXT;
ALTER TABLE fornecedores ADD COLUMN email_principal TEXT;
ALTER TABLE fornecedores ADD COLUMN email_financeiro TEXT;
ALTER TABLE fornecedores ADD COLUMN site TEXT;
ALTER TABLE fornecedores ADD COLUMN nome_contato_comercial TEXT;
ALTER TABLE fornecedores ADD COLUMN nome_contato_financeiro TEXT;

-- Endereço
ALTER TABLE fornecedores ADD COLUMN endereco_cep TEXT;
ALTER TABLE fornecedores ADD COLUMN endereco_logradouro TEXT;
ALTER TABLE fornecedores ADD COLUMN endereco_numero TEXT;
ALTER TABLE fornecedores ADD COLUMN endereco_complemento TEXT;
ALTER TABLE fornecedores ADD COLUMN endereco_bairro TEXT;
ALTER TABLE fornecedores ADD COLUMN endereco_cidade TEXT;
ALTER TABLE fornecedores ADD COLUMN endereco_estado TEXT;
ALTER TABLE fornecedores ADD COLUMN endereco_pais TEXT DEFAULT 'Brasil';
ALTER TABLE fornecedores ADD COLUMN endereco_referencia TEXT;

-- Dados comerciais
ALTER TABLE fornecedores ADD COLUMN prazo_medio_pagamento INTEGER;
ALTER TABLE fornecedores ADD COLUMN condicao_pagamento_padrao TEXT;
ALTER TABLE fornecedores ADD COLUMN limite_credito REAL;
ALTER TABLE fornecedores ADD COLUMN vendedor_representante TEXT;
ALTER TABLE fornecedores ADD COLUMN segmento_fornecedor TEXT;
ALTER TABLE fornecedores ADD COLUMN origem_fornecedor TEXT;
ALTER TABLE fornecedores ADD COLUMN observacoes_comerciais TEXT;
ALTER TABLE fornecedores ADD COLUMN produtos_servicos_fornecidos TEXT;

-- Dados financeiros/bancários
ALTER TABLE fornecedores ADD COLUMN banco TEXT;
ALTER TABLE fornecedores ADD COLUMN agencia TEXT;
ALTER TABLE fornecedores ADD COLUMN conta TEXT;
ALTER TABLE fornecedores ADD COLUMN tipo_conta TEXT;
ALTER TABLE fornecedores ADD COLUMN chave_pix TEXT;
ALTER TABLE fornecedores ADD COLUMN favorecido TEXT;
ALTER TABLE fornecedores ADD COLUMN documento_favorecido TEXT;

-- Dados fiscais
ALTER TABLE fornecedores ADD COLUMN regime_tributario TEXT;
ALTER TABLE fornecedores ADD COLUMN retencoes_aplicaveis TEXT;
ALTER TABLE fornecedores ADD COLUMN observacoes_fiscais TEXT;
ALTER TABLE fornecedores ADD COLUMN tipo_operacao_comum TEXT;
ALTER TABLE fornecedores ADD COLUMN natureza_fornecimento TEXT;

-- Controle interno
ALTER TABLE fornecedores ADD COLUMN observacoes_internas TEXT;
ALTER TABLE fornecedores ADD COLUMN tags TEXT;
ALTER TABLE fornecedores ADD COLUMN bloqueio_compras INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fornecedores ADD COLUMN motivo_bloqueio TEXT;
ALTER TABLE fornecedores ADD COLUMN avaliacao_interna INTEGER;
ALTER TABLE fornecedores ADD COLUMN prazo_medio_entrega INTEGER;
ALTER TABLE fornecedores ADD COLUMN score_classificacao TEXT;

-- Histórico de alterações (auditoria)
-- created_at é sempre preenchido no INSERT (backend); sem DEFAULT com função no schema.
CREATE TABLE IF NOT EXISTS fornecedores_historico (
  id TEXT PRIMARY KEY,
  fornecedor_id TEXT NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  operacao TEXT NOT NULL CHECK (operacao IN ('CREATE','UPDATE','INATIVAR','REATIVAR')),
  campos_alterados TEXT,
  usuario_id TEXT REFERENCES usuarios(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa_ativo ON fornecedores(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_fornecedores_cpf_cnpj ON fornecedores(empresa_id, cnpj);
CREATE INDEX IF NOT EXISTS idx_fornecedores_historico ON fornecedores_historico(fornecedor_id);
