-- Metadados visuais do card de produto na loja online (estilo vitrine)

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS loja_online_preco_de REAL;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS loja_online_card_json TEXT;

COMMENT ON COLUMN public.produtos.loja_online_preco_de IS 'Preço anterior (de/por) exibido riscado no card da loja online';
COMMENT ON COLUMN public.produtos.loja_online_card_json IS 'JSON opcional: { "cores": [{ "nome": "Verde", "hex": "#1a472a" }], "tamanhos": ["P", "M", "G"], "armazenamentos": ["128 GB"], "variacoes": ["Wi-Fi", "5G"] }';
