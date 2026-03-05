-- Novos campos no cadastro de produtos: código sequencial, fornecedor, subcategoria, descrição, imagem, markup, parte fiscal (NCM, CFOP)

ALTER TABLE produtos ADD COLUMN codigo INTEGER;
ALTER TABLE produtos ADD COLUMN fornecedor_id TEXT REFERENCES fornecedores(id);
ALTER TABLE produtos ADD COLUMN subcategoria TEXT;
ALTER TABLE produtos ADD COLUMN descricao TEXT;
ALTER TABLE produtos ADD COLUMN imagem TEXT;
ALTER TABLE produtos ADD COLUMN markup REAL DEFAULT 0;
ALTER TABLE produtos ADD COLUMN ncm TEXT;
ALTER TABLE produtos ADD COLUMN cfop TEXT;

-- Preencher código sequencial para produtos existentes (por empresa)
-- SQLite não suporta UPDATE com subquery que referencia a mesma tabela de forma complexa, então fazemos em duas etapas via aplicação ou deixamos NULL para antigos

CREATE INDEX IF NOT EXISTS idx_produtos_empresa_codigo ON produtos(empresa_id, codigo);
CREATE INDEX IF NOT EXISTS idx_produtos_fornecedor ON produtos(fornecedor_id);
