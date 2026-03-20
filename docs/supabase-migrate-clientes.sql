-- =============================================================================
-- Migração: tabela clientes no espelho Supabase – campos fiscais e endereço
-- Execute no SQL Editor do Supabase se a tabela clientes já existir com o
-- schema antigo (apenas id, empresa_id, nome, cpf_cnpj, telefone, email,
-- endereco, observacoes, created_at).
-- =============================================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_pessoa TEXT NOT NULL DEFAULT 'F';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS razao_social TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS nome_fantasia TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS indicador_ie_dest TEXT NOT NULL DEFAULT '9';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email_nfe TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS endereco_cep TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS endereco_logradouro TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS endereco_numero TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS endereco_complemento TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS endereco_bairro TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS endereco_municipio TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS endereco_municipio_codigo INTEGER;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS endereco_uf TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS endereco_pais_codigo INTEGER;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS endereco_pais_nome TEXT;

-- Constraints (opcional; só se quiser validar no banco)
-- ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_tipo_pessoa_check;
-- ALTER TABLE clientes ADD CONSTRAINT clientes_tipo_pessoa_check CHECK (tipo_pessoa IN ('F','J'));
-- ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_indicador_ie_dest_check;
-- ALTER TABLE clientes ADD CONSTRAINT clientes_indicador_ie_dest_check CHECK (indicador_ie_dest IN ('1','2','9'));
