-- Cashback no PostgreSQL / Supabase (espelho de store-server/src/schema/004_cashback.sql).
-- NÃO use backend/db/migrations/021_cashback_modulo.sql aqui — aquele arquivo é só SQLite (contém PRAGMA).

ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cashback_gerado NUMERIC(15,4) NOT NULL DEFAULT 0;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cashback_usado NUMERIC(15,4) NOT NULL DEFAULT 0;

ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_forma_check;
ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_forma_check CHECK (forma IN ('DINHEIRO','PIX','DEBITO','CREDITO','OUTROS','CASHBACK'));

CREATE TABLE IF NOT EXISTS cashback_configuracoes (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL UNIQUE REFERENCES empresas(id),
  ativo INTEGER NOT NULL DEFAULT 0,
  percentual_padrao NUMERIC(15,4) NOT NULL DEFAULT 0,
  modo_validade TEXT NOT NULL DEFAULT 'NUNCA' CHECK (modo_validade IN ('DIAS','FIXA','NUNCA')),
  dias_validade INTEGER,
  data_validade_fixa TEXT,
  valor_minimo_compra_gerar NUMERIC(15,4) NOT NULL DEFAULT 0,
  valor_minimo_compra_usar NUMERIC(15,4) NOT NULL DEFAULT 0,
  valor_maximo_uso_por_venda NUMERIC(15,4),
  permitir_quitar_total INTEGER NOT NULL DEFAULT 1,
  permitir_uso_mesma_compra INTEGER NOT NULL DEFAULT 1,
  calcular_sobre TEXT NOT NULL DEFAULT 'ELEGIVEL' CHECK (calcular_sobre IN ('BRUTO','LIQUIDO','ELEGIVEL')),
  excluir_itens_com_desconto INTEGER NOT NULL DEFAULT 0,
  excluir_itens_promocionais INTEGER NOT NULL DEFAULT 0,
  gerar_sobre_valor_apos_cashback INTEGER NOT NULL DEFAULT 0,
  modo_lista TEXT NOT NULL DEFAULT 'TODOS_EXCETO_EXCLUIDOS' CHECK (modo_lista IN ('TODOS_EXCETO_EXCLUIDOS','APENAS_INCLUIDOS')),
  arredondamento TEXT NOT NULL DEFAULT 'PADRAO' CHECK (arredondamento IN ('PADRAO','PARA_BAIXO')),
  dias_alerta_expiracao INTEGER NOT NULL DEFAULT 7,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cashback_regras (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('EXCLUIR_PRODUTO','INCLUIR_PRODUTO','PERCENTUAL_PRODUTO','PERCENTUAL_CATEGORIA')),
  produto_id TEXT REFERENCES produtos(id),
  categoria_id TEXT REFERENCES categorias(id),
  percentual NUMERIC(15,4),
  ativo INTEGER NOT NULL DEFAULT 1,
  valido_de TIMESTAMPTZ,
  valido_ate TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cashback_regras_empresa ON cashback_regras(empresa_id);

CREATE TABLE IF NOT EXISTS cashback_creditos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  cliente_id TEXT REFERENCES clientes(id),
  cpf_normalizado TEXT NOT NULL,
  venda_id_origem TEXT REFERENCES vendas(id),
  valor_inicial NUMERIC(15,4) NOT NULL,
  valor_restante NUMERIC(15,4) NOT NULL,
  expira_em TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO','EXPIRADO','ESTORNADO')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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
  valor NUMERIC(15,4) NOT NULL,
  saldo_disponivel_apos NUMERIC(15,4),
  idempotency_key TEXT,
  observacao TEXT,
  meta_json TEXT,
  created_by TEXT REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cashback_mov_idempotency ON cashback_movimentacoes(empresa_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cashback_mov_empresa_cpf ON cashback_movimentacoes(empresa_id, cpf_normalizado);
CREATE INDEX IF NOT EXISTS idx_cashback_mov_empresa_cliente ON cashback_movimentacoes(empresa_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_cashback_mov_venda ON cashback_movimentacoes(venda_id);

CREATE TABLE IF NOT EXISTS cashback_saldos (
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  cliente_id TEXT NOT NULL REFERENCES clientes(id),
  cpf_normalizado TEXT NOT NULL,
  saldo_disponivel NUMERIC(15,4) NOT NULL DEFAULT 0,
  saldo_expirado_acumulado NUMERIC(15,4) NOT NULL DEFAULT 0,
  total_gerado NUMERIC(15,4) NOT NULL DEFAULT 0,
  total_utilizado NUMERIC(15,4) NOT NULL DEFAULT 0,
  total_ajuste_credito NUMERIC(15,4) NOT NULL DEFAULT 0,
  total_ajuste_debito NUMERIC(15,4) NOT NULL DEFAULT 0,
  bloqueado INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id, cliente_id)
);
CREATE INDEX IF NOT EXISTS idx_cashback_saldos_cpf ON cashback_saldos(empresa_id, cpf_normalizado);

-- Participação no cashback no cadastro do produto (espelho de backend/db/migrations/022_produtos_cashback.sql)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cashback_ativo INTEGER NOT NULL DEFAULT 1;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cashback_percentual NUMERIC(8, 4);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS permitir_resgate_cashback_no_produto INTEGER NOT NULL DEFAULT 1;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cashback_observacao TEXT;
