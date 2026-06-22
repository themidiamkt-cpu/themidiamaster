alter table public.leads_crm
  add column if not exists meta_qualified_event_id text,
  add column if not exists meta_qualified_event_sent_at timestamptz,
  add column if not exists meta_qualified_event_response jsonb;

alter table public.leads_crm
  drop constraint if exists leads_crm_etapa_check;

update public.leads_crm
set etapa = 'qualificado'
where etapa = 'contato_feito';

update public.leads_crm
set cadencia_followup = coalesce(cadencia_followup, '{}'::jsonb)
  || jsonb_build_object('qualificado', coalesce(cadencia_followup->'contato_feito', '[2, 4]'::jsonb))
where not cadencia_followup ? 'qualificado';

update public.leads_crm
set cadencia_followup = cadencia_followup - 'contato_feito'
where cadencia_followup ? 'contato_feito';

do $$
begin
  alter table public.leads_crm
    add constraint leads_crm_etapa_check
    check (etapa in (
      'lead_novo',
      'respondeu',
      'qualificado',
      'reuniao_marcada',
      'proposta_enviada',
      'fechado',
      'perdido'
    ));
end $$;

create index if not exists idx_leads_crm_meta_qualified_event
  on public.leads_crm(meta_qualified_event_sent_at desc)
  where meta_qualified_event_sent_at is not null;
