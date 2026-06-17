create table if not exists public.vendas_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  data_venda date not null,
  valor_total numeric(12,2) not null default 0,
  quantidade_vendas integer not null default 1,
  quantidade_produtos integer not null default 1,
  ticket_medio numeric(12,2) generated always as (
    case when quantidade_vendas > 0 then valor_total / quantidade_vendas else 0 end
  ) stored,
  origem text default 'manual' check (origem in ('meta_ads', 'google_ads', 'instagram', 'whatsapp', 'site', 'loja_fisica', 'indicacao', 'organico', 'shopify', 'woocommerce', 'crm', 'manual', 'outro')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vendas_cliente_cliente_id on public.vendas_cliente(cliente_id);
create index if not exists idx_vendas_cliente_data_venda on public.vendas_cliente(data_venda);

drop trigger if exists set_vendas_cliente_updated_at on public.vendas_cliente;
create trigger set_vendas_cliente_updated_at before update on public.vendas_cliente
for each row execute function public.set_updated_at();

alter table public.vendas_cliente enable row level security;

drop policy if exists "authenticated_select_vendas_cliente" on public.vendas_cliente;
drop policy if exists "authenticated_insert_vendas_cliente" on public.vendas_cliente;
drop policy if exists "authenticated_update_vendas_cliente" on public.vendas_cliente;
drop policy if exists "authenticated_delete_vendas_cliente" on public.vendas_cliente;

create policy "authenticated_select_vendas_cliente" on public.vendas_cliente for select to authenticated using (true);
create policy "authenticated_insert_vendas_cliente" on public.vendas_cliente for insert to authenticated with check (true);
create policy "authenticated_update_vendas_cliente" on public.vendas_cliente for update to authenticated using (true) with check (true);
create policy "authenticated_delete_vendas_cliente" on public.vendas_cliente for delete to authenticated using (true);
