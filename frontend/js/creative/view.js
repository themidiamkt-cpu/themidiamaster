// Tela "Creative Intelligence" do Master. LE o Supabase (tabelas ci_*, com RLS) e organiza a consulta.
// Nao executa pesquisa: ela comeca no Claude Code (skill ci-pesquisar), que grava no Supabase e no Obsidian.
// "Nova pesquisa" so PREPARA o pedido (prompt e JSON) para o usuario colar no Claude Code.
import { creativeIntelligenceService } from '../services/creativeIntelligenceService.js';
import { loadingState, pageHeader, renderLucide, toast } from '../components/ui.js';
import {
  ciClientPanel, ciConceptCard, ciConceptsForm, ciConceptDetail, ciConceptsEmpty, ciNichePanel, ciPesquisaDetail, ciPesquisasPanel,
  ciReferenceDetail, ciReferenceFilters, ciReferenceList, ciRequestPreview, ciResearchForm, ciScriptCard, ciScriptDetail,
  ciGlobalFilters, ciScriptSelectionBar, ciScriptsEmpty, ciStatCards, ciTabs, filterConcepts, filterPesquisas, filterReferences,
} from './components.js';
import { creativeRequestHtml } from './brief.js';
import { scriptToPlainText, scriptsToWordHtml, wordFileName } from './format.js';
import { normalizeCreativeData } from './model.js';
import { buildConceptRequest, buildResearchRequest } from './request.js';

const TABS = [['visao', 'Visão Geral'], ['pesquisas', 'Pesquisas'], ['referencias', 'Referências'], ['conceitos', 'Conceitos'], ['roteiros', 'Roteiros']];
const emptyFilters = (cliente = 'all') => ({ q: '', cliente, nicho: 'all', angulo: 'all', formato: 'all', anunciante: 'all', status: 'all' });

const ci = {
  status: 'idle', // idle | loading | ready | error
  error: '',
  rows: null,
  tab: 'visao',
  client: 'all',
  niche: '',
  filters: emptyFilters(),
  pending: null, // pedido exibido no modal
  selected: new Set(), // roteiros marcados para exportar
};
let rerender = () => {};
let getClientes = () => [];
let listenersBound = false;
let cache = { rows: null, clientes: null, model: null };

async function load() {
  ci.status = 'loading';
  try {
    ci.rows = await creativeIntelligenceService.loadAll();
    ci.status = 'ready';
    ci.error = '';
    cache = { rows: null, clientes: null, model: null };
    if (!ci.niche) ci.niche = defaultNiche();
  } catch (error) {
    ci.rows = null;
    ci.status = 'error';
    ci.error = error?.message || 'Não foi possível ler o Creative Intelligence no Supabase.';
  }
  rerender();
}

function model() {
  const clientes = getClientes();
  if (!ci.rows) return null;
  if (cache.rows !== ci.rows || cache.clientes !== clientes) cache = { rows: ci.rows, clientes, model: normalizeCreativeData(ci.rows, clientes) };
  return cache.model;
}

const clientById = (id) => model()?.clients.find((c) => c.id === id) || null;
const conceptById = (id) => model()?.concepts.find((c) => c.id === id) || null;

function defaultNiche() {
  const data = model();
  if (!data) return '';
  const fromClient = clientById(ci.client)?.nicho;
  if (fromClient && data.niches.some((n) => n.nome === fromClient)) return fromClient;
  return (data.niches.find((n) => n.referencias > 0) || data.niches[0] || {}).nome || '';
}

// ---------- render ----------
function renderOverview(data) {
  return `${ciClientPanel({ clients: data.clients, niches: data.niches, selectedId: ci.client, totals: data.counts })}
    ${ciNichePanel({ niches: data.niches, selectedName: ci.niche })}`;
}

function renderReferences(data) {
  const filtered = filterReferences(data.references, ci.filters, data.clients);
  return `${ciReferenceFilters({ references: data.references, clients: data.clients, niches: data.niches, filters: ci.filters })}
    <p class="muted ci-count" data-ci-count>${filtered.length} de ${data.references.length} referência(s)</p>
    <div data-ci-results>${ciReferenceList(filtered)}</div>`;
}

