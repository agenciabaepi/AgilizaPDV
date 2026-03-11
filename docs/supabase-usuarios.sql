-- =============================================================================
-- Agiliza PDV – Tabela de usuários (vendedores, funcionários, admin)
-- Já incluída em: backend/db/migrations/001_initial.sql (SQLite)
--                docs/supabase-mirror-tables.sql (Supabase)
-- Use este arquivo para referência ou para criar só a tabela usuarios no Supabase.
-- =============================================================================

-- Supabase / Postgres
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  login TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','gerente','caixa','estoque')),
  modulos_json TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(empresa_id, login)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios(empresa_id);

-- Roles:
--   admin   = Administrador (acesso total)
--   gerente = Gerente (cadastros e usuários)
--   caixa   = Caixa / Vendedor (opera o PDV)
--   estoque = Estoque / Funcionário (movimenta estoque)

-- Se a tabela usuarios já existir sem UNIQUE(empresa_id, login), execute (uma vez):
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_empresa_login ON usuarios(empresa_id, login);
