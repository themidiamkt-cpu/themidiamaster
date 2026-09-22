-- Canonical media facts. The legacy meta_ads_daily_insights table is left untouched.
-- Legacy objective-dependent uniqueness is deliberately not reused.
create table if not exists public.meta_ads_facts (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  meta_ads_act text not null,
  nivel text not null check (nivel in ('account', 'campaign', 'ad')),
  entidade_id text not null,
  data date not null,
  moeda text not null,
  atribuicao text not null,
  objetivo_snapshot text,
  entrega text not null check (entrega in ('served', 'no_delivery', 'legacy_unknown')),
  investimento numeric(14,2) not null default 0,
  impressoes bigint not null default 0,
  alcance bigint,
  cliques bigint not null default 0,
  mensagens numeric(14,2) not null default 0,
  leads numeric(14,2) not null default 0,
  vendas numeric(14,2) not null default 0,
  faturamento numeric(14,2) not null default 0,
  raw jsonb not null default '{}'::jsonb,
  source text not null check (source in ('legacy', 'meta_graph')),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_ads_facts_grain unique (cliente_id, meta_ads_act, nivel, entidade_id, data, moeda, atribuicao)
);
create index if not exists meta_ads_facts_client_period_idx on public.meta_ads_facts (cliente_id, data desc, nivel);
create index if not exists meta_ads_facts_account_period_idx on public.meta_ads_facts (meta_ads_act, nivel, data desc);
create index if not exists meta_ads_facts_retention_idx on public.meta_ads_facts (data) where nivel in ('campaign', 'ad') and source = 'meta_graph';

-- Select one historical version per account/day for backfill; preserve all legacy rows.
insert into public.meta_ads_facts (
  cliente_id, meta_ads_act, nivel, entidade_id, data, moeda, atribuicao, objetivo_snapshot,
  entrega, investimento, impressoes, alcance, cliques, mensagens, leads, vendas, faturamento,
  raw, source, synced_at
)
select distinct on (d.cliente_id, d.meta_ads_act, d.data)
  d.cliente_id, d.meta_ads_act, 'account', d.meta_ads_act, d.data,
  'UNKNOWN', 'legacy_unrecorded', d.objetivo, 'legacy_unknown',
  d.investimento, d.impressoes, d.alcance, d.cliques, d.mensagens, d.leads,
  d.vendas, d.faturamento,
  jsonb_build_object('legacy_id', d.id, 'coverage', 'unverified'), 'legacy', d.synced_at
from public.meta_ads_daily_insights d
order by d.cliente_id, d.meta_ads_act, d.data, d.synced_at desc nulls last, d.updated_at desc nulls last, d.id desc
on conflict on constraint meta_ads_facts_grain do nothing;

create table if not exists public.meta_ads_sync_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('rolling', 'backfill', 'range')),
  requested_since date not null,
  requested_until date not null,
  page_since date not null,
  page_until date not null,
  next_cursor date,
  status text not null default 'running' check (status in ('running', 'complete', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  clients_total integer not null default 0,
  clients_complete integer not null default 0,
  clients_partial integer not null default 0,
  clients_failed integer not null default 0,
  facts_written integer not null default 0,
  error_code text,
  created_at timestamptz not null default now()
);
create index if not exists meta_ads_sync_runs_started_idx on public.meta_ads_sync_runs (started_at desc);

create table if not exists public.meta_ads_sync_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.meta_ads_sync_runs(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  meta_ads_act text not null,
  period_since date not null,
  period_until date not null,
  status text not null default 'running' check (status in ('running', 'complete', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  expected_days integer not null default 0,
  queried_days integer not null default 0,
  no_delivery_days integer not null default 0,
  missing_days integer not null default 0,
  account_rows integer not null default 0,
  campaign_rows integer not null default 0,
  ad_rows integer not null default 0,
  facts_written integer not null default 0,
  health_status text not null default 'not_checked' check (health_status in ('not_checked', 'ok', 'failed')),
  error_code text,
  constraint meta_ads_sync_items_unique unique (run_id, cliente_id, meta_ads_act, period_since, period_until)
);
create index if not exists meta_ads_sync_items_client_started_idx on public.meta_ads_sync_items (cliente_id, started_at desc);

alter table public.meta_ads_facts enable row level security;
alter table public.meta_ads_sync_runs enable row level security;
alter table public.meta_ads_sync_items enable row level security;
revoke all on public.meta_ads_facts, public.meta_ads_sync_runs, public.meta_ads_sync_items from anon;
grant select on public.meta_ads_facts, public.meta_ads_sync_runs, public.meta_ads_sync_items to authenticated;
create policy "team_read_meta_facts" on public.meta_ads_facts for select to authenticated using (public.can_access_cliente(cliente_id));
create policy "admin_read_meta_runs" on public.meta_ads_sync_runs for select to authenticated using (public.is_main_admin());
create policy "team_read_meta_items" on public.meta_ads_sync_items for select to authenticated using (public.can_access_cliente(cliente_id));
