drop policy if exists "authenticated_insert_crm_webhook_logs" on public.crm_webhook_logs;
create policy "authenticated_insert_crm_webhook_logs" on public.crm_webhook_logs
for insert to authenticated
with check (true);
