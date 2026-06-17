create table if not exists public.meta_ads_daily_insights (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  meta_ads_act text not null,
  data date not null,
  objetivo text not null default 'mensagens',
  investimento numeric(12,2) not null default 0,
  impressoes integer not null default 0,
  alcance integer not null default 0,
  cliques integer not null default 0,
  ctr numeric(8,4) not null default 0,
  cpc numeric(12,4) not null default 0,
  mensagens integer not null default 0,
  custo_por_mensagem numeric(12,4) not null default 0,
  leads integer not null default 0,
  custo_por_lead numeric(12,4) not null default 0,
  vendas integer not null default 0,
  custo_por_venda numeric(12,4) not null default 0,
  faturamento numeric(12,2) not null default 0,
  roas numeric(12,4) not null default 0,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, meta_ads_act, data, objetivo)
);

create index if not exists idx_meta_ads_daily_insights_cliente_id on public.meta_ads_daily_insights(cliente_id);
create index if not exists idx_meta_ads_daily_insights_data on public.meta_ads_daily_insights(data);
create index if not exists idx_meta_ads_daily_insights_act_data on public.meta_ads_daily_insights(meta_ads_act, data);

drop trigger if exists set_meta_ads_daily_insights_updated_at on public.meta_ads_daily_insights;
create trigger set_meta_ads_daily_insights_updated_at before update on public.meta_ads_daily_insights
for each row execute function public.set_updated_at();

alter table public.meta_ads_daily_insights enable row level security;

drop policy if exists "authenticated_select_meta_ads_daily_insights" on public.meta_ads_daily_insights;
create policy "authenticated_select_meta_ads_daily_insights" on public.meta_ads_daily_insights
for select to authenticated using (true);
