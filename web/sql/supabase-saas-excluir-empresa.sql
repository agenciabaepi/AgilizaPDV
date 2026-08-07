-- =============================================================================
-- Agiliza PDV — Exclusão completa de empresa (painel SaaS)
--
-- Remove todos os dados vinculados à empresa e, por fim, o registro em empresas.
-- Execute no Supabase SQL Editor.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.saas_excluir_empresa(p_empresa_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t TEXT;
BEGIN
  IF p_empresa_id IS NULL OR TRIM(p_empresa_id) = '' THEN
    RAISE EXCEPTION 'empresa_id é obrigatório.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM empresas WHERE id = p_empresa_id) THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  -- Notas fiscais (metadados ligados a vendas)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venda_nfce') THEN
    DELETE FROM venda_nfce
    WHERE venda_id IN (SELECT id FROM vendas WHERE empresa_id = p_empresa_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venda_nfe') THEN
    DELETE FROM venda_nfe
    WHERE venda_id IN (SELECT id FROM vendas WHERE empresa_id = p_empresa_id);
  END IF;

  -- Filhos de vendas / caixa
  FOR t IN SELECT unnest(ARRAY[
    'pagamentos',
    'venda_itens',
    'contas_receber',
    'contas_pagar',
    'cashback_movimentacoes',
    'cashback_creditos',
    'cashback_saldos',
    'cashback_regras',
    'cashback_configuracoes',
    'caixa_movimentos',
    'caixas',
    'estoque_movimentos'
  ])
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'empresa_id'
    ) THEN
      EXECUTE format('DELETE FROM %I WHERE empresa_id = $1', t) USING p_empresa_id;
    END IF;
  END LOOP;

  -- Loja online (itens → pedidos → restante)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loja_online_pedido_itens') THEN
    DELETE FROM loja_online_pedido_itens
    WHERE pedido_id IN (SELECT id FROM loja_online_pedidos WHERE empresa_id = p_empresa_id);
  END IF;

  FOR t IN SELECT unnest(ARRAY[
    'loja_online_avaliacoes',
    'loja_online_favoritos',
    'loja_online_cupons',
    'loja_online_pedidos',
    'loja_online_clientes'
  ])
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'empresa_id'
    ) THEN
      EXECUTE format('DELETE FROM %I WHERE empresa_id = $1', t) USING p_empresa_id;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendas') THEN
    DELETE FROM vendas WHERE empresa_id = p_empresa_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'produtos') THEN
    DELETE FROM produtos WHERE empresa_id = p_empresa_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categorias') THEN
    UPDATE categorias SET parent_id = NULL WHERE empresa_id = p_empresa_id;
    DELETE FROM categorias WHERE empresa_id = p_empresa_id;
  END IF;

  FOR t IN SELECT unnest(ARRAY[
    'marcas',
    'clientes',
    'fornecedores',
    'assinatura_pagamentos',
    'empresa_assinaturas',
    'empresa_certificado',
    'empresas_config',
    'pdv_backup_registry',
    'usuarios'
  ])
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'empresa_id'
    ) THEN
      EXECUTE format('DELETE FROM %I WHERE empresa_id = $1', t) USING p_empresa_id;
    END IF;
  END LOOP;

  DELETE FROM empresas WHERE id = p_empresa_id;
END;
$$;

REVOKE ALL ON FUNCTION public.saas_excluir_empresa(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.saas_excluir_empresa(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.saas_excluir_empresa(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.saas_excluir_empresa(TEXT) TO authenticated;
