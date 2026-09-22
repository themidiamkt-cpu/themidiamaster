import { fetchGoogleAdsReport } from '../server/googleAds.js';
import { authorizedClient, HttpError } from '../server/authorizedClient.js';

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
    return res.status(200).json(report);
  } catch (error) {
    return res.status(error.status || 502).json({ error: error.status ? error.message : 'Erro ao consultar Google Ads.' });
  }
}
