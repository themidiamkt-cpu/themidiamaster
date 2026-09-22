import { fetchGoogleAdsReport } from '../server/googleAds.js';
import { authorizedClient, HttpError } from '../server/authorizedClient.js';
import { createClient } from '@supabase/supabase-js';

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido.' });
  }
  if (!/^Bearer .+$/i.test(String(req.headers.authorization || ''))) return res.status(401).json({ error: 'Sessao obrigatoria.' });

  try {
    const payload = await readBody(req);
    const client = await authorizedClient(req, payload.clienteId, 'google_ads_id');
    if (!client.google_ads_id) throw new HttpError(400, 'Cliente sem conta Google Ads.');
    const report = await fetchGoogleAdsReport({ customerId: client.google_ads_id, since: payload.since, until: payload.until });
    if (report.daily.length && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_URL && report.currency) {
      const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { error } = await db.from('google_ads_daily_facts').upsert(report.daily.map((day) => ({
        cliente_id: client.id, customer_id: report.customerId, data: day.date,
        moeda: report.currency, timezone: report.timezone, investimento: day.spend,
        impressoes: day.impressions, cliques: day.clicks, conversoes: day.conversions,
        valor_conversoes: day.conversionValue, cobertura: day.coverage,
        synced_at: report.updatedAt,
      })), { onConflict: 'cliente_id,customer_id,data,moeda' });
      report.historyStatus = error ? 'write_failed' : 'persisted';
    } else {
      report.historyStatus = report.daily.length ? 'not_configured' : 'unavailable';
    }
    return res.status(200).json(report);
  } catch (error) {
    return res.status(error.status || 502).json({ error: error.status ? error.message : 'Erro ao consultar Google Ads.', kind: error.kind || 'report' });
  }
}
