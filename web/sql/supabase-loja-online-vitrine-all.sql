-- Migrations da vitrine online — execute no Supabase SQL Editor

-- Cores da loja
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_cor_primaria TEXT;

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_cor_fundo TEXT;

-- Metadados visuais do card de produto
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS loja_online_preco_de REAL;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS loja_online_card_json TEXT;

-- Categorias na vitrine
ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS imagem TEXT;

ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS loja_online_subtitulo TEXT;

ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS loja_online_vitrine INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_categorias_titulo TEXT;

-- Configuração de templates/cores dos cards
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_cards_config_json TEXT;
