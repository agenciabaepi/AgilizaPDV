-- =============================================================================
-- Loja online — SEO, legal, analytics, galeria, avaliações, rastreio
-- =============================================================================

-- SEO
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_seo_titulo TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_seo_descricao TEXT;

-- Páginas legais (HTML ou texto)
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_politica_privacidade TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_termos_uso TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_politica_trocas TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_politica_entrega TEXT;

-- Analytics e domínio
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_ga4_id TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_meta_pixel_id TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_dominio_custom TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_config_loja_online_dominio_custom
  ON public.empresas_config (LOWER(TRIM(loja_online_dominio_custom)))
  WHERE loja_online_dominio_custom IS NOT NULL AND TRIM(loja_online_dominio_custom) <> '';

-- Galeria extra de imagens no produto (JSON array de URLs/base64)
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS loja_online_imagens_json TEXT;

-- Código de rastreio no pedido
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS codigo_rastreio TEXT;

-- Avaliações de produtos
CREATE TABLE IF NOT EXISTS public.loja_online_avaliacoes (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id TEXT NOT NULL,
  cliente_id TEXT REFERENCES public.loja_online_clientes(id) ON DELETE SET NULL,
  cliente_nome TEXT NOT NULL,
  nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loja_online_avaliacoes_produto
  ON public.loja_online_avaliacoes (produto_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loja_online_avaliacoes_empresa
  ON public.loja_online_avaliacoes (empresa_id);

ALTER TABLE public.loja_online_avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loja_online_avaliacoes_anon_all" ON public.loja_online_avaliacoes;
CREATE POLICY "loja_online_avaliacoes_anon_all" ON public.loja_online_avaliacoes
  FOR ALL TO anon USING (true) WITH CHECK (true);
