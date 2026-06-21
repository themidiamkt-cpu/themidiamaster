create unique index if not exists leads_crm_open_whatsapp_unique_idx
  on public.leads_crm (whatsapp)
  where whatsapp is not null
    and coalesce(etapa, '') not in ('fechado', 'perdido');
