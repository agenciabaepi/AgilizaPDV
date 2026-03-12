-- Certificado digital A1 (PFX) por empresa
-- caminho_arquivo: path absoluto do .pfx no userData/certificados
-- senha_encrypted: senha do certificado criptografada (Electron safeStorage)

CREATE TABLE IF NOT EXISTS empresa_certificado (
  empresa_id TEXT PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  caminho_arquivo TEXT NOT NULL,
  senha_encrypted TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_empresa_certificado_empresa ON empresa_certificado(empresa_id);