const noMatch = (what) => `<section class="panel"><div class="state"><i data-lucide="filter-x"></i><strong>Nenhum ${what} com esses filtros.</strong>
  <button class="secondary-button" data-ci-action="clear-filters" type="button"><i data-lucide="x"></i>Limpar filtros</button></div></section>`;

function renderPesquisas(data) {
  const filtered = filterPesquisas(data.pesquisas, ci.filters);
  return filtered.length || !data.pesquisas.length ? ciPesquisasPanel(filtered) : noMatch('pesquisa');
}

function renderConcepts(data) {
  if (!data.concepts.length) return ciConceptsEmpty();
  const concepts = filterConcepts(data.concepts, ci.filters);
  return `<div class="ci-toolbar"><button class="button" data-ci-action="create-concepts" type="button"><i data-lucide="plus"></i>Criar conceitos</button></div>
    ${concepts.length ? `<div class="ci-grid">${concepts.map(ciConceptCard).join('')}</div>` : noMatch('conceito')}`;
}

function renderScripts(data) {
  const all = data.concepts.filter((c) => c.hasRoteiro);
  if (!all.length) return ciScriptsEmpty();
  const scripts = filterConcepts(all, ci.filters);
  if (!scripts.length) return noMatch('roteiro');
  const visible = new Set(scripts.map((c) => c.id));
  for (const id of [...ci.selected]) if (!visible.has(id)) ci.selected.delete(id);
  return `${ciScriptSelectionBar(scripts.length, ci.selected.size)}
    <div class="ci-grid">${scripts.map((c) => ciScriptCard(c, ci.selected.has(c.id))).join('')}</div>`;
}

// contagens dos cartoes do topo seguem o filtro global
function scopedCounts(data) {
  const f = ci.filters;
  const concepts = filterConcepts(data.concepts, f);
  return {
    referencias: filterReferences(data.references, { ...emptyFilters(), cliente: f.cliente, nicho: f.nicho }, data.clients).length,
    nichos: data.niches.filter((n) => f.nicho === 'all' || n.nome === f.nicho).length,
    conceitos: concepts.length,
    roteiros: concepts.filter((c) => c.hasRoteiro).length,
  };
}

function renderError() {
  return `<section class="panel ci-offline"><div class="state"><i data-lucide="plug-zap"></i><strong>Não foi possível ler o Creative Intelligence</strong>
    <span>${ci.error ? ci.error.replace(/[<>&]/g, '') : 'Verifique a conexão e as permissões do Supabase.'}</span>
    <button class="button" data-ci-action="refresh" type="button"><i data-lucide="refresh-cw"></i>Tentar novamente</button></div></section>`;
}

export function renderCreativeIntelligence() {
  const ready = ci.status === 'ready';
  const header = pageHeader(
    'Creative Intelligence',
    'Pesquisa de mercado, referências e criação de anúncios.',
    `${ready ? ciGlobalFilters({ clients: model().clients, niches: model().niches, filters: ci.filters }) : ''}<button class="button" data-ci-action="new-research" type="button"><i data-lucide="plus"></i>Nova pesquisa</button>`,
  );
  if (ci.status === 'idle' || ci.status === 'loading') return `${header}${loadingState('Carregando o Creative Intelligence...')}`;
  if (ci.status === 'error') return `${header}${ciStatCards(null)}${renderError()}`;

  const data = model();
  const bodies = {
    visao: renderOverview,
    pesquisas: renderPesquisas,
    referencias: renderReferences,
    conceitos: renderConcepts,
    roteiros: renderScripts,
  };
  return `${header}${ciStatCards(scopedCounts(data))}${ciTabs(ci.tab, TABS)}<div class="ci-body">${(bodies[ci.tab] || bodies.visao)(data)}</div>`;
}

// ---------- modal (usa o modal global do Master) ----------
function openModal(eyebrow, title, html) {
  document.getElementById('modalEyebrow').textContent = eyebrow;
  document.getElementById('modalTitle').textContent = title;
  const form = document.getElementById('modalForm');
  form.innerHTML = html;
  form.onsubmit = (event) => event.preventDefault();
  document.getElementById('modalBackdrop').hidden = false;
  renderLucide();
}
const closeModal = () => document.getElementById('modalClose')?.click();

