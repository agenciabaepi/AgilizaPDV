-- =============================================================================
-- Espelho NFC-e / NF-e (metadados) — alinhado ao SQLite local
-- Execute após supabase-mirror-tables.sql (tabela `vendas` deve existir).
-- O ficheiro XML em si fica em Storage (buckets nfce-xml / nfe-xml); aqui só
-- caminhos e chave para listar notas em qualquer terminal após sync.
-- =============================================================================

CREATE TABLE IF NOT EXISTS venda_nfce (
  venda_id TEXT PRIMARY KEY REFERENCES vendas(id) ON DELETE CASCADE,
  numero_nfce INTEGER NOT NULL,
  status TEXT NOT NULL,
  chave TEXT,
  protocolo TEXT,
  mensagem_sefaz TEXT,
  xml_local_path TEXT,
  xml_supabase_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venda_nfce_status ON venda_nfce(status);

CREATE TABLE IF NOT EXISTS venda_nfe (
  venda_id TEXT PRIMARY KEY REFERENCES vendas(id) ON DELETE CASCADE,
  modelo INTEGER NOT NULL DEFAULT 55,
  serie INTEGER NOT NULL,
  numero_nfe INTEGER NOT NULL,
  status TEXT NOT NULL,
  chave TEXT,
  protocolo TEXT,
  mensagem_sefaz TEXT,
  xml_local_path TEXT,
  xml_supabase_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venda_nfe_status ON venda_nfe(status);

ALTER TABLE venda_nfce ENABLE ROW LEVEL SECURITY;
ALTER TABLE venda_nfe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all mirror venda_nfce" ON venda_nfce;
CREATE POLICY "Allow anon all mirror venda_nfce" ON venda_nfce
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all mirror venda_nfe" ON venda_nfe;
CREATE POLICY "Allow anon all mirror venda_nfe" ON venda_nfe
  FOR ALL TO anon USING (true) WITH CHECK (true);
