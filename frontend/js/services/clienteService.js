import { createCrudService } from './baseService.js';

export const clienteService = createCrudService('clientes', 'nome_empresa');