function printAsPdf(html) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();
  const run = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60000);
  };
  setTimeout(run, 300);
}

function exportScripts(format, id) {
  const data = model();
  if (!data) return;
  const all = data.concepts.filter((c) => c.hasRoteiro);
  const list = id ? all.filter((c) => c.id === id) : all.filter((c) => ci.selected.has(c.id));
  if (!list.length) {
    toast('Selecione ao menos um roteiro.', 'error');
    return;
  }
  const sameClient = list.every((c) => c.clienteNome === list[0].clienteNome) && list[0].clienteNome;
  const title = list.length === 1 ? list[0].nome : `Roteiros${sameClient ? ` - ${list[0].clienteNome}` : ''}`;
  if (format === 'pdf') {
    openPdfModal(list, title);
    return;
  }
  downloadDoc(list);
}

// Dados da solicitacao que o sistema nao tem: o que ficar em branco vira pendencia no PDF (nada e inventado).
const META_FIELDS = [
  ['campanha', 'Campanha / período'], ['prazo', 'Prazo de entrega'], ['responsavelCriacao', 'Responsável pela criação'],
  ['destino', 'Destino (ex.: Meta Ads + Instagram)'], ['responsavelEstrategia', 'Responsável pela estratégia'],
  ['aprovInterna', 'Aprovação interna'], ['aprovCliente', 'Aprovação do cliente'],
];
const META_KEY = 'ci-brief-meta';
const readMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; } };
const saveMeta = (meta) => { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* sem armazenamento */ } };

