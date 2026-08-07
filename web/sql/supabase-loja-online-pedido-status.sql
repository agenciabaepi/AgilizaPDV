-- Expande status de pedidos online (loja e-commerce)
-- Rode no SQL Editor do Supabase após backup.

ALTER TABLE loja_online_pedidos DROP CONSTRAINT IF EXISTS loja_online_pedidos_status_check;

UPDATE loja_online_pedidos
SET status = CASE
  WHEN status = 'pendente' AND forma_pagamento IN ('mercadopago', 'asaas_pix') AND COALESCE(pagamento_status, 'pendente') = 'pendente'
    THEN 'aguardando_pagamento'
  WHEN status = 'pendente' AND pagamento_status = 'pago'
    THEN 'pagamento_aprovado'
  WHEN status = 'pendente'
    THEN 'pedido_recebido'
  WHEN status = 'confirmado'
    THEN 'pagamento_aprovado'
  WHEN status = 'entregue'
    THEN 'entregue'
  WHEN status = 'cancelado'
    THEN 'cancelado'
  ELSE status
END
WHERE status IN ('pendente', 'confirmado', 'entregue', 'cancelado');

ALTER TABLE loja_online_pedidos
  ADD CONSTRAINT loja_online_pedidos_status_check
  CHECK (status IN (
    'pedido_recebido',
    'aguardando_pagamento',
    'pagamento_aprovado',
    'em_separacao',
    'em_preparacao',
    'enviado',
    'em_transporte',
    'saiu_para_entrega',
    'entregue',
    'cancelado',
    'pagamento_recusado',
    'aguardando_retirada',
    'disponivel_retirada',
    'devolucao_solicitada',
    'em_devolucao',
    'reembolsado',
    'falha_entrega'
  ));

ALTER TABLE loja_online_pedidos ALTER COLUMN status SET DEFAULT 'pedido_recebido';
