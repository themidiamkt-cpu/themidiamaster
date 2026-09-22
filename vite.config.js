import { defineConfig, loadEnv } from 'vite';
import { analyzeGbp } from './server/gbpAnalyze.js';
import { fetchGoogleAdsReport } from './server/googleAds.js';
import { authorizedClient, HttpError } from './server/authorizedClient.js';

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function jsonResponse(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const name of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GOOGLE_MAPS_API_KEY', 'GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_LOGIN_CUSTOMER_ID']) {
    if (!process.env[name] && env[name]) process.env[name] = env[name];
  }
  return {
  root: 'frontend',
  server: {
    host: '0.0.0.0',
  },
  plugins: [{
    name: 'the-midia-local-api',
    configureServer(server) {
      server.middlewares.use('/api/gbp-analyze', async (req, res) => {
        if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Metodo nao permitido.' });
        if (!/^Bearer .+$/i.test(String(req.headers.authorization || ''))) return jsonResponse(res, 401, { error: 'Sessao obrigatoria.' });
        try {
          const payload = await readBody(req);
          await authorizedClient(req, payload.clienteId, 'id');
          const report = await analyzeGbp(payload);
          jsonResponse(res, 200, report);
        } catch (error) {
          jsonResponse(res, error.status || 502, { error: error.status ? error.message : 'Erro ao gerar diagnostico GBP.' });
        }
      });

      server.middlewares.use('/api/google-ads', async (req, res) => {
        if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Metodo nao permitido.' });
        if (!/^Bearer .+$/i.test(String(req.headers.authorization || ''))) return jsonResponse(res, 401, { error: 'Sessao obrigatoria.' });
        try {
          const payload = await readBody(req);
          const client = await authorizedClient(req, payload.clienteId, 'google_ads_id');
          if (!client.google_ads_id) throw new HttpError(400, 'Cliente sem conta Google Ads.');
          const report = await fetchGoogleAdsReport({ customerId: client.google_ads_id, since: payload.since, until: payload.until });
          jsonResponse(res, 200, report);
        } catch (error) {
          jsonResponse(res, error.status || 502, { error: error.status ? error.message : 'Erro ao consultar Google Ads.' });
        }
      });
    },
  }],
  };
});
