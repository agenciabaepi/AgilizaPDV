-- =============================================================================
-- Agiliza PDV — Programa de afiliados UGC (parceiros / criadores de conteúdo)
-- Links rastreáveis, comissões por produto, saques PIX
-- =============================================================================

-- Config da loja
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_ugc_ativo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_ugc_cookie_dias INTEGER NOT NULL DEFAULT 30;
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_ugc_saque_minimo REAL NOT NULL DEFAULT 50;

COMMENT ON COLUMN public.empresas_config.loja_online_ugc_ativo IS
  '1 = programa de parceiros UGC ativo na vitrine (/parceiros)';
COMMENT ON COLUMN public.empresas_config.loja_online_ugc_cookie_dias IS
  'Janela de atribuição do cookie ref (dias). Default 30.';
COMMENT ON COLUMN public.empresas_config.loja_online_ugc_saque_minimo IS
  'Valor mínimo (R$) para o criador solicitar saque.';

-- % de comissão UGC por produto (null = não elegível)
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS comissao_ugc_percentual REAL;

COMMENT ON COLUMN public.produtos.comissao_ugc_percentual IS
  'Percentual de comissão UGC sobre o subtotal do item. NULL = sem comissão.';

-- Snapshot de atribuição no pedido
ALTER TABLE public.loja_online_pedidos
  ADD COLUMN IF NOT EXISTS ugc_criador_id TEXT;
ALTER TABLE public.loja_online_pedidos
  ADD COLUMN IF NOT EXISTS ugc_codigo TEXT;
ALTER TABLE public.loja_online_pedidos
  ADD COLUMN IF NOT EXISTS ugc_link_id TEXT;

