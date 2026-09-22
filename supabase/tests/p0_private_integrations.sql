-- Run only against a disposable database after applying migrations through
-- 20260922010130. This test rolls back all assertions and fixture changes.
begin;
set local role anon;
do $$
begin
  if has_table_privilege(current_user, 'public.clientes', 'SELECT') then raise exception 'anon can read clientes'; end if;
  if has_table_privilege(current_user, 'public.metas_cliente', 'SELECT') then raise exception 'anon can read metas'; end if;
  if has_table_privilege(current_user, 'public.alertas_anomalia', 'SELECT') then raise exception 'anon can read alertas'; end if;
  if has_table_privilege(current_user, 'public.alertas_anomalia', 'INSERT') then raise exception 'anon can insert alertas'; end if;
end $$;
reset role;
rollback;
