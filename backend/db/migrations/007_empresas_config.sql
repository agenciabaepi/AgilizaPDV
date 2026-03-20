-- Configurações da loja: dados da empresa, logo, cor do sistema, módulos
-- Suporte usa para personalizar a experiência do cliente

CREATE TABLE IF NOT EXISTS empresas_config (
  empresa_id TEXT PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  razao_social TEXT,
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  logo TEXT,
  cor_primaria TEXT DEFAULT '#1d4ed8',
  modulos_json TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_empresas_config_empresa ON empresas_config(empresa_id);
