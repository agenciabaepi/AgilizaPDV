-- =============================================================================
-- View opcional: produtos com Grupo, Categoria e Subcategoria (só leitura)
-- Execute no SQL Editor do Supabase se quiser ver o caminho da categoria
-- ao consultar produtos (ex.: relatórios). O app usa apenas produtos.categoria_id.
-- =============================================================================

CREATE OR REPLACE VIEW produtos_com_categoria AS
SELECT
  p.id,
  p.empresa_id,
  p.codigo,
  p.nome,
  p.sku,
  p.codigo_barras,
  p.fornecedor_id,
  p.categoria_id,
  p.descricao,
  p.imagem,
  p.custo,
  p.markup,
  p.preco,
  p.unidade,
  p.controla_estoque,
  p.estoque_minimo,
  p.ativo,
  p.ncm,
  p.cfop,
  p.created_at,
  p.updated_at,
  -- Caminho da categoria (quando categoria_id aponta para uma folha de nível 3)
  sub.nome AS subcategoria,
  cat.nome AS categoria,
  grp.nome AS grupo
FROM produtos p
LEFT JOIN categorias sub ON sub.id = p.categoria_id
LEFT JOIN categorias cat ON cat.id = sub.parent_id
LEFT JOIN categorias grp ON grp.id = cat.parent_id;
