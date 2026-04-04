-- =============================================================================
-- Agiliza PDV – Tabelas espelho no Supabase (mesma estrutura do SQLite)
-- Para painel web e relatórios. Execute após supabase-setup.sql
--
-- Se você já tinha o espelho criado antes da feature de categorias hierárquicas,
-- execute supabase-migrate-categorias.sql para adicionar tabela categorias
-- e a coluna produtos.categoria_id.
-- =============================================================================

-- Empresas
CREATE TABLE IF NOT EXISTS empresas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Número usado no login do PDV (sem listar nomes de empresas). Execute em espelhos já criados:
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS codigo_acesso INTEGER UNIQUE;

-- Usuários (vendedores, funcionários, admin/gerente). modulos_json = permissões por usuário.
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

-- Categorias hierárquicas (grupo → categoria → subcategoria)
CREATE TABLE IF NOT EXISTS categorias (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  parent_id TEXT REFERENCES categorias(id),
  nivel INTEGER NOT NULL DEFAULT 1 CHECK (nivel >= 1),
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categorias_empresa ON categorias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_categorias_parent ON categorias(parent_id);

-- Produtos (categoria_id referencia categorias)
CREATE TABLE IF NOT EXISTS produtos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  codigo INTEGER,
  nome TEXT NOT NULL,
  sku TEXT,
  codigo_barras TEXT,
  fornecedor_id TEXT,
  categoria_id TEXT REFERENCES categorias(id),
  descricao TEXT,
  imagem TEXT,
  custo REAL NOT NULL DEFAULT 0,
  markup REAL DEFAULT 0,
  preco REAL NOT NULL DEFAULT 0,
  unidade TEXT DEFAULT 'UN',
  controla_estoque INTEGER NOT NULL DEFAULT 1,
  estoque_minimo REAL NOT NULL DEFAULT 0,
  estoque_atual REAL NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  ncm TEXT,
  cfop TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_empresa_codigo ON produtos(empresa_id, codigo);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON clientes(empresa_id);

-- Fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  cnpj TEXT,
  contato TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa ON fornecedores(empresa_id);

-- Estoque movimentos
CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  produto_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA','SAIDA','AJUSTE','DEVOLUCAO')),
  quantidade REAL NOT NULL,
  custo_unitario REAL,
  referencia_tipo TEXT,
  referencia_id TEXT,
  usuario_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estoque_mov_empresa ON estoque_movimentos(empresa_id);

-- Caixas
CREATE TABLE IF NOT EXISTS caixas (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  usuario_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ABERTO','FECHADO')),
  valor_inicial REAL NOT NULL DEFAULT 0,
  aberto_em TIMESTAMPTZ DEFAULT now(),
  fechado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_caixas_empresa ON caixas(empresa_id);

-- Caixa movimentos
CREATE TABLE IF NOT EXISTS caixa_movimentos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  caixa_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('SANGRIA','SUPRIMENTO')),
  valor REAL NOT NULL,
  motivo TEXT,
  usuario_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vendas
CREATE TABLE IF NOT EXISTS vendas (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  caixa_id TEXT NOT NULL,
  usuario_id TEXT NOT NULL,
  cliente_id TEXT,
  numero INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CONCLUIDA','CANCELADA')),
  subtotal REAL NOT NULL DEFAULT 0,
  desconto_total REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  troco REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendas_empresa ON vendas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_vendas_empresa_numero ON vendas(empresa_id, numero);

-- Venda itens
CREATE TABLE IF NOT EXISTS venda_itens (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  venda_id TEXT NOT NULL,
  produto_id TEXT NOT NULL,
  descricao TEXT NOT NULL,
  preco_unitario REAL NOT NULL,
  quantidade REAL NOT NULL,
  desconto REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_venda_itens_venda ON venda_itens(venda_id);

-- Pagamentos
CREATE TABLE IF NOT EXISTS pagamentos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  venda_id TEXT NOT NULL,
  forma TEXT NOT NULL CHECK (forma IN ('DINHEIRO','PIX','DEBITO','CREDITO','OUTROS')),
  valor REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_venda ON pagamentos(venda_id);

-- RLS: permitir anon inserir/atualizar nas tabelas espelho (app envia dados)
-- Para painel web você pode criar políticas de SELECT com auth ou service_role
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;

-- Política: anon pode fazer INSERT e UPDATE (upsert) em todas
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['empresas','usuarios','categorias','produtos','clientes','fornecedores','estoque_movimentos','caixas','caixa_movimentos','vendas','venda_itens','pagamentos'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow anon all mirror %s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "Allow anon all mirror %s" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;
