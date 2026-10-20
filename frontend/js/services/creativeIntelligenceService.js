// Leitura do Creative Intelligence no Supabase (somente SELECT; a escrita e do Claude/skill ci-*).
// Acesso protegido por RLS: administrador principal le tudo; a equipe le so o que e dos clientes atribuidos.
import { createCrudService } from './baseService.js';

const nichos = createCrudService('ci_nichos', 'nome');
const pesquisas = createCrudService('ci_pesquisas', 'executado_em');
const referencias = createCrudService('ci_referencias', 'created_at');
const conceitos = createCrudService('ci_conceitos', 'created_at');
const conceitoReferencias = createCrudService('ci_conceito_referencias', 'created_at');
const roteiros = createCrudService('ci_roteiros', 'created_at');

export const creativeIntelligenceService = {
  async loadAll() {
    const [n, p, r, c, cr, ro] = await Promise.all([
      nichos.list({ order: 'nome', ascending: true }),
      pesquisas.list({ order: 'executado_em' }),
      referencias.list({ order: 'consultado_em' }),
      conceitos.list({ order: 'updated_at' }),
      conceitoReferencias.list({ order: false }),
      roteiros.list({ order: 'updated_at' }),
    ]);
    return { nichos: n, pesquisas: p, referencias: r, conceitos: c, conceitoReferencias: cr, roteiros: ro };
  },
};
