-- =============================================================================
-- Agiliza PDV — Loja online e-commerce (clientes, pedidos, vitrine estendida)
-- Execute após docs/supabase-loja-online.sql
-- =============================================================================

-- Campos extras em empresas_config
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_banners_json TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_rodape_texto TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_instagram TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_facebook TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_email_contato TEXT;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_exigir_cadastro INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_permitir_retirada INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_permitir_entrega INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.empresas_config ADD COLUMN IF NOT EXISTS loja_online_mensagem_checkout TEXT;

-- Clientes da loja online (compradores)
CREATE TABLE IF NOT EXISTS loja_online_clientes (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  telefone TEXT,
  cpf_cnpj TEXT,
  endereco TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loja_online_clientes_email
  ON loja_online_clientes (empresa_id, LOWER(TRIM(email)));

CREATE INDEX IF NOT EXISTS idx_loja_online_clientes_empresa
  ON loja_online_clientes(empresa_id);

-- Pedidos online
CREATE TABLE IF NOT EXISTS loja_online_pedidos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id TEXT REFERENCES loja_online_clientes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'confirmado', 'cancelado', 'entregue')),
  total REAL NOT NULL DEFAULT 0,
  observacoes TEXT,
  endereco_entrega TEXT,
  forma_entrega TEXT CHECK (forma_entrega IS NULL OR forma_entrega IN ('retirada', 'entrega')),
  cliente_nome TEXT,
  cliente_email TEXT,
  cliente_telefone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loja_online_pedidos_empresa
  ON loja_online_pedidos(empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loja_online_pedidos_cliente
  ON loja_online_pedidos(cliente_id);

-- Itens do pedido
CREATE TABLE IF NOT EXISTS loja_online_pedido_itens (
  id TEXT PRIMARY KEY,
  pedido_id TEXT NOT NULL REFERENCES loja_online_pedidos(id) ON DELETE CASCADE,
  produto_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  preco REAL NOT NULL,
  quantidade REAL NOT NULL DEFAULT 1,
  subtotal REAL NOT NULL,
  unidade TEXT DEFAULT 'UN'
);

CREATE INDEX IF NOT EXISTS idx_loja_online_pedido_itens_pedido
  ON loja_online_pedido_itens(pedido_id);

-- RLS (espelho — mesmo padrão das tabelas mirror)
ALTER TABLE loja_online_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE loja_online_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE loja_online_pedido_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loja_online_clientes_anon_all" ON loja_online_clientes;
CREATE POLICY "loja_online_clientes_anon_all" ON loja_online_clientes
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "loja_online_pedidos_anon_all" ON loja_online_pedidos;
CREATE POLICY "loja_online_pedidos_anon_all" ON loja_online_pedidos
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "loja_online_pedido_itens_anon_all" ON loja_online_pedido_itens;
CREATE POLICY "loja_online_pedido_itens_anon_all" ON loja_online_pedido_itens
  FOR ALL TO anon USING (true) WITH CHECK (true);
