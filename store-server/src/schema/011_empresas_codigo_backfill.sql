-- Atribui codigo_acesso às empresas que ainda não têm (login numérico no PDV).
WITH m AS (SELECT COALESCE(MAX(codigo_acesso), 999) AS max_c FROM empresas),
ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS rn
  FROM empresas
  WHERE codigo_acesso IS NULL
)
UPDATE empresas e
SET codigo_acesso = m.max_c + r.rn
FROM m, ranked r
WHERE e.id = r.id;
