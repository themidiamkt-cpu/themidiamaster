import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { validDate } from '../sync-meta-ads-daily/sync-core.js';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'content-type': 'application/json' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return reply({ ok: true });
  if (req.method !== 'POST') return reply({ ok: false, error_code: 'METHOD_NOT_ALLOWED' }, 405);
  const bearer = /^Bearer (.+)$/i.exec(req.headers.get('authorization') || '')?.[1];
  if (!bearer) return reply({ ok: false, error_code: 'AUTH_REQUIRED' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!url || !anon || !cronSecret) return reply({ ok: false, error_code: 'CONFIG_MISSING' }, 503);
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${bearer}` } }, auth: { persistSession: false } });
  const { data: { user }, error: userError } = await caller.auth.getUser(bearer);
  if (userError || !user) return reply({ ok: false, error_code: 'AUTH_INVALID' }, 401);
  const { data: allowed, error: roleError } = await caller.rpc('is_main_admin');
  if (roleError || !allowed) return reply({ ok: false, error_code: 'ACCESS_DENIED' }, 403);
  try {
    const body = await req.json();
    const clienteId = String(body.cliente_id || '');
    const since = String(body.since || '');
    const until = String(body.until || '');
    if (!/^[0-9a-f-]{36}$/i.test(clienteId) || !validDate(since) || !validDate(until) || since > until) return reply({ ok: false, error_code: 'INVALID_RANGE' }, 400);
    const days = (Date.parse(`${until}T00:00:00Z`) - Date.parse(`${since}T00:00:00Z`)) / 86400000 + 1;
    const cutoff = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
    if (days > 7 || since < cutoff || until >= new Date().toISOString().slice(0, 10)) return reply({ ok: false, error_code: 'RANGE_NOT_ALLOWED' }, 400);
    const { data: client, error } = await caller.from('clientes').select('id').eq('id', clienteId).maybeSingle();
    if (error || !client) return reply({ ok: false, error_code: 'CLIENT_NOT_ACCESSIBLE' }, 403);
    const response = await fetch(`${url}/functions/v1/sync-meta-ads-daily`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-cron-secret': cronSecret },
      body: JSON.stringify({ mode: 'range', clienteId, since, until }),
    });
    const result = await response.json().catch(() => ({}));
    return reply({ ok: result.ok === true, status: result.status || 'failed', run_id: result.run_id || null,
      error_code: result.error_code || (result.ok ? null : 'SYNC_INCOMPLETE') }, result.ok ? 200 : 207);
  } catch { return reply({ ok: false, error_code: 'REQUEST_FAILED' }, 502); }
});
