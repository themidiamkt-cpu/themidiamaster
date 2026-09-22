// Google Ads API v24. OAuth credentials remain server side.
const API = 'https://googleads.googleapis.com/v24';
const cache = new Map();
export class GoogleAdsError extends Error {
  constructor(kind, message, status = 502) { super(message); this.kind = kind; this.status = status; }
}
export function validatePeriod(since, until) {
  const valid = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));
  if (!valid(since) || !valid(until) || since > until || (Date.parse(until) - Date.parse(since)) / 86400000 > 92) throw new GoogleAdsError('period', 'Período inválido ou superior a 93 dias.', 400);
}
function credentials() {
  const keys = ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN'];
  const values = keys.map((k) => process.env[k]?.trim());
  if (values.some((v) => !v)) throw new GoogleAdsError('configuration', 'Credenciais Google Ads incompletas.');
  return { developerToken: values[0], clientId: values[1], clientSecret: values[2], refreshToken: values[3], loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, '') || '' };
}
async function token(creds) {
  const key = creds.clientId + ':' + creds.refreshToken;
  const saved = cache.get(key);
  if (saved?.until > Date.now() + 60000) return saved.value;
  let response;
  try {
    response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: creds.clientId, client_secret: creds.clientSecret, refresh_token: creds.refreshToken, grant_type: 'refresh_token' }) });
  } catch { throw new GoogleAdsError('oauth', 'Falha de comunicação no OAuth Google.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new GoogleAdsError('oauth', 'Falha na autenticação Google Ads.');
  cache.set(key, { value: data.access_token, until: Date.now() + (Number(data.expires_in) || 3600) * 1000 });
  return data.access_token;
}
async function search(id, query, accessToken, creds) {
  let next, rows = [];
  do {
    let response;
    try {
      response = await fetch(API + '/customers/' + id + '/googleAds:search', { method: 'POST', signal: AbortSignal.timeout(30000), headers: { authorization: 'Bearer ' + accessToken, 'developer-token': creds.developerToken, ...(creds.loginCustomerId ? { 'login-customer-id': creds.loginCustomerId } : {}), 'content-type': 'application/json' }, body: JSON.stringify({ query, ...(next ? { pageToken: next } : {}) }) });
    } catch { throw new GoogleAdsError('report', 'Falha de comunicação com Google Ads.'); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new GoogleAdsError(response.status === 401 ? 'oauth' : 'report', response.status === 401 ? 'Autorização Google Ads expirada.' : 'Falha ao consultar relatório Google Ads.');
    rows.push(...(data.results || []));
    next = data.nextPageToken;
  } while (next);
  return rows;
}
const num = (v) => Number(v || 0);
const metric = (m = {}) => ({ spend: num(m.costMicros) / 1e6, impressions: num(m.impressions), clicks: num(m.clicks), conversions: num(m.conversions), conversionValue: num(m.conversionsValue) });
const derive = (m) => ({ ...m, ctr: m.impressions ? m.clicks / m.impressions * 100 : 0, cpc: m.clicks ? m.spend / m.clicks : 0, cpm: m.impressions ? m.spend / m.impressions * 1000 : 0, costPerConversion: m.conversions ? m.spend / m.conversions : null, roas: m.spend ? m.conversionValue / m.spend : null });
const pct = (v) => v == null ? null : Number(v) * 100;
export async function fetchGoogleAdsReport({ customerId, since, until }) {
  validatePeriod(since, until);
  const id = String(customerId || '').replace(/-/g, '');
  if (!/^\d{10}$/.test(id)) throw new GoogleAdsError('configuration', 'ID Google Ads inválido.', 400);
  const creds = credentials(), accessToken = await token(creds), dates = "segments.date BETWEEN '" + since + "' AND '" + until + "'";
  // Total is unsegmented customer data. Action rows are never added to it.
  const queries = [
    'SELECT customer.id, customer.currency_code, customer.time_zone, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM customer WHERE ' + dates,
    'SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value, metrics.search_impression_share, metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share FROM campaign WHERE ' + dates + ' ORDER BY metrics.cost_micros DESC',
    'SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM keyword_view WHERE ' + dates + ' ORDER BY metrics.cost_micros DESC LIMIT 30',
    'SELECT search_term_view.search_term, campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM search_term_view WHERE ' + dates + ' ORDER BY metrics.cost_micros DESC LIMIT 30',
    'SELECT segments.conversion_action, segments.conversion_action_name, metrics.conversions, metrics.conversions_value FROM customer WHERE ' + dates,
    'SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM customer WHERE ' + dates,
  ];
  const [total, campaignRows, keywordResult, termResult, actionResult, dailyResult] = await Promise.all(queries.map((q, i) => i < 2 ? search(id, q, accessToken, creds) : search(id, q, accessToken, creds).then((rows) => ({ rows })).catch(() => ({ error: ['','','Palavras-chave','Termos de pesquisa','Ações de conversão','Histórico diário'][i] + ' indisponíveis.' }))));
  const totals = derive(total.reduce((acc, row) => { const m = metric(row.metrics); for (const k of Object.keys(m)) acc[k] += m[k]; return acc; }, { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0 }));
  const campaigns = campaignRows.map((r) => ({ id: String(r.campaign?.id || ''), name: r.campaign?.name || '', status: r.campaign?.status || '', channelType: r.campaign?.advertisingChannelType || '', ...derive(metric(r.metrics)), impressionShare: pct(r.metrics?.searchImpressionShare), lostBudget: pct(r.metrics?.searchBudgetLostImpressionShare), lostRank: pct(r.metrics?.searchRankLostImpressionShare) }));
  const keywords = (keywordResult.rows || []).map((r) => ({ text: r.adGroupCriterion?.keyword?.text || '', matchType: r.adGroupCriterion?.keyword?.matchType || '', campaign: r.campaign?.name || '', adGroup: r.adGroup?.name || '', ...derive(metric(r.metrics)) }));
  const terms = (termResult.rows || []).map((r) => ({ text: r.searchTermView?.searchTerm || '', campaign: r.campaign?.name || '', ...derive(metric(r.metrics)) }));
  const conversionActions = (actionResult.rows || []).map((r) => ({ id: r.segments?.conversionAction, name: r.segments?.conversionActionName || '', conversions: num(r.metrics?.conversions), conversionValue: num(r.metrics?.conversionsValue) }));
  const daysByDate = new Map((dailyResult.rows || []).map((r) => [r.segments?.date, { date: r.segments?.date, coverage: 'measured', ...derive(metric(r.metrics)) }]));
  const daily = [];
  if (dailyResult.rows) for (let cursor = Date.parse(since + 'T00:00:00Z'); cursor <= Date.parse(until + 'T00:00:00Z'); cursor += 86400000) {
    const date = new Date(cursor).toISOString().slice(0, 10);
    daily.push(daysByDate.get(date) || { date, coverage: 'no_delivery', ...derive(metric()) });
  }
  return { customerId: id, since, until, apiVersion: 'v24', source: 'Google Ads API', currency: total[0]?.customer?.currencyCode || null, timezone: total[0]?.customer?.timeZone || null, updatedAt: new Date().toISOString(), totals, campaignCount: campaigns.length, campaigns: campaigns.slice(0, 50), keywords, terms, conversionActions, daily, partialErrors: [keywordResult.error, termResult.error, actionResult.error, dailyResult.error].filter(Boolean) };
}
