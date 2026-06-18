import { supabase } from '../supabase.js';

export const metaAdsAccountHealthService = {
  async listLatest() {
    const { data, error } = await supabase
      .from('meta_ads_account_health')
      .select('*')
      .order('checked_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
};
