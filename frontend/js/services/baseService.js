import { supabase } from '../supabase.js';

export function createCrudService(table, defaultOrder = 'created_at') {
  return {
    async list(options = {}) {
      const columns = options.columns || '*';
      let query = supabase.from(table).select(columns);
      if (options.eq) {
        Object.entries(options.eq).forEach(([key, value]) => {
          query = value === null ? query.is(key, null) : query.eq(key, value);
        });
      }
      if (options.in) {
        Object.entries(options.in).forEach(([key, value]) => {
          query = query.in(key, value);
        });
      }
      if (options.order !== false) {
        query = query.order(options.order || defaultOrder, { ascending: options.ascending ?? false });
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async getById(id, columns = '*') {
      const { data, error } = await supabase.from(table).select(columns).eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async create(payload) {
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, payload) {
      const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  };
}

