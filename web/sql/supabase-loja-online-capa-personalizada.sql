-- =============================================================================
-- Agiliza PDV — Capa personalizada (editor de capinhas na loja online)
-- Execute no SQL Editor do Supabase (pode rodar de novo sem problema).
--
-- O produto "Capa personalizada" é um produto comum com variações: cada modelo
-- de celular é um SKU filho (produto_pai_id) com preço e estoque próprios.
-- Esta migration só guarda as artes criadas pelos clientes e liga ao pedido.
-- =============================================================================

CREATE TABLE IF NOT EXISTS loja_online_capa_designs (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  produto_id TEXT NOT NULL,
  produto_pai_id TEXT,
  modelo_id TEXT NOT NULL,
  modelo_nome TEXT NOT NULL,
  design_json JSONB NOT NULL,
  preview_url TEXT,
  print_url TEXT,
  print_largura INTEGER,
  print_altura INTEGER,
  print_dpi INTEGER,
  assets_json JSONB,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'pedido', 'produzido', 'cancelado')),
  pedido_id TEXT REFERENCES loja_online_pedidos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loja_online_capa_designs_empresa
  ON loja_online_capa_designs (empresa_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loja_online_capa_designs_pedido
  ON loja_online_capa_designs (pedido_id)
  WHERE pedido_id IS NOT NULL;

ALTER TABLE loja_online_capa_designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loja_online_capa_designs_anon_all" ON loja_online_capa_designs;
CREATE POLICY "loja_online_capa_designs_anon_all" ON loja_online_capa_designs
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "loja_online_capa_designs_auth_all" ON loja_online_capa_designs;
CREATE POLICY "loja_online_capa_designs_auth_all" ON loja_online_capa_designs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE loja_online_capa_designs IS
  'Artes de capas personalizadas criadas na loja online (prévia, arquivo de impressão e fotos originais).';

-- Item do pedido guarda a arte escolhida (id, modelo, prévia e arquivo de impressão).
ALTER TABLE loja_online_pedido_itens ADD COLUMN IF NOT EXISTS personalizacao_json TEXT;

-- Arquivos das artes: prévia (mockup), PNG de impressão e fotos originais.
-- No plano Free o Supabase ainda limita cada upload a ~50 MB.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'capas-personalizadas',
  'capas-personalizadas',
  true,
  104857600, -- 100 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/heic']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Allow anon upload capas-personalizadas" ON storage.objects;
CREATE POLICY "Allow anon upload capas-personalizadas" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'capas-personalizadas');

DROP POLICY IF EXISTS "Allow anon read capas-personalizadas" ON storage.objects;
CREATE POLICY "Allow anon read capas-personalizadas" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'capas-personalizadas');

DROP POLICY IF EXISTS "Allow authenticated upload capas-personalizadas" ON storage.objects;
CREATE POLICY "Allow authenticated upload capas-personalizadas" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'capas-personalizadas');

DROP POLICY IF EXISTS "Allow authenticated read capas-personalizadas" ON storage.objects;
CREATE POLICY "Allow authenticated read capas-personalizadas" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'capas-personalizadas');