function openPdfModal(list, title) {
  ci.pendingPdf = { ids: list.map((c) => c.id), title };
  const saved = readMeta();
  const field = ([key, label]) => `<label class="ci-field-in"><span>${label}</span><input class="input" name="${key}" value="${(saved[key] || '').replace(/"/g, '&quot;')}" autocomplete="off"></label>`;
  openModal('Solicitação de criativo', 'Dados da solicitação', `
    <p class="muted">${list.length} roteiro(s) selecionado(s). Preencha o que souber: campos em branco aparecem como <strong>pendência</strong> no PDF. O sistema não inventa prazo, responsável nem status.</p>
    <div class="ci-form-grid">${META_FIELDS.map(field).join('')}
      <label class="ci-field-in"><span>Prioridade</span><select class="input" name="prioridade"><option value="">Não informada</option>${['Alta', 'Média', 'Baixa'].map((o) => `<option ${saved.prioridade === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label></div>
    <label class="ci-check"><input type="checkbox" name="incluirCaptacao" checked> Incluir plano de captação (consolida o que gravar em todas as peças)</label>
    <div class="ci-modal-actions"><button class="ghost-button" data-ci-action="close-modal" type="button">Cancelar</button>
      <button class="button" data-ci-action="confirm-pdf" type="button"><i data-lucide="file-down"></i>Gerar PDF</button></div>
    <p class="muted">O navegador abre a janela de impressão: escolha "Salvar como PDF".</p>`);
}

function confirmPdf() {
  const form = document.getElementById('modalForm');
  const get = (name) => form.querySelector(`[name="${name}"]`)?.value?.trim() || '';
  const meta = Object.fromEntries([...META_FIELDS.map(([k]) => k), 'prioridade'].map((k) => [k, get(k)]));
  meta.incluirCaptacao = Boolean(form.querySelector('[name="incluirCaptacao"]')?.checked);
  saveMeta(meta);
  const data = model();
  const ids = new Set(ci.pendingPdf?.ids || []);
  const list = (data?.concepts || []).filter((c) => ids.has(c.id));
  if (!list.length) return;
  closeModal();
  printAsPdf(creativeRequestHtml(list, `Solicitação de criativo - ${ci.pendingPdf.title}`, meta));
  toast('Na janela de impressão, escolha "Salvar como PDF".');
}

function downloadDoc(concepts) {
  const title = concepts.length === 1 ? concepts[0].nome : `Roteiros${concepts[0]?.clienteNome && concepts.every((c) => c.clienteNome === concepts[0].clienteNome) ? ` - ${concepts[0].clienteNome}` : ''}`;
  const blob = new Blob(['\ufeff', scriptsToWordHtml(concepts, title)], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = wordFileName(concepts);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Documento exportado.');
}

async function copy(text, okMessage) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  toast(okMessage);
}

function openResearchModal() {
  const data = model();
  const client = clientById(ci.client === 'all' ? '' : ci.client);
  openModal('Creative Intelligence', 'Nova pesquisa', `
    <div class="ci-callout ci-callout-top"><i data-lucide="info"></i><span><strong>A pesquisa é executada pelo Claude, não por este botão.</strong> Preencha abaixo para gerar o pedido e cole no Claude Code, usando a skill ci-pesquisar.</span></div>
    ${ciResearchForm({ clients: data?.clients || [], niches: data?.niches || [], client, nicheName: client?.nicho || '', objective: '' })}`);
}

function showPreview(built) {
  ci.pending = built;
  openModal('Creative Intelligence', 'Pedido preparado', ciRequestPreview(built));
}

function prepareResearch() {
  const form = document.getElementById('modalForm');
  const value = (name) => form.querySelector(`[name="${name}"]`)?.value || '';
  const built = buildResearchRequest({
    client: clientById(value('cliente')), niche: value('nicho'), objective: value('objetivo'), source: value('fonte'),
  });
  if (!built.ok) {
    const box = form.querySelector('[data-ci-errors]');
    box.hidden = false;
    box.textContent = built.errors.join(' ');
    return;
  }
  showPreview(built);
}

function prepareConceptAction(kind, conceptId) {
  const concept = conceptId ? conceptById(conceptId) : null;
  const client = clientById(concept?.cliente || (ci.client === 'all' ? '' : ci.client));
  if (kind === 'criar-conceitos' && !client) {
    // sem cliente selecionado: pergunta em vez de dar erro
    openModal('Creative Intelligence', 'Criar conceitos', ciConceptsForm({ clients: model()?.clients || [], client: null }));
    return;
  }
  const built = buildConceptRequest({ action: kind, client, niche: concept?.nicho || client?.nicho || '', concept });
  if (!built.ok) {
    toast(built.errors.join(' '), 'error');
    return;
  }
  showPreview(built);
}

// ---------- eventos ----------
function refreshReferenceResults() {
  const data = model();
  const filtered = filterReferences(data.references, ci.filters, data.clients);
  const results = document.querySelector('[data-ci-results]');
  if (!results) return;
  results.innerHTML = ciReferenceList(filtered);
  const count = document.querySelector('[data-ci-count]');
  if (count) count.textContent = `${filtered.length} de ${data.references.length} referência(s)`;
  renderLucide();
}

function handleAction(el) {
  const action = el.dataset.ciAction;
  const data = ci.status === 'ready' ? model() : null;
  switch (action) {
    case 'tab': ci.tab = el.dataset.tab; rerender(); break;
    case 'refresh': ci.status = 'loading'; rerender(); load(); break;
    case 'new-research': openResearchModal(); break;
    case 'open-reference': {
      const ref = data?.references.find((r) => r.id === el.dataset.id);
      if (ref) openModal(ref.nicho || 'Referência', ref.anunciante, ciReferenceDetail(ref));
      break;
    }
    case 'open-pesquisa': {
      const p = data?.pesquisas.find((x) => x.id === el.dataset.id);
      if (p) openModal('Pesquisa', p.titulo, ciPesquisaDetail(p));
      break;
    }
    case 'open-concept': {
      const c = conceptById(el.dataset.id);
      if (c) openModal('Conceito', c.nome, ciConceptDetail(c));
      break;
    }
    case 'open-script': {
      const c = conceptById(el.dataset.id);
      if (c) openModal('Roteiro', c.nome, ciScriptDetail(c));
      break;
    }
    case 'copy-script': {
      const c = conceptById(el.dataset.id);
      if (c) copy(scriptToPlainText(c), 'Roteiro copiado.');
      break;
    }
    case 'export-doc': exportScripts('doc', el.dataset.id); break;
    case 'export-pdf': exportScripts('pdf', el.dataset.id); break;
    case 'confirm-pdf': confirmPdf(); break;
    case 'concept-action': prepareConceptAction(el.dataset.kind, el.dataset.id); break;
    case 'create-concepts': prepareConceptAction('criar-conceitos', null); break;
    case 'prepare-research': prepareResearch(); break;
    case 'prepare-concepts': {
      const form = document.getElementById('modalForm');
      const client = clientById(form.querySelector('[name="cliente"]')?.value);
      const quantity = Number(form.querySelector('[name="quantidade"]')?.value) || 10;
      const built = buildConceptRequest({ action: 'criar-conceitos', client, niche: client?.nicho || '', quantity });
      if (!built.ok) {
        const box = form.querySelector('[data-ci-errors]');
        box.hidden = false;
        box.textContent = built.errors.join(' ');
      } else showPreview(built);
      break;
    }
    case 'copy-prompt': if (ci.pending) copy(ci.pending.prompt, 'Pedido copiado.'); break;
    case 'copy-json': if (ci.pending) copy(JSON.stringify(ci.pending.request, null, 2), 'JSON copiado.'); break;
    case 'clear-filters': ci.selected = new Set(); ci.client = 'all'; ci.filters = emptyFilters(); ci.niche = defaultNiche(); rerender(); break;
    case 'close-modal': closeModal(); break;
    default: break;
  }
}

function bindListeners() {
  if (listenersBound) return;
  listenersBound = true;
  const app = document.getElementById('app');
  const modalForm = document.getElementById('modalForm');
  const onClick = (event) => {
    const el = event.target.closest('[data-ci-action]');
    if (el && !el.disabled) handleAction(el);
  };
  app.addEventListener('click', onClick);
  modalForm.addEventListener('click', onClick);

  app.addEventListener('change', (event) => {
    const pick = event.target.closest('[data-ci-pick]');
    const pickAll = event.target.closest('[data-ci-pick-all]');
    if (pick || pickAll) {
      const boxes = [...app.querySelectorAll('[data-ci-pick]')];
      if (pickAll) boxes.forEach((b) => { b.checked = pickAll.checked; });
      ci.selected = new Set(boxes.filter((b) => b.checked).map((b) => b.dataset.id));
      const all = app.querySelector('[data-ci-pick-all]');
      if (all) all.checked = boxes.length > 0 && ci.selected.size === boxes.length;
      const count = app.querySelector('[data-ci-sel-count]');
      if (count) count.textContent = `${ci.selected.size} selecionado(s)`;
      app.querySelectorAll('[data-ci-needs-sel]').forEach((b) => { b.disabled = ci.selected.size === 0; });
      return;
    }
    const select = event.target.closest('[data-ci-select]');
    const filter = event.target.closest('[data-ci-filter]');
    if (select?.dataset.ciSelect === 'client') {
      ci.client = select.value;
      ci.filters.cliente = select.value;
      ci.niche = defaultNiche();
      rerender();
    } else if (select?.dataset.ciSelect === 'niche') {
      ci.niche = select.value;
      rerender();
    } else if (filter && filter.dataset.ciFilter !== 'q') {
      ci.filters[filter.dataset.ciFilter] = filter.value;
      if (filter.dataset.ciFilter === 'cliente') { ci.client = filter.value; ci.niche = defaultNiche(); }
      if (filter.dataset.ciFilter === 'nicho' && filter.value !== 'all') ci.niche = filter.value;
      rerender();
    }
  });
  app.addEventListener('input', (event) => {
    const filter = event.target.closest('[data-ci-filter="q"]');
    if (!filter || ci.status !== 'ready') return;
    ci.filters.q = filter.value;
    refreshReferenceResults();
  });
  modalForm.addEventListener('change', (event) => {
    if (!event.target.matches('[data-ci-modal-client]')) return;
    const client = clientById(event.target.value);
    const nicho = modalForm.querySelector('[name="nicho"]');
    if (nicho && client?.nicho) nicho.value = client.nicho;
  });
}

// Chamado pelo app.js depois de cada render() da tela.
export function bindCreativeIntelligence({ rerender: rerenderApp, getClientes: clientesGetter }) {
  rerender = rerenderApp;
  getClientes = clientesGetter;
  bindListeners();
  if (ci.status === 'idle') load();
}
