-- Schema Postgres espelho do SQLite (001 + 002 + 003 + 004)
-- IDs UUID TEXT. Datas TIMESTAMPTZ.

-- Empresas
CREATE TABLE IF NOT EXISTS empresas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Usuários (roles: admin, gerente, caixa, estoque)
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  login TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','gerente','caixa','estoque')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, login)
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
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  razao_social TEXT NOT NULL,
  cnpj TEXT,
  contato TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Categorias (hierárquicas) - antes de produtos
CREATE TABLE IF NOT EXISTS categorias (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  parent_id TEXT REFERENCES categorias(id),
  nivel INTEGER NOT NULL DEFAULT 1 CHECK (nivel >= 1),
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_categorias_empresa ON categorias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_categorias_parent ON categorias(parent_id);
CREATE INDEX IF NOT EXISTS idx_categorias_empresa_parent_ordem ON categorias(empresa_id, parent_id, ordem);

-- Produtos (com codigo, fornecedor_id, categoria_id, descricao, imagem, markup, ncm, cfop)
CREATE TABLE IF NOT EXISTS produtos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  codigo INTEGER,
  nome TEXT NOT NULL,
  sku TEXT,
  codigo_barras TEXT,
  fornecedor_id TEXT REFERENCES fornecedores(id),
  categoria_id TEXT REFERENCES categorias(id),
  descricao TEXT,
  imagem TEXT,
  custo NUMERIC(15,4) NOT NULL DEFAULT 0,
  markup NUMERIC(15,4) NOT NULL DEFAULT 0,
  preco NUMERIC(15,4) NOT NULL DEFAULT 0,
  unidade TEXT DEFAULT 'UN',
  controla_estoque INTEGER NOT NULL DEFAULT 1,
  estoque_minimo NUMERIC(15,4) NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  ncm TEXT,
  cfop TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_empresa_codigo ON produtos(empresa_id, codigo);
CREATE INDEX IF NOT EXISTS idx_produtos_fornecedor ON produtos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);

-- Estoque movimentos
CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  produto_id TEXT NOT NULL REFERENCES produtos(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA','SAIDA','AJUSTE','DEVOLUCAO')),
  quantidade NUMERIC(15,4) NOT NULL,
  custo_unitario NUMERIC(15,4),
  referencia_tipo TEXT,
  referencia_id TEXT,
  usuario_id TEXT REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_estoque_empresa_produto ON estoque_movimentos(empresa_id, produto_id);

-- Caixas
CREATE TABLE IF NOT EXISTS caixas (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  status TEXT NOT NULL CHECK (status IN ('ABERTO','FECHADO')),
  valor_inicial NUMERIC(15,4) NOT NULL DEFAULT 0,
  aberto_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  fechado_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_caixas_empresa_status ON caixas(empresa_id, status);

-- Caixa movimentos
CREATE TABLE IF NOT EXISTS caixa_movimentos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  caixa_id TEXT NOT NULL REFERENCES caixas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('SANGRIA','SUPRIMENTO')),
  valor NUMERIC(15,4) NOT NULL,
  motivo TEXT,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Vendas
CREATE TABLE IF NOT EXISTS vendas (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  caixa_id TEXT NOT NULL REFERENCES caixas(id),
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  cliente_id TEXT REFERENCES clientes(id),
  numero INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CONCLUIDA','CANCELADA')),
  subtotal NUMERIC(15,4) NOT NULL DEFAULT 0,
  desconto_total NUMERIC(15,4) NOT NULL DEFAULT 0,
  total NUMERIC(15,4) NOT NULL DEFAULT 0,
  troco NUMERIC(15,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vendas_empresa_numero ON vendas(empresa_id, numero);
CREATE INDEX IF NOT EXISTS idx_vendas_empresa_created ON vendas(empresa_id, created_at DESC);

-- Venda itens
CREATE TABLE IF NOT EXISTS venda_itens (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  venda_id TEXT NOT NULL REFERENCES vendas(id),
  produto_id TEXT NOT NULL REFERENCES produtos(id),
  descricao TEXT NOT NULL,
  preco_unitario NUMERIC(15,4) NOT NULL,
  quantidade NUMERIC(15,4) NOT NULL,
  desconto NUMERIC(15,4) NOT NULL DEFAULT 0,
  total NUMERIC(15,4) NOT NULL
);

-- Pagamentos
CREATE TABLE IF NOT EXISTS pagamentos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  venda_id TEXT NOT NULL REFERENCES vendas(id),
  forma TEXT NOT NULL CHECK (forma IN ('DINHEIRO','PIX','DEBITO','CREDITO','OUTROS')),
  valor NUMERIC(15,4) NOT NULL
);

-- Sync outbox (Supabase)
CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','ERROR')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status);

-- Suporte usuarios (local ao servidor; não sincronizado)
CREATE TABLE IF NOT EXISTS suporte_usuarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
