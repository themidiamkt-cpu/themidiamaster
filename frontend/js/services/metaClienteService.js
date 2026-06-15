import { createCrudService } from './baseService.js';
import { supabase } from '../supabase.js';

export const metaClienteService = {
  ...createCrudService('metas_cliente', 'created_at'),

  async listAtivas() {
    const { data, error } = await supabase
      .from('metas_cliente')
      .select('*, clientes(nome_empresa, meta_ads_act)')
      .eq('ativo', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async listAll() {
    const { data, error } = await supabase
      .from('metas_cliente')
      .select('*, clientes(nome_empresa, meta_ads_act)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async byCliente(clienteId) {
    const { data, error } = await supabase
      .from('metas_cliente')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('objetivo');
    if (error) throw error;
    return data || [];
  },
};
