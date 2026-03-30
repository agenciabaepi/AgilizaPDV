-- Espelho Supabase: coluna para preset de página do cupom térmico (sincronizada com SQLite local).
-- Erro típico sem esta coluna: Could not find the 'cupom_layout_pagina' column of 'empresas_config' in the schema cache

ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS cupom_layout_pagina TEXT DEFAULT 'compat';
