-- Analytics da loja online: eventos first-party, atribuição UTM/fbclid e OAuth Meta Ads.

-- Eventos de acesso / funil
CREATE TABLE IF NOT EXISTS public.loja_online_eventos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  event_name TEXT NOT NULL
    CHECK (event_name IN ('page_view', 'view_content', 'add_to_cart', 'begin_checkout', 'purchase')),
  path TEXT,
  produto_id TEXT,
  pedido_id TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  fbclid TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loja_online_eventos_empresa_created
  ON public.loja_online_eventos (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loja_online_eventos_empresa_name
  ON public.loja_online_eventos (empresa_id, event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loja_online_eventos_session
  ON public.loja_online_eventos (empresa_id, session_id);

ALTER TABLE public.loja_online_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loja_online_eventos_anon_insert" ON public.loja_online_eventos;
CREATE POLICY "loja_online_eventos_anon_insert" ON public.loja_online_eventos
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "loja_online_eventos_anon_select" ON public.loja_online_eventos;
CREATE POLICY "loja_online_eventos_anon_select" ON public.loja_online_eventos
  FOR SELECT TO anon USING (true);

-- Atribuição de marketing nos pedidos
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS fbclid TEXT;

-- Meta Ads OAuth (tokens no servidor / config da empresa)
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_meta_oauth_token TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_meta_ad_account_id TEXT;
