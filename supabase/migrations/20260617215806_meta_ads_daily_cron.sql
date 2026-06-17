create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'sync-meta-ads-yesterday'
  ) then
    perform cron.unschedule('sync-meta-ads-yesterday');
  end if;
end $$;

select cron.schedule(
  'sync-meta-ads-yesterday',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://wkjnxohfggqwhemalelf.supabase.co/functions/v1/sync-meta-ads-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indram54b2hmZ2dxd2hlbWFsZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTI4ODUsImV4cCI6MjA5NjI2ODg4NX0.-JCIYS5e2D7OkUr5AmWnr0SEN0vT3GhPp-CXvRLVvAE'
    ),
    body := jsonb_build_object('mode', 'yesterday')
  );
  $$
);
