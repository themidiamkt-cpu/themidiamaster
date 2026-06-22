import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const mainAdminEmail = 'themidiamkt@gmail.com';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ ok: false, error: 'Metodo nao permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: 'Service role nao configurada.' }, 500);

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ ok: false, error: 'Sessao obrigatoria.' }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: requester, error: requesterError } = await supabase.auth.getUser(token);
    if (requesterError || !requester?.user) return json({ ok: false, error: 'Sessao invalida.' }, 401);
    if (requester.user.email?.toLowerCase() !== mainAdminEmail) {
      return json({ ok: false, error: 'Apenas o admin principal pode criar funcionarios.' }, 403);
    }

    const body = await safeJson(req);
    const nome = String(body.nome || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.senha || body.password || '').trim();
    const cargo = String(body.cargo || '').trim();
    const status = ['ativo', 'inativo'].includes(body.status) ? body.status : 'ativo';
    const funcao = normalizeRole(body.funcao || body.cargo);

    if (!nome) return json({ ok: false, error: 'Nome obrigatorio.' }, 400);
    if (!email || !email.includes('@')) return json({ ok: false, error: 'Email valido obrigatorio.' }, 400);
    if (password.length < 6) return json({ ok: false, error: 'Senha precisa ter pelo menos 6 caracteres.' }, 400);

    const authUser = await upsertAuthUser(supabase, {
      email,
      password,
      nome,
      funcao,
      cargo,
      status,
    });

    const member = await upsertEquipeMember(supabase, {
      auth_user_id: authUser.id,
      nome,
      email,
      cargo,
      status,
      funcao,
    });

    return json({ ok: true, funcionario: member, auth_user_id: authUser.id });
  } catch (error) {
    return json({ ok: false, error: error?.message || 'Erro ao criar funcionario.' }, 500);
  }
});

async function upsertAuthUser(supabase: any, payload: {
  email: string;
  password: string;
  nome: string;
  funcao: string;
  cargo: string;
  status: string;
}) {
  const existing = await findUserByEmail(supabase, payload.email);
  const metadata = {
    nome: payload.nome,
    funcao: payload.funcao,
    cargo: payload.cargo,
    status: payload.status,
  };

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: payload.password,
      user_metadata: metadata,
      app_metadata: { ...existing.app_metadata, funcao: payload.funcao },
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
    user_metadata: metadata,
    app_metadata: { funcao: payload.funcao },
  });
  if (error) throw error;
  return data.user;
}

async function upsertEquipeMember(supabase: any, payload: Record<string, unknown>) {
  const email = String(payload.email || '').toLowerCase();
  const { data: existing, error: findError } = await supabase
    .from('equipe')
    .select('id')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;

  if (existing?.id) {
    const { data, error } = await supabase
      .from('equipe')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('equipe')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function findUserByEmail(supabase: any, email: string) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user: any) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 100) return null;
    page += 1;
  }
  return null;
}

function normalizeRole(value: unknown) {
  const raw = String(value || '').trim().toLowerCase();
  if (['admin', 'operacao'].includes(raw)) return raw;
  return 'gestor_trafego';
}

async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
  });
}
