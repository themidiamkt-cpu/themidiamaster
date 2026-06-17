alter table public.vendas_cliente
  drop constraint if exists vendas_cliente_origem_check;

alter table public.vendas_cliente
  alter column origem set default 'Manual';
