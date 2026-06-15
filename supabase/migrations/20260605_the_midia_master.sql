-- ============================================
-- The Midia Master | Supabase schema
-- Sistema interno da agencia The Midia Marketing
-- ============================================

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome_empresa text not null,
  responsavel text,
  whatsapp text,
  email text,
  segmento text,
  cidade text,
  estado text,
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'cancelado', 'prospect')),
  plano_contratado text check (plano_contratado is null or plano_contratado in ('starter', 'growth', 'premium', 'personalizado')),
  valor_mensal numeric(12,2),
  data_entrada date,
  data_renovacao date,
  verba_mensal_trafego numeric(12,2),
  meta_ads_act text,
  google_ads_id text,
  instagram text,
  site text,
  landing_page text,
  crm_utilizado text,
  responsavel_interno text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads_crm (
  id uuid primary key default gen_random_uuid(),
  nome_empresa text not null,
  responsavel text,
  whatsapp text,
  email text,
  instagram text,
  nicho text,
  cidade text,
  estado text,
  origem_lead text,
  etapa text not null default 'lead_novo' check (etapa in ('lead_novo', 'contato_feito', 'respondeu', 'reuniao_marcada', 'proposta_enviada', 'follow_up', 'fechado', 'perdido')),
  dor_principal text,
  ticket_medio numeric(12,2),
  investimento_disponivel numeric(12,2),
  potencial text check (potencial is null or potencial in ('baixo', 'medio', 'alto')),
  proxima_acao text,
  data_proximo_contato date,
  motivo_perda text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campanhas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete cascade,
  plataforma text not null check (plataforma in ('meta_ads', 'google_ads', 'tiktok_ads', 'linkedin_ads', 'outro')),
  nome_campanha text not null,
  objetivo text,
  verba_diaria numeric(12,2),
  verba_mensal numeric(12,2),
  data_inicio date,
  data_fim date,
  status text default 'ativa' check (status in ('ativa', 'pausada', 'encerrada', 'teste')),
  criativos_utilizados text,
  publico text,
  observacoes_otimizacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.relatorios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  investimento numeric(12,2) default 0,
  impressoes integer default 0,
  alcance integer default 0,
  cliques integer default 0,
  ctr numeric(8,4) default 0,
  cpc numeric(12,2) default 0,
  leads integer default 0,
  custo_por_lead numeric(12,2) default 0,
  mensagens integer default 0,
  custo_por_mensagem numeric(12,2) default 0,
  vendas integer default 0,
  faturamento_informado numeric(12,2) default 0,
  roas numeric(12,4) default 0,
  analise_estrategica text,
  proximos_passos text,
  meta_ads_act_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete set null,
  titulo text not null,
  descricao text,
  responsavel text,
  prioridade text default 'media' check (prioridade in ('baixa', 'media', 'alta', 'urgente')),
  status text default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  data_vencimento date,
  concluida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_checklists (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null unique references public.clientes(id) on delete cascade,
  contrato_assinado boolean default false,
  briefing_preenchido boolean default false,
  acesso_business_manager boolean default false,
  acesso_instagram boolean default false,
  acesso_google_ads boolean default false,
  pixel_configurado boolean default false,
  dominio_verificado boolean default false,
  whatsapp_conectado boolean default false,
  crm_configurado boolean default false,
  primeira_campanha_criada boolean default false,
  primeira_reuniao_realizada boolean default false,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ativos_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete cascade,
  tipo text check (tipo is null or tipo in ('logo', 'criativo', 'video', 'copy', 'landing_page', 'documento', 'referencia', 'outro')),
  titulo text not null,
  url text,
  descricao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.observacoes_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete cascade,
  autor text,
  observacao text not null,
  tipo text default 'geral' check (tipo in ('geral', 'reuniao', 'estrategia', 'problema', 'financeiro', 'resultado')),
  created_at timestamptz not null default now()
);

create table if not exists public.equipe (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,
  cargo text,
  status text default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clientes_status on public.clientes(status);
create index if not exists idx_clientes_meta_ads_act on public.clientes(meta_ads_act);
create index if not exists idx_campanhas_cliente_id on public.campanhas(cliente_id);
create index if not exists idx_relatorios_cliente_id on public.relatorios(cliente_id);
create index if not exists idx_tarefas_cliente_id on public.tarefas(cliente_id);
create index if not exists idx_tarefas_status on public.tarefas(status);
create index if not exists idx_leads_crm_etapa on public.leads_crm(etapa);
create index if not exists idx_onboarding_cliente_id on public.onboarding_checklists(cliente_id);
create index if not exists idx_ativos_cliente_id on public.ativos_cliente(cliente_id);
create index if not exists idx_observacoes_cliente_id on public.observacoes_cliente(cliente_id);

create or replace function public.create_cliente_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.onboarding_checklists (cliente_id)
  values (new.id)
  on conflict (cliente_id) do nothing;
  return new;
end;
$$;

drop trigger if exists set_clientes_updated_at on public.clientes;
create trigger set_clientes_updated_at before update on public.clientes
for each row execute function public.set_updated_at();

drop trigger if exists set_leads_crm_updated_at on public.leads_crm;
create trigger set_leads_crm_updated_at before update on public.leads_crm
for each row execute function public.set_updated_at();

drop trigger if exists set_campanhas_updated_at on public.campanhas;
create trigger set_campanhas_updated_at before update on public.campanhas
for each row execute function public.set_updated_at();

drop trigger if exists set_relatorios_updated_at on public.relatorios;
create trigger set_relatorios_updated_at before update on public.relatorios
for each row execute function public.set_updated_at();

drop trigger if exists set_tarefas_updated_at on public.tarefas;
create trigger set_tarefas_updated_at before update on public.tarefas
for each row execute function public.set_updated_at();

drop trigger if exists set_onboarding_updated_at on public.onboarding_checklists;
create trigger set_onboarding_updated_at before update on public.onboarding_checklists
for each row execute function public.set_updated_at();

drop trigger if exists set_ativos_updated_at on public.ativos_cliente;
create trigger set_ativos_updated_at before update on public.ativos_cliente
for each row execute function public.set_updated_at();

drop trigger if exists set_equipe_updated_at on public.equipe;
create trigger set_equipe_updated_at before update on public.equipe
for each row execute function public.set_updated_at();

drop trigger if exists create_cliente_onboarding_trigger on public.clientes;
create trigger create_cliente_onboarding_trigger after insert on public.clientes
for each row execute function public.create_cliente_onboarding();

alter table public.clientes enable row level security;
alter table public.leads_crm enable row level security;
alter table public.campanhas enable row level security;
alter table public.relatorios enable row level security;
alter table public.tarefas enable row level security;
alter table public.onboarding_checklists enable row level security;
alter table public.ativos_cliente enable row level security;
alter table public.observacoes_cliente enable row level security;
alter table public.equipe enable row level security;

drop policy if exists "authenticated_select_clientes" on public.clientes;
drop policy if exists "authenticated_insert_clientes" on public.clientes;
drop policy if exists "authenticated_update_clientes" on public.clientes;
drop policy if exists "authenticated_delete_clientes" on public.clientes;

drop policy if exists "authenticated_select_leads_crm" on public.leads_crm;
drop policy if exists "authenticated_insert_leads_crm" on public.leads_crm;
drop policy if exists "authenticated_update_leads_crm" on public.leads_crm;
drop policy if exists "authenticated_delete_leads_crm" on public.leads_crm;

drop policy if exists "authenticated_select_campanhas" on public.campanhas;
drop policy if exists "authenticated_insert_campanhas" on public.campanhas;
drop policy if exists "authenticated_update_campanhas" on public.campanhas;
drop policy if exists "authenticated_delete_campanhas" on public.campanhas;

drop policy if exists "authenticated_select_relatorios" on public.relatorios;
drop policy if exists "authenticated_insert_relatorios" on public.relatorios;
drop policy if exists "authenticated_update_relatorios" on public.relatorios;
drop policy if exists "authenticated_delete_relatorios" on public.relatorios;

drop policy if exists "authenticated_select_tarefas" on public.tarefas;
drop policy if exists "authenticated_insert_tarefas" on public.tarefas;
drop policy if exists "authenticated_update_tarefas" on public.tarefas;
drop policy if exists "authenticated_delete_tarefas" on public.tarefas;

drop policy if exists "authenticated_select_onboarding_checklists" on public.onboarding_checklists;
drop policy if exists "authenticated_insert_onboarding_checklists" on public.onboarding_checklists;
drop policy if exists "authenticated_update_onboarding_checklists" on public.onboarding_checklists;
drop policy if exists "authenticated_delete_onboarding_checklists" on public.onboarding_checklists;

drop policy if exists "authenticated_select_ativos_cliente" on public.ativos_cliente;
drop policy if exists "authenticated_insert_ativos_cliente" on public.ativos_cliente;
drop policy if exists "authenticated_update_ativos_cliente" on public.ativos_cliente;
drop policy if exists "authenticated_delete_ativos_cliente" on public.ativos_cliente;

drop policy if exists "authenticated_select_observacoes_cliente" on public.observacoes_cliente;
drop policy if exists "authenticated_insert_observacoes_cliente" on public.observacoes_cliente;
drop policy if exists "authenticated_update_observacoes_cliente" on public.observacoes_cliente;
drop policy if exists "authenticated_delete_observacoes_cliente" on public.observacoes_cliente;

drop policy if exists "authenticated_select_equipe" on public.equipe;
drop policy if exists "authenticated_insert_equipe" on public.equipe;
drop policy if exists "authenticated_update_equipe" on public.equipe;
drop policy if exists "authenticated_delete_equipe" on public.equipe;

create policy "authenticated_select_clientes" on public.clientes for select to authenticated using (true);
create policy "authenticated_insert_clientes" on public.clientes for insert to authenticated with check (true);
create policy "authenticated_update_clientes" on public.clientes for update to authenticated using (true) with check (true);
create policy "authenticated_delete_clientes" on public.clientes for delete to authenticated using (true);

create policy "authenticated_select_leads_crm" on public.leads_crm for select to authenticated using (true);
create policy "authenticated_insert_leads_crm" on public.leads_crm for insert to authenticated with check (true);
create policy "authenticated_update_leads_crm" on public.leads_crm for update to authenticated using (true) with check (true);
create policy "authenticated_delete_leads_crm" on public.leads_crm for delete to authenticated using (true);

create policy "authenticated_select_campanhas" on public.campanhas for select to authenticated using (true);
create policy "authenticated_insert_campanhas" on public.campanhas for insert to authenticated with check (true);
create policy "authenticated_update_campanhas" on public.campanhas for update to authenticated using (true) with check (true);
create policy "authenticated_delete_campanhas" on public.campanhas for delete to authenticated using (true);

create policy "authenticated_select_relatorios" on public.relatorios for select to authenticated using (true);
create policy "authenticated_insert_relatorios" on public.relatorios for insert to authenticated with check (true);
create policy "authenticated_update_relatorios" on public.relatorios for update to authenticated using (true) with check (true);
create policy "authenticated_delete_relatorios" on public.relatorios for delete to authenticated using (true);

create policy "authenticated_select_tarefas" on public.tarefas for select to authenticated using (true);
create policy "authenticated_insert_tarefas" on public.tarefas for insert to authenticated with check (true);
create policy "authenticated_update_tarefas" on public.tarefas for update to authenticated using (true) with check (true);
create policy "authenticated_delete_tarefas" on public.tarefas for delete to authenticated using (true);

create policy "authenticated_select_onboarding_checklists" on public.onboarding_checklists for select to authenticated using (true);
create policy "authenticated_insert_onboarding_checklists" on public.onboarding_checklists for insert to authenticated with check (true);
create policy "authenticated_update_onboarding_checklists" on public.onboarding_checklists for update to authenticated using (true) with check (true);
create policy "authenticated_delete_onboarding_checklists" on public.onboarding_checklists for delete to authenticated using (true);

create policy "authenticated_select_ativos_cliente" on public.ativos_cliente for select to authenticated using (true);
create policy "authenticated_insert_ativos_cliente" on public.ativos_cliente for insert to authenticated with check (true);
create policy "authenticated_update_ativos_cliente" on public.ativos_cliente for update to authenticated using (true) with check (true);
create policy "authenticated_delete_ativos_cliente" on public.ativos_cliente for delete to authenticated using (true);

create policy "authenticated_select_observacoes_cliente" on public.observacoes_cliente for select to authenticated using (true);
create policy "authenticated_insert_observacoes_cliente" on public.observacoes_cliente for insert to authenticated with check (true);
create policy "authenticated_update_observacoes_cliente" on public.observacoes_cliente for update to authenticated using (true) with check (true);
create policy "authenticated_delete_observacoes_cliente" on public.observacoes_cliente for delete to authenticated using (true);

create policy "authenticated_select_equipe" on public.equipe for select to authenticated using (true);
create policy "authenticated_insert_equipe" on public.equipe for insert to authenticated with check (true);
create policy "authenticated_update_equipe" on public.equipe for update to authenticated using (true) with check (true);
create policy "authenticated_delete_equipe" on public.equipe for delete to authenticated using (true);
