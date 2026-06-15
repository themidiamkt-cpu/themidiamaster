import { createCrudService } from './baseService.js';

export const leadCrmService = createCrudService('leads_crm', 'created_at');

leadCrmService.moveStage = (id, etapa) => leadCrmService.update(id, { etapa });

