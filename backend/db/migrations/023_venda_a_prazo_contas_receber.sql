-- Venda a prazo: forma A_PRAZO, contas a receber, limite de crédito e bloqueio de inadimplentes.
--
-- APENAS SQLite (pdv.db). NÃO rode este arquivo no PostgreSQL/Supabase — dá erro em PRAGMA.
-- Para Supabase use: docs/supabase-venda-a-prazo-migracao.sql
-- Para store-server (Postgres): store-server/src/schema/006_venda_a_prazo.sql

PRAGMA foreign_keys = OFF;

CREATE TABLE pagamentos_new (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  venda_id TEXT NOT NULL REFERENCES vendas(id),
  forma TEXT NOT NULL CHECK (forma IN ('DINHEIRO','PIX','DEBITO','CREDITO','OUTROS','CASHBACK','A_PRAZO')),
  valor REAL NOT NULL
);
INSERT INTO pagamentos_new SELECT id, empresa_id, venda_id, forma, valor FROM pagamentos;
DROP TABLE pagamentos;
ALTER TABLE pagamentos_new RENAME TO pagamentos;

PRAGMA foreign_keys = ON;

ALTER TABLE vendas ADD COLUMN venda_a_prazo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vendas ADD COLUMN data_vencimento TEXT;

CREATE TABLE IF NOT EXISTS contas_receber (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  venda_id TEXT NOT NULL UNIQUE REFERENCES vendas(id),
  cliente_id TEXT NOT NULL REFERENCES clientes(id),
  valor REAL NOT NULL,
  vencimento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','RECEBIDA','CANCELADA')),
  recebido_em TEXT,
  recebimento_caixa_id TEXT REFERENCES caixas(id),
  forma_recebimento TEXT,
  usuario_recebimento_id TEXT REFERENCES usuarios(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa_cliente ON contas_receber(empresa_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa_status ON contas_receber(empresa_id, status);

ALTER TABLE clientes ADD COLUMN limite_credito REAL;

ALTER TABLE empresas_config ADD COLUMN venda_prazo_usar_limite_credito INTEGER NOT NULL DEFAULT 0;
ALTER TABLE empresas_config ADD COLUMN venda_prazo_bloquear_inadimplente INTEGER NOT NULL DEFAULT 0;
