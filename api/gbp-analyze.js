import { analyzeGbp } from '../server/gbpAnalyze.js';
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
    await authorizedClient(req, payload.clienteId, 'id');
    const report = await analyzeGbp(payload);
    return res.status(200).json(report);
  } catch (error) {
    return res.status(error.status || 502).json({ error: error.status ? error.message : 'Erro ao gerar diagnostico GBP.' });
  }
}
