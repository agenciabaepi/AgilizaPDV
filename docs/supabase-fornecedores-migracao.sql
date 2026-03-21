-- Migração fornecedores (PostgreSQL / Supabase)
-- Idempotente: pode rodar várias vezes; só cria colunas que ainda não existem.
-- (Evita erro 42701 "column already exists" após execução parcial ou reexecução.)
-- NÃO use backend/db/migrations/020_fornecedores_completo.sql no Postgres (é SQLite).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'tipo_cadastro') THEN
    ALTER TABLE public.fornecedores ADD COLUMN tipo_cadastro TEXT NOT NULL DEFAULT 'J';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'nome_fantasia') THEN
    ALTER TABLE public.fornecedores ADD COLUMN nome_fantasia TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'nome_responsavel') THEN
    ALTER TABLE public.fornecedores ADD COLUMN nome_responsavel TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'inscricao_estadual') THEN
    ALTER TABLE public.fornecedores ADD COLUMN inscricao_estadual TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'inscricao_municipal') THEN
    ALTER TABLE public.fornecedores ADD COLUMN inscricao_municipal TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'indicador_contribuinte') THEN
    ALTER TABLE public.fornecedores ADD COLUMN indicador_contribuinte TEXT DEFAULT '9';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'ativo') THEN
    ALTER TABLE public.fornecedores ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'fornecedor_principal') THEN
    ALTER TABLE public.fornecedores ADD COLUMN fornecedor_principal INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'categoria_fornecedor') THEN
    ALTER TABLE public.fornecedores ADD COLUMN categoria_fornecedor TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'updated_at') THEN
    ALTER TABLE public.fornecedores ADD COLUMN updated_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'created_by') THEN
    ALTER TABLE public.fornecedores ADD COLUMN created_by TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'updated_by') THEN
    ALTER TABLE public.fornecedores ADD COLUMN updated_by TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'telefone_principal') THEN
    ALTER TABLE public.fornecedores ADD COLUMN telefone_principal TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'telefone_secundario') THEN
    ALTER TABLE public.fornecedores ADD COLUMN telefone_secundario TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'celular_whatsapp') THEN
    ALTER TABLE public.fornecedores ADD COLUMN celular_whatsapp TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'email_principal') THEN
    ALTER TABLE public.fornecedores ADD COLUMN email_principal TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'email_financeiro') THEN
    ALTER TABLE public.fornecedores ADD COLUMN email_financeiro TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'site') THEN
    ALTER TABLE public.fornecedores ADD COLUMN site TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'nome_contato_comercial') THEN
    ALTER TABLE public.fornecedores ADD COLUMN nome_contato_comercial TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'nome_contato_financeiro') THEN
    ALTER TABLE public.fornecedores ADD COLUMN nome_contato_financeiro TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'endereco_cep') THEN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_cep TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'endereco_logradouro') THEN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_logradouro TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'endereco_numero') THEN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_numero TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'endereco_complemento') THEN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_complemento TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'endereco_bairro') THEN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_bairro TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'endereco_cidade') THEN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_cidade TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'endereco_estado') THEN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_estado TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'endereco_pais') THEN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_pais TEXT DEFAULT 'Brasil';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'endereco_referencia') THEN
    ALTER TABLE public.fornecedores ADD COLUMN endereco_referencia TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'prazo_medio_pagamento') THEN
    ALTER TABLE public.fornecedores ADD COLUMN prazo_medio_pagamento INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'condicao_pagamento_padrao') THEN
    ALTER TABLE public.fornecedores ADD COLUMN condicao_pagamento_padrao TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'limite_credito') THEN
    ALTER TABLE public.fornecedores ADD COLUMN limite_credito REAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'vendedor_representante') THEN
    ALTER TABLE public.fornecedores ADD COLUMN vendedor_representante TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'segmento_fornecedor') THEN
    ALTER TABLE public.fornecedores ADD COLUMN segmento_fornecedor TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'origem_fornecedor') THEN
    ALTER TABLE public.fornecedores ADD COLUMN origem_fornecedor TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'observacoes_comerciais') THEN
    ALTER TABLE public.fornecedores ADD COLUMN observacoes_comerciais TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'produtos_servicos_fornecidos') THEN
    ALTER TABLE public.fornecedores ADD COLUMN produtos_servicos_fornecidos TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'banco') THEN
    ALTER TABLE public.fornecedores ADD COLUMN banco TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'agencia') THEN
    ALTER TABLE public.fornecedores ADD COLUMN agencia TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'conta') THEN
    ALTER TABLE public.fornecedores ADD COLUMN conta TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'tipo_conta') THEN
    ALTER TABLE public.fornecedores ADD COLUMN tipo_conta TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'chave_pix') THEN
    ALTER TABLE public.fornecedores ADD COLUMN chave_pix TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'favorecido') THEN
    ALTER TABLE public.fornecedores ADD COLUMN favorecido TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'documento_favorecido') THEN
    ALTER TABLE public.fornecedores ADD COLUMN documento_favorecido TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'regime_tributario') THEN
    ALTER TABLE public.fornecedores ADD COLUMN regime_tributario TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'retencoes_aplicaveis') THEN
    ALTER TABLE public.fornecedores ADD COLUMN retencoes_aplicaveis TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'observacoes_fiscais') THEN
    ALTER TABLE public.fornecedores ADD COLUMN observacoes_fiscais TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'tipo_operacao_comum') THEN
    ALTER TABLE public.fornecedores ADD COLUMN tipo_operacao_comum TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'natureza_fornecimento') THEN
    ALTER TABLE public.fornecedores ADD COLUMN natureza_fornecimento TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'observacoes_internas') THEN
    ALTER TABLE public.fornecedores ADD COLUMN observacoes_internas TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'tags') THEN
    ALTER TABLE public.fornecedores ADD COLUMN tags TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'bloqueio_compras') THEN
    ALTER TABLE public.fornecedores ADD COLUMN bloqueio_compras INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'motivo_bloqueio') THEN
    ALTER TABLE public.fornecedores ADD COLUMN motivo_bloqueio TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'avaliacao_interna') THEN
    ALTER TABLE public.fornecedores ADD COLUMN avaliacao_interna INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'prazo_medio_entrega') THEN
    ALTER TABLE public.fornecedores ADD COLUMN prazo_medio_entrega INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'score_classificacao') THEN
    ALTER TABLE public.fornecedores ADD COLUMN score_classificacao TEXT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.fornecedores_historico (
  id TEXT PRIMARY KEY,
  fornecedor_id TEXT NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id),
  operacao TEXT NOT NULL,
  campos_alterados TEXT,
  usuario_id TEXT REFERENCES public.usuarios(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa_ativo ON public.fornecedores(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_fornecedores_cpf_cnpj ON public.fornecedores(empresa_id, cnpj);
CREATE INDEX IF NOT EXISTS idx_fornecedores_historico ON public.fornecedores_historico(fornecedor_id);
