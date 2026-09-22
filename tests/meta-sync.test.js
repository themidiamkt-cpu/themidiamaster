import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSyncPlan, rowsToFacts, factIdentity, runClients, fetchGraphJson, safeErrorCode } from '../supabase/functions/sync-meta-ads-daily/sync-core.js';
const account = { clienteId: 'client-a', accountId: 'act_123', level: 'account', since: '2026-09-01', until: '2026-09-02', currency: 'BRL', goal: 'leads', syncedAt: '2026-09-03T00:00:00Z' };
const row = (spend, date = '2026-09-01') => ({ date_start: date, spend: String(spend), impressions: '10', clicks: '2', actions: [{ action_type: 'lead', value: '1' }] });

test('rolling window and backfill checkpoint are bounded', () => {
  const now = new Date('2026-09-22T12:00:00Z');
  const rolling = resolveSyncPlan({}, now, 7);
  assert.deepEqual([rolling.pageSince, rolling.pageUntil], ['2026-09-15', '2026-09-21']);
  const page = resolveSyncPlan({ mode: 'backfill', since: '2026-08-01', until: '2026-08-20', cursor: '2026-08-08' }, now, 7, 7);
  assert.equal(page.pageUntil, '2026-08-14');
  assert.equal(page.nextCursor, '2026-08-15');
});

test('goal changes and repeated loads upsert the same grain', () => {
  const first = rowsToFacts([row(10)], account);
  const second = rowsToFacts([row(12)], { ...account, goal: 'vendas' });
  assert.equal(factIdentity(first[0]), factIdentity(second[0]));
  const store = new Map();
  for (const fact of [...first, ...second]) store.set(factIdentity(fact), fact);
  assert.equal(store.size, 2); // two dates including explicit no-delivery day
  assert.equal([...store.values()].find((fact) => fact.data === '2026-09-01').investimento, 12);
});

test('successful empty account response records no delivery, not an unqueried day', () => {
  const facts = rowsToFacts([], account);
  assert.equal(facts.length, 2);
  assert.ok(facts.every((fact) => fact.entrega === 'no_delivery' && fact.investimento === 0));
});

test('late conversion reprocesses an old day without duplicate spend', () => {
  const store = new Map();
  for (const fact of rowsToFacts([row(10)], account)) store.set(factIdentity(fact), fact);
  const corrected = { ...row(10), action_values: [{ action_type: 'purchase', value: '50' }], actions: [{ action_type: 'purchase', value: '1' }] };
  for (const fact of rowsToFacts([corrected], { ...account, goal: 'vendas' })) store.set(factIdentity(fact), fact);
  assert.equal(store.size, 2);
  assert.equal([...store.values()].find((fact) => fact.data === '2026-09-01').faturamento, 50);
});

test('one account failure does not prevent other clients from completing', async () => {
  const clients = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const result = await runClients(clients, 2, async (client) => {
    if (client.id === 'b') throw new Error('META_AUTH');
    return { cliente_id: client.id, status: 'complete', facts_written: 2 };
  });
  assert.deepEqual(result.map((item) => item.status), ['complete', 'failed', 'complete']);
  assert.equal(result[1].error_code, 'META_AUTH');
});

test('retry-after and sanitized errors are enforced without leaking response text', async () => {
  let calls = 0;
  const waits = [];
  const fetcher = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 429, headers: new Headers({ 'retry-after': '2' }), json: async () => ({ error: { code: 4, message: 'private text' } }) };
    return { ok: true, status: 200, headers: new Headers(), json: async () => ({ data: [] }) };
  };
  await fetchGraphJson('https://graph.facebook.com/v20.0/act_123/insights', fetcher, async (ms) => waits.push(ms));
  assert.equal(calls, 2);
  assert.equal(waits[0], 2000);
  assert.equal(safeErrorCode(new Error('private text')), 'UNKNOWN_FAILURE');
});
