-- Vínculo venda → NF-e (modelo 55)
-- Uma venda pode ter no máximo uma NF-e autorizada (por enquanto).

CREATE TABLE IF NOT EXISTS venda_nfe (
  venda_id TEXT PRIMARY KEY REFERENCES vendas(id) ON DELETE CASCADE,
  modelo INTEGER NOT NULL DEFAULT 55,
  serie INTEGER NOT NULL,
  numero_nfe INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'AUTORIZADA', 'REJEITADA', 'ERRO', 'CANCELADA')),
  chave TEXT,
  protocolo TEXT,
  mensagem_sefaz TEXT,
  xml_local_path TEXT,
  xml_supabase_path TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_venda_nfe_status ON venda_nfe(status);

