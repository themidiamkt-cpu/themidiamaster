create table if not exists public.crm_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  method text,
  event text,
  instance text,
  remote_jid text,
  from_me boolean,
  action text,
  lead_id uuid references public.leads_crm(id) on delete set null,
  error text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_crm_webhook_logs_received_at on public.crm_webhook_logs(received_at desc);
create index if not exists idx_crm_webhook_logs_event on public.crm_webhook_logs(event);
create index if not exists idx_crm_webhook_logs_remote_jid on public.crm_webhook_logs(remote_jid);

alter table public.crm_webhook_logs enable row level security;

drop policy if exists "authenticated_select_crm_webhook_logs" on public.crm_webhook_logs;
create policy "authenticated_select_crm_webhook_logs" on public.crm_webhook_logs
for select to authenticated using (true);
