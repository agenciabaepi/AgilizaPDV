-- Imagem e vitrine de categorias na loja online

ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS imagem TEXT;

ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS loja_online_subtitulo TEXT;

ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS loja_online_vitrine INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.categorias.imagem IS 'Imagem da categoria exibida na vitrine da loja online';
COMMENT ON COLUMN public.categorias.loja_online_subtitulo IS 'Subtítulo do card na vitrine (ex.: Pague em até 18x | Frete grátis)';
COMMENT ON COLUMN public.categorias.loja_online_vitrine IS '1 = exibir card na seção de categorias da home da loja online';

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_categorias_titulo TEXT;

COMMENT ON COLUMN public.empresas_config.loja_online_categorias_titulo IS 'Título da seção de categorias na home da loja online';
