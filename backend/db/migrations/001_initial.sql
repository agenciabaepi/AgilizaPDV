-- Migração inicial — todas as tabelas do PDV (spec)
-- IDs em TEXT (UUID). Datas em TEXT ISO8601.

-- Empresas
CREATE TABLE IF NOT EXISTS empresas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Usuários (roles: admin, gerente, caixa, estoque)
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  login TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','gerente','caixa','estoque')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(empresa_id, login)
);

-- Produtos
CREATE TABLE IF NOT EXISTS produtos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  sku TEXT,
  codigo_barras TEXT,
  categoria TEXT,
  custo REAL NOT NULL DEFAULT 0,
  preco REAL NOT NULL DEFAULT 0,
  unidade TEXT DEFAULT 'UN',
  controla_estoque INTEGER NOT NULL DEFAULT 1,
  estoque_minimo REAL NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  observacoes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  razao_social TEXT NOT NULL,
  cnpj TEXT,
  contato TEXT,
  observacoes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Estoque — movimentos (ENTRADA, SAIDA, AJUSTE, DEVOLUCAO)
CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  produto_id TEXT NOT NULL REFERENCES produtos(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA','SAIDA','AJUSTE','DEVOLUCAO')),
  quantidade REAL NOT NULL,
  custo_unitario REAL,
  referencia_tipo TEXT,
  referencia_id TEXT,
  usuario_id TEXT REFERENCES usuarios(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Caixas (status: ABERTO, FECHADO)
CREATE TABLE IF NOT EXISTS caixas (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  status TEXT NOT NULL CHECK (status IN ('ABERTO','FECHADO')),
  valor_inicial REAL NOT NULL DEFAULT 0,
  aberto_em TEXT DEFAULT (datetime('now')),
  fechado_em TEXT
);

-- Caixa movimentos (SANGRIA, SUPRIMENTO)
CREATE TABLE IF NOT EXISTS caixa_movimentos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  caixa_id TEXT NOT NULL REFERENCES caixas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('SANGRIA','SUPRIMENTO')),
  valor REAL NOT NULL,
  motivo TEXT,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Vendas (status: CONCLUIDA, CANCELADA)
CREATE TABLE IF NOT EXISTS vendas (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  caixa_id TEXT NOT NULL REFERENCES caixas(id),
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  cliente_id TEXT REFERENCES clientes(id),
  numero INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CONCLUIDA','CANCELADA')),
  subtotal REAL NOT NULL DEFAULT 0,
  desconto_total REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  troco REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Índice para próximo número de venda por empresa/caixa
CREATE INDEX IF NOT EXISTS idx_vendas_empresa_numero ON vendas(empresa_id, numero);

-- Itens da venda
CREATE TABLE IF NOT EXISTS venda_itens (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  venda_id TEXT NOT NULL REFERENCES vendas(id),
  produto_id TEXT NOT NULL REFERENCES produtos(id),
  descricao TEXT NOT NULL,
  preco_unitario REAL NOT NULL,
  quantidade REAL NOT NULL,
  desconto REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL
);

-- Pagamentos (DINHEIRO, PIX, DEBITO, CREDITO, OUTROS)
CREATE TABLE IF NOT EXISTS pagamentos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  venda_id TEXT NOT NULL REFERENCES vendas(id),
  forma TEXT NOT NULL CHECK (forma IN ('DINHEIRO','PIX','DEBITO','CREDITO','OUTROS')),
  valor REAL NOT NULL
);

-- Sync outbox (PENDING, SENT, ERROR)
CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','ERROR')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status);
