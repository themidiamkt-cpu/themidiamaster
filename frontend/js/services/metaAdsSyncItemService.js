import { supabase } from '../supabase.js';

export const metaAdsSyncItemService = {
  async listRecent() {
    const { data, error } = await supabase.from('meta_ads_sync_items')
      .select('id,run_id,cliente_id,meta_ads_act,period_since,period_until,status,started_at,finished_at,expected_days,queried_days,no_delivery_days,missing_days,account_rows,campaign_rows,ad_rows,facts_written,health_status,error_code')
      .order('started_at', { ascending: false }).limit(500);
    if (error) throw error;
    return data || [];
  },
  async reprocess(clienteId, since, until) {
    const { data, error } = await supabase.functions.invoke('request-meta-ads-reprocess', {
      body: { cliente_id: clienteId, since, until },
    });
    if (error || !data?.ok) {
      const details = await error?.context?.json?.().catch(() => ({}));
      throw new Error(data?.error_code || details?.error_code || 'Reprocessamento incompleto. Consulte o status da sincronização.');
    }
    return data;
  },
};
