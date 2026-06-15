import { createCrudService } from './baseService.js';
import { supabase } from '../supabase.js';

export const onboardingService = createCrudService('onboarding_checklists', 'created_at');

onboardingService.getByClienteId = async (clienteId) => {
  const { data, error } = await supabase
    .from('onboarding_checklists')
    .select('*')
    .eq('cliente_id', clienteId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

