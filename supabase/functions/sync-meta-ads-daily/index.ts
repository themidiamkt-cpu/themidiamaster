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

  try {
    const payload = await safeJson(req);
    assertBackfillSecret(req, payload);

    const token = Deno.env.get('META_ACCESS_TOKEN') || Deno.env.get('META_ADS_ACCESS_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!token) throw new Error('META_ACCESS_TOKEN nao configurado nos secrets da Edge Function.');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao configurado.');

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const range = resolveRange(payload);
    const { data: clients, error: clientsError } = await supabase
      .from('clientes')
      .select('id,nome_empresa,meta_ads_act,segmento,status,observacoes')
      .not('meta_ads_act', 'is', null)
      .neq('status', 'cancelado')
      .order('nome_empresa', { ascending: true });
    if (clientsError) throw clientsError;

    const filteredClients = (clients || [])
      .filter((client: ClientRow) => String(client.meta_ads_act || '').trim())
      .filter((client: ClientRow) => !payload.clienteId || client.id === payload.clienteId);

    if (!filteredClients.length) {
      return json({
        ok: true,
        mode: payload.mode || 'yesterday',
        since: range.since,
        until: range.until,
        clients: 0,
        rows: 0,
        results: [],
      });
    }

    const { data: metas } = await supabase
      .from('metas_cliente')
      .select('cliente_id,objetivo,ativo,created_at')
      .in('cliente_id', filteredClients.map((client: ClientRow) => client.id));

    const goalByClientId = new Map<string, GoalKey>();
    (metas || [])
      .filter((meta: MetaRow) => meta.ativo !== false)
      .sort((a: MetaRow, b: MetaRow) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .forEach((meta: MetaRow) => {
        if (!goalByClientId.has(meta.cliente_id) && isGoalKey(meta.objetivo)) goalByClientId.set(meta.cliente_id, meta.objetivo);
      });

    const results: Array<{ cliente: string; accountId: string; objetivo: GoalKey; rows?: number; error?: string }> = [];
    for (const client of filteredClients as ClientRow[]) {
      const goalKey = goalByClientId.get(client.id) || inferGoal(client);
      const accountId = normalizeMetaAccount(client.meta_ads_act || '');
      try {
        const rows = await fetchMetaInsights(token, accountId, range.since, range.until);
        const payloads = summarizeDailyRows(rows, client, goalKey);
        if (payloads.length) {
          const { error } = await supabase
            .from('meta_ads_daily_insights')
            .upsert(payloads, { onConflict: 'cliente_id,meta_ads_act,data,objetivo' });
          if (error) throw error;
        }
        results.push({ cliente: client.nome_empresa, accountId, objetivo: goalKey, rows: payloads.length });
      } catch (error) {
        results.push({ cliente: client.nome_empresa, accountId, objetivo: goalKey, error: error?.message || 'Falha ao sincronizar' });
      }
    }

    return json({
      ok: true,
      mode: payload.mode || 'yesterday',
      since: range.since,
      until: range.until,
      clients: filteredClients.length,
      rows: results.reduce((sum, item) => sum + Number(item.rows || 0), 0),
      results,
    });
  } catch (error) {
    return json({ ok: false, error: error?.message || 'Erro inesperado.' }, 500);
  }
});

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

function assertBackfillSecret(req: Request, payload: Record<string, any>) {
  const mode = String(payload.mode || 'yesterday');
  if (!['backfill', 'range'].includes(mode)) return;
  const cronSecret = Deno.env.get('CRON_SECRET') || '';
  if (!cronSecret) throw new Error('Configure CRON_SECRET para rodar backfill ou range manual.');
  const provided = req.headers.get('x-cron-secret') || payload.cronSecret || '';
  if (provided !== cronSecret) throw new Error('CRON_SECRET invalido.');
}

