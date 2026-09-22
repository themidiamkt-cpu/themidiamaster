import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchGoogleAdsReport, validatePeriod } from '../server/googleAds.js';

test('period rejects malformed or overly long intervals', () => {
  assert.throws(() => validatePeriod("2026-01-01' OR 1=1", '2026-01-10'));
  assert.throws(() => validatePeriod('2026-01-01', '2026-05-01'));
});

test('account totals include all campaigns, preserve fractional conversions and cache OAuth', async () => {
  const oldFetch = global.fetch;
  const oldEnv = Object.fromEntries(['GOOGLE_ADS_DEVELOPER_TOKEN','GOOGLE_ADS_CLIENT_ID','GOOGLE_ADS_CLIENT_SECRET','GOOGLE_ADS_REFRESH_TOKEN'].map((key) => [key, process.env[key]]));
  Object.assign(process.env, { GOOGLE_ADS_DEVELOPER_TOKEN: 'test', GOOGLE_ADS_CLIENT_ID: 'test', GOOGLE_ADS_CLIENT_SECRET: 'test', GOOGLE_ADS_REFRESH_TOKEN: 'test' });
  let oauthCalls = 0;
  const campaigns = Array.from({ length: 61 }, (_, i) => ({ campaign: { id: String(i), name: 'C' + i }, metrics: { costMicros: '1000000', conversions: '0.5' } }));
  global.fetch = async (url, options) => {
    if (String(url).includes('oauth2')) { oauthCalls++; return { ok: true, json: async () => ({ access_token: 'access', expires_in: 3600 }) }; }
    const { query, pageToken } = JSON.parse(options.body);
    if (query.includes('FROM campaign')) return { ok: true, json: async () => pageToken ? { results: campaigns.slice(30) } : { results: campaigns.slice(0, 30), nextPageToken: 'second' } };
    if (query.includes('FROM keyword_view')) return { ok: false, status: 500, json: async () => ({}) };
    if (query.includes('segments.conversion_action')) return { ok: true, json: async () => ({ results: [{ segments: { conversionActionName: 'Lead' }, metrics: { conversions: '1.5', conversionsValue: '90' } }] }) };
    if (query.includes('segments.date,')) return { ok: true, json: async () => ({ results: [{ segments: { date: '2026-09-01' }, metrics: { costMicros: '61000000', conversions: '30.5', conversionsValue: '90' } }] }) };
    if (query.includes('FROM customer')) return { ok: true, json: async () => ({ results: [{ customer: { currencyCode: 'BRL', timeZone: 'America/Sao_Paulo' }, metrics: { costMicros: '61000000', conversions: '30.5', conversionsValue: '90' } }] }) };
    return { ok: true, json: async () => ({ results: [] }) };
  };
  try {
    const first = await fetchGoogleAdsReport({ customerId: '123-456-7890', since: '2026-09-01', until: '2026-09-01' });
    const second = await fetchGoogleAdsReport({ customerId: '1234567890', since: '2026-09-01', until: '2026-09-01' });
    assert.equal(first.totals.spend, 61);
    assert.equal(first.totals.conversions, 30.5);
    assert.equal(first.campaignCount, 61);
    assert.equal(first.campaigns.length, 50);
    assert.equal(first.conversionActions[0].conversions, 1.5);
    assert.match(first.partialErrors.join(' '), /Palavras-chave/);
    assert.equal(second.totals.spend, 61);
    assert.equal(oauthCalls, 1);
  } finally {
    global.fetch = oldFetch;
    for (const [key, value] of Object.entries(oldEnv)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
