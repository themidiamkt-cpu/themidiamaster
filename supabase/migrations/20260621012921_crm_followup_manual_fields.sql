alter table public.leads_crm
  add column if not exists tentativa integer not null default 0,
  add column if not exists ultima_interacao timestamptz,
  add column if not exists cadencia_followup jsonb not null default '{
    "lead_novo": [1, 3, 7],
    "contato_feito": [2, 4],
    "respondeu": [1, 3],
    "reuniao_marcada": [1, 2],
    "proposta_enviada": [2, 3, 5]
  }'::jsonb,
  add column if not exists aguardando_resposta_manual boolean not null default false;

update public.leads_crm
set
  tentativa = coalesce(tentativa, 0),
  cadencia_followup = coalesce(cadencia_followup, '{
    "lead_novo": [1, 3, 7],
    "contato_feito": [2, 4],
    "respondeu": [1, 3],
    "reuniao_marcada": [1, 2],
    "proposta_enviada": [2, 3, 5]
  }'::jsonb),
  aguardando_resposta_manual = coalesce(aguardando_resposta_manual, false);

update public.leads_crm
set etapa = 'contato_feito'
where etapa = 'follow_up';

do $$
begin
  alter table public.leads_crm
    drop constraint if exists leads_crm_etapa_check;

  alter table public.leads_crm
    add constraint leads_crm_etapa_check
    check (etapa in (
      'lead_novo',
      'contato_feito',
      'respondeu',
      'reuniao_marcada',
      'proposta_enviada',
      'fechado',
      'perdido'
    ));
end $$;

create index if not exists idx_leads_crm_followup_hoje
  on public.leads_crm(data_proximo_contato, etapa, aguardando_resposta_manual)
  where etapa not in ('fechado', 'perdido');

create index if not exists idx_leads_crm_ultima_interacao
  on public.leads_crm(ultima_interacao desc);
