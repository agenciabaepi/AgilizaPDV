-- Inteligência da loja online: tracking comportamental detalhado + análises com IA (OpenAI).
-- Execute após supabase-loja-online-analytics.sql.
-- As três tabelas abaixo têm RLS ligado e NENHUMA policy: só a API (service role) lê/escreve.

-- Eventos comportamentais (cliques, scroll, tempo por página, galeria, checkout, erros…)
CREATE TABLE IF NOT EXISTS public.loja_online_comportamento (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  visitor_id TEXT,
  cliente_id TEXT,
  event_type TEXT NOT NULL,
  path TEXT,
  produto_id TEXT,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  device TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loja_online_comportamento_empresa_created
  ON public.loja_online_comportamento (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loja_online_comportamento_empresa_tipo
  ON public.loja_online_comportamento (empresa_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loja_online_comportamento_session
  ON public.loja_online_comportamento (empresa_id, session_id);

ALTER TABLE public.loja_online_comportamento ENABLE ROW LEVEL SECURITY;

-- Chave da OpenAI por empresa (nunca exposta ao navegador)
CREATE TABLE IF NOT EXISTS public.loja_online_ia_config (
  empresa_id TEXT PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  openai_api_key TEXT,
  openai_model TEXT NOT NULL DEFAULT 'gpt-5-mini',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loja_online_ia_config ENABLE ROW LEVEL SECURITY;

-- Histórico das análises geradas pela IA
CREATE TABLE IF NOT EXISTS public.loja_online_ia_analises (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  periodo_inicio TIMESTAMPTZ NOT NULL,
  periodo_fim TIMESTAMPTZ NOT NULL,
  modelo TEXT,
  foco TEXT,
  resultado JSONB NOT NULL,
  metricas JSONB,
  tokens_entrada INTEGER,
  tokens_saida INTEGER,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loja_online_ia_analises_empresa
  ON public.loja_online_ia_analises (empresa_id, created_at DESC);

ALTER TABLE public.loja_online_ia_analises ENABLE ROW LEVEL SECURITY;

-- Data de nascimento opcional no cadastro do cliente (análise por faixa etária)
ALTER TABLE public.loja_online_clientes ADD COLUMN IF NOT EXISTS data_nascimento DATE;

-- Limpeza opcional de eventos antigos (rode manualmente ou agende no pg_cron):
-- DELETE FROM public.loja_online_comportamento WHERE created_at < now() - interval '180 days';
