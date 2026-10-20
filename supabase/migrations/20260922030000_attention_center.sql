-- Incremental attention center. Legacy goals, alerts and diary entries remain.
alter table public.metas_cliente
  add column if not exists periodo_inicio date,
  add column if not exists periodo_fim date,
  add column if not exists canal text not null default 'meta_ads',
  add column if not exists meta_volume numeric(14,2),
  add column if not exists meta_custo_qualificado numeric(14,2),
  add column if not exists meta_custo_venda numeric(14,2),
  add column if not exists orcamento_periodo numeric(14,2),
  add column if not exists margem_contribuicao_pct numeric(5,2),
  add column if not exists gasto_minimo_analise numeric(14,2) not null default 100,
  add column if not exists resultados_minimos_analise numeric(14,2) not null default 5,
  add column if not exists janela_conversao_dias integer not null default 3,
  add column if not exists cobertura_minima_pct numeric(5,2) not null default 95,
  add column if not exists responsavel text;
alter table public.metas_cliente
  add constraint metas_periodo_valido check (periodo_fim is null or periodo_inicio is not null and periodo_fim >= periodo_inicio and periodo_fim - periodo_inicio <= 92),
  add constraint metas_margem_valida check (margem_contribuicao_pct is null or margem_contribuicao_pct > 0 and margem_contribuicao_pct <= 100),
  add constraint metas_cobertura_valida check (cobertura_minima_pct between 0 and 100),
  add constraint metas_janela_valida check (janela_conversao_dias between 0 and 30),
  add constraint metas_valores_nao_negativos check (
    coalesce(meta_volume,0) >= 0 and coalesce(meta_custo_qualificado,0) >= 0 and
    coalesce(meta_custo_venda,0) >= 0 and coalesce(orcamento_periodo,0) >= 0 and
    gasto_minimo_analise >= 0 and resultados_minimos_analise >= 0
  );
create index if not exists metas_cliente_periodo_idx on public.metas_cliente(cliente_id, canal, periodo_inicio, periodo_fim);

