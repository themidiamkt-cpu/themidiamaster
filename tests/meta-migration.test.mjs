import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated;
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
await db.close();
