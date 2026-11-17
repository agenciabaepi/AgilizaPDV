-- =============================================================================
-- Agiliza PDV — Histórico de preço/custo/markup de produtos
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.produto_preco_historico (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id TEXT NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  preco_anterior NUMERIC(15, 4),
  preco_novo NUMERIC(15, 4) NOT NULL,
  custo_anterior NUMERIC(15, 4),
  custo_novo NUMERIC(15, 4),
  markup_anterior NUMERIC(15, 4),
  markup_novo NUMERIC(15, 4),
  origem TEXT NOT NULL DEFAULT 'CADASTRO',
  usuario_id TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_produto_preco_historico_produto_created
  ON public.produto_preco_historico (produto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_produto_preco_historico_empresa_created
  ON public.produto_preco_historico (empresa_id, created_at DESC);

ALTER TABLE public.produto_preco_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all mirror produto_preco_historico" ON public.produto_preco_historico;
CREATE POLICY "Allow anon all mirror produto_preco_historico" ON public.produto_preco_historico
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated all mirror produto_preco_historico" ON public.produto_preco_historico;
CREATE POLICY "Allow authenticated all mirror produto_preco_historico" ON public.produto_preco_historico
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.produto_preco_historico IS
  'Histórico de alterações de preço, custo e markup do produto.';
