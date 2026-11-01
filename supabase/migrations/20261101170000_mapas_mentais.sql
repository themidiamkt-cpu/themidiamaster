create table public.mapas_mentais (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  document jsonb not null check (document ? 'nodes' and jsonb_typeof(document->'nodes') = 'array' and jsonb_array_length(document->'nodes') between 1 and 300),
  revision integer not null default 1 check (revision > 0),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mapas_mentais enable row level security;
revoke all on public.mapas_mentais from anon, authenticated;
grant select, insert, update on public.mapas_mentais to authenticated;
create policy mapas_admin_select on public.mapas_mentais for select to authenticated using (public.is_main_admin());
create policy mapas_admin_insert on public.mapas_mentais for insert to authenticated with check (public.is_main_admin());
create policy mapas_admin_update on public.mapas_mentais for update to authenticated using (public.is_main_admin()) with check (public.is_main_admin());
create trigger set_mapas_updated_at before update on public.mapas_mentais for each row execute function public.set_updated_at();
