export const ATTRIBUTION_SETTING = 'unified_default_unresolved';
const iso = (date) => date.toISOString().slice(0, 10);
const plusDays = (day, count) => iso(new Date(Date.parse(`${day}T00:00:00Z`) + count * 86400000));
const dayCount = (since, until) => Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${since}T00:00:00Z`)) / 86400000) + 1;
export const validDate = (day) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T00:00:00Z`)) && iso(new Date(`${day}T00:00:00Z`)) === day;
export const daysBetween = (since, until) => Array.from({ length: dayCount(since, until) }, (_, i) => plusDays(since, i));

export function resolveSyncPlan(payload, now = new Date(), rollingDays = 7, pageDays = 7) {
  const mode = ['backfill', 'range'].includes(payload.mode) ? payload.mode : 'rolling';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const yesterday = plusDays(today, -1);
  const since = mode === 'rolling' ? plusDays(yesterday, -(Math.min(30, Math.max(1, Number(rollingDays) || 7)) - 1)) : String(payload.since || '');
  const until = mode === 'rolling' ? yesterday : String(payload.until || '');
  if (!validDate(since) || !validDate(until) || since > until || until > yesterday) throw new Error('INVALID_RANGE');
  const cursor = mode === 'rolling' ? since : String(payload.cursor || since);
  if (!validDate(cursor) || cursor < since || cursor > until) throw new Error('INVALID_CURSOR');
  const maxDays = Math.min(14, Math.max(1, Number(pageDays) || 7));
  const pageUntil = mode === 'rolling' ? until : [plusDays(cursor, maxDays - 1), until].sort()[0];
  return { mode, since, until, pageSince: cursor, pageUntil, nextCursor: pageUntil < until ? plusDays(pageUntil, 1) : null, expectedDays: dayCount(cursor, pageUntil) };
}

const extract = (values, names) => {
  for (const name of names) {
    const found = (values || []).find((item) => item.action_type === name);
    if (found) return Number(found.value || 0);
  }
  return 0;
};
const ACTIONS = {
  mensagens: ['onsite_conversion.messaging_conversation_started_7d', 'messaging_conversation_started_7d', 'messenger_conversation_started_7d'],
  leads: ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'],
  vendas: ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'],
};
export function rowsToFacts(rows, { clienteId, accountId, level, since, until, currency = 'UNKNOWN', goal = 'mensagens', syncedAt = new Date().toISOString() }) {
  const byKey = new Map();
  for (const row of rows) {
    const day = String(row.date_start || '').slice(0, 10);
    if (!validDate(day) || day < since || day > until) throw new Error('INVALID_GRAPH_DAY');
    const entityId = level === 'account' ? accountId : String(row[level === 'ad' ? 'ad_id' : 'campaign_id'] || '');
    if (!entityId) throw new Error('MISSING_GRAPH_ENTITY');
    const key = `${day}:${entityId}`;
    if (byKey.has(key)) throw new Error('DUPLICATE_GRAPH_FACT');
    byKey.set(key, {
      cliente_id: clienteId, meta_ads_act: accountId, nivel: level, entidade_id: entityId,
      data: day, moeda: currency, atribuicao: ATTRIBUTION_SETTING, objetivo_snapshot: goal,
      entrega: Number(row.spend || 0) > 0 || Number(row.impressions || 0) > 0 ? 'served' : 'no_delivery',
      investimento: Number(row.spend || 0), impressoes: Number(row.impressions || 0),
      alcance: row.reach == null ? null : Number(row.reach), cliques: Number(row.clicks || 0),
      mensagens: extract(row.actions, ACTIONS.mensagens), leads: extract(row.actions, ACTIONS.leads),
      vendas: extract(row.actions, ACTIONS.vendas), faturamento: extract(row.action_values, ACTIONS.vendas),
      raw: { provider: 'meta_graph', level, attribution: ATTRIBUTION_SETTING }, source: 'meta_graph', synced_at: syncedAt,
    });
  }
  if (level === 'account') for (const day of daysBetween(since, until)) {
    const key = `${day}:${accountId}`;
    if (!byKey.has(key)) byKey.set(key, {
      cliente_id: clienteId, meta_ads_act: accountId, nivel: 'account', entidade_id: accountId,
      data: day, moeda: currency, atribuicao: ATTRIBUTION_SETTING, objetivo_snapshot: goal,
      entrega: 'no_delivery', investimento: 0, impressoes: 0, alcance: 0, cliques: 0,
      mensagens: 0, leads: 0, vendas: 0, faturamento: 0,
      raw: { provider: 'meta_graph', level: 'account', attribution: ATTRIBUTION_SETTING, explicit_zero: true }, source: 'meta_graph', synced_at: syncedAt,
    });
  }
  return [...byKey.values()];
}

export const factIdentity = (fact) => [fact.cliente_id, fact.meta_ads_act, fact.nivel, fact.entidade_id, fact.data, fact.moeda, fact.atribuicao].join('|');
export function safeErrorCode(error) {
  const code = String(error?.code || error?.message || 'UNKNOWN');
  if (/^META_(AUTH|RATE_LIMIT|TIMEOUT|BAD_RESPONSE|HTTP_5XX|HTTP_4XX|PAGINATION)$/.test(code)) return code;
  if (/^INVALID_|^MISSING_GRAPH_|^DUPLICATE_GRAPH_/.test(code)) return code.slice(0, 48);
  if (/^DATABASE_/.test(code)) return code.slice(0, 48);
  return 'UNKNOWN_FAILURE';
}

export async function runClients(items, limit, worker) {
  const output = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      try { output[index] = await worker(items[index]); }
      catch (error) { output[index] = { cliente_id: items[index].id, status: 'failed', error_code: safeErrorCode(error), facts_written: 0 }; }
    }
  }));
  return output;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function fetchGraphJson(url, fetcher = fetch, sleep = delay) {
  if (!url.startsWith('https://graph.facebook.com/')) throw new Error('META_PAGINATION');
  for (let attempt = 0; attempt < 4; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let response;
    try { response = await fetcher(url, { signal: controller.signal }); }
    catch {
      clearTimeout(timeout);
      if (attempt === 3) throw new Error('META_TIMEOUT');
      await sleep(500 * 2 ** attempt);
      continue;
    }
    clearTimeout(timeout);
    const data = await response.json().catch(() => null);
    const code = Number(data?.error?.code || 0);
    if (response.ok && !data?.error && data) {
      let usage = 0;
      try { usage = Number(JSON.parse(response.headers.get('x-app-usage') || '{}')?.call_count || 0); } catch { /* malformed usage header */ }
      if (usage >= 90) await sleep(1000);
      return data;
    }
    if (code === 190) throw new Error('META_AUTH');
    if (!data && response.ok) throw new Error('META_BAD_RESPONSE');
    const retryable = response.status === 429 || response.status >= 500 || [4, 17, 32, 613].includes(code);
    if (!retryable || attempt === 3) throw new Error(response.status >= 500 ? 'META_HTTP_5XX' : retryable ? 'META_RATE_LIMIT' : 'META_HTTP_4XX');
    const retryAfter = Number(response.headers.get('retry-after') || 0);
    await sleep(Math.min(15000, Math.max(500 * 2 ** attempt, retryAfter * 1000)));
  }
  throw new Error('META_BAD_RESPONSE');
}