function resolveRange(payload: Record<string, any>) {
  const mode = String(payload.mode || 'yesterday');
  if (['backfill', 'range'].includes(mode)) {
    const since = String(payload.since || '').slice(0, 10);
    const until = String(payload.until || '').slice(0, 10);
    if (!isIsoDate(since) || !isIsoDate(until)) throw new Error('Informe since e until no formato YYYY-MM-DD.');
    if (since > until) throw new Error('since nao pode ser maior que until.');
    return { since, until };
  }

  const now = new Date();
  const saoPauloNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  saoPauloNow.setDate(saoPauloNow.getDate() - 1);
  const yesterday = isoDate(saoPauloNow);
  return { since: yesterday, until: yesterday };
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isoDate(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeMetaAccount(value: string) {
  const clean = String(value || '').trim();
  if (!clean) throw new Error('Conta Meta Ads vazia.');
  return clean.startsWith('act_') ? clean : `act_${clean}`;
}

async function fetchMetaInsights(token: string, accountId: string, since: string, until: string) {
  const fields = [
    'date_start',
    'date_stop',
    'impressions',
    'reach',
    'clicks',
    'cpc',
    'ctr',
    'spend',
    'actions',
    'action_values',
  ].join(',');
  const params = new URLSearchParams({
    level: 'account',
    fields,
    time_range: JSON.stringify({ since, until }),
    time_increment: '1',
    limit: '100',
    access_token: token,
  });
  const rows = [];
  let next = `https://graph.facebook.com/${graphVersion}/${accountId}/insights?${params.toString()}`;
  while (next) {
    const response = await fetch(next);
    const data = await response.json();
    if (!response.ok || data.error) {
      const err = data.error || {};
      if (String(err.code) === '190') throw new Error('Token Meta Ads expirado ou invalido.');
      throw new Error(err.message || `Erro Meta Ads ${response.status}`);
    }
    rows.push(...(data.data || []));
    next = data.paging?.next || '';
  }
  return rows;
}

function summarizeDailyRows(rows: any[], client: ClientRow, goalKey: GoalKey) {
  const byDay = new Map<string, any[]>();
  rows.forEach((row) => {
    const day = String(row.date_start || row.date_stop || '').slice(0, 10);
    if (!day) return;
    const current = byDay.get(day) || [];
    current.push(row);
    byDay.set(day, current);
  });

  return [...byDay.entries()].map(([day, dayRows]) => {
    const totals = dayRows.reduce((acc, row) => {
      acc.investimento += Number(row.spend || 0);
      acc.impressoes += Number(row.impressions || 0);
      acc.alcance += Number(row.reach || 0);
      acc.cliques += Number(row.clicks || 0);
      acc.mensagens += extractMetaAction(row, metaGoalConfig.mensagens.actionTypes);
      acc.leads += extractMetaAction(row, metaGoalConfig.leads.actionTypes);
      acc.vendas += extractMetaAction(row, metaGoalConfig.vendas.actionTypes);
      acc.faturamento += extractMetaActionValue(row, metaGoalConfig.vendas.actionTypes);
      return acc;
    }, { investimento: 0, impressoes: 0, alcance: 0, cliques: 0, mensagens: 0, leads: 0, vendas: 0, faturamento: 0 });

    return {
      cliente_id: client.id,
      meta_ads_act: normalizeMetaAccount(client.meta_ads_act || ''),
      data: day,
      objetivo: goalKey,
      investimento: roundMoney(totals.investimento),
      impressoes: Math.round(totals.impressoes),
      alcance: Math.round(totals.alcance),
      cliques: Math.round(totals.cliques),
      ctr: ratio(totals.cliques * 100, totals.impressoes, 4),
      cpc: ratio(totals.investimento, totals.cliques, 4),
      mensagens: Math.round(totals.mensagens),
      custo_por_mensagem: ratio(totals.investimento, totals.mensagens, 4),
      leads: Math.round(totals.leads),
      custo_por_lead: ratio(totals.investimento, totals.leads, 4),
      vendas: Math.round(totals.vendas),
      custo_por_venda: ratio(totals.investimento, totals.vendas, 4),
      faturamento: roundMoney(totals.faturamento),
      roas: ratio(totals.faturamento, totals.investimento, 4),
      raw: { source: 'meta_ads_insights', rows: dayRows.length },
      synced_at: new Date().toISOString(),
    };
  });
}

function extractMetaAction(row: any, actionTypes: readonly string[]) {
  const actions = row.actions || [];
  return actionTypes.reduce((sum, actionType) => {
    const found = actions.find((item: any) => item.action_type === actionType);
    return sum + Number(found?.value || 0);
  }, 0);
}

function extractMetaActionValue(row: any, actionTypes: readonly string[]) {
  const values = row.action_values || [];
  return actionTypes.reduce((sum, actionType) => {
    const found = values.find((item: any) => item.action_type === actionType);
    return sum + Number(found?.value || 0);
  }, 0);
}

function ratio(part: number, total: number, decimals = 2) {
  const denominator = Number(total || 0);
  return denominator ? Number((Number(part || 0) / denominator).toFixed(decimals)) : 0;
}

function roundMoney(value: number) {
  return Number(Number(value || 0).toFixed(2));
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
