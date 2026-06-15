import { defineConfig } from 'vite';
import { analyzeGbp } from './server/gbpAnalyze.js';
import { fetchGoogleAdsReport } from './server/googleAds.js';

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

export default defineConfig({
  root: 'frontend',
  server: {
    host: '0.0.0.0',
  },
  plugins: [{
    name: 'the-midia-local-api',
    configureServer(server) {
      server.middlewares.use('/api/gbp-analyze', async (req, res) => {
        if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Metodo nao permitido.' });
        try {
          const payload = await readBody(req);
          const report = await analyzeGbp(payload);
          jsonResponse(res, 200, report);
        } catch (error) {
          jsonResponse(res, 500, { error: error.message || 'Erro ao gerar diagnostico GBP.' });
        }
      });

      server.middlewares.use('/api/google-ads', async (req, res) => {
        if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Metodo nao permitido.' });
        try {
          const payload = await readBody(req);
          const report = await fetchGoogleAdsReport(payload);
          jsonResponse(res, 200, report);
        } catch (error) {
          jsonResponse(res, 500, { error: error.message || 'Erro ao consultar Google Ads.' });
        }
      });
    },
  }],
});
