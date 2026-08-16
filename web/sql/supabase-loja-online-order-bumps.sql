-- =============================================================================
-- Agiliza PDV — Order bumps no checkout da loja online
-- =============================================================================

CREATE TABLE IF NOT EXISTS loja_online_order_bumps (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('fixo', 'personalizado')),
  produto_id TEXT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  trigger_produto_id TEXT REFERENCES produtos(id) ON DELETE CASCADE,
  titulo TEXT,
  descricao TEXT,
  preco_especial REAL,
  ativo INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT loja_online_order_bumps_trigger_ck CHECK (
    (tipo = 'fixo' AND trigger_produto_id IS NULL)
    OR (tipo = 'personalizado' AND trigger_produto_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_loja_online_order_bumps_empresa
  ON loja_online_order_bumps(empresa_id, ativo, ordem);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loja_online_order_bumps_unico
  ON loja_online_order_bumps (
    empresa_id,
    tipo,
    produto_id,
    COALESCE(trigger_produto_id, '')
  );

ALTER TABLE loja_online_order_bumps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loja_online_order_bumps_anon_all" ON loja_online_order_bumps;
CREATE POLICY "loja_online_order_bumps_anon_all" ON loja_online_order_bumps
  FOR ALL TO anon USING (true) WITH CHECK (true);

COMMENT ON TABLE loja_online_order_bumps IS
  'Ofertas extras no checkout: fixas para qualquer carrinho ou personalizadas por produto gatilho.';
