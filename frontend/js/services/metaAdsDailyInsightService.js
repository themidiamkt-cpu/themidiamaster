import { supabase } from '../supabase.js';

export const metaAdsDailyInsightService = {
  async listRecent(since) {
    let query = supabase
      .from('meta_ads_daily_insights')
      .select('*')
      .order('data', { ascending: false });

    if (since) query = query.gte('data', since);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
};
