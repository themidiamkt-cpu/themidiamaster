import { analyzeGbp } from '../server/gbpAnalyze.js';

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

  try {
    const payload = await readBody(req);
    const report = await analyzeGbp(payload);
    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro ao gerar diagnostico GBP.' });
  }
}
