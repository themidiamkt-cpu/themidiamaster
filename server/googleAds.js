/**
 * Google Ads API v17 — server-side proxy
 * Handles OAuth token refresh and GAQL queries.
 * Credentials read from environment variables (set in .env or process.env).
 */

const GOOGLE_ADS_API_VERSION = 'v17';
const GOOGLE_ADS_BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function getCredentials() {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim();
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim() || '';
  if (!developerToken) throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN nao configurado.');
  if (!clientId) throw new Error('GOOGLE_ADS_CLIENT_ID nao configurado.');
  if (!clientSecret) throw new Error('GOOGLE_ADS_CLIENT_SECRET nao configurado.');
  if (!refreshToken) throw new Error('GOOGLE_ADS_REFRESH_TOKEN nao configurado.');
  return { developerToken, clientId, clientSecret, refreshToken, loginCustomerId };
}

async function getAccessToken(creds) {
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: creds.refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || `Erro ao obter access token Google (HTTP ${res.status})`);
  }
  return data.access_token;
}

async function gaqlSearch(customerId, query, accessToken, creds) {
  const cleanId = String(customerId).replace(/-/g, '');
  const url = `${GOOGLE_ADS_BASE_URL}/customers/${cleanId}/googleAds:search`;
  const headers = {
    'content-type': 'application/json',
    'developer-token': creds.developerToken,
    'Authorization': `Bearer ${accessToken}`,
  };
  if (creds.loginCustomerId) {
    headers['login-customer-id'] = String(creds.loginCustomerId).replace(/-/g, '');
  }
  const rows = [];
  let pageToken = null;
  do {
    const body = { query };
    if (pageToken) body.pageToken = pageToken;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || data?.error?.details?.[0]?.errors?.[0]?.message || `Erro Google Ads API HTTP ${res.status}`;
      throw new Error(msg);
    }
    rows.push(...(data.results || []));
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return rows;
}

function microsToBRL(micros) {
  return Number(micros || 0) / 1_000_000;
}

export async function fetchGoogleAdsReport({ customerId, since, until }) {
  if (!customerId) throw new Error('Google Ads Customer ID nao informado.');
  if (!since || !until) throw new Error('Periodo (since/until) nao informado.');

  const creds = getCredentials();
  const accessToken = await getAccessToken(creds);

  // Campaign metrics
  const campaignsQuery = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.ctr,
      metrics.average_cpc,
      metrics.average_cpm,
      metrics.search_impression_share,
      metrics.search_budget_lost_impression_share,
      metrics.search_rank_lost_impression_share
    FROM campaign
    WHERE segments.date BETWEEN '${since}' AND '${until}'
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `.trim();

  // Top keywords by cost
  const keywordsQuery = `
    SELECT
      campaign.name,
      ad_group.name,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.ctr,
      metrics.average_cpc
    FROM keyword_view
    WHERE segments.date BETWEEN '${since}' AND '${until}'
      AND campaign.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
      AND ad_group_criterion.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 30
  `.trim();

  const [campaignRows, keywordRows] = await Promise.all([
    gaqlSearch(customerId, campaignsQuery, accessToken, creds),
    gaqlSearch(customerId, keywordsQuery, accessToken, creds).catch(() => []),
  ]);

  const campaigns = campaignRows.map((r) => {
    const m = r.metrics || {};
    const c = r.campaign || {};
    const spend = microsToBRL(m.costMicros);
    const impressions = Number(m.impressions || 0);
    const clicks = Number(m.clicks || 0);
    const ctr = Number(m.ctr || 0) * 100;
    const cpc = microsToBRL(m.averageCpc);
    const cpm = microsToBRL(m.averageCpm);
    const impressionShare = m.searchImpressionShare != null ? Number(m.searchImpressionShare) * 100 : null;
    const lostBudget = m.searchBudgetLostImpressionShare != null ? Number(m.searchBudgetLostImpressionShare) * 100 : null;
    const lostRank = m.searchRankLostImpressionShare != null ? Number(m.searchRankLostImpressionShare) * 100 : null;
    return {
      id: String(c.id || ''),
      name: c.name || '',
      status: c.status || '',
      channelType: c.advertisingChannelType || '',
      spend,
      impressions,
      clicks,
      ctr,
      cpc,
      cpm,
      impressionShare,
      lostBudget,
      lostRank,
    };
  });

  const keywords = keywordRows.map((r) => {
    const m = r.metrics || {};
    const kw = r.adGroupCriterion?.keyword || {};
    const spend = microsToBRL(m.costMicros);
    const impressions = Number(m.impressions || 0);
    const clicks = Number(m.clicks || 0);
    const ctr = Number(m.ctr || 0) * 100;
    const cpc = microsToBRL(m.averageCpc);
    return {
      text: kw.text || '',
      matchType: kw.matchType || '',
      campaign: r.campaign?.name || '',
      adGroup: r.adGroup?.name || '',
      spend,
      impressions,
      clicks,
      ctr,
      cpc,
    };
  });

  // Aggregate totals
  const totals = campaigns.reduce(
    (acc, c) => {
      acc.spend += c.spend;
      acc.impressions += c.impressions;
      acc.clicks += c.clicks;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0 },
  );
  totals.ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
  totals.cpc = totals.clicks ? totals.spend / totals.clicks : 0;
  totals.cpm = totals.impressions ? (totals.spend / totals.impressions) * 1000 : 0;

  return {
    customerId: String(customerId).replace(/-/g, ''),
    since,
    until,
    campaigns,
    keywords,
    totals,
  };
}
