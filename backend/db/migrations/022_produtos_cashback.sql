-- Cashback por produto (participação, % opcional, resgate na venda, observação interna)
ALTER TABLE produtos ADD COLUMN cashback_ativo INTEGER NOT NULL DEFAULT 1;
ALTER TABLE produtos ADD COLUMN cashback_percentual REAL;
ALTER TABLE produtos ADD COLUMN permitir_resgate_cashback_no_produto INTEGER NOT NULL DEFAULT 1;
ALTER TABLE produtos ADD COLUMN cashback_observacao TEXT;
