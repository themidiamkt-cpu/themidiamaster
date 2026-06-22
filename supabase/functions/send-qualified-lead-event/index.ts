import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const graphVersion = 'v20.0';
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
  const token = Deno.env.get('META_ACCESS_TOKEN') || Deno.env.get('META_ADS_ACCESS_TOKEN');
  const pixelId = Deno.env.get('META_PIXEL_ID') || Deno.env.get('META_DATASET_ID');
  const testEventCode = Deno.env.get('META_TEST_EVENT_CODE') || '';

  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: 'Supabase service role nao configurada.' }, 500);
  if (!token || !pixelId) return json({ ok: false, error: 'META_ACCESS_TOKEN ou META_PIXEL_ID nao configurado.' }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await safeJson(req);
    const leadId = String(body.lead_id || body.leadId || '').trim();
    if (!leadId) return json({ ok: false, error: 'lead_id obrigatorio.' }, 400);

    const { data: lead, error: leadError } = await supabase
      .from('leads_crm')
      .select('*')
      .eq('id', leadId)
      .single();
    if (leadError) throw leadError;
    if (!lead) return json({ ok: false, error: 'Lead nao encontrado.' }, 404);
    if (lead.etapa !== 'qualificado') return json({ ok: false, error: 'Lead ainda nao esta qualificado.' }, 409);
    if (lead.meta_qualified_event_sent_at) {
      return json({
        ok: true,
        skipped: true,
        reason: 'Evento de lead qualificado ja enviado.',
        event_id: lead.meta_qualified_event_id,
      });
    }

    const latestLog = await getLatestLeadLog(supabase, lead);
    const payload = latestLog?.payload || {};
    const clickId = extractClickId(payload);
    const eventId = `lead_qualified_${lead.id}`;
    const now = Math.floor(Date.now() / 1000);
    const userData: Record<string, unknown> = {
      external_id: [await sha256(lead.id)],
    };
    const phone = normalizePhone(lead.whatsapp);
    if (phone) userData.ph = [await sha256(phone)];

    const eventPayload: Record<string, unknown> = {
      event_name: 'Lead',
      event_time: now,
      event_id: eventId,
      action_source: 'business_messaging',
      messaging_channel: 'whatsapp',
      user_data: userData,
      custom_data: {
        lead_id: lead.id,
        lead_stage: 'qualificado',
        lead_name: lead.nome_empresa || null,
        origin: lead.origem_lead || null,
        whatsapp: phone || null,
        ctwa_clid: clickId || null,
        previous_stage: body.previous_stage || null,
      },
    };

    const requestBody: Record<string, unknown> = { data: [eventPayload] };
    if (testEventCode) requestBody.test_event_code = testEventCode;

    const metaResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    const metaJson = await metaResponse.json().catch(() => ({}));

    await supabase.from('leads_crm').update({
      meta_qualified_event_id: eventId,
      meta_qualified_event_sent_at: metaResponse.ok ? new Date().toISOString() : null,
      meta_qualified_event_response: {
        ok: metaResponse.ok,
        status: metaResponse.status,
        response: metaJson,
        click_id: clickId || null,
        test_event_code: testEventCode || null,
      },
    }).eq('id', lead.id);

    await supabase.from('crm_webhook_logs').insert({
      method: 'edge_function',
      event: 'meta_lead_qualificado',
      instance: 'the-midia-master',
      remote_jid: lead.whatsapp || null,
      from_me: true,
      action: metaResponse.ok ? 'sent' : 'error',
      lead_id: lead.id,
      payload: {
        event_id: eventId,
        request: requestBody,
        response: metaJson,
        status: metaResponse.status,
      },
      error: metaResponse.ok ? null : JSON.stringify(metaJson).slice(0, 1000),
    });

    if (!metaResponse.ok) {
      return json({ ok: false, error: 'Meta recusou o evento.', status: metaResponse.status, response: metaJson }, 502);
    }

    return json({ ok: true, event_id: eventId, response: metaJson });
  } catch (error) {
    return json({ ok: false, error: error?.message || 'Erro inesperado.' }, 500);
  }
});

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

async function getLatestLeadLog(supabase: any, lead: any) {
  const phone = normalizePhone(lead.whatsapp);
  let query = supabase
    .from('crm_webhook_logs')
    .select('id,payload,received_at,remote_jid')
    .order('received_at', { ascending: false })
    .limit(25);

  if (lead.id) query = query.eq('lead_id', lead.id);
  const { data, error } = await query;
  if (error) throw error;
  if (data?.length) return data[0];

  if (!phone) return null;
  const { data: phoneLogs, error: phoneError } = await supabase
    .from('crm_webhook_logs')
    .select('id,payload,received_at,remote_jid')
    .ilike('remote_jid', `%${phone}%`)
    .order('received_at', { ascending: false })
    .limit(1);
  if (phoneError) throw phoneError;
  return phoneLogs?.[0] || null;
}

function extractClickId(payload: Record<string, any>) {
  const data = payload.data || payload.body || payload;
  const message = data.message || data.messages?.[0]?.message || {};
  return firstFilled(
    payload.ctwa_clid,
    payload.clid,
    payload.click_id,
    payload.referral?.ctwa_clid,
    payload.referral?.clid,
    data.ctwa_clid,
    data.clid,
    data.click_id,
    data.referral?.ctwa_clid,
    data.referral?.clid,
    message.referral?.ctwa_clid,
    message.referral?.clid,
    message.extendedTextMessage?.contextInfo?.externalAdReply?.ctwaClid,
  );
}

function firstFilled(...values: unknown[]) {
  return values.find((value) => String(value || '').trim()) as string | undefined;
}

function normalizePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(String(value || '').trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