CREATE INDEX IF NOT EXISTS idx_loja_online_pedidos_ugc_criador
  ON public.loja_online_pedidos (empresa_id, ugc_criador_id)
  WHERE ugc_criador_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Criadores / parceiros UGC
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loja_online_ugc_criadores (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  telefone TEXT,
  instagram TEXT,
  tiktok TEXT,
  youtube TEXT,
  pix_chave TEXT,
  codigo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'bloqueado')),
  notas_admin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  aprovado_em TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loja_online_ugc_criadores_email
  ON public.loja_online_ugc_criadores (empresa_id, LOWER(TRIM(email)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_loja_online_ugc_criadores_codigo
  ON public.loja_online_ugc_criadores (empresa_id, UPPER(TRIM(codigo)));

CREATE INDEX IF NOT EXISTS idx_loja_online_ugc_criadores_empresa_status
  ON public.loja_online_ugc_criadores (empresa_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Links gerados (criador + produto)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loja_online_ugc_links (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  criador_id TEXT NOT NULL REFERENCES public.loja_online_ugc_criadores(id) ON DELETE CASCADE,
  produto_id TEXT NOT NULL,
  cliques INTEGER NOT NULL DEFAULT 0,
  pedidos INTEGER NOT NULL DEFAULT 0,
  vendas_valor REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loja_online_ugc_links_criador_produto
  ON public.loja_online_ugc_links (criador_id, produto_id);

CREATE INDEX IF NOT EXISTS idx_loja_online_ugc_links_empresa
  ON public.loja_online_ugc_links (empresa_id, criador_id);

-- FK pedido → link (após tabela existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loja_online_pedidos_ugc_link_id_fkey'
  ) THEN
    ALTER TABLE public.loja_online_pedidos
      ADD CONSTRAINT loja_online_pedidos_ugc_link_id_fkey
      FOREIGN KEY (ugc_link_id) REFERENCES public.loja_online_ugc_links(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loja_online_pedidos_ugc_criador_id_fkey'
  ) THEN
    ALTER TABLE public.loja_online_pedidos
      ADD CONSTRAINT loja_online_pedidos_ugc_criador_id_fkey
      FOREIGN KEY (ugc_criador_id) REFERENCES public.loja_online_ugc_criadores(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Cliques (auditoria)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loja_online_ugc_cliques (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  criador_id TEXT NOT NULL REFERENCES public.loja_online_ugc_criadores(id) ON DELETE CASCADE,
  link_id TEXT REFERENCES public.loja_online_ugc_links(id) ON DELETE SET NULL,
  produto_id TEXT,
  session_id TEXT,
  user_agent TEXT,
  referrer TEXT,
  path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loja_online_ugc_cliques_criador
  ON public.loja_online_ugc_cliques (criador_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loja_online_ugc_cliques_empresa
  ON public.loja_online_ugc_cliques (empresa_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Comissões
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loja_online_ugc_comissoes (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  criador_id TEXT NOT NULL REFERENCES public.loja_online_ugc_criadores(id) ON DELETE CASCADE,
  pedido_id TEXT NOT NULL REFERENCES public.loja_online_pedidos(id) ON DELETE CASCADE,
  pedido_item_id TEXT NOT NULL,
  produto_id TEXT NOT NULL,
  link_id TEXT REFERENCES public.loja_online_ugc_links(id) ON DELETE SET NULL,
  base_calculo REAL NOT NULL DEFAULT 0,
  percentual REAL NOT NULL DEFAULT 0,
  valor REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovada', 'cancelada', 'paga')),
  motivo_cancelamento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  aprovada_em TIMESTAMPTZ,
  paga_em TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loja_online_ugc_comissoes_item
  ON public.loja_online_ugc_comissoes (pedido_item_id);

CREATE INDEX IF NOT EXISTS idx_loja_online_ugc_comissoes_criador_status
  ON public.loja_online_ugc_comissoes (criador_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loja_online_ugc_comissoes_pedido
  ON public.loja_online_ugc_comissoes (pedido_id);

CREATE INDEX IF NOT EXISTS idx_loja_online_ugc_comissoes_empresa
  ON public.loja_online_ugc_comissoes (empresa_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Saques
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loja_online_ugc_saques (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  criador_id TEXT NOT NULL REFERENCES public.loja_online_ugc_criadores(id) ON DELETE CASCADE,
  valor REAL NOT NULL CHECK (valor > 0),
  pix_chave TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'solicitado'
    CHECK (status IN ('solicitado', 'pago', 'recusado')),
  admin_nota TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pago_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_loja_online_ugc_saques_criador
  ON public.loja_online_ugc_saques (criador_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loja_online_ugc_saques_empresa_status
  ON public.loja_online_ugc_saques (empresa_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS (padrão espelho da loja online)
-- ---------------------------------------------------------------------------
ALTER TABLE public.loja_online_ugc_criadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loja_online_ugc_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loja_online_ugc_cliques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loja_online_ugc_comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loja_online_ugc_saques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loja_online_ugc_criadores_anon_all" ON public.loja_online_ugc_criadores;
CREATE POLICY "loja_online_ugc_criadores_anon_all" ON public.loja_online_ugc_criadores
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "loja_online_ugc_links_anon_all" ON public.loja_online_ugc_links;
CREATE POLICY "loja_online_ugc_links_anon_all" ON public.loja_online_ugc_links
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "loja_online_ugc_cliques_anon_all" ON public.loja_online_ugc_cliques;
CREATE POLICY "loja_online_ugc_cliques_anon_all" ON public.loja_online_ugc_cliques
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "loja_online_ugc_comissoes_anon_all" ON public.loja_online_ugc_comissoes;
CREATE POLICY "loja_online_ugc_comissoes_anon_all" ON public.loja_online_ugc_comissoes
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "loja_online_ugc_saques_anon_all" ON public.loja_online_ugc_saques;
CREATE POLICY "loja_online_ugc_saques_anon_all" ON public.loja_online_ugc_saques
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- authenticated (mesmas permissões, se usado)
DROP POLICY IF EXISTS "loja_online_ugc_criadores_auth_all" ON public.loja_online_ugc_criadores;
CREATE POLICY "loja_online_ugc_criadores_auth_all" ON public.loja_online_ugc_criadores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "loja_online_ugc_links_auth_all" ON public.loja_online_ugc_links;
CREATE POLICY "loja_online_ugc_links_auth_all" ON public.loja_online_ugc_links
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "loja_online_ugc_cliques_auth_all" ON public.loja_online_ugc_cliques;
CREATE POLICY "loja_online_ugc_cliques_auth_all" ON public.loja_online_ugc_cliques
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "loja_online_ugc_comissoes_auth_all" ON public.loja_online_ugc_comissoes;
CREATE POLICY "loja_online_ugc_comissoes_auth_all" ON public.loja_online_ugc_comissoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "loja_online_ugc_saques_auth_all" ON public.loja_online_ugc_saques;
CREATE POLICY "loja_online_ugc_saques_auth_all" ON public.loja_online_ugc_saques
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
