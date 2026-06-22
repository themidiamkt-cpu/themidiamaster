import { supabase } from '../supabase.js';

export const equipeClienteService = {
  async list() {
    const { data, error } = await supabase
      .from('equipe_clientes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async replaceForMember(equipeId, clienteIds = []) {
    const cleanIds = [...new Set((clienteIds || []).filter(Boolean))];
    const { error: deleteError } = await supabase
      .from('equipe_clientes')
      .delete()
      .eq('equipe_id', equipeId);
    if (deleteError) throw deleteError;

    if (!cleanIds.length) return [];

    const rows = cleanIds.map((clienteId) => ({
      equipe_id: equipeId,
      cliente_id: clienteId,
    }));
    const { data, error } = await supabase
      .from('equipe_clientes')
      .insert(rows)
      .select();
    if (error) throw error;
    return data || [];
  },
};
