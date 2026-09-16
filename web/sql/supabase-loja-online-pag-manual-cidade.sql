-- Cidade em que "combinar / pagar na entrega" é liberado no checkout.
-- Se vazia, a loja usa a cidade do CEP de origem do frete.
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS loja_online_pag_manual_cidade TEXT;

COMMENT ON COLUMN public.empresas_config.loja_online_pag_manual_cidade IS
  'Cidade (ex.: Ilhabela) para liberar pagamento na entrega. Comparada com a localidade do CEP do cliente via ViaCEP.';
