import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function public.can_access_cliente(uuid) returns boolean language sql stable as $$ select true $$;
create function public.is_main_admin() returns boolean language sql stable as $$ select true $$;
create table public.clientes(id uuid primary key);
create table public.meta_ads_daily_insights(
 id uuid primary key default gen_random_uuid(), cliente_id uuid not null,
 meta_ads_act text not null, data date not null, objetivo text not null,
 investimento numeric not null, impressoes int not null, alcance int not null,
 cliques int not null, mensagens numeric not null, leads numeric not null,
 vendas numeric not null, faturamento numeric not null, raw jsonb not null default '{}'::jsonb,
 synced_at timestamptz not null, updated_at timestamptz not null default now()
);
insert into public.clientes(id) values ('00000000-0000-4000-8000-000000000001');
insert into public.meta_ads_daily_insights (cliente_id,meta_ads_act,data,objetivo,investimento,impressoes,alcance,cliques,mensagens,leads,vendas,faturamento,synced_at)
values
('00000000-0000-4000-8000-000000000001','act_123','2026-09-01','leads',10,100,80,5,0,1,0,0,'2026-09-02'),
('00000000-0000-4000-8000-000000000001','act_123','2026-09-01','vendas',11,110,85,6,0,1,1,20,'2026-09-03');
`);
await db.exec(readFileSync('supabase/migrations/20260922012312_meta_ads_sync_observability.sql','utf8'));
await db.exec(readFileSync('supabase/migrations/20260922020000_google_ads_daily_facts.sql','utf8'));
const facts = await db.query("select count(*)::int as n, max(investimento)::int as spend from public.meta_ads_facts where nivel='account'");
if (facts.rows[0].n !== 1 || facts.rows[0].spend !== 11) throw new Error(JSON.stringify(facts.rows));
const legacy = await db.query('select count(*)::int as n from public.meta_ads_daily_insights');
if (legacy.rows[0].n !== 2) throw new Error('legacy rows changed');
console.log('migration isolated: canonical 1, legacy 2');
await db.exec(`
create or replace function public.can_access_cliente(p uuid) returns boolean language sql stable as $$ select p::text = current_setting('request.jwt.claim.client_id', true) $$;
insert into public.clientes(id) values ('00000000-0000-4000-8000-000000000002');
insert into public.meta_ads_facts(cliente_id,meta_ads_act,nivel,entidade_id,data,moeda,atribuicao,entrega,source)
values ('00000000-0000-4000-8000-000000000002','act_456','account','act_456','2026-09-01','BRL','unified_default_unresolved','served','meta_graph');
insert into public.google_ads_daily_facts(cliente_id,customer_id,data,moeda,conversoes,cobertura)
values ('00000000-0000-4000-8000-000000000001','1234567890','2026-09-01','BRL',0.5,'measured'),
('00000000-0000-4000-8000-000000000002','9999999999','2026-09-01','BRL',1,'measured');
set request.jwt.claim.client_id = '00000000-0000-4000-8000-000000000001';
set role authenticated;
`);
const scoped = await db.query('select count(*)::int as n from public.meta_ads_facts');
if (scoped.rows[0].n !== 1) throw new Error('RLS read scope failed');
let writeDenied = false;
try { await db.exec("insert into public.meta_ads_facts(cliente_id,meta_ads_act,nivel,entidade_id,data,moeda,atribuicao,entrega,source) values ('00000000-0000-4000-8000-000000000001','act_123','account','act_123','2026-09-02','BRL','unified_default_unresolved','served','meta_graph')"); } catch { writeDenied = true; }
if (!writeDenied) throw new Error('authenticated write unexpectedly allowed');
const googleScoped = await db.query('select count(*)::int as n, max(conversoes)::float as conversions from public.google_ads_daily_facts');
if (googleScoped.rows[0].n !== 1 || googleScoped.rows[0].conversions !== 0.5) throw new Error('Google RLS read scope or fractional value failed');
let googleWriteDenied = false;
try { await db.exec("insert into public.google_ads_daily_facts(cliente_id,customer_id,data,moeda,cobertura) values ('00000000-0000-4000-8000-000000000001','1234567890','2026-09-02','BRL','measured')"); } catch { googleWriteDenied = true; }
if (!googleWriteDenied) throw new Error('Google authenticated write unexpectedly allowed');
await db.exec('reset role');
console.log('migration isolated: RLS scoped read, write denied');
await db.exec(`
create table public.metas_cliente(
  id uuid primary key default gen_random_uuid(), cliente_id uuid not null references public.clientes(id),
  objetivo text not null, ativo boolean default true, created_at timestamptz default now()
);
create table public.tarefas(
  id uuid primary key default gen_random_uuid(), cliente_id uuid references public.clientes(id),
  titulo text not null, descricao text, responsavel text, prioridade text, status text, data_vencimento date
);
create table public.alertas_anomalia(
  id uuid primary key default gen_random_uuid(), cliente_id uuid references public.clientes(id),
  nome_cliente text not null, meta_ads_act text not null, metrica text not null, tipo_alerta text,
  objetivo text, meta_id uuid, severidade text not null, status text not null,
  periodo_referencia text, valor_atual numeric, valor_referencia numeric, variacao_pct numeric,
  resolvido_em timestamptz, resolvido_por text, created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.alertas_anomalia enable row level security;
alter table public.tarefas enable row level security;
grant select, update on public.alertas_anomalia to authenticated;
grant insert, select on public.tarefas to authenticated;
create policy test_alert on public.alertas_anomalia for all to authenticated using (public.can_access_cliente(cliente_id)) with check (public.can_access_cliente(cliente_id));
create policy test_task on public.tarefas for all to authenticated using (public.can_access_cliente(cliente_id)) with check (public.can_access_cliente(cliente_id));
insert into public.metas_cliente(id,cliente_id,objetivo) values ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','leads');
`);
await db.exec(readFileSync('supabase/migrations/20260922030000_attention_center.sql','utf8'));
await db.exec(`
insert into public.metas_cliente(id,cliente_id,objetivo) values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002','leads');
insert into public.meta_budget_revisions(meta_id,cliente_id,effective_on,orcamento_periodo)
values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002','2026-09-01',500);
`);
const payload = JSON.stringify({ rule: 'coverage', clienteId: '00000000-0000-4000-8000-000000000001', clientName: 'A', accountId: 'act_123', metric: 'coverage', objective: 'leads', metaId: '00000000-0000-4000-8000-000000000003', severity: 'alta', periodStart: '2026-09-01', periodEnd: '2026-09-30', category: 'dados', confidence: 'alta', evidence: { missingDays: 1 }, hypothesis: 'missing', nextStep: 'reprocess', owner: 'A' });
const escaped = payload.replaceAll("'", "''");
await db.exec(`select public.save_attention_alert('${escaped}'::jsonb); select public.save_attention_alert('${escaped}'::jsonb);`);
const alertCount = await db.query("select count(*)::int as n from public.alertas_anomalia where rule_key='coverage:leads:meta_ads'");
if (alertCount.rows[0].n !== 1) throw new Error('attention alert duplicate');
await db.exec("set request.jwt.claim.client_id = '00000000-0000-4000-8000-000000000001'; set role authenticated");
const budgetScoped = await db.query('select count(*)::int as n from public.meta_budget_revisions');
if (budgetScoped.rows[0].n !== 0) throw new Error('budget RLS leaked other client');
let budgetWriteDenied = false;
try { await db.exec("insert into public.meta_budget_revisions(meta_id,cliente_id,effective_on,orcamento_periodo) values ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','2026-09-01',100)"); } catch { budgetWriteDenied = true; }
if (!budgetWriteDenied) throw new Error('budget write unexpectedly allowed');
const task = await db.query("select public.create_alert_task_once((select id from public.alertas_anomalia where rule_key='coverage:leads:meta_ads'),'Review','Evidence','A','alta','2026-09-23') as id");
const taskAgain = await db.query("select public.create_alert_task_once((select id from public.alertas_anomalia where rule_key='coverage:leads:meta_ads'),'Review','Evidence','A','alta','2026-09-23') as id");
if (task.rows[0].id !== taskAgain.rows[0].id) throw new Error('duplicate task');
await db.exec('reset role');
const taskCount = await db.query('select count(*)::int as n from public.tarefas');
if (taskCount.rows[0].n !== 1) throw new Error('duplicate task inserted');
console.log('attention migration isolated: alert and task deduplication');
await db.close();
