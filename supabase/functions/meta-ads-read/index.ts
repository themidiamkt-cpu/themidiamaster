import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'content-type': 'application/json' };
const cache = new Map<string, { expires: number; data: unknown }>();
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const dateOk = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return reply({ ok: true });
  if (req.method !== 'POST') return reply({ error: 'Metodo nao permitido.' }, 405);
  const bearer = /^Bearer (.+)$/i.exec(req.headers.get('authorization') || '')?.[1];
  if (!bearer) return reply({ error: 'Sessao obrigatoria.' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) return reply({ error: 'Supabase nao configurado.' }, 503);
  const db = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${bearer}` } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await db.auth.getUser(bearer);
  if (authError || !user) return reply({ error: 'Sessao invalida.' }, 401);
  try {
    const body = await req.json();
    const clienteId = String(body.cliente_id || '');
    const mode = String(body.mode || 'insights');
    const goal = String(body.objetivo || 'mensagens');
    if (!/^[0-9a-f-]{36}$/i.test(clienteId) || !['ads', 'insights', 'summary'].includes(mode) || !['mensagens', 'leads', 'vendas', 'seguidores'].includes(goal)) return reply({ error: 'Consulta invalida.' }, 400);
    if (mode !== 'ads' && (!dateOk(body.since) || !dateOk(body.until) || body.since > body.until || (Date.parse(body.until) - Date.parse(body.since)) > 366 * 86400000)) return reply({ error: 'Periodo invalido.' }, 400);
    const { data: client, error } = await db.from('clientes').select('id,meta_ads_act').eq('id', clienteId).maybeSingle();
    if (error) return reply({ error: 'Falha ao verificar cliente.' }, 503);
    if (!client) return reply({ error: 'Acesso ao cliente negado.' }, 403);
    const account = String(client.meta_ads_act || '').trim();
    if (!/^(act_)?\d+$/.test(account)) return reply({ error: 'Cliente sem conta Meta valida.' }, 400);
    const token = Deno.env.get('META_ACCESS_TOKEN') || Deno.env.get('META_ADS_ACCESS_TOKEN');
    if (!token) return reply({ error: 'Credencial Meta nao configurada.' }, 503);
    const accountId = account.startsWith('act_') ? account : `act_${account}`;
    const key = [user.id, clienteId, mode, body.since || '', body.until || '', goal, body.time_increment || ''].join(':');
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return reply(cached.data);
    const params = new URLSearchParams({ access_token: token, limit: '100' });
    let edge = 'insights';
    if (mode === 'ads') {
      edge = 'ads';
      params.set('fields', 'id,name,status,effective_status,campaign{id,name},adset{id,name},creative{id,name,thumbnail_url,image_url,object_story_spec}');
    } else {
      params.set('fields', mode === 'summary' ? 'spend,reach,impressions,actions,action_values' : 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,impressions,reach,clicks,cpc,cpm,ctr,spend,actions,action_values,cost_per_action_type');
      if (mode === 'insights') params.set('level', 'ad');
      params.set('time_range', JSON.stringify({ since: body.since, until: body.until }));
      if (body.time_increment === '7' && mode === 'insights') params.set('time_increment', '7');
    }
    let next = `https://graph.facebook.com/v20.0/${accountId}/${edge}?${params}`;
    const rows: unknown[] = [];
    for (let page = 0; next && page < 30; page++) {
      const response = await fetch(next);
      const result = await response.json();
      if (!response.ok || result.error) return reply({ error: result.error?.code === 190 ? 'Credencial Meta expirada.' : 'Falha na consulta Meta.' }, 502);
      rows.push(...(result.data || []));
      next = result.paging?.next || '';
      if (next && !next.startsWith('https://graph.facebook.com/')) return reply({ error: 'Paginacao Meta invalida.' }, 502);
    }
    if (next) return reply({ error: 'Consulta Meta excedeu o limite de paginas.' }, 502);
    const result = { data: rows, source: 'meta_graph', measured: true, since: body.since || null, until: body.until || null };
    cache.set(key, { expires: Date.now() + 5 * 60000, data: result });
    return reply(result);
  } catch { return reply({ error: 'Consulta Meta indisponivel.' }, 502); }
});
