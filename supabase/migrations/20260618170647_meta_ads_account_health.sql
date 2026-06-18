create table if not exists public.meta_ads_account_health (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  meta_ads_act text not null,
  account_id text,
  account_name text,
  currency text,
  account_status integer,
  account_status_label text,
  disable_reason integer,
  disable_reason_label text,
  funding_source_type text,
  funding_source_details jsonb not null default '{}'::jsonb,
  balance_minor numeric(14,2),
  amount_spent_minor numeric(14,2),
  spend_cap_minor numeric(14,2),
  prepay_balance_minor numeric(14,2),
  effective_status text,
  has_delivery_issues boolean not null default false,
  delivery_issues jsonb not null default '[]'::jsonb,
  last_error text,
  raw jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id)
);

create index if not exists idx_meta_ads_account_health_meta_ads_act on public.meta_ads_account_health(meta_ads_act);
create index if not exists idx_meta_ads_account_health_checked_at on public.meta_ads_account_health(checked_at desc);
create index if not exists idx_meta_ads_account_health_has_issues on public.meta_ads_account_health(has_delivery_issues);

drop trigger if exists set_meta_ads_account_health_updated_at on public.meta_ads_account_health;
create trigger set_meta_ads_account_health_updated_at before update on public.meta_ads_account_health
for each row execute function public.set_updated_at();

alter table public.meta_ads_account_health enable row level security;

drop policy if exists "authenticated_select_meta_ads_account_health" on public.meta_ads_account_health;
create policy "authenticated_select_meta_ads_account_health" on public.meta_ads_account_health
for select to authenticated using (true);
