-- Inteligência da loja online: tracking comportamental detalhado.
-- Execute após supabase-loja-online-analytics.sql.
-- Tabelas com RLS ligado e NENHUMA policy: só a API (service role) lê/escreve.

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

-- Data de nascimento opcional no cadastro do cliente (análise por faixa etária)
ALTER TABLE public.loja_online_clientes ADD COLUMN IF NOT EXISTS data_nascimento DATE;

-- Limpeza opcional de eventos antigos (rode manualmente ou agende no pg_cron):
-- DELETE FROM public.loja_online_comportamento WHERE created_at < now() - interval '180 days';
