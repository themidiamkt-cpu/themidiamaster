import { createClient } from '@supabase/supabase-js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function authorizedClient(req, clienteId, column) {
  if (!/^[0-9a-f-]{36}$/i.test(String(clienteId || ''))) throw new HttpError(400, 'clienteId invalido.');
  const bearer = /^Bearer (.+)$/i.exec(String(req.headers.authorization || ''))?.[1];
  if (!bearer) throw new HttpError(401, 'Sessao obrigatoria.');
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new HttpError(503, 'Supabase nao configurado.');
  const db = createClient(url, key, { global: { headers: { Authorization: `Bearer ${bearer}` } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await db.auth.getUser(bearer);
  if (authError || !user) throw new HttpError(401, 'Sessao invalida.');
  const { data, error } = await db.from('clientes').select(column === 'id' ? 'id' : `id,${column}`).eq('id', clienteId).maybeSingle();
  if (error) throw new HttpError(503, 'Falha ao verificar acesso ao cliente.');
  if (!data) throw new HttpError(403, 'Acesso ao cliente negado.');
  return data;
}
