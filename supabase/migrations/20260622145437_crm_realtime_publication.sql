do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'leads_crm'
  ) then
    alter publication supabase_realtime add table public.leads_crm;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'crm_webhook_logs'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'crm_webhook_logs'
  ) then
    alter publication supabase_realtime add table public.crm_webhook_logs;
  end if;
end $$;
