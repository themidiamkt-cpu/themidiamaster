import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const forwardWebhookUrl = 'https://automacao2.themidiamarketing.com.br/webhook/the-midia-master';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return response({ ok: true });
  if (req.method !== 'POST') return response({ ok: false, error: 'Metodo nao permitido.' }, 405);

  let supabase: any = null;
  let logId: string | null = null;

  try {
    const payload = await safeJson(req);
    await forwardIncomingPayload(req, payload);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL ou SERVICE_ROLE_KEY nao configurado.');

    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    logId = await createWebhookLog(supabase, req, payload);

    validateSecret(req, payload);

    const normalized = normalizeLeadPayload(payload);
    if (normalized.ignore) {
      await updateWebhookLog(supabase, logId, { action: 'ignored', error: normalized.ignore });
      return response({ ok: true, ignored: true, reason: normalized.ignore });
    }

    const existingLead = await findOpenLead(supabase, normalized);
    if (existingLead) {
      const responsePatch = normalized.from_me ? {} : {
        ultima_interacao: new Date().toISOString(),
        aguardando_resposta_manual: true,
      };
      const { data, error } = await supabase
        .from('leads_crm')
        .update({
          responsavel: normalized.responsavel || existingLead.responsavel,
          whatsapp: normalized.whatsapp || existingLead.whatsapp,
          instagram: normalized.instagram || existingLead.instagram,
          origem_lead: normalized.origem_lead || existingLead.origem_lead,
          proxima_acao: 'Responder WhatsApp',
          observacoes: mergeNotes(existingLead.observacoes, normalized.observacoes),
          ...responsePatch,
        })
        .eq('id', existingLead.id)
        .select('id,nome_empresa,whatsapp,etapa')
        .single();
      if (error) throw error;
      await updateWebhookLog(supabase, logId, { action: 'updated', lead_id: data.id });
      return response({ ok: true, action: 'updated', lead: data });
    }

    const { data, error } = await supabase
      .from('leads_crm')
      .insert({
        nome_empresa: normalized.nome_empresa,
        responsavel: normalized.responsavel,
        whatsapp: normalized.whatsapp,
        email: normalized.email,
        instagram: normalized.instagram,
        nicho: normalized.nicho,
        cidade: normalized.cidade,
        estado: normalized.estado,
        origem_lead: normalized.origem_lead,
        etapa: 'lead_novo',
        potencial: normalized.potencial,
        proxima_acao: 'Responder WhatsApp',
        observacoes: normalized.observacoes,
        ultima_interacao: normalized.from_me ? null : new Date().toISOString(),
        aguardando_resposta_manual: !normalized.from_me,
      })
      .select('id,nome_empresa,whatsapp,etapa')
      .single();
    if (error) throw error;

    await updateWebhookLog(supabase, logId, { action: 'created', lead_id: data.id });
    return response({ ok: true, action: 'created', lead: data });
  } catch (error) {
    await updateWebhookLog(supabase, logId, { action: 'error', error: error?.message || 'Erro inesperado.' });
    return response({ ok: false, error: error?.message || 'Erro inesperado.' }, 500);
  }
});

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
  });
}

async function forwardIncomingPayload(req: Request, payload: Record<string, any>) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const forwardedHeaders = Object.fromEntries(
      Array.from(req.headers.entries()).filter(([key]) => !['authorization', 'apikey'].includes(key.toLowerCase()))
    );
    const res = await fetch(forwardWebhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        forwarded_from: 'supabase.receber-lead-crm',
        forwarded_at: new Date().toISOString(),
        request: {
          method: req.method,
          url: req.url,
          headers: forwardedHeaders,
        },
        payload,
      }),
    });
    clearTimeout(timeout);
    if (!res.ok) console.error('crm forward webhook failed', res.status, await res.text());
  } catch (error) {
    console.error('crm forward webhook error', error?.message || error);
  }
}

async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function validateSecret(req: Request, payload: Record<string, any>) {
  const configured = Deno.env.get('LEAD_WEBHOOK_SECRET') || '';
  if (!configured) return;
  const url = new URL(req.url);
  const provided = req.headers.get('x-webhook-secret') || url.searchParams.get('secret') || payload.secret || '';
  if (provided !== configured) throw new Error('Secret do webhook invalido.');
}

async function createWebhookLog(supabase: any, req: Request, payload: Record<string, any>) {
  const meta = payloadMeta(payload);
  const { data, error } = await supabase
    .from('crm_webhook_logs')
    .insert({
      method: req.method,
      event: meta.event,
      instance: meta.instance,
      remote_jid: meta.remoteJid,
      from_me: meta.fromMe,
      action: 'received',
      payload,
    })
    .select('id')
    .single();
  if (error) console.error('crm_webhook_logs insert failed', error);
  return data?.id || null;
}

async function updateWebhookLog(supabase: any, id: string | null, patch: Record<string, unknown>) {
  if (!supabase || !id) return;
  const { error } = await supabase.from('crm_webhook_logs').update(patch).eq('id', id);
  if (error) console.error('crm_webhook_logs update failed', error);
}

function payloadMeta(payload: Record<string, any>) {
  const data = payload.data || payload.body || payload;
  const key = data.key || payload.key || {};
  return {
    event: String(payload.event || payload.type || data.event || data.messageType || '').slice(0, 120) || null,
    instance: String(payload.instance || data.instance || '').slice(0, 120) || null,
    remoteJid: String(key.remoteJid || data.remoteJid || data.from || payload.remoteJid || payload.from || '').slice(0, 160) || null,
    fromMe: Boolean(key.fromMe || data.fromMe || payload.fromMe),
  };
}

