import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { authorizedClient, HttpError } from '../server/authorizedClient.js';

const clienteA = '00000000-0000-4000-8000-000000000001';
const clienteB = '00000000-0000-4000-8000-000000000002';

test('private endpoint rejects anonymous request', async () => {
  await assert.rejects(authorizedClient({ headers: {} }, clienteA, 'google_ads_id'), (error) => error instanceof HttpError && error.status === 401);
});

test('manager A cannot resolve account registered to client B', async () => {
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url.startsWith('/auth/v1/user')) return res.end(JSON.stringify({ id: 'manager-a', aud: 'authenticated', role: 'authenticated' }));
    if (req.url.startsWith('/rest/v1/clientes')) return res.end(req.url.includes(clienteA) ? JSON.stringify([{ id: clienteA, google_ads_id: '1234567890' }]) : '[]');
    res.statusCode = 404;
    res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.SUPABASE_ANON_KEY = 'test-public-key';
  try {
    const client = await authorizedClient({ headers: { authorization: 'Bearer valid-test-jwt' } }, clienteA, 'google_ads_id');
    assert.equal(client.google_ads_id, '1234567890');
    await assert.rejects(authorizedClient({ headers: { authorization: 'Bearer valid-test-jwt' } }, clienteB, 'google_ads_id'), (error) => error.status === 403);
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
    server.close();
  }
});
