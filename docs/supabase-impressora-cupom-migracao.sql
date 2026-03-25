-- Coluna usada pelo PDV (impressora de cupom) e pelo sync local → Supabase.
-- Erro típico sem esta coluna: Could not find the 'impressora_cupom' column of 'empresas_config' in the schema cache
--
-- Execute no SQL Editor do Supabase (Database → SQL) no projeto correto.

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS impressora_cupom TEXT;

-- Opcional: após rodar, em Settings → API → pode levar alguns segundos para o cache do PostgREST atualizar.
-- Se o erro persistir, tente "Restart project" em Settings → General (ou aguarde ~1 min).
