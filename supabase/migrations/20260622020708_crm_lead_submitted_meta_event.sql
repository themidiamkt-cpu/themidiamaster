alter table public.leads_crm
  add column if not exists meta_lead_submitted_event_id text,
  add column if not exists meta_lead_submitted_event_sent_at timestamptz,
  add column if not exists meta_lead_submitted_event_response jsonb;

create index if not exists idx_leads_crm_meta_lead_submitted_event
  on public.leads_crm(meta_lead_submitted_event_sent_at desc)
  where meta_lead_submitted_event_sent_at is not null;
