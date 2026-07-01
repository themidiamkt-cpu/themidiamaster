import { ensureSession, isSupabaseConfigured, supabase } from './supabase.js';
import { clienteService } from './services/clienteService.js';
import { leadCrmService } from './services/leadCrmService.js';
import { campanhaService } from './services/campanhaService.js';
import { relatorioService } from './services/relatorioService.js';
import { tarefaService } from './services/tarefaService.js';
import { onboardingService } from './services/onboardingService.js';
import { ativoClienteService } from './services/ativoClienteService.js';
import { observacaoClienteService } from './services/observacaoClienteService.js';
import { equipeService } from './services/equipeService.js';
import { equipeClienteService } from './services/equipeClienteService.js';
import { diarioBordoService } from './services/diarioBordoService.js';
import { alertaAnomaliaService } from './services/alertaAnomaliaService.js';
import { metaClienteService } from './services/metaClienteService.js';
import { vendaClienteService } from './services/vendaClienteService.js';
import { metaAdsDailyInsightService } from './services/metaAdsDailyInsightService.js';
import { metaAdsAccountHealthService } from './services/metaAdsAccountHealthService.js';
import { gmnAnaliseService } from './services/gmnAnaliseService.js';
import { crmWebhookLogService } from './services/crmWebhookLogService.js';
import { confirmDelete, date, emptyState, escapeHtml, label, loadingState, money, number, pageHeader, renderLucide, statCard, statusBadge, toast } from './components/ui.js';

const app = document.getElementById('app');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalForm = document.getElementById('modalForm');
const modalTitle = document.getElementById('modalTitle');
const modalEyebrow = document.getElementById('modalEyebrow');
const initialMetaDateRange = getDefaultDateRange();
const fixedMetaAccessToken = 'EAAKJkRH2esoBRc0EFaZAkKc3TrzQZC6YZCmWP0tj4b7EdZBAaXL9NZCFtMUypWqZBjzMVRyOyzwh3ItVTs8bgyl16uFcIiWvDHB8GjxxcPWji6FC3NwTqqvnlrZBE3dFG2ZA7eNZBLGbtZCQHDZBx0SZAyHIS1dcSSPtQJNKuLmWC9JtmWhsCLOZCD3uZBAdmuZCEZA0rYzvCgZDZD';
const fixedGoogleMapsApiKey = 'AIzaSyAyH7teIp1Xjprln7TaA1i_dIY8TB0_HgE';
const whatsappWebhookUrl = 'https://automacao2.themidiamarketing.com.br/webhook/conectar-cliente';
const mainAdminEmail = 'themidiamkt@gmail.com';
const viewStorageKey = 'theMidiaMaster.activeView';
const adminViews = ['dashboard', 'dashboardClientes', 'clientes', 'relatorios', 'crm', 'crmFollowups', 'metaAds', 'gbp', 'diario', 'tarefas', 'playbooks', 'equipe', 'metas', 'alertas', 'config'];
const trafficManagerViews = ['dashboardClientes', 'clientes', 'metaAds', 'gbp', 'diario', 'tarefas', 'playbooks', 'metas', 'alertas'];
const teamViews = trafficManagerViews;
let googlePlacesLoader = null;
let googlePlacesMap = null;

const state = {
  view: getStoredView() || 'dashboard',
  taskDetailId: null,
  activeConversationLeadId: null,
  crmSearch: '',
  taskView: 'hoje',
  taskResponsibleFilter: 'all',
  taskDoneExpanded: {},
  clientes: [],
  leads: [],
  crmWebhookLogs: [],
  crmWebhookLogsMissingTable: false,
  campanhas: [],
  relatorios: [],
  vendas: [],
  vendasMissingTable: false,
  metaAdsDailyInsights: [],
  metaAdsDailyInsightsMissingTable: false,
  metaAdsAccountHealth: [],
  metaAdsAccountHealthMissingTable: false,
  gmnAnalises: [],
  gmnAnalisesMissingTable: false,
  dashboardClientesClienteId: 'all',
  dashboardClientesOrigem: 'all',
  tarefas: [],
  diarios: [],
  diarioMissingTable: false,
  equipe: [],
  equipeClientes: [],
  metas: [],
  metaRowDrafts: {},
  alertas: [],
  alertasMissingTable: false,
  alertasFiltroStatus: 'ativo',
  alertasFiltroSeveridade: 'all',
  detailClienteId: null,
  detailRelatorioId: null,
  detailTab: 'visao',
  diarioSelectedClienteId: null,
  diarioDate: isoDate(new Date()),
  session: null,
  loadError: '',
  lastSavedRelatorioId: null,
  clientMetaCosts: {
    loading: false,
    loaded: false,
    error: '',
    byClienteId: {},
  },
  metaAds: {
    token: fixedMetaAccessToken,
    since: initialMetaDateRange.since,
    until: initialMetaDateRange.until,
    clienteId: '',
    goal: 'mensagens',
    tableMode: 'weekly',
    loading: false,
    error: '',
    report: null,
    viewMode: 'cards',
    tab: 'consulta',
  },
  gbp: {
    clienteId: '',
    businessQuery: '',
    keyword: '',
    radiusKm: 3,
    gridSize: 5,
    searchCenter: '',
    searchRadiusMeters: '',
    loading: false,
    error: '',
    report: null,
    tab: 'nova',
    selectedSavedId: null,
  },
  googleAds: {
    loading: false,
    error: '',
    report: null,
  },
  whatsapp: getStoredWhatsAppConfig(),
};

const crmStages = ['lead_novo', 'respondeu', 'qualificado', 'reuniao_marcada', 'proposta_enviada', 'fechado', 'perdido'];
const crmActiveStages = crmStages.filter((stage) => !['fechado', 'perdido'].includes(stage));
const defaultFollowupCadence = {
  lead_novo: [1, 3, 7],
  respondeu: [1, 3],
  qualificado: [2, 4],
  reuniao_marcada: [1, 2],
  proposta_enviada: [2, 3, 5],
};
const onboardingFields = ['contrato_assinado', 'briefing_preenchido', 'acesso_business_manager', 'acesso_instagram', 'acesso_google_ads', 'pixel_configurado', 'dominio_verificado', 'whatsapp_conectado', 'crm_configurado', 'primeira_campanha_criada', 'primeira_reuniao_realizada'];
const weekDayLabels = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
const legacyMetaAdsClients = [
  { nome_empresa: 'Zin Bar', meta_ads_act: 'act_712213988136898', segmento: 'Restaurante', status: 'ativo', plano_contratado: 'personalizado', observacoes: 'Objetivo Meta Ads: mensagens.' },
  { nome_empresa: 'Garden Bar', meta_ads_act: 'act_4377679522276466', segmento: 'Restaurante', status: 'ativo', plano_contratado: 'personalizado', observacoes: 'Objetivo Meta Ads: mensagens.' },
  { nome_empresa: 'Mimagi Kids', meta_ads_act: 'act_1408009703942299', segmento: 'Infantil', status: 'ativo', plano_contratado: 'personalizado', observacoes: 'Objetivo Meta Ads: mensagens.' },
  { nome_empresa: 'NV Store', meta_ads_act: 'act_3507325512866320', segmento: 'E-commerce', status: 'ativo', plano_contratado: 'personalizado', observacoes: 'Objetivo Meta Ads: vendas.' },
  { nome_empresa: 'Trokai', meta_ads_act: 'act_1098617837158131', segmento: 'E-commerce', status: 'ativo', plano_contratado: 'personalizado', observacoes: 'Objetivo Meta Ads: vendas.' },
  { nome_empresa: 'Audrei', meta_ads_act: 'act_1077580320653450', segmento: 'Servicos', status: 'ativo', plano_contratado: 'personalizado', observacoes: 'Objetivo Meta Ads: mensagens.' },
  { nome_empresa: 'The Midia', meta_ads_act: 'act_1590429088125895', segmento: 'Agencia', status: 'ativo', plano_contratado: 'personalizado', observacoes: 'Objetivo Meta Ads: leads.' },
];
const metaGoalConfig = {
  mensagens: {
    label: 'Mensagens',
    metricLabel: 'Mensagens',
    costLabel: 'Custo/mensagem',
    shortCostLabel: 'R$/MSG',
    actionTypes: ['onsite_conversion.messaging_conversation_started_7d', 'messaging_conversation_started_7d', 'messenger_conversation_started_7d'],
  },
  vendas: {
    label: 'Vendas',
    metricLabel: 'Vendas',
    costLabel: 'Custo/venda',
    shortCostLabel: 'R$/VENDA',
    actionTypes: ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'],
  },
  leads: {
    label: 'Leads',
    metricLabel: 'Leads',
    costLabel: 'Custo/lead',
    shortCostLabel: 'R$/LEAD',
    actionTypes: ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'],
  },
  seguidores: {
    label: 'Seguidores',
    metricLabel: 'Seguidores no Instagram',
    costLabel: 'Custo/seguidor',
    shortCostLabel: 'R$/SEG.',
    actionTypes: ['instagram_profile_follow', 'onsite_conversion.follow', 'follow', 'page_fan_adds'],
  },
};

const services = {
  clientes: clienteService,
  crm: leadCrmService,
  campanhas: campanhaService,
  relatorios: relatorioService,
  tarefas: tarefaService,
  diario: diarioBordoService,
  equipe: equipeService,
};

let initialized = false;
let crmRealtimeChannel = null;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
document.addEventListener('click', handleNavActivation, true);
document.addEventListener('pointerdown', handleNavActivation, true);
document.getElementById('mobileToggle')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('open'));
document.getElementById('logoutButton')?.addEventListener('click', logout);
document.getElementById('modalClose')?.addEventListener('click', closeModal);
modalBackdrop?.addEventListener('click', (event) => {
  if (event.target === modalBackdrop) closeModal();
});

async function init() {
  if (initialized) return;
  initialized = true;
  await loadAll();
  setupCrmRealtime();
  render();
}

function handleNavActivation(event) {
  const item = event.target.closest?.('.nav-item[data-view]');
  if (!item || item.disabled || item.hidden) return;
  event.preventDefault();
  event.stopPropagation();
  navigate(item.dataset.view);
}

async function loadAll() {
  app.innerHTML = loadingState('Sincronizando com Supabase...');
  renderLucide();
  state.loadError = '';
  if (!isSupabaseConfigured) {
    render();
    return;
  }

  try {
    state.session = await withTimeout(
      ensureSession(),
      8000,
      'Nao foi possivel confirmar a sessao no Supabase. Verifique a conexao e tente atualizar.'
    );
    if (!state.session) {
      render();
      return;
    }

    if (!canAccessView(state.view)) state.view = getDefaultView();

    if (isMainAdmin()) {
      const dashboardRange = getFourWeeksRange();
      const [clientes, leads, crmWebhookLogs, campanhas, relatorios, vendas, metaAdsDailyInsights, metaAdsAccountHealth, gmnAnalises, tarefas, diarios, equipe, equipeClientes, alertas, metas] = await withTimeout(Promise.all([
        clienteService.list({ order: 'nome_empresa', ascending: true }),
        leadCrmService.list(),
        safeCrmWebhookLogsList(),
        campanhaService.list({ columns: '*, clientes(nome_empresa, meta_ads_act)' }),
        relatorioService.list({ columns: '*, clientes(nome_empresa, meta_ads_act)' }),
        safeVendasList(),
        safeMetaAdsDailyInsightsList(dashboardRange.since),
        safeMetaAdsAccountHealthList(),
        safeGmnAnalisesList(),
        tarefaService.list({ columns: '*, clientes(nome_empresa)' }),
        safeDiaryList(),
        equipeService.list({ order: 'nome', ascending: true }),
        safeEquipeClientesList(),
        safeAlertasList(),
        safeList(() => metaClienteService.listAll()),
      ]), 12000, 'O Supabase demorou para carregar os dados. Mostrando o painel em modo vazio ate atualizar.');
      Object.assign(state, { clientes, leads, crmWebhookLogs, campanhas, relatorios, vendas, metaAdsDailyInsights, metaAdsAccountHealth, gmnAnalises, tarefas, diarios, equipe, equipeClientes, alertas, metas });
      updateAlertasBadge();
      setupCrmRealtime();
      return;
    }

    const dashboardRange = getFourWeeksRange();
    const [clientes, relatorios, vendas, metaAdsDailyInsights, metaAdsAccountHealth, gmnAnalises, tarefas, diarios, alertas, metas] = await withTimeout(Promise.all([
      clienteService.list({ order: 'nome_empresa', ascending: true }),
      relatorioService.list({ columns: '*, clientes(nome_empresa, meta_ads_act)' }),
      safeVendasList(),
      safeMetaAdsDailyInsightsList(dashboardRange.since),
      safeMetaAdsAccountHealthList(),
      safeGmnAnalisesList(),
      tarefaService.list({ columns: '*, clientes(nome_empresa)' }),
      safeDiaryList(),
      safeAlertasList(),
      safeList(() => metaClienteService.listAll()),
    ]), 12000, 'O Supabase demorou para carregar os dados. Mostrando o painel em modo vazio ate atualizar.');
    const scoped = scopeDataToVisibleClients({ clientes, relatorios, vendas, metaAdsDailyInsights, metaAdsAccountHealth, gmnAnalises, tarefas, diarios, alertas, metas });
    Object.assign(state, { ...scoped, leads: [], crmWebhookLogs: [], campanhas: [], equipe: [], equipeClientes: [] });
    updateAlertasBadge();
    teardownCrmRealtime();
  } catch (error) {
    state.loadError = error.message || 'Nao foi possivel carregar os dados do Supabase.';
    showError(error);
  }
}

async function safeList(loader) {
  try {
    return await loader();
  } catch (error) {
    if (['42P01', 'PGRST205'].includes(error.code)) return [];
    throw error;
  }
}

async function safeEquipeClientesList() {
  try {
    return await equipeClienteService.list();
  } catch (error) {
    if (['42P01', 'PGRST205'].includes(error?.code) || String(error?.message || '').includes('equipe_clientes')) return [];
    throw error;
  }
}

function scopeDataToVisibleClients(data) {
  const visibleClientIds = new Set((data.clientes || []).map((cliente) => cliente.id));
  const byClient = (row) => row?.cliente_id && visibleClientIds.has(row.cliente_id);
  return {
    ...data,
    relatorios: (data.relatorios || []).filter(byClient),
    vendas: (data.vendas || []).filter(byClient),
    metaAdsDailyInsights: (data.metaAdsDailyInsights || []).filter(byClient),
    metaAdsAccountHealth: (data.metaAdsAccountHealth || []).filter(byClient),
    gmnAnalises: (data.gmnAnalises || []).filter(byClient),
    tarefas: (data.tarefas || []).filter(byClient),
    diarios: (data.diarios || []).filter(byClient),
    alertas: (data.alertas || []).filter((row) => !row?.cliente_id || visibleClientIds.has(row.cliente_id)),
    metas: (data.metas || []).filter(byClient),
  };
}

async function safeAlertasList() {
  try {
    const alertas = await alertaAnomaliaService.listAll();
    state.alertasMissingTable = false;
    return alertas;
  } catch (error) {
    if (['42P01', 'PGRST205'].includes(error?.code) || String(error?.message || '').includes('alertas_anomalia')) {
      state.alertasMissingTable = true;
      return [];
    }
    throw error;
  }
}

async function safeVendasList() {
  try {
    const vendas = await vendaClienteService.list({ columns: '*, clientes(nome_empresa, meta_ads_act)' });
    state.vendasMissingTable = false;
    return vendas;
  } catch (error) {
    if (['42P01', 'PGRST205'].includes(error?.code) || String(error?.message || '').includes('vendas_cliente')) {
      state.vendasMissingTable = true;
      return [];
    }
    throw error;
  }
}

async function safeMetaAdsDailyInsightsList(since) {
  try {
    const insights = await metaAdsDailyInsightService.listRecent(since);
    state.metaAdsDailyInsightsMissingTable = false;
    return insights;
  } catch (error) {
    if (['42P01', 'PGRST205'].includes(error?.code) || String(error?.message || '').includes('meta_ads_daily_insights')) {
      state.metaAdsDailyInsightsMissingTable = true;
      return [];
    }
    throw error;
  }
}

async function safeMetaAdsAccountHealthList() {
  try {
    const rows = await metaAdsAccountHealthService.listLatest();
    state.metaAdsAccountHealthMissingTable = false;
    return rows;
  } catch (error) {
    if (['42P01', 'PGRST205'].includes(error?.code) || String(error?.message || '').includes('meta_ads_account_health')) {
      state.metaAdsAccountHealthMissingTable = true;
      return [];
    }
    throw error;
  }
}

async function safeGmnAnalisesList() {
  try {
    const rows = await gmnAnaliseService.list({ columns: '*, clientes(nome_empresa, meta_ads_act)' });
    state.gmnAnalisesMissingTable = false;
    return rows;
  } catch (error) {
    if (['42P01', 'PGRST205'].includes(error?.code) || String(error?.message || '').includes('gmn_analises')) {
      state.gmnAnalisesMissingTable = true;
      return [];
    }
    throw error;
  }
}

async function safeCrmWebhookLogsList() {
  try {
    const rows = await crmWebhookLogService.listRecent(600);
    state.crmWebhookLogsMissingTable = false;
    return rows;
  } catch (error) {
    if (['42P01', 'PGRST205'].includes(error?.code) || String(error?.message || '').includes('crm_webhook_logs')) {
      state.crmWebhookLogsMissingTable = true;
      return [];
    }
    throw error;
  }
}

function updateAlertasBadge() {
  const badge = document.getElementById('alertasBadge');
  if (!badge) return;
  const ativos = state.alertas.filter((a) => a.status === 'ativo').length;
  if (ativos > 0) {
    badge.textContent = ativos;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

async function safeDiaryList() {
  try {
    const diarios = await diarioBordoService.list({ columns: '*, clientes(nome_empresa)' });
    state.diarioMissingTable = false;
    return diarios;
  } catch (error) {
    if (isMissingDiaryTableError(error)) {
      state.diarioMissingTable = true;
      return [];
    }
    throw error;
  }
}

function setupCrmRealtime() {
  if (!state.session || !isMainAdmin()) {
    teardownCrmRealtime();
    return;
  }
  if (crmRealtimeChannel) return;
  if (state.session.access_token && supabase.realtime?.setAuth) {
    supabase.realtime.setAuth(state.session.access_token);
  }
  crmRealtimeChannel = supabase
    .channel('the-midia-master-crm-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leads_crm' }, handleLeadRealtimeChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_webhook_logs' }, handleCrmLogRealtimeChange)
    .subscribe((status) => {
      if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
        console.warn('Realtime CRM status:', status);
      }
    });
}

function teardownCrmRealtime() {
  if (!crmRealtimeChannel) return;
  supabase.removeChannel(crmRealtimeChannel);
  crmRealtimeChannel = null;
}

function handleLeadRealtimeChange(payload) {
  if (!payload) return;
  if (payload.eventType === 'DELETE') {
    const id = payload.old?.id;
    if (id) state.leads = state.leads.filter((lead) => lead.id !== id);
  } else if (payload.new?.id) {
    upsertStateRow(state.leads, payload.new, sortByCreatedAtDesc);
  }
  updateCrmRealtimeView();
}

function handleCrmLogRealtimeChange(payload) {
  if (!payload || state.crmWebhookLogsMissingTable) return;
  if (payload.eventType === 'DELETE') {
    const id = payload.old?.id;
    if (id) state.crmWebhookLogs = state.crmWebhookLogs.filter((log) => log.id !== id);
  } else if (payload.new?.id) {
    upsertStateRow(state.crmWebhookLogs, payload.new, sortByReceivedAtDesc);
    state.crmWebhookLogs = state.crmWebhookLogs.slice(0, 600);
  }
  updateCrmRealtimeView();
  refreshActiveConversation();
}

function upsertStateRow(list, row, sorter) {
  const index = list.findIndex((item) => item.id === row.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...row };
  } else {
    list.unshift(row);
  }
  if (sorter) list.sort(sorter);
}

function sortByCreatedAtDesc(a, b) {
  return String(b.created_at || '').localeCompare(String(a.created_at || ''));
}

function sortLeadsByLatestInteraction(a, b) {
  const left = String(a.ultima_interacao || a.updated_at || a.created_at || '');
  const right = String(b.ultima_interacao || b.updated_at || b.created_at || '');
  const dateCompare = right.localeCompare(left);
  if (dateCompare) return dateCompare;
  return String(a.nome_empresa || '').localeCompare(String(b.nome_empresa || ''), 'pt-BR');
}

function sortByReceivedAtDesc(a, b) {
  return String(b.received_at || b.created_at || '').localeCompare(String(a.received_at || a.created_at || ''));
}

function updateCrmRealtimeView() {
  if (!state.session) return;
  if (['crm', 'crmFollowups', 'dashboard'].includes(state.view)) {
    render();
  }
}

function refreshActiveConversation() {
  if (!state.activeConversationLeadId || modalBackdrop.hidden) return;
  const lead = state.leads.find((item) => item.id === state.activeConversationLeadId);
  if (!lead) return;
  openLeadConversation(lead.id);
}

function isMissingDiaryTableError(error) {
  return ['42P01', 'PGRST205'].includes(error?.code) || String(error?.message || '').includes('diario_bordo');
}

function isMainAdmin() {
  return state.session?.user?.email?.toLowerCase() === mainAdminEmail;
}

function getUserRole() {
  return state.session?.user?.app_metadata?.funcao || state.session?.user?.user_metadata?.funcao || '';
}

function isTrafficManager() {
  return getUserRole() === 'gestor_trafego';
}

function getAllowedViews() {
  if (isMainAdmin()) return adminViews;
  if (isTrafficManager()) return trafficManagerViews;
  return teamViews;
}

function getDefaultView() {
  return isMainAdmin() ? 'dashboard' : 'dashboardClientes';
}

function canAccessView(view) {
  return getAllowedViews().includes(view);
}

function getStoredView() {
  try {
    return localStorage.getItem(viewStorageKey) || '';
  } catch {
    return '';
  }
}

function persistView() {
  try {
    localStorage.setItem(viewStorageKey, state.view);
  } catch {
    // localStorage can be unavailable in private/restricted contexts.
  }
}

function applyNavPermissions() {
  const allowed = getAllowedViews();
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
    const permitted = allowed.includes(item.dataset.view);
    item.hidden = !permitted;
    item.disabled = !permitted;
    item.classList.toggle('active', permitted && item.dataset.view === state.view);
  });
}

function navigate(view) {
  if (!canAccessView(view)) {
    state.view = getDefaultView();
  } else {
    state.view = view;
  }
  persistView();
  state.detailClienteId = null;
  state.detailRelatorioId = null;
  applyNavPermissions();
  document.getElementById('sidebar')?.classList.remove('open');
  render();
}

function render() {
  if (!isSupabaseConfigured) {
    document.body.classList.remove('auth-only');
    app.innerHTML = renderConfig();
    bindGlobalActions();
    renderLucide();
    return;
  }

  if (!state.session) {
    document.body.classList.add('auth-only');
    app.innerHTML = renderLogin();
    bindLogin();
    renderLucide();
    return;
  }

  document.body.classList.remove('auth-only');
  if (!canAccessView(state.view)) state.view = getDefaultView();
  persistView();
  applyNavPermissions();
  if (!isMainAdmin() && state.detailClienteId) {
    state.detailClienteId = null;
    state.view = getDefaultView();
    persistView();
  }
  if (state.detailClienteId) {
    renderClienteDetail(state.detailClienteId);
    return;
  }
  if (state.detailRelatorioId) {
    renderRelatorioDetail(state.detailRelatorioId);
    return;
  }

  const views = {
    dashboard: renderDashboard,
    dashboardClientes: renderDashboardClientes,
    clientes: renderClientes,
    crm: renderCrm,
    crmFollowups: renderCrmFollowups,
    campanhas: renderCampanhas,
    relatorios: renderRelatorios,
    metaAds: renderMetaAds,
    gbp: renderGbp,
    diario: renderDiario,
    tarefas: renderTarefas,
    playbooks: renderPlaybooks,
    equipe: renderEquipe,
    metas: renderMetas,
    alertas: renderAlertas,
    config: renderConfig,
  };
  app.innerHTML = `${renderLoadErrorBanner()}${views[state.view]?.() || renderDashboard()}`;
  bindGlobalActions();
  renderLucide();
}

function renderLogin() {
  return `
    <section class="login-screen">
      <div class="login-card">
        <div class="login-brand">
          <div class="brand-mark login-mark">TM</div>
          <div>
            <p class="eyebrow">Acesso interno</p>
            <h1>The Midia Master</h1>
            <span>Entre para gerenciar clientes, campanhas, CRM e operacao.</span>
          </div>
        </div>
        ${state.loadError ? `<div class="state"><strong>Conexao instavel</strong><span>${escapeHtml(state.loadError)}</span></div>` : ''}
        <form id="loginForm" class="form-grid">
          <label class="full">Email<input class="input" type="email" name="email" required autocomplete="email"></label>
          <label class="full">Senha<input class="input" type="password" name="password" required autocomplete="current-password"></label>
          <div class="form-actions"><button class="button login-button" type="submit"><i data-lucide="log-in"></i>Entrar</button></div>
        </form>
      </div>
    </section>
  `;
}

