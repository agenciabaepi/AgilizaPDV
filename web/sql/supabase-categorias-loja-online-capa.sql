-- Capa (banner) da página da categoria — separada do ícone do carrossel (`imagem`)

ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS loja_online_capa TEXT;

COMMENT ON COLUMN public.categorias.imagem IS
  'Imagem do card/carrossel da categoria na vitrine (ícone PNG)';

COMMENT ON COLUMN public.categorias.loja_online_capa IS
  'Banner/capa da página da categoria na loja online (formato wide Joog)';
