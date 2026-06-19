create table if not exists public.gmn_analises (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete set null,
  nome_perfil text not null,
  endereco text,
  palavra_chave text not null,
  score numeric(6,2),
  saude_perfil numeric(6,2),
  grid_size integer,
  raio_km numeric(8,2),
  gerado_em timestamptz,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gmn_analises_cliente_id on public.gmn_analises(cliente_id);
create index if not exists idx_gmn_analises_created_at on public.gmn_analises(created_at desc);

drop trigger if exists set_gmn_analises_updated_at on public.gmn_analises;
create trigger set_gmn_analises_updated_at before update on public.gmn_analises
for each row execute function public.set_updated_at();

alter table public.gmn_analises enable row level security;

drop policy if exists "authenticated_select_gmn_analises" on public.gmn_analises;
drop policy if exists "authenticated_insert_gmn_analises" on public.gmn_analises;
drop policy if exists "authenticated_update_gmn_analises" on public.gmn_analises;
drop policy if exists "authenticated_delete_gmn_analises" on public.gmn_analises;

create policy "authenticated_select_gmn_analises" on public.gmn_analises for select to authenticated using (true);
create policy "authenticated_insert_gmn_analises" on public.gmn_analises for insert to authenticated with check (true);
create policy "authenticated_update_gmn_analises" on public.gmn_analises for update to authenticated using (true) with check (true);
create policy "authenticated_delete_gmn_analises" on public.gmn_analises for delete to authenticated using (true);
