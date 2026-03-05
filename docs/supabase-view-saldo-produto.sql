-- =============================================================================
-- View: saldo atual por produto (mesma regra do app)
-- ENTRADA/DEVOLUCAO: +quantidade | SAIDA: -quantidade | AJUSTE: +quantidade
-- Execute no SQL Editor do Supabase para comparar com o "Saldo" do app.
-- =============================================================================

CREATE OR REPLACE VIEW produto_saldo AS
SELECT
  m.produto_id,
  m.empresa_id,
  SUM(
    CASE m.tipo
      WHEN 'ENTRADA' THEN m.quantidade
      WHEN 'DEVOLUCAO' THEN m.quantidade
      WHEN 'SAIDA' THEN -m.quantidade
      WHEN 'AJUSTE' THEN m.quantidade
      ELSE 0
    END
  ) AS saldo
FROM estoque_movimentos m
GROUP BY m.empresa_id, m.produto_id;

-- Exemplo: ver saldo junto com nome do produto
-- SELECT p.nome, ps.saldo
-- FROM produto_saldo ps
-- JOIN produtos p ON p.id = ps.produto_id
-- WHERE ps.empresa_id = 'seu-empresa-id'
-- ORDER BY p.nome;
