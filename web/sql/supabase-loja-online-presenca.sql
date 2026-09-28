-- =============================================================================
-- Agiliza PDV — Presença "Ao vivo" da loja online
-- Uma linha por visitante ativo, atualizada por sinal de vida (heartbeat) a cada ~20s.
-- Só o servidor (service role) lê e grava; o navegador fala com /api/loja-online/presenca.
-- Pode rodar de novo sem problema.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.loja_online_presenca (
  session_id TEXT NOT NULL,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  path TEXT,
  titulo TEXT,
  device TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  carrinho BOOLEAN NOT NULL DEFAULT false,
  checkout BOOLEAN NOT NULL DEFAULT false,
  oculto BOOLEAN NOT NULL DEFAULT false,
  desde TIMESTAMPTZ NOT NULL DEFAULT now(),
  pagina_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_loja_online_presenca_empresa_seen
  ON public.loja_online_presenca (empresa_id, last_seen DESC);

ALTER TABLE public.loja_online_presenca ENABLE ROW LEVEL SECURITY;
