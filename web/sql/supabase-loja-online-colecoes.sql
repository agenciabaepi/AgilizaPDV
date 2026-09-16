-- =============================================================================
-- Agiliza PDV — Coleções da loja online
-- Agrupam produtos temáticos (ex.: coleção cristã, Marvel, católica) com
-- foto de capa da página e foto do card na vitrine.
-- =============================================================================

CREATE TABLE IF NOT EXISTS loja_online_colecoes (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL,
  subtitulo TEXT,
  descricao TEXT,
  categoria_id TEXT REFERENCES categorias(id) ON DELETE SET NULL,
  imagem TEXT,
  imagem_capa TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loja_online_colecoes_empresa
  ON loja_online_colecoes(empresa_id, ativo, ordem);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loja_online_colecoes_slug
  ON loja_online_colecoes(empresa_id, slug);

CREATE TABLE IF NOT EXISTS loja_online_colecao_produtos (
  colecao_id TEXT NOT NULL REFERENCES loja_online_colecoes(id) ON DELETE CASCADE,
  produto_id TEXT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (colecao_id, produto_id)
);

CREATE INDEX IF NOT EXISTS idx_loja_online_colecao_produtos_produto
  ON loja_online_colecao_produtos(produto_id);

ALTER TABLE loja_online_colecoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE loja_online_colecao_produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loja_online_colecoes_anon_all" ON loja_online_colecoes;
CREATE POLICY "loja_online_colecoes_anon_all" ON loja_online_colecoes
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "loja_online_colecao_produtos_anon_all" ON loja_online_colecao_produtos;
CREATE POLICY "loja_online_colecao_produtos_anon_all" ON loja_online_colecao_produtos
  FOR ALL TO anon USING (true) WITH CHECK (true);

COMMENT ON TABLE loja_online_colecoes IS
  'Coleções temáticas da vitrine (ex.: Marvel, cristã, católica) com capa e produtos.';
COMMENT ON COLUMN loja_online_colecoes.imagem IS
  'Foto do card da coleção na home da loja.';
COMMENT ON COLUMN loja_online_colecoes.imagem_capa IS
  'Foto de capa da página da coleção.';
COMMENT ON COLUMN loja_online_colecoes.categoria_id IS
  'Categoria usada para filtrar produtos no cadastro (opcional).';
