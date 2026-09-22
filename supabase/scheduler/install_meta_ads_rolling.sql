-- Run only after confirming the target project, applied migration history, and Vault entries.
-- Required Vault names: meta_sync_project_url, meta_sync_cron_secret.
-- Neither value belongs in source control. The Edge Function must require x-cron-secret.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'meta_sync_project_url')
    or not exists (select 1 from vault.decrypted_secrets where name = 'meta_sync_cron_secret') then
    raise exception 'Vault entries for Meta sync are missing';
  end if;
  if exists (select 1 from cron.job where jobname = 'sync-meta-ads-yesterday') then
    perform cron.unschedule('sync-meta-ads-yesterday');
  end if;
  if exists (select 1 from cron.job where jobname = 'sync-meta-ads-rolling') then
    perform cron.unschedule('sync-meta-ads-rolling');
  end if;
end $$;
select cron.schedule(
  'sync-meta-ads-rolling',
  '0 9 * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'meta_sync_project_url') || '/functions/v1/sync-meta-ads-daily',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'meta_sync_cron_secret')
    ),
    body := '{"mode":"rolling"}'::jsonb,
    timeout_milliseconds := 10000
  )
  $job$
);
