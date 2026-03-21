-- =============================================================================
-- O QUE FAZER (só você no navegador — eu não tenho acesso ao seu Supabase):
-- 1) Abra https://supabase.com → seu projeto → menu SQL → New query.
-- 2) Abra ESTE arquivo no editor (Cursor/VS Code), selecione TUDO (Cmd+A), copie.
-- 3) Cole na janela do SQL Editor do Supabase e clique Run (ou F5).
-- 4) Se aparecer "Success", pronto. Pode rodar de novo sem problema (é idempotente).
-- =============================================================================
--
-- Migração fornecedores (PostgreSQL / Supabase)
--
-- Idempotente: cada ADD COLUMN em bloco próprio; se a coluna já existir, ignora 42701 (duplicate_column).
-- Mais confiável que só consultar information_schema no Supabase.
-- NÃO use o arquivo SQLite backend/db/migrations/020_fornecedores_completo.sql aqui.

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN tipo_cadastro TEXT NOT NULL DEFAULT 'J';
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN nome_fantasia TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN nome_responsavel TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN inscricao_estadual TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN inscricao_municipal TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN indicador_contribuinte TEXT DEFAULT '9';
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN fornecedor_principal INTEGER NOT NULL DEFAULT 0;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN categoria_fornecedor TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN updated_at TIMESTAMPTZ;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN created_by TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN updated_by TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN telefone_principal TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN telefone_secundario TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN celular_whatsapp TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN email_principal TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN email_financeiro TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN site TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN nome_contato_comercial TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN nome_contato_financeiro TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_cep TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_logradouro TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_numero TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_complemento TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_bairro TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_cidade TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_estado TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_pais TEXT DEFAULT 'Brasil';
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_referencia TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN prazo_medio_pagamento INTEGER;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN condicao_pagamento_padrao TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN limite_credito REAL;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN vendedor_representante TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN segmento_fornecedor TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN origem_fornecedor TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN observacoes_comerciais TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN produtos_servicos_fornecidos TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN banco TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN agencia TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN conta TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN tipo_conta TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN chave_pix TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN favorecido TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN documento_favorecido TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN regime_tributario TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN retencoes_aplicaveis TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN observacoes_fiscais TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN tipo_operacao_comum TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN natureza_fornecimento TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN observacoes_internas TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN tags TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN bloqueio_compras INTEGER NOT NULL DEFAULT 0;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN motivo_bloqueio TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN avaliacao_interna INTEGER;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN prazo_medio_entrega INTEGER;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.fornecedores ADD COLUMN score_classificacao TEXT;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
END $$;

UPDATE public.fornecedores SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;

CREATE TABLE IF NOT EXISTS public.fornecedores_historico (
  id TEXT PRIMARY KEY,
  fornecedor_id TEXT NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id),
  operacao TEXT NOT NULL CHECK (operacao IN ('CREATE','UPDATE','INATIVAR','REATIVAR')),
  campos_alterados TEXT,
  usuario_id TEXT REFERENCES public.usuarios(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa_ativo ON public.fornecedores(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_fornecedores_cpf_cnpj ON public.fornecedores(empresa_id, cnpj);
CREATE INDEX IF NOT EXISTS idx_fornecedores_historico ON public.fornecedores_historico(fornecedor_id);
