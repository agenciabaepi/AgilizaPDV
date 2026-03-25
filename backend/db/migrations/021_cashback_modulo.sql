-- Módulo Cashback: forma CASHBACK em pagamentos, carteira (créditos FIFO + extrato), regras e config por empresa.
--
-- APENAS SQLite (pdv.db / app Electron). NÃO execute este arquivo no PostgreSQL ou Supabase — use:
--   docs/supabase-cashback-migracao.sql
-- ou o espelho em store-server/src/schema/004_cashback.sql

PRAGMA foreign_keys = OFF;

CREATE TABLE pagamentos_new (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  venda_id TEXT NOT NULL REFERENCES vendas(id),
  forma TEXT NOT NULL CHECK (forma IN ('DINHEIRO','PIX','DEBITO','CREDITO','OUTROS','CASHBACK')),
  valor REAL NOT NULL
);
INSERT INTO pagamentos_new SELECT id, empresa_id, venda_id, forma, valor FROM pagamentos;
DROP TABLE pagamentos;
ALTER TABLE pagamentos_new RENAME TO pagamentos;

PRAGMA foreign_keys = ON;

ALTER TABLE vendas ADD COLUMN cashback_gerado REAL NOT NULL DEFAULT 0;
ALTER TABLE vendas ADD COLUMN cashback_usado REAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS cashback_configuracoes (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL UNIQUE REFERENCES empresas(id),
  ativo INTEGER NOT NULL DEFAULT 0,
  percentual_padrao REAL NOT NULL DEFAULT 0,
  modo_validade TEXT NOT NULL DEFAULT 'NUNCA' CHECK (modo_validade IN ('DIAS','FIXA','NUNCA')),
  dias_validade INTEGER,
  data_validade_fixa TEXT,
  valor_minimo_compra_gerar REAL NOT NULL DEFAULT 0,
  valor_minimo_compra_usar REAL NOT NULL DEFAULT 0,
  valor_maximo_uso_por_venda REAL,
  permitir_quitar_total INTEGER NOT NULL DEFAULT 1,
  permitir_uso_mesma_compra INTEGER NOT NULL DEFAULT 1,
  calcular_sobre TEXT NOT NULL DEFAULT 'ELEGIVEL' CHECK (calcular_sobre IN ('BRUTO','LIQUIDO','ELEGIVEL')),
  excluir_itens_com_desconto INTEGER NOT NULL DEFAULT 0,
  excluir_itens_promocionais INTEGER NOT NULL DEFAULT 0,
  gerar_sobre_valor_apos_cashback INTEGER NOT NULL DEFAULT 0,
  modo_lista TEXT NOT NULL DEFAULT 'TODOS_EXCETO_EXCLUIDOS' CHECK (modo_lista IN ('TODOS_EXCETO_EXCLUIDOS','APENAS_INCLUIDOS')),
  arredondamento TEXT NOT NULL DEFAULT 'PADRAO' CHECK (arredondamento IN ('PADRAO','PARA_BAIXO')),
  dias_alerta_expiracao INTEGER NOT NULL DEFAULT 7,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cashback_regras (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('EXCLUIR_PRODUTO','INCLUIR_PRODUTO','PERCENTUAL_PRODUTO','PERCENTUAL_CATEGORIA')),
  produto_id TEXT REFERENCES produtos(id),
  categoria_id TEXT REFERENCES categorias(id),
  percentual REAL,
  ativo INTEGER NOT NULL DEFAULT 1,
  valido_de TEXT,
  valido_ate TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cashback_regras_empresa ON cashback_regras(empresa_id);

CREATE TABLE IF NOT EXISTS cashback_creditos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  cliente_id TEXT REFERENCES clientes(id),
  cpf_normalizado TEXT NOT NULL,
  venda_id_origem TEXT REFERENCES vendas(id),
  valor_inicial REAL NOT NULL,
  valor_restante REAL NOT NULL,
  expira_em TEXT,
  status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO','EXPIRADO','ESTORNADO')),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cashback_creditos_empresa_cpf ON cashback_creditos(empresa_id, cpf_normalizado);
CREATE INDEX IF NOT EXISTS idx_cashback_creditos_empresa_cliente ON cashback_creditos(empresa_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_cashback_creditos_expira ON cashback_creditos(empresa_id, expira_em);

CREATE TABLE IF NOT EXISTS cashback_movimentacoes (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  cliente_id TEXT REFERENCES clientes(id),
  cpf_normalizado TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'CREDITO_VENDA','DEBITO_USO','EXPIRACAO','AJUSTE_CREDITO','AJUSTE_DEBITO',
    'REVERSAO_CREDITO_VENDA','ESTORNO_DEBITO_USO'
  )),
  origem TEXT NOT NULL,
  venda_id TEXT REFERENCES vendas(id),
  credito_id TEXT REFERENCES cashback_creditos(id),
  valor REAL NOT NULL,
  saldo_disponivel_apos REAL,
  idempotency_key TEXT,
  observacao TEXT,
  meta_json TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cashback_mov_idempotency ON cashback_movimentacoes(empresa_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cashback_mov_empresa_cpf ON cashback_movimentacoes(empresa_id, cpf_normalizado);
CREATE INDEX IF NOT EXISTS idx_cashback_mov_empresa_cliente ON cashback_movimentacoes(empresa_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_cashback_mov_venda ON cashback_movimentacoes(venda_id);

CREATE TABLE IF NOT EXISTS cashback_saldos (
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  cliente_id TEXT NOT NULL REFERENCES clientes(id),
  cpf_normalizado TEXT NOT NULL,
  saldo_disponivel REAL NOT NULL DEFAULT 0,
  saldo_expirado_acumulado REAL NOT NULL DEFAULT 0,
  total_gerado REAL NOT NULL DEFAULT 0,
  total_utilizado REAL NOT NULL DEFAULT 0,
  total_ajuste_credito REAL NOT NULL DEFAULT 0,
  total_ajuste_debito REAL NOT NULL DEFAULT 0,
  bloqueado INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (empresa_id, cliente_id)
);
CREATE INDEX IF NOT EXISTS idx_cashback_saldos_cpf ON cashback_saldos(empresa_id, cpf_normalizado);
