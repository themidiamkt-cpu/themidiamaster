import { fetchGraphJson, resolveSyncPlan, rowsToFacts, runClients, safeErrorCode } from './sync-core.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const graphVersion = 'v20.0';
const metaGoalConfig = {
  mensagens: {
    actionTypes: ['onsite_conversion.messaging_conversation_started_7d', 'messaging_conversation_started_7d', 'messenger_conversation_started_7d'],
  },
  vendas: {
    actionTypes: ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'],
  },
  leads: {
    actionTypes: ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'],
  },
  seguidores: {
    actionTypes: ['instagram_profile_follow', 'onsite_conversion.follow', 'follow', 'page_fan_adds'],
  },
} as const;

type GoalKey = keyof typeof metaGoalConfig;
type ClientRow = {
  id: string;
  nome_empresa: string;
  meta_ads_act: string | null;
  segmento: string | null;
  status: string | null;
  observacoes: string | null;
};
type MetaRow = {
  cliente_id: string;
  objetivo: GoalKey;
  ativo: boolean | null;
  created_at: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Metodo nao permitido.' }, 405);
  if (!assertBackfillSecret(req)) return json({ ok: false, error: 'Cron nao autorizado.' }, 401);
  const token = Deno.env.get('META_ACCESS_TOKEN') || Deno.env.get('META_ADS_ACCESS_TOKEN');
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
  if (!token || !url || !key) return json({ ok: false, error: 'Configuracao do sincronizador incompleta.' }, 503);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let runId: string | null = null;
  try {
    const payload = await safeJson(req);
    const plan = resolveSyncPlan(payload, new Date(), Number(Deno.env.get('META_SYNC_ROLLING_DAYS') || 7), Number(Deno.env.get('META_SYNC_PAGE_DAYS') || 7));
    const { data: run, error: runError } = await db.from('meta_ads_sync_runs').insert({
      mode: plan.mode, requested_since: plan.since, requested_until: plan.until,
      page_since: plan.pageSince, page_until: plan.pageUntil, next_cursor: plan.nextCursor,
    }).select('id').single();
    if (runError || !run) throw new Error('DATABASE_RUN_INSERT');
    runId = run.id;
    let query = db.from('clientes').select('id,nome_empresa,meta_ads_act,segmento,status,observacoes').not('meta_ads_act', 'is', null).neq('status', 'cancelado').order('id', { ascending: true });
    if (payload.clienteId) {
      if (!/^[0-9a-f-]{36}$/i.test(String(payload.clienteId))) throw new Error('INVALID_CLIENT');
      query = query.eq('id', payload.clienteId);
    }
    const { data: clients, error: clientsError } = await query;
    if (clientsError) throw new Error('DATABASE_CLIENT_LIST');
    const selected = (clients || []).filter((client: ClientRow) => String(client.meta_ads_act || '').trim());
    const { data: metas, error: goalsError } = selected.length
      ? await db.from('metas_cliente').select('cliente_id,objetivo,ativo,created_at').in('cliente_id', selected.map((client: ClientRow) => client.id))
      : { data: [], error: null };
    if (goalsError) throw new Error('DATABASE_GOAL_LIST');
    const goalByClientId = new Map<string, GoalKey>();
    (metas || []).filter((meta: MetaRow) => meta.ativo !== false)
      .sort((a: MetaRow, b: MetaRow) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .forEach((meta: MetaRow) => { if (!goalByClientId.has(meta.cliente_id) && isGoalKey(meta.objetivo)) goalByClientId.set(meta.cliente_id, meta.objetivo); });
    const results = await runClients(selected, 2, async (client: ClientRow) => {
      const goal = goalByClientId.get(client.id) || inferGoal(client);
      return syncClient(db, token, runId!, client, goal, plan);
    });
    const counts = {
      clients_total: selected.length,
      clients_complete: results.filter((r: any) => r.status === 'complete').length,
      clients_partial: results.filter((r: any) => r.status === 'partial').length,
      clients_failed: results.filter((r: any) => r.status === 'failed').length,
      facts_written: results.reduce((sum: number, r: any) => sum + Number(r.facts_written || 0), 0),
    };
    let status = counts.clients_failed === selected.length && selected.length ? 'failed' : counts.clients_failed || counts.clients_partial ? 'partial' : 'complete';
    let runErrorCode = status === 'complete' ? null : 'CLIENT_SYNC_INCOMPLETE';
    if (status === 'complete') {
      const cutoff = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
      const { error: retentionError } = await db.from('meta_ads_facts').delete().eq('source', 'meta_graph').in('nivel', ['campaign', 'ad']).lt('data', cutoff);
      if (retentionError) { status = 'partial'; runErrorCode = 'DATABASE_RETENTION'; }
    }
    const { error: finishError } = await db.from('meta_ads_sync_runs').update({ ...counts, status, finished_at: new Date().toISOString(), error_code: runErrorCode }).eq('id', runId);
    if (finishError) throw new Error('DATABASE_RUN_FINISH');
    return json({ ok: status === 'complete', status, run_id: runId, since: plan.pageSince, until: plan.pageUntil,
      next_cursor: plan.nextCursor, ...counts, results }, status === 'complete' ? 200 : 207);
  } catch (error) {
    const code = safeErrorCode(error);
    if (runId) await db.from('meta_ads_sync_runs').update({ status: 'failed', error_code: code, finished_at: new Date().toISOString() }).eq('id', runId);
    return json({ ok: false, status: 'failed', run_id: runId, error_code: code }, code.startsWith('INVALID_') ? 400 : 500);
  }
});

