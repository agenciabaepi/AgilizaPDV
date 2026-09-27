-- Registro de cada cotação de frete da loja online (página do produto e checkout).
-- Gravado pela API calcular-frete; RLS sem policies = só o servidor lê/escreve.

CREATE TABLE IF NOT EXISTS public.loja_online_frete_cotacoes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  session_id TEXT,
  origem TEXT NOT NULL DEFAULT 'checkout',
  cep_prefixo TEXT,
  uf TEXT,
  tipo TEXT,
  subtotal REAL,
  itens_qtd INTEGER,
  produto_ids TEXT[],
  opcoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  frete_min REAL,
  frete_max REAL,
  prazo_min INTEGER,
  frete_gratis BOOLEAN NOT NULL DEFAULT false,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loja_online_frete_cotacoes_empresa_created
  ON public.loja_online_frete_cotacoes (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loja_online_frete_cotacoes_session
  ON public.loja_online_frete_cotacoes (empresa_id, session_id);

ALTER TABLE public.loja_online_frete_cotacoes ENABLE ROW LEVEL SECURITY;
