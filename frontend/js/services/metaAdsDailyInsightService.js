import { supabase } from '../supabase.js';

export const metaAdsDailyInsightService = {
  async listRecent(since) {
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      let query = supabase.from('meta_ads_facts').select('*').eq('nivel', 'account').order('data', { ascending: false }).order('synced_at', { ascending: false }).range(offset, offset + 999);
      if (since) query = query.gte('data', since);
      const { data, error } = await query;
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return rows.map((row) => ({ ...row, objetivo: row.objetivo_snapshot, synced_at: row.synced_at }));
  },
  async listLegacyRecent(since) {
    let query = supabase.from('meta_ads_daily_insights').select('*').order('data', { ascending: false });
    if (since) query = query.gte('data', since);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
};
