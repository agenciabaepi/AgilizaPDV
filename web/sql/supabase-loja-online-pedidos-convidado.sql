-- Dados de compras sem cadastro (convidado) no pedido da loja online.
alter table public.loja_online_pedidos
  add column if not exists cliente_cpf text,
  add column if not exists cliente_endereco text;