type SyncPlan = { mode: string; since: string; until: string; pageSince: string; pageUntil: string; nextCursor: string | null; expectedDays: number };
async function syncClient(db: any, token: string, runId: string, client: ClientRow, goal: GoalKey, plan: SyncPlan) {
  const accountId = normalizeMetaAccount(client.meta_ads_act || '');
  const base = { run_id: runId, cliente_id: client.id, meta_ads_act: accountId,
    period_since: plan.pageSince, period_until: plan.pageUntil, expected_days: plan.expectedDays, missing_days: plan.expectedDays };
  const { data: item, error: itemError } = await db.from('meta_ads_sync_items').insert(base).select('id').single();
  if (itemError || !item) throw new Error('DATABASE_ITEM_INSERT');
  const counts = { queried_days: 0, no_delivery_days: 0, missing_days: plan.expectedDays,
    account_rows: 0, campaign_rows: 0, ad_rows: 0, facts_written: 0, health_status: 'not_checked' };
  const failures: string[] = [];
  let account: any = null;
  try { account = await fetchMetaAccount(token, accountId); }
  catch (error) { failures.push(`health:${safeErrorCode(error)}`); }
  const currency = /^[A-Z]{3}$/.test(String(account?.currency || '')) ? account.currency : 'UNKNOWN';
  const recentCutoff = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  for (const level of ['account', 'campaign', 'ad'] as const) {
    if (level !== 'account' && plan.pageUntil < recentCutoff) continue;
    const levelSince = level === 'account' || plan.pageSince >= recentCutoff ? plan.pageSince : recentCutoff;
    try {
      const rows = await fetchMetaInsights(token, accountId, levelSince, plan.pageUntil, level);
      const facts = rowsToFacts(rows, { clienteId: client.id, accountId, level, since: levelSince,
        until: plan.pageUntil, currency, goal, syncedAt: new Date().toISOString() });
      for (let offset = 0; offset < facts.length; offset += 100) {
        const { error } = await db.from('meta_ads_facts').upsert(facts.slice(offset, offset + 100), { onConflict: 'cliente_id,meta_ads_act,nivel,entidade_id,data,moeda,atribuicao' });
        if (error) throw new Error('DATABASE_FACT_WRITE');
      }
      counts.facts_written += facts.length;
      if (level === 'account') counts.account_rows = rows.length;
      if (level === 'campaign') counts.campaign_rows = rows.length;
      if (level === 'ad') counts.ad_rows = rows.length;
      if (level === 'account') {
        counts.queried_days = plan.expectedDays;
        counts.missing_days = 0;
        counts.no_delivery_days = facts.filter((fact: any) => fact.entrega === 'no_delivery').length;
      }
    } catch (error) { failures.push(`${level}:${safeErrorCode(error)}`); }
  }
  if (account) {
    try { await syncAccountHealth(db, token, client, accountId, account); counts.health_status = 'ok'; }
    catch (error) { failures.push(`health:${safeErrorCode(error)}`); counts.health_status = 'failed'; }
  } else counts.health_status = 'failed';
  const status = counts.queried_days === 0 ? 'failed' : failures.length ? 'partial' : 'complete';
  const { error: updateError } = await db.from('meta_ads_sync_items').update({ ...counts, status,
    error_code: failures.length ? failures.join('|').slice(0, 180) : null, finished_at: new Date().toISOString() }).eq('id', item.id);
  if (updateError) throw new Error('DATABASE_ITEM_FINISH');
  return { cliente_id: client.id, status, error_code: failures.length ? failures.join('|').slice(0, 180) : null,
    facts_written: counts.facts_written, queried_days: counts.queried_days, missing_days: counts.missing_days };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
  });
}

