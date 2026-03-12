-- Vínculo venda → NFC-e (uma venda pode ter no máximo uma NFC-e autorizada)
CREATE TABLE IF NOT EXISTS venda_nfce (
  venda_id TEXT PRIMARY KEY REFERENCES vendas(id) ON DELETE CASCADE,
  numero_nfce INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'AUTORIZADA', 'REJEITADA', 'ERRO', 'CANCELADA')),
  chave TEXT,
  protocolo TEXT,
  mensagem_sefaz TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_venda_nfce_status ON venda_nfce(status);