create table if not exists public.meta_budget_revisions (
  id uuid primary key default gen_random_uuid(),
  meta_id uuid not null references public.metas_cliente(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  effective_on date not null,
  orcamento_periodo numeric(14,2) not null check (orcamento_periodo >= 0),
  changed_at timestamptz not null default now()
);
create index if not exists meta_budget_revisions_client_idx on public.meta_budget_revisions(cliente_id, effective_on desc);
insert into public.meta_budget_revisions(meta_id, cliente_id, effective_on, orcamento_periodo)
select id, cliente_id, coalesce(periodo_inicio, created_at::date), orcamento_periodo
from public.metas_cliente m where orcamento_periodo is not null
  and not exists (select 1 from public.meta_budget_revisions r where r.meta_id = m.id);

create or replace function public.capture_meta_budget_revision() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.orcamento_periodo is not null and (tg_op = 'INSERT' or new.orcamento_periodo is distinct from old.orcamento_periodo) then
    insert into public.meta_budget_revisions(meta_id, cliente_id, effective_on, orcamento_periodo)
    values (new.id, new.cliente_id, current_date, new.orcamento_periodo);
  end if;
  return new;
end $$;
drop trigger if exists capture_meta_budget_revision on public.metas_cliente;
create trigger capture_meta_budget_revision after insert or update of orcamento_periodo on public.metas_cliente
for each row execute function public.capture_meta_budget_revision();

alter table public.alertas_anomalia
  add column if not exists rule_key text,
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists categoria text,
  add column if not exists confianca text,
  add column if not exists impacto_estimado numeric(14,2),
  add column if not exists evidencia jsonb,
  add column if not exists hipotese text,
  add column if not exists proximo_passo text,
  add column if not exists responsavel text,
  add column if not exists ultima_verificacao_em timestamptz,
  add column if not exists reconhecido_em timestamptz,
  add column if not exists adiado_ate date,
  add column if not exists tarefa_id uuid references public.tarefas(id) on delete set null;
alter table public.alertas_anomalia drop constraint if exists alertas_anomalia_status_check;
alter table public.alertas_anomalia add constraint alertas_anomalia_status_check check (status in ('ativo','reconhecido','adiado','resolvido','ignorado'));
alter table public.alertas_anomalia drop constraint if exists alertas_anomalia_metrica_check;
alter table public.alertas_anomalia add constraint alertas_anomalia_metrica_check check (metrica in ('cpl','ctr','roas','spend','diario','coverage','delivery','pace','volume','cost_result','attention'));
alter table public.alertas_anomalia drop constraint if exists alertas_anomalia_tipo_alerta_check;
alter table public.alertas_anomalia add constraint alertas_anomalia_tipo_alerta_check check (tipo_alerta in ('meta','variacao','anotacao_diario','attention'));
create unique index if not exists alertas_attention_unique on public.alertas_anomalia(cliente_id, rule_key, period_start, period_end);
update public.alertas_anomalia set
  categoria = 'anotacao_gestor', confianca = 'alta',
  hipotese = 'Anotação explícita do gestor no Diário de Bordo; o motivo operacional exige leitura humana.',
  proximo_passo = 'Ler a anotação, conversar com o responsável e registrar a intervenção.',
  evidencia = jsonb_build_object('source','diario_bordo','diary_reference',periodo_referencia,'note',objetivo)
where metrica = 'diario' and categoria is null;
create or replace function public.classify_diary_alert() returns trigger language plpgsql as $$
begin
  if new.metrica = 'diario' and new.categoria is null then
    new.categoria := 'anotacao_gestor';
    new.confianca := 'alta';
    new.hipotese := 'Anotação explícita do gestor no Diário de Bordo; o motivo operacional exige leitura humana.';
    new.proximo_passo := 'Ler a anotação, conversar com o responsável e registrar a intervenção.';
    new.evidencia := jsonb_build_object('source','diario_bordo','diary_reference',new.periodo_referencia,'note',new.objetivo);
  end if;
  return new;
end $$;
drop trigger if exists classify_diary_alert on public.alertas_anomalia;
create trigger classify_diary_alert before insert or update of metrica on public.alertas_anomalia
for each row execute function public.classify_diary_alert();

create or replace function public.save_attention_alert(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare saved_id uuid;
begin
  if coalesce(p->>'rule','') not in ('coverage','delivery','pace','cost_result','volume') then raise exception 'invalid rule'; end if;
  insert into public.alertas_anomalia(
    cliente_id,nome_cliente,meta_ads_act,metrica,tipo_alerta,objetivo,meta_id,severidade,status,
    periodo_referencia,rule_key,period_start,period_end,categoria,confianca,impacto_estimado,evidencia,
    hipotese,proximo_passo,responsavel,ultima_verificacao_em
  ) values (
    (p->>'clienteId')::uuid,left(p->>'clientName',240),left(p->>'accountId',120),
    case when p->>'metric' in ('coverage','delivery','pace','cost_result','volume') then p->>'metric' else 'attention' end,
    'attention',p->>'objective',(p->>'metaId')::uuid,p->>'severity','ativo',
    (p->>'periodStart') || ':' || (p->>'periodEnd'),(p->>'rule') || ':' || (p->>'objective') || ':meta_ads',
    (p->>'periodStart')::date,(p->>'periodEnd')::date,p->>'category',p->>'confidence',
    (p->>'impactEstimated')::numeric,p->'evidence',p->>'hypothesis',p->>'nextStep',p->>'owner',now()
  )
  on conflict (cliente_id,rule_key,period_start,period_end) do update set
    status=case when alertas_anomalia.status = 'adiado' and alertas_anomalia.adiado_ate < current_date then 'ativo' else alertas_anomalia.status end,
    meta_id=excluded.meta_id, objetivo=excluded.objetivo, meta_ads_act=excluded.meta_ads_act,
    severidade=excluded.severidade,categoria=excluded.categoria,confianca=excluded.confianca,
    impacto_estimado=excluded.impacto_estimado,evidencia=excluded.evidencia,
    hipotese=excluded.hipotese,proximo_passo=excluded.proximo_passo,
    responsavel=excluded.responsavel,ultima_verificacao_em=now()
  returning id into saved_id;
  return saved_id;
end $$;
revoke all on function public.save_attention_alert(jsonb) from public;
grant execute on function public.save_attention_alert(jsonb) to service_role;

create table if not exists public.alerta_intervencoes (
  id uuid primary key default gen_random_uuid(),
  alerta_id uuid not null references public.alertas_anomalia(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  acao text not null,
  registrado_por text,
  executado_em timestamptz not null default now(),
  periodo_antes_inicio date,
  periodo_antes_fim date,
  periodo_depois_inicio date,
  periodo_depois_fim date,
  comparacao jsonb,
  created_at timestamptz not null default now()
);
create index if not exists alerta_intervencoes_alerta_idx on public.alerta_intervencoes(alerta_id, executado_em desc);
create or replace function public.stamp_alert_intervention_author() returns trigger language plpgsql as $$
begin
  new.registrado_por := auth.uid()::text;
  return new;
end $$;
drop trigger if exists stamp_alert_intervention_author on public.alerta_intervencoes;
create trigger stamp_alert_intervention_author before insert on public.alerta_intervencoes
for each row execute function public.stamp_alert_intervention_author();
alter table public.meta_budget_revisions enable row level security;
alter table public.alerta_intervencoes enable row level security;
revoke all on public.meta_budget_revisions, public.alerta_intervencoes from anon;
grant select on public.meta_budget_revisions, public.alerta_intervencoes to authenticated;
grant insert on public.alerta_intervencoes to authenticated;
create policy "team_read_budget_revisions" on public.meta_budget_revisions for select to authenticated using (public.can_access_cliente(cliente_id));
create policy "team_read_alert_interventions" on public.alerta_intervencoes for select to authenticated using (public.can_access_cliente(cliente_id));
create policy "team_insert_alert_interventions" on public.alerta_intervencoes for insert to authenticated with check (
  public.can_access_cliente(cliente_id) and exists (select 1 from public.alertas_anomalia a where a.id = alerta_id and a.cliente_id = cliente_id)
);

create or replace function public.create_alert_task_once(p_alerta_id uuid, p_titulo text, p_descricao text, p_responsavel text, p_prioridade text, p_data_vencimento date)
returns uuid language plpgsql security invoker set search_path = public as $$
declare a public.alertas_anomalia%rowtype; created_id uuid;
begin
  select * into a from public.alertas_anomalia where id = p_alerta_id for update;
  if a.id is null or a.cliente_id is null or not public.can_access_cliente(a.cliente_id) then raise exception 'alert not accessible'; end if;
  if a.tarefa_id is not null then return a.tarefa_id; end if;
  insert into public.tarefas(cliente_id,titulo,descricao,responsavel,prioridade,status,data_vencimento)
  values (a.cliente_id,left(p_titulo,240),p_descricao,p_responsavel,case when p_prioridade in ('baixa','media','alta','urgente') then p_prioridade else 'media' end,'pendente',p_data_vencimento)
  returning id into created_id;
  update public.alertas_anomalia set tarefa_id = created_id where id = p_alerta_id;
  return created_id;
end $$;
revoke all on function public.create_alert_task_once(uuid,text,text,text,text,date) from public;
grant execute on function public.create_alert_task_once(uuid,text,text,text,text,date) to authenticated;
