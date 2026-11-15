-- Alerta de estoque mínimo por produto (opt-in/out do aviso)
-- 1 = avisar quando saldo <= estoque_minimo; 0 = não avisar

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS alerta_estoque_minimo SMALLINT NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.produtos.alerta_estoque_minimo IS
  '1 = avisar quando atingir estoque mínimo (lista, dashboard, estoque); 0 = não avisar';

-- Produtos sem controle de estoque não precisam do alerta ligado
UPDATE public.produtos
SET alerta_estoque_minimo = 0
WHERE controla_estoque IS DISTINCT FROM 1
  AND alerta_estoque_minimo = 1;
