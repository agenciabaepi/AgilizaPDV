-- Peso e dimensões do pacote para cotação Melhor Envio / Correios
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS peso_kg REAL;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS altura_cm REAL;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS largura_cm REAL;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS comprimento_cm REAL;

COMMENT ON COLUMN public.produtos.peso_kg IS 'Peso do pacote em kg para cotação de frete (loja online)';
COMMENT ON COLUMN public.produtos.altura_cm IS 'Altura do pacote em cm para cotação de frete';
COMMENT ON COLUMN public.produtos.largura_cm IS 'Largura do pacote em cm para cotação de frete';
COMMENT ON COLUMN public.produtos.comprimento_cm IS 'Comprimento do pacote em cm para cotação de frete';
