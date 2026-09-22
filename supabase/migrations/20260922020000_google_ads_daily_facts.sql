create table if not exists public.google_ads_daily_facts (
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  customer_id text not null,
  data date not null,
  moeda text not null,
  timezone text,
  investimento numeric(14,2) not null default 0,
  impressoes bigint not null default 0,
  cliques bigint not null default 0,
  conversoes numeric(14,4) not null default 0,
  valor_conversoes numeric(14,2) not null default 0,
  cobertura text not null check (cobertura in ('measured', 'no_delivery')),
  synced_at timestamptz not null default now(),
  primary key (cliente_id, customer_id, data, moeda)
);
create index if not exists google_ads_daily_facts_client_date_idx on public.google_ads_daily_facts (cliente_id, data desc);
alter table public.google_ads_daily_facts enable row level security;
revoke all on public.google_ads_daily_facts from anon;
grant select on public.google_ads_daily_facts to authenticated;
create policy "team_read_google_facts" on public.google_ads_daily_facts for select to authenticated using (public.can_access_cliente(cliente_id));
