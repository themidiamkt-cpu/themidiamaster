-- The Midia Master | Permissoes por perfil interno
-- Admin principal: themidiamkt@gmail.com ve e altera tudo.
-- Demais usuarios autenticados: relatorios, Relatorios Meta Ads, GMN Analises, Diario de Bordo e tarefas.

create or replace function public.is_main_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'themidiamkt@gmail.com';
$$;

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'clientes',
    'leads_crm',
    'campanhas',
    'relatorios',
    'tarefas',
    'onboarding_checklists',
    'ativos_cliente',
    'observacoes_cliente',
    'equipe'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);

    for policy_name in
      select pol.polname
      from pg_policy pol
      join pg_class cls on cls.oid = pol.polrelid
      join pg_namespace nsp on nsp.oid = cls.relnamespace
      where nsp.nspname = 'public'
        and cls.relname = table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    end loop;

    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_main_admin()) with check (public.is_main_admin())',
      'admin_all_' || table_name,
      table_name
    );
  end loop;
end $$;

-- Leitura minima de clientes para listar nomes, vinculos e contas Meta Ads nos modulos permitidos.
create policy "team_select_clientes"
on public.clientes
for select
to authenticated
using (true);

create policy "team_select_relatorios"
on public.relatorios
for select
to authenticated
using (true);

create policy "team_insert_relatorios"
on public.relatorios
for insert
to authenticated
with check (true);

create policy "team_update_relatorios"
on public.relatorios
for update
to authenticated
using (true)
with check (true);

create policy "team_delete_relatorios"
on public.relatorios
for delete
to authenticated
using (true);

create policy "team_select_tarefas"
on public.tarefas
for select
to authenticated
using (true);

create policy "team_insert_tarefas"
on public.tarefas
for insert
to authenticated
with check (true);

create policy "team_update_tarefas"
on public.tarefas
for update
to authenticated
using (true)
with check (true);

create policy "team_delete_tarefas"
on public.tarefas
for delete
to authenticated
using (true);

notify pgrst, 'reload schema';
