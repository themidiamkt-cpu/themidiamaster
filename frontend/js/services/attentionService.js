import { supabase } from '../supabase.js';

export const attentionService = {
  async evaluate(clienteId = null) {
    const { data, error } = await supabase.functions.invoke('attention-evaluate', { body: clienteId ? { cliente_id: clienteId } : {} });
    if (error || !data?.ok) throw new Error(data?.error || 'Falha na avaliação de atenção.');
    return data;
  },
  async setStatus(id, status, extra = {}) {
    if (!['ativo', 'reconhecido', 'adiado', 'resolvido'].includes(status)) throw new Error('Status inválido.');
    const patch = { status, ...extra };
    const { data, error } = await supabase.from('alertas_anomalia').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async createTaskOnce(id, task) {
    const { data, error } = await supabase.rpc('create_alert_task_once', {
      p_alerta_id: id, p_titulo: task.titulo, p_descricao: task.descricao,
      p_responsavel: task.responsavel, p_prioridade: task.prioridade,
      p_data_vencimento: task.data_vencimento,
    });
    if (error) throw error;
    return data;
  },
  async addIntervention(row) {
    const { data, error } = await supabase.from('alerta_intervencoes').insert(row).select().single();
    if (error) throw error;
    return data;
  },
  async listInterventions() {
    const { data, error } = await supabase.from('alerta_intervencoes').select('*').order('executado_em', { ascending: false }).limit(300);
    if (error) throw error;
    return data || [];
  },
};
