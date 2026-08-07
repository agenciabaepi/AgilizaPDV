-- =============================================================================
-- Agiliza PDV — View de resumo para painel SaaS (métricas por empresa)
--
-- Execute após: supabase-mirror-tables.sql, supabase-assinaturas.sql,
-- supabase-empresas-config.sql, supabase-mirror-venda-nfce-nfe.sql
-- =============================================================================

CREATE OR REPLACE VIEW saas_empresa_resumo AS
SELECT
  e.id AS empresa_id,
  e.nome,
  e.cnpj,
  e.codigo_acesso,
  e.created_at AS empresa_created_at,
  a.status AS assinatura_status,
  a.plano,
  a.valor_mensal,
  a.trial_fim,
  a.periodo_inicio,
  a.periodo_fim,
  a.asaas_customer_id,
  a.asaas_subscription_id,
  a.created_at AS assinatura_created_at,
  a.updated_at AS assinatura_updated_at,
  ec.razao_social,
  ec.email AS config_email,
  ec.telefone AS config_telefone,
  ec.loja_online_ativa,
  ec.loja_online_slug,
  ec.modulos_json,
  (SELECT count(*)::bigint FROM produtos p WHERE p.empresa_id = e.id) AS produtos_count,
  (SELECT count(*)::bigint FROM clientes c WHERE c.empresa_id = e.id) AS clientes_count,
  (SELECT count(*)::bigint FROM usuarios u WHERE u.empresa_id = e.id) AS usuarios_count,
  (SELECT count(*)::bigint FROM vendas v WHERE v.empresa_id = e.id) AS vendas_count,
  (SELECT count(*)::bigint FROM venda_itens vi WHERE vi.empresa_id = e.id) AS venda_itens_count,
  (SELECT count(*)::bigint FROM categorias cat WHERE cat.empresa_id = e.id) AS categorias_count,
  (SELECT count(*)::bigint FROM fornecedores f WHERE f.empresa_id = e.id) AS fornecedores_count,
  (
    SELECT count(*)::bigint
    FROM venda_nfce vn
    JOIN vendas v ON v.id::text = vn.venda_id::text
    WHERE v.empresa_id = e.id AND vn.status = 'AUTORIZADA'
  ) AS nfce_autorizadas_count,
  (
    SELECT count(*)::bigint
    FROM venda_nfe vn
    JOIN vendas v ON v.id::text = vn.venda_id::text
    WHERE v.empresa_id = e.id AND vn.status = 'AUTORIZADA'
  ) AS nfe_autorizadas_count,
  (
    (SELECT count(*) FROM produtos p WHERE p.empresa_id = e.id)
    + (SELECT count(*) FROM clientes c WHERE c.empresa_id = e.id)
    + (SELECT count(*) FROM usuarios u WHERE u.empresa_id = e.id)
    + (SELECT count(*) FROM vendas v WHERE v.empresa_id = e.id)
    + (SELECT count(*) FROM venda_itens vi WHERE vi.empresa_id = e.id)
    + (SELECT count(*) FROM categorias cat WHERE cat.empresa_id = e.id)
    + (SELECT count(*) FROM fornecedores f WHERE f.empresa_id = e.id)
  )::bigint AS registros_estimados_count
FROM empresas e
LEFT JOIN empresa_assinaturas a ON a.empresa_id = e.id
LEFT JOIN empresas_config ec ON ec.empresa_id = e.id;