function renderLoadErrorBanner() {
  if (!state.loadError) return '';
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Dados nao carregados</h2>
          <p class="muted">${escapeHtml(state.loadError)}</p>
        </div>
        <button class="button" data-action="refresh" type="button"><i data-lucide="refresh-cw"></i>Tentar novamente</button>
      </div>
    </section>
  `;
}

function bindLogin() {
  document.getElementById('loginForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.target).entries());
    try {
      const { error } = await supabase.auth.signInWithPassword(payload);
      if (error) throw error;
      await loadAll();
      render();
      toast('Acesso liberado.');
    } catch (error) {
      showError(error);
    }
  });
}

async function logout() {
  teardownCrmRealtime();
  await supabase.auth.signOut();
  state.session = null;
  state.activeConversationLeadId = null;
  render();
}

function renderConfig() {
  const whatsapp = state.whatsapp;
  return `
    ${pageHeader('Configuracoes', 'Conexao e estado do projeto.')}
    <section class="panel config-ok">
      <div class="panel-header">
        <h2>Supabase conectado</h2>
        ${statusBadge('ativo')}
      </div>
      <div class="kv">
        ${areaSummary('Projeto', 'wkjnxohfggqwhemalelf')}
        ${areaSummary('URL', 'https://wkjnxohfggqwhemalelf.supabase.co')}
        ${areaSummary('Usuario autenticado', state.session?.user?.email || 'Sessao ativa')}
        ${areaSummary('Clientes', `${state.clientes.length} registros`)}
        ${areaSummary('Leads CRM', `${state.leads.length} registros`)}
        ${areaSummary('Campanhas', `${state.campanhas.length} registros`)}
        ${areaSummary('Relatorios', `${state.relatorios.length} registros`)}
        ${areaSummary('Tarefas', `${state.tarefas.length} registros`)}
      </div>
      <p class="muted">A migration foi executada no Supabase e o painel esta usando dados reais do banco. A chave service_role nao foi salva no frontend.</p>
    </section>
    <section class="panel whatsapp-panel">
      <div class="panel-header">
        <div>
          <h2>Conexao WhatsApp</h2>
          <p class="muted">Integração via Evolution API usando o mesmo webhook do projeto restaurante.</p>
        </div>
        ${statusBadge(whatsapp.status || 'pendente')}
      </div>
      <div class="whatsapp-config-grid">
        <div class="whatsapp-config-form">
          <label>Nome da instancia
            <input class="input" data-action="whatsapp-instance" value="${escapeHtml(whatsapp.instanceName)}" placeholder="the-midia-master">
          </label>
          <label>Webhook de conexao
            <input class="input" value="${escapeHtml(whatsappWebhookUrl)}" readonly>
          </label>
          <div class="whatsapp-actions">
            <button class="button" data-action="whatsapp-connect" type="button"><i data-lucide="qr-code"></i>Criar QR Code</button>
            <button class="secondary-button" data-action="whatsapp-mark-connected" type="button"><i data-lucide="check-circle-2"></i>Marcar conectado</button>
            <button class="secondary-button" data-action="whatsapp-clear" type="button"><i data-lucide="unlink"></i>Limpar conexao</button>
          </div>
          <div class="whatsapp-status-box">
            ${areaSummary('Status', label(whatsapp.status || 'pendente'))}
            ${areaSummary('Instancia', whatsapp.instanceName || '-')}
            ${areaSummary('Ultima atualizacao', whatsapp.updatedAt ? new Date(whatsapp.updatedAt).toLocaleString('pt-BR') : '-')}
          </div>
          ${whatsapp.message ? `<p class="whatsapp-message">${escapeHtml(whatsapp.message)}</p>` : ''}
        </div>
        <div class="whatsapp-qr-card" id="whatsappQrContainer">
          ${renderWhatsappQr(whatsapp)}
        </div>
      </div>
    </section>
  `;
}

function getDefaultWhatsappConfig() {
  return {
    instanceName: 'the-midia-master',
    status: 'pendente',
    qrCode: '',
    message: '',
    updatedAt: '',
  };
}

function getStoredWhatsAppConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('theMidiaMaster.whatsapp') || '{}');
    return { ...getDefaultWhatsappConfig(), ...saved };
  } catch {
    return getDefaultWhatsappConfig();
  }
}

function persistWhatsappConfig() {
  localStorage.setItem('theMidiaMaster.whatsapp', JSON.stringify(state.whatsapp));
}

function sanitizeInstanceName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function renderWhatsappQr(config) {
  if (config.status === 'conectando') {
    return `<div class="state state-loading"><span class="spinner"></span><strong>Gerando QR Code</strong><span>Enviando solicitacao para o webhook.</span></div>`;
  }
  if (config.qrCode) {
    return `
      <div class="whatsapp-qr-result">
        <img src="${escapeHtml(config.qrCode)}" alt="QR Code WhatsApp">
        <strong>Escaneie com o WhatsApp</strong>
        <span>Abra o WhatsApp no celular e conecte como no WhatsApp Web.</span>
      </div>
    `;
  }
  if (config.status === 'ativo') {
    return `<div class="whatsapp-connected"><strong>WhatsApp conectado</strong><span>A instancia esta marcada como ativa neste painel.</span></div>`;
  }
  return `<div class="whatsapp-empty"><strong>Aguardando QR Code</strong><span>Clique em Criar QR Code para iniciar a conexao.</span></div>`;
}

async function connectWhatsapp() {
  const instanceName = sanitizeInstanceName(state.whatsapp.instanceName || 'the-midia-master');
  if (!instanceName) {
    toast('Informe um nome de instancia valido.', 'error');
    return;
  }

  state.whatsapp = {
    ...state.whatsapp,
    instanceName,
    status: 'conectando',
    message: '',
    qrCode: '',
    updatedAt: new Date().toISOString(),
  };
  persistWhatsappConfig();
  render();

  try {
    const response = await fetch(whatsappWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceName,
        restaurante_id: 'the-midia-master',
        restauranteId: 'the-midia-master',
        projeto: 'the-midia-master',
        origem: 'the-midia-master-configuracoes',
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) throw new Error('Erro ao conectar com o servico de automacao.');

    const contentType = response.headers.get('content-type') || '';
    let payload;
    if (contentType.includes('application/json')) {
      payload = await response.json();
    } else {
      const blob = await response.blob();
      payload = { qrcode: { base64: await blobToDataUrl(blob) } };
    }

    const qrCode = extractWhatsappQr(payload);
    state.whatsapp = {
      ...state.whatsapp,
      status: qrCode ? 'pendente' : 'ativo',
      qrCode,
      message: qrCode ? 'QR Code gerado.' : 'Solicitacao enviada. O webhook nao retornou imagem de QR Code.',
      updatedAt: new Date().toISOString(),
    };
    persistWhatsappConfig();
    render();
    toast(qrCode ? 'QR Code gerado.' : 'Solicitacao enviada ao WhatsApp.');
  } catch (error) {
    state.whatsapp = {
      ...state.whatsapp,
      status: 'pendente',
      message: error.message || 'Falha ao conectar WhatsApp.',
      updatedAt: new Date().toISOString(),
    };
    persistWhatsappConfig();
    render();
    showError(error);
  }
}

function extractWhatsappQr(payload) {
  if (!payload) return '';
  const candidates = [
    payload.qrcode?.base64,
    payload.qrcode?.code,
    payload.qrCode?.base64,
    payload.qrCode,
    payload.qr,
    payload.base64,
    payload.image,
  ].filter(Boolean);
  const raw = String(candidates[0] || '');
  if (!raw) return '';
  return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function renderDashboard() {
  const active = state.clientes.filter((c) => c.status === 'ativo');
  const paused = state.clientes.filter((c) => c.status === 'pausado');
  const canceled = state.clientes.filter((c) => c.status === 'cancelado');
  const prospects = state.clientes.filter((c) => c.status === 'prospect');
  const monthlyRevenue = active.reduce((sum, c) => sum + Number(c.valor_mensal || 0), 0);
  const managedBudget = active.reduce((sum, c) => sum + Number(c.verba_mensal_trafego || 0), 0);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const leadsMonth = state.relatorios.filter((r) => new Date(r.periodo_fim) >= monthStart).reduce((sum, r) => sum + Number(r.leads || 0), 0);
  const crmTotal = state.leads.length;
  const crmResponded = state.leads.filter((lead) => ['respondeu', 'qualificado', 'reuniao_marcada', 'proposta_enviada', 'fechado', 'perdido'].includes(lead.etapa)).length;
  const crmQualified = state.leads.filter((lead) => ['qualificado', 'reuniao_marcada', 'proposta_enviada', 'fechado'].includes(lead.etapa)).length;
  const crmMeetings = state.leads.filter((lead) => ['reuniao_marcada', 'proposta_enviada', 'fechado'].includes(lead.etapa)).length;
  const crmProposals = state.leads.filter((lead) => ['proposta_enviada', 'fechado'].includes(lead.etapa)).length;
  const crmClosed = state.leads.filter((lead) => lead.etapa === 'fechado').length;
  const crmLost = state.leads.filter((lead) => lead.etapa === 'perdido').length;
  const responseRate = percent(crmResponded, crmTotal);
  const qualifiedFromResponseRate = percent(crmQualified, crmResponded);
  const meetingRate = percent(crmMeetings, crmTotal);
  const meetingFromQualifiedRate = percent(crmMeetings, crmQualified);
  const proposalRate = percent(crmProposals, crmMeetings);
  const closeRate = percent(crmClosed, crmTotal);
  const closeFromProposalRate = percent(crmClosed, crmProposals);
  const pendingTaskItems = getPendingTasks();
  const pendingTasks = pendingTaskItems.length;
  const overdueTasks = getOverdueTasks();
  const staleReportClients = getStaleReportClients();
  const staleReports = staleReportClients.length;
  const followups = getDashboardFollowups();

  return `
    ${pageHeader('Dashboard geral da agencia', 'Indicadores reais consolidados a partir do Supabase.', `<button class="button" data-action="refresh"><i data-lucide="refresh-cw"></i>Atualizar</button>`)}
    <section class="dashboard-area">
      <div class="dashboard-area-header">
        <div>
          <span>Carteira</span>
          <h2>Clientes</h2>
        </div>
        <p>${active.length} ativos de ${state.clientes.length} cadastrados</p>
      </div>
      <div class="stats-grid compact">
        ${statCard('Clientes ativos', active.length, 'building-2', 'green')}
        ${statCard('Clientes pausados', paused.length, 'pause-circle', 'yellow')}
        ${statCard('Clientes cancelados', canceled.length, 'x-circle', 'red')}
        ${statCard('Prospects', prospects.length, 'radar', 'blue')}
      </div>
    </section>
    <section class="dashboard-area">
      <div class="dashboard-area-header">
        <div>
          <span>Receita e midia</span>
          <h2>Financeiro</h2>
        </div>
        <p>Contratos ativos e verba sob gestao</p>
      </div>
      <div class="stats-grid compact">
        ${statCard('Faturamento mensal', money(monthlyRevenue), 'wallet', 'gold')}
        ${statCard('Verba gerenciada', money(managedBudget), 'circle-dollar-sign', 'blue')}
        ${statCard('Leads gerados no mes', leadsMonth, 'mouse-pointer-click', 'green')}
        ${statCard('Relatorios lancados', state.relatorios.length, 'file-bar-chart', 'blue')}
      </div>
    </section>
    <section class="dashboard-area dashboard-area-featured">
      <div class="dashboard-area-header">
        <div>
          <span>Leads > reunioes > fechamentos</span>
          <h2>Funil comercial</h2>
        </div>
        <p>${crmTotal} leads no funil, ${crmClosed} fechados</p>
      </div>
      <div class="funnel-flow">
        ${funnelStageCard('Leads no funil', crmTotal, 'blue')}
        ${funnelConnector(responseRate, 'lead > respondeu')}
        ${funnelStageCard('Respondeu', crmResponded, 'blue')}
        ${funnelConnector(qualifiedFromResponseRate, 'respondeu > qualificado')}
        ${funnelStageCard('Qualificados', crmQualified, 'green')}
        ${funnelConnector(meetingFromQualifiedRate, 'qualificado > reuniao')}
        ${funnelStageCard('Reunioes marcadas', crmMeetings, 'gold')}
        ${funnelConnector(proposalRate, 'reuniao > proposta')}
        ${funnelStageCard('Propostas enviadas', crmProposals, 'yellow')}
        ${funnelConnector(closeFromProposalRate, 'proposta > fechado')}
        ${funnelStageCard('Fechamentos', crmClosed, 'green')}
      </div>
      <div class="funnel-secondary">
        ${funnelStageCard('Perdidos', crmLost, 'red')}
        ${funnelStageCard('Taxa fechamento geral', closeRate, 'gold')}
        ${funnelStageCard('Lead > reuniao', meetingRate, 'blue')}
      </div>
    </section>
    <section class="dashboard-area">
      <div class="dashboard-area-header">
        <div>
          <span>Rotina interna</span>
          <h2>Operacao</h2>
        </div>
        <p>Tarefas, alertas e follow-ups comerciais</p>
      </div>
      <div class="stats-grid compact">
        ${statCard('Tarefas pendentes', pendingTasks, 'list-checks', 'yellow', operationCardAttrs('pendingTasks'))}
        ${statCard('Tarefas vencidas', overdueTasks.length, 'alarm-clock', 'red', operationCardAttrs('overdueTasks'))}
        ${statCard('Sem relatorio atualizado', staleReports, 'file-warning', 'red', operationCardAttrs('staleReports'))}
        ${statCard('Follow-ups comerciais', followups.length, 'phone-forwarded', 'gold', operationCardAttrs('followups'))}
      </div>
    </section>
    <section class="grid-2">
      <div class="panel">
        <div class="panel-header"><h3>Resumo por area</h3></div>
        <div class="kv">
          ${areaSummary('Clientes', `${active.length} ativos de ${state.clientes.length}`)}
          ${areaSummary('Financeiro', `${money(monthlyRevenue)} em contratos`)}
          ${areaSummary('Funil comercial', `${crmTotal} leads > ${crmMeetings} reunioes > ${crmClosed} fechamentos`)}
          ${areaSummary('Conversao geral', closeRate)}
          ${areaSummary('Responderam', `${crmResponded} leads (${percent(crmResponded, crmTotal)})`)}
          ${areaSummary('Qualificados', `${crmQualified} leads (${percent(crmQualified, crmTotal)})`)}
          ${areaSummary('Perdidos', `${crmLost} leads`)}
          ${areaSummary('Tarefas', `${pendingTasks} abertas`)}
          ${areaSummary('Relatorios', `${state.relatorios.length} lancados`)}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Alertas importantes</h3></div>
        ${renderAlertList(overdueTasks, followups, staleReports)}
      </div>
    </section>
  `;
}

function operationCardAttrs(kind) {
  return `data-action="operation-detail" data-kind="${kind}" role="button" tabindex="0" aria-label="Ver detalhes"`;
}

function getPendingTasks() {
  return state.tarefas
    .filter((task) => ['pendente', 'em_andamento'].includes(task.status))
    .sort((a, b) => String(a.data_vencimento || '9999-12-31').localeCompare(String(b.data_vencimento || '9999-12-31')));
}

function getStaleReportClients() {
  return state.clientes
    .filter((cliente) => !state.relatorios.some((relatorio) => relatorio.cliente_id === cliente.id && daysSince(relatorio.periodo_fim) <= 35))
    .sort((a, b) => String(a.nome_empresa || '').localeCompare(String(b.nome_empresa || '')));
}

function getDashboardFollowups() {
  return state.leads
    .filter((lead) => lead.data_proximo_contato)
    .filter((lead) => !['fechado', 'perdido'].includes(lead.etapa))
    .sort((a, b) => String(a.data_proximo_contato || '').localeCompare(String(b.data_proximo_contato || '')));
}

function renderDashboardClientes() {
  const weekRange = getFourWeeksRange();
  const rows = getDashboardClienteRows(weekRange)
    .filter((row) => state.dashboardClientesClienteId === 'all' || row.cliente.id === state.dashboardClientesClienteId);
  const clientOptions = state.clientes.map((cliente) => `<option value="${cliente.id}" ${state.dashboardClientesClienteId === cliente.id ? 'selected' : ''}>${escapeHtml(cliente.nome_empresa)}</option>`).join('');
  const originOptions = getDashboardOriginOptions().map((origem) => `<option value="${escapeHtml(origem)}" ${state.dashboardClientesOrigem === origem ? 'selected' : ''}>${escapeHtml(origem)}</option>`).join('');

  return `
    ${pageHeader('Dashboard Clientes', 'Comparativo das ultimas 4 semanas com Meta Ads e vendas por cliente.', `<button class="secondary-button" data-action="export" data-entity="vendas"><i data-lucide="download"></i>CSV vendas</button><button class="button" data-action="new" data-entity="vendas"><i data-lucide="plus"></i>Lancar venda</button>`)}
    ${state.vendasMissingTable ? `<div class="state"><strong>Tabela de vendas ainda nao existe</strong><span>Rode a migration 20260617_vendas_cliente.sql no Supabase para salvar vendas manuais.</span></div>` : ''}
    ${state.metaAdsDailyInsightsMissingTable ? `<div class="state"><strong>Tabela Meta Ads diaria ainda nao existe</strong><span>Rode a migration meta_ads_daily_insights no Supabase e aguarde o cron preencher os dados.</span></div>` : ''}
    <section class="panel client-dashboard-filters">
      <label>Cliente
        <select data-action="client-dashboard-client">
          <option value="all" ${state.dashboardClientesClienteId === 'all' ? 'selected' : ''}>Todos os clientes</option>
          ${clientOptions}
        </select>
      </label>
      <label>Origem
        <select data-action="client-dashboard-origin">
          <option value="all" ${state.dashboardClientesOrigem === 'all' ? 'selected' : ''}>Todas as origens</option>
          <option value="Meta Ads" ${state.dashboardClientesOrigem === 'Meta Ads' ? 'selected' : ''}>Meta Ads</option>
          ${originOptions}
        </select>
      </label>
      <div class="client-dashboard-range-note">
        <span>Periodo</span>
        <strong>${date(weekRange.since)} ate ${date(weekRange.until)}</strong>
      </div>
    </section>
    <section class="client-dashboard-list">
      ${rows.length ? rows.map((row) => renderDashboardClienteRow(row, weekRange)).join('') : emptyState('Sem dados nas ultimas 4 semanas', 'Lance vendas ou rode a sincronizacao diaria do Meta Ads para alimentar este dashboard.')}
    </section>
  `;
}

function renderDashboardClienteRow(row, range) {
  const isSalesGoal = row.salesSource === 'meta';
  const weeks = getDashboardClienteWeeks(row.cliente, range);
  return `
    <article class="client-metrics-card">
      <div class="client-metrics-header">
        <div>
          <span>${escapeHtml(row.cliente.segmento || row.cliente.meta_ads_act || 'Cliente')}</span>
          <h3>${escapeHtml(row.cliente.nome_empresa)}</h3>
        </div>
        <div class="client-metrics-actions">
          ${isSalesGoal ? '<span class="status-badge status-ativo">Vendas Meta Ads</span>' : ''}
          <span class="status-badge status-${escapeHtml(row.cliente.status || 'ativo')}">${escapeHtml(label(row.cliente.status || 'ativo'))}</span>
          ${isSalesGoal ? '' : `<button class="secondary-button" data-action="new" data-entity="vendas" data-cliente="${row.cliente.id}" type="button"><i data-lucide="plus"></i>Venda</button>`}
        </div>
      </div>
      ${renderDashboardClienteWeeklyTable(weeks, isSalesGoal)}
    </article>
  `;
}

function renderDashboardClienteWeeklyTable(weeks, isSalesGoal = false) {
  const total = weeks.reduce((acc, week) => {
    acc.spend += Number(week.spend || 0);
    acc.revenue += Number(week.revenue || 0);
    acc.messages += Number(week.messages || 0);
    acc.sales += Number(week.sales || 0);
    acc.clicks += Number(week.clicks || 0);
    acc.impressions += Number(week.impressions || 0);
    return acc;
  }, { spend: 0, revenue: 0, messages: 0, sales: 0, clicks: 0, impressions: 0 });
  const totalConversion = !isSalesGoal && total.messages && total.sales ? percentNumber(total.sales, total.messages) : 0;
  const totalRoas = total.spend && total.revenue ? ratio(total.revenue, total.spend) : 0;
  const totalCtr = percentNumber(total.clicks, total.impressions);
  return `
    <div class="meta-weekly-report client-weekly-report">
      <div class="meta-weekly-heading">
        <h3>Ultimas 4 semanas</h3>
        <span>Resumo consolidado por semana</span>
      </div>
      <section class="table-panel meta-table-panel meta-week-summary-panel client-week-summary-panel">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Semana</th>
                <th>Periodo</th>
                <th>Valor usado</th>
                <th>Faturamento</th>
                <th>Mensagens</th>
                <th>Custo/msg</th>
                <th>Vendas</th>
                <th>Conv. msg/venda</th>
                <th>Custo/venda</th>
                <th>ROAS</th>
                <th>CTR</th>
              </tr>
            </thead>
            <tbody>
              ${weeks.map((week, index) => {
                const previous = weeks[index - 1] || null;
                const costPerMessage = week.messages ? ratio(week.spend, week.messages) : 0;
                const previousCostPerMessage = previous?.messages ? ratio(previous.spend, previous.messages) : 0;
                const conversion = !isSalesGoal && week.messages && week.sales ? percentNumber(week.sales, week.messages) : 0;
                const previousConversion = previous && !isSalesGoal && previous.messages && previous.sales ? percentNumber(previous.sales, previous.messages) : 0;
                const costPerSale = week.sales ? ratio(week.spend, week.sales) : 0;
                const previousCostPerSale = previous?.sales ? ratio(previous.spend, previous.sales) : 0;
                const roas = week.spend && week.revenue ? ratio(week.revenue, week.spend) : 0;
                const previousRoas = previous?.spend && previous?.revenue ? ratio(previous.revenue, previous.spend) : 0;
                const ctr = percentNumber(week.clicks, week.impressions);
                const previousCtr = previous ? percentNumber(previous.clicks, previous.impressions) : 0;
                return `
                  <tr>
                    <td><strong>Semana ${index + 1}</strong></td>
                    <td>${date(week.since)} ate ${date(week.until)}</td>
                    <td>${money(week.spend)}</td>
                    <td>${trendMetric(money(week.revenue), week.revenue, previous?.revenue, true)}</td>
                    <td>${trendMetric(week.messages ? number(Math.round(week.messages)) : '-', week.messages, previous?.messages, true)}</td>
                    <td>${trendMetric(week.messages ? money(costPerMessage) : '-', costPerMessage, previousCostPerMessage, false)}</td>
                    <td>${trendMetric(week.sales ? number(Math.round(week.sales)) : '-', week.sales, previous?.sales, true)}</td>
                    <td>${trendMetric(conversion ? `${conversion.toFixed(2)}%` : '-', conversion, previousConversion, true)}</td>
                    <td>${trendMetric(week.sales ? money(costPerSale) : '-', costPerSale, previousCostPerSale, false)}</td>
                    <td>${trendMetric(roas ? roas.toFixed(2) : '-', roas, previousRoas, true)}</td>
                    <td>${trendMetric(`${ctr.toFixed(2)}%`, ctr, previousCtr, true)}</td>
                  </tr>
                `;
              }).join('')}
              <tr class="client-week-total-row">
                <td><strong>Total</strong></td>
                <td>${date(weeks[0]?.since)} ate ${date(weeks[weeks.length - 1]?.until)}</td>
                <td>${money(total.spend)}</td>
                <td>${money(total.revenue)}</td>
                <td>${total.messages ? number(Math.round(total.messages)) : '-'}</td>
                <td>${total.messages ? money(ratio(total.spend, total.messages)) : '-'}</td>
                <td>${total.sales ? number(Math.round(total.sales)) : '-'}</td>
                <td>${totalConversion ? `${totalConversion.toFixed(2)}%` : '-'}</td>
                <td>${total.sales ? money(ratio(total.spend, total.sales)) : '-'}</td>
                <td>${totalRoas ? totalRoas.toFixed(2) : '-'}</td>
                <td>${totalCtr.toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function getDashboardClienteRows(range) {
  return state.clientes
    .filter((cliente) => cliente.status !== 'cancelado')
    .map((cliente) => {
      const metrics = aggregateClientMetricsForRange(cliente, range);
      return {
        cliente,
        ...metrics,
        score: metrics.revenue + metrics.spend + metrics.sales + metrics.clicks,
      };
    })
    .filter((row) => row.score > 0 || state.dashboardClientesClienteId !== 'all')
    .sort((a, b) => (b.revenue || b.spend || 0) - (a.revenue || a.spend || 0));
}

function getDashboardClienteWeeks(cliente, range) {
  return buildWeeksFromRange(range).map((week) => aggregateClientMetricsForRange(cliente, week));
}

function aggregateClientMetricsForRange(cliente, range) {
  const dailyInsights = getClienteMetaDailyInsightsInRange(cliente.id, range.since, range.until);
  const relatorios = getClienteRelatoriosInRange(cliente.id, range.since, range.until);
  const vendas = state.vendas.filter((venda) =>
    venda.cliente_id === cliente.id &&
    isDateInRange(venda.data_venda, range.since, range.until) &&
    matchesDashboardOrigin(venda.origem)
  );
  const isSalesGoal = getClientMetaGoalKey(cliente) === 'vendas';
  const origin = state.dashboardClientesOrigem || 'all';
  const allowMetaSales = origin === 'all' || origin === 'Meta Ads';
  const manualSales = sumBy(vendas, 'quantidade_vendas');
  const manualRevenue = sumBy(vendas, 'valor_total');
  const manualProducts = sumBy(vendas, 'quantidade_produtos');
  const fallback = {
    spend: sumWeightedReports(relatorios, 'investimento', range.since, range.until),
    impressions: sumWeightedReports(relatorios, 'impressoes', range.since, range.until),
    clicks: sumWeightedReports(relatorios, 'cliques', range.since, range.until),
    messages: sumWeightedReports(relatorios, 'mensagens', range.since, range.until),
    sales: sumWeightedReports(relatorios, 'vendas', range.since, range.until),
    revenue: sumWeightedReports(relatorios, 'faturamento_informado', range.since, range.until),
  };
  const savedMeta = dailyInsights.length ? {
    spend: sumBy(dailyInsights, 'investimento'),
    impressions: sumBy(dailyInsights, 'impressoes'),
    clicks: sumBy(dailyInsights, 'cliques'),
    messages: sumBy(dailyInsights, 'mensagens'),
    sales: sumBy(dailyInsights, 'vendas'),
    revenue: sumBy(dailyInsights, 'faturamento'),
  } : null;
  const meta = savedMeta || fallback;

  return {
    ...range,
    spend: meta.spend,
    impressions: meta.impressions,
    clicks: meta.clicks,
    messages: meta.messages,
    sales: isSalesGoal && allowMetaSales ? meta.sales : manualSales,
    products: isSalesGoal && allowMetaSales ? (manualProducts || meta.sales) : manualProducts,
    revenue: isSalesGoal && allowMetaSales ? meta.revenue : manualRevenue,
    salesSource: isSalesGoal ? 'meta' : 'manual',
  };
}

function getDashboardOriginOptions() {
  return [...new Set(state.vendas.map((venda) => String(venda.origem || '').trim()).filter(Boolean))]
    .filter((origem) => origem !== 'Meta Ads')
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function matchesDashboardOrigin(origem) {
  const selected = state.dashboardClientesOrigem || 'all';
  if (selected === 'all') return true;
  return String(origem || '').trim() === selected;
}

function getClienteMetaDailyInsightsInRange(clienteId, since, until) {
  return state.metaAdsDailyInsights.filter((insight) =>
    insight.cliente_id === clienteId &&
    isDateInRange(insight.data, since, until)
  );
}

function areaSummary(title, value) {
  return `<div><span>${escapeHtml(title)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function funnelStageCard(labelText, value, tone = 'blue') {
  return `
    <article class="funnel-stage tone-${tone}">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(labelText)}</span>
    </article>
  `;
}

function funnelConnector(value, labelText) {
  return `
    <div class="funnel-connector">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(labelText)}</span>
    </div>
  `;
}

function percent(part, total) {
  return total ? `${((Number(part || 0) / Number(total || 0)) * 100).toFixed(1)}%` : '0.0%';
}

function percentNumber(part, total) {
  return total ? (Number(part || 0) / Number(total || 0)) * 100 : 0;
}

function ratio(part, total) {
  const denominator = Number(total || 0);
  return denominator ? Number(part || 0) / denominator : 0;
}

function trendMetric(value, current, previous, higherIsBetter = true) {
  const currentValue = Number(current || 0);
  const previousValue = Number(previous || 0);
  if (!previousValue || currentValue === previousValue) return `<span class="metric-trend-value">${value}</span>`;
  const improved = higherIsBetter ? currentValue > previousValue : currentValue < previousValue;
  const direction = currentValue > previousValue ? 'up' : 'down';
  const labelText = improved ? 'Melhorou' : 'Piorou';
  return `
    <span class="metric-trend-value">
      <span class="metric-trend metric-trend-${improved ? 'good' : 'bad'}" aria-label="${labelText}">${direction === 'up' ? '↑' : '↓'}</span>
      <span>${value}</span>
    </span>
  `;
}

function sumBy(items, key) {
  return items.reduce((sum, item) => sum + Number(item?.[key] || 0), 0);
}

function getClienteRelatoriosInRange(clienteId, since, until) {
  return state.relatorios.filter((relatorio) =>
    relatorio.cliente_id === clienteId &&
    dateRangesOverlap(relatorio.periodo_inicio, relatorio.periodo_fim, since, until)
  );
}

function sumWeightedReports(reports, key, since, until) {
  return reports.reduce((sum, report) => {
    const weight = reportOverlapWeight(report.periodo_inicio, report.periodo_fim, since, until);
    return sum + (Number(report?.[key] || 0) * weight);
  }, 0);
}

function reportOverlapWeight(start, end, since, until) {
  const reportDays = inclusiveDays(start, end);
  const overlapDays = overlappingDays(start, end, since, until);
  if (!reportDays || !overlapDays) return 0;
  return overlapDays / reportDays;
}

function inclusiveDays(start, end) {
  if (!start || !end) return 0;
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const diff = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  return Math.max(0, diff);
}

function overlappingDays(start, end, since, until) {
  if (!start || !end || !since || !until) return 0;
  const overlapStart = String(start) > String(since) ? start : since;
  const overlapEnd = String(end) < String(until) ? end : until;
  return inclusiveDays(overlapStart, overlapEnd);
}

function isDateInRange(value, since, until) {
  if (!value) return false;
  return String(value) >= String(since) && String(value) <= String(until);
}

function dateRangesOverlap(start, end, since, until) {
  if (!start || !end) return false;
  return String(end) >= String(since) && String(start) <= String(until);
}

function renderAlertList(overdueTasks, followups, staleReports) {
  const items = [
    overdueTasks.length ? `${overdueTasks.length} tarefas vencidas precisam de atencao.` : null,
    staleReports ? `${staleReports} clientes estao sem relatorio atualizado nos ultimos 35 dias.` : null,
    followups.length ? `${followups.length} proximos follow-ups comerciais registrados.` : null,
  ].filter(Boolean);
  if (!items.length) return emptyState('Sem alertas criticos', 'Operacao sem pendencias principais agora.');
  return `<div class="table-wrap"><table><tbody>${items.map((item) => `<tr><td>${escapeHtml(item)}</td></tr>`).join('')}</tbody></table></div>`;
}

function openOperationDetail(kind) {
  const configs = {
    pendingTasks: {
      title: 'Tarefas pendentes',
      description: 'Tarefas abertas ou em andamento.',
      heads: ['Tarefa', 'Cliente', 'Responsavel', 'Vencimento', 'Status', ''],
      rows: getPendingTasks().map((task) => operationTaskRow(task)),
      empty: ['Sem tarefas pendentes', 'Nenhuma tarefa aberta agora.'],
    },
    overdueTasks: {
      title: 'Tarefas vencidas',
      description: 'Tarefas abertas com vencimento anterior a hoje.',
      heads: ['Tarefa', 'Cliente', 'Responsavel', 'Vencimento', 'Status', ''],
      rows: getOverdueTasks().map((task) => operationTaskRow(task)),
      empty: ['Sem tarefas vencidas', 'Tudo em dia por aqui.'],
    },
    staleReports: {
      title: 'Sem relatorio atualizado',
      description: 'Clientes sem relatorio nos ultimos 35 dias.',
      heads: ['Cliente', 'Responsavel', 'Ultimo relatorio', 'Status', ''],
      rows: getStaleReportClients().map((cliente) => operationClientRow(cliente)),
      empty: ['Todos com relatorio recente', 'Nenhum cliente esta vencido nesse criterio.'],
    },
    followups: {
      title: 'Follow-ups comerciais',
      description: 'Leads com proximo contato registrado.',
      heads: ['Lead', 'Etapa', 'Toque', 'Proximo contato', 'Responsavel', ''],
      rows: getDashboardFollowups().map((lead) => operationFollowupRow(lead)),
      empty: ['Sem follow-ups cadastrados', 'Nenhum lead ativo tem proximo contato definido.'],
    },
  };
  const config = configs[kind];
  if (!config) return;

  modalEyebrow.textContent = 'Operacao';
  modalTitle.textContent = config.title;
  modalForm.onsubmit = null;
  modalForm.innerHTML = `
    <div class="operation-detail-modal">
      <p class="muted">${escapeHtml(config.description)}</p>
      ${config.rows.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr>${config.heads.map((head) => `<th>${escapeHtml(head)}</th>`).join('')}</tr></thead>
            <tbody>${config.rows.join('')}</tbody>
          </table>
        </div>
      ` : emptyState(config.empty[0], config.empty[1])}
      <div class="form-actions">
        <button type="button" class="secondary-button" data-modal-cancel>Fechar</button>
      </div>
    </div>
  `;
  modalBackdrop.hidden = false;
  modalForm.querySelector('[data-modal-cancel]')?.addEventListener('click', closeModal);
  modalForm.querySelectorAll('[data-operation-task]').forEach((button) => {
    button.addEventListener('click', () => {
      closeModal();
      openTaskDetail(button.dataset.id);
    });
  });
  modalForm.querySelectorAll('[data-operation-client]').forEach((button) => {
    button.addEventListener('click', () => {
      closeModal();
      state.detailClienteId = button.dataset.id;
      state.view = 'clientes';
      persistView();
      render();
    });
  });
  modalForm.querySelectorAll('[data-operation-lead]').forEach((button) => {
    button.addEventListener('click', () => {
      closeModal();
      openLeadConversation(button.dataset.id);
    });
  });
  modalForm.querySelectorAll('[data-operation-view]').forEach((button) => {
    button.addEventListener('click', () => {
      closeModal();
      navigate(button.dataset.view);
    });
  });
  renderLucide();
}

function operationTaskRow(task) {
  return `
    <tr>
      <td><strong>${escapeHtml(task.titulo || 'Tarefa sem titulo')}</strong>${task.descricao ? `<span class="muted">${escapeHtml(task.descricao)}</span>` : ''}</td>
      <td>${escapeHtml(task.clientes?.nome_empresa || getClienteName(task.cliente_id) || '-')}</td>
      <td>${escapeHtml(task.responsavel || '-')}</td>
      <td>${date(task.data_vencimento)}</td>
      <td>${statusBadge(task.status || 'pendente')}</td>
      <td><button class="ghost-button" type="button" data-operation-task data-id="${task.id}"><i data-lucide="panel-right-open"></i>Abrir</button></td>
    </tr>
  `;
}

function operationClientRow(cliente) {
  const lastReport = state.relatorios
    .filter((relatorio) => relatorio.cliente_id === cliente.id)
    .sort((a, b) => String(b.periodo_fim || '').localeCompare(String(a.periodo_fim || '')))[0];
  return `
    <tr>
      <td><strong>${escapeHtml(cliente.nome_empresa || 'Cliente sem nome')}</strong><span class="muted">${escapeHtml(cliente.segmento || cliente.cidade || '')}</span></td>
      <td>${escapeHtml(cliente.responsavel_interno || cliente.responsavel || '-')}</td>
      <td>${lastReport ? date(lastReport.periodo_fim) : 'Nunca'}</td>
      <td>${statusBadge(cliente.status || 'ativo')}</td>
      <td><button class="ghost-button" type="button" data-operation-client data-id="${cliente.id}"><i data-lucide="panel-right-open"></i>Abrir</button></td>
    </tr>
  `;
}

function operationFollowupRow(lead) {
  return `
    <tr>
      <td><strong>${escapeHtml(lead.nome_empresa || 'Lead sem nome')}</strong><span class="muted">${escapeHtml(formatLeadPhone(lead.whatsapp) || lead.origem_lead || '')}</span></td>
      <td>${statusBadge(lead.etapa || 'lead_novo')}</td>
      <td>Toque ${Number(lead.tentativa || 0) + 1}</td>
      <td>${date(lead.data_proximo_contato)}</td>
      <td>${escapeHtml(lead.responsavel || '-')}</td>
      <td><button class="ghost-button" type="button" data-operation-lead data-id="${lead.id}"><i data-lucide="message-circle"></i>Conversa</button></td>
    </tr>
  `;
}

function renderClientes() {
  scheduleClientMetaCostLoad();
  const admin = isMainAdmin();
  const headerActions = [
    '<button class="secondary-button" data-action="refresh-client-meta-costs"><i data-lucide="refresh-cw"></i>Custo 7d Meta</button>',
    admin ? '<button class="secondary-button" data-action="export" data-entity="clientes"><i data-lucide="download"></i>CSV</button>' : '',
    admin ? '<button class="button" data-action="new" data-entity="clientes"><i data-lucide="plus"></i>Novo cliente</button>' : '',
  ].filter(Boolean).join('');
  const heads = admin
    ? ['Empresa', 'Status', 'Plano', 'Mensalidade', 'Custo resultado 7d', 'Meta Ads', 'Saude conta', 'Responsavel', '']
    : ['Empresa', 'Status', 'Plano', 'Custo resultado 7d', 'Meta Ads', 'Saude conta', 'Responsavel', ''];
  return `
    ${pageHeader('Clientes', admin ? 'Cadastro completo dos clientes da agencia.' : 'Clientes atribuidos a voce.', headerActions)}
    ${state.clientMetaCosts.error ? `<div class="state"><strong>Meta Ads</strong><span>${escapeHtml(state.clientMetaCosts.error)}</span></div>` : ''}
    ${renderTablePanel('clientes', heads, state.clientes.map((cliente) => `
      <tr>
        <td><strong>${escapeHtml(cliente.nome_empresa)}</strong><span class="muted">${escapeHtml(cliente.segmento || cliente.cidade || '')}</span></td>
        <td>${statusBadge(cliente.status)}</td>
        <td>${statusBadge(cliente.plano_contratado || 'personalizado')}</td>
        ${admin ? `<td>${money(cliente.valor_mensal)}</td>` : ''}
        <td>${renderClientMetaCost(cliente)}</td>
        <td>${escapeHtml(cliente.meta_ads_act || '-')}</td>
        <td>${renderMetaAccountHealth(cliente)}</td>
        <td>${escapeHtml(cliente.responsavel_interno || cliente.responsavel || '-')}</td>
        <td class="row-actions">
          <button class="ghost-button" data-action="detail-cliente" data-id="${cliente.id}"><i data-lucide="panel-right-open"></i>Abrir</button>
          ${admin ? `<button class="icon-button" data-action="edit" data-entity="clientes" data-id="${cliente.id}" aria-label="Editar"><i data-lucide="pencil"></i></button>
          <button class="icon-button" data-action="delete" data-entity="clientes" data-id="${cliente.id}" aria-label="Excluir"><i data-lucide="trash-2"></i></button>` : ''}
        </td>
      </tr>`).join(''))}
  `;
}

function renderMetaAccountHealth(cliente) {
  if (!cliente.meta_ads_act) return '<span class="muted">Sem conta Meta</span>';
  if (state.metaAdsAccountHealthMissingTable) return '<span class="muted">Tabela nao criada</span>';
  const health = getMetaAccountHealth(cliente.id);
  if (!health) return '<span class="muted">Sem leitura ainda</span>';
  const isProblem = health.has_delivery_issues || health.effective_status === 'ERROR' || Number(health.account_status) === 3 || Number(health.disable_reason || 0) > 0;
  const statusText = health.last_error || health.account_status_label || health.effective_status || 'Sem status';
  const disableText = health.disable_reason_label && health.disable_reason_label !== 'Sem bloqueio' ? ` | ${health.disable_reason_label}` : '';
  const funding = health.funding_source_type ? `Pagamento: ${health.funding_source_type}` : 'Pagamento: -';
  const balance = health.prepay_balance_minor != null ? `Saldo pre: ${moneyFromMinor(health.prepay_balance_minor, health.currency)}` : `Saldo: ${moneyFromMinor(health.balance_minor, health.currency)}`;
  const spendCap = health.spend_cap_minor ? `Limite: ${moneyFromMinor(health.spend_cap_minor, health.currency)}` : '';
  return `
    <div class="meta-health-cell">
      <span class="meta-health-status ${isProblem ? 'meta-health-bad' : 'meta-health-good'}">${escapeHtml(statusText)}${escapeHtml(disableText)}</span>
      <span class="muted">${escapeHtml(balance)}${spendCap ? ` | ${escapeHtml(spendCap)}` : ''}</span>
      <span class="muted">${escapeHtml(funding)}</span>
      ${health.has_delivery_issues ? `<span class="meta-health-issue">${number((health.delivery_issues || []).length)} issue(s) de entrega</span>` : ''}
      <span class="muted">Atualizado: ${date(health.checked_at)}</span>
    </div>
  `;
}

function getMetaAccountHealth(clienteId) {
  return state.metaAdsAccountHealth
    .filter((item) => item.cliente_id === clienteId)
    .sort((a, b) => String(b.checked_at || '').localeCompare(String(a.checked_at || '')))[0] || null;
}

function moneyFromMinor(value, currency = 'BRL') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  const amount = numeric / 100;
  if (currency && currency !== 'BRL') {
    return `${currency} ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return money(amount);
}

function renderClientMetaCost(cliente) {
  if (!cliente.meta_ads_act) return '<span class="muted">Sem conta Meta</span>';
  const cost = state.clientMetaCosts.byClienteId[cliente.id];
  const goalKey = getClientMetaGoalKey(cliente);
  const goal = metaGoalConfig[goalKey] || metaGoalConfig.mensagens;
  if (state.clientMetaCosts.loading && !cost) {
    return '<span class="muted">Carregando...</span>';
  }
  if (cost?.error) {
    return `<span class="muted">Erro</span><span class="muted" style="font-size:11px;display:block">${escapeHtml(cost.error)}</span>`;
  }
  if (!cost) {
    return `<span class="muted">${state.clientMetaCosts.loaded ? 'Sem dados' : 'Aguardando'}</span><span class="muted" style="font-size:11px;display:block">${escapeHtml(goal.metricLabel)} 7d</span>`;
  }
  return `
    <strong>${cost.resultados ? money(cost.custo) : '-'}</strong>
    <span class="muted" style="font-size:11px;display:block">${escapeHtml(cost.label)}: ${number(cost.resultados)} | ${money(cost.investimento)}</span>
  `;
}

function getClientMetaGoalKey(cliente) {
  const activeGoals = state.metas
    .filter((meta) => meta.cliente_id === cliente.id && meta.ativo !== false)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return activeGoals[0]?.objetivo || inferMetaGoal(cliente);
}

function scheduleClientMetaCostLoad(force = false) {
  if (!isMainAdmin()) return;
  if (!force && (state.clientMetaCosts.loading || state.clientMetaCosts.loaded)) return;
  if (!state.clientes.some((cliente) => cliente.meta_ads_act)) return;
  setTimeout(() => loadClientMetaCosts(force), 0);
}

async function loadClientMetaCosts(force = false) {
  if (state.clientMetaCosts.loading) return;
  if (!force && state.clientMetaCosts.loaded) return;
  state.clientMetaCosts = { ...state.clientMetaCosts, loading: true, error: '' };
  render();
  try {
    const range = getDefaultDateRange();
    const clientes = state.clientes.filter((cliente) => cliente.meta_ads_act);
    const entries = await Promise.all(clientes.map(async (cliente) => {
      try {
        const goalKey = getClientMetaGoalKey(cliente);
        const goal = metaGoalConfig[goalKey] || metaGoalConfig.mensagens;
        const summary = await fetchMetaAccountResultCost(fixedMetaAccessToken, normalizeMetaAccount(cliente.meta_ads_act), range.since, range.until, goal);
        return [cliente.id, { ...summary, goalKey, label: goal.metricLabel, since: range.since, until: range.until }];
      } catch (error) {
        return [cliente.id, { error: error.message || 'Falha Meta Ads' }];
      }
    }));
    state.clientMetaCosts = {
      loading: false,
      loaded: true,
      error: '',
      byClienteId: Object.fromEntries(entries),
    };
  } catch (error) {
    state.clientMetaCosts = {
      ...state.clientMetaCosts,
      loading: false,
      loaded: true,
      error: error.message || 'Nao foi possivel carregar custo por resultado da Meta Ads.',
    };
  }
  render();
}

function renderCrm() {
  const searchTerm = normalizeSearchText(state.crmSearch);
  const filteredLeads = searchTerm
    ? state.leads.filter((lead) => getLeadSearchText(lead).includes(searchTerm))
    : state.leads;
  const kanban = crmStages.map((stage) => {
    const leads = filteredLeads.filter((lead) => lead.etapa === stage).sort(sortLeadsByLatestInteraction);
    const stageValue = leads.reduce((sum, lead) => sum + Number(lead.investimento_disponivel || lead.ticket_medio || 0), 0);
    return `
      <section class="kanban-column crm-stage-${stage}">
        <header>
          <div>
            <span>${label(stage)}</span>
            <strong>${leads.length} lead${leads.length === 1 ? '' : 's'}</strong>
          </div>
          <small>${money(stageValue)}</small>
        </header>
        <div class="kanban-column-body" data-crm-drop-stage="${escapeHtml(stage)}">
          ${leads.map(renderLeadCard).join('') || (searchTerm ? emptyState('Nenhum lead encontrado', 'Tente outra busca.') : emptyState('Sem leads', 'Arraste leads para esta etapa.'))}
        </div>
      </section>
    `;
  }).join('');

  return `
    ${pageHeader('CRM Comercial', 'Funil de prospeccao da propria agencia.', `<button class="secondary-button" data-action="go-view" data-view="crmFollowups"><i data-lucide="message-square-warning"></i>Follow-ups de hoje</button><button class="button" data-action="new" data-entity="crm"><i data-lucide="plus"></i>Novo lead</button>`)}
    <div class="crm-pipeline-summary">
      ${crmPipelineMetric('Leads', state.leads.length)}
      ${crmPipelineMetric('Reunioes', state.leads.filter((lead) => ['reuniao_marcada', 'proposta_enviada', 'fechado'].includes(lead.etapa)).length)}
      ${crmPipelineMetric('Propostas', state.leads.filter((lead) => ['proposta_enviada', 'fechado'].includes(lead.etapa)).length)}
      ${crmPipelineMetric('Fechados', state.leads.filter((lead) => lead.etapa === 'fechado').length)}
    </div>
    <div class="crm-search-bar">
      <i data-lucide="search"></i>
      <input class="input" type="search" data-action="crm-search" value="${escapeHtml(state.crmSearch)}" placeholder="Pesquisar lead..." autocomplete="off">
      ${searchTerm ? `<span>${filteredLeads.length} de ${state.leads.length}</span>` : ''}
    </div>
    <div class="kanban">${kanban}</div>
  `;
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getLeadSearchText(lead) {
  return normalizeSearchText([
    lead.nome_empresa,
    lead.whatsapp,
    lead.email,
    lead.origem_lead,
    lead.responsavel,
    lead.observacoes,
    lead.etapa ? label(lead.etapa) : '',
  ].filter(Boolean).join(' '));
}

function renderCrmFollowups() {
  const followups = getTodayFollowups();
  const waitingManual = state.leads.filter((lead) => lead.aguardando_resposta_manual && !['fechado', 'perdido'].includes(lead.etapa)).length;
  const overdue = followups.filter((lead) => daysBetweenDates(lead.data_proximo_contato, isoDate(new Date())) > 0).length;
  const grouped = crmActiveStages
    .map((stage) => ({ stage, leads: followups.filter((lead) => lead.etapa === stage) }))
    .filter((group) => group.leads.length);

  return `
    ${pageHeader('Follow-ups de hoje', 'Lista manual dos leads que precisam de toque hoje. Nada e enviado automaticamente.', `<button class="secondary-button" data-action="go-view" data-view="crm"><i data-lucide="kanban-square"></i>Ver kanban</button><button class="button" data-action="refresh"><i data-lucide="refresh-cw"></i>Atualizar</button>`)}
    <div class="crm-pipeline-summary">
      ${crmPipelineMetric('Para fazer hoje', followups.length)}
      ${crmPipelineMetric('Atrasados', overdue)}
      ${crmPipelineMetric('Aguardando resposta', waitingManual)}
      ${crmPipelineMetric('Leads ativos', state.leads.filter((lead) => !['fechado', 'perdido'].includes(lead.etapa)).length)}
    </div>
    <section class="followup-board">
      ${grouped.length ? grouped.map(renderFollowupGroup).join('') : emptyState('Nenhum follow-up hoje', 'Quando um lead vencer pelo proximo contato, ele aparece aqui.')}
    </section>
  `;
}

function renderFollowupGroup(group) {
  return `
    <section class="followup-group crm-stage-${escapeHtml(group.stage)}">
      <header>
        <div>
          <span>${label(group.stage)}</span>
          <strong>${group.leads.length} lead${group.leads.length === 1 ? '' : 's'}</strong>
        </div>
      </header>
      <div class="followup-list">
        ${group.leads.map(renderFollowupLead).join('')}
      </div>
    </section>
  `;
}

function renderFollowupLead(lead) {
  const stoppedDays = getLeadStoppedDays(lead);
  const touchNumber = Number(lead.tentativa || 0) + 1;
  return `
    <article class="followup-card">
      <div class="followup-card-main">
        <strong>${escapeHtml(lead.nome_empresa || 'Lead sem nome')}</strong>
        <span>${escapeHtml(lead.responsavel || 'Sem responsavel')}</span>
      </div>
      <div class="followup-card-meta">
        ${statusBadge(lead.etapa || 'lead_novo')}
        <span>Toque ${touchNumber}</span>
        <span>${stoppedDays === 0 ? 'Parado hoje' : `${stoppedDays} dia${stoppedDays === 1 ? '' : 's'} parado`}</span>
        <span>Proximo: ${date(lead.data_proximo_contato)}</span>
      </div>
      <div class="followup-card-actions">
        <button class="button" data-action="open-followup-result" data-id="${lead.id}"><i data-lucide="check-circle-2"></i>Marcar feito</button>
        <button class="icon-button" data-action="open-lead-conversation" data-id="${lead.id}" aria-label="Abrir conversa"><i data-lucide="message-circle"></i></button>
        <button class="icon-button" data-action="edit" data-entity="crm" data-id="${lead.id}" aria-label="Editar lead"><i data-lucide="pencil"></i></button>
      </div>
    </article>
  `;
}

function renderLeadCard(lead) {
  const potentialClass = lead.potencial ? ` lead-potential-${escapeHtml(lead.potencial)}` : '';
  return `
    <article class="lead-card${potentialClass}" draggable="true" data-lead-id="${lead.id}" data-lead-stage="${escapeHtml(lead.etapa || 'lead_novo')}">
      <strong class="lead-card-name">${escapeHtml(lead.nome_empresa)}</strong>
      <div class="lead-card-actions">
        <button class="icon-button" data-action="open-lead-conversation" data-id="${lead.id}" aria-label="Abrir conversa"><i data-lucide="message-circle"></i></button>
        <button class="icon-button" data-action="edit" data-entity="crm" data-id="${lead.id}" aria-label="Editar lead"><i data-lucide="pencil"></i></button>
        <button class="icon-button danger" data-action="delete" data-entity="crm" data-id="${lead.id}" aria-label="Excluir lead"><i data-lucide="trash-2"></i></button>
      </div>
    </article>
  `;
}

function crmPipelineMetric(labelText, value) {
  return `<div><span>${escapeHtml(labelText)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function getTodayFollowups() {
  const today = isoDate(new Date());
  return state.leads
    .filter((lead) => isLeadDueForManualFollowup(lead, today))
    .sort((a, b) => {
      const dateCompare = String(a.data_proximo_contato || '').localeCompare(String(b.data_proximo_contato || ''));
      if (dateCompare) return dateCompare;
      return String(a.nome_empresa || '').localeCompare(String(b.nome_empresa || ''));
    });
}

function isLeadDueForManualFollowup(lead, today = isoDate(new Date())) {
  if (!lead) return false;
  if (['fechado', 'perdido'].includes(lead.etapa)) return false;
  if (lead.etapa === 'follow_up') return false;
  if (lead.aguardando_resposta_manual) return false;
  return Boolean(lead.data_proximo_contato && String(lead.data_proximo_contato) <= today);
}

function getFollowupCadence(lead) {
  const configured = lead?.cadencia_followup && typeof lead.cadencia_followup === 'object' ? lead.cadencia_followup : {};
  const stage = lead?.etapa || 'lead_novo';
  const values = Array.isArray(configured[stage]) ? configured[stage] : defaultFollowupCadence[stage];
  return Array.isArray(values) && values.length ? values.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value >= 0) : [2, 4];
}

function getLeadStoppedDays(lead) {
  const reference = lead.ultima_interacao || lead.data_proximo_contato;
  return Math.max(0, daysBetweenDates(toIsoDateOnly(reference), isoDate(new Date())));
}

function addDaysToIsoDate(value, days) {
  const base = new Date(`${value || isoDate(new Date())}T00:00:00`);
  base.setDate(base.getDate() + Number(days || 0));
  return isoDate(base);
}

function toIsoDateOnly(value) {
  if (!value) return '';
  if (value instanceof Date) return isoDate(value);
  return String(value).slice(0, 10);
}

function daysBetweenDates(sinceValue, untilValue) {
  if (!sinceValue || !untilValue) return 0;
  const since = new Date(`${toIsoDateOnly(sinceValue)}T00:00:00`);
  const until = new Date(`${toIsoDateOnly(untilValue)}T00:00:00`);
  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime())) return 0;
  return Math.floor((until.getTime() - since.getTime()) / 86400000);
}

function openFollowupResultModal(id) {
  const lead = state.leads.find((item) => item.id === id);
  if (!lead) return;
  modalEyebrow.textContent = 'Follow-up manual';
  modalTitle.textContent = lead.nome_empresa || 'Lead';
  modalForm.innerHTML = `
    <div class="followup-result-modal">
      <p class="muted">Escolha o resultado do toque. Nada sera enviado automaticamente.</p>
      <label>Resultado
        <select name="resultado" required>
          <option value="sem_resposta">Feito, sem resposta</option>
          <option value="respondeu">Respondeu</option>
          <option value="perdido">Perdido</option>
        </select>
      </label>
      <label class="full" data-followup-loss-reason hidden>Motivo da perda<textarea name="motivo_perda" placeholder="Ex: sem resposta apos varias tentativas"></textarea></label>
      <div class="followup-result-preview">
        <span>${statusBadge(lead.etapa || 'lead_novo')}</span>
        <span>Toque ${Number(lead.tentativa || 0) + 1}</span>
        <span>${getLeadStoppedDays(lead)} dia${getLeadStoppedDays(lead) === 1 ? '' : 's'} parado</span>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-button" data-modal-cancel>Cancelar</button>
        <button class="button" type="submit"><i data-lucide="save"></i>Salvar resultado</button>
      </div>
    </div>
  `;
  modalBackdrop.hidden = false;
  const resultSelect = modalForm.querySelector('select[name="resultado"]');
  const lossReason = modalForm.querySelector('[data-followup-loss-reason]');
  const reasonInput = modalForm.querySelector('textarea[name="motivo_perda"]');
  resultSelect?.addEventListener('change', () => {
    const isLost = resultSelect.value === 'perdido';
    lossReason.hidden = !isLost;
    reasonInput.required = isLost;
  });
  modalForm.querySelector('[data-modal-cancel]')?.addEventListener('click', closeModal);
  modalForm.onsubmit = (event) => handleFollowupResult(event, id);
  renderLucide();
}

async function handleFollowupResult(event, id) {
  event.preventDefault();
  const lead = state.leads.find((item) => item.id === id);
  if (!lead) return;
  const formData = new FormData(event.target);
  const result = formData.get('resultado');
  const reason = String(formData.get('motivo_perda') || '').trim();
  const now = new Date().toISOString();
  const patch = buildFollowupResultPatch(lead, result, reason, now);

  try {
    const updated = await leadCrmService.update(id, patch);
    await logCrmManualAction(lead, result, patch);
    const index = state.leads.findIndex((item) => item.id === id);
    if (index >= 0) state.leads[index] = { ...state.leads[index], ...updated };
    closeModal();
    render();
    if (result === 'respondeu') {
      toast('Resposta marcada. Avance a etapa manualmente no kanban.');
    } else if (patch.etapa === 'perdido') {
      toast('Lead movido para perdido.');
    } else {
      toast(`Follow-up reagendado para ${date(patch.data_proximo_contato)}.`);
    }
  } catch (error) {
    showError(error);
  }
}

function buildFollowupResultPatch(lead, result, reason, now) {
  if (result === 'respondeu') {
    return {
      aguardando_resposta_manual: true,
      ultima_interacao: now,
    };
  }

  if (result === 'perdido') {
    return {
      etapa: 'perdido',
      motivo_perda: reason || 'perdido apos follow-up manual',
      ultima_interacao: now,
      aguardando_resposta_manual: false,
    };
  }

  const cadence = getFollowupCadence(lead);
  const nextAttempt = Number(lead.tentativa || 0) + 1;
  if (nextAttempt >= cadence.length) {
    return {
      etapa: 'perdido',
      tentativa: nextAttempt,
      motivo_perda: `sem resposta apos ${nextAttempt} tentativas`,
      ultima_interacao: now,
      aguardando_resposta_manual: false,
    };
  }

  return {
    tentativa: nextAttempt,
    ultima_interacao: now,
    aguardando_resposta_manual: false,
    data_proximo_contato: addDaysToIsoDate(isoDate(new Date()), cadence[nextAttempt - 1]),
  };
}

async function logCrmManualAction(lead, result, patch, extraPayload = {}) {
  if (state.crmWebhookLogsMissingTable) return;
  try {
    const log = await crmWebhookLogService.create({
      method: 'frontend',
      event: 'manual_followup',
      instance: 'the-midia-master',
      remote_jid: lead.whatsapp || null,
      from_me: true,
      action: result,
      lead_id: lead.id,
      payload: {
        lead_id: lead.id,
        nome_empresa: lead.nome_empresa,
        etapa_anterior: lead.etapa,
        resultado: result,
        patch,
        usuario: state.session?.user?.email || null,
        ...extraPayload,
      },
    });
    state.crmWebhookLogs = [log, ...state.crmWebhookLogs].slice(0, 600);
  } catch (error) {
    console.warn('Nao foi possivel gravar log do follow-up.', error);
  }
}

function openLeadConversation(id) {
  const lead = state.leads.find((item) => item.id === id);
  if (!lead) return;
  state.activeConversationLeadId = id;
  const messages = getLeadConversationMessages(lead);
  modalEyebrow.textContent = 'Conversa';
  modalTitle.textContent = lead.nome_empresa || 'Lead';
  modalForm.onsubmit = null;
  modalForm.innerHTML = `
    <div class="conversation-panel">
      <div class="conversation-contact">
        <div class="conversation-avatar">${escapeHtml(getInitials(lead.nome_empresa || lead.whatsapp || 'TM'))}</div>
        <div>
          <strong>${escapeHtml(lead.nome_empresa || 'Lead')}</strong>
          <span>${escapeHtml(formatLeadPhone(lead.whatsapp) || lead.origem_lead || 'WhatsApp')}</span>
        </div>
      </div>
      <div class="conversation-thread" id="conversationThread">
        ${messages.length ? messages.map(renderConversationMessage).join('') : `
          <div class="conversation-empty" id="conversationEmpty">
            <i data-lucide="message-circle"></i>
            <strong>Nenhuma mensagem encontrada</strong>
            <span>Os logs recentes nao tem conversa para este numero.</span>
          </div>
        `}
      </div>
      <div class="conversation-compose">
        <textarea
          id="conversationInput"
          class="conversation-input"
          placeholder="Escreva uma mensagem..."
          rows="1"
          maxlength="4096"
        ></textarea>
        <button id="conversationSend" class="conversation-send-btn" aria-label="Enviar mensagem" disabled>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  `;
  modalBackdrop.hidden = false;
  renderLucide();

  const thread = modalForm.querySelector('#conversationThread');
  const input = modalForm.querySelector('#conversationInput');
  const sendBtn = modalForm.querySelector('#conversationSend');

  // Scroll para o final do historico
  if (thread) thread.scrollTop = thread.scrollHeight;

  // Habilita/desabilita botao conforme digitacao + auto-resize do textarea
  input?.addEventListener('input', () => {
    sendBtn.disabled = !input.value.trim();
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  // Envio com Enter (Shift+Enter = quebra de linha)
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!sendBtn.disabled) sendConversationMessage(lead, input, sendBtn, thread);
    }
  });

  sendBtn?.addEventListener('click', () => {
    if (!sendBtn.disabled) sendConversationMessage(lead, input, sendBtn, thread);
  });
}

