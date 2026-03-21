-- Fornecedores estendidos (espelho Postgres)

ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS tipo_cadastro TEXT NOT NULL DEFAULT 'J';
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS nome_fantasia TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS nome_responsavel TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS indicador_contribuinte TEXT DEFAULT '9';
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS ativo INTEGER NOT NULL DEFAULT 1;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS fornecedor_principal INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS categoria_fornecedor TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS telefone_principal TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS telefone_secundario TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS celular_whatsapp TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS email_principal TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS email_financeiro TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS site TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS nome_contato_comercial TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS nome_contato_financeiro TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS endereco_cep TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS endereco_logradouro TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS endereco_numero TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS endereco_complemento TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS endereco_bairro TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS endereco_cidade TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS endereco_estado TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS endereco_pais TEXT DEFAULT 'Brasil';
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS endereco_referencia TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS prazo_medio_pagamento INTEGER;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS condicao_pagamento_padrao TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS limite_credito REAL;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS vendedor_representante TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS segmento_fornecedor TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS origem_fornecedor TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS observacoes_comerciais TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS produtos_servicos_fornecidos TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS banco TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS agencia TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS conta TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS tipo_conta TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS chave_pix TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS favorecido TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS documento_favorecido TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS regime_tributario TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS retencoes_aplicaveis TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS observacoes_fiscais TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS tipo_operacao_comum TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS natureza_fornecimento TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS observacoes_internas TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS bloqueio_compras INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS motivo_bloqueio TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS avaliacao_interna INTEGER;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS prazo_medio_entrega INTEGER;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS score_classificacao TEXT;

CREATE TABLE IF NOT EXISTS fornecedores_historico (
  id TEXT PRIMARY KEY,
  fornecedor_id TEXT NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  operacao TEXT NOT NULL,
  campos_alterados TEXT,
  usuario_id TEXT REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_historico_pg ON fornecedores_historico(fornecedor_id);
