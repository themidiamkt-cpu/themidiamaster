import { createCrudService } from './baseService.js';
import { supabase } from '../supabase.js';

export const alertaAnomaliaService = {
  ...createCrudService('alertas_anomalia', 'created_at'),

  async listAtivos() {
    const { data, error } = await supabase
      .from('alertas_anomalia')
      .select('*, clientes(nome_empresa)')
      .eq('status', 'ativo')
      .order('severidade', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async listAll() {
    const { data, error } = await supabase
      .from('alertas_anomalia')
      .select('*, clientes(nome_empresa)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return data || [];
  },

  async resolver(id, email) {
    const { data, error } = await supabase
      .from('alertas_anomalia')
      .update({ status: 'resolvido', resolvido_em: new Date().toISOString(), resolvido_por: email })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async ignorar(id) {
    const { data, error } = await supabase
      .from('alertas_anomalia')
      .update({ status: 'ignorado' })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