function normalizeLeadPayload(payload: Record<string, any>) {
  const data = payload.data || payload.body || payload;
  const key = data.key || payload.key || {};
  const remoteJid = key.remoteJid || data.remoteJid || data.from || payload.remoteJid || payload.from || '';
  const fromMe = Boolean(key.fromMe || data.fromMe || payload.fromMe);
  const isGroup = String(remoteJid).includes('@g.us');
  const isBroadcast = String(remoteJid).includes('status@broadcast');
  if (isGroup) return { ignore: 'Mensagem de grupo ignorada.' };
  if (isBroadcast) return { ignore: 'Status/broadcast ignorado.' };

  const messageText = extractMessageText(data) || extractMessageText(payload);
  const rawPhone = firstFilled(
    payload.whatsapp,
    payload.phone,
    payload.telefone,
    payload.remoteJid,
    data.whatsapp,
    data.phone,
    data.remoteJid,
    data.sender,
    data.participant,
    remoteJid
  );
  const whatsapp = normalizePhone(rawPhone);
  const explicitName = firstFilled(
    payload.nome_empresa,
    payload.empresa,
    payload.nome,
    data.nome_empresa,
    data.empresa
  );
  const remoteContactName = firstFilled(
    payload.contactName,
    payload.contact_name,
    payload.receiverName,
    payload.receiver_name,
    payload.chatName,
    payload.chat_name,
    data.contactName,
    data.contact_name,
    data.receiverName,
    data.receiver_name,
    data.chatName,
    data.chat_name,
    data.verifiedBizName,
    data.notifyName
  );
  const inboundName = firstFilled(
    payload.name,
    data.name,
    data.pushName,
    data.senderName
  );
  const name = sanitizeLeadName(
    fromMe
      ? firstFilled(explicitName, remoteContactName, whatsapp ? `Lead ${whatsapp}` : '')
      : firstFilled(explicitName, inboundName, whatsapp ? `Lead ${whatsapp}` : '')
  );
  const responsavel = firstFilled(payload.responsavel, payload.contato, data.pushName, data.senderName, data.name, name);
  const origin = fromMe
    ? 'WhatsApp - Prospeccao ativa'
    : firstFilled(payload.origem_lead, payload.origem, payload.source, data.origem_lead, data.source, payload.event, 'WhatsApp');
  const sourceLine = payload.event || payload.type || data.messageType || 'webhook';
  const notes = [
    messageText ? `Mensagem: ${messageText}` : '',
    sourceLine ? `Evento: ${sourceLine}` : '',
    payload.instance ? `Instancia: ${payload.instance}` : '',
    fromMe ? 'Direcao: mensagem enviada pela equipe' : 'Direcao: mensagem recebida do contato',
  ].filter(Boolean).join('\n');

  return {
    nome_empresa: String(name || (whatsapp ? `Lead ${whatsapp}` : 'Lead WhatsApp')).slice(0, 160),
    responsavel: String(responsavel || '').slice(0, 160) || null,
    whatsapp,
    email: firstFilled(payload.email, data.email) || null,
    instagram: firstFilled(payload.instagram, data.instagram) || null,
    nicho: firstFilled(payload.nicho, payload.segmento, data.nicho, data.segmento) || null,
    cidade: firstFilled(payload.cidade, data.cidade) || null,
    estado: firstFilled(payload.estado, data.estado) || null,
    origem_lead: String(origin || 'WhatsApp').slice(0, 80),
    potencial: normalizePotential(firstFilled(payload.potencial, data.potencial)),
    observacoes: notes || JSON.stringify(payload).slice(0, 1800),
    from_me: fromMe,
  };
}

function extractMessageText(source: Record<string, any>) {
  const message = source.message || source.messages?.[0]?.message || {};
  return firstFilled(
    source.text,
    source.messageText,
    source.conversation,
    message.conversation,
    message.extendedTextMessage?.text,
    message.imageMessage?.caption,
    message.videoMessage?.caption,
    message.documentMessage?.caption,
    source.messages?.[0]?.text
  );
}

function firstFilled(...values: unknown[]) {
  return values.find((value) => String(value || '').trim()) as string | undefined;
}

function sanitizeLeadName(value: unknown) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  const agencyNames = ['roberto moura the midia marketing', 'the midia marketing', 'the midia'];
  if (agencyNames.includes(clean.toLowerCase())) return '';
  return clean;
}

function normalizePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.length > 13 ? digits.slice(0, 13) : digits;
}

function normalizePotential(value: unknown) {
  const clean = String(value || '').toLowerCase().trim();
  return ['baixo', 'medio', 'alto'].includes(clean) ? clean : null;
}

async function findOpenLead(supabase: any, lead: any) {
  if (!lead.whatsapp && !lead.email && !lead.instagram) return null;
  let query = supabase
    .from('leads_crm')
    .select('id,nome_empresa,responsavel,whatsapp,instagram,origem_lead,etapa,observacoes')
    .not('etapa', 'in', '("fechado","perdido")')
    .order('created_at', { ascending: false })
    .limit(1);

  if (lead.whatsapp) query = query.eq('whatsapp', lead.whatsapp);
  else if (lead.email) query = query.eq('email', lead.email);
  else query = query.eq('instagram', lead.instagram);

  const { data, error } = await query;
  if (error) throw error;
  return data?.[0] || null;
}

function mergeNotes(current: string | null, incoming: string | null) {
  const now = new Date().toISOString();
  const addition = incoming ? `[${now}]\n${incoming}` : `[${now}] Novo contato recebido via webhook.`;
  return [current, addition].filter(Boolean).join('\n\n').slice(0, 8000);
}
