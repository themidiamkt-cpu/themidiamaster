import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { evaluateAttention } from './rules.js';

const headers = { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const date = (stamp: number) => new Date(stamp).toISOString().slice(0, 10);
const uuid = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return reply({ ok: true });
  if (req.method !== 'POST') return reply({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const bearer = /^Bearer (.+)$/i.exec(req.headers.get('authorization') || '')?.[1];
  if (!bearer) return reply({ error: 'AUTH_REQUIRED' }, 401);
  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return reply({ error: 'CONFIG_MISSING' }, 503);
  const db = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${bearer}` } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await db.auth.getUser(bearer);
  if (authError || !user) return reply({ error: 'AUTH_INVALID' }, 401);
  let body;
  try { body = await req.json(); } catch { return reply({ error: 'INVALID_BODY' }, 400); }
  const clientId = body?.cliente_id == null ? null : String(body.cliente_id);
  if (clientId && !uuid.test(clientId)) return reply({ error: 'INVALID_CLIENT' }, 400);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const today = `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}-${parts.find((p) => p.type === 'day')?.value}`;
  const yesterday = date(Date.parse(today + 'T00:00:00Z') - 86400000);
  const monthStart = yesterday.slice(0, 7) + '-01';
  const { data: clients, error: clientError } = await (clientId
    ? db.from('clientes').select('id,nome_empresa,meta_ads_act,responsavel_interno').eq('id', clientId)
    : db.from('clientes').select('id,nome_empresa,meta_ads_act,responsavel_interno').not('meta_ads_act', 'is', null));
  if (clientError) return reply({ error: 'CLIENT_READ_FAILED' }, 503);
  if (clientId && !clients?.length) return reply({ error: 'ACCESS_DENIED' }, 403);
  const visible = (clients || []).filter((c) => c.meta_ads_act);
  if (!visible.length) return reply({ ok: true, count: 0, alerts: [] });
  const { data: goals, error: goalError } = await db.from('metas_cliente').select('*').in('cliente_id', visible.map((c) => c.id)).eq('ativo', true).eq('canal', 'meta_ads');
  if (goalError) return reply({ error: 'GOALS_READ_FAILED' }, 503);
  const current = (goals || []).filter((g) => (!g.periodo_inicio || g.periodo_inicio <= yesterday) && (!g.periodo_fim || g.periodo_fim >= monthStart));
  if (!current.length) return reply({ ok: true, count: 0, alerts: [] });
  const earliest = current.map((g) => g.periodo_inicio || monthStart).sort()[0];
  const facts = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('meta_ads_facts').select('cliente_id,meta_ads_act,nivel,source,data,moeda,entrega,investimento,mensagens,leads,vendas,synced_at').in('cliente_id', visible.map((c) => c.id)).eq('nivel', 'account').gte('data', earliest).lte('data', yesterday).range(offset, offset + 999);
    if (error) return reply({ error: 'FACTS_READ_FAILED' }, 503);
    facts.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const { data: revisions, error: budgetError } = await db.from('meta_budget_revisions').select('meta_id,effective_on,orcamento_periodo,changed_at').in('meta_id', current.map((g) => g.id));
  if (budgetError) return reply({ error: 'BUDGET_READ_FAILED' }, 503);
  const { data: items, error: syncError } = await db.from('meta_ads_sync_items').select('cliente_id,meta_ads_act,period_since,period_until,status,error_code,started_at').in('cliente_id', visible.map((c) => c.id)).gte('started_at', new Date(Date.now() - 30 * 86400000).toISOString()).order('started_at', { ascending: false }).limit(1000);
  if (syncError) return reply({ error: 'SYNC_READ_FAILED' }, 503);
  const byClient = new Map(visible.map((c) => [c.id, c]));
  const cards = current.flatMap((goal) => {
    const client = byClient.get(goal.cliente_id);
    return client ? evaluateAttention({ client, goal, facts, syncItems: items || [], revisions: revisions || [] }).map((card) => ({ ...card, clientName: client.nome_empresa, accountId: client.meta_ads_act })) : [];
  });
  const admin = createClient(url, service, { auth: { persistSession: false } });
  for (const card of cards) {
    const { error } = await admin.rpc('save_attention_alert', { p: card });
    if (error) return reply({ error: 'ALERT_WRITE_FAILED', evaluated: cards.length }, 503);
  }
  return reply({ ok: true, count: cards.length, alerts: cards.map((c) => ({ cliente_id: c.clienteId, rule: c.rule, category: c.category })) });
});
