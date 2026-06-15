-- The Midia Master | Diario de bordo operacional
-- Registro diario preenchido pelo gestor, comentarios do admin e geracao de tarefas.

create extension if not exists pgcrypto;

create table if not exists public.diario_bordo (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete set null,
  data_registro date not null default current_date,
  autor text,
  revisao_verba_ok boolean not null default true,
  anotacoes text not null,
  comentario_admin text,
  tags text,
  status text not null default 'aberto' check (status in ('aberto', 'comentado', 'tarefa_criada', 'resolvido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_diario_bordo_cliente_id on public.diario_bordo(cliente_id);
create index if not exists idx_diario_bordo_data_registro on public.diario_bordo(data_registro desc);
create index if not exists idx_diario_bordo_status on public.diario_bordo(status);

drop trigger if exists set_diario_bordo_updated_at on public.diario_bordo;
create trigger set_diario_bordo_updated_at before update on public.diario_bordo
for each row execute function public.set_updated_at();

create or replace function public.is_main_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'themidiamkt@gmail.com';
$$;

alter table public.diario_bordo enable row level security;

drop policy if exists "admin_all_diario_bordo" on public.diario_bordo;
drop policy if exists "team_select_diario_bordo" on public.diario_bordo;
drop policy if exists "team_insert_diario_bordo" on public.diario_bordo;
drop policy if exists "team_update_diario_bordo" on public.diario_bordo;
drop policy if exists "team_delete_diario_bordo" on public.diario_bordo;

create policy "admin_all_diario_bordo"
on public.diario_bordo
for all
to authenticated
using (public.is_main_admin())
with check (public.is_main_admin());

create policy "team_select_diario_bordo"
on public.diario_bordo
for select
to authenticated
using (true);

create policy "team_insert_diario_bordo"
on public.diario_bordo
for insert
to authenticated
with check (true);

create policy "team_update_diario_bordo"
on public.diario_bordo
for update
to authenticated
using (true)
with check (true);

create policy "team_delete_diario_bordo"
on public.diario_bordo
for delete
to authenticated
using (true);

notify pgrst, 'reload schema';
