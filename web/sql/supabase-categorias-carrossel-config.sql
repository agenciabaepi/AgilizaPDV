-- Fonte do carrossel de categorias na home da loja online
-- loja_online_categorias_carrossel: selecionadas | marcadas | grupo | categoria | subcategoria
-- loja_online_categorias_carrossel_ids: JSON array de IDs (modo selecionadas)

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_categorias_carrossel TEXT;

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_categorias_carrossel_ids TEXT;

COMMENT ON COLUMN public.empresas_config.loja_online_categorias_carrossel IS
  'Fonte do carrossel de categorias na home: selecionadas | marcadas | grupo | categoria | subcategoria';

COMMENT ON COLUMN public.empresas_config.loja_online_categorias_carrossel_ids IS
  'JSON array de IDs das categorias escolhidas para o carrossel (modo selecionadas)';
