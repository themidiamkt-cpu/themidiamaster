create table if not exists public.equipe_clientes (
  id uuid primary key default gen_random_uuid(),
  equipe_id uuid not null references public.equipe(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (equipe_id, cliente_id)
);

create index if not exists idx_equipe_clientes_equipe_id on public.equipe_clientes(equipe_id);
create index if not exists idx_equipe_clientes_cliente_id on public.equipe_clientes(cliente_id);

alter table public.equipe_clientes enable row level security;

create or replace function public.current_equipe_id()
returns uuid
language sql
stable
as $$
  select e.id
  from public.equipe e
  where e.auth_user_id = auth.uid()
    and e.status = 'ativo'
  limit 1;
$$;

create or replace function public.can_access_cliente(p_cliente_id uuid)
returns boolean
language sql
stable
as $$
  select public.is_main_admin()
    or exists (
      select 1
      from public.equipe_clientes ec
      join public.equipe e on e.id = ec.equipe_id
      where ec.cliente_id = p_cliente_id
        and e.auth_user_id = auth.uid()
        and e.status = 'ativo'
    );
$$;

drop policy if exists "admin_all_equipe_clientes" on public.equipe_clientes;
drop policy if exists "team_select_equipe_clientes" on public.equipe_clientes;

create policy "admin_all_equipe_clientes"
on public.equipe_clientes
for all
to authenticated
using (public.is_main_admin())
with check (public.is_main_admin());

create policy "team_select_equipe_clientes"
on public.equipe_clientes
for select
to authenticated
using (
  public.is_main_admin()
  or equipe_id = public.current_equipe_id()
);

drop policy if exists "internal_authenticated_all_clientes" on public.clientes;
drop policy if exists "team_select_clientes" on public.clientes;
drop policy if exists "authenticated_select_clientes" on public.clientes;
drop policy if exists "authenticated_insert_clientes" on public.clientes;
drop policy if exists "authenticated_update_clientes" on public.clientes;
drop policy if exists "authenticated_delete_clientes" on public.clientes;
drop policy if exists "admin_all_clientes" on public.clientes;
drop policy if exists "team_select_clientes_assigned" on public.clientes;

create policy "admin_all_clientes"
on public.clientes
for all
to authenticated
using (public.is_main_admin())
with check (public.is_main_admin());

create policy "team_select_clientes_assigned"
on public.clientes
for select
to authenticated
using (public.can_access_cliente(id));

drop policy if exists "internal_authenticated_all_relatorios" on public.relatorios;
drop policy if exists "team_select_relatorios" on public.relatorios;
drop policy if exists "team_insert_relatorios" on public.relatorios;
drop policy if exists "team_update_relatorios" on public.relatorios;
drop policy if exists "team_delete_relatorios" on public.relatorios;
drop policy if exists "admin_all_relatorios" on public.relatorios;
drop policy if exists "team_select_relatorios_assigned" on public.relatorios;
drop policy if exists "team_insert_relatorios_assigned" on public.relatorios;
drop policy if exists "team_update_relatorios_assigned" on public.relatorios;
drop policy if exists "team_delete_relatorios_assigned" on public.relatorios;

create policy "admin_all_relatorios" on public.relatorios for all to authenticated using (public.is_main_admin()) with check (public.is_main_admin());
create policy "team_select_relatorios_assigned" on public.relatorios for select to authenticated using (public.can_access_cliente(cliente_id));
create policy "team_insert_relatorios_assigned" on public.relatorios for insert to authenticated with check (public.can_access_cliente(cliente_id));
create policy "team_update_relatorios_assigned" on public.relatorios for update to authenticated using (public.can_access_cliente(cliente_id)) with check (public.can_access_cliente(cliente_id));
create policy "team_delete_relatorios_assigned" on public.relatorios for delete to authenticated using (public.can_access_cliente(cliente_id));

drop policy if exists "internal_authenticated_all_tarefas" on public.tarefas;
drop policy if exists "team_select_tarefas" on public.tarefas;
drop policy if exists "team_insert_tarefas" on public.tarefas;
drop policy if exists "team_update_tarefas" on public.tarefas;
drop policy if exists "team_delete_tarefas" on public.tarefas;
drop policy if exists "admin_all_tarefas" on public.tarefas;
drop policy if exists "team_select_tarefas_assigned" on public.tarefas;
drop policy if exists "team_insert_tarefas_assigned" on public.tarefas;
drop policy if exists "team_update_tarefas_assigned" on public.tarefas;
drop policy if exists "team_delete_tarefas_assigned" on public.tarefas;

create policy "admin_all_tarefas" on public.tarefas for all to authenticated using (public.is_main_admin()) with check (public.is_main_admin());
create policy "team_select_tarefas_assigned" on public.tarefas for select to authenticated using (cliente_id is not null and public.can_access_cliente(cliente_id));
create policy "team_insert_tarefas_assigned" on public.tarefas for insert to authenticated with check (cliente_id is not null and public.can_access_cliente(cliente_id));
create policy "team_update_tarefas_assigned" on public.tarefas for update to authenticated using (cliente_id is not null and public.can_access_cliente(cliente_id)) with check (cliente_id is not null and public.can_access_cliente(cliente_id));
create policy "team_delete_tarefas_assigned" on public.tarefas for delete to authenticated using (cliente_id is not null and public.can_access_cliente(cliente_id));

drop policy if exists "team_select_diario_bordo" on public.diario_bordo;
drop policy if exists "team_insert_diario_bordo" on public.diario_bordo;
drop policy if exists "team_update_diario_bordo" on public.diario_bordo;
drop policy if exists "team_delete_diario_bordo" on public.diario_bordo;
drop policy if exists "team_select_diario_bordo_assigned" on public.diario_bordo;
drop policy if exists "team_insert_diario_bordo_assigned" on public.diario_bordo;
drop policy if exists "team_update_diario_bordo_assigned" on public.diario_bordo;
drop policy if exists "team_delete_diario_bordo_assigned" on public.diario_bordo;

create policy "team_select_diario_bordo_assigned" on public.diario_bordo for select to authenticated using (cliente_id is not null and public.can_access_cliente(cliente_id));
create policy "team_insert_diario_bordo_assigned" on public.diario_bordo for insert to authenticated with check (cliente_id is not null and public.can_access_cliente(cliente_id));
create policy "team_update_diario_bordo_assigned" on public.diario_bordo for update to authenticated using (cliente_id is not null and public.can_access_cliente(cliente_id)) with check (cliente_id is not null and public.can_access_cliente(cliente_id));
create policy "team_delete_diario_bordo_assigned" on public.diario_bordo for delete to authenticated using (cliente_id is not null and public.can_access_cliente(cliente_id));

drop policy if exists "authenticated_select_meta_ads_daily_insights" on public.meta_ads_daily_insights;
drop policy if exists "team_select_meta_ads_daily_insights_assigned" on public.meta_ads_daily_insights;
create policy "team_select_meta_ads_daily_insights_assigned" on public.meta_ads_daily_insights for select to authenticated using (public.can_access_cliente(cliente_id));

drop policy if exists "authenticated_select_meta_ads_account_health" on public.meta_ads_account_health;
drop policy if exists "team_select_meta_ads_account_health_assigned" on public.meta_ads_account_health;
create policy "team_select_meta_ads_account_health_assigned" on public.meta_ads_account_health for select to authenticated using (public.can_access_cliente(cliente_id));

drop policy if exists "authenticated_select_gmn_analises" on public.gmn_analises;
drop policy if exists "authenticated_insert_gmn_analises" on public.gmn_analises;
drop policy if exists "authenticated_update_gmn_analises" on public.gmn_analises;
drop policy if exists "authenticated_delete_gmn_analises" on public.gmn_analises;
drop policy if exists "team_select_gmn_analises_assigned" on public.gmn_analises;
drop policy if exists "team_insert_gmn_analises_assigned" on public.gmn_analises;
drop policy if exists "team_update_gmn_analises_assigned" on public.gmn_analises;
drop policy if exists "team_delete_gmn_analises_assigned" on public.gmn_analises;
create policy "team_select_gmn_analises_assigned" on public.gmn_analises for select to authenticated using (cliente_id is not null and public.can_access_cliente(cliente_id));
create policy "team_insert_gmn_analises_assigned" on public.gmn_analises for insert to authenticated with check (cliente_id is not null and public.can_access_cliente(cliente_id));
create policy "team_update_gmn_analises_assigned" on public.gmn_analises for update to authenticated using (cliente_id is not null and public.can_access_cliente(cliente_id)) with check (cliente_id is not null and public.can_access_cliente(cliente_id));
create policy "team_delete_gmn_analises_assigned" on public.gmn_analises for delete to authenticated using (cliente_id is not null and public.can_access_cliente(cliente_id));

drop policy if exists "Authenticated manage metas" on public.metas_cliente;
drop policy if exists "team_manage_metas_cliente_assigned" on public.metas_cliente;
create policy "team_manage_metas_cliente_assigned" on public.metas_cliente for all to authenticated using (public.can_access_cliente(cliente_id)) with check (public.can_access_cliente(cliente_id));

drop policy if exists "authenticated_select_vendas_cliente" on public.vendas_cliente;
drop policy if exists "authenticated_insert_vendas_cliente" on public.vendas_cliente;
drop policy if exists "authenticated_update_vendas_cliente" on public.vendas_cliente;
drop policy if exists "authenticated_delete_vendas_cliente" on public.vendas_cliente;
drop policy if exists "team_select_vendas_cliente_assigned" on public.vendas_cliente;
drop policy if exists "team_insert_vendas_cliente_assigned" on public.vendas_cliente;
drop policy if exists "team_update_vendas_cliente_assigned" on public.vendas_cliente;
drop policy if exists "team_delete_vendas_cliente_assigned" on public.vendas_cliente;
create policy "team_select_vendas_cliente_assigned" on public.vendas_cliente for select to authenticated using (public.can_access_cliente(cliente_id));
create policy "team_insert_vendas_cliente_assigned" on public.vendas_cliente for insert to authenticated with check (public.can_access_cliente(cliente_id));
create policy "team_update_vendas_cliente_assigned" on public.vendas_cliente for update to authenticated using (public.can_access_cliente(cliente_id)) with check (public.can_access_cliente(cliente_id));
create policy "team_delete_vendas_cliente_assigned" on public.vendas_cliente for delete to authenticated using (public.can_access_cliente(cliente_id));

drop policy if exists "Authenticated manage alertas" on public.alertas_anomalia;
drop policy if exists "team_manage_alertas_anomalia_assigned" on public.alertas_anomalia;
create policy "team_manage_alertas_anomalia_assigned" on public.alertas_anomalia for all to authenticated using (cliente_id is not null and public.can_access_cliente(cliente_id)) with check (cliente_id is not null and public.can_access_cliente(cliente_id));

drop policy if exists "internal_authenticated_all_equipe" on public.equipe;
drop policy if exists "authenticated_select_equipe" on public.equipe;
drop policy if exists "authenticated_insert_equipe" on public.equipe;
drop policy if exists "authenticated_update_equipe" on public.equipe;
drop policy if exists "authenticated_delete_equipe" on public.equipe;
drop policy if exists "admin_all_equipe" on public.equipe;
drop policy if exists "team_select_own_equipe" on public.equipe;

create policy "admin_all_equipe" on public.equipe for all to authenticated using (public.is_main_admin()) with check (public.is_main_admin());
create policy "team_select_own_equipe" on public.equipe for select to authenticated using (auth_user_id = auth.uid());

notify pgrst, 'reload schema';
