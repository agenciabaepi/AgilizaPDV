-- Peso e dimensões do pacote para cotação de frete (loja online / Melhor Envio)
ALTER TABLE produtos ADD COLUMN peso_kg REAL;
ALTER TABLE produtos ADD COLUMN altura_cm REAL;
ALTER TABLE produtos ADD COLUMN largura_cm REAL;
ALTER TABLE produtos ADD COLUMN comprimento_cm REAL;
