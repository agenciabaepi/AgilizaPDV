-- Usuários de suporte (acesso às configurações do sistema)
CREATE TABLE IF NOT EXISTS suporte_usuarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