async function sendConversationMessage(lead, input, sendBtn, thread) {
  const text = input.value.trim();
  if (!text) return;

  const phone = normalizeDigits(lead.whatsapp);
  sendBtn.disabled = true;
  sendBtn.classList.add('sending');

  // Otimista: renderiza a bolha imediatamente
  const empty = thread.querySelector('#conversationEmpty');
  if (empty) empty.remove();
  const bubble = document.createElement('div');
  bubble.innerHTML = renderConversationMessage({ fromMe: true, text, date: new Date().toISOString() });
  thread.appendChild(bubble.firstElementChild);
  thread.scrollTop = thread.scrollHeight;

  input.value = '';
  input.style.height = 'auto';

  try {
    const response = await fetch('https://automacao2.themidiamarketing.com.br/webhook/the-midia-wpp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        message: text,
        lead_id: lead.id,
        nome_empresa: lead.nome_empresa || '',
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await markFollowupAsMessageSent(lead, text);
    sendBtn.classList.remove('sending');
  } catch (err) {
    console.error('[chat] Falha ao enviar mensagem:', err);
    sendBtn.classList.remove('sending');
    sendBtn.classList.add('error');
    setTimeout(() => sendBtn.classList.remove('error'), 2000);
    // Marca a bolha com erro
    const lastBubble = thread.lastElementChild?.querySelector('.conversation-bubble');
    if (lastBubble) lastBubble.classList.add('send-error');
  }
}

async function markFollowupAsMessageSent(lead, messageText) {
  if (!isLeadDueForManualFollowup(lead)) return;
  const now = new Date().toISOString();
  const patch = buildFollowupResultPatch(lead, 'sem_resposta', '', now);
  const updated = await leadCrmService.update(lead.id, patch);
  await logCrmManualAction(lead, 'mensagem_enviada_sem_resposta', patch, {
    mensagem_enviada: messageText,
    origem_acao: 'conversation_followup',
  });
  const index = state.leads.findIndex((item) => item.id === lead.id);
  if (index >= 0) state.leads[index] = { ...state.leads[index], ...updated };
  Object.assign(lead, updated);
  if (state.view === 'crmFollowups') render();
  if (patch.etapa === 'perdido') {
    toast('Mensagem enviada. Lead movido para perdido por limite de tentativas.');
  } else {
    toast(`Mensagem enviada. Follow-up reagendado para ${date(patch.data_proximo_contato)}.`);
  }
}

function getLeadConversationMessages(lead) {
  const leadPhone = normalizeDigits(lead.whatsapp);
  return state.crmWebhookLogs
    .filter((log) => {
      if (log.lead_id && log.lead_id === lead.id) return true;
      const remoteDigits = normalizeDigits(log.remote_jid);
      if (leadPhone && remoteDigits && (remoteDigits.endsWith(leadPhone) || leadPhone.endsWith(remoteDigits))) return true;
      return false;
    })
    .map((log) => {
      const text = extractConversationText(log.payload);
      if (!String(text || '').trim()) return null;
      return {
        id: log.id,
        fromMe: Boolean(log.from_me),
        text,
        date: extractConversationDate(log),
        event: log.event || log.action || 'webhook',
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const dateDiff = new Date(a.date) - new Date(b.date);
      if (dateDiff) return dateDiff;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
}

function renderConversationMessage(message) {
  return `
    <div class="conversation-message ${message.fromMe ? 'from-me' : 'from-contact'}">
      <div class="conversation-bubble">
        <p>${escapeHtml(message.text)}</p>
        <span>${escapeHtml(formatMessageTime(message.date))}</span>
      </div>
    </div>
  `;
}

function extractConversationText(payload = {}) {
  const data = payload.data || payload.body || payload;
  const message = data.message || data.messages?.[0]?.message || payload.message || {};
  return firstFilled(
    payload.text,
    payload.messageText,
    payload.conversation,
    data.text,
    data.messageText,
    data.conversation,
    message.conversation,
    message.extendedTextMessage?.text,
    message.imageMessage?.caption,
    message.videoMessage?.caption,
    message.documentMessage?.caption,
    data.messages?.[0]?.text
  );
}

function extractConversationDate(log = {}) {
  const payload = log.payload || {};
  const data = payload.data || payload.body || payload;
  const message = data.message || data.messages?.[0]?.message || payload.message || {};
  return normalizeConversationDate(firstFilled(
    payload.messageTimestamp,
    payload.timestamp,
    payload.date_time,
    data.messageTimestamp,
    data.timestamp,
    data.date_time,
    data.messages?.[0]?.messageTimestamp,
    data.messages?.[0]?.timestamp,
    message.messageTimestamp,
    log.received_at
  ), log.received_at);
}

function normalizeConversationDate(value, fallback) {
  if (!String(value || '').trim()) return fallback || new Date().toISOString();
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const numeric = Number(value);
    const millis = numeric > 9999999999 ? numeric : numeric * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function firstFilled(...values) {
  return values.find((value) => String(value || '').trim()) || '';
}

function normalizeDigits(value) {
  const clean = String(value || '').trim().split('@')[0].split(':')[0];
  const digits = clean.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) {
    const national = digits.slice(2);
    if (national.length === 10 && /^[6-9]/.test(national.slice(2))) {
      return `55${national.slice(0, 2)}9${national.slice(2)}`;
    }
  }
  return digits;
}

function formatLeadPhone(value) {
  const digits = normalizeDigits(value);
  if (!digits) return '';
  return digits.startsWith('55') ? `+${digits}` : digits;
}

function getInitials(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'TM';
}

function formatMessageTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function renderCampanhas() {
  return `
    ${pageHeader('Campanhas', 'Registro operacional de campanhas por cliente.', `<button class="secondary-button" data-action="export" data-entity="campanhas"><i data-lucide="download"></i>CSV</button><button class="button" data-action="new" data-entity="campanhas"><i data-lucide="plus"></i>Nova campanha</button>`)}
    ${renderTablePanel('campanhas', ['Campanha', 'Cliente', 'Plataforma', 'Status', 'Verba mensal', 'Periodo', ''], state.campanhas.map((campanha) => `
      <tr>
        <td><strong>${escapeHtml(campanha.nome_campanha)}</strong><span class="muted">${escapeHtml(campanha.objetivo || '')}</span></td>
        <td>${escapeHtml(campanha.clientes?.nome_empresa || getClienteName(campanha.cliente_id))}</td>
        <td>${statusBadge(campanha.plataforma)}</td>
        <td>${statusBadge(campanha.status)}</td>
        <td>${money(campanha.verba_mensal)}</td>
        <td>${date(campanha.data_inicio)} ate ${date(campanha.data_fim)}</td>
        <td class="row-actions">${actionButtons('campanhas', campanha.id)}</td>
      </tr>`).join(''))}
  `;
}

function renderRelatorios() {
  state.metaAds.tab = 'relatorios';
  return renderMetaAds();
}

function renderRelatoriosSalvos() {
  return `
    ${pageHeader('Relatorios', 'Relatorios Meta Ads e vendas dos clientes no mesmo lugar.', `<button class="secondary-button" data-action="print"><i data-lucide="printer"></i>PDF</button><button class="secondary-button" data-action="export" data-entity="relatorios"><i data-lucide="download"></i>CSV relatorios</button><button class="secondary-button" data-action="export" data-entity="vendas"><i data-lucide="download"></i>CSV vendas</button><button class="button" data-action="new" data-entity="relatorios"><i data-lucide="plus"></i>Novo relatorio</button>`)}
    ${renderRelatoriosTable()}
    ${renderVendasClientesPanel()}
  `;
}

function renderRelatoriosTable() {
  return renderTablePanel('relatorios', ['Cliente', 'Periodo', 'Meta Ads', ''], state.relatorios.map((relatorio) => `
      <tr class="${state.lastSavedRelatorioId === relatorio.id ? 'row-highlight' : ''}">
        <td>${escapeHtml(relatorio.clientes?.nome_empresa || getClienteName(relatorio.cliente_id))}</td>
        <td>${date(relatorio.periodo_inicio)} ate ${date(relatorio.periodo_fim)}</td>
        <td>${escapeHtml(relatorio.meta_ads_act_snapshot || '-')}</td>
        <td class="row-actions">${relatorioActionButtons(relatorio.id)}</td>
      </tr>`).join(''));
}

function renderVendasClientesPanel() {
  const vendas = [...state.vendas].sort((a, b) => String(b.data_venda || '').localeCompare(String(a.data_venda || '')));
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Vendas dos clientes</h2>
          <p class="muted">Vendas manuais cadastradas para cruzar com os dados de Meta Ads.</p>
        </div>
        <div class="row-actions">
          <button class="secondary-button" data-action="export" data-entity="vendas"><i data-lucide="download"></i>CSV</button>
          <button class="button" data-action="new" data-entity="vendas"><i data-lucide="plus"></i>Lancar venda</button>
        </div>
      </div>
      ${state.vendasMissingTable ? `<div class="state"><strong>Tabela de vendas ainda nao existe</strong><span>Rode a migration 20260617_vendas_cliente.sql no Supabase para salvar vendas manuais.</span></div>` : renderVendasClientesTable(vendas)}
    </section>
  `;
}

function renderVendasClientesTable(vendas) {
  if (!vendas.length) return emptyState('Nenhuma venda lancada', 'Cadastre vendas dos clientes para alimentar os relatorios e dashboards.');
  return `<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Data</th><th>Faturamento</th><th>Vendas</th><th>Produtos</th><th>Ticket medio</th><th>Origem</th><th></th></tr></thead><tbody>${vendas.map((venda) => `
    <tr>
      <td><strong>${escapeHtml(venda.clientes?.nome_empresa || getClienteName(venda.cliente_id) || '-')}</strong></td>
      <td>${date(venda.data_venda)}</td>
      <td>${money(venda.valor_total)}</td>
      <td>${number(venda.quantidade_vendas)}</td>
      <td>${number(venda.quantidade_produtos)}</td>
      <td>${money(venda.ticket_medio || ratio(venda.valor_total, venda.quantidade_vendas))}</td>
      <td>${escapeHtml(venda.origem || 'Manual')}</td>
      <td class="row-actions">${actionButtons('vendas', venda.id)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

function renderRelatorioDetail(id) {
  const relatorio = state.relatorios.find((item) => item.id === id);
  if (!relatorio) {
    state.detailRelatorioId = null;
    render();
    return;
  }
  const cliente = relatorio.clientes?.nome_empresa || getClienteName(relatorio.cliente_id);
  app.innerHTML = `
    ${pageHeader('Relatorio do cliente', `${cliente} - ${date(relatorio.periodo_inicio)} ate ${date(relatorio.periodo_fim)}`, `<button class="secondary-button" data-action="back-relatorios"><i data-lucide="arrow-left"></i>Voltar</button><button class="secondary-button" data-action="print"><i data-lucide="printer"></i>PDF</button><button class="button" data-action="edit" data-entity="relatorios" data-id="${relatorio.id}"><i data-lucide="pencil"></i>Editar</button>`)}
    <section class="panel print-section saved-report">
      <div class="panel-header">
        <div>
          <p class="eyebrow">The Midia Marketing</p>
          <h2>${escapeHtml(cliente)}</h2>
          <p class="muted">${date(relatorio.periodo_inicio)} ate ${date(relatorio.periodo_fim)} ${relatorio.meta_ads_act_snapshot ? `- ${escapeHtml(relatorio.meta_ads_act_snapshot)}` : ''}</p>
        </div>
        ${statusBadge('ativo')}
      </div>
      <div class="stats-grid">
        ${statCard('Investimento', money(relatorio.investimento), 'badge-dollar-sign', 'gold')}
        ${statCard('Impressoes', number(relatorio.impressoes), 'eye', 'blue')}
        ${statCard('Alcance', number(relatorio.alcance), 'radar', 'green')}
        ${statCard('Cliques', number(relatorio.cliques), 'mouse-pointer-click', 'blue')}
        ${statCard('CTR', `${Number(relatorio.ctr || 0).toFixed(2)}%`, 'percent', 'green')}
        ${statCard('CPC', money(relatorio.cpc), 'coins', 'gold')}
        ${statCard('Leads', number(relatorio.leads), 'user-plus', 'green')}
        ${statCard('CPL', money(relatorio.custo_por_lead), 'target', 'gold')}
        ${statCard('Mensagens', number(relatorio.mensagens), 'message-circle', 'blue')}
        ${statCard('Custo/msg', money(relatorio.custo_por_mensagem), 'messages-square', 'gold')}
        ${statCard('Vendas', number(relatorio.vendas), 'shopping-bag', 'green')}
        ${statCard('ROAS', Number(relatorio.roas || 0).toFixed(2), 'trending-up', 'green')}
      </div>
      <div class="grid-2">
        <article class="panel nested-report-panel">
          <div class="panel-header"><h3>Analise estrategica</h3></div>
          <p class="muted">${escapeHtml(relatorio.analise_estrategica || 'Sem analise estrategica cadastrada.')}</p>
        </article>
        <article class="panel nested-report-panel">
          <div class="panel-header"><h3>Proximos passos</h3></div>
          <p class="muted">${escapeHtml(relatorio.proximos_passos || 'Sem proximos passos cadastrados.')}</p>
        </article>
      </div>
    </section>
  `;
  bindGlobalActions();
  renderLucide();
}

function renderMetaAds() {
  const clientesComMeta = state.clientes.filter((cliente) => cliente.meta_ads_act);
  const report = state.metaAds.report;
  const missingLegacy = legacyMetaAdsClients.filter((legacy) => !state.clientes.some((cliente) => normalizeMetaAccount(cliente.meta_ads_act) === legacy.meta_ads_act));
  const headerActions = `${isMainAdmin() ? `<button class="secondary-button" data-action="import-meta-clients"><i data-lucide="users-round"></i>Importar clientes (${missingLegacy.length})</button>` : ''}<button class="secondary-button" data-action="print"><i data-lucide="printer"></i>PDF</button>`;
  if (!state.metaAds.tab) state.metaAds.tab = 'consulta';
  return `
    <div class="screen-only">${pageHeader('Relatórios Meta Ads', 'Modulo dedicado ao projeto Relatorios meta ads, agora conectado aos clientes do The Midia Master.', headerActions)}</div>
    <div class="screen-only section-tabs">
      <button class="tab-button ${state.metaAds.tab === 'consulta' ? 'active' : ''}" data-action="meta-tab" data-tab="consulta">Consulta Meta Ads</button>
      <button class="tab-button ${state.metaAds.tab === 'relatorios' ? 'active' : ''}" data-action="meta-tab" data-tab="relatorios">Relatorios salvos</button>
    </div>
    ${state.metaAds.tab === 'relatorios' ? `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Relatorios salvos</h2>
            <p class="muted">Relatorios salvos a partir da Meta Ads API ou lancados manualmente.</p>
          </div>
          <div class="row-actions">
            <button class="secondary-button" data-action="export" data-entity="relatorios"><i data-lucide="download"></i>CSV</button>
            <button class="button" data-action="new" data-entity="relatorios"><i data-lucide="plus"></i>Novo relatorio</button>
          </div>
        </div>
        ${renderRelatoriosTable()}
      </section>
      ${renderVendasClientesPanel()}
    ` : `
      <section class="panel screen-only">
        <div class="panel-header"><h2>Consulta Meta Ads API</h2>${statusBadge('ativo')}</div>
        <div class="form-grid">
          <div class="token-fixed-box">
            <span>Access token Meta Ads</span>
            <strong>Token fixo configurado</strong>
            <small>Usado automaticamente nas consultas. Nao aparece nos PDFs.</small>
          </div>
          <label>Cliente
            <select data-action="meta-client">
              <option value="">Selecione um cliente</option>
              ${clientesComMeta.map((cliente) => `<option value="${cliente.id}" ${state.metaAds.clienteId === cliente.id ? 'selected' : ''}>${escapeHtml(cliente.nome_empresa)} - ${escapeHtml(cliente.meta_ads_act)}</option>`).join('')}
            </select>
          </label>
          <label>Objetivo do relatorio
            <select data-action="meta-goal">
              ${Object.entries(metaGoalConfig).map(([key, cfg]) => `<option value="${key}" ${state.metaAds.goal === key ? 'selected' : ''}>${cfg.label}</option>`).join('')}
            </select>
          </label>
          <label>Inicio<input class="input" type="date" data-action="meta-since" value="${escapeHtml(state.metaAds.since)}"></label>
          <label>Fim<input class="input" type="date" data-action="meta-until" value="${escapeHtml(state.metaAds.until)}"></label>
          <div class="form-actions">
            <button class="button" data-action="meta-fetch" type="button"><i data-lucide="refresh-cw"></i>Buscar dados</button>
          </div>
        </div>
        ${state.metaAds.loading ? loadingState('Consultando Meta Ads...') : ''}
        ${state.metaAds.error ? `<div class="state"><strong>Erro na Meta Ads API</strong><span>${escapeHtml(state.metaAds.error)}</span></div>` : ''}
      </section>
      ${report ? renderMetaReport(report) : emptyState('Nenhum relatorio carregado', clientesComMeta.length ? 'Selecione cliente, periodo e token para buscar dados reais.' : 'Cadastre o meta_ads_act em ao menos um cliente.')}
    `}
  `;
}

function renderMetaReport(report) {
  return `
    <section class="meta-report print-section panel saved-report">
      <div class="meta-report-top screen-only">
        <button class="secondary-button" data-action="meta-back"><i data-lucide="arrow-left"></i>Voltar</button>
        <div>
          <p class="meta-report-eyebrow">Gestao de Trafego - The Midia Marketing</p>
          <h2>${escapeHtml(report.cliente.nome_empresa)}</h2>
          <p>${escapeHtml(report.since)} a ${escapeHtml(report.until)} - ${escapeHtml(report.accountId)} - <strong>${report.rows.length} ativos</strong></p>
          ${report.previous ? `<p class="meta-compare-period">Comparado com ${escapeHtml(report.previous.since)} a ${escapeHtml(report.previous.until)}</p>` : ''}
        </div>
        <div class="meta-report-actions">
          <button class="button" data-action="meta-save-report"><i data-lucide="file-plus-2"></i>Salvar</button>
          <button class="secondary-button" data-action="print"><i data-lucide="download"></i>Baixar PDF</button>
        </div>
      </div>
      <div class="meta-kpi-grid">
        ${metaKpi('Total de anuncios ativos', report.rows.length, `${report.rows.length} no periodo`, false, metaComparison(report.rows.length, report.previous?.rows?.length || 0, number))}
        ${metaKpi(`Gasto - ${report.since} a ${report.until}`, money(report.totals.investimento), 'anuncios ativos', false, metaComparison(report.totals.investimento, report.previous?.totals?.investimento || 0, money))}
        ${metaKpi('Cliques no periodo', number(report.totals.cliques), 'total combinado', false, metaComparison(report.totals.cliques, report.previous?.totals?.cliques || 0, number))}
        ${metaKpi(`${report.goal.metricLabel} no periodo`, number(report.totals.resultados), 'total de resultados', false, metaComparison(report.totals.resultados, report.previous?.totals?.resultados || 0, number))}
        ${metaKpi('Impressoes', number(report.totals.impressoes), '', false, metaComparison(report.totals.impressoes, report.previous?.totals?.impressoes || 0, number))}
        ${metaKpi('Alcance', number(report.totals.alcance), '', false, metaComparison(report.totals.alcance, report.previous?.totals?.alcance || 0, number))}
        ${metaKpi('CTR medio', `${report.totals.ctr.toFixed(2)}%`, '', false, metaComparison(report.totals.ctr, report.previous?.totals?.ctr || 0, formatPercent))}
        ${metaKpi('CPC medio', money(report.totals.cpc), '', true, metaComparison(report.totals.cpc, report.previous?.totals?.cpc || 0, money, true))}
        ${metaKpi('CPM medio', money(report.totals.cpm), '', true, metaComparison(report.totals.cpm, report.previous?.totals?.cpm || 0, money, true))}
        ${metaKpi(report.goal.costLabel, money(report.totals.custo_por_resultado), '', true, metaComparison(report.totals.custo_por_resultado, report.previous?.totals?.custo_por_resultado || 0, money, true))}
      </div>
      <div class="meta-toolbar">
        <div class="meta-tabs">
          <button class="${state.metaAds.viewMode === 'cards' ? 'active' : ''}" data-action="meta-view-mode" data-mode="cards">Cards</button>
          <button class="${state.metaAds.viewMode === 'campaigns' ? 'active' : ''}" data-action="meta-view-mode" data-mode="campaigns">Campanhas</button>
          <button class="${state.metaAds.viewMode === 'table' ? 'active' : ''}" data-action="meta-view-mode" data-mode="table">Tabela 4 semanas</button>
        </div>
        <input class="input meta-search" placeholder="Buscar anuncio..." data-action="meta-search">
        <span>${report.rows.length} anuncio(s)</span>
      </div>
      ${renderMetaReportBody(report)}
      <footer class="meta-report-footer">
        <span>The Midia Marketing - Token nao exposto</span>
        <span>Atualizado em ${new Date().toLocaleString('pt-BR')}</span>
      </footer>
    </section>
    ${renderGoogleAdsSection()}
  `;
}

function renderMetaReportBody(report) {
  if (state.metaAds.viewMode === 'campaigns') return renderMetaCampaigns(report.rows, report.goal);
  if (state.metaAds.viewMode === 'table') return renderMetaWeeklyTable(report.weeklyRows || [], report.goal);
  return `<div class="meta-ad-list">${report.rows.map((row) => renderMetaAdCard(row, report.goal)).join('') || emptyState('Sem anuncios', 'Nenhum dado retornado pela Meta Ads API.')}</div>`;
}

function renderGoogleAdsSection() {
  const { loading, error, report } = state.googleAds;
  if (!loading && !error && !report) return '';

  if (loading) {
    return `
      <section class="panel google-ads-section">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Google Ads</p>
            <h2>Carregando dados Google Ads...</h2>
          </div>
        </div>
        ${loadingState('Consultando Google Ads...')}
      </section>
    `;
  }

  if (error) {
    return `
      <section class="panel google-ads-section">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Google Ads</p>
            <h2>Erro ao carregar Google Ads</h2>
          </div>
        </div>
        <div class="state"><strong>Erro</strong><span>${escapeHtml(error)}</span></div>
      </section>
    `;
  }

  const t = report.totals;
  const impressionShareCol = (v) => v != null ? `${v.toFixed(1)}%` : '—';

  return `
    <section class="panel google-ads-section print-section">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Google Ads — ${escapeHtml(report.clienteName || report.customerId)}</p>
          <h2>Campanhas Google Ads</h2>
          <p class="muted">${escapeHtml(report.since)} a ${escapeHtml(report.until)} · ID ${escapeHtml(report.customerId)}</p>
        </div>
      </div>

      <div class="meta-kpi-grid">
        ${metaKpi('Investimento Google', money(t.spend), '', false)}
        ${metaKpi('Impressoes Google', number(t.impressions), '', false)}
        ${metaKpi('Cliques Google', number(t.clicks), '', false)}
        ${metaKpi('CTR Google', `${t.ctr.toFixed(2)}%`, '', false)}
        ${metaKpi('CPC medio', money(t.cpc), '', true)}
        ${metaKpi('CPM medio', money(t.cpm), '', true)}
      </div>

      ${report.campaigns.length ? `
        <div class="table-wrap" style="margin-top:1.5rem">
          <table>
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Investimento</th>
                <th>Impressoes</th>
                <th>Cliques</th>
                <th>CTR</th>
                <th>CPC</th>
                <th>CPM</th>
                <th title="Parcela de impressoes obtida">Imp. Share</th>
                <th title="Perdida por orcamento">Perda Orcamento</th>
                <th title="Perdida por classificacao">Perda Rank</th>
              </tr>
            </thead>
            <tbody>
              ${report.campaigns.map((c) => `
                <tr>
                  <td>${escapeHtml(c.name)}</td>
                  <td>${money(c.spend)}</td>
                  <td>${number(c.impressions)}</td>
                  <td>${number(c.clicks)}</td>
                  <td>${c.ctr.toFixed(2)}%</td>
                  <td>${money(c.cpc)}</td>
                  <td>${money(c.cpm)}</td>
                  <td>${impressionShareCol(c.impressionShare)}</td>
                  <td>${impressionShareCol(c.lostBudget)}</td>
                  <td>${impressionShareCol(c.lostRank)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}

      ${report.keywords.length ? `
        <div style="margin-top:2rem">
          <h3 style="margin-bottom:1rem">Palavras-chave (top ${report.keywords.length})</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Palavra-chave</th>
                  <th>Tipo</th>
                  <th>Investimento</th>
                  <th>Impressoes</th>
                  <th>Cliques</th>
                  <th>CTR</th>
                  <th>CPC</th>
                </tr>
              </thead>
              <tbody>
                ${report.keywords.map((k) => `
                  <tr>
                    <td>${escapeHtml(k.text)}</td>
                    <td>${escapeHtml(k.matchType)}</td>
                    <td>${money(k.spend)}</td>
                    <td>${number(k.impressions)}</td>
                    <td>${number(k.clicks)}</td>
                    <td>${k.ctr.toFixed(2)}%</td>
                    <td>${money(k.cpc)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}
    </section>
  `;
}

function renderMetaCampaigns(rows, goal) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = row.campaign_name || 'Sem campanha';
    const current = grouped.get(key) || { name: key, ads: 0, spend: 0, impressions: 0, clicks: 0, resultados: 0 };
    current.ads += 1;
    current.spend += row.spend;
    current.impressions += row.impressions;
    current.clicks += row.clicks;
    current.resultados += row.resultados;
    grouped.set(key, current);
  });
  const campaigns = [...grouped.values()].sort((a, b) => b.spend - a.spend);
  return `
    <div class="meta-ad-list">
      ${campaigns.map((campaign) => {
        const ctr = campaign.impressions ? (campaign.clicks / campaign.impressions) * 100 : 0;
        const cpc = campaign.clicks ? campaign.spend / campaign.clicks : 0;
        return `
          <article class="meta-ad-card meta-campaign-card">
            <div class="meta-thumb"><span>${escapeHtml(campaign.name.slice(0, 2).toUpperCase())}</span></div>
            <div class="meta-ad-main">
              <div class="meta-status"><span></span>${campaign.ads} anuncios</div>
              <h3>${escapeHtml(campaign.name)}</h3>
              <p>Resumo consolidado da campanha no periodo selecionado.</p>
              <div class="meta-ad-metrics">
                ${metaAdMetric('Gasto', money(campaign.spend))}
                ${metaAdMetric('Impressoes', number(campaign.impressions))}
                ${metaAdMetric('Cliques', number(campaign.clicks))}
                ${metaAdMetric('CTR', `${ctr.toFixed(2)}%`)}
                ${metaAdMetric('CPC', money(cpc))}
                ${metaAdMetric(goal.metricLabel, campaign.resultados ? number(campaign.resultados) : '-')}
                ${metaAdMetric(goal.shortCostLabel, campaign.resultados ? money(campaign.spend / campaign.resultados) : '-')}
              </div>
            </div>
          </article>
        `;
      }).join('') || emptyState('Sem campanhas', 'Nenhuma campanha retornada.')}
    </div>
  `;
}

function renderMetaTable(rows, goal) {
  return `
    <section class="table-panel meta-table-panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Anuncio</th><th>Campanha</th><th>Gasto</th><th>Impressoes</th><th>Cliques</th><th>CTR</th><th>CPC</th><th>${escapeHtml(goal.metricLabel)}</th><th>${escapeHtml(goal.shortCostLabel)}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `<tr>
              <td><strong>${escapeHtml(row.ad_name || '-')}</strong></td>
              <td>${escapeHtml(row.campaign_name || '-')}</td>
              <td>${money(row.spend)}</td>
              <td>${number(row.impressions)}</td>
              <td>${number(row.clicks)}</td>
              <td>${Number(row.ctr || 0).toFixed(2)}%</td>
              <td>${money(row.cpc)}</td>
              <td>${row.resultados ? number(row.resultados) : '-'}</td>
              <td>${row.resultados ? money(row.spend / row.resultados) : '-'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMetaWeeklyTable(rows, goal) {
  const weeks = buildFourWeekSummary(rows);
  return `
    <div class="meta-weekly-report">
      <div class="meta-weekly-heading">
        <h3>Ultimas 4 semanas</h3>
        <span>Resumo consolidado por semana</span>
      </div>
      <section class="table-panel meta-table-panel meta-week-summary-panel">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Semana</th>
                <th>Periodo</th>
                <th>Gasto</th>
                <th>Impressoes</th>
                <th>Alcance</th>
                <th>Cliques</th>
                <th>CTR</th>
                <th>CPC</th>
                <th>${escapeHtml(goal.metricLabel)}</th>
                <th>${escapeHtml(goal.shortCostLabel)}</th>
              </tr>
            </thead>
            <tbody>
              ${weeks.map((week, index) => {
                const totals = summarizeMetaRows(week.rows);
                return `
                  <tr>
                    <td><strong>Semana ${index + 1}</strong></td>
                    <td>${date(week.since)} ate ${date(week.until)}</td>
                    <td>${money(totals.investimento)}</td>
                    <td>${number(totals.impressoes)}</td>
                    <td>${number(totals.alcance)}</td>
                    <td>${number(totals.cliques)}</td>
                    <td>${totals.ctr.toFixed(2)}%</td>
                    <td>${money(totals.cpc)}</td>
                    <td>${totals.resultados ? number(totals.resultados) : '-'}</td>
                    <td>${totals.resultados ? money(totals.custo_por_resultado) : '-'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function metaKpi(title, value, sub = '', wide = false, comparison = '') {
  return `
    <article class="meta-kpi ${wide ? 'wide' : ''}">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${sub ? `<small>${escapeHtml(sub)}</small>` : ''}
      ${comparison || ''}
    </article>
  `;
}

function metaComparison(current, previous, formatter = number, inverse = false) {
  const currentValue = Number(current || 0);
  const previousValue = Number(previous || 0);
  const diff = currentValue - previousValue;
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  const performance = direction === 'flat' ? 'flat' : inverse ? (diff < 0 ? 'good' : 'bad') : (diff > 0 ? 'good' : 'bad');
  const pct = previousValue ? `${diff > 0 ? '+' : ''}${((diff / previousValue) * 100).toFixed(1)}%` : currentValue ? 'novo' : '0.0%';
  return `
    <div class="meta-kpi-compare">
      <small>Anterior: ${escapeHtml(formatter(previousValue))}</small>
      <em class="${performance}">${escapeHtml(pct)}</em>
    </div>
  `;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function renderMetaAdCard(row, goal) {
  return `
    <article class="meta-ad-card">
      <div class="meta-thumb">${row.thumb ? `<img src="${escapeHtml(row.thumb)}" alt="">` : `<span>${escapeHtml((row.ad_name || row.campaign_name || 'AD').slice(0, 2).toUpperCase())}</span>`}</div>
      <div class="meta-ad-main">
        <div class="meta-status"><span></span>Ativo</div>
        <h3>${escapeHtml(row.ad_name || row.campaign_name || '-')}</h3>
        <p>${escapeHtml(row.campaign_name || '')}${row.adset_name ? ` - ${escapeHtml(row.adset_name)}` : ''}</p>
        <div class="meta-ad-metrics">
          ${metaAdMetric('Gasto', money(row.spend))}
          ${metaAdMetric('Impressoes', number(row.impressions))}
          ${metaAdMetric('Cliques', number(row.clicks))}
          ${metaAdMetric('CTR', `${Number(row.ctr || 0).toFixed(2)}%`)}
          ${metaAdMetric('CPC', money(row.cpc))}
          ${metaAdMetric(goal.metricLabel, row.resultados ? number(row.resultados) : '-')}
          ${metaAdMetric(goal.shortCostLabel, row.resultados ? money(row.spend / row.resultados) : '-')}
        </div>
      </div>
    </article>
  `;
}

function metaAdMetric(labelText, value) {
  return `<div><span>${escapeHtml(labelText)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderGbp() {
  const report = state.gbp.report;
  if (!state.gbp.tab) state.gbp.tab = 'nova';
  const selectedSaved = state.gmnAnalises.find((item) => item.id === state.gbp.selectedSavedId);
  return `
    ${pageHeader('GMN Análises', 'Modulo dedicado a analises locais do Google Meu Negocio.')}
    <div class="section-tabs">
      <button class="tab-button ${state.gbp.tab === 'nova' ? 'active' : ''}" data-action="gbp-tab" data-tab="nova">Nova analise</button>
      <button class="tab-button ${state.gbp.tab === 'salvas' ? 'active' : ''}" data-action="gbp-tab" data-tab="salvas">Analises salvas</button>
    </div>
    ${state.gbp.tab === 'salvas' ? `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Analises salvas</h2>
            <p class="muted">${state.gmnAnalises.length} diagnostico(s) armazenados.</p>
          </div>
        </div>
        ${renderGbpSavedList()}
      </section>
      ${selectedSaved ? renderGbpReport(selectedSaved.report || {}, { saved: true }) : ''}
    ` : `
      <section class="panel gbp-control-panel">
        <div class="panel-header"><h2>Analise local do perfil</h2>${statusBadge('em_andamento')}</div>
        <p class="muted">Localiza o perfil no Google Places, cria uma grade ao redor do ponto escolhido e mede a posicao do negocio nos 20 primeiros resultados para a palavra-chave.</p>
        <div class="form-grid">
          <label>Cliente
            <select data-action="gbp-client">
              <option value="">Sem cliente vinculado</option>
              ${state.clientes.map((cliente) => `<option value="${cliente.id}" ${state.gbp.clienteId === cliente.id ? 'selected' : ''}>${escapeHtml(cliente.nome_empresa)}</option>`).join('')}
            </select>
          </label>
          <label>Perfil, nome, endereco ou link Maps
            <input class="input" data-action="gbp-query" value="${escapeHtml(state.gbp.businessQuery)}" placeholder="Ex: The Midia Marketing Campinas">
          </label>
          <label>Palavra-chave
            <input class="input" data-action="gbp-keyword" value="${escapeHtml(state.gbp.keyword)}" placeholder="Ex: agencia de marketing">
          </label>
          <label>Raio
            <select data-action="gbp-radius">
              ${[
                ['0.5', '0,5 km'],
                ['1', '1 km'],
                ['2', '2 km'],
                ['3', '3 km'],
                ['5', '5 km'],
                ['10', '10 km'],
              ].map(([value, text]) => `<option value="${value}" ${Number(state.gbp.radiusKm) === Number(value) ? 'selected' : ''}>${text}</option>`).join('')}
            </select>
          </label>
          <label>Centro da grade opcional
            <input class="input" data-action="gbp-center" value="${escapeHtml(state.gbp.searchCenter)}" placeholder="URL do Maps com @lat,lng ou lat,lng">
          </label>
          <label>Raio por busca
            <select data-action="gbp-search-radius">
              ${[
                ['', 'Auto'],
                ['500', '500 m'],
                ['1000', '1 km'],
                ['1500', '1,5 km'],
                ['3000', '3 km'],
              ].map(([value, text]) => `<option value="${value}" ${String(state.gbp.searchRadiusMeters) === value ? 'selected' : ''}>${text}</option>`).join('')}
            </select>
          </label>
          <label>Grade
            <select data-action="gbp-grid">
              ${[3, 5, 7, 9].map((size) => `<option value="${size}" ${Number(state.gbp.gridSize) === size ? 'selected' : ''}>${size} x ${size}</option>`).join('')}
            </select>
          </label>
          <div class="form-actions">
            <button class="button" data-action="gbp-fetch" type="button"><i data-lucide="map-pinned"></i>Gerar diagnostico</button>
          </div>
        </div>
        ${state.gbp.loading ? loadingState('Consultando Google Places...') : ''}
        ${state.gbp.error ? `<div class="state"><strong>Erro no GMN</strong><span>${escapeHtml(state.gbp.error)}</span></div>` : ''}
      </section>
      ${report ? renderGbpReport(report) : emptyState('Nenhum diagnostico gerado', 'Preencha os dados acima e gere a analise local do perfil.')}
    `}
  `;
}

function renderGbpSavedList() {
  if (state.gmnAnalisesMissingTable) return emptyState('Tabela nao criada', 'Aguarde a migration de analises GMN ser aplicada no Supabase.');
  if (!state.gmnAnalises.length) return emptyState('Nenhuma analise salva', 'Gere um diagnostico e clique em Salvar analise.');
  return renderTablePanel('gmn-analises', ['Perfil', 'Cliente', 'Palavra-chave', 'Score', 'Gerado em', ''], state.gmnAnalises.map((item) => `
    <tr class="${state.gbp.selectedSavedId === item.id ? 'row-highlight' : ''}">
      <td><strong>${escapeHtml(item.nome_perfil)}</strong><span class="muted">${escapeHtml(item.endereco || '')}</span></td>
      <td>${escapeHtml(item.clientes?.nome_empresa || getClienteName(item.cliente_id) || '-')}</td>
      <td>${escapeHtml(item.palavra_chave || '-')}</td>
      <td><strong>${Number(item.score || item.saude_perfil || 0).toFixed(0)}%</strong></td>
      <td>${date(item.gerado_em || item.created_at)}</td>
      <td class="row-actions">
        <button class="ghost-button" data-action="gbp-saved-open" data-id="${item.id}"><i data-lucide="eye"></i>Abrir</button>
        <button class="icon-button" data-action="gbp-saved-delete" data-id="${item.id}" aria-label="Excluir"><i data-lucide="trash-2"></i></button>
      </td>
    </tr>`).join(''));
}

function renderGbpReport(report, options = {}) {
  const center = report.center || report.details?.location || {};
  const centerSource = report.centerSource === 'business' ? 'endereco do estabelecimento' : report.centerSource === 'url' ? 'URL do Google Maps' : 'coordenadas manuais';
  const generatedAt = report.generatedAt ? new Date(report.generatedAt).toLocaleString('pt-BR') : '-';
  const searchBias = report.searchBiasMeters ? `${Number(report.searchBiasMeters).toLocaleString('pt-BR')} m` : 'auto';
  return `
    <section class="print-section gbp-report">
      <div class="gbp-report-actions screen-only">
        ${options.saved ? '' : `<button class="secondary-button" data-action="gbp-save-report"><i data-lucide="save"></i>Salvar analise</button>`}
        <button class="button" data-action="print"><i data-lucide="printer"></i>Salvar em PDF</button>
      </div>

      <header class="gbp-report-header gbp-report-hero">
        <div class="gbp-hero-main">
          <p class="gbp-blue-eyebrow">Analise de Ranking</p>
          <h2>${escapeHtml(report.details?.name || 'Perfil analisado')}</h2>
          <p>${escapeHtml(report.details?.address || '')}</p>
          <div class="gbp-report-tags">
            <span><i data-lucide="search"></i>${escapeHtml(report.keyword || '-')}</span>
            <span><i data-lucide="calendar-clock"></i>${escapeHtml(generatedAt)}</span>
            <span><i data-lucide="scan-search"></i>${escapeHtml(report.gridSize || '-')} x ${escapeHtml(report.gridSize || '-')}</span>
          </div>
        </div>
        <div class="gbp-score-card">
          <strong>${escapeHtml(`${report.health?.score || 0}%`)}</strong>
          <span>saude do perfil</span>
        </div>
      </header>

      <section class="gbp-report-overview">
        <article class="gbp-light-panel gbp-method-card">
          <div class="gbp-section-title">
            <span><i data-lucide="route"></i></span>
            <div>
              <h3>Configuracao da busca</h3>
              <p>Como a grade foi montada para medir o ranking local.</p>
            </div>
          </div>
          <div class="gbp-method-cards">
            ${gbpInfoCard('Centro', centerSource, formatGbpPoint(center))}
            ${gbpInfoCard('Grade', `${report.gridSize || '-'} x ${report.gridSize || '-'}`, `${report.metrics?.totalPoints || 0} pontos analisados`)}
            ${gbpInfoCard('Raio da grade', `${report.radiusKm || '-'} km`, `${report.searchAreaKm2 || '-'} km2 de cobertura`)}
            ${gbpInfoCard('Busca por ponto', searchBias, `Espacamento ${report.gridStepKm || 'auto'} km`)}
          </div>
          ${report.warning ? `<p class="gbp-method-warning">${escapeHtml(report.warning)}</p>` : ''}
        </article>

        <article class="gbp-light-panel gbp-reading-card">
          <div class="gbp-section-title">
            <span><i data-lucide="activity"></i></span>
            <div>
              <h3>Leitura rapida</h3>
              <p>Indicadores principais para entender o resultado.</p>
            </div>
          </div>
          <div class="gbp-mini-metrics">
            ${gbpMiniMetric(report.metrics?.arp || report.metrics?.averagePosition || '20+', 'ARP')}
            ${gbpMiniMetric(report.metrics?.atrp || '20+', 'ATRP')}
            ${gbpMiniMetric(`${report.metrics?.solv || 0}%`, 'solV')}
            ${gbpMiniMetric(`${report.metrics?.foundPoints || 0} / ${report.metrics?.totalPoints || 0}`, 'P.E')}
          </div>
        </article>
      </section>

      <section class="gbp-light-panel gbp-metric-legend-panel">
        <div class="gbp-section-title">
          <span><i data-lucide="book-open-check"></i></span>
          <div>
            <h3>Legenda das metricas</h3>
            <p>Quanto menor ARP e ATRP, melhor. Quanto maior solV e P.E, melhor.</p>
          </div>
        </div>
        <div class="gbp-definition-grid">
          ${gbpDefinition('ARP', 'Posicao media quando o perfil foi encontrado.')}
          ${gbpDefinition('ATRP', 'Posicao media total, contando pontos nao encontrados como fora do top 20.')}
          ${gbpDefinition('solV', 'Percentual da grade em que o perfil apareceu no top 3.')}
          ${gbpDefinition('P.E', 'Pontos encontrados dentro do total analisado.')}
        </div>
      </section>

      ${renderGbpMapSection(report)}

      <div class="gbp-metric-row">
        ${gbpBigMetric(`${report.metrics?.visibility || 0}%`, 'visibilidade no grid')}
        ${gbpBigMetric(report.metrics?.averagePosition || '20+', 'posicao media')}
        ${gbpBigMetric(report.metrics?.bestPosition || '20+', 'melhor posicao')}
        ${gbpBigMetric(report.details?.userRatingsTotal || 0, 'avaliacoes')}
      </div>

      <section class="gbp-light-panel">
        <h3>Grade de ranking</h3>
        ${renderGbpRankingGrid(report)}
      </section>

      <section class="gbp-light-panel">
        <h3>Diagnostico e proximas acoes</h3>
        <div class="gbp-recommendations">${(report.recommendations || []).map(renderGbpRecommendation).join('')}</div>
      </section>

      <section class="gbp-light-panel">
        <h3>Checklist do perfil</h3>
        <div class="gbp-checks">${(report.health?.checks || []).map(renderGbpCheck).join('')}</div>
      </section>

      <section class="gbp-light-panel">
        <h3>Concorrentes mais recorrentes</h3>
        <div class="table-wrap">
          <table class="gbp-competitors-table">
            <thead><tr><th>Concorrente</th><th>Nota</th><th>Avaliacoes</th><th>Encontrado</th><th>ARP</th><th>ATRP</th><th>solV</th></tr></thead>
            <tbody>${(report.competitors || []).slice(0, 20).map((item) => `<tr>
              <td><strong>${escapeHtml(item.name)}</strong><br><span>${escapeHtml(item.address || '')}</span></td>
              <td>${escapeHtml(item.rating || '-')}</td>
              <td>${number(item.userRatingsTotal || 0)}</td>
              <td>${escapeHtml(item.foundLabel || `${item.appearances || 0} / ${report.metrics?.totalPoints || 0}`)}<br><span>${escapeHtml(item.visibility || 0)}%</span></td>
              <td>${escapeHtml(item.arp || item.averagePosition || '-')}</td>
              <td>${escapeHtml(item.atrp || '-')}</td>
              <td>${escapeHtml(item.solv || 0)}%</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </section>

      <section class="gbp-light-panel">
        <h3>Dados do perfil</h3>
        ${renderGbpProfileData(report)}
      </section>
    </section>
  `;
}

function gbpMiniMetric(value, labelText) {
  return `<article><strong>${escapeHtml(value)}</strong><span>${escapeHtml(labelText)}</span></article>`;
}

function gbpBigMetric(value, labelText) {
  return `<article><strong>${escapeHtml(value)}</strong><span>${escapeHtml(labelText)}</span></article>`;
}

function gbpInfoCard(title, value, text) {
  return `
    <article class="gbp-info-card">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(text)}</small>
    </article>
  `;
}

function gbpDefinition(labelText, text) {
  return `
    <article class="gbp-definition">
      <strong>${escapeHtml(labelText)}</strong>
      <p>${escapeHtml(text)}</p>
    </article>
  `;
}

function renderGbpMapSection(report) {
  return `
    <section class="gbp-light-panel">
      <h3>Mapa de locais da regiao com a busca "${escapeHtml(report.keyword)}"</h3>
      ${renderGbpMap(report)}
    </section>
  `;
}

function renderGbpMap(report) {
  const points = report.localResults || [];
  const bounds = getGbpBounds(points, report.details?.location, report.center);
  const map = buildStaticOsmMap(bounds);
  const business = report.details?.location;
  return `
    <div class="gbp-map">
      <div class="gbp-map-tiles">
        ${map.tiles.map((tile) => `<img src="${tile.url}" alt="" loading="lazy" style="left:${tile.left}%;top:${tile.top}%;width:${tile.width}%;height:${tile.height}%;">`).join('')}
      </div>
      <div class="gbp-map-overlay">
        ${points.map((item) => {
          const point = item.point || {};
          const pos = projectStaticMapPoint(point, map);
          const labelText = item.position ? String(item.position) : '20+';
          return `<span class="gbp-map-dot ${gbpPositionClass(item.position)}" style="left:${pos.x}%;top:${pos.y}%;">${escapeHtml(labelText)}</span>`;
        }).join('')}
        ${business ? (() => {
          const pos = projectStaticMapPoint(business, map);
          return `<span class="gbp-business-pin" style="left:${pos.x}%;top:${pos.y}%;" aria-hidden="true"></span>`;
        })() : ''}
      </div>
    </div>
  `;
}

function buildStaticOsmMap(bounds) {
  const size = { width: 1200, height: 330 };
  const center = bounds.center;
  const zoom = chooseStaticMapZoom(bounds, size);
  const centerPx = latLngToWorldPixel(center.lat, center.lng, zoom);
  const viewport = {
    minX: centerPx.x - size.width / 2,
    maxX: centerPx.x + size.width / 2,
    minY: centerPx.y - size.height / 2,
    maxY: centerPx.y + size.height / 2,
  };
  const minTileX = Math.floor(viewport.minX / 256);
  const maxTileX = Math.floor(viewport.maxX / 256);
  const minTileY = Math.floor(viewport.minY / 256);
  const maxTileY = Math.floor(viewport.maxY / 256);
  const tiles = [];
  const maxTiles = 2 ** zoom;
  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let y = minTileY; y <= maxTileY; y += 1) {
      if (y < 0 || y >= maxTiles) continue;
      const wrappedX = ((x % maxTiles) + maxTiles) % maxTiles;
      tiles.push({
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        left: ((x * 256 - viewport.minX) / size.width) * 100,
        top: ((y * 256 - viewport.minY) / size.height) * 100,
        width: (256 / size.width) * 100,
        height: (256 / size.height) * 100,
      });
    }
  }
  return { ...size, zoom, viewport, tiles };
}

function chooseStaticMapZoom(bounds, size) {
  for (let zoom = 16; zoom >= 7; zoom -= 1) {
    const nw = latLngToWorldPixel(bounds.maxLat, bounds.minLng, zoom);
    const se = latLngToWorldPixel(bounds.minLat, bounds.maxLng, zoom);
    const spanX = Math.abs(se.x - nw.x);
    const spanY = Math.abs(se.y - nw.y);
    if (spanX <= size.width * 0.96 && spanY <= size.height * 0.90) return zoom;
  }
  return 7;
}

function projectStaticMapPoint(point, map) {
  const pixel = latLngToWorldPixel(point.lat, point.lng, map.zoom);
  return {
    x: ((pixel.x - map.viewport.minX) / map.width) * 100,
    y: ((pixel.y - map.viewport.minY) / map.height) * 100,
  };
}

function latLngToWorldPixel(lat, lng, zoom) {
  const sinLat = Math.sin((Number(lat) * Math.PI) / 180);
  const scale = 256 * 2 ** zoom;
  return {
    x: ((Number(lng) + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function getGbpBounds(points, businessLocation, centerLocation) {
  const gridPointsOnly = points.map((item) => item.point).filter((point) => point?.lat && point?.lng);
  const allPoints = gridPointsOnly.length
    ? gridPointsOnly
    : [businessLocation, centerLocation].filter((point) => point?.lat && point?.lng);
  if (!allPoints.length) {
    return { minLat: -23, maxLat: -22.8, minLng: -47.2, maxLng: -47, center: { lat: -22.9, lng: -47.1 } };
  }
  const lats = allPoints.map((point) => Number(point.lat));
  const lngs = allPoints.map((point) => Number(point.lng));
  const minLatRaw = Math.min(...lats);
  const maxLatRaw = Math.max(...lats);
  const minLngRaw = Math.min(...lngs);
  const maxLngRaw = Math.max(...lngs);
  const latSpan = Math.max(maxLatRaw - minLatRaw, 0.001);
  const lngSpan = Math.max(maxLngRaw - minLngRaw, 0.001);
  const latPad = Math.max(latSpan * 0.08, 0.0022);
  const lngPad = Math.max(lngSpan * 0.08, 0.0022);
  return {
    minLat: minLatRaw - latPad,
    maxLat: maxLatRaw + latPad,
    minLng: minLngRaw - lngPad,
    maxLng: maxLngRaw + lngPad,
    center: {
      lat: (minLatRaw + maxLatRaw) / 2,
      lng: (minLngRaw + maxLngRaw) / 2,
    },
  };
}

function renderGbpRankingGrid(report) {
  const gridSize = Number(report.gridSize || Math.sqrt((report.rankingMatrix || []).length) || 5);
  return `
    <div class="gbp-ranking-grid" style="grid-template-columns: repeat(${gridSize}, minmax(36px, 1fr));">
      ${(report.rankingMatrix || []).map((item) => `<button type="button" class="gbp-rank-cell ${gbpPositionClass(item.position)}" title="${escapeHtml(`${item.lat}, ${item.lng}${item.topResult ? ` | 1o resultado: ${item.topResult}` : ''}`)}">${escapeHtml(item.label || (item.position ? String(item.position) : '20+'))}</button>`).join('')}
    </div>
    <div class="gbp-legend"><span><b class="good"></b>Top 3</span><span><b class="mid"></b>4 a 10</span><span><b class="bad"></b>Fora do top 10/20+</span></div>
  `;
}

function renderGbpProfileData(report) {
  const details = report.details || {};
  const fields = [
    ['Nome', details.name],
    ['Endereco', details.address],
    ['Telefone', details.phone || 'Nao encontrado'],
    ['Site', details.website || 'Nao encontrado'],
    ['Google Maps', details.googleUrl || 'Nao encontrado'],
    ['Nota', details.rating ? `${details.rating} (${details.userRatingsTotal} avaliacoes)` : 'Nao encontrada'],
    ['Avaliacoes sem resposta', details.totalReviewsFromApi > 0 ? `${details.unansweredReviews} de ${details.totalReviewsFromApi} recentes sem resposta` : 'Verificar manualmente'],
    ['Fotos', details.photos],
    ['Categorias', (details.types || []).join(', ')],
    ['Status', details.businessStatus || 'Nao informado'],
    ['Horarios', (details.weekdayText || []).join(' | ') || 'Nao encontrados'],
  ];
  return `<dl class="gbp-profile-data">${fields.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${renderGbpValue(value)}</dd>`).join('')}</dl>`;
}

function renderGbpValue(value) {
  const text = String(value ?? '');
  if (text.startsWith('http')) return `<a href="${escapeHtml(text)}" target="_blank" rel="noreferrer">${escapeHtml(text)}</a>`;
  return escapeHtml(text);
}

function renderGbpCheck(item) {
  const statusClass = item.manual ? 'manual' : item.ok ? 'ok' : 'bad';
  const statusLabel = item.manual ? 'Verificar' : item.ok ? 'OK' : 'Melhorar';
  const profileLink = item.profileUrl ? ` <a href="${escapeHtml(item.profileUrl)}" target="_blank" rel="noreferrer">Ver perfil</a>` : '';
  return `
    <article class="gbp-check ${statusClass}">
      <span class="gbp-check-dot"></span>
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        <p>${escapeHtml(item.observation || '')}${profileLink}</p>
        <small><b>Como melhorar:</b> ${escapeHtml(item.recommendation || '')}</small>
      </div>
      <span class="gbp-check-status">${escapeHtml(statusLabel)}</span>
    </article>
  `;
}

function renderGbpRecommendation(item) {
  return `
    <article class="gbp-recommendation priority-${String(item.priority || 'media').toLowerCase()}">
      <span>${escapeHtml(item.priority || 'Media')}</span>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.body)}</p>
      </div>
    </article>
  `;
}

function gbpPositionClass(position) {
  if (!position || position > 10) return 'rank-bad';
  if (position <= 3) return 'rank-good';
  return 'rank-mid';
}

function formatGbpPoint(point) {
  if (!point?.lat || !point?.lng) return '-';
  return `${Number(point.lat).toFixed(6)}, ${Number(point.lng).toFixed(6)}`;
}

function renderTarefas() {
  const view = state.taskView || 'hoje';
  const filteredTasks = filterTasksByResponsible(state.tarefas);
  const overdue = getOverdueTasks(filteredTasks).length;
  const openTasks = filteredTasks.filter((t) => !['concluida', 'cancelada'].includes(t.status)).length;
  const doneTasks = filteredTasks.filter((t) => t.status === 'concluida').length;
  const responsibleOptions = getTaskResponsibleOptions();
  const selectedResponsible = state.taskResponsibleFilter || 'all';
  const viewTabs = [
    { key: 'hoje', label: 'Hoje' },
    { key: 'semana', label: 'Esta semana' },
    { key: 'todas', label: 'Todas' },
  ];

  const categoriesHtml = view === 'hoje'
    ? renderTodayTaskList(filteredTasks)
    : [...new Set(filteredTasks.map((t) => t.categoria || 'Geral'))].sort().map((cat) => renderCategoryGroup(cat, view, filteredTasks)).join('');

  return `
    <section class="task-page">
      ${pageHeader('Tarefas', `${overdue} vencidas.`, `<button class="secondary-button" data-action="export" data-entity="tarefas"><i data-lucide="download"></i>CSV</button><button class="button" data-action="new" data-entity="tarefas"><i data-lucide="plus"></i>Nova tarefa</button>`)}
      <div class="task-summary-grid">
        ${taskSummaryCard('Abertas', openTasks, 'circle-dot', 'blue')}
        ${taskSummaryCard('Vencidas', overdue, 'calendar-alert', overdue ? 'red' : 'green')}
        ${taskSummaryCard('Concluidas', doneTasks, 'badge-check', 'green')}
        ${taskSummaryCard('Total', filteredTasks.length, 'list-checks', 'neutral')}
      </div>
      <section class="task-board-panel">
        <div class="task-toolbar">
          <div class="task-view-tabs">
            ${viewTabs.map((t) => `<button type="button" class="${view === t.key ? 'active' : ''}" data-action="task-view" data-view="${t.key}">${t.label}</button>`).join('')}
          </div>
          <div class="task-toolbar-actions">
            <label class="task-filter-label">
              <i data-lucide="user-round"></i>
              <select data-action="task-responsible-filter">
                <option value="all"${selectedResponsible === 'all' ? ' selected' : ''}>Todos os responsaveis</option>
                <option value="__none__"${selectedResponsible === '__none__' ? ' selected' : ''}>Sem responsavel</option>
                ${responsibleOptions.map((name) => `<option value="${escapeHtml(name)}"${selectedResponsible === name ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('')}
              </select>
            </label>
            <span><i data-lucide="arrow-up-down"></i>Vencimento</span>
          </div>
        </div>
        ${categoriesHtml}
      </section>
    </section>
  `;
}

function taskSummaryCard(title, value, icon, tone = 'neutral') {
  return `
    <article class="task-summary tone-${tone}">
      <div class="task-summary-icon"><i data-lucide="${icon}"></i></div>
      <div class="task-summary-body">
        <span class="task-summary-label">${escapeHtml(title)}</span>
        <span class="task-summary-value">${escapeHtml(String(value))}</span>
      </div>
    </article>
  `;
}

function filterTasksForView(tasks, view) {
  if (view === 'todas') return tasks;
  const today = isoDate(new Date());
  const weekEnd = isoDate(new Date(Date.now() + 7 * 86400000));
  if (view === 'hoje') return tasks.filter((t) => t.data_vencimento && t.data_vencimento <= today);
  if (view === 'semana') return tasks.filter((t) => t.data_vencimento && t.data_vencimento <= weekEnd);
  return tasks;
}

function getTaskResponsibleOptions(tasks = state.tarefas) {
  return [...new Set(tasks.map((task) => String(task.responsavel || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function getTaskResponsibleFormOptions() {
  const names = [{ value: 'Roberto', label: 'Roberto (CEO)' }];
  state.equipe.forEach((member) => {
    if (member.status && member.status !== 'ativo') return;
    const name = String(member.nome || member.nome_completo || member.email || '').trim();
    if (name) names.push({ value: name, label: name });
  });
  const seen = new Set();
  return names.filter((item) => {
    const key = item.value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterTasksByResponsible(tasks) {
  const selected = state.taskResponsibleFilter || 'all';
  if (selected === 'all') return tasks;
  if (selected === '__none__') return tasks.filter((task) => !String(task.responsavel || '').trim());
  return tasks.filter((task) => String(task.responsavel || '').trim() === selected);
}

function sortTasksByDueAndTitle(a, b) {
  const dateA = a.data_vencimento || '9999-12-31';
  const dateB = b.data_vencimento || '9999-12-31';
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');
}

function renderTodayTaskList(tasks) {
  const active = filterTasksForView(tasks.filter((t) => !['concluida', 'cancelada'].includes(t.status)), 'hoje')
    .sort(sortTasksByDueAndTitle);
  return `
    <section class="task-category-group task-today-group">
      <div class="task-category-header">
        <i data-lucide="calendar-check"></i>
        <strong>Hoje</strong>
        <em>${active.length}</em>
      </div>
      <div class="task-list-head">
        <span>Nome</span>
        <span>Responsavel</span>
        <span>Vencimento</span>
        <span>Prioridade</span>
        <span></span>
      </div>
      <div class="task-status-rows">
        ${active.length ? active.map(renderTaskRow).join('') : `<div class="task-empty-row">Nenhuma tarefa para hoje.</div>`}
        <button class="task-add-row-btn" type="button" data-action="new" data-entity="tarefas"><i data-lucide="plus"></i>Adicionar Tarefa</button>
      </div>
    </section>
  `;
}

function renderCategoryGroup(cat, view, tasks = state.tarefas) {
  const catTasks = tasks.filter((t) => (t.categoria || 'Geral') === cat);
  const active = filterTasksForView(catTasks.filter((t) => !['concluida', 'cancelada'].includes(t.status)), view);
  const done = catTasks.filter((t) => t.status === 'concluida');
  const cancelled = catTasks.filter((t) => t.status === 'cancelada');

  if (view !== 'todas' && active.length === 0 && done.length === 0) return '';

  const doneExpanded = !!(state.taskDoneExpanded && state.taskDoneExpanded[cat]);
  const catKey = encodeURIComponent(cat);

  // Active status groups
  const statusGroups = [
    ['pendente', 'Pendente'],
    ['em_andamento', 'Em andamento'],
  ];
  const activeGroupsHtml = statusGroups.map(([status, label]) => {
    const rows = active.filter((t) => t.status === status);
    if (rows.length === 0 && view !== 'todas') return '';
    return `
      <div class="task-status-group">
        <div class="task-status-group-head">
          <span class="task-status-dot status-${escapeHtml(status)}"></span>
          <strong>${escapeHtml(label.toUpperCase())}</strong>
          <em>${rows.length}</em>
        </div>
        <div class="task-status-rows">
          ${rows.length ? rows.map(renderTaskRow).join('') : `<div class="task-empty-row">Nenhuma tarefa aqui.</div>`}
          <button class="task-add-row-btn" type="button" data-action="new" data-entity="tarefas"><i data-lucide="plus"></i>Adicionar Tarefa</button>
        </div>
      </div>`;
  }).join('');

  // Concluidas collapsible
  const doneHtml = done.length ? `
    <div class="task-done-toggle">
      <button class="task-done-toggle-btn" type="button" data-action="toggle-done" data-cat="${catKey}">
        <i data-lucide="${doneExpanded ? 'chevron-down' : 'chevron-right'}"></i>
        <span class="task-status-dot status-concluida"></span>
        <strong>CONCLUIDAS</strong>
        <em>${done.length}</em>
      </button>
      ${doneExpanded ? `<div class="task-status-rows">${done.map(renderTaskRow).join('')}</div>` : ''}
    </div>` : '';

  return `
    <section class="task-category-group">
      <div class="task-category-header">
        <i data-lucide="list"></i>
        <strong>${escapeHtml(cat)}</strong>
        <em>${catTasks.length}</em>
      </div>
      <div class="task-list-head">
        <span>Nome</span>
        <span>Responsavel</span>
        <span>Vencimento</span>
        <span>Prioridade</span>
        <span></span>
      </div>
      ${activeGroupsHtml}
      ${doneHtml}
    </section>
  `;
}

function renderPlaybooks() {
  const setupItems = [
    'Objetivo padrao: Engajamento para Mensagens no WhatsApp.',
    'Prospecção ampla com raio de 5 a 10 km e idade de 18 a 45 anos.',
    'Usar Advantage+ em posicionamentos, priorizando Reels e Stories.',
    'Separar retargeting com engajadores, lista de WhatsApp e visitantes.',
    'Com verba baixa, preferir ABO para controlar melhor cada conjunto.',
  ];
  const creativeAngles = [
    ['Portfolio e resultado', 'Mostrar furos, joias, variedade, antes e depois. Gera desejo.'],
    ['Quebra de medo', 'Higiene, material descartavel, profissional certificado, dor e seguranca.'],
    ['Oferta', 'Combo, joia inclusa, condicao da semana ou data comemorativa.'],
    ['Prova social', 'Depoimentos, reacao na hora do furo e avaliacoes.'],
    ['Bastidores', 'Processo, esterilizacao, acolhimento e rotina do estudio.'],
    ['Educativo', 'Tipos de piercing, cuidados pos e escolha de joia.'],
  ];
  const routineItems = [
    'Diario: olhar entrega e custo por conversa. Pausar criativo acima de R$ 20 por conversa.',
    'A cada 7 dias: trocar o pior criativo, conferir frequencia e ajustar verba.',
    'Semanal: enviar relatorio em linguagem simples para o cliente no WhatsApp.',
    'Mensal: planejar ganchos, novas ofertas e novos criativos.',
  ];
  const onboardingRows = [
    ['Setup', 'Dias 1 a 3', 'Acessos, WhatsApp configurado, briefing, fotos e videos do portfolio.'],
    ['Criativos iniciais', 'Dias 3 a 7', 'Produzir os 6 angulos e subir a estrutura padrao.'],
    ['Validacao', 'Semana 2 a 3', 'Sair do aprendizado e achar criativo e publico campeoes.'],
    ['Otimizacao', 'Semana 4', 'Cortar o que nao anda, escalar campeao e entregar primeiro relatorio.'],
  ];

  return `
    ${pageHeader('Playbooks', 'Metodos operacionais para o gestor aplicar em clientes novos.', '')}
    <section class="panel playbook-hero">
      <div>
        <p class="eyebrow">Trafego pago para estudio de piercing</p>
        <h2>Metodo The Midia Marketing</h2>
        <p>Use este playbook sempre que um estudio de piercing entrar. A base vem do case Audrei Piercing e deve ser atualizada a cada novo aprendizado.</p>
      </div>
      <div class="playbook-score-grid">
        ${areaSummary('Objetivo padrao', 'Mensagens no WhatsApp')}
        ${areaSummary('Régua boa', 'ate R$ 10 por conversa')}
        ${areaSummary('Cortar', 'acima de R$ 20 por conversa')}
      </div>
    </section>

    <section class="grid-2 playbook-grid">
      <article class="panel">
        <div class="panel-header"><h3>Por que o nicho funciona</h3></div>
        <div class="playbook-list">
          <p><strong>Venda mais facil:</strong> a agencia chega como especialista em estudios de piercing.</p>
          <p><strong>Entrega mais rapida:</strong> mesma conta, mesmos angulos e mesmo onboarding.</p>
          <p><strong>Margem maior:</strong> processo padronizado permite escalar sem depender de improviso.</p>
        </div>
      </article>
      <article class="panel">
        <div class="panel-header"><h3>Como o cliente decide</h3></div>
        <div class="playbook-list">
          <p>Decisao visual e por desejo. Portfolio converte mais que texto longo.</p>
          <p>Compra local por agendamento. O anuncio precisa puxar conversa no WhatsApp.</p>
          <p>Medo e a principal objecao. Criativo precisa mostrar seguranca, higiene e acolhimento.</p>
        </div>
      </article>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Estrutura de conta padrao</h3><span class="muted">Referencia: cerca de R$ 50 por dia</span></div>
      <div class="playbook-columns">
        <div class="playbook-step">
          <strong>Nucleo de conversao</strong>
          <span>R$ 23 por dia</span>
          <p>Campanha de Mensagens com 1 conjunto amplo. Motor principal do WhatsApp.</p>
        </div>
        <div class="playbook-step">
          <strong>Topo de funil local</strong>
          <span>R$ 10 por dia</span>
          <p>Impulsionamento de Reels mostrando estudio e localizacao para alcance local.</p>
        </div>
        <div class="playbook-step">
          <strong>Retargeting e teste</strong>
          <span>R$ 17 por dia</span>
          <p>Engajadores, lista de WhatsApp, visitantes e teste do proximo criativo.</p>
        </div>
      </div>
      <div class="playbook-checklist">
        ${setupItems.map((item) => `<span><i data-lucide="check-circle-2"></i>${escapeHtml(item)}</span>`).join('')}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Banco de criativos</h3><span class="muted">Manter 3 a 5 criativos ativos</span></div>
      <div class="playbook-angle-grid">
        ${creativeAngles.map(([title, text]) => `
          <article>
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(text)}</p>
          </article>
        `).join('')}
      </div>
      <div class="playbook-note">
        <strong>Regra de ouro:</strong> video curto com pessoa real em campanha de Mensagens e o formato prioritario. Clique e alcance podem enganar. O que importa e conversa qualificada no WhatsApp.
      </div>
    </section>

    <section class="grid-2 playbook-grid">
      <article class="panel">
        <div class="panel-header"><h3>Benchmarks do Audrei</h3></div>
        <div class="kv">
          ${areaSummary('Investimento total', 'R$ 32.353')}
          ${areaSummary('Conversas geradas', '6.294')}
          ${areaSummary('Custo medio por conversa', 'R$ 5,14')}
          ${areaSummary('Conversas que viraram venda', '1.708, 27,1%')}
          ${areaSummary('Ticket medio', 'R$ 524')}
          ${areaSummary('ROAS', '27,70x')}
        </div>
      </article>
      <article class="panel">
        <div class="panel-header"><h3>Rotina do gestor</h3></div>
        <div class="playbook-checklist vertical">
          ${routineItems.map((item) => `<span><i data-lucide="calendar-check"></i>${escapeHtml(item)}</span>`).join('')}
        </div>
      </article>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Primeiros 30 dias</h3><span class="muted">Onboarding do estudio novo</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fase</th><th>Quando</th><th>O que fazer</th></tr></thead>
          <tbody>
            ${onboardingRows.map(([phase, when, action]) => `
              <tr>
                <td><strong>${escapeHtml(phase)}</strong></td>
                <td>${escapeHtml(when)}</td>
                <td>${escapeHtml(action)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderTaskRow(tarefa) {
  const isDone = tarefa.status === 'concluida';
  const lists = tarefa.checklists || [];
  const clTotal = lists.reduce((s, l) => s + (l.items?.length || 0), 0);
  const clDone  = lists.reduce((s, l) => s + (l.items?.filter((i) => i.done).length || 0), 0);
  const clBadge = clTotal > 0
    ? `<span class="task-cl-badge${clDone === clTotal ? ' done' : ''}"><i data-lucide="list-checks"></i>${clDone}/${clTotal}</span>`
    : '';
  const recurIcon = tarefa.recorrencia_ativa && tarefa.recorrencia !== 'nenhuma'
    ? `<span class="task-recur-icon" title="${escapeHtml(taskRecurrenceText(tarefa))}"><i data-lucide="repeat-2"></i></span>`
    : '';
  return `
    <article class="task-row ${isDone ? 'is-done' : ''}" data-task-id="${tarefa.id}">
      <div class="task-title-cell">
        <button class="task-check ${isDone ? 'checked' : ''}" data-action="toggle-task-status" data-id="${tarefa.id}" data-status="${tarefa.status}" aria-label="Alternar status">
          <i data-lucide="${isDone ? 'check-circle-2' : 'circle'}"></i>
        </button>
        <div class="task-title-wrap">
          <button class="task-title-link" data-action="open-task-detail" data-id="${tarefa.id}">${escapeHtml(tarefa.titulo)}</button>
          ${(tarefa.descricao || clBadge || recurIcon) ? `<div class="task-row-sub">
            ${tarefa.descricao ? `<span class="task-row-desc">${escapeHtml(tarefa.descricao)}</span>` : ''}
            ${clBadge}${recurIcon}
          </div>` : ''}
        </div>
      </div>
      <div class="task-cell-assignee">${taskAssigneeBubble(tarefa.responsavel)}</div>
      <div class="task-cell-due">${taskDueDateCell(tarefa.data_vencimento, tarefa.status)}</div>
      <div class="task-cell-priority">${taskPriorityFlag(tarefa.prioridade)}</div>
      <div class="task-row-actions">${actionButtons('tarefas', tarefa.id)}</div>
    </article>
  `;
}

function taskAssigneeBubble(name) {
  if (!name || name === '-') return '<span class="task-assignee-empty">-</span>';
  const initials = String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const colors = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0891b2'];
  const idx = String(name).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return `<span class="task-assignee-bubble" style="background:${colors[idx]}" title="${escapeHtml(name)}">${escapeHtml(initials)}</span>`;
}

function taskDueDateCell(value, status) {
  if (!value) return '<span class="task-due-empty">-</span>';
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const due = new Date(`${value}T00:00:00`);
  const diff = Math.round((due - now) / 86400000);
  const isActive = !['concluida', 'cancelada'].includes(status);
  const overdue = diff < 0 && isActive;
  const soon = diff >= 0 && diff <= 1 && isActive;
  let lbl;
  if (diff < -1) lbl = `${Math.abs(diff)}d atraso`;
  else if (diff === -1) lbl = 'Ontem';
  else if (diff === 0) lbl = 'Hoje';
  else if (diff === 1) lbl = 'Amanha';
  else if (diff < 7) { const days = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']; lbl = days[due.getDay()]; }
  else lbl = date(value);
  return `<span class="task-due-cell${overdue ? ' overdue' : soon ? ' soon' : ''}"><i data-lucide="refresh-cw" style="width:11px;height:11px;opacity:.5"></i>${escapeHtml(lbl)}</span>`;
}

function taskPriorityFlag(priority) {
  const map = { urgente: { color: '#ef4444', label: 'Urgente' }, alta: { color: '#f59e0b', label: 'Alta' }, media: { color: '#94a3b8', label: 'Media' }, baixa: { color: '#cbd5e1', label: 'Baixa' } };
  const p = map[priority || 'media'] || map.media;
  return `<span class="task-priority-flag" style="color:${p.color}"><svg width="11" height="13" viewBox="0 0 11 13" fill="${p.color}" xmlns="http://www.w3.org/2000/svg"><rect width="1.5" height="13" rx=".75"/><path d="M1.5 1h9L7 5l3.5 4h-9V1z"/></svg>${escapeHtml(p.label)}</span>`;
}

function taskPriorityPill(priority) {
  const key = priority || 'media';
  return `<span class="task-priority priority-${escapeHtml(key)}"><i data-lucide="flag"></i>${escapeHtml(label(key))}</span>`;
}

function taskAssignee(name) {
  if (!name || name === '-') return '<span class="muted">-</span>';
  const initials = String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return `<span class="task-assignee"><b>${escapeHtml(initials)}</b>${escapeHtml(name)}</span>`;
}

function taskRecurringPill(tarefa) {
  if (!tarefa.recorrencia_ativa || tarefa.recorrencia === 'nenhuma') return '';
  if (tarefa.recorrencia === 'diaria') {
    return '<span class="task-recurring-pill"><i data-lucide="repeat-2"></i>diaria</span>';
  }
  if (tarefa.recorrencia === 'mensal_primeiro_dia_util') {
    return '<span class="task-recurring-pill"><i data-lucide="repeat-2"></i>1o dia util</span>';
  }
  const day = Number.isInteger(Number(tarefa.recorrencia_dia_semana)) ? Number(tarefa.recorrencia_dia_semana) : null;
  const dayLabel = day === null ? 'semanal' : weekDayLabels[day];
  return `<span class="task-recurring-pill"><i data-lucide="repeat-2"></i>${escapeHtml(dayLabel)}</span>`;
}

function taskRecurrenceText(tarefa) {
  if (!tarefa.recorrencia_ativa || tarefa.recorrencia === 'nenhuma') return 'Sem recorrencia';
  if (tarefa.recorrencia === 'diaria') return 'Todos os dias';
  if (tarefa.recorrencia === 'mensal_primeiro_dia_util') return 'Todo primeiro dia util do mes';
  const day = Number.isInteger(Number(tarefa.recorrencia_dia_semana)) ? Number(tarefa.recorrencia_dia_semana) : null;
  return `Toda ${day === null ? 'semana' : weekDayLabels[day].toLowerCase()}`;
}

function taskDuePill(value, status) {
  if (!value) return '<span class="muted">Sem data</span>';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${value}T00:00:00`);
  const overdue = due < today && !['concluida', 'cancelada'].includes(status);
  return `<span class="task-due ${overdue ? 'overdue' : ''}"><i data-lucide="calendar"></i>${date(value)}</span>`;
}

function renderDiario() {
  const today = isoDate(new Date());
  const selectedDate = state.diarioDate || today;
  const activeClientes = state.clientes.filter((cliente) => cliente.status === 'ativo');
  const diaryEntries = getDiaryRowsByDate(selectedDate);
  const doneCount = diaryEntries.filter((item) => !item.isVirtual).length;

  return `
    ${pageHeader('Diário de Bordo', 'Folha diária dos clientes ativos, com anotações do gestor e comentários do head de tráfego.', `<button class="secondary-button" data-action="export" data-entity="diario"><i data-lucide="download"></i>CSV</button>`)}
    ${state.diarioMissingTable ? `
      <section class="panel warning-panel">
        <strong>Tabela do Diario de Bordo ainda nao existe no Supabase</strong>
        <p>Execute o SQL em <code>supabase/migrations/20260606_diario_bordo.sql</code>. A tela pode ser visualizada, mas ainda nao vai salvar anotacoes.</p>
      </section>
    ` : ''}
    <section class="diary-date-panel panel">
      <label>Ver anotações do dia
        <input class="input" type="date" data-action="diary-date" value="${escapeHtml(selectedDate)}">
      </label>
      <button class="secondary-button" data-action="diary-today" type="button"><i data-lucide="calendar-days"></i>Hoje</button>
    </section>
    <section class="diary-quick panel">
      <div>
        <span>Data selecionada</span>
        <strong>${date(selectedDate)}</strong>
      </div>
      <div>
        <span>Clientes ativos</span>
        <strong>${activeClientes.length}</strong>
      </div>
      <div>
        <span>Preenchidos no dia</span>
        <strong>${doneCount}</strong>
      </div>
      <div>
        <span>Tarefas criadas</span>
        <strong>${diaryEntries.filter((item) => item.status === 'tarefa_criada').length}</strong>
      </div>
    </section>
    <section class="diary-doc">
      <header class="diary-doc-header">
        <h2>${date(selectedDate)}</h2>
        <p>Diario de bordo operacional</p>
      </header>
      <div class="diary-doc-list">
        ${diaryEntries.map(renderDiarioCard).join('') || emptyState('Nenhum cliente ativo', 'Cadastre ou ative clientes para montar o diario automaticamente.')}
      </div>
    </section>
  `;
}

function getDiaryRowsByDate(selectedDate) {
  const activeClientes = state.clientes.filter((cliente) => cliente.status === 'ativo');
  return activeClientes.map((cliente) => {
    const entry = state.diarios.find((item) => item.cliente_id === cliente.id && item.data_registro === selectedDate);
    return {
      id: entry?.id || '',
      cliente_id: cliente.id,
      clientes: { nome_empresa: cliente.nome_empresa },
      data_registro: selectedDate,
      autor: entry?.autor || 'Nicolas',
      revisao_verba_ok: entry?.revisao_verba_ok ?? false,
      anotacoes: entry?.anotacoes || '',
      comentario_admin: entry?.comentario_admin || '',
      tags: entry?.tags || '',
      status: entry?.status || 'aberto',
      isVirtual: !entry,
    };
  });
}

function renderDiarioCard(item) {
  const selected = state.diarioSelectedClienteId === item.cliente_id;
  return `
    <article class="diary-card ${selected ? 'selected' : ''}" data-action="diary-select" data-client="${item.cliente_id}">
      <div class="diary-card-top">
        <div>
          <h3>${escapeHtml(item.clientes?.nome_empresa || getClienteName(item.cliente_id) || 'Sem cliente')}</h3>
          <p>${escapeHtml(item.autor || 'Nicolas')} - ${item.revisao_verba_ok ? 'Revisao de verba e performance OK' : 'Revisao pendente'}</p>
        </div>
        ${statusBadge(item.status || 'aberto')}
      </div>
      <div class="diary-doc-fields">
        <label>
          <span>Observacoes do gestor de trafego</span>
          <textarea data-action="diary-field" data-field="anotacoes" data-id="${item.id}" data-client="${item.cliente_id}">${escapeHtml(item.anotacoes || '')}</textarea>
        </label>
        <label>
          <span>Observacoes do head de trafego</span>
          <textarea data-action="diary-field" data-field="comentario_admin" data-id="${item.id}" data-client="${item.cliente_id}" placeholder="Seu comentario interno, ajuste ou direcionamento...">${escapeHtml(item.comentario_admin || '')}</textarea>
        </label>
      </div>
      <label class="diary-check">
        <input type="checkbox" data-action="diary-ok" data-id="${item.id}" data-client="${item.cliente_id}" ${item.revisao_verba_ok ? 'checked' : ''}>
        Revisao diaria de verba e performance OK
      </label>
      ${selected ? `
        <div class="diary-context-actions">
          <button class="button" data-action="diary-to-task" data-id="${item.id}" data-client="${item.cliente_id}"><i data-lucide="check-square"></i>Adicionar tarefa</button>
          <button class="secondary-button" data-action="diary-to-observation" data-id="${item.id}" data-client="${item.cliente_id}"><i data-lucide="message-square-plus"></i>Salvar em observacoes</button>
        </div>
      ` : ''}
    </article>
  `;
}

function renderMetas() {
  // Linhas existentes indexadas por cliente
  const metasByCliente = {};
  state.metas.forEach((m) => {
    if (!metasByCliente[m.cliente_id]) metasByCliente[m.cliente_id] = [];
    metasByCliente[m.cliente_id].push(m);
  });

  const activeClientes = state.clientes.filter((c) => ['ativo', 'prospect'].includes(c.status));

  // helpers
  const objSel = (selected, id, field) =>
    `<select class="meta-cell-input" data-action="meta-cell-edit" data-id="${id}" data-field="${field}">
      ${['mensagens','leads','vendas','seguidores'].map((o) =>
        `<option value="${o}" ${selected === o ? 'selected' : ''}>${label(o)}</option>`
      ).join('')}
    </select>`;

  const numCell = (id, field, val) =>
    `<input class="meta-cell-input" type="number" min="0" step="0.01"
      placeholder="—" value="${val != null && val !== '' ? Number(val) : ''}"
      data-action="meta-cell-edit" data-id="${id}" data-field="${field}">`;

  // Linha nova (rascunho por cliente)
  const newObjSel = (clienteId) => {
    const draft = state.metaRowDrafts[clienteId] || {};
    return `<select class="meta-cell-input" data-action="meta-new-field" data-cliente="${clienteId}" data-field="objetivo">
      <option value="">Objetivo</option>
      ${['mensagens','leads','vendas','seguidores'].map((o) =>
        `<option value="${o}" ${draft.objetivo === o ? 'selected' : ''}>${label(o)}</option>`
      ).join('')}
    </select>`;
  };

  const newNum = (clienteId, field) => {
    const draft = state.metaRowDrafts[clienteId] || {};
    return `<input class="meta-cell-input" type="number" min="0" step="0.01"
      placeholder="—" value="${draft[field] != null ? draft[field] : ''}"
      data-action="meta-new-field" data-cliente="${clienteId}" data-field="${field}">`;
  };

  const rows = activeClientes.map((cliente) => {
    const metas = metasByCliente[cliente.id] || [];
    const hasMeta = metas.length > 0;

    // Linhas de metas existentes
    const existingRows = metas.map((m) => `
      <tr class="meta-row">
        <td rowspan="1" class="meta-cliente-name">
          <strong>${escapeHtml(cliente.nome_empresa)}</strong>
          <span class="muted">${escapeHtml(cliente.meta_ads_act || '')}</span>
        </td>
        <td>${objSel(m.objetivo, m.id, 'objetivo')}</td>
        <td>${numCell(m.id, 'meta_custo_resultado', m.meta_custo_resultado)}</td>
        <td>${numCell(m.id, 'meta_roas_minimo', m.meta_roas_minimo)}</td>
        <td>${numCell(m.id, 'meta_ctr_minimo', m.meta_ctr_minimo)}</td>
        <td>${numCell(m.id, 'verba_diaria_maxima', m.verba_diaria_maxima)}</td>
        <td>${numCell(m.id, 'threshold_variacao_pct', m.threshold_variacao_pct ?? 30)}</td>
        <td class="row-actions">
          <button class="icon-button" data-action="delete" data-entity="metas" data-id="${m.id}" aria-label="Remover meta"><i data-lucide="trash-2"></i></button>
          <button class="icon-button" title="Adicionar outro objetivo" data-action="meta-add-row" data-cliente="${cliente.id}"><i data-lucide="plus"></i></button>
        </td>
      </tr>`).join('');

    // Linha de nova meta para este cliente (aparece se não tem nenhuma, ou se o usuário clicou em +)
    const showNewRow = !hasMeta || (state.metaRowDrafts[cliente.id]?.open);
    const newRow = showNewRow ? `
      <tr class="meta-row meta-new-row" data-new-cliente="${cliente.id}">
        ${!hasMeta ? `<td class="meta-cliente-name"><strong>${escapeHtml(cliente.nome_empresa)}</strong><span class="muted">${escapeHtml(cliente.meta_ads_act || '')}</span></td>` : '<td></td>'}
        <td>${newObjSel(cliente.id)}</td>
        <td>${newNum(cliente.id, 'meta_custo_resultado')}</td>
        <td>${newNum(cliente.id, 'meta_roas_minimo')}</td>
        <td>${newNum(cliente.id, 'meta_ctr_minimo')}</td>
        <td>${newNum(cliente.id, 'verba_diaria_maxima')}</td>
        <td>${newNum(cliente.id, 'threshold_variacao_pct')}</td>
        <td class="row-actions">
          <button class="button" data-action="meta-new-save" data-cliente="${cliente.id}" style="white-space:nowrap; font-size:12px; padding:4px 10px"><i data-lucide="check"></i>Salvar</button>
        </td>
      </tr>` : '';

    return existingRows + newRow;
  }).join('');

  return `
    ${pageHeader('Metas de Performance', 'Preencha direto na tabela — salva automaticamente. O alerta de anomalias usa esses valores todo dia às 9h.', '')}
    <section class="panel" style="padding:0;overflow:hidden">
      <table class="table meta-inline-table">
        <thead><tr>
          <th>Cliente</th>
          <th>Objetivo</th>
          <th title="Custo máximo por resultado">Custo/resultado (R$)</th>
          <th title="ROAS mínimo aceitável">ROAS mín.</th>
          <th title="CTR mínimo em %">CTR mín. (%)</th>
          <th title="Limite de gasto diário">Verba diária máx. (R$)</th>
          <th title="% variação vs 7 dias para alerta">Alerta variação (%)</th>
          <th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function renderAlertas() {
  const metricaLabel = { cpl: 'Custo por Lead/Msg', ctr: 'CTR', roas: 'ROAS', spend: 'Gasto diario', diario: 'Anotacao do diario' };
  const metricaUnit  = { cpl: 'R$', ctr: '%', roas: 'x', spend: 'R$' };
  const severidadeClass = { critica: 'status-urgente', alta: 'status-alta', media: 'status-media' };

  if (state.alertasMissingTable) {
    return `
      ${pageHeader('Alertas de Anomalias', 'Monitoramento automatico de CPL, CTR, ROAS e verba.', '')}
      <section class="panel warning-panel">
        <strong>Tabela alertas_anomalia ainda nao existe no Supabase</strong>
        <p>Execute o SQL em <code>supabase/migrations/20260606_alertas_anomalia.sql</code> no Supabase SQL Editor para ativar os alertas.</p>
      </section>
    `;
  }

  const statusFiltro = state.alertasFiltroStatus || 'ativo';
  const sevFiltro    = state.alertasFiltroSeveridade || 'all';
  const alertasComPiora = state.alertas.filter((alerta) => !isImprovingAlert(alerta));

  let lista = alertasComPiora.filter((a) => {
    if (statusFiltro !== 'all' && a.status !== statusFiltro) return false;
    if (sevFiltro !== 'all' && a.severidade !== sevFiltro) return false;
    return true;
  });

  const totalAtivos   = alertasComPiora.filter((a) => a.status === 'ativo').length;
  const totalCriticos = alertasComPiora.filter((a) => a.status === 'ativo' && a.severidade === 'critica').length;
  const totalAltos    = alertasComPiora.filter((a) => a.status === 'ativo' && a.severidade === 'alta').length;

  const headerActions = `<button class="secondary-button" data-action="run-verificacao"><i data-lucide="play"></i>Fazer verificacao</button><button class="button" data-action="refresh"><i data-lucide="refresh-cw"></i>Atualizar</button>`;

  return `
    ${pageHeader('Alertas de Anomalias', 'Deteccao automatica diaria via n8n — CPL, CTR, ROAS e verba por cliente.', headerActions)}
    <div class="stat-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:1.5rem;">
      <div class="stat-card"><span>Alertas ativos</span><strong style="font-size:28px;color:var(--color-danger,#dc2626)">${totalAtivos}</strong></div>
      <div class="stat-card"><span>Criticos</span><strong style="font-size:28px;color:var(--color-danger,#dc2626)">${totalCriticos}</strong></div>
      <div class="stat-card"><span>Alta prioridade</span><strong style="font-size:28px">${totalAltos}</strong></div>
    </div>

    <section class="panel" style="margin-bottom:1rem;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <span style="font-size:13px;color:var(--muted)">Status:</span>
      ${['ativo', 'resolvido', 'ignorado', 'all'].map((s) => `<button class="secondary-button ${statusFiltro === s ? 'active' : ''}" data-action="alerta-filtro-status" data-val="${s}" style="padding:4px 12px;font-size:12px">${s === 'all' ? 'Todos' : label(s)}</button>`).join('')}
      <span style="font-size:13px;color:var(--muted);margin-left:12px">Severidade:</span>
      ${['all', 'critica', 'alta', 'media'].map((s) => `<button class="secondary-button ${sevFiltro === s ? 'active' : ''}" data-action="alerta-filtro-sev" data-val="${s}" style="padding:4px 12px;font-size:12px">${s === 'all' ? 'Todas' : label(s)}</button>`).join('')}
    </section>

    ${lista.length === 0 ? emptyState('Sem alertas', statusFiltro === 'ativo' ? 'Nenhuma anomalia detectada com os filtros selecionados.' : 'Nenhum alerta neste filtro.') : `
    <section class="panel" style="padding:0;overflow:hidden">
      <table class="table">
        <thead><tr>
          <th>Cliente</th><th>Metrica</th><th>Ontem</th><th>Ultimos 3d</th><th>Ultimos 7d</th><th>Variacao</th><th>Severidade</th><th>Detectado</th><th></th>
        </tr></thead>
        <tbody>
          ${lista.map((a) => {
            if (a.metrica === 'diario') {
              return `<tr class="alert-row">
                <td><strong>${escapeHtml(a.clientes?.nome_empresa || a.nome_cliente || '-')}</strong><span class="muted">${escapeHtml(a.meta_ads_act || '')}</span></td>
                <td><strong>Anotacao do diario</strong><span class="muted" style="font-size:11px;display:block">Criada por gestor de trafego</span></td>
                <td colspan="4">${escapeHtml(a.objetivo || 'Nova anotacao criada no Diario de Bordo')}</td>
                <td><span class="status-badge ${severidadeClass[a.severidade] || ''}">${escapeHtml(a.severidade)}</span></td>
                <td>${date(a.created_at)}</td>
                <td class="row-actions">
                  ${a.status === 'ativo' ? `
                    <button class="ghost-button" data-action="alerta-to-task" data-id="${a.id}" title="Criar tarefa a partir deste alerta"><i data-lucide="clipboard-list"></i></button>
                    <button class="ghost-button" data-action="resolver-alerta" data-id="${a.id}" title="Marcar como resolvido"><i data-lucide="check-circle"></i></button>
                    <button class="icon-button" data-action="ignorar-alerta" data-id="${a.id}" title="Ignorar"><i data-lucide="eye-off"></i></button>
                  ` : `<span class="status-badge ${a.status === 'resolvido' ? 'status-concluida' : 'status-cancelada'}">${a.status}</span>`}
                </td>
              </tr>`;
            }
            const isMonetary = ['cpl', 'spend'].includes(a.metrica);
            const rowClass = a.metrica === 'cpl' ? 'alert-row alert-row-cpl' : a.metrica === 'spend' ? 'alert-row alert-row-spend' : 'alert-row';
            const fmtVal = (v) => v == null ? '—' : isMonetary ? money(v) : (a.metrica === 'ctr' ? `${Number(v||0).toFixed(2)}%` : `${Number(v||0).toFixed(2)}x`);
            const variacao = Number(a.variacao_pct || 0);
            const varColor = variacao > 0 ? 'var(--color-danger,#dc2626)' : 'var(--color-success,#16a34a)';
            const varIcon = variacao > 0 ? '▲' : '▼';

            // Meta configurada para este alerta
            const metaRec = state.metas.find(m => m.id === a.meta_id);
            const goalMap = { cpl: metaRec?.meta_custo_resultado, roas: metaRec?.meta_roas_minimo, ctr: metaRec?.meta_ctr_minimo, spend: metaRec?.verba_diaria_maxima };
            const goal = goalMap[a.metrica];
            // true = valor está fora da meta (vermelho)
            const fora = (v) => {
              if (v == null || goal == null) return false;
              return ['cpl','spend'].includes(a.metrica) ? v > goal : v < goal;
            };
            const cellStyle = (v) => fora(v) ? 'color:var(--color-danger,#dc2626);font-weight:700' : 'color:var(--color-success,#16a34a);font-weight:600';
            const v1 = a.valor_1d ?? a.valor_atual;
            const v3 = a.valor_3d;
            const v7 = a.valor_referencia;

            return `<tr class="${rowClass}">
              <td><strong>${escapeHtml(a.clientes?.nome_empresa || a.nome_cliente || '-')}</strong><span class="muted">${escapeHtml(a.meta_ads_act || '')}</span></td>
              <td>${escapeHtml(metricaLabel[a.metrica] || a.metrica)}${goal != null ? `<span class="muted" style="font-size:11px;display:block">meta: ${fmtVal(goal)}</span>` : ''}</td>
              <td style="${cellStyle(v1)}"><strong>${fmtVal(v1)}</strong></td>
              <td>${a.metrica === 'spend' ? '—' : `<span style="${cellStyle(v3)}">${fmtVal(v3)}</span>`}</td>
              <td>${a.metrica === 'spend' ? '—' : `<span style="${cellStyle(v7)}">${fmtVal(v7)}</span>`}</td>
              <td style="color:${varColor};font-weight:500">${varIcon} ${Math.abs(variacao).toFixed(1)}%</td>
              <td><span class="status-badge ${severidadeClass[a.severidade] || ''}">${escapeHtml(a.severidade)}</span></td>
              <td>${date(a.created_at)}</td>
              <td class="row-actions">
                ${a.status === 'ativo' ? `
                  <button class="ghost-button" data-action="alerta-to-task" data-id="${a.id}" title="Criar tarefa a partir deste alerta"><i data-lucide="clipboard-list"></i></button>
                  <button class="ghost-button" data-action="resolver-alerta" data-id="${a.id}" title="Marcar como resolvido"><i data-lucide="check-circle"></i></button>
                  <button class="icon-button" data-action="ignorar-alerta" data-id="${a.id}" title="Ignorar"><i data-lucide="eye-off"></i></button>
                ` : `<span class="status-badge ${a.status === 'resolvido' ? 'status-concluida' : 'status-cancelada'}">${a.status}</span>`}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </section>`}
  `;
}

function isImprovingAlert(alerta) {
  if (alerta.metrica === 'diario') return false;
  const current = Number(alerta.valor_1d ?? alerta.valor_atual);
  const reference = Number(alerta.valor_referencia ?? alerta.valor_7d ?? alerta.valor_3d);
  if (Number.isFinite(current) && Number.isFinite(reference)) {
    if (['cpl', 'spend'].includes(alerta.metrica)) return current < reference;
    if (['ctr', 'roas'].includes(alerta.metrica)) return current > reference;
  }
  return Number(alerta.variacao_pct || 0) < 0;
}

function renderEquipe() {
  return `
    ${pageHeader('Equipe', 'Responsaveis internos da operacao.', `<button class="secondary-button" data-action="export" data-entity="equipe"><i data-lucide="download"></i>CSV</button><button class="button" data-action="new" data-entity="equipe"><i data-lucide="plus"></i>Novo membro</button>`)}
    ${renderTablePanel('equipe', ['Nome', 'Email', 'Cargo', 'Funcao', 'Clientes', 'Status', ''], state.equipe.map((member) => `
      <tr>
        <td><strong>${escapeHtml(member.nome)}</strong></td>
        <td>${escapeHtml(member.email || '-')}</td>
        <td>${escapeHtml(member.cargo || '-')}</td>
        <td>${escapeHtml(label(member.funcao || 'gestor_trafego'))}</td>
        <td>${renderAssignedClientNames(member.id)}</td>
        <td>${statusBadge(member.status)}</td>
        <td class="row-actions">${actionButtons('equipe', member.id)}</td>
      </tr>`).join(''))}
  `;
}

function renderAssignedClientNames(equipeId) {
  const names = state.equipeClientes
    .filter((item) => item.equipe_id === equipeId)
    .map((item) => getClienteName(item.cliente_id))
    .filter(Boolean);
  if (!names.length) return '<span class="muted">Nenhum cliente</span>';
  return `<span class="muted">${escapeHtml(names.join(', '))}</span>`;
}

async function renderClienteDetail(id) {
  const cliente = state.clientes.find((item) => item.id === id);
  if (!cliente) return navigate('clientes');
  const [onboarding, ativos, observacoes] = await Promise.all([
    onboardingService.getByClienteId(id).catch(() => null),
    ativoClienteService.list({ eq: { cliente_id: id } }).catch(() => []),
    observacaoClienteService.list({ eq: { cliente_id: id } }).catch(() => []),
  ]);
  const campanhas = state.campanhas.filter((item) => item.cliente_id === id);
  const relatorios = state.relatorios.filter((item) => item.cliente_id === id);
  const vendas = state.vendas.filter((item) => item.cliente_id === id);
  const tarefas = state.tarefas.filter((item) => item.cliente_id === id);
  const progress = onboardingProgress(onboarding);

  app.innerHTML = `
    ${pageHeader(cliente.nome_empresa, 'Detalhe completo do cliente.', `<button class="secondary-button" data-action="back-clientes"><i data-lucide="arrow-left"></i>Voltar</button>${isMainAdmin() ? `<button class="button" data-action="edit" data-entity="clientes" data-id="${id}"><i data-lucide="pencil"></i>Editar</button>` : ''}`)}
    <section class="detail-top">
      <div class="panel">
        <div class="kv">
          ${areaSummary('Status', label(cliente.status))}
          ${areaSummary('Plano', label(cliente.plano_contratado))}
          ${isMainAdmin() ? areaSummary('Mensalidade', money(cliente.valor_mensal)) : ''}
          ${areaSummary('Verba de trafego', money(cliente.verba_mensal_trafego))}
          ${areaSummary('Meta Ads act', cliente.meta_ads_act || '-')}
          ${areaSummary('Responsavel interno', cliente.responsavel_interno || '-')}
        </div>
      </div>
      <div class="panel">
        <h3>Onboarding</h3>
        <div class="progress"><span style="width:${progress}%"></span></div>
        <strong>${progress}% concluido</strong>
      </div>
    </section>
    <div class="tabs">
      ${['visao', 'campanhas', 'relatorios', 'vendas', 'tarefas', 'onboarding', 'ativos', 'observacoes'].map((tab) => `<button class="tab-button ${state.detailTab === tab ? 'active' : ''}" data-action="detail-tab" data-tab="${tab}">${labelDetailTab(tab)}</button>`).join('')}
    </div>
    <section class="panel">${renderDetailTab(cliente, { campanhas, relatorios, vendas, tarefas, onboarding, ativos, observacoes })}</section>
  `;
  bindGlobalActions();
  renderLucide();
}

function renderDetailTab(cliente, data) {
  if (state.detailTab === 'visao') {
    return `<div class="kv">
      ${areaSummary('Responsavel', cliente.responsavel || '-')}
      ${areaSummary('WhatsApp', cliente.whatsapp || '-')}
      ${areaSummary('Email', cliente.email || '-')}
      ${areaSummary('Cidade/UF', [cliente.cidade, cliente.estado].filter(Boolean).join(' / ') || '-')}
      ${areaSummary('Instagram', cliente.instagram || '-')}
      ${areaSummary('Site', cliente.site || '-')}
      ${areaSummary('Landing page', cliente.landing_page || '-')}
      ${areaSummary('CRM utilizado', cliente.crm_utilizado || '-')}
    </div><p class="muted">${escapeHtml(cliente.observacoes || '')}</p>`;
  }
  if (state.detailTab === 'campanhas') return miniList(data.campanhas, 'nome_campanha', 'status', 'campanhas');
  if (state.detailTab === 'relatorios') return miniList(data.relatorios, 'periodo_fim', 'roas', 'relatorios');
  if (state.detailTab === 'vendas') return `${renderVendasMiniList(data.vendas)}<button class="button" data-action="new-related" data-entity="vendas"><i data-lucide="plus"></i>Lancar venda</button>`;
  if (state.detailTab === 'tarefas') return miniList(data.tarefas, 'titulo', 'status', 'tarefas');
  if (state.detailTab === 'ativos') return `${miniList(data.ativos, 'titulo', 'tipo', 'ativos')}<button class="button" data-action="new-related" data-entity="ativos"><i data-lucide="plus"></i>Novo ativo</button>`;
  if (state.detailTab === 'observacoes') return `${miniList(data.observacoes, 'observacao', 'tipo', 'observacoes')}<button class="button" data-action="new-related" data-entity="observacoes"><i data-lucide="plus"></i>Nova observacao</button>`;
  return renderOnboarding(data.onboarding);
}

function renderOnboarding(onboarding) {
  if (!onboarding) return emptyState('Checklist nao encontrado', 'O trigger cria automaticamente para novos clientes.');
  return `
    <div class="checklist">
      ${onboardingFields.map((field) => `
        <label><input type="checkbox" data-action="toggle-onboarding" data-id="${onboarding.id}" data-field="${field}" ${onboarding[field] ? 'checked' : ''}>${labelOnboarding(field)}</label>
      `).join('')}
    </div>
    <label class="full" style="margin-top:14px">Observacoes<textarea data-action="onboarding-notes" data-id="${onboarding.id}">${escapeHtml(onboarding.observacoes || '')}</textarea></label>
  `;
}

function miniList(items, titleKey, statusKey, entity) {
  if (!items.length) return emptyState('Nenhum registro', 'Este cliente ainda nao possui itens nesta aba.');
  return `<div class="table-wrap"><table><tbody>${items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item[titleKey])}</strong></td>
      <td>${statusBadge(item[statusKey])}</td>
      <td class="row-actions">${['ativos', 'observacoes'].includes(entity) ? '' : actionButtons(entity, item.id)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

function renderVendasMiniList(items) {
  if (!items.length) return emptyState('Nenhuma venda', 'Lance vendas manuais para alimentar o dashboard do cliente.');
  return `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Faturamento</th><th>Vendas</th><th>Produtos</th><th>Ticket medio</th><th></th></tr></thead><tbody>${items.map((item) => `
    <tr>
      <td><strong>${date(item.data_venda)}</strong><span class="muted">${escapeHtml(label(item.origem || 'manual'))}</span></td>
      <td>${money(item.valor_total)}</td>
      <td>${number(item.quantidade_vendas)}</td>
      <td>${number(item.quantidade_produtos)}</td>
      <td>${money(item.ticket_medio || ratio(item.valor_total, item.quantidade_vendas))}</td>
      <td class="row-actions">${actionButtons('vendas', item.id)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

function renderTablePanel(id, heads, rows) {
  return `
    <section class="table-panel" id="${id}">
      <div class="table-header"><h3>Registros</h3><span class="muted">${rows ? '' : '0 itens'}</span></div>
      ${rows ? `<div class="table-wrap"><table><thead><tr>${heads.map((head) => `<th>${escapeHtml(head)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>` : emptyState()}
    </section>
  `;
}

function actionButtons(entity, id) {
  return `<button class="icon-button" data-action="edit" data-entity="${entity}" data-id="${id}" aria-label="Editar"><i data-lucide="pencil"></i></button><button class="icon-button" data-action="delete" data-entity="${entity}" data-id="${id}" aria-label="Excluir"><i data-lucide="trash-2"></i></button>`;
}

function relatorioActionButtons(id) {
  return `<button class="icon-button" data-action="view-relatorio" data-id="${id}" aria-label="Ver relatorio"><i data-lucide="eye"></i></button>${actionButtons('relatorios', id)}`;
}

function bindGlobalActions() {
  document.querySelectorAll('[data-action]').forEach((el) => {
    const action = el.dataset.action;
    if (action === 'go-view') el.addEventListener('click', () => navigate(el.dataset.view));
    if (action === 'new') el.addEventListener('click', () => openForm(el.dataset.entity, null, el.dataset.cliente ? { cliente_id: el.dataset.cliente } : {}));
    if (action === 'new-related') el.addEventListener('click', () => openForm(el.dataset.entity, null, { cliente_id: state.detailClienteId }));
    if (action === 'edit') el.addEventListener('click', () => openForm(el.dataset.entity, el.dataset.id));
    if (action === 'delete') el.addEventListener('click', () => handleDelete(el.dataset.entity, el.dataset.id));
    if (action === 'export') el.addEventListener('click', () => exportEntity(el.dataset.entity));
    if (action === 'print') el.addEventListener('click', () => window.print());
    if (action === 'refresh') el.addEventListener('click', async () => { await loadAll(); render(); toast('Dados atualizados.'); });
    if (action === 'operation-detail') {
      el.addEventListener('click', () => openOperationDetail(el.dataset.kind));
      el.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openOperationDetail(el.dataset.kind);
        }
      });
    }
    if (action === 'client-dashboard-client') el.addEventListener('change', () => { state.dashboardClientesClienteId = el.value || 'all'; render(); });
    if (action === 'client-dashboard-origin') el.addEventListener('change', () => { state.dashboardClientesOrigem = el.value || 'all'; render(); });
    if (action === 'refresh-client-meta-costs') el.addEventListener('click', () => loadClientMetaCosts(true));
    if (action === 'task-view') el.addEventListener('click', () => { state.taskView = el.dataset.view; render(); });
    if (action === 'task-responsible-filter') el.addEventListener('change', () => { state.taskResponsibleFilter = el.value || 'all'; render(); });
    if (action === 'toggle-done') el.addEventListener('click', () => {
      const cat = decodeURIComponent(el.dataset.cat);
      if (!state.taskDoneExpanded) state.taskDoneExpanded = {};
      state.taskDoneExpanded[cat] = !state.taskDoneExpanded[cat];
      render();
    });
    if (action === 'toggle-task-status') el.addEventListener('click', () => toggleTaskStatus(el.dataset.id, el.dataset.status));
    if (action === 'open-task-detail') el.addEventListener('click', () => openTaskDetail(el.dataset.id));
    if (action === 'detail-cliente') el.addEventListener('click', () => { state.detailClienteId = el.dataset.id; state.detailTab = 'visao'; render(); });
    if (action === 'back-clientes') el.addEventListener('click', () => { state.detailClienteId = null; state.view = 'clientes'; render(); });
    if (action === 'view-relatorio') el.addEventListener('click', () => { state.detailRelatorioId = el.dataset.id; render(); });
    if (action === 'back-relatorios') el.addEventListener('click', () => { state.detailRelatorioId = null; state.metaAds.tab = 'relatorios'; state.view = 'metaAds'; render(); });
    if (action === 'detail-tab') el.addEventListener('click', () => { state.detailTab = el.dataset.tab; render(); });
    if (action === 'convert-lead') el.addEventListener('click', () => convertLead(el.dataset.id));
    if (action === 'open-lead-conversation') el.addEventListener('click', () => openLeadConversation(el.dataset.id));
    if (action === 'open-followup-result') el.addEventListener('click', () => openFollowupResultModal(el.dataset.id));
    if (action === 'move-lead') el.addEventListener('change', () => moveLead(el.dataset.id, el.value));
    if (action === 'crm-search') el.addEventListener('input', () => {
      const cursor = el.selectionStart;
      state.crmSearch = el.value;
      render();
      const input = document.querySelector('[data-action="crm-search"]');
      input?.focus();
      input?.setSelectionRange(cursor, cursor);
    });
    if (action === 'toggle-onboarding') el.addEventListener('change', () => updateOnboarding(el.dataset.id, { [el.dataset.field]: el.checked }));
    if (action === 'onboarding-notes') el.addEventListener('blur', () => updateOnboarding(el.dataset.id, { observacoes: el.value }));
    if (action === 'meta-client') el.addEventListener('change', () => {
      state.metaAds.clienteId = el.value;
      state.metaAds.goal = inferMetaGoal(state.clientes.find((cliente) => cliente.id === el.value));
      state.metaAds.report = null;
      render();
    });
    if (action === 'meta-goal') el.addEventListener('change', () => { state.metaAds.goal = el.value; state.metaAds.report = null; });
    if (action === 'meta-since') el.addEventListener('change', () => { setSharedMetaDateRange({ since: el.value }); state.metaAds.report = null; });
    if (action === 'meta-until') el.addEventListener('change', () => { setSharedMetaDateRange({ until: el.value }); state.metaAds.report = null; });
    if (action === 'meta-fetch') el.addEventListener('click', fetchMetaAdsReport);
    if (action === 'meta-save-report') el.addEventListener('click', saveMetaReport);
    if (action === 'meta-back') el.addEventListener('click', () => { state.metaAds.report = null; render(); });
    if (action === 'meta-tab') el.addEventListener('click', () => { state.metaAds.tab = el.dataset.tab || 'consulta'; render(); });
    if (action === 'meta-view-mode') el.addEventListener('click', () => { state.metaAds.viewMode = el.dataset.mode; render(); });
    if (action === 'import-meta-clients') el.addEventListener('click', importLegacyMetaAdsClients);
    if (action === 'gbp-client') el.addEventListener('change', () => { state.gbp.clienteId = el.value; });
    if (action === 'gbp-query') el.addEventListener('input', () => { state.gbp.businessQuery = el.value; });
    if (action === 'gbp-keyword') el.addEventListener('input', () => { state.gbp.keyword = el.value; });
    if (action === 'gbp-radius') el.addEventListener('change', () => { state.gbp.radiusKm = Number(el.value || 3); });
    if (action === 'gbp-center') el.addEventListener('input', () => { state.gbp.searchCenter = el.value; });
    if (action === 'gbp-search-radius') el.addEventListener('change', () => { state.gbp.searchRadiusMeters = el.value; });
    if (action === 'gbp-grid') el.addEventListener('change', () => { state.gbp.gridSize = Number(el.value || 5); });
    if (action === 'gbp-fetch') el.addEventListener('click', fetchGbpReport);
    if (action === 'gbp-save-report') el.addEventListener('click', saveGbpReport);
    if (action === 'gbp-tab') el.addEventListener('click', () => { state.gbp.tab = el.dataset.tab || 'nova'; render(); });
    if (action === 'gbp-saved-open') el.addEventListener('click', () => { state.gbp.selectedSavedId = el.dataset.id; render(); });
    if (action === 'gbp-saved-delete') el.addEventListener('click', () => deleteGbpSavedReport(el.dataset.id));
    if (action === 'diary-select') el.addEventListener('click', (event) => {
      if (event.target.closest('textarea, input, button')) return;
      state.diarioSelectedClienteId = el.dataset.client;
      render();
    });
    if (action === 'diary-date') el.addEventListener('change', () => {
      state.diarioDate = el.value || isoDate(new Date());
      state.diarioSelectedClienteId = null;
      render();
    });
    if (action === 'diary-today') el.addEventListener('click', () => {
      state.diarioDate = isoDate(new Date());
      state.diarioSelectedClienteId = null;
      render();
    });
    if (action === 'diary-field') el.addEventListener('blur', () => saveDiaryField(el.dataset.client, el.dataset.id, { [el.dataset.field]: el.value }));
    if (action === 'diary-ok') el.addEventListener('change', () => saveDiaryField(el.dataset.client, el.dataset.id, { revisao_verba_ok: el.checked }));
    if (action === 'diary-to-task') el.addEventListener('click', () => createTaskFromDiary(el.dataset.id, el.dataset.client));
    if (action === 'diary-to-observation') el.addEventListener('click', () => createObservationFromDiary(el.dataset.id, el.dataset.client));
    if (action === 'meta-cell-edit') el.addEventListener('change', async () => {
      const id = el.dataset.id;
      const field = el.dataset.field;
      const raw = el.value;
      const val = raw === '' ? null : (el.type === 'number' ? Number(raw) : raw);
      try {
        await metaClienteService.update(id, { [field]: val });
        const idx = state.metas.findIndex((m) => m.id === id);
        if (idx >= 0) state.metas[idx] = { ...state.metas[idx], [field]: val };
        toast('Meta salva.');
      } catch (error) { showError(error); }
    });
    if (action === 'meta-new-field') el.addEventListener('change', () => {
      const cid = el.dataset.cliente;
      if (!state.metaRowDrafts[cid]) state.metaRowDrafts[cid] = { open: true };
      state.metaRowDrafts[cid][el.dataset.field] = el.value;
    });
    if (action === 'meta-new-save') el.addEventListener('click', async () => {
      const cid = el.dataset.cliente;
      const draft = state.metaRowDrafts[cid] || {};
      if (!draft.objetivo) {
        toast('Selecione o objetivo antes de salvar.', 'error');
        return;
      }
      const payload = {
        cliente_id: cid,
        objetivo: draft.objetivo,
        meta_custo_resultado: draft.meta_custo_resultado !== '' && draft.meta_custo_resultado != null ? Number(draft.meta_custo_resultado) : null,
        meta_roas_minimo: draft.meta_roas_minimo !== '' && draft.meta_roas_minimo != null ? Number(draft.meta_roas_minimo) : null,
        meta_ctr_minimo: draft.meta_ctr_minimo !== '' && draft.meta_ctr_minimo != null ? Number(draft.meta_ctr_minimo) : null,
        verba_diaria_maxima: draft.verba_diaria_maxima !== '' && draft.verba_diaria_maxima != null ? Number(draft.verba_diaria_maxima) : null,
        threshold_variacao_pct: draft.threshold_variacao_pct !== '' && draft.threshold_variacao_pct != null ? Number(draft.threshold_variacao_pct) : 30,
        ativo: true,
      };
      try {
        const nova = await metaClienteService.create(payload);
        const clienteData = state.clientes.find((c) => c.id === cid);
        state.metas.push({ ...nova, clientes: clienteData ? { nome_empresa: clienteData.nome_empresa, meta_ads_act: clienteData.meta_ads_act } : null });
        delete state.metaRowDrafts[cid];
        render();
        toast('Meta salva!');
      } catch (error) { showError(error); }
    });
    if (action === 'meta-add-row') el.addEventListener('click', () => {
      const cid = el.dataset.cliente;
      state.metaRowDrafts[cid] = { open: true };
      render();
    });
    if (action === 'alerta-to-task') el.addEventListener('click', () => createTaskFromAlerta(el.dataset.id));
    if (action === 'resolver-alerta') el.addEventListener('click', async () => {
      try {
        await alertaAnomaliaService.resolver(el.dataset.id, state.session?.user?.email || 'admin');
        const idx = state.alertas.findIndex((a) => a.id === el.dataset.id);
        if (idx >= 0) state.alertas[idx] = { ...state.alertas[idx], status: 'resolvido' };
        updateAlertasBadge();
        render();
        toast('Alerta marcado como resolvido.');
      } catch (error) { showError(error); }
    });
    if (action === 'ignorar-alerta') el.addEventListener('click', async () => {
      try {
        await alertaAnomaliaService.ignorar(el.dataset.id);
        const idx = state.alertas.findIndex((a) => a.id === el.dataset.id);
        if (idx >= 0) state.alertas[idx] = { ...state.alertas[idx], status: 'ignorado' };
        updateAlertasBadge();
        render();
        toast('Alerta ignorado.');
      } catch (error) { showError(error); }
    });
    if (action === 'alerta-filtro-status') el.addEventListener('click', () => { state.alertasFiltroStatus = el.dataset.val; render(); });
    if (action === 'alerta-filtro-sev') el.addEventListener('click', () => { state.alertasFiltroSeveridade = el.dataset.val; render(); });
    if (action === 'run-verificacao') el.addEventListener('click', async () => {
      el.disabled = true;
      el.innerHTML = '<i data-lucide="loader-circle"></i>Verificando...';
      renderLucide();
      try {
        const res = await fetch('https://automacao2.themidiamarketing.com.br/webhook/alertas-verificacao', { method: 'POST' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast('Verificacao iniciada! Os alertas serao atualizados em instantes.');
        setTimeout(async () => { await loadAll(); render(); }, 8000);
      } catch (e) {
        toast(`Erro ao iniciar verificacao: ${e.message}`, 'error');
      } finally {
        el.disabled = false;
        el.innerHTML = '<i data-lucide="play"></i>Fazer verificacao';
        renderLucide();
      }
    });
    if (action === 'whatsapp-instance') el.addEventListener('input', () => {
      state.whatsapp.instanceName = sanitizeInstanceName(el.value);
      persistWhatsappConfig();
    });
    if (action === 'whatsapp-connect') el.addEventListener('click', connectWhatsapp);
    if (action === 'whatsapp-mark-connected') el.addEventListener('click', () => {
      state.whatsapp.status = 'ativo';
      state.whatsapp.updatedAt = new Date().toISOString();
      persistWhatsappConfig();
      render();
      toast('WhatsApp marcado como conectado.');
    });
    if (action === 'whatsapp-clear') el.addEventListener('click', () => {
      state.whatsapp = getDefaultWhatsappConfig();
      persistWhatsappConfig();
      render();
      toast('Conexao do WhatsApp limpa.');
    });
  });
  bindCrmDragAndDrop();
}

function bindCrmDragAndDrop() {
  document.querySelectorAll('.lead-card[draggable="true"]').forEach((card) => {
    card.addEventListener('dragstart', (event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.dataset.leadId);
      card.classList.add('is-dragging');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      document.querySelectorAll('.kanban-column-body.is-drop-target').forEach((column) => column.classList.remove('is-drop-target'));
    });
  });

  document.querySelectorAll('[data-crm-drop-stage]').forEach((column) => {
    column.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      column.classList.add('is-drop-target');
    });
    column.addEventListener('dragleave', (event) => {
      if (!column.contains(event.relatedTarget)) column.classList.remove('is-drop-target');
    });
    column.addEventListener('drop', async (event) => {
      event.preventDefault();
      column.classList.remove('is-drop-target');
      const id = event.dataTransfer.getData('text/plain');
      const etapa = column.dataset.crmDropStage;
      const lead = state.leads.find((item) => item.id === id);
      if (!id || !etapa || lead?.etapa === etapa) return;
      await moveLead(id, etapa);
    });
  });
}

function openForm(entity, id = null, defaults = {}) {
  const current = id ? getEntityList(entity).find((item) => item.id === id) : {};
  const values = { ...defaults, ...current };
  if (entity === 'equipe') {
    values.cliente_ids = id
      ? state.equipeClientes.filter((item) => item.equipe_id === id).map((item) => item.cliente_id)
      : [];
  }
  const schema = getFormSchema(entity);
  modalEyebrow.textContent = id ? 'Editar registro' : 'Novo registro';
  modalTitle.textContent = schema.title;
  modalForm.innerHTML = `<div class="form-grid">${schema.fields.map((field) => renderField(field, values[field.name])).join('')}<div class="form-actions"><button type="button" class="secondary-button" data-modal-cancel>Cancelar</button><button class="button" type="submit"><i data-lucide="save"></i>Salvar</button></div></div>`;
  modalBackdrop.hidden = false;
  modalForm.querySelector('[data-modal-cancel]')?.addEventListener('click', closeModal);
  modalForm.onsubmit = (event) => handleSubmit(event, entity, id);
  if (entity === 'relatorios') bindReportCalculations();
  if (entity === 'tarefas' && !id) {
    const clienteSel = modalForm.querySelector('[name="cliente_id"]');
    const tituloInput = modalForm.querySelector('[name="titulo"]');
    clienteSel?.addEventListener('change', () => {
      const nome = state.clientes.find((c) => c.id === clienteSel.value)?.nome_empresa || '';
      const current = tituloInput.value;
      const stripped = current.replace(/^.+? - /, '');
      tituloInput.value = nome ? `${nome} - ${stripped}` : stripped;
    });
  }
  renderLucide();
}

function renderField(field, value) {
  const common = `name="${field.name}" ${field.required ? 'required' : ''}`;
  const safeValue = escapeHtml(value ?? field.default ?? '');
  if (field.type === 'select') {
    const customLabels = Object.fromEntries((field.customLabels || []).map((item) => [item.value, item.label]));
    const selected = String(value ?? field.default ?? '');
    const options = [...field.options];
    if (selected && !options.includes(selected)) options.unshift(selected);
    return `<label class="${field.full ? 'full' : ''}">${field.label}<select ${common}><option value="">Selecione</option>${options.map((opt) => `<option value="${escapeHtml(opt)}" ${selected === opt ? 'selected' : ''}>${escapeHtml(customLabels[opt] || label(opt))}</option>`).join('')}</select></label>`;
  }
  if (field.type === 'multiselect') {
    const selected = new Set(Array.isArray(value) ? value : []);
    const customLabels = Object.fromEntries((field.customLabels || []).map((item) => [item.value, item.label]));
    return `
      <div class="form-field ${field.full ? 'full' : ''}">
        <span>${escapeHtml(field.label)}</span>
        ${field.helper ? `<span class="field-helper">${escapeHtml(field.helper)}</span>` : ''}
        <div class="multi-check-list">
          ${field.options.map((opt) => `
            <label class="multi-check-item">
              <input type="checkbox" name="${field.name}" value="${escapeHtml(opt)}" ${selected.has(opt) ? 'checked' : ''}>
              <span>${escapeHtml(customLabels[opt] || label(opt))}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }
  if (field.type === 'textarea') return `<label class="full">${field.label}<textarea ${common}>${safeValue}</textarea></label>`;
  return `<label class="${field.full ? 'full' : ''}">${field.label}<input class="input" type="${field.type || 'text'}" value="${safeValue}" ${common}></label>`;
}

async function handleSubmit(event, entity, id) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const payload = Object.fromEntries(formData.entries());
  const equipeClienteIds = entity === 'equipe' ? formData.getAll('cliente_ids') : [];
  if (entity === 'equipe') delete payload.cliente_ids;
  getFormSchema(entity).fields.forEach((field) => {
    if (field.type === 'multiselect') return;
    if (field.type === 'number') payload[field.name] = payload[field.name] === '' ? null : Number(payload[field.name]);
    if (field.name === 'revisao_verba_ok') payload[field.name] = payload[field.name] === 'true';
    if (entity === 'metas' && field.name === 'ativo') payload[field.name] = payload[field.name] === 'true';
    if (payload[field.name] === '') payload[field.name] = field.required ? payload[field.name] : null;
  });

  if (entity === 'relatorios') Object.assign(payload, calculateReport(payload));
  if (entity === 'relatorios' && payload.cliente_id) {
    payload.meta_ads_act_snapshot = state.clientes.find((cliente) => cliente.id === payload.cliente_id)?.meta_ads_act || null;
  }
  if (entity === 'tarefas') normalizeTaskPayload(payload);
  const shouldProvisionFuncionarioAuth = entity === 'equipe' && (!id || String(payload.senha || '').trim());
  if (entity === 'equipe' && id && !shouldProvisionFuncionarioAuth) delete payload.senha;
  if (entity === 'crm' && id) {
    const currentLead = state.leads.find((lead) => lead.id === id);
    if (currentLead?.etapa && payload.etapa && currentLead.etapa !== payload.etapa) {
      payload.aguardando_resposta_manual = false;
      payload.tentativa = 0;
    }
  }
  const previousLead = entity === 'crm' && id ? state.leads.find((lead) => lead.id === id) : null;

  try {
    const saved = shouldProvisionFuncionarioAuth
      ? await createFuncionario({ ...(id ? getEntityList(entity).find((item) => item.id === id) : {}), ...payload })
      : await getService(entity)[id ? 'update' : 'create'](id || payload, payload);
    if (entity === 'clientes' && !id && saved?.id) {
      await createDefaultTasksForNewClient(saved);
    }
    if (entity === 'equipe' && saved?.id) {
      await equipeClienteService.replaceForMember(saved.id, equipeClienteIds);
    }
    if (entity === 'crm' && id && ['respondeu', 'qualificado'].includes(payload.etapa) && previousLead?.etapa !== payload.etapa) {
      await sendCrmMetaEvent(id, previousLead?.etapa || null);
    }
    closeModal();
    await loadAll();
    render();
    toast('Registro salvo com sucesso.');
  } catch (error) {
    showError(error);
  }
}

async function createFuncionario(payload) {
  const { data, error } = await supabase.functions.invoke('create-funcionario', {
    body: payload,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'Nao foi possivel criar o funcionario.');
  return data.funcionario;
}

async function handleDelete(entity, id) {
  if (!confirmDelete(label(entity))) return;
  try {
    await getService(entity).delete(id);
    await loadAll();
    render();
    toast('Registro excluido.');
  } catch (error) {
    showError(error);
  }
}

async function toggleTaskStatus(id, currentStatus) {
  if (!id) return;
  const nextStatus = currentStatus === 'concluida' ? 'pendente' : 'concluida';
  const tarefa = state.tarefas.find((item) => item.id === id);
  const { patch, rescheduled } = buildTaskStatusPatch(tarefa, nextStatus);
  try {
    await tarefaService.update(id, patch);
    const index = state.tarefas.findIndex((tarefa) => tarefa.id === id);
    if (index >= 0) state.tarefas[index] = { ...state.tarefas[index], ...patch };
    if (nextStatus === 'concluida' && !rescheduled) {
      await handleTaskAutomationAfterCompletion({ ...tarefa, ...patch });
    }
    render();
    if (rescheduled) {
      toast(`Tarefa recorrente reagendada para ${date(patch.data_vencimento)}.`);
    } else {
      toast(nextStatus === 'concluida' ? 'Tarefa concluida.' : 'Tarefa reaberta.');
    }
  } catch (error) {
    showError(error);
  }
}

function buildTaskStatusPatch(tarefa, nextStatus) {
  const nextRecurringDate = nextStatus === 'concluida' && tarefa?.recorrencia_ativa
    ? getNextRecurringTaskDate(tarefa)
    : null;
  const rescheduled = Boolean(nextRecurringDate);
  if (rescheduled) {
    return {
      rescheduled,
      patch: {
        status: 'pendente',
        data_vencimento: nextRecurringDate,
        concluida_em: null,
      },
    };
  }
  return {
    rescheduled,
    patch: {
      status: nextStatus,
      concluida_em: nextStatus === 'concluida' ? new Date().toISOString() : null,
    },
  };
}

function normalizeTaskPayload(payload) {
  const recurrence = payload.recorrencia || 'nenhuma';
  payload.recorrencia = recurrence;
  payload.recorrencia_ativa = recurrence !== 'nenhuma';
  if (recurrence === 'semanal') {
    const fallbackDay = payload.data_vencimento ? new Date(`${payload.data_vencimento}T00:00:00`).getDay() : 1;
    payload.recorrencia_dia_semana = payload.recorrencia_dia_semana === null ? fallbackDay : Number(payload.recorrencia_dia_semana);
    if (!payload.data_vencimento) payload.data_vencimento = getNextWeeklyTaskDate(payload.recorrencia_dia_semana);
  } else if (recurrence === 'diaria') {
    payload.recorrencia_dia_semana = null;
    if (!payload.data_vencimento) payload.data_vencimento = addDaysToIsoDate(isoDate(new Date()), 1);
  } else if (recurrence === 'mensal_primeiro_dia_util') {
    payload.recorrencia_dia_semana = null;
    if (!payload.data_vencimento) payload.data_vencimento = getUpcomingFirstBusinessDay();
  } else {
    payload.recorrencia_dia_semana = null;
  }
}

function getNextRecurringTaskDate(tarefa) {
  if (!tarefa?.recorrencia_ativa || tarefa.recorrencia === 'nenhuma') return null;
  if (tarefa.recorrencia === 'semanal') return getNextWeeklyTaskDate(tarefa.recorrencia_dia_semana, tarefa.data_vencimento);
  if (tarefa.recorrencia === 'diaria') return addDaysToIsoDate(tarefa.data_vencimento || isoDate(new Date()), 1);
  if (tarefa.recorrencia === 'mensal_primeiro_dia_util') return getNextMonthlyFirstBusinessDay(tarefa.data_vencimento);
  return null;
}

function getNextWeeklyTaskDate(dayOfWeek, fromDate) {
  const base = fromDate ? new Date(`${fromDate}T00:00:00`) : new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (base < today) base.setTime(today.getTime());
  const targetDay = Number.isInteger(Number(dayOfWeek)) ? Number(dayOfWeek) : base.getDay();
  const daysUntilNext = (targetDay - base.getDay() + 7) % 7 || 7;
  base.setDate(base.getDate() + daysUntilNext);
  return isoDate(base);
}

function getUpcomingFirstBusinessDay(referenceDate = new Date()) {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  let candidate = getFirstBusinessDay(today.getFullYear(), today.getMonth());
  if (candidate < today) candidate = getFirstBusinessDay(today.getFullYear(), today.getMonth() + 1);
  return isoDate(candidate);
}

function getNextMonthlyFirstBusinessDay(fromDate) {
  const base = fromDate ? new Date(`${fromDate}T00:00:00`) : new Date();
  return isoDate(getFirstBusinessDay(base.getFullYear(), base.getMonth() + 1));
}

function getFirstBusinessDay(year, monthIndex) {
  const dateValue = new Date(year, monthIndex, 1);
  while ([0, 6].includes(dateValue.getDay())) {
    dateValue.setDate(dateValue.getDate() + 1);
  }
  return dateValue;
}

async function createDefaultTasksForNewClient(cliente) {
  if (!cliente?.id) return;
  const dueDate = addDaysToIsoDate(isoDate(new Date()), 1);
  await Promise.all([
    createOnboardingStageTask(cliente, 1, dueDate),
    createOnboardingStageTask(cliente, 2, dueDate),
  ]);
}

async function handleTaskAutomationAfterCompletion(tarefa) {
  const stage = getOnboardingStageNumber(tarefa);
  if (!stage || !tarefa?.cliente_id) return;
  const cliente = await getTaskCliente(tarefa);
  if (!cliente?.id) return;
  const dueDate = addDaysToIsoDate(isoDate(new Date()), 1);
  if (stage >= 2 && stage < 7) {
    await createOnboardingStageTask(cliente, stage + 1, dueDate);
  }
  if (stage === 7) {
    await createPaidTrafficTasks(cliente);
  }
}

function getOnboardingStageNumber(tarefa) {
  const match = String(tarefa?.titulo || '').trim().match(/(?:^Onboarding - Etapa| - Etapa) ([1-7])(?:\b| -)/i);
  return match ? Number(match[1]) : null;
}

async function getTaskCliente(tarefa) {
  const localCliente = state.clientes.find((cliente) => cliente.id === tarefa.cliente_id);
  if (localCliente) return localCliente;
  try {
    return await clienteService.getById(tarefa.cliente_id);
  } catch (error) {
    console.warn('Nao foi possivel carregar cliente da tarefa.', error);
    return null;
  }
}

async function createOnboardingStageTask(cliente, stage, dueDate) {
  const clientName = getTaskClientName(cliente);
  return createTaskIfMissing({
    cliente_id: cliente.id,
    titulo: clientName ? `${clientName} - Etapa ${stage}` : `Onboarding - Etapa ${stage}`,
    categoria: 'Onboarding',
    responsavel: getClientTaskOwner(cliente),
    prioridade: 'alta',
    status: 'pendente',
    data_inicio: isoDate(new Date()),
    data_vencimento: dueDate,
    recorrencia: 'nenhuma',
    recorrencia_ativa: false,
    recorrencia_dia_semana: null,
    descricao: `Etapa ${stage} do onboarding do cliente.`,
  });
}

async function createPaidTrafficTasks(cliente) {
  const owner = getClientTaskOwner(cliente);
  const clientName = getTaskClientName(cliente);
  const templates = [
    {
      titulo: 'Trafego pago - Otimizacao mensal',
      recorrencia: 'mensal_primeiro_dia_util',
      data_vencimento: getUpcomingFirstBusinessDay(),
      checklists: paidTrafficChecklist('otimizacao_mensal'),
    },
    {
      titulo: 'Trafego pago - Analise de funil + acompanhamento (toque 2 de 3)',
      recorrencia: 'semanal',
      recorrencia_dia_semana: 3,
      data_vencimento: getNextWeeklyTaskDate(3),
      checklists: paidTrafficChecklist('funil'),
    },
    {
      titulo: 'Trafego pago - Revisao diaria de verba e performance',
      recorrencia: 'diaria',
      data_vencimento: addDaysToIsoDate(isoDate(new Date()), 1),
      checklists: paidTrafficChecklist('revisao_diaria'),
    },
    {
      titulo: 'Trafego pago - Otimizacao semanal',
      recorrencia: 'semanal',
      recorrencia_dia_semana: 2,
      data_vencimento: getNextWeeklyTaskDate(2),
      checklists: paidTrafficChecklist('otimizacao_semanal'),
    },
    {
      titulo: 'Trafego pago - Relatorio e feedback semanal (toque 1 de 3)',
      recorrencia: 'semanal',
      recorrencia_dia_semana: 1,
      data_vencimento: getNextWeeklyTaskDate(1),
      responsavel: owner,
      checklists: paidTrafficChecklist('relatorio'),
    },
    {
      titulo: 'Trafego pago - Testes, criativos e concorrencia',
      recorrencia: 'semanal',
      recorrencia_dia_semana: 4,
      data_vencimento: getNextWeeklyTaskDate(4),
      checklists: paidTrafficChecklist('testes_concorrencia'),
    },
    {
      titulo: 'Trafego pago - Fechamento e preparacao',
      recorrencia: 'semanal',
      recorrencia_dia_semana: 5,
      data_vencimento: getNextWeeklyTaskDate(5),
      checklists: paidTrafficChecklist('fechamento'),
    },
    {
      titulo: 'Trafego pago - Avaliar cliente por 1 dia',
      recorrencia: 'mensal_primeiro_dia_util',
      data_vencimento: getUpcomingFirstBusinessDay(),
      responsavel: owner,
      checklists: paidTrafficChecklist('avaliacao_cliente'),
    },
  ];

  await Promise.all(templates.map((template) => createTaskIfMissing({
    cliente_id: cliente.id,
    titulo: clientName ? `${clientName} - ${template.titulo}` : template.titulo,
    categoria: 'Trafego Pago',
    responsavel: template.responsavel || owner,
    prioridade: 'media',
    status: 'pendente',
    data_inicio: isoDate(new Date()),
    data_vencimento: template.data_vencimento,
    recorrencia: template.recorrencia,
    recorrencia_ativa: true,
    recorrencia_dia_semana: template.recorrencia_dia_semana ?? null,
    descricao: 'Rotina automatica criada apos o onboarding.',
    checklists: template.checklists || [],
  })));
}

function buildChecklist(title, items) {
  return { title, items: items.map((text) => ({ text, done: false })) };
}

function paidTrafficChecklist(type) {
  const checklists = {
    revisao_diaria: [
      buildChecklist('Meta Ads', [
        'Verificar se as campanhas tiveram veiculacao ontem e hoje',
        'Verificar criativos ou publicos com CPA muito acima da media',
        'Pausar o que estiver extremamente ruim',
        'Verificar se campanhas com mais performance recebem mais investimento',
        'Ajustar verba de 20% em 20% quando fizer sentido',
        'Caso tenha poucos criativos, testar postagem ou solicitar novos criativos',
        'Conferir saldo e cartao de cada conta (conta nao pode parar por saldo)',
        'Olhar notificacoes da conta',
      ]),
      buildChecklist('Google Ads', [
        'Verificar veiculacao',
        'Negativar termos de pesquisa sem contexto',
        'Ver palavras-chave, criativos ou publicos com CPA alto',
        'Ajustar ROAS, CPC ou CPA desejado se nao estiver gastando orcamento',
        'Olhar notificacoes da conta',
      ]),
    ],
    relatorio: [
      buildChecklist('Relatorio e feedback semanal (toque 1 de 3)', [
        'Abrir dashboard do cliente no Looker Studio',
        'Selecionar periodo do relatorio',
        'Gerar relatorio com IA e revisar',
        'Gerar link do relatorio no Looker Studio',
        'Enviar para o grupo do WhatsApp com a mensagem padrao',
        'Salvar PDF na pasta do cliente no Google Drive',
      ]),
    ],
    otimizacao_semanal: [
      buildChecklist('Meta Ads', [
        'Otimizar orcamento de 20% em 20% se necessario',
        'Otimizar criativos, mantendo 2 a 6 criativos ativos por conjunto',
        'Pausar publicos com CPA alto',
        'Testar novos publicos',
        'Ajustar estrutura de campanha se o resultado estiver ruim',
        'Otimizar catalogo de produtos',
        'Revisar destino, site, pagina ou WhatsApp',
      ]),
      buildChecklist('Google Ads', [
        'Checar recomendacoes',
        'Negativar palavras-chave com filtro de 7 e 15 dias',
        'Otimizar grupos de anuncios',
        'Revisar onde os anuncios aparecem em Display e YouTube',
        'Otimizar lances por publico',
      ]),
      buildChecklist('Criativos', [
        'Solicitar novos criativos para o time de design',
        'Sugerir formatos e abordagens criativas',
        'Solicitar 2 a 3 novos criativos quando necessario',
      ]),
    ],
    funil: [
      buildChecklist('Funil e site', [
        'Analisar taxa de conversao do site',
        'Verificar abandono de carrinho',
        'Analisar funil de checkout',
        'Revisar paginas de produto',
        'Verificar velocidade do site',
        'Analisar comportamento e pontos de queda',
      ]),
      buildChecklist('Instagram', [
        'Ver se tem postagens com frequencia',
        'Ver se os Stories estao ativos',
        'Conferir bio com diferenciacao e CTA',
        'Conferir destaques',
        'Conferir sacolinha do Instagram',
        'Conferir posts fixados',
      ]),
      buildChecklist('Comunicacao', [
        'Enviar a mensagem de acompanhamento no grupo do cliente',
      ]),
    ],
    testes_concorrencia: [
      buildChecklist('Testes, criativos e concorrencia', [
        'Avaliar os testes que subiram na terca (ja deu tempo de juntar dado)',
        'Escalar o que o teste indicou como bom, cortar o que nao andou',
        'Espiar a concorrencia na Biblioteca de Anuncios do Meta',
        'Anotar angulos e ofertas que valem testar',
        'Definir e solicitar os criativos da proxima semana',
      ]),
    ],
    fechamento: [
      buildChecklist('Fechamento e preparacao (toque 3 de 3)', [
        'Revisao geral das contas antes do fim de semana',
        'Garantir que os clientes de fim de semana (bar e restaurante) estao no ar e com saldo pra aguentar sabado e domingo sozinhos',
        'Conferir que nenhuma campanha vai parar por saldo ou cartao',
        'Enviar a mensagem de fechamento no grupo do cliente',
        'Anotar os aprendizados da semana',
      ]),
    ],
    otimizacao_mensal: [
      buildChecklist('Meta Ads', [
        'Auditar campanhas ativas',
        'Revisar ativos desatualizados',
        'Verificar publicos com baixa performance',
        'Analisar criativos com baixo CTR',
        'Revisar orcamentos e distribuicao',
        'Atualizar horarios de veiculacao',
        'Verificar configuracoes de pixel',
      ]),
      buildChecklist('Google Ads', [
        'Auditar campanhas ativas',
        'Revisar palavras-chave negativas',
        'Verificar termos de pesquisa',
        'Analisar grupos de anuncios com baixa performance',
        'Revisar lances e orcamentos',
        'Atualizar extensoes de anuncios',
        'Verificar configuracoes de conversao',
        'Revisar publicos-alvo',
      ]),
    ],
    avaliacao_cliente: [
      buildChecklist('Avaliacao de cliente', [
        'Revisar o historico de resultado do cliente nos ultimos 30 a 90 dias',
        'Avaliar se a estrutura de conta ainda faz sentido pro momento do cliente',
        'Revisar a oferta e os criativos contra o que a concorrencia esta rodando',
        'Checar a saude do funil inteiro, do anuncio ate a conversao',
        'Avaliar a relacao com o cliente (satisfeito, neutro ou em risco de sair)',
        'Definir o plano dos proximos 30 dias pra essa conta',
        'Separar os insights pra levar na proxima reuniao',
      ]),
    ],
  };
  return checklists[type] || [];
}

async function createTaskIfMissing(payload) {
  const normalizedTitle = normalizeTaskTitle(payload.titulo);
  const exists = state.tarefas.some((tarefa) => (
    tarefa.cliente_id === payload.cliente_id
    && normalizeTaskTitle(tarefa.titulo) === normalizedTitle
    && tarefa.status !== 'cancelada'
  ));
  if (exists) return null;
  const created = await tarefaService.create(payload);
  if (created?.id) state.tarefas.push(created);
  return created;
}

function normalizeTaskTitle(value) {
  return String(value || '').trim().toLowerCase();
}

function getTaskClientName(cliente) {
  return String(cliente?.nome_empresa || '').trim();
}

function getClientTaskOwner(cliente) {
  return cliente?.responsavel_interno || cliente?.responsavel || cliente?.gestor || 'Gestor';
}

// ── Task Detail (ClickUp-style) ─────────────────────────────────────────────

function openTaskDetail(id) {
  const tarefa = state.tarefas.find((t) => t.id === id);
  if (!tarefa) return;
  state.taskDetailId = id;
  const overlay = document.getElementById('taskDetailOverlay');
  if (!overlay) return;
  overlay.innerHTML = buildTaskDetailHTML(tarefa);
  overlay.hidden = false;
  renderLucide();
  bindTaskDetailActions();
}

function closeTaskDetail() {
  state.taskDetailId = null;
  const overlay = document.getElementById('taskDetailOverlay');
  if (overlay) {
    overlay.hidden = true;
    overlay.innerHTML = '';
  }
}

function refreshTaskDetail() {
  if (!state.taskDetailId) return;
  const tarefa = state.tarefas.find((t) => t.id === state.taskDetailId);
  if (!tarefa) return;
  const overlay = document.getElementById('taskDetailOverlay');
  if (!overlay || overlay.hidden) return;
  overlay.innerHTML = buildTaskDetailHTML(tarefa);
  renderLucide();
  bindTaskDetailActions();
}

function rerenderTaskRowInPlace(id) {
  const el = document.querySelector(`[data-task-id="${id}"]`);
  if (!el) return;
  const tarefa = state.tarefas.find((t) => t.id === id);
  if (!tarefa) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = renderTaskRow(tarefa);
  const newRow = tmp.firstElementChild;
  el.replaceWith(newRow);
  renderLucide();
  newRow.querySelectorAll('[data-action]').forEach((btn) => {
    const action = btn.dataset.action;
    if (action === 'toggle-task-status') btn.addEventListener('click', () => toggleTaskStatus(btn.dataset.id, btn.dataset.status));
    if (action === 'open-task-detail')   btn.addEventListener('click', () => openTaskDetail(btn.dataset.id));
    if (action === 'edit')    btn.addEventListener('click', () => openForm(btn.dataset.entity, btn.dataset.id));
    if (action === 'delete')  btn.addEventListener('click', () => handleDelete(btn.dataset.entity, btn.dataset.id));
  });
}

function buildTaskDetailHTML(tarefa) {
  const cliente = tarefa.clientes?.nome_empresa || getClienteName(tarefa.cliente_id) || '-';
  const lists = tarefa.checklists || [];
  const clTotal = lists.reduce((s, l) => s + (l.items?.length || 0), 0);
  const clDone  = lists.reduce((s, l) => s + (l.items?.filter((i) => i.done).length || 0), 0);
  const pct = clTotal > 0 ? Math.round((clDone / clTotal) * 100) : 0;

  const statusLabels = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada' };
  const statusLabel = statusLabels[tarefa.status] || tarefa.status;

  return `
    <div class="task-detail-panel">
      <!-- Top bar -->
      <div class="task-detail-topbar">
        <div class="task-detail-breadcrumb">
          <i data-lucide="folder"></i>
          <span>${escapeHtml(cliente)}</span>
          <i data-lucide="chevron-right"></i>
          <span>Tarefas</span>
        </div>
        <div class="task-detail-topbar-actions">
          <button class="icon-button" data-td-action="edit" data-entity="tarefas" data-id="${tarefa.id}" title="Editar"><i data-lucide="pencil"></i></button>
          <button class="icon-button" data-td-action="delete" data-entity="tarefas" data-id="${tarefa.id}" title="Excluir"><i data-lucide="trash-2"></i></button>
          <button class="icon-button" data-td-action="close" title="Fechar (Esc)"><i data-lucide="x"></i></button>
        </div>
      </div>

      <!-- Body -->
      <div class="task-detail-content">
        <!-- Left: main content -->
        <div class="task-detail-main">

          <!-- Status / priority / dates row -->
          <div class="task-detail-meta-row">
            <div class="task-status-wrap">
              <button class="task-status-select-btn status-${escapeHtml(tarefa.status)}" data-td-action="open-status-menu" data-id="${tarefa.id}">
                ${escapeHtml(statusLabel)} <i data-lucide="chevron-down"></i>
              </button>
            </div>
            ${taskPriorityPill(tarefa.prioridade)}
            <span class="task-detail-date-range">
              <i data-lucide="calendar-range"></i>
              <input type="date" data-td-field="data_inicio"     data-id="${tarefa.id}" value="${escapeHtml(tarefa.data_inicio || '')}"     title="Início">
              <i data-lucide="arrow-right"></i>
              <input type="date" data-td-field="data_vencimento" data-id="${tarefa.id}" value="${escapeHtml(tarefa.data_vencimento || '')}" title="Vencimento">
            </span>
          </div>

          <!-- Title -->
          <textarea class="task-detail-title" rows="2" data-td-field="titulo" data-id="${tarefa.id}">${escapeHtml(tarefa.titulo)}</textarea>

          <!-- Properties -->
          <div class="task-detail-props">
            <div class="task-detail-prop-row">
              <span class="task-detail-prop-label"><i data-lucide="user"></i>Responsável</span>
              <div class="task-detail-prop-value">
                ${tarefa.responsavel ? taskAssignee(tarefa.responsavel) : '<span style="color:var(--muted);font-size:13px">Nenhum</span>'}
              </div>
            </div>
            <div class="task-detail-prop-row">
              <span class="task-detail-prop-label"><i data-lucide="building-2"></i>Cliente</span>
              <div class="task-detail-prop-value">
                <span class="task-client-pill">${escapeHtml(cliente)}</span>
              </div>
            </div>
            <div class="task-detail-prop-row">
              <span class="task-detail-prop-label"><i data-lucide="flag"></i>Prioridade</span>
              <div class="task-detail-prop-value">${taskPriorityPill(tarefa.prioridade)}</div>
            </div>
          </div>

          <!-- Description -->
          <div>
            <div class="task-detail-section-title">Descrição / Objetivos</div>
            <textarea class="task-detail-textarea" data-td-field="descricao" data-id="${tarefa.id}" placeholder="Descreva os objetivos desta tarefa...">${escapeHtml(tarefa.descricao || '')}</textarea>
          </div>

          <!-- Checklists -->
          <div id="td-checklists">
            <div class="task-detail-section-title" style="margin-bottom:12px">Checklists</div>
            ${lists.map((list, li) => buildChecklistSection(list, li, tarefa.id)).join('')}
            <button class="task-add-checklist-btn" data-td-action="add-checklist" data-id="${tarefa.id}">
              <i data-lucide="plus"></i> Adicionar checklist
            </button>
          </div>
        </div>

        <!-- Right: sidebar -->
        <div class="task-detail-sidebar">
          <div>
            <div class="task-detail-sidebar-title">Detalhes</div>
            <div class="task-detail-meta-list">
              <div><strong>Criado:</strong> ${date(tarefa.created_at)}</div>
              <div><strong>Atualizado:</strong> ${date(tarefa.updated_at)}</div>
              ${tarefa.data_inicio ? `<div><strong>Início:</strong> ${date(tarefa.data_inicio)}</div>` : ''}
              ${tarefa.data_vencimento ? `<div><strong>Vencimento:</strong> ${date(tarefa.data_vencimento)}</div>` : ''}
              <div><strong>Recorrência:</strong> ${escapeHtml(taskRecurrenceText(tarefa))}</div>
              ${clTotal > 0 ? `
              <div>
                <strong>Progresso:</strong> ${clDone}/${clTotal} itens (${pct}%)
                <div class="task-detail-overall-progress">
                  <div class="task-detail-overall-progress-fill" style="width:${pct}%"></div>
                </div>
              </div>` : ''}
            </div>
          </div>

          <div>
            <div class="task-detail-sidebar-title">Atividade</div>
            <div class="task-detail-activity-item">
              <div class="task-detail-activity-avatar">TM</div>
              <div class="task-detail-activity-body">
                Tarefa criada
                <div class="task-detail-activity-time">${date(tarefa.created_at)}</div>
              </div>
            </div>
            ${tarefa.concluida_em ? `
            <div class="task-detail-activity-item">
              <div class="task-detail-activity-avatar" style="background:var(--green)"><i data-lucide="check" style="width:12px;height:12px"></i></div>
              <div class="task-detail-activity-body">
                Tarefa concluída
                <div class="task-detail-activity-time">${date(tarefa.concluida_em)}</div>
              </div>
            </div>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildChecklistSection(list, li, tarefaId) {
  const items = list.items || [];
  const done  = items.filter((i) => i.done).length;
  const total = items.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  return `
    <div class="task-checklist">
      <div class="task-checklist-head">
        <div class="task-checklist-title-row">
          <input class="task-checklist-name" type="text" value="${escapeHtml(list.title || 'Checklist')}" data-td-action="rename-checklist" data-id="${tarefaId}" data-li="${li}" placeholder="Nome">
          <span class="task-checklist-count">${done} de ${total}</span>
          <div class="task-checklist-progress-bar">
            <div class="task-checklist-progress-fill${pct === 100 ? ' complete' : ''}" style="width:${pct}%"></div>
          </div>
        </div>
        <button class="task-checklist-del-btn" data-td-action="delete-checklist" data-id="${tarefaId}" data-li="${li}" title="Remover checklist">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
      <div class="task-checklist-items">
        ${items.map((item, ii) => buildChecklistItem(item, li, ii, tarefaId)).join('')}
      </div>
      <div class="task-checklist-add-item-row">
        <button class="task-checklist-add-item-btn" data-td-action="add-checklist-item" data-id="${tarefaId}" data-li="${li}">
          <i data-lucide="plus"></i> Adicionar item
        </button>
      </div>
    </div>
  `;
}

function buildChecklistItem(item, li, ii, tarefaId) {
  return `
    <div class="task-checklist-item">
      <input type="checkbox" ${item.done ? 'checked' : ''} data-td-action="toggle-checklist-item" data-id="${tarefaId}" data-li="${li}" data-ii="${ii}" aria-label="Marcar item">
      <input type="text" class="task-checklist-item-text${item.done ? ' is-done' : ''}" value="${escapeHtml(item.text || '')}" data-td-action="rename-checklist-item" data-id="${tarefaId}" data-li="${li}" data-ii="${ii}" placeholder="Item...">
      <button class="task-checklist-item-del" data-td-action="delete-checklist-item" data-id="${tarefaId}" data-li="${li}" data-ii="${ii}" title="Remover">✕</button>
    </div>
  `;
}

function bindTaskDetailActions() {
  const overlay = document.getElementById('taskDetailOverlay');
  if (!overlay) return;

  // Close on backdrop click (clicking the dark area outside the panel)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTaskDetail();
  });

  // Keyboard Esc
  const onEsc = (e) => { if (e.key === 'Escape') { closeTaskDetail(); document.removeEventListener('keydown', onEsc); } };
  document.addEventListener('keydown', onEsc);

  overlay.querySelectorAll('[data-td-action]').forEach((el) => {
    const action = el.dataset.tdAction;

    if (action === 'close') el.addEventListener('click', closeTaskDetail);

    if (action === 'edit') el.addEventListener('click', () => { closeTaskDetail(); openForm(el.dataset.entity, el.dataset.id); });
    if (action === 'delete') el.addEventListener('click', () => { closeTaskDetail(); handleDelete(el.dataset.entity, el.dataset.id); });

    // Status dropdown
    if (action === 'open-status-menu') el.addEventListener('click', () => openStatusMenu(el));

    // Inline field save (blur)
    if (el.dataset.tdField) {
      el.addEventListener('blur', () => saveTaskField(el.dataset.id, el.dataset.tdField, el.value));
      if (el.type === 'date') el.addEventListener('change', () => saveTaskField(el.dataset.id, el.dataset.tdField, el.value));
    }

    // Checklist actions
    if (action === 'add-checklist')       el.addEventListener('click', () => addChecklist(el.dataset.id));
    if (action === 'delete-checklist')    el.addEventListener('click', () => deleteChecklist(el.dataset.id, +el.dataset.li));
    if (action === 'rename-checklist')    el.addEventListener('blur',  () => renameChecklist(el.dataset.id, +el.dataset.li, el.value));
    if (action === 'add-checklist-item')  el.addEventListener('click', () => addChecklistItem(el.dataset.id, +el.dataset.li));
    if (action === 'toggle-checklist-item') el.addEventListener('change', () => toggleChecklistItem(el.dataset.id, +el.dataset.li, +el.dataset.ii, el.checked));
    if (action === 'rename-checklist-item') el.addEventListener('blur', () => renameChecklistItem(el.dataset.id, +el.dataset.li, +el.dataset.ii, el.value));
    if (action === 'delete-checklist-item') el.addEventListener('click', () => deleteChecklistItem(el.dataset.id, +el.dataset.li, +el.dataset.ii));
  });
}

function openStatusMenu(btn) {
  // Remove any existing dropdown
  document.querySelector('.task-status-dropdown')?.remove();
  const statuses = [
    { value: 'pendente',     label: 'Pendente' },
    { value: 'em_andamento', label: 'Em andamento' },
    { value: 'concluida',    label: 'Concluída' },
    { value: 'cancelada',    label: 'Cancelada' },
  ];
  const menu = document.createElement('div');
  menu.className = 'task-status-dropdown';
  menu.innerHTML = statuses.map((s) => `
    <button class="task-status-dropdown-item" data-value="${s.value}">
      <span class="task-status-dropdown-dot status-dot-${s.value}"></span> ${s.label}
    </button>
  `).join('');
  btn.parentElement.appendChild(menu);
  menu.querySelectorAll('button').forEach((item) => {
    item.addEventListener('click', async () => {
      menu.remove();
      const newStatus = item.dataset.value;
      const id = btn.dataset.id;
      const tarefa = state.tarefas.find((item) => item.id === id);
      const { patch, rescheduled } = buildTaskStatusPatch(tarefa, newStatus);
      try {
        await tarefaService.update(id, patch);
        const idx = state.tarefas.findIndex((t) => t.id === id);
        if (idx >= 0) state.tarefas[idx] = { ...state.tarefas[idx], ...patch };
        refreshTaskDetail();
        rerenderTaskRowInPlace(id);
        toast(rescheduled ? `Tarefa semanal reagendada para ${date(patch.data_vencimento)}.` : `Status: ${item.textContent.trim()}`);
      } catch (e) { showError(e); }
    });
  });
  // Close on outside click
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 50);
}

async function saveTaskField(id, field, value) {
  try {
    const payload = { [field]: value || null };
    await tarefaService.update(id, payload);
    const idx = state.tarefas.findIndex((t) => t.id === id);
    if (idx >= 0) state.tarefas[idx] = { ...state.tarefas[idx], [field]: value || null };
    rerenderTaskRowInPlace(id);
  } catch (e) { showError(e); }
}

// ── Checklist helpers ────────────────────────────────────────────────────────

function getTaskChecklists(id) {
  const t = state.tarefas.find((t) => t.id === id);
  return JSON.parse(JSON.stringify(t?.checklists || []));
}

async function saveChecklists(id, checklists) {
  try {
    await tarefaService.update(id, { checklists });
    const idx = state.tarefas.findIndex((t) => t.id === id);
    if (idx >= 0) state.tarefas[idx] = { ...state.tarefas[idx], checklists };
    refreshTaskDetail();
    rerenderTaskRowInPlace(id);
  } catch (e) { showError(e); }
}

async function addChecklist(id) {
  const lists = getTaskChecklists(id);
  lists.push({ title: 'Nova lista', items: [] });
  await saveChecklists(id, lists);
}

async function deleteChecklist(id, li) {
  if (!confirm('Remover este checklist?')) return;
  const lists = getTaskChecklists(id);
  lists.splice(li, 1);
  await saveChecklists(id, lists);
}

async function renameChecklist(id, li, title) {
  const lists = getTaskChecklists(id);
  if (!lists[li] || lists[li].title === title) return;
  lists[li].title = title;
  await saveChecklists(id, lists);
}

async function addChecklistItem(id, li) {
  const lists = getTaskChecklists(id);
  if (!lists[li]) return;
  if (!lists[li].items) lists[li].items = [];
  lists[li].items.push({ text: 'Novo item', done: false });
  await saveChecklists(id, lists);
}

async function toggleChecklistItem(id, li, ii, done) {
  const lists = getTaskChecklists(id);
  if (!lists[li]?.items?.[ii]) return;
  lists[li].items[ii].done = done;
  await saveChecklists(id, lists);
}

async function renameChecklistItem(id, li, ii, text) {
  const lists = getTaskChecklists(id);
  if (!lists[li]?.items?.[ii]) return;
  if (lists[li].items[ii].text === text.trim()) return;
  lists[li].items[ii].text = text.trim();
  await saveChecklists(id, lists);
}

async function deleteChecklistItem(id, li, ii) {
  const lists = getTaskChecklists(id);
  if (!lists[li]?.items) return;
  lists[li].items.splice(ii, 1);
  await saveChecklists(id, lists);
}

async function moveLead(id, etapa) {
  const previousLead = state.leads.find((item) => item.id === id);
  try {
    const patch = { aguardando_resposta_manual: false, tentativa: 0 };
    await leadCrmService.moveStage(id, etapa, patch);
    if (['respondeu', 'qualificado'].includes(etapa) && previousLead?.etapa !== etapa) {
      await sendCrmMetaEvent(id, previousLead?.etapa || null);
    }
    const idx = state.leads.findIndex((item) => item.id === id);
    if (idx >= 0) state.leads[idx] = { ...state.leads[idx], etapa, ...patch };
    render();
    toast(`Lead movido para ${label(etapa)}.`);
  } catch (error) {
    showError(error);
  }
}

async function sendCrmMetaEvent(id, previousStage = null) {
  try {
    const { data, error } = await supabase.functions.invoke('send-qualified-lead-event', {
      body: {
        lead_id: id,
        previous_stage: previousStage,
      },
    });
    if (error) throw error;
    if (data?.skipped) {
      toast('Evento Meta ja tinha sido enviado.');
      return data;
    }
    toast('Evento CRM enviado para Meta.');
    return data;
  } catch (error) {
    console.warn('Falha ao enviar evento CRM para Meta.', error);
    toast('Etapa atualizada, mas o evento Meta falhou. Confira os logs.', 'error');
    return null;
  }
}

async function convertLead(id) {
  const lead = state.leads.find((item) => item.id === id);
  if (!lead) return;
  try {
    const cliente = await clienteService.create({
      nome_empresa: lead.nome_empresa,
      responsavel: lead.responsavel,
      whatsapp: lead.whatsapp,
      email: lead.email,
      instagram: lead.instagram,
      segmento: lead.nicho,
      cidade: lead.cidade,
      estado: lead.estado,
      status: 'ativo',
      valor_mensal: lead.investimento_disponivel,
      observacoes: lead.observacoes,
    });
    await createDefaultTasksForNewClient(cliente);
    await loadAll();
    state.detailClienteId = cliente.id;
    state.detailTab = 'onboarding';
    render();
    toast('Lead transformado em cliente.');
  } catch (error) {
    showError(error);
  }
}

async function updateOnboarding(id, payload) {
  try {
    await onboardingService.update(id, payload);
    toast('Checklist atualizado.');
  } catch (error) {
    showError(error);
  }
}

async function saveDiaryField(clienteId, id, patch) {
  try {
    const diary = await upsertDiaryEntry(clienteId, id, patch);
    const index = state.diarios.findIndex((item) => item.id === diary.id);
    if (index >= 0) state.diarios[index] = { ...state.diarios[index], ...diary };
    else state.diarios.push(diary);
  } catch (error) {
    if (isMissingDiaryTableError(error)) {
      state.diarioMissingTable = true;
      render();
      toast('Execute a migration do Diario de Bordo no Supabase para salvar.', 'error');
      return;
    }
    showError(error);
  }
}

async function upsertDiaryEntry(clienteId, id, patch = {}) {
  const selectedDate = state.diarioDate || isoDate(new Date());
  const current = id ? state.diarios.find((item) => item.id === id) : state.diarios.find((item) => item.cliente_id === clienteId && item.data_registro === selectedDate);
  const draft = getDiaryDraftFromDom(clienteId);
  const payload = {
    cliente_id: clienteId || null,
    data_registro: selectedDate,
    autor: current?.autor || draft.autor || 'Nicolas',
    revisao_verba_ok: draft.revisao_verba_ok,
    anotacoes: draft.anotacoes || '',
    comentario_admin: draft.comentario_admin || null,
    tags: current?.tags || null,
    status: current?.status || 'aberto',
    ...patch,
  };
  if (current?.id) return diarioBordoService.update(current.id, payload);
  return diarioBordoService.create(payload);
}

function getDiaryDraftFromDom(clienteId) {
  const fieldSelector = (field) => `[data-action="diary-field"][data-client="${clienteId}"][data-field="${field}"]`;
  const okSelector = `[data-action="diary-ok"][data-client="${clienteId}"]`;
  return {
    autor: state.session?.user?.email || 'Nicolas',
    anotacoes: document.querySelector(fieldSelector('anotacoes'))?.value || '',
    comentario_admin: document.querySelector(fieldSelector('comentario_admin'))?.value || '',
    revisao_verba_ok: document.querySelector(okSelector)?.checked ?? false,
  };
}

async function createTaskFromDiary(id, clienteId) {
  const diary = id ? state.diarios.find((item) => item.id === id) : await upsertDiaryEntry(clienteId, id);
  if (!diary) return;
  const clienteName = diary.clientes?.nome_empresa || getClienteName(diary.cliente_id);
  const firstLine = (diary.anotacoes || '').split('\n').find(Boolean) || 'Acompanhar anotacao do diario';
  try {
    await tarefaService.create({
      cliente_id: diary.cliente_id || null,
      titulo: `${clienteName ? `${clienteName}: ` : ''}${firstLine.slice(0, 110)}`,
      descricao: [
        `Origem: Diario de bordo de ${date(diary.data_registro)}`,
        diary.anotacoes || '',
        diary.comentario_admin ? `Comentario interno: ${diary.comentario_admin}` : '',
      ].filter(Boolean).join('\n\n'),
      responsavel: diary.autor || null,
      prioridade: 'media',
      status: 'pendente',
      data_vencimento: isoDate(new Date()),
    });
    await diarioBordoService.update(diary.id, { status: 'tarefa_criada' });
    await loadAll();
    render();
    toast('Tarefa criada a partir do diario.');
  } catch (error) {
    if (isMissingDiaryTableError(error)) {
      state.diarioMissingTable = true;
      render();
      toast('Execute a migration do Diario de Bordo no Supabase para criar tarefas a partir dele.', 'error');
      return;
    }
    showError(error);
  }
}

function createTaskFromAlerta(alertaId) {
  const alerta = state.alertas.find((a) => a.id === alertaId);
  if (!alerta) return;

  const metricaLabel = { cpl: 'CPL', ctr: 'CTR', roas: 'ROAS', spend: 'Gasto diario', diario: 'Anotacao do diario' };
  const isMonetary = ['cpl', 'spend'].includes(alerta.metrica);
  const fmtV = (v) => v == null ? '-' : isMonetary ? money(v) : (alerta.metrica === 'ctr' ? `${Number(v).toFixed(2)}%` : `${Number(v).toFixed(2)}x`);
  const clienteName = alerta.clientes?.nome_empresa || alerta.nome_cliente || '';
  const metaRec = state.metas.find((m) => m.id === alerta.meta_id);
  const goalMap = { cpl: metaRec?.meta_custo_resultado, roas: metaRec?.meta_roas_minimo, ctr: metaRec?.meta_ctr_minimo, spend: metaRec?.verba_diaria_maxima };
  const goal = goalMap[alerta.metrica];
  const v1 = alerta.valor_1d ?? alerta.valor_atual;
  const sevToPrority = { critica: 'urgente', alta: 'alta', media: 'media' };

  const isDiaryAlert = alerta.metrica === 'diario';
  const defaultTitle = isDiaryAlert
    ? `${clienteName ? `${clienteName}: ` : ''}Ver anotacao do gestor`
    : `${clienteName ? `${clienteName} - ` : ''}${metricaLabel[alerta.metrica] || alerta.metrica} fora da meta (hoje: ${fmtV(v1)}${goal != null ? `, meta: ${fmtV(goal)}` : ''})`;
  const defaultDesc = isDiaryAlert
    ? [
      `Alerta gerado automaticamente em ${date(alerta.created_at)}.`,
      'Origem: anotacao criada por gestor de trafego no Diario de Bordo.',
      alerta.objetivo ? `Anotacao: ${alerta.objetivo}` : null,
      `Severidade: ${alerta.severidade}`,
    ].filter(Boolean).join('\n')
    : [
      `Alerta gerado automaticamente em ${date(alerta.created_at)}.`,
      `Metrica: ${metricaLabel[alerta.metrica] || alerta.metrica}`,
      `Hoje: ${fmtV(v1)}`,
      alerta.valor_3d != null ? `Ultimos 3d: ${fmtV(alerta.valor_3d)}` : null,
      alerta.valor_referencia != null ? `Ultimos 7d: ${fmtV(alerta.valor_referencia)}` : null,
      goal != null ? `Meta configurada: ${fmtV(goal)}` : null,
      `Severidade: ${alerta.severidade}`,
    ].filter(Boolean).join('\n');

  const tomorrow = isoDate(new Date(Date.now() + 86400000));
  const prioridade = sevToPrority[alerta.severidade] || 'media';

  const equipeOptions = state.equipe.filter((m) => m.status === 'ativo').map((m) => `<option value="${escapeHtml(m.nome)}">${escapeHtml(m.nome)}${m.cargo ? ` — ${escapeHtml(m.cargo)}` : ''}</option>`).join('');

  modalEyebrow.textContent = 'A partir do alerta';
  modalTitle.textContent = 'Criar tarefa';
  modalForm.innerHTML = `
    <div class="form-grid">
      <label class="full">Titulo<input class="input" type="text" name="titulo" value="${escapeHtml(defaultTitle)}" required></label>
      <label>Responsavel<select name="responsavel"><option value="">Nao atribuido</option>${equipeOptions}</select></label>
      <label>Prioridade<select name="prioridade"><option value="baixa" ${prioridade==='baixa'?'selected':''}>Baixa</option><option value="media" ${prioridade==='media'?'selected':''}>Media</option><option value="alta" ${prioridade==='alta'?'selected':''}>Alta</option><option value="urgente" ${prioridade==='urgente'?'selected':''}>Urgente</option></select></label>
      <label>Data de vencimento<input class="input" type="date" name="data_vencimento" value="${tomorrow}"></label>
      <label class="full">Descricao<textarea name="descricao">${escapeHtml(defaultDesc)}</textarea></label>
      <div class="form-actions"><button type="button" class="secondary-button" data-modal-cancel>Cancelar</button><button class="button" type="submit"><i data-lucide="clipboard-list"></i>Criar tarefa</button></div>
    </div>
  `;
  modalBackdrop.hidden = false;
  modalForm.querySelector('[data-modal-cancel]')?.addEventListener('click', closeModal);
  modalForm.onsubmit = async (event) => {
    event.preventDefault();
    const fd = new FormData(event.target);
    try {
      await tarefaService.create({
        cliente_id: alerta.cliente_id || null,
        titulo: fd.get('titulo'),
        descricao: fd.get('descricao') || null,
        responsavel: fd.get('responsavel') || null,
        prioridade: fd.get('prioridade') || 'media',
        status: 'pendente',
        data_vencimento: fd.get('data_vencimento') || null,
      });
      closeModal();
      await loadAll();
      render();
      toast('Tarefa criada a partir do alerta!');
    } catch (error) { showError(error); }
  };
  renderLucide();
}

async function createObservationFromDiary(id, clienteId) {
  const diary = id ? state.diarios.find((item) => item.id === id) : await upsertDiaryEntry(clienteId, id);
  if (!diary) return;
  if (!diary.cliente_id) {
    toast('Vincule um cliente antes de salvar como observacao.', 'error');
    return;
  }
  try {
    await observacaoClienteService.create({
      cliente_id: diary.cliente_id,
      autor: state.session?.user?.email || diary.autor || null,
      tipo: 'estrategia',
      observacao: [
        `Diario de bordo - ${date(diary.data_registro)}`,
        diary.anotacoes || '',
        diary.comentario_admin ? `Comentario interno: ${diary.comentario_admin}` : '',
      ].filter(Boolean).join('\n\n'),
    });
    await diarioBordoService.update(diary.id, { status: diary.status === 'tarefa_criada' ? 'tarefa_criada' : 'comentado' });
    await loadAll();
    render();
    toast('Observacao salva no cliente.');
  } catch (error) {
    if (isMissingDiaryTableError(error)) {
      state.diarioMissingTable = true;
      render();
      toast('Execute a migration do Diario de Bordo no Supabase para salvar observacoes.', 'error');
      return;
    }
    showError(error);
  }
}

function bindReportCalculations() {
  const fields = ['investimento', 'impressoes', 'cliques', 'leads', 'mensagens', 'faturamento_informado'];
  fields.forEach((field) => modalForm.querySelector(`[name="${field}"]`)?.addEventListener('input', () => {
    const payload = Object.fromEntries(new FormData(modalForm).entries());
    const calculated = calculateReport(payload);
    ['ctr', 'cpc', 'custo_por_lead', 'custo_por_mensagem', 'roas'].forEach((key) => {
      const input = modalForm.querySelector(`[name="${key}"]`);
      if (input) input.value = calculated[key];
    });
  }));
}

function calculateReport(payload) {
  const investimento = Number(payload.investimento || 0);
  const impressoes = Number(payload.impressoes || 0);
  const cliques = Number(payload.cliques || 0);
  const leads = Number(payload.leads || 0);
  const mensagens = Number(payload.mensagens || 0);
  const faturamento = Number(payload.faturamento_informado || 0);
  return {
    ctr: impressoes ? Number(((cliques / impressoes) * 100).toFixed(4)) : 0,
    cpc: cliques ? Number((investimento / cliques).toFixed(2)) : 0,
    custo_por_lead: leads ? Number((investimento / leads).toFixed(2)) : 0,
    custo_por_mensagem: mensagens ? Number((investimento / mensagens).toFixed(2)) : 0,
    roas: investimento ? Number((faturamento / investimento).toFixed(4)) : 0,
  };
}

function getFormSchema(entity) {
  const clienteOptions = state.clientes.map((cliente) => ({ value: cliente.id, label: cliente.nome_empresa }));
  const clientSelect = { name: 'cliente_id', label: 'Cliente', type: 'select', options: clienteOptions.map((c) => c.value), customLabels: clienteOptions };
  const taskResponsibleOptions = getTaskResponsibleFormOptions();
  const schemas = {
    clientes: {
      title: 'Cliente',
      fields: [
        { name: 'nome_empresa', label: 'Nome da empresa', required: true },
        { name: 'responsavel', label: 'Responsavel' },
        { name: 'whatsapp', label: 'WhatsApp' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'segmento', label: 'Segmento' },
        { name: 'cidade', label: 'Cidade' },
        { name: 'estado', label: 'Estado' },
        { name: 'status', label: 'Status', type: 'select', options: ['ativo', 'pausado', 'cancelado', 'prospect'], default: 'ativo' },
        { name: 'plano_contratado', label: 'Plano contratado', type: 'select', options: ['starter', 'growth', 'premium', 'personalizado'] },
        { name: 'valor_mensal', label: 'Valor mensal', type: 'number' },
        { name: 'data_entrada', label: 'Data de entrada', type: 'date' },
        { name: 'data_renovacao', label: 'Data de renovacao', type: 'date' },
        { name: 'verba_mensal_trafego', label: 'Verba mensal de trafego', type: 'number' },
        { name: 'meta_ads_act', label: 'Meta Ads act' },
        { name: 'google_ads_id', label: 'Google Ads ID' },
        { name: 'instagram', label: 'Instagram' },
        { name: 'site', label: 'Site' },
        { name: 'landing_page', label: 'Landing page' },
        { name: 'crm_utilizado', label: 'CRM utilizado' },
        { name: 'responsavel_interno', label: 'Responsavel interno', type: 'select', options: taskResponsibleOptions.map((item) => item.value), customLabels: taskResponsibleOptions },
        { name: 'observacoes', label: 'Observacoes', type: 'textarea' },
      ],
    },
    crm: {
      title: 'Lead CRM',
      fields: [
        { name: 'nome_empresa', label: 'Nome da empresa', required: true },
        { name: 'responsavel', label: 'Responsavel' },
        { name: 'whatsapp', label: 'WhatsApp' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'instagram', label: 'Instagram' },
        { name: 'nicho', label: 'Nicho' },
        { name: 'cidade', label: 'Cidade' },
        { name: 'estado', label: 'Estado' },
        { name: 'origem_lead', label: 'Origem do lead' },
        { name: 'etapa', label: 'Etapa', type: 'select', options: crmStages, default: 'lead_novo' },
        { name: 'potencial', label: 'Potencial', type: 'select', options: ['baixo', 'medio', 'alto'] },
        { name: 'ticket_medio', label: 'Ticket medio', type: 'number' },
        { name: 'investimento_disponivel', label: 'Investimento disponivel', type: 'number' },
        { name: 'data_proximo_contato', label: 'Data proximo contato', type: 'date' },
        { name: 'proxima_acao', label: 'Proxima acao' },
        { name: 'dor_principal', label: 'Dor principal', type: 'textarea' },
        { name: 'motivo_perda', label: 'Motivo da perda', type: 'textarea' },
        { name: 'observacoes', label: 'Observacoes', type: 'textarea' },
      ],
    },
    campanhas: {
      title: 'Campanha',
      fields: [
        clientSelect,
        { name: 'plataforma', label: 'Plataforma', type: 'select', options: ['meta_ads', 'google_ads', 'tiktok_ads', 'linkedin_ads', 'outro'], required: true },
        { name: 'nome_campanha', label: 'Nome da campanha', required: true },
        { name: 'objetivo', label: 'Objetivo' },
        { name: 'verba_diaria', label: 'Verba diaria', type: 'number' },
        { name: 'verba_mensal', label: 'Verba mensal', type: 'number' },
        { name: 'data_inicio', label: 'Data inicio', type: 'date' },
        { name: 'data_fim', label: 'Data fim', type: 'date' },
        { name: 'status', label: 'Status', type: 'select', options: ['ativa', 'pausada', 'encerrada', 'teste'], default: 'ativa' },
        { name: 'criativos_utilizados', label: 'Criativos utilizados', type: 'textarea' },
        { name: 'publico', label: 'Publico', type: 'textarea' },
        { name: 'observacoes_otimizacao', label: 'Observacoes de otimizacao', type: 'textarea' },
      ],
    },
    relatorios: {
      title: 'Relatorio',
      fields: [
        clientSelect,
        { name: 'periodo_inicio', label: 'Periodo inicio', type: 'date', required: true },
        { name: 'periodo_fim', label: 'Periodo fim', type: 'date', required: true },
        { name: 'investimento', label: 'Investimento', type: 'number', default: 0 },
        { name: 'impressoes', label: 'Impressoes', type: 'number', default: 0 },
        { name: 'alcance', label: 'Alcance', type: 'number', default: 0 },
        { name: 'cliques', label: 'Cliques', type: 'number', default: 0 },
        { name: 'ctr', label: 'CTR calculado', type: 'number', default: 0 },
        { name: 'cpc', label: 'CPC calculado', type: 'number', default: 0 },
        { name: 'leads', label: 'Leads', type: 'number', default: 0 },
        { name: 'custo_por_lead', label: 'Custo por lead', type: 'number', default: 0 },
        { name: 'mensagens', label: 'Mensagens', type: 'number', default: 0 },
        { name: 'custo_por_mensagem', label: 'Custo por mensagem', type: 'number', default: 0 },
        { name: 'vendas', label: 'Vendas', type: 'number', default: 0 },
        { name: 'faturamento_informado', label: 'Faturamento informado', type: 'number', default: 0 },
        { name: 'roas', label: 'ROAS calculado', type: 'number', default: 0 },
        { name: 'analise_estrategica', label: 'Analise estrategica', type: 'textarea' },
        { name: 'proximos_passos', label: 'Proximos passos', type: 'textarea' },
      ],
    },
    vendas: {
      title: 'Venda do cliente',
      fields: [
        clientSelect,
        { name: 'data_venda', label: 'Data da venda', type: 'date', required: true, default: isoDate(new Date()) },
        { name: 'valor_total', label: 'Valor total vendido', type: 'number', required: true, default: 0 },
        { name: 'quantidade_vendas', label: 'Quantidade de vendas/pedidos', type: 'number', required: true, default: 1 },
        { name: 'quantidade_produtos', label: 'Quantidade de produtos', type: 'number', required: true, default: 1 },
        { name: 'origem', label: 'Origem da venda', default: 'Manual' },
        { name: 'observacoes', label: 'Observacoes', type: 'textarea' },
      ],
    },
    tarefas: {
      title: 'Tarefa',
      fields: [
        clientSelect,
        { name: 'titulo', label: 'Titulo', required: true },
        { name: 'categoria', label: 'Categoria', default: 'Geral' },
        { name: 'responsavel', label: 'Responsavel', type: 'select', options: taskResponsibleOptions.map((item) => item.value), customLabels: taskResponsibleOptions },
        { name: 'prioridade', label: 'Prioridade', type: 'select', options: ['baixa', 'media', 'alta', 'urgente'], default: 'media' },
        { name: 'status', label: 'Status', type: 'select', options: ['pendente', 'em_andamento', 'concluida', 'cancelada'], default: 'pendente' },
        { name: 'data_inicio', label: 'Data de inicio', type: 'date' },
        { name: 'data_vencimento', label: 'Data de vencimento', type: 'date' },
        { name: 'recorrencia', label: 'Recorrencia', type: 'select', options: ['nenhuma', 'diaria', 'semanal', 'mensal_primeiro_dia_util'], customLabels: [{ value: 'nenhuma', label: 'Nao repetir' }, { value: 'diaria', label: 'Diaria' }, { value: 'semanal', label: 'Semanal' }, { value: 'mensal_primeiro_dia_util', label: 'Mensal, primeiro dia util' }], default: 'nenhuma' },
        { name: 'recorrencia_dia_semana', label: 'Dia da semana (se recorrente)', type: 'select', options: ['1', '2', '3', '4', '5', '6', '0'], customLabels: [{ value: '1', label: 'Segunda' }, { value: '2', label: 'Terca' }, { value: '3', label: 'Quarta' }, { value: '4', label: 'Quinta' }, { value: '5', label: 'Sexta' }, { value: '6', label: 'Sabado' }, { value: '0', label: 'Domingo' }], default: '1' },
        { name: 'descricao', label: 'Descricao', type: 'textarea' },
      ],
    },
    diario: {
      title: 'Diario de bordo',
      fields: [
        { name: 'data_registro', label: 'Data', type: 'date', required: true, default: isoDate(new Date()) },
        clientSelect,
        { name: 'autor', label: 'Autor', default: state.session?.user?.email || 'Nicolas' },
        { name: 'revisao_verba_ok', label: 'Revisao de verba e performance', type: 'select', options: ['true', 'false'], customLabels: [{ value: 'true', label: 'OK' }, { value: 'false', label: 'Nao marcada' }], default: 'false' },
        { name: 'status', label: 'Status', type: 'select', options: ['aberto', 'comentado', 'tarefa_criada', 'resolvido'], default: 'aberto' },
        { name: 'tags', label: 'Marcadores' },
        { name: 'anotacoes', label: 'Anotacoes do gestor', type: 'textarea', required: true },
        { name: 'comentario_admin', label: 'Comentario interno', type: 'textarea' },
      ],
    },
    equipe: {
      title: 'Membro da equipe',
      fields: [
        { name: 'nome', label: 'Nome', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'senha', label: 'Senha de acesso', type: 'password' },
        { name: 'cargo', label: 'Cargo' },
        { name: 'funcao', label: 'Funcao', type: 'select', options: ['gestor_trafego', 'operacao', 'admin'], customLabels: [{ value: 'gestor_trafego', label: 'Gestor de trafego' }, { value: 'operacao', label: 'Operacao' }, { value: 'admin', label: 'Admin' }], default: 'gestor_trafego' },
        { name: 'cliente_ids', label: 'Clientes permitidos', type: 'multiselect', options: clienteOptions.map((c) => c.value), customLabels: clienteOptions, full: true, helper: 'Marque as contas que este gestor pode visualizar.' },
        { name: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo'], default: 'ativo' },
      ],
    },
    ativos: {
      title: 'Ativo do cliente',
      fields: [
        clientSelect,
        { name: 'tipo', label: 'Tipo', type: 'select', options: ['logo', 'criativo', 'video', 'copy', 'landing_page', 'documento', 'referencia', 'outro'] },
        { name: 'titulo', label: 'Titulo', required: true },
        { name: 'url', label: 'URL' },
        { name: 'descricao', label: 'Descricao', type: 'textarea' },
      ],
    },
    observacoes: {
      title: 'Observacao do cliente',
      fields: [
        clientSelect,
        { name: 'autor', label: 'Autor' },
        { name: 'tipo', label: 'Tipo', type: 'select', options: ['geral', 'reuniao', 'estrategia', 'problema', 'financeiro', 'resultado'], default: 'geral' },
        { name: 'observacao', label: 'Observacao', type: 'textarea', required: true },
      ],
    },
    metas: {
      title: 'Meta de performance',
      fields: [
        clientSelect,
        { name: 'objetivo', label: 'Objetivo principal', type: 'select', options: ['mensagens', 'leads', 'vendas', 'seguidores'], required: true },
        { name: 'meta_custo_resultado', label: 'Meta custo por resultado (R$)', type: 'number', full: false },
        { name: 'meta_roas_minimo', label: 'ROAS mínimo', type: 'number', full: false },
        { name: 'meta_ctr_minimo', label: 'CTR mínimo (%)', type: 'number', full: false },
        { name: 'verba_diaria_maxima', label: 'Verba diária máxima (R$)', type: 'number', full: false },
        { name: 'threshold_variacao_pct', label: 'Alerta se variar mais de (%) vs 7 dias', type: 'number', default: '30' },
        { name: 'ativo', label: 'Status', type: 'select', options: ['true', 'false'], customLabels: [{ value: 'true', label: 'Ativo' }, { value: 'false', label: 'Pausado' }], default: 'true' },
        { name: 'observacoes', label: 'Observacoes', type: 'textarea' },
      ],
    },
  };
  return schemas[entity];
}

function closeModal() {
  modalBackdrop.hidden = true;
  modalForm.innerHTML = '';
  modalForm.onsubmit = null;
  state.activeConversationLeadId = null;
}

function getService(entity) {
  return {
    ...services,
    ativos: ativoClienteService,
    observacoes: observacaoClienteService,
    diario: diarioBordoService,
    metas: metaClienteService,
    vendas: vendaClienteService,
  }[entity];
}

function getEntityList(entity) {
  return {
    clientes: state.clientes,
    crm: state.leads,
    campanhas: state.campanhas,
    relatorios: state.relatorios,
    vendas: state.vendas,
    tarefas: state.tarefas,
    diario: state.diarios,
    equipe: state.equipe,
    ativos: [],
    observacoes: [],
    metas: state.metas,
  }[entity] || [];
}

function getClienteName(id) {
  return state.clientes.find((cliente) => cliente.id === id)?.nome_empresa || '';
}

function getOverdueTasks(tasks = state.tarefas) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return tasks.filter((task) => task.data_vencimento && !['concluida', 'cancelada'].includes(task.status) && new Date(`${task.data_vencimento}T00:00:00`) < today);
}

function daysSince(value) {
  if (!value) return 9999;
  return Math.floor((Date.now() - new Date(`${value}T00:00:00`).getTime()) / 86400000);
}

function onboardingProgress(onboarding) {
  if (!onboarding) return 0;
  const done = onboardingFields.filter((field) => onboarding[field]).length;
  return Math.round((done / onboardingFields.length) * 100);
}

function labelDetailTab(tab) {
  return {
    visao: 'Visao geral',
    campanhas: 'Campanhas',
    relatorios: 'Relatorios',
    vendas: 'Vendas',
    tarefas: 'Tarefas',
    onboarding: 'Onboarding',
    ativos: 'Ativos',
    observacoes: 'Observacoes',
  }[tab];
}

function labelOnboarding(field) {
  return field.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function getDefaultDateRange() {
  return getClosedDateRange(7);
}

function getClosedDateRange(days = 7) {
  const safeDays = Math.max(1, Number(days) || 7);
  const today = new Date();
  const until = new Date(today);
  until.setDate(until.getDate() - 1);
  const since = new Date(until);
  since.setDate(since.getDate() - safeDays + 1);
  return { since: isoDate(since), until: isoDate(until) };
}

function getSharedMetaDateRange() {
  return {
    since: state.metaAds.since || initialMetaDateRange.since,
    until: state.metaAds.until || initialMetaDateRange.until,
  };
}

function getLastMonthsBounds(count = 4) {
  const safeCount = Math.max(1, Number(count) || 4);
  const today = new Date();
  const until = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const since = new Date(today.getFullYear(), today.getMonth() - safeCount + 1, 1);
  return { since: isoDate(since), until: isoDate(until) };
}

function buildMonthsFromRange(range) {
  const start = new Date(`${range.since}T00:00:00`);
  const end = new Date(`${range.until}T00:00:00`);
  const months = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end && months.length < 12) {
    const since = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const until = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    months.push({
      since: isoDate(since),
      until: isoDate(until),
      label: monthLabel(since),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return months.slice(-4);
}

function monthLabel(value) {
  return value.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
}

function getFourWeekBoundsFromUntil(untilValue) {
  const until = new Date(`${untilValue || isoDate(new Date())}T00:00:00`);
  const since = new Date(until);
  since.setDate(since.getDate() - 27);
  return { since: isoDate(since), until: isoDate(until) };
}

function buildWeeksFromRange(range) {
  const start = new Date(`${range.since}T00:00:00`);
  return Array.from({ length: 4 }, (_, index) => {
    const since = new Date(start);
    since.setDate(start.getDate() + index * 7);
    const until = new Date(since);
    until.setDate(since.getDate() + 6);
    return { since: isoDate(since), until: isoDate(until) };
  });
}

function setSharedMetaDateRange(patch) {
  const current = getSharedMetaDateRange();
  const next = { ...current, ...patch };
  state.metaAds.since = next.since;
  state.metaAds.until = next.until;
}

function getThirtyDaysRange() {
  const today = new Date();
  const until = new Date(today);
  until.setDate(until.getDate() - 1);
  const since = new Date(until);
  since.setDate(since.getDate() - 29);
  return { since: isoDate(since), until: isoDate(until) };
}

function getRollingDateRange(days = 30) {
  const safeDays = Math.max(1, Number(days) || 30);
  const until = new Date();
  const since = new Date(until);
  since.setDate(since.getDate() - safeDays + 1);
  return { since: isoDate(since), until: isoDate(until) };
}

function getFourWeeksRange() {
  const today = new Date();
  const until = new Date(today);
  until.setDate(until.getDate() - 1);
  const since = new Date(until);
  since.setDate(since.getDate() - 27);
  return { since: isoDate(since), until: isoDate(until) };
}

function getPreviousPeriodRange(sinceValue, untilValue) {
  const since = new Date(`${sinceValue}T00:00:00`);
  const until = new Date(`${untilValue}T00:00:00`);
  const days = Math.max(1, Math.round((until.getTime() - since.getTime()) / 86400000) + 1);
  const previousUntil = new Date(since);
  previousUntil.setDate(previousUntil.getDate() - 1);
  const previousSince = new Date(previousUntil);
  previousSince.setDate(previousSince.getDate() - days + 1);
  return { since: isoDate(previousSince), until: isoDate(previousUntil) };
}

function isoDate(value) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function exportEntity(entity) {
  const rows = {
    clientes: state.clientes,
    campanhas: state.campanhas.map((item) => ({ ...item, cliente: item.clientes?.nome_empresa || getClienteName(item.cliente_id) })),
    relatorios: state.relatorios.map((item) => ({ ...item, cliente: item.clientes?.nome_empresa || getClienteName(item.cliente_id) })),
    vendas: state.vendas.map((item) => ({ ...item, cliente: item.clientes?.nome_empresa || getClienteName(item.cliente_id) })),
    tarefas: state.tarefas.map((item) => ({ ...item, cliente: item.clientes?.nome_empresa || getClienteName(item.cliente_id) })),
    diario: state.diarios.map((item) => ({ ...item, cliente: item.clientes?.nome_empresa || getClienteName(item.cliente_id) })),
    equipe: state.equipe,
  }[entity] || [];
  exportCsv(`${entity}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function exportCsv(filename, rows) {
  if (!rows.length) {
    toast('Nenhum dado para exportar.', 'error');
    return;
  }
  const normalized = rows.map((row) => flattenRow(row));
  const headers = Object.keys(normalized[0]);
  const csv = [
    headers.join(','),
    ...normalized.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  toast('CSV gerado.');
}

function flattenRow(row) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => typeof value !== 'object' || value === null).map(([key, value]) => [key, value ?? '']));
}

function csvEscape(value) {
  const text = String(value ?? '').replaceAll('"', '""');
  return /[",\n;]/.test(text) ? `"${text}"` : text;
}

async function fetchMetaAdsReport() {
  const token = state.metaAds.token;
  const cliente = state.clientes.find((item) => item.id === state.metaAds.clienteId);
  if (!token || token.length < 20) {
    toast('Informe um Access Token Meta Ads.', 'error');
    return;
  }
  if (!cliente?.meta_ads_act) {
    toast('Selecione um cliente com meta_ads_act cadastrado.', 'error');
    return;
  }

  state.metaAds.loading = true;
  state.metaAds.error = '';
  state.metaAds.report = null;
  state.googleAds.loading = false;
  state.googleAds.error = '';
  state.googleAds.report = null;
  render();

  try {
    const accountId = normalizeMetaAccount(cliente.meta_ads_act);
    const goal = metaGoalConfig[state.metaAds.goal] || metaGoalConfig.mensagens;
    const fourWeeks = getFourWeeksRange();
    const ads = await fetchMetaAds(token, accountId);
    const previousRange = getPreviousPeriodRange(state.metaAds.since, state.metaAds.until);
    const [rows, previousRows, weeklyRows] = await Promise.all([
      fetchMetaInsights(token, accountId, state.metaAds.since, state.metaAds.until, goal, ads),
      fetchMetaInsights(token, accountId, previousRange.since, previousRange.until, goal, ads),
      fetchMetaInsights(token, accountId, fourWeeks.since, fourWeeks.until, goal, ads, '7'),
    ]);
    const totals = summarizeMetaRows(rows);
    const previousTotals = summarizeMetaRows(previousRows);
    state.metaAds.report = {
      cliente,
      accountId,
      since: state.metaAds.since,
      until: state.metaAds.until,
      previous: {
        since: previousRange.since,
        until: previousRange.until,
        rows: previousRows,
        totals: previousTotals,
      },
      goalKey: state.metaAds.goal,
      goal,
      rows,
      weeklyRows,
      totals,
    };

    // Se o cliente tem Google Ads configurado, busca em paralelo
    if (cliente.google_ads_id) {
      fetchGoogleAdsReport(cliente, state.metaAds.since, state.metaAds.until);
    }
  } catch (error) {
    state.metaAds.error = error.message || 'Erro ao consultar Meta Ads.';
  } finally {
    state.metaAds.loading = false;
    render();
  }
}

async function fetchGoogleAdsReport(cliente, since, until) {
  state.googleAds.loading = true;
  state.googleAds.error = '';
  state.googleAds.report = null;
  render();
  try {
    const report = await fetchLocalGoogleAdsReport({ customerId: cliente.google_ads_id, since, until });
    report.clienteName = cliente.nome_empresa || '';
    state.googleAds.report = report;
  } catch (error) {
    state.googleAds.error = error.message || 'Erro ao consultar Google Ads.';
  } finally {
    state.googleAds.loading = false;
    render();
  }
}

async function fetchLocalGoogleAdsReport(payload) {
  const response = await fetch('/api/google-ads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data.error || 'API Google Ads indisponivel. Configure as credenciais no .env.');
  return data;
}

async function importLegacyMetaAdsClients() {
  const existingActs = new Set(state.clientes.map((cliente) => normalizeMetaAccount(cliente.meta_ads_act)).filter(Boolean));
  const toImport = legacyMetaAdsClients
    .filter((cliente) => !existingActs.has(cliente.meta_ads_act))
    .map((cliente) => ({
      ...cliente,
      observacoes: 'Importado do projeto Relatorios meta ads.',
    }));

  if (!toImport.length) {
    toast('Todos os clientes do Relatorios Meta Ads ja estao importados.');
    return;
  }

  try {
    for (const cliente of toImport) {
      await clienteService.create(cliente);
    }
    await loadAll();
    render();
    toast(`${toImport.length} cliente(s) importado(s).`);
  } catch (error) {
    showError(error);
  }
}

function inferMetaGoal(cliente) {
  const text = `${cliente?.nome_empresa || ''} ${cliente?.segmento || ''} ${cliente?.observacoes || ''}`.toLowerCase();
  if (text.includes('vendas') || text.includes('e-commerce') || text.includes('ecommerce') || text.includes('trokai') || text.includes('nv store')) return 'vendas';
  if (text.includes('leads') || text.includes('lead')) return 'leads';
  if (text.includes('seguidores') || text.includes('seguidor')) return 'seguidores';
  return 'mensagens';
}

function normalizeMetaAccount(value) {
  const raw = String(value || '').trim();
  return raw.startsWith('act_') ? raw : `act_${raw}`;
}

async function fetchMetaAccountResultCost(token, accountId, since, until, goal) {
  const fields = ['spend', 'actions'].join(',');
  const params = new URLSearchParams({
    fields,
    time_range: JSON.stringify({ since, until }),
    access_token: token,
  });
  const response = await fetch(`https://graph.facebook.com/v20.0/${accountId}/insights?${params.toString()}`);
  const data = await response.json();
  if (!response.ok || data.error) {
    const err = data.error || {};
    if (String(err.code) === '190') throw new Error('Token expirado');
    throw new Error(err.message || `Erro Meta Ads ${response.status}`);
  }
  const row = data.data?.[0] || {};
  const investimento = Number(row.spend || 0);
  const resultados = extractMetaAction(row, goal.actionTypes);
  return {
    investimento,
    resultados,
    custo: resultados ? investimento / resultados : 0,
  };
}

async function fetchMetaInsights(token, accountId, since, until, goal, ads, timeIncrement = '') {
  const fields = [
    'ad_id',
    'ad_name',
    'adset_id',
    'adset_name',
    'campaign_id',
    'campaign_name',
    'impressions',
    'reach',
    'clicks',
    'cpc',
    'cpm',
    'ctr',
    'spend',
    'actions',
    'action_values',
    'cost_per_action_type',
  ].join(',');
  const params = new URLSearchParams({
    level: 'ad',
    fields,
    time_range: JSON.stringify({ since, until }),
    limit: '100',
    access_token: token,
  });
  if (timeIncrement) params.set('time_increment', timeIncrement);
  const rows = [];
  let next = `https://graph.facebook.com/v20.0/${accountId}/insights?${params.toString()}`;
  while (next) {
    const response = await fetch(next);
    const data = await response.json();
    if (!response.ok || data.error) {
      const err = data.error || {};
      if (String(err.code) === '190') throw new Error('Token Meta Ads expirado ou invalido.');
      throw new Error(err.message || `Erro Meta Ads ${response.status}`);
    }
    rows.push(...(data.data || []).map((row) => normalizeMetaInsightRow(row, ads.get(row.ad_id), goal)));
    next = data.paging?.next || '';
  }
  return rows.sort((a, b) => b.spend - a.spend);
}

async function fetchMetaAds(token, accountId) {
  const fields = encodeURIComponent(['id', 'name', 'status', 'effective_status', 'campaign{id,name}', 'adset{id,name}', 'creative{id,name,thumbnail_url,image_url,object_story_spec}'].join(','));
  const ads = new Map();
  let next = `https://graph.facebook.com/v20.0/${accountId}/ads?fields=${fields}&effective_status=["ACTIVE"]&limit=100&access_token=${encodeURIComponent(token)}`;
  while (next) {
    const response = await fetch(next);
    const data = await response.json();
    if (!response.ok || data.error) {
      const err = data.error || {};
      if (String(err.code) === '190') throw new Error('Token Meta Ads expirado ou invalido.');
      throw new Error(err.message || `Erro Meta Ads ${response.status}`);
    }
    for (const ad of data.data || []) ads.set(ad.id, ad);
    next = data.paging?.next || '';
  }
  return ads;
}

function normalizeMetaInsightRow(row, ad = null, goal = metaGoalConfig.mensagens) {
  const resultados = extractMetaAction(row, goal.actionTypes);
  const leads = extractMetaAction(row, metaGoalConfig.leads.actionTypes);
  const mensagens = extractMetaAction(row, metaGoalConfig.mensagens.actionTypes);
  const vendas = extractMetaAction(row, metaGoalConfig.vendas.actionTypes);
  const faturamento = extractMetaActionValue(row, metaGoalConfig.vendas.actionTypes);
  return {
    campaign_id: row.campaign_id,
    campaign_name: ad?.campaign?.name || row.campaign_name,
    ad_id: row.ad_id,
    ad_name: ad?.name || row.ad_name,
    adset_id: row.adset_id,
    adset_name: ad?.adset?.name || row.adset_name,
    status: ad?.effective_status || ad?.status || 'ACTIVE',
    thumb: extractMetaThumb(ad?.creative),
    date_start: row.date_start || '',
    date_stop: row.date_stop || '',
    impressions: Number(row.impressions || 0),
    reach: Number(row.reach || 0),
    clicks: Number(row.clicks || 0),
    cpc: Number(row.cpc || 0),
    cpm: Number(row.cpm || 0),
    ctr: Number(row.ctr || 0),
    spend: Number(row.spend || 0),
    leads,
    mensagens,
    vendas,
    faturamento,
    resultados,
  };
}

function groupMetaRowsByWeek(rows) {
  const byPeriod = new Map();
  rows.forEach((row) => {
    const since = row.date_start || 'periodo';
    const until = row.date_stop || row.date_start || 'periodo';
    const key = `${since}|${until}`;
    const current = byPeriod.get(key) || { since, until, rows: [] };
    current.rows.push(row);
    byPeriod.set(key, current);
  });
  return [...byPeriod.values()].sort((a, b) => String(a.since).localeCompare(String(b.since)));
}

function buildFourWeekSummary(rows) {
  const range = getFourWeeksRange();
  const start = new Date(`${range.since}T00:00:00`);
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const since = new Date(start);
    since.setDate(start.getDate() + index * 7);
    const until = new Date(since);
    until.setDate(since.getDate() + 6);
    return { since: isoDate(since), until: isoDate(until), rows: [] };
  });

  rows.forEach((row) => {
    const rowSince = row.date_start ? new Date(`${row.date_start}T00:00:00`) : null;
    if (!rowSince) return;
    const index = Math.floor((rowSince.getTime() - start.getTime()) / (7 * 86400000));
    if (index >= 0 && index < 4) weeks[index].rows.push(row);
  });

  return weeks;
}

function extractMetaThumb(creative) {
  if (!creative) return '';
  if (creative.thumbnail_url) return creative.thumbnail_url;
  if (creative.image_url) return creative.image_url;
  const story = creative.object_story_spec;
  return story?.photo_data?.url || story?.video_data?.image_url || '';
}

function extractMetaAction(row, actionTypes) {
  const actions = row.actions || [];
  for (const actionType of actionTypes) {
    const found = actions.find((item) => item.action_type === actionType);
    if (found) return Number(found.value || 0);
  }
  return 0;
}

function extractMetaActionValue(row, actionTypes) {
  const values = row.action_values || [];
  for (const actionType of actionTypes) {
    const found = values.find((item) => item.action_type === actionType);
    if (found) return Number(found.value || 0);
  }
  return 0;
}

function summarizeMetaRows(rows) {
  const totals = rows.reduce((acc, row) => {
    acc.investimento += row.spend;
    acc.impressoes += row.impressions;
    acc.alcance += row.reach;
    acc.cliques += row.clicks;
    acc.leads += row.leads;
    acc.mensagens += row.mensagens;
    acc.vendas += row.vendas;
    acc.faturamento += row.faturamento;
    acc.resultados += row.resultados;
    return acc;
  }, { investimento: 0, impressoes: 0, alcance: 0, cliques: 0, leads: 0, mensagens: 0, vendas: 0, faturamento: 0, resultados: 0 });
  totals.ctr = totals.impressoes ? (totals.cliques / totals.impressoes) * 100 : 0;
  totals.cpc = totals.cliques ? totals.investimento / totals.cliques : 0;
  totals.cpm = totals.impressoes ? (totals.investimento / totals.impressoes) * 1000 : 0;
  totals.custo_por_lead = totals.leads ? totals.investimento / totals.leads : 0;
  totals.custo_por_mensagem = totals.mensagens ? totals.investimento / totals.mensagens : 0;
  totals.custo_por_venda = totals.vendas ? totals.investimento / totals.vendas : 0;
  totals.custo_por_resultado = totals.resultados ? totals.investimento / totals.resultados : 0;
  return totals;
}

async function saveMetaReport() {
  const report = state.metaAds.report;
  if (!report) return;
  const isVendas = report.goalKey === 'vendas';
  const isLeads = report.goalKey === 'leads';
  const isMensagens = report.goalKey === 'mensagens';
  try {
    const saved = await relatorioService.create({
      cliente_id: report.cliente.id,
      periodo_inicio: report.since,
      periodo_fim: report.until,
      investimento: Number(report.totals.investimento.toFixed(2)),
      impressoes: report.totals.impressoes,
      alcance: report.totals.alcance,
      cliques: report.totals.cliques,
      ctr: Number(report.totals.ctr.toFixed(4)),
      cpc: Number(report.totals.cpc.toFixed(2)),
      leads: isLeads ? report.totals.resultados : report.totals.leads,
      custo_por_lead: Number((isLeads ? report.totals.custo_por_resultado : report.totals.custo_por_lead).toFixed(2)),
      mensagens: isMensagens ? report.totals.resultados : report.totals.mensagens,
      custo_por_mensagem: Number((isMensagens ? report.totals.custo_por_resultado : report.totals.custo_por_mensagem).toFixed(2)),
      vendas: isVendas ? report.totals.resultados : report.totals.vendas,
      faturamento_informado: isVendas ? Number(report.totals.faturamento.toFixed(2)) : 0,
      roas: isVendas && report.totals.investimento ? Number((report.totals.faturamento / report.totals.investimento).toFixed(4)) : 0,
      meta_ads_act_snapshot: report.accountId,
      analise_estrategica: `Relatorio importado da Meta Ads API pelo The Midia Master. Objetivo: ${report.goal.label}.`,
    });
    await loadAll();
    state.lastSavedRelatorioId = saved.id;
    state.metaAds.report = null;
    state.metaAds.tab = 'relatorios';
    navigate('metaAds');
    toast('Relatorio salvo em Relatorios Meta Ads.');
  } catch (error) {
    showError(error);
  }
}

async function saveGbpReport() {
  const report = state.gbp.report;
  if (!report) {
    toast('Gere uma analise antes de salvar.', 'error');
    return;
  }
  try {
    const saved = await gmnAnaliseService.create({
      cliente_id: state.gbp.clienteId || report.clienteId || null,
      nome_perfil: report.details?.name || state.gbp.businessQuery || 'Perfil analisado',
      endereco: report.details?.address || '',
      palavra_chave: report.keyword || state.gbp.keyword,
      score: Number(report.score || report.health?.score || report.metrics?.visibility || 0),
      saude_perfil: Number(report.health?.score || report.score || 0),
      grid_size: Number(report.gridSize || state.gbp.gridSize || 0),
      raio_km: Number(report.radiusKm || state.gbp.radiusKm || 0),
      gerado_em: report.generatedAt || new Date().toISOString(),
      report,
    });
    await loadAll();
    state.gbp.tab = 'salvas';
    state.gbp.selectedSavedId = saved.id;
    toast('Analise GMN salva.');
    render();
  } catch (error) {
    showError(error);
  }
}

async function deleteGbpSavedReport(id) {
  if (!id || !confirm('Excluir esta analise GMN salva?')) return;
  try {
    await gmnAnaliseService.delete(id);
    state.gmnAnalises = state.gmnAnalises.filter((item) => item.id !== id);
    if (state.gbp.selectedSavedId === id) state.gbp.selectedSavedId = null;
    toast('Analise GMN excluida.');
    render();
  } catch (error) {
    showError(error);
  }
}

async function fetchGbpReport() {
  if (!state.gbp.businessQuery.trim()) {
    toast('Informe o perfil, endereco ou link do Google Maps.', 'error');
    return;
  }
  if (!state.gbp.keyword.trim()) {
    toast('Informe a palavra-chave da busca.', 'error');
    return;
  }

  state.gbp.loading = true;
  state.gbp.error = '';
  state.gbp.report = null;
  render();

  try {
    const { data, error } = await supabase.functions.invoke('gbp-analyze', {
      body: {
        clienteId: state.gbp.clienteId || null,
        businessQuery: state.gbp.businessQuery,
        keyword: state.gbp.keyword,
        radiusKm: state.gbp.radiusKm,
        gridSize: state.gbp.gridSize,
        searchCenter: state.gbp.searchCenter,
        searchRadiusMeters: state.gbp.searchRadiusMeters,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    state.gbp.report = data;
  } catch (error) {
    try {
      toast('Edge Function indisponivel. Usando API local...', 'error');
      state.gbp.report = await fetchLocalGbpReport({
        businessQuery: state.gbp.businessQuery,
        keyword: state.gbp.keyword,
        radiusKm: state.gbp.radiusKm,
        gridSize: state.gbp.gridSize,
        searchCenter: state.gbp.searchCenter,
        searchRadiusMeters: state.gbp.searchRadiusMeters,
      });
    } catch (localError) {
      try {
        state.gbp.report = await analyzeGbpInBrowser({
          businessQuery: state.gbp.businessQuery,
          keyword: state.gbp.keyword,
          radiusKm: state.gbp.radiusKm,
          gridSize: state.gbp.gridSize,
          searchCenter: state.gbp.searchCenter,
          searchRadiusMeters: state.gbp.searchRadiusMeters,
        });
      } catch (fallbackError) {
        state.gbp.error = fallbackError.message || localError.message || error.message || 'Erro ao gerar diagnostico GMN.';
      }
    }
  } finally {
    state.gbp.loading = false;
    render();
  }
}

async function fetchLocalGbpReport(payload) {
  const response = await fetch('/api/gbp-analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data.error || 'API local GMN indisponivel.');
  return data;
}

async function analyzeGbpInBrowser(payload) {
  const service = await getGooglePlacesService();
  const rawQuery = String(payload.businessQuery || '').trim();
  const query = extractReadableQuery(rawQuery).trim();
  const keyword = String(payload.keyword || '').trim();
  if (!query) throw new Error('Informe o link, nome ou endereco do perfil.');
  if (!keyword) throw new Error('Informe a palavra-chave.');

  const candidates = await placesFind(service, {
    query,
    fields: ['place_id', 'name', 'formatted_address', 'geometry', 'rating', 'user_ratings_total', 'business_status', 'types', 'photos'],
  });
  const first = candidates?.[0];
  if (!first) throw new Error('Perfil nao encontrado. Tente nome + cidade ou endereco completo.');

  const detailsRaw = await placesDetails(service, {
    placeId: first.place_id,
    fields: ['place_id', 'name', 'formatted_address', 'geometry', 'rating', 'user_ratings_total', 'formatted_phone_number', 'international_phone_number', 'website', 'url', 'opening_hours', 'business_status', 'types', 'price_level', 'photos', 'reviews'],
  });
  const businessLocation = locationOf(detailsRaw.geometry.location);
  const requestedCenter = extractMapCenter(payload.searchCenter || '');
  const center = requestedCenter ? { lat: requestedCenter.lat, lng: requestedCenter.lng } : businessLocation;
  const centerSource = requestedCenter ? requestedCenter.source : 'business';
  const radiusKm = Math.max(0.5, Math.min(20, Number(payload.radiusKm) || 3));
  const gridSize = Math.max(3, Math.min(9, Number(payload.gridSize) || 5));
  const requestedSearchRadius = Number(payload.searchRadiusMeters);
  const searchBiasMeters = Number.isFinite(requestedSearchRadius) && requestedSearchRadius > 0
    ? Math.round(Math.min(50000, Math.max(100, requestedSearchRadius)))
    : Math.round(Math.min(50000, Math.max(300, radiusKm * 1000)));
  const points = gridPoints(center, radiusKm, gridSize);

  const localResults = await mapWithConcurrency(points, 4, async (point) => {
    const searchResults = await placesTextSearch(service, {
      query: keyword,
      location: new google.maps.LatLng(point.lat, point.lng),
      radius: searchBiasMeters,
    });
    const results = (searchResults || []).slice(0, 20).map(normalizePlace);
    const positionIndex = results.findIndex((place) => place.placeId === detailsRaw.place_id);
    return { point, position: positionIndex >= 0 ? positionIndex + 1 : null, found: positionIndex >= 0, results };
  });

  const details = {
    placeId: detailsRaw.place_id,
    name: detailsRaw.name,
    address: detailsRaw.formatted_address,
    rating: detailsRaw.rating || null,
    userRatingsTotal: detailsRaw.user_ratings_total || 0,
    phone: detailsRaw.formatted_phone_number || detailsRaw.international_phone_number || '',
    website: detailsRaw.website || '',
    googleUrl: detailsRaw.url || '',
    location: businessLocation,
    businessStatus: detailsRaw.business_status || '',
    types: detailsRaw.types || [],
    priceLevel: detailsRaw.price_level ?? null,
    photos: detailsRaw.photos?.length || 0,
    weekdayText: detailsRaw.opening_hours?.weekday_text || [],
    reviews: detailsRaw.reviews || [],
    unansweredReviews: (detailsRaw.reviews || []).filter((review) => !review.author_reply).length,
    totalReviewsFromApi: (detailsRaw.reviews || []).length,
  };
  const metrics = summarizeOwnRanking(localResults);
  const competitors = summarizeCompetitors(localResults, center).filter((item) => item.placeId !== details.placeId);
  const health = scoreGbpProfile(details, localResults, metrics);
  const half = Math.max(1, Math.floor(gridSize / 2));

  return {
    generatedAt: new Date().toISOString(),
    query,
    keyword,
    radiusKm,
    searchBiasMeters,
    gridStepKm: Number((radiusKm / half).toFixed(3)),
    gridSize,
    searchAreaKm2: Number((radiusKm * 2 * (radiusKm * 2)).toFixed(2)),
    center,
    centerSource,
    distanceBusinessToCenterKm: Number(haversineKm(businessLocation, center).toFixed(3)),
    warning: radiusKm > 3 ? `Raio de ${radiusKm} km gera uma area muito ampla para ranking local. Para comparar com relatorios de bairro, use 0,5 km ou 1 km.` : '',
    details,
    metrics,
    localResults,
    rankingMatrix: buildRankingMatrix(localResults),
    competitors,
    recommendations: buildGbpRecommendations(details, metrics, competitors),
    health,
  };
}

async function getGooglePlacesService() {
  if (window.google?.maps?.places) return new google.maps.places.PlacesService(getGooglePlacesHost());
  googlePlacesLoader ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${fixedGoogleMapsApiKey}&libraries=places&language=pt-BR`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Nao foi possivel carregar a Google Maps JavaScript API.'));
    document.head.appendChild(script);
  });
  await googlePlacesLoader;
  if (!window.google?.maps?.places) throw new Error('Google Places nao carregou.');
  return new google.maps.places.PlacesService(getGooglePlacesHost());
}

function getGooglePlacesHost() {
  let host = document.getElementById('googlePlacesHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'googlePlacesHost';
    host.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:320px;height:240px;';
    document.body.appendChild(host);
  }
  if (!googlePlacesMap) {
    googlePlacesMap = new google.maps.Map(host, {
      center: { lat: -22.9, lng: -47.1 },
      zoom: 13,
      disableDefaultUI: true,
    });
  }
  return googlePlacesMap;
}

function placesFind(service, request) {
  return withTimeout(new Promise((resolve, reject) => {
    service.findPlaceFromQuery(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK || status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) resolve(results || []);
      else reject(new Error(`Google Places: ${status}`));
    });
  }), 20000, 'Tempo esgotado ao localizar o perfil.');
}

function placesDetails(service, request) {
  return withTimeout(new Promise((resolve, reject) => {
    service.getDetails(request, (result, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK) resolve(result);
      else reject(new Error(`Google Details: ${status}`));
    });
  }), 20000, 'Tempo esgotado ao buscar dados do perfil.');
}

function placesTextSearch(service, request) {
  return withTimeout(new Promise((resolve, reject) => {
    service.textSearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK || status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) resolve(results || []);
      else reject(new Error(`Google Text Search: ${status}`));
    });
  }), 25000, 'Tempo esgotado em um ponto do grid.');
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function extractReadableQuery(input) {
  if (!input) return '';
  try {
    const url = new URL(input);
    const query = url.searchParams.get('q') || url.searchParams.get('query');
    if (query) return query;
    const placeIndex = url.pathname.indexOf('/place/');
    if (placeIndex >= 0) {
      const raw = url.pathname.slice(placeIndex + 7).split('/')[0];
      return decodeURIComponent(raw.replaceAll('+', ' '));
    }
  } catch {
    return input;
  }
  return input;
}

function extractMapCenter(input) {
  if (!input) return null;
  const text = String(input);
  const atMatch = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|z|$)/);
  if (atMatch) return { lat: Number(atMatch[1]), lng: Number(atMatch[2]), source: 'url' };
  const pairMatch = text.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  return pairMatch ? { lat: Number(pairMatch[1]), lng: Number(pairMatch[2]), source: 'manual' } : null;
}

function locationOf(location) {
  return {
    lat: typeof location.lat === 'function' ? location.lat() : location.lat,
    lng: typeof location.lng === 'function' ? location.lng() : location.lng,
  };
}

function gridPoints(center, radiusKm, gridSize) {
  const points = [];
  const steps = Math.max(3, Math.min(9, Number(gridSize) || 5));
  const half = Math.floor(steps / 2);
  const latKm = 110.574;
  const lngKm = 111.32 * Math.cos((center.lat * Math.PI) / 180);
  for (let y = -half; y <= half; y += 1) {
    for (let x = -half; x <= half; x += 1) {
      points.push({ lat: center.lat + (y * radiusKm) / half / latKm, lng: center.lng + (x * radiusKm) / half / lngKm, x, y });
    }
  }
  return points;
}

function normalizePlace(place) {
  return {
    placeId: place.place_id,
    name: place.name,
    address: place.formatted_address || place.vicinity || '',
    rating: place.rating || null,
    userRatingsTotal: place.user_ratings_total || 0,
    businessStatus: place.business_status || '',
    location: place.geometry?.location ? locationOf(place.geometry.location) : null,
    types: place.types || [],
    priceLevel: place.price_level ?? null,
    openNow: place.opening_hours?.open_now ?? null,
    photos: place.photos?.length || 0,
  };
}

function summarizeOwnRanking(localResults) {
  const totalPoints = localResults.length;
  const missingPosition = 21;
  const positions = localResults.filter((item) => item.position).map((item) => item.position);
  const totalPosition = positions.reduce((sum, position) => sum + position, 0);
  const top3 = positions.filter((position) => position <= 3).length;
  const top10 = positions.filter((position) => position <= 10).length;
  return {
    visibility: Math.round((positions.length / totalPoints) * 100),
    averagePosition: positions.length ? Number((totalPosition / positions.length).toFixed(2)) : null,
    arp: positions.length ? Number((totalPosition / positions.length).toFixed(2)) : null,
    atrp: Number(((totalPosition + (totalPoints - positions.length) * missingPosition) / totalPoints).toFixed(2)),
    solv: Number(((top3 / totalPoints) * 100).toFixed(2)),
    top3,
    top10,
    foundPoints: positions.length,
    totalPoints,
    bestPosition: positions.length ? Math.min(...positions) : null,
    worstPosition: positions.length ? Math.max(...positions) : null,
  };
}

function summarizeCompetitors(results, center) {
  const byId = new Map();
  const totalPoints = results.length;
  const missingPosition = 21;
  for (const search of results) {
    search.results.forEach((place, index) => {
      if (!byId.has(place.placeId)) {
        byId.set(place.placeId, { ...place, appearances: 0, bestPosition: index + 1, totalPosition: 0, top3: 0, distanceKm: place.location ? haversineKm(center, place.location) : null });
      }
      const current = byId.get(place.placeId);
      current.appearances += 1;
      current.bestPosition = Math.min(current.bestPosition, index + 1);
      current.totalPosition += index + 1;
      if (index + 1 <= 3) current.top3 += 1;
    });
  }
  return [...byId.values()].map((item) => ({
    ...item,
    foundLabel: `${item.appearances} / ${totalPoints}`,
    visibility: Number(((item.appearances / totalPoints) * 100).toFixed(2)),
    arp: Number((item.totalPosition / item.appearances).toFixed(2)),
    atrp: Number(((item.totalPosition + (totalPoints - item.appearances) * missingPosition) / totalPoints).toFixed(2)),
    solv: Number(((item.top3 / totalPoints) * 100).toFixed(2)),
    averagePosition: Number((item.totalPosition / item.appearances).toFixed(1)),
  })).sort((a, b) => b.visibility - a.visibility || a.atrp - b.atrp).slice(0, 60);
}

function buildRankingMatrix(localResults) {
  return [...localResults].sort((a, b) => a.point.y - b.point.y || a.point.x - b.point.x).map((item) => ({
    x: item.point.x,
    y: item.point.y,
    lat: Number(item.point.lat.toFixed(6)),
    lng: Number(item.point.lng.toFixed(6)),
    position: item.position,
    label: item.position ? String(item.position) : '20+',
    found: item.found,
    topResult: item.results[0]?.name || '',
  }));
}

function scoreGbpProfile(details, localResults, metrics) {
  const checks = [
    { label: 'Nome e endereco encontrados', ok: Boolean(details.name && details.address), weight: 12, observation: details.name && details.address ? 'O perfil tem identificacao e endereco principal preenchidos.' : 'Nome ou endereco nao foram encontrados na consulta.', recommendation: details.name && details.address ? 'Mantenha nome, endereco e bairro iguais em site, redes sociais e diretorios.' : 'Corrija o nome/endereco no Perfil da Empresa e padronize esses dados em todos os canais.' },
    { label: 'Nota acima de 4,3', ok: Number(details.rating || 0) >= 4.3, weight: 14, observation: details.rating ? `Nota atual: ${details.rating}.` : 'Nao encontrei nota publica no perfil.', recommendation: Number(details.rating || 0) >= 4.3 ? 'Continue pedindo avaliacoes recentes e responda todas.' : 'Crie uma rotina de pedido de avaliacoes apos atendimento.' },
    { label: 'Volume de avaliacoes competitivo', ok: Number(details.userRatingsTotal || 0) >= 30, weight: 14, observation: `Total encontrado: ${details.userRatingsTotal || 0} avaliacoes.`, recommendation: Number(details.userRatingsTotal || 0) >= 30 ? 'Compare o volume com os concorrentes que mais aparecem.' : 'Defina uma meta mensal de novas avaliacoes.' },
    { label: 'Avaliacoes respondidas', ok: details.totalReviewsFromApi === 0 || details.unansweredReviews === 0, weight: 10, observation: details.totalReviewsFromApi > 0 ? `${details.unansweredReviews} de ${details.totalReviewsFromApi} avaliacoes recentes sem resposta.` : 'Nenhuma avaliacao encontrada para verificar.', recommendation: 'Responda todas as avaliacoes, especialmente as negativas.' },
    { label: 'Telefone cadastrado', ok: Boolean(details.phone), weight: 10, observation: details.phone ? `Telefone encontrado: ${details.phone}.` : 'Nenhum telefone foi retornado pela API.', recommendation: details.phone ? 'Teste se o numero atende rapido.' : 'Adicione telefone ou WhatsApp comercial no perfil.' },
    { label: 'Site cadastrado', ok: Boolean(details.website), weight: 10, observation: details.website ? `Site encontrado: ${details.website}.` : 'O perfil nao retornou site cadastrado.', recommendation: details.website ? 'Garanta que a pagina tenha dados locais.' : 'Cadastre site ou pagina de destino.' },
    { label: 'Horarios cadastrados', ok: Boolean(details.weekdayText?.length), weight: 10, observation: details.weekdayText?.length ? 'Horarios de funcionamento encontrados.' : 'Horarios nao foram encontrados.', recommendation: 'Revise horarios normais e especiais.' },
    { label: 'Fotos no perfil', ok: details.photos > 0, weight: 10, observation: `Fotos retornadas pela consulta: ${details.photos}.`, recommendation: 'Publique fotos novas com frequencia.' },
    { label: 'Boa visibilidade no grid local', ok: metrics.visibility >= 60, weight: 20, observation: `Apareceu em ${localResults.filter((item) => item.position).length} de ${localResults.length} pontos analisados.`, recommendation: 'Trabalhe os pontos amarelos e vermelhos para ganhar top 3.' },
    { label: 'Presenca no top 3', ok: metrics.solv >= 15, weight: 14, observation: `Ficou no top 3 em ${metrics.top3} de ${metrics.totalPoints} pontos (${metrics.solv}%).`, recommendation: 'Priorize avaliacoes recentes, categorias corretas e paginas locais.' },
    { label: 'Posicao media competitiva', ok: Boolean(metrics.averagePosition && metrics.averagePosition <= 10), weight: 14, observation: metrics.averagePosition ? `Posicao media quando encontrado: ${metrics.averagePosition}.` : 'O perfil nao foi encontrado no top 20.', recommendation: 'Estude concorrentes dominantes e aumente relevancia local.' },
  ];
  const total = checks.reduce((sum, item) => sum + item.weight, 0);
  const earned = checks.reduce((sum, item) => sum + (item.ok ? item.weight : 0), 0);
  return { score: Math.round((earned / total) * 100), checks };
}

function buildGbpRecommendations(details, metrics, competitors) {
  const recs = [];
  const betterCompetitors = competitors.filter((item) => item.atrp < metrics.atrp).slice(0, 5);
  if (metrics.visibility < 60) recs.push({ priority: 'Alta', title: 'Aumentar cobertura na regiao analisada', body: `O perfil apareceu em ${metrics.foundPoints} de ${metrics.totalPoints} pontos.` });
  if (metrics.solv < 20) recs.push({ priority: 'Alta', title: 'Ganhar mais posicoes no top 3', body: `Apenas ${metrics.solv}% da grade ficou no top 3.` });
  if (!details.website) recs.push({ priority: 'Media', title: 'Adicionar site ao perfil', body: 'Site completo ajuda categoria, servicos e localizacao.' });
  if (!details.phone) recs.push({ priority: 'Media', title: 'Adicionar telefone', body: 'Telefone ausente reduz conversao.' });
  if (betterCompetitors.length) recs.push({ priority: 'Alta', title: 'Estudar concorrentes dominantes', body: `Concorrentes como ${betterCompetitors.map((item) => item.name).join(', ')} aparecem melhor na grade.` });
  return recs.length ? recs.slice(0, 6) : [{ priority: 'Baixa', title: 'Manter consistencia e frequencia', body: 'Mantenha fotos, posts, respostas e categorias atualizadas.' }];
}

function haversineKm(a, b) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function showError(error) {
  console.error(error);
  toast(error.message || 'Erro inesperado.', 'error');
}
