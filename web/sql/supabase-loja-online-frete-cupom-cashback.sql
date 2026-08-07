-- =============================================================================
-- Agiliza PDV — Loja online: frete, cupons, favoritos e cashback
-- Execute após supabase-loja-online-ecommerce.sql e supabase-loja-online-pagamentos.sql
-- =============================================================================

-- Frete e cashback na config da loja
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_frete_tipo TEXT DEFAULT 'fixo'
  CHECK (loja_online_frete_tipo IS NULL OR loja_online_frete_tipo IN ('fixo', 'correios', 'gratis'));
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_frete_valor_fixo REAL NOT NULL DEFAULT 0;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_frete_cep_origem TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_frete_peso_padrao REAL NOT NULL DEFAULT 0.3;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_cashback_ativo INTEGER NOT NULL DEFAULT 0;

-- Cadastro obrigatório por padrão em lojas novas
ALTER TABLE public.empresas_config ALTER COLUMN loja_online_exigir_cadastro SET DEFAULT 1;

-- Cliente online vinculado ao cadastro PDV (cashback unificado)
ALTER TABLE public.loja_online_clientes ADD COLUMN IF NOT EXISTS cliente_pdv_id TEXT REFERENCES clientes(id) ON DELETE SET NULL;
ALTER TABLE public.loja_online_clientes ADD COLUMN IF NOT EXISTS cep TEXT;

-- Cupons de desconto
CREATE TABLE IF NOT EXISTS loja_online_cupons (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('percentual', 'fixo')),
  valor REAL NOT NULL DEFAULT 0,
  valor_minimo REAL NOT NULL DEFAULT 0,
  uso_maximo INTEGER,
  usos_atual INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  valido_ate TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loja_online_cupons_codigo
  ON loja_online_cupons (empresa_id, UPPER(TRIM(codigo)));

CREATE INDEX IF NOT EXISTS idx_loja_online_cupons_empresa
  ON loja_online_cupons(empresa_id);

-- Favoritos do cliente
CREATE TABLE IF NOT EXISTS loja_online_favoritos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id TEXT NOT NULL REFERENCES loja_online_clientes(id) ON DELETE CASCADE,
  produto_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (empresa_id, cliente_id, produto_id)
);

CREATE INDEX IF NOT EXISTS idx_loja_online_favoritos_cliente
  ON loja_online_favoritos(empresa_id, cliente_id);

-- Campos extras no pedido
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS subtotal REAL;
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS valor_frete REAL NOT NULL DEFAULT 0;
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS valor_desconto REAL NOT NULL DEFAULT 0;
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS cashback_usado REAL NOT NULL DEFAULT 0;
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS cupom_id TEXT REFERENCES loja_online_cupons(id) ON DELETE SET NULL;
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS cupom_codigo TEXT;
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS tipo_frete TEXT;
ALTER TABLE public.loja_online_pedidos ADD COLUMN IF NOT EXISTS cep_destino TEXT;

-- RLS
ALTER TABLE loja_online_cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE loja_online_favoritos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loja_online_cupons_anon_all" ON loja_online_cupons;
CREATE POLICY "loja_online_cupons_anon_all" ON loja_online_cupons
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "loja_online_favoritos_anon_all" ON loja_online_favoritos;
CREATE POLICY "loja_online_favoritos_anon_all" ON loja_online_favoritos
  FOR ALL TO anon USING (true) WITH CHECK (true);
