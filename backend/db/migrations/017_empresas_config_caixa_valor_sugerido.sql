-- SQLite na versão usada aqui não entende "IF NOT EXISTS" em ADD COLUMN,
-- por isso mantemos a migração simples. Em bancos já migrados, ela só vai
-- falhar uma vez e depois não será reaplicada.
ALTER TABLE empresas_config ADD COLUMN caixa_valor_sugerido_abertura REAL DEFAULT 0;
