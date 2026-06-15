export type Cliente = {
  id: string;
  nome_empresa: string;
  responsavel?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  segmento?: string | null;
  cidade?: string | null;
  estado?: string | null;
  status: 'ativo' | 'pausado' | 'cancelado' | 'prospect';
  plano_contratado?: 'starter' | 'growth' | 'premium' | 'personalizado' | null;
  valor_mensal?: number | null;
  data_entrada?: string | null;
  data_renovacao?: string | null;
  verba_mensal_trafego?: number | null;
  meta_ads_act?: string | null;
  google_ads_id?: string | null;
  instagram?: string | null;
  site?: string | null;
  landing_page?: string | null;
  crm_utilizado?: string | null;
  responsavel_interno?: string | null;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadCrm = {
  id: string;
  nome_empresa: string;
  responsavel?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  instagram?: string | null;
  nicho?: string | null;
  cidade?: string | null;
  estado?: string | null;
  origem_lead?: string | null;
  etapa: 'lead_novo' | 'contato_feito' | 'respondeu' | 'reuniao_marcada' | 'proposta_enviada' | 'follow_up' | 'fechado' | 'perdido';
  dor_principal?: string | null;
  ticket_medio?: number | null;
  investimento_disponivel?: number | null;
  potencial?: 'baixo' | 'medio' | 'alto' | null;
  proxima_acao?: string | null;
  data_proximo_contato?: string | null;
  motivo_perda?: string | null;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
};

export type Campanha = {
  id: string;
  cliente_id?: string | null;
  plataforma: 'meta_ads' | 'google_ads' | 'tiktok_ads' | 'linkedin_ads' | 'outro';
  nome_campanha: string;
  objetivo?: string | null;
  verba_diaria?: number | null;
  verba_mensal?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  status?: 'ativa' | 'pausada' | 'encerrada' | 'teste' | null;
  criativos_utilizados?: string | null;
  publico?: string | null;
  observacoes_otimizacao?: string | null;
  created_at: string;
  updated_at: string;
};

export type Relatorio = {
  id: string;
  cliente_id?: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  investimento: number;
  impressoes: number;
  alcance: number;
  cliques: number;
  ctr: number;
  cpc: number;
  leads: number;
  custo_por_lead: number;
  mensagens: number;
  custo_por_mensagem: number;
  vendas: number;
  faturamento_informado: number;
  roas: number;
  analise_estrategica?: string | null;
  proximos_passos?: string | null;
  meta_ads_act_snapshot?: string | null;
  created_at: string;
  updated_at: string;
};

export type Tarefa = {
  id: string;
  cliente_id?: string | null;
  titulo: string;
  descricao?: string | null;
  responsavel?: string | null;
  prioridade?: 'baixa' | 'media' | 'alta' | 'urgente' | null;
  status?: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada' | null;
  data_vencimento?: string | null;
  concluida_em?: string | null;
  created_at: string;
  updated_at: string;
};

export type OnboardingChecklist = {
  id: string;
  cliente_id: string;
  contrato_assinado: boolean;
  briefing_preenchido: boolean;
  acesso_business_manager: boolean;
  acesso_instagram: boolean;
  acesso_google_ads: boolean;
  pixel_configurado: boolean;
  dominio_verificado: boolean;
  whatsapp_conectado: boolean;
  crm_configurado: boolean;
  primeira_campanha_criada: boolean;
  primeira_reuniao_realizada: boolean;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
};

export type AtivoCliente = {
  id: string;
  cliente_id?: string | null;
  tipo?: 'logo' | 'criativo' | 'video' | 'copy' | 'landing_page' | 'documento' | 'referencia' | 'outro' | null;
  titulo: string;
  url?: string | null;
  descricao?: string | null;
  created_at: string;
  updated_at: string;
};

export type ObservacaoCliente = {
  id: string;
  cliente_id?: string | null;
  autor?: string | null;
  observacao: string;
  tipo?: 'geral' | 'reuniao' | 'estrategia' | 'problema' | 'financeiro' | 'resultado' | null;
  created_at: string;
};

export type Equipe = {
  id: string;
  nome: string;
  email?: string | null;
  cargo?: string | null;
  status?: 'ativo' | 'inativo' | null;
  created_at: string;
  updated_at: string;
};
