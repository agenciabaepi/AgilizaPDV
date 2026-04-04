-- Reparo idempotente: garante CHECK de `pagamentos.forma` com A_PRAZO e dados limpos.
-- Útil se um Postgres ficou com 004 antigo (CHECK sem A_PRAZO) e dados já tinham venda a prazo.

ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_forma_check;
UPDATE pagamentos SET forma = UPPER(TRIM(forma)) WHERE forma IS NOT NULL;
UPDATE pagamentos SET forma = 'A_PRAZO' WHERE forma IN ('A PRAZO', 'APRAZO', 'À PRAZO', 'VENDA A PRAZO', 'PRAZO');
UPDATE pagamentos SET forma = 'OUTROS' WHERE forma NOT IN ('DINHEIRO','PIX','DEBITO','CREDITO','OUTROS','CASHBACK','A_PRAZO');
ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_forma_check CHECK (forma IN ('DINHEIRO','PIX','DEBITO','CREDITO','OUTROS','CASHBACK','A_PRAZO'));
