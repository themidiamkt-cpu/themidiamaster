-- Incremental: remove legacy public access; preserve all existing rows.
drop policy if exists "Anon can read clientes" on public.clientes;
drop policy if exists "Anon can read metas" on public.metas_cliente;
drop policy if exists "Anon can read alertas" on public.alertas_anomalia;
drop policy if exists "Anon can insert alertas" on public.alertas_anomalia;
revoke all on public.clientes, public.metas_cliente, public.alertas_anomalia from anon;

-- The old pg_cron job used the publishable key as caller identity.
-- An external scheduler must send x-cron-secret and the same {"mode":"yesterday"} body.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sync-meta-ads-yesterday') then
    perform cron.unschedule('sync-meta-ads-yesterday');
  end if;
end $$;
