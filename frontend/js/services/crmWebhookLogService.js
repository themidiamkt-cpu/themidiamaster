import { supabase } from '../supabase.js';

export const crmWebhookLogService = {
  async listRecent(limit = 500) {
    const { data, error } = await supabase
      .from('crm_webhook_logs')
      .select('id, received_at, event, instance, remote_jid, from_me, action, lead_id, error, payload')
      .order('received_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};