async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function assertBackfillSecret(req: Request) {
  const expected = Deno.env.get('CRON_SECRET') || '';
  const supplied = req.headers.get('x-cron-secret') || '';
  if (!expected || !supplied || expected.length !== supplied.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return difference === 0;
}

function normalizeMetaAccount(value: string) {
  const clean = String(value || '').trim();
  if (!clean) throw new Error('Conta Meta Ads vazia.');
  return clean.startsWith('act_') ? clean : `act_${clean}`;
}

async function fetchMetaInsights(token: string, accountId: string, since: string, until: string, level: 'account' | 'campaign' | 'ad') {
  const fields = [
    'date_start', 'date_stop', 'impressions', 'reach', 'clicks', 'spend', 'actions', 'action_values',
    ...(level === 'ad' ? ['ad_id', 'campaign_id'] : level === 'campaign' ? ['campaign_id'] : []),
  ].join(',');
  const params = new URLSearchParams({ level, fields, time_range: JSON.stringify({ since, until }),
    time_increment: '1', limit: '100', use_unified_attribution_setting: 'true', access_token: token });
  const rows: any[] = [];
  let next = `https://graph.facebook.com/${graphVersion}/${accountId}/insights?${params}`;
  for (let page = 0; next && page < 50; page++) {
    const data = await fetchGraphJson(next);
    rows.push(...(data.data || []));
    next = data.paging?.next || '';
    if (next && !next.startsWith('https://graph.facebook.com/')) throw new Error('META_PAGINATION');
  }
  if (next) throw new Error('META_PAGINATION');
  return rows;
}

async function syncAccountHealth(supabase: any, token: string, client: ClientRow, accountId: string, account: any) {
  const campaignsResult = await safeFetchMetaDeliveryObjects(token, accountId, 'campaigns');
  const adsetsResult = await safeFetchMetaDeliveryObjects(token, accountId, 'adsets');
  const adsResult = await safeFetchMetaDeliveryObjects(token, accountId, 'ads');
  const campaigns = campaignsResult.rows;
  const adsets = adsetsResult.rows;
  const ads = adsResult.rows;
  const deliveryFetchErrors = [campaignsResult.error, adsetsResult.error, adsResult.error].filter(Boolean);
  const deliveryIssues = [...campaigns, ...adsets, ...ads].filter((item) => {
    const status = String(item.effective_status || '');
    const issues = Array.isArray(item.issues_info) ? item.issues_info : [];
    return issues.length || ['WITH_ISSUES', 'DISAPPROVED', 'PENDING_REVIEW'].includes(status);
  });
  const payload = {
    cliente_id: client.id,
    meta_ads_act: accountId,
    account_id: account.account_id || account.id || accountId.replace(/^act_/, ''),
    account_name: account.name || null,
    currency: account.currency || null,
    account_status: toNullableNumber(account.account_status),
    account_status_label: accountStatusLabel(account.account_status),
    disable_reason: toNullableNumber(account.disable_reason),
    disable_reason_label: disableReasonLabel(account.disable_reason),
    funding_source_type: fundingSourceLabel(account.funding_source_details),
    funding_source_details: account.funding_source_details || {},
    balance_minor: toNullableNumber(account.balance),
    amount_spent_minor: toNullableNumber(account.amount_spent),
    spend_cap_minor: toNullableNumber(account.spend_cap),
    prepay_balance_minor: extractPrepayBalance(account.funding_source_details),
    effective_status: deliveryIssues.length ? 'WITH_ISSUES' : accountStatusLabel(account.account_status),
    has_delivery_issues: deliveryIssues.length > 0 || Number(account.account_status) === 3 || Number(account.disable_reason || 0) > 0,
    delivery_issues: deliveryIssues,
    last_error: deliveryFetchErrors.length ? 'DELIVERY_FETCH_INCOMPLETE' : null,
    raw: { deliverySample: deliveryIssues.slice(0, 20) },
    checked_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('meta_ads_account_health').upsert(payload, { onConflict: 'cliente_id' });
  if (error) throw new Error('DATABASE_HEALTH_WRITE');
  if (deliveryFetchErrors.length) throw new Error('META_BAD_RESPONSE');
}

async function fetchMetaAccount(token: string, accountId: string) {
  const fields = [
    'id',
    'account_id',
    'name',
    'currency',
    'account_status',
    'disable_reason',
    'funding_source_details',
    'balance',
    'amount_spent',
    'spend_cap',
  ].join(',');
  return fetchGraphJson(`https://graph.facebook.com/${graphVersion}/${accountId}?${new URLSearchParams({ fields, access_token: token }).toString()}`);
}

async function fetchMetaDeliveryObjects(token: string, accountId: string, edge: 'campaigns' | 'adsets' | 'ads') {
  const fields = ['id', 'name', 'effective_status', 'issues_info'].join(',');
  const params = new URLSearchParams({
    fields,
    limit: '100',
    access_token: token,
  });
  const rows = [];
  let next = `https://graph.facebook.com/${graphVersion}/${accountId}/${edge}?${params.toString()}`;
  let page = 0;
  while (next && page < 5) {
    page += 1;
    const data = await fetchGraphJson(next);
    rows.push(...(data.data || []).map((item: any) => ({ ...item, level: edge })));
    next = data.paging?.next || '';
  }
  return rows;
}

async function safeFetchMetaDeliveryObjects(token: string, accountId: string, edge: 'campaigns' | 'adsets' | 'ads') {
  try {
    return { rows: await fetchMetaDeliveryObjects(token, accountId, edge), error: '' };
  } catch (error) {
    return { rows: [], error: `${edge}: ${error?.message || 'falha ao consultar delivery'}` };
  }
}

function toNullableNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function accountStatusLabel(value: unknown) {
  const labels: Record<number, string> = {
    1: 'Ativa',
    2: 'Desativada',
    3: 'Pagamento pendente',
    7: 'Pendente de revisao',
    8: 'Pendente de liquidacao',
    9: 'Em periodo de graca',
    100: 'Fechada',
    101: 'Pendente de fechamento',
  };
  return labels[Number(value)] || (value ? `Status ${value}` : 'Sem status');
}

function disableReasonLabel(value: unknown) {
  const labels: Record<number, string> = {
    0: 'Sem bloqueio',
    1: 'Conta desativada',
    2: 'Pagamento',
    3: 'Politica',
    7: 'Risco',
    8: 'Conta comprometida',
  };
  return labels[Number(value)] || (value ? `Motivo ${value}` : 'Sem bloqueio');
}

function fundingSourceLabel(details: any) {
  if (!details || typeof details !== 'object') return null;
  return details.display_string || details.type || details.funding_source_type || details.id || null;
}

function extractPrepayBalance(details: any) {
  if (!details || typeof details !== 'object') return null;
  const keys = ['available_balance', 'prepay_balance', 'balance', 'amount'];
  const stack = [details];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    for (const key of keys) {
      const value = current[key];
      const numeric = toNullableNumber(value);
      if (numeric !== null) return numeric;
    }
    Object.values(current).forEach((value) => {
      if (value && typeof value === 'object') stack.push(value);
    });
  }
  return null;
}

function isGoalKey(value: string): value is GoalKey {
  return value in metaGoalConfig;
}

function inferGoal(client: ClientRow): GoalKey {
  const text = `${client.nome_empresa || ''} ${client.segmento || ''} ${client.observacoes || ''}`.toLowerCase();
  if (text.includes('venda') || text.includes('e-commerce') || text.includes('ecommerce') || text.includes('loja') || text.includes('store') || text.includes('trokai')) return 'vendas';
  if (text.includes('lead')) return 'leads';
  if (text.includes('seguidor')) return 'seguidores';
  return 'mensagens';
}
