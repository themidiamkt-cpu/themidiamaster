// Componentes visuais do Creative Intelligence. Funcoes puras: recebem dados, devolvem HTML.
// Reutilizaveis na futura aba "Creative" da ficha do cliente (basta passar o recorte do cliente).
import { emptyState, escapeHtml, statCard } from '../components/ui.js';
import { SOURCES } from './request.js';
import {
  dateBr, distinct, formatCategory, mdBlocks, mdInline, motivoLabel, POSICIONAMENTO_LABELS, scriptSections, shorten, STATUS_LABELS,
} from './format.js';

const esc = escapeHtml;
const chip = (text, cls = '') => `<span class="status-badge ci-chip ${cls}">${esc(text)}</span>`;
const section = (title, body, cls = '') => (body ? `<section class="ci-detail-section ${cls}"><h3>${esc(title)}</h3>${body}</section>` : '');
const field = (label, value) => (value ? `<div class="ci-field"><span>${esc(label)}</span><p>${mdInline(value)}</p></div>` : '');

// ---------- cabecalho e indicadores ----------
export function ciStatCards(counts) {
  const v = (n) => (n == null ? '—' : String(n));
  return `<div class="stats-grid ci-stats">
    ${statCard('Referências', v(counts?.referencias), 'bookmark', 'blue')}
    ${statCard('Nichos', v(counts?.nichos), 'target', 'green')}
    ${statCard('Conceitos', v(counts?.conceitos), 'lightbulb', 'yellow')}
    ${statCard('Roteiros', v(counts?.roteiros), 'clapperboard', 'gold')}
  </div>`;
}

export function ciTabs(active, tabs) {
  return `<div class="section-tabs">${tabs.map(([id, label]) => `<button class="tab-button ${active === id ? 'active' : ''}" data-ci-action="tab" data-tab="${id}">${esc(label)}</button>`).join('')}</div>`;
}

export function ciOffline(reason) {
  const messages = {
    production: ['Creative Intelligence local não conectado', 'Esta área lê o Obsidian pelo ambiente de desenvolvimento do Master e não está disponível na versão publicada. Rode o Master localmente (npm run dev) para usá-la.'],
    vault_not_found: ['Cofre do Obsidian não encontrado', 'O ambiente local não achou o cofre. Se ele estiver em outra pasta, defina CI_VAULT_PATH ao iniciar o npm run dev.'],
    disabled: ['Leitura local desativada', 'A ponte local está desativada neste ambiente (CI_LOCAL_BRIDGE=0).'],
    local_only: ['Acesso negado', 'A leitura do Obsidian só aceita requisições locais (localhost).'],
  };
  const [title, text] = messages[reason] || ['Creative Intelligence local não conectado', 'Não foi possível ler o Obsidian. Confirme que o Master está rodando localmente (npm run dev).'];
  return `<section class="panel ci-offline">
    <div class="state"><i data-lucide="plug-zap"></i><strong>${esc(title)}</strong><span>${esc(text)}</span>
      <button class="button" data-ci-action="refresh" type="button"><i data-lucide="refresh-cw"></i>Tentar novamente</button>
    </div>
  </section>`;
}

// ---------- visao geral ----------
export function ciClientPanel({ clients, niches, selectedId, totals }) {
  const options = [`<option value="all">Todos</option>`, ...clients.map((c) => `<option value="${esc(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.nome)}</option>`)].join('');
  const client = clients.find((c) => c.id === selectedId);
  let body;
  if (!client) {
    body = `<div class="table-wrap"><table class="ci-table"><thead><tr><th>Nicho</th><th>Público</th><th>Status</th><th>Referências</th><th>Pesquisas</th><th>Clientes</th></tr></thead><tbody>
      ${niches.map((n) => `<tr><td><strong>${esc(n.nome)}</strong></td><td>${esc(n.publico || '—')}</td><td>${chip(n.status === 'aguardando-cliente' ? 'Aguardando cliente' : 'Ativo', n.status === 'ativo' ? 'status-ativo' : 'status-pendente')}</td><td>${n.referencias}</td><td>${n.pesquisas}</td><td>${n.clientes.length ? n.clientes.map((c) => esc(c.nome)).join(', ') : '—'}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nenhum nicho cadastrado.</td></tr>'}
    </tbody></table></div>
    <p class="muted ci-note">Selecione um cliente para ver nicho, pesquisas, referências, conceitos e roteiros dele. Total: ${totals.pesquisas} pesquisas, ${totals.referencias} referências, ${totals.conceitos} conceitos, ${totals.roteiros} roteiros.</p>`;
  } else {
    const last = client.ultimaPesquisa;
    const stateText = !client.nicho ? 'Ainda sem pesquisa registrada para este cliente' : `Nicho da pesquisa mais recente${client.nichos.length > 1 ? ` (+${client.nichos.length - 1})` : ''}`;
    body = `<div class="ci-resolution">
      <div class="kv">
        <div><span>Cliente</span><strong>${esc(client.nome)}</strong><small class="muted">Cadastro do Master</small></div>
        <div><span>Nicho</span><strong>${esc(client.nichos.length ? client.nichos.join(' · ') : 'Não definido')}</strong><small class="muted">${esc(stateText)}</small></div>
        <div><span>Última pesquisa</span><strong>${last ? esc(dateBr(last.executadoEm) || last.titulo) : '—'}</strong>${last ? `<small class="muted">${esc(last.titulo)}</small>` : ''}</div>
        <div><span>Status no Master</span><strong>${esc(client.status)}</strong></div>
      </div>
      <div class="stats-grid compact">
        ${statCard('Nicho', client.nicho || '—', 'target', 'green')}
        ${statCard('Referências', client.counts.referencias, 'bookmark', 'blue')}
        ${statCard('Conceitos', client.counts.conceitos, 'lightbulb', 'yellow')}
        ${statCard('Roteiros', client.counts.roteiros, 'clapperboard', 'gold')}
      </div>
    </div>`;
  }
  return `<section class="panel ci-client-panel">
    <div class="panel-header">
      <div><h2>Cliente</h2><p class="muted">Clientes do Master. O nicho vem das pesquisas, referências e conceitos registrados.</p></div>
      <select class="input ci-select" data-ci-select="client" aria-label="Cliente">${options}</select>
    </div>
    ${body}
  </section>`;
}

function intelBlock(title, tone, items, hint) {
  if (!items || !items.length) return '';
  const rows = items.map((it) => {
    const count = it.count ? chip(`${it.count} anunciantes`, 'ci-anunciantes') : '';
    if (!it.detail) return `<div class="ci-item"><span class="ci-item-title">${mdInline(it.title)}</span>${count}</div>`;
    return `<details class="ci-item"><summary><span class="ci-item-title">${mdInline(it.title)}</span>${count}</summary><p>${mdInline(it.detail)}</p></details>`;
  }).join('');
  return `<div class="ci-intel-block tone-${tone}"><header><h3>${esc(title)}</h3><span class="muted">${items.length}</span></header>${hint ? `<p class="muted ci-hint">${esc(hint)}</p>` : ''}${rows}</div>`;
}

export function ciNichePanel({ niches, selectedName }) {
  const niche = niches.find((n) => n.nome === selectedName);
  const select = `<select class="input ci-select" data-ci-select="niche" aria-label="Nicho">${niches.map((n) => `<option value="${esc(n.nome)}" ${n.nome === selectedName ? 'selected' : ''}>${esc(n.nome)}</option>`).join('')}</select>`;
  let body;
  if (!niche) {
    body = emptyState('Nenhum nicho para mostrar', 'Quando existir um nicho cadastrado, a inteligência consolidada aparece aqui.');
  } else {
    const blocks = [
      intelBlock('Padrões', 'green', niche.padroes, '3 ou mais anunciantes independentes'),
      intelBlock('Recorrências ainda insuficientes', 'yellow', niche.recorrencias, '2 anunciantes ou evidência limitada'),
      intelBlock('Pouco explorado', 'blue', niche.poucoExplorado, 'aparece pouco na amostra'),
      intelBlock('Ideias a explorar', 'gold', niche.ideias, 'hipóteses, não conclusões'),
    ].join('');
    const compliance = niche.restricoes.length
      ? `<details class="ci-compliance"><summary><i data-lucide="shield-alert"></i>Restrições e compliance (${niche.restricoes.length})</summary><ul class="ci-list">${niche.restricoes.map((r) => `<li>${mdInline(r.title)}${r.detail ? ` ${mdInline(r.detail)}` : ''}</li>`).join('')}</ul></details>`
      : '';
    body = `<div class="ci-niche-meta">
        ${chip(niche.status === 'aguardando-cliente' ? 'Aguardando cliente' : 'Ativo', niche.status === 'ativo' ? 'status-ativo' : 'status-pendente')}
        ${niche.publico ? `<span class="muted">${esc(niche.publico)}</span>` : ''}
        <span class="muted">${niche.referencias} referência(s)${niche.atualizado ? ` · atualizado em ${esc(dateBr(niche.atualizado))}` : ''}</span>
      </div>
      ${niche.resumo ? `<p class="muted ci-summary">${mdInline(niche.resumo)}</p>` : ''}
      ${blocks ? `<div class="ci-intel-grid">${blocks}</div>` : emptyState('Nicho ainda sem inteligência consolidada', 'Padrões, recorrências e lacunas aparecem aqui depois das primeiras pesquisas.')}
      ${compliance}`;
  }
  return `<section class="panel ci-niche-panel">
    <div class="panel-header"><div><p class="eyebrow">Inteligência do nicho</p><h2>${esc(selectedName || 'Nicho')}</h2></div>${niches.length ? select : ''}</div>
    ${body}
  </section>`;
}

// ---------- pesquisas ----------

export function ciPesquisasPanel(pesquisas) {
  if (!pesquisas.length) return `<section class="panel"><div class="panel-header"><h2>Pesquisas executadas</h2></div>${emptyState('Nenhuma pesquisa registrada', 'Execute uma pesquisa no Claude Code com a skill ci-pesquisar. Ela aparece aqui quando for salva.')}</section>`;
  const num = (v) => (v == null ? '—' : v);
  return `<section class="panel">
    <div class="panel-header"><div><h2>Pesquisas executadas</h2><p class="muted">Histórico das rodadas feitas pelo Claude/Jev, da mais recente para a mais antiga.</p></div></div>
    <div class="ci-grid">${pesquisas.map((p) => `<article class="ci-card ci-pesquisa-card">
      <header><div><span class="ci-eyebrow">${esc([p.cliente?.nome, p.nicho].filter(Boolean).join(' · ') || 'Mercado')}</span><h3>${esc(p.titulo)}</h3></div>${chip(PESQUISA_STATUS[p.status] || p.status, `ci-pstatus-${esc(p.status)}`)}</header>
      <dl class="ci-facts">
        <div><dt>Quando</dt><dd>${esc(dateBr(p.executadoEm) || '—')}</dd></div>
        <div><dt>Fonte</dt><dd>${esc(p.fonteLabel || '—')}</dd></div>
        ${p.objetivo ? `<div><dt>Objetivo</dt><dd>${mdInline(p.objetivo)}</dd></div>` : ''}
      </dl>
      <div class="ci-metrics"><div><strong>${num(p.cartoes)}</strong><span>cartões</span></div><div><strong>${num(p.anunciantes)}</strong><span>anunciantes</span></div><div><strong>${num(p.candidatos)}</strong><span>candidatos</span></div><div><strong>${num(p.salvas)}</strong><span>salvas</span></div></div>
      <footer><span class="muted">${p.consultas.length ? `${p.consultas.length} consulta(s)` : ''}</span><div class="ci-actions"><button class="secondary-button" data-ci-action="open-pesquisa" data-id="${esc(p.id)}" type="button"><i data-lucide="eye"></i>Ver pesquisa</button></div></footer>
    </article>`).join('')}</div>
  </section>`;
}

export function ciPesquisaDetail(p) {
  const rows = p.consultas.map((c) => `<tr><td>${esc(c.termo || '—')}</td><td>${esc(c.territorio || '—')}</td><td>${esc(c.resultados_exibidos || '—')}</td><td>${c.cartoes_lidos ?? '—'}</td><td>${c.anunciantes_distintos ?? '—'}</td><td>${esc(c.obs || '')}</td></tr>`).join('');
  return `<div class="ci-detail">
    <div class="ci-detail-head"><div class="ci-chips">${p.nicho ? chip(p.nicho, 'status-ativo') : ''}${p.cliente ? chip(p.cliente.nome, 'status-conectando') : ''}${chip(PESQUISA_STATUS[p.status] || p.status, `ci-pstatus-${esc(p.status)}`)}</div></div>
    <div class="ci-fields">${field('Quando', dateBr(p.executadoEm))}${field('Fonte', p.fonteLabel)}${field('Objetivo', p.objetivo)}${field('Dor / tema', p.dorTema)}</div>
    ${section('Resumo', p.resumo && `<p>${mdInline(p.resumo)}</p>`)}
    ${section('Territórios', p.territorios.length ? `<div class="ci-chips">${p.territorios.map((t) => chip(`${t.id ? `${t.id} · ` : ''}${t.nome || ''}`)).join('')}</div>` : '')}
    ${section('Consultas', rows && `<div class="table-wrap"><table class="ci-table"><thead><tr><th>Termo</th><th>Território</th><th>Resultados</th><th>Cartões lidos</th><th>Anunciantes</th><th>Obs.</th></tr></thead><tbody>${rows}</tbody></table></div>`)}
  </div>`;
}

const PESQUISA_STATUS = { em_andamento: 'Em andamento', concluida: 'Concluída', erro: 'Erro' };

// ---------- modal: nova pesquisa / pedido ----------
export function ciResearchForm({ clients, niches, client, nicheName, objective = '' }) {
  const nicheOptions = [...new Set([...niches.map((n) => n.nome), ...(nicheName ? [nicheName] : [])])];
  return `<div class="form-grid ci-form">
    <label class="full">Cliente
      <select class="input" name="cliente" data-ci-modal-client>
        <option value="">Sem cliente (pesquisa de mercado)</option>
        ${clients.map((c) => `<option value="${esc(c.id)}" ${client && c.id === client.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
      </select></label>
    <label>Nicho
      <input class="input" name="nicho" list="ciNicheList" value="${esc(nicheName || '')}" placeholder="Ex.: Restaurantes" autocomplete="off">
      <datalist id="ciNicheList">${nicheOptions.map((n) => `<option value="${esc(n)}"></option>`).join('')}</datalist></label>
    <label>Fonte
      <select class="input" name="fonte">${SOURCES.map((s) => `<option value="${s.id}" ${s.enabled ? '' : 'disabled'}>${esc(s.label)}${s.enabled ? '' : ' (em breve)'}</option>`).join('')}</select></label>
    <label class="full">Objetivo da pesquisa
      <textarea class="input" name="objetivo" rows="3" placeholder="Ex.: Encontrar referências para almoço durante a semana">${esc(objective)}</textarea></label>
    <div class="ci-form-errors full" data-ci-errors hidden></div>
    <div class="form-actions"><button type="button" class="secondary-button" data-ci-action="close-modal">Cancelar</button>
      <button type="button" class="button" data-ci-action="prepare-research"><i data-lucide="clipboard-list"></i>Preparar pesquisa</button></div>
  </div>`;
}

export function ciConceptsForm({ clients, client }) {
  return `<div class="form-grid ci-form">
    <label class="full">Cliente
      <select class="input" name="cliente">
        <option value="">Escolha o cliente</option>
        ${clients.map((c) => `<option value="${esc(c.id)}" ${client && c.id === client.id ? 'selected' : ''}>${esc(c.nome)}${c.nicho ? ` · ${esc(c.nicho)}` : ''}</option>`).join('')}
      </select></label>
    <label>Quantidade de conceitos<input class="input" type="number" name="quantidade" min="1" max="30" value="10"></label>
    <div class="ci-form-errors full" data-ci-errors hidden></div>
    <div class="form-actions"><button type="button" class="secondary-button" data-ci-action="close-modal">Cancelar</button>
      <button type="button" class="button" data-ci-action="prepare-concepts"><i data-lucide="clipboard-list"></i>Preparar pedido</button></div>
  </div>`;
}

export function ciRequestPreview({ request, prompt }) {
  return `<div class="ci-preview">
    <div class="ci-callout"><i data-lucide="info"></i><span><strong>Pedido preparado. Nada foi executado.</strong> Execute a pesquisa pelo Claude Code, dentro do repositório do Master, usando a skill ci-pesquisar. Cole o pedido abaixo; ele já indica cliente, nicho, objetivo e fonte.</span></div>
    <h3>Pedido para o Claude Code</h3>
    <pre class="ci-code ci-prompt" data-ci-prompt>${esc(prompt)}</pre>
    <h3>Pedido estruturado</h3>
    <pre class="ci-code" data-ci-json>${esc(JSON.stringify(request, null, 2))}</pre>
    <div class="form-actions">
      <button type="button" class="secondary-button" data-ci-action="close-modal">Fechar</button>
      <button type="button" class="secondary-button" data-ci-action="copy-json"><i data-lucide="braces"></i>Copiar JSON</button>
      <button type="button" class="button" data-ci-action="copy-prompt"><i data-lucide="copy"></i>Copiar pedido</button>
    </div>
  </div>`;
}

// ---------- referencias ----------
export function ciReferenceFilters({ references, clients, niches, filters }) {
  const sel = (name, label, options, value) => `<select class="input" data-ci-filter="${name}" aria-label="${label}"><option value="all">${label}: todos</option>${options.map(([v, text]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>`;
  return `<div class="filters ci-filters">
    <input class="input ci-search" type="search" data-ci-filter="q" value="${esc(filters.q)}" placeholder="Buscar por anunciante, hook, ângulo, oferta…" aria-label="Buscar">
    ${sel('angulo', 'Ângulo', distinct(references.map((r) => r.angulo)).sort((a, b) => a.localeCompare(b, 'pt-BR')).map((a) => [a, shorten(a, 64)]), filters.angulo)}
    ${sel('formato', 'Formato', distinct(references.map((r) => r.formatoCategoria)).map((f) => [f, f]), filters.formato)}
    ${sel('anunciante', 'Anunciante', distinct(references.map((r) => r.anunciante)).sort((a, b) => a.localeCompare(b, 'pt-BR')).map((a) => [a, a]), filters.anunciante)}
    <button class="ghost-button" data-ci-action="clear-filters" type="button"><i data-lucide="x"></i>Limpar</button>
  </div>`;
}

// Filtro global (cabecalho, ao lado de "Nova pesquisa"): vale para todas as abas.
export function ciGlobalFilters({ clients, niches, filters }) {
  const sel = (name, label, options, value) => `<select class="input" data-ci-filter="${name}" aria-label="${label}"><option value="all">${label}: todos</option>${options.map(([v, text]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>`;
  const active = filters.cliente !== 'all' || filters.nicho !== 'all';
  return `<div class="ci-global-filters">
    ${sel('cliente', 'Cliente', clients.map((c) => [c.id, c.nome]), filters.cliente)}
    ${sel('nicho', 'Categoria', niches.map((n) => [n.nome, n.nome]), filters.nicho)}
    ${active ? '<button class="ghost-button" data-ci-action="clear-filters" type="button"><i data-lucide="x"></i>Limpar</button>' : ''}
  </div>`;
}

export function filterPesquisas(pesquisas, filters) {
  return pesquisas.filter((p) => (filters.cliente === 'all' || p.cliente?.id === filters.cliente)
    && (filters.nicho === 'all' || p.nicho === filters.nicho)
    && (filters.status === 'all' || p.status === filters.status));
}

// serve para conceitos e roteiros (roteiro = conceito com roteiro)
export function filterConcepts(concepts, filters) {
  return concepts.filter((c) => (filters.cliente === 'all' || c.cliente === filters.cliente)
    && (filters.nicho === 'all' || c.nicho === filters.nicho)
    && (filters.status === 'all' || c.status === filters.status)
    && (filters.formato === 'all' || formatCategory(c.formato) === filters.formato));
}


export function filterReferences(references, filters, clients) {
  const q = String(filters.q || '').toLowerCase().trim();
  const client = clients.find((c) => c.id === filters.cliente);
  return references.filter((r) => {
    if (client && !r.clientes.some((c) => c.id === client.id)) return false;
    if (filters.nicho !== 'all' && r.nicho !== filters.nicho) return false;
    if (filters.angulo !== 'all' && r.angulo !== filters.angulo) return false;
    if (filters.formato !== 'all' && r.formatoCategoria !== filters.formato) return false;
    if (filters.anunciante !== 'all' && r.anunciante !== filters.anunciante) return false;
    if (q) {
      const hay = [r.anunciante, r.hook, r.angulo, r.oferta, r.cta, r.nicho, r.formato, r.motivos.map(motivoLabel).join(' ')].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function ciReferenceCard(ref) {
  const facts = [['Ângulo', ref.angulo], ['Oferta', ref.oferta], ['CTA', ref.cta]].filter(([, v]) => v);
  return `<article class="ci-card ci-ref-card">
    <header><div><span class="ci-eyebrow">${esc(ref.nicho || 'Sem nicho')}</span><h3>${esc(ref.anunciante)}</h3></div>${ref.formatoCategoria ? chip(ref.formatoCategoria) : ''}</header>
    ${ref.hook ? `<blockquote class="ci-hook">${mdInline(ref.hook)}</blockquote>` : ''}
    ${facts.length ? `<dl class="ci-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${mdInline(v)}</dd></div>`).join('')}</dl>` : ''}
    ${ref.motivos.length ? `<div class="ci-chips">${ref.motivos.map((m) => chip(motivoLabel(m), 'ci-motivo')).join('')}</div>` : ''}
    ${ref.clientes.length ? `<div class="ci-related"><span class="muted">Cliente relacionado</span> ${ref.clientes.map((c) => chip(c.nome, 'status-conectando')).join(' ')}</div>` : ''}
    <footer>
      <span class="muted">${[ref.ativoDesde ? `Ativo desde ${dateBr(ref.ativoDesde)}` : '', ref.fonteLabel ? `Fonte: ${ref.fonteLabel}` : ''].filter(Boolean).map(esc).join(' · ')}</span>
      <div class="ci-actions">
        <button class="secondary-button" data-ci-action="open-reference" data-id="${esc(ref.id)}" type="button"><i data-lucide="eye"></i>Ver referência</button>
        ${ref.url ? `<a class="ghost-button" href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer"><i data-lucide="external-link"></i>Abrir fonte</a>` : ''}
      </div>
    </footer>
  </article>`;
}

export function ciReferenceList(refs) {
  return refs.length
    ? `<div class="ci-grid">${refs.map(ciReferenceCard).join('')}</div>`
    : emptyState('Nenhuma referência encontrada', 'Ajuste os filtros ou a busca. Referências novas aparecem aqui quando forem salvas no Obsidian.');
}

export function ciReferenceDetail(ref) {
  const s = ref.secoes;
  const origem = [ref.fonteLabel, ref.consultadoEm ? `consultado em ${dateBr(ref.consultadoEm)}` : '', ref.ativoDesde ? `ativo desde ${dateBr(ref.ativoDesde)}` : ''].filter(Boolean).join(' · ');
  return `<div class="ci-detail">
    <div class="ci-detail-head">
      <div class="ci-chips">${ref.nicho ? chip(ref.nicho, 'status-ativo') : ''}${ref.formato ? chip(ref.formato) : ''}${ref.clientes.map((c) => chip(c.nome, 'status-conectando')).join('')}</div>
      ${ref.url ? `<a class="button" href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer"><i data-lucide="external-link"></i>Link original</a>` : ''}
    </div>
    ${ref.hook ? `<blockquote class="ci-hook ci-hook-lg">${mdInline(ref.hook)}</blockquote>` : ''}
    <div class="ci-fields">
      ${field('Fonte', origem)}
      ${field('Ângulo', ref.angulo)}
      ${field('Oferta', ref.oferta)}
      ${field('CTA', ref.cta)}
    </div>
    ${ref.motivos.length ? section('Motivo pelo qual foi salva', `<div class="ci-chips">${ref.motivos.map((m) => chip(motivoLabel(m), 'ci-motivo')).join('')}</div>`) : ''}
    ${section('Fatos', s.fatos && mdBlocks(s.fatos))}
    ${section('Observações', s.observacoes && mdBlocks(s.observacoes))}
    ${section('Sinais', s.sinais && `<p class="muted ci-note">Indícios observáveis. Não são resultado nem prova de performance.</p>${mdBlocks(s.sinais)}`)}
    ${section('Hipóteses / oportunidades', s.hipoteses && mdBlocks(s.hipoteses))}
    ${section('Transcrição / resumo visual', s.transcricao && mdBlocks(s.transcricao))}
  </div>`;
}

// ---------- conceitos ----------
export function ciConceptCard(c) {
  const facts = [['Ângulo', c.angulo], ['Hook', c.hook], ['Dor/desejo', c.dorDesejo], ['Ideia central', c.ideiaCentral], ['Formato', c.formato]].filter(([, v]) => v);
  return `<article class="ci-card ci-concept-card">
    <header><div><span class="ci-eyebrow">${esc([c.clienteNome, c.nicho].filter(Boolean).join(' · ') || 'Sem cliente')}</span><h3>${esc(c.nome)}</h3></div>
      ${chip(STATUS_LABELS[c.status] || c.status, `ci-status-${esc(c.status)}`)}</header>
    ${c.posicionamento ? `<div class="ci-chips">${chip(POSICIONAMENTO_LABELS[c.posicionamento] || c.posicionamento, 'ci-motivo')}</div>` : ''}
    <dl class="ci-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${mdInline(v)}</dd></div>`).join('')}</dl>
    <footer><span class="muted">${c.data ? `Atualizado em ${esc(dateBr(c.data))}` : ''}</span>
      <div class="ci-actions">
        <button class="ghost-button" data-ci-action="concept-action" data-kind="selecionar" data-id="${esc(c.id)}" type="button" ${c.status === 'selecionado' ? 'disabled' : ''}><i data-lucide="check"></i>Selecionar</button>
        <button class="ghost-button" data-ci-action="concept-action" data-kind="descartar" data-id="${esc(c.id)}" type="button" ${c.status === 'descartado' ? 'disabled' : ''}><i data-lucide="x"></i>Descartar</button>
        <button class="secondary-button" data-ci-action="open-concept" data-id="${esc(c.id)}" type="button"><i data-lucide="eye"></i>Ver</button>
        <button class="button" data-ci-action="concept-action" data-kind="criar-roteiro" data-id="${esc(c.id)}" type="button"><i data-lucide="clapperboard"></i>${c.hasRoteiro ? 'Refazer roteiro' : 'Criar roteiro'}</button>
      </div></footer>
  </article>`;
}

export function ciConceptsEmpty() {
  return `<section class="panel ci-empty-hero"><div class="state"><i data-lucide="lightbulb"></i><strong>Nenhum conceito criado ainda.</strong>
    <span>Conceitos nascem da inteligência do nicho e da memória do cliente, sem repetir ideias já criadas.</span>
    <button class="button" data-ci-action="create-concepts" type="button"><i data-lucide="plus"></i>Criar conceitos</button></div></section>`;
}

export function ciConceptDetail(c) {
  return `<div class="ci-detail">
    <div class="ci-detail-head"><div class="ci-chips">${chip(STATUS_LABELS[c.status] || c.status, `ci-status-${esc(c.status)}`)}${c.posicionamento ? chip(POSICIONAMENTO_LABELS[c.posicionamento] || c.posicionamento, 'ci-motivo') : ''}${c.nicho ? chip(c.nicho, 'status-ativo') : ''}</div></div>
    ${c.hook ? `<blockquote class="ci-hook ci-hook-lg">${mdInline(c.hook)}</blockquote>` : ''}
    <div class="ci-fields">${field('Cliente', c.clienteNome)}${field('Ângulo', c.angulo)}${field('Dor/desejo', c.dorDesejo)}${field('Ideia central', c.ideiaCentral)}${field('Formato', c.formato)}</div>
    ${section('Referências e observações', c.racional && mdBlocks(c.racional))}
    ${c.referencias.length ? section('Referências usadas', `<ul class="ci-list">${c.referencias.map((r) => `<li>${mdInline(r)}</li>`).join('')}</ul>`) : ''}
  </div>`;
}

// ---------- roteiros ----------
export function ciScriptCard(c, selected = false) {
  return `<article class="ci-card ci-script-card">
    <header><label class="ci-pick"><input type="checkbox" data-ci-pick data-id="${esc(c.id)}" ${selected ? 'checked' : ''} aria-label="Selecionar roteiro"></label><div><span class="ci-eyebrow">${esc(c.clienteNome || 'Sem cliente')}</span><h3>${esc(c.nome)}</h3></div>${c.formato ? chip(c.formato) : ''}</header>
    ${c.hook ? `<blockquote class="ci-hook">${mdInline(c.hook)}</blockquote>` : ''}
    <footer><span class="muted">${c.data ? esc(dateBr(c.data)) : ''}</span>
      <div class="ci-actions"><button class="secondary-button" data-ci-action="copy-script" data-id="${esc(c.id)}" type="button"><i data-lucide="copy"></i>Copiar</button>
      <button class="button" data-ci-action="open-script" data-id="${esc(c.id)}" type="button"><i data-lucide="eye"></i>Abrir</button></div></footer>
  </article>`;
}

export function ciScriptSelectionBar(total, selectedCount) {
  return `<div class="ci-selbar" data-ci-selbar>
    <label class="ci-pick-all"><input type="checkbox" data-ci-pick-all ${selectedCount && selectedCount === total ? 'checked' : ''}> Selecionar todos (${total})</label>
    <span class="muted" data-ci-sel-count>${selectedCount} selecionado(s)</span>
    <div class="ci-actions">
      <button class="secondary-button" data-ci-action="export-doc" type="button" data-ci-needs-sel ${selectedCount ? '' : 'disabled'}><i data-lucide="file-text"></i>Baixar .doc</button>
      <button class="button" data-ci-action="export-pdf" type="button" data-ci-needs-sel ${selectedCount ? '' : 'disabled'}><i data-lucide="file-down"></i>Baixar PDF (solicitação de criativo)</button>
    </div>
  </div>`;
}

export function ciScriptsEmpty() {
  return `<section class="panel ci-empty-hero"><div class="state"><i data-lucide="clapperboard"></i><strong>Nenhum roteiro criado ainda.</strong>
    <span>Roteiros nascem de conceitos selecionados e ficam dentro da nota do conceito no Obsidian.</span>
    <button class="secondary-button" data-ci-action="tab" data-tab="conceitos" type="button"><i data-lucide="lightbulb"></i>Ver conceitos</button></div></section>`;
}

export function ciScriptDetail(c) {
  const s = scriptSections(c);
  const text = (t) => (t ? mdBlocks(t) : '');
  return `<div class="ci-detail">
    <div class="ci-detail-head"><div class="ci-chips">${c.clienteNome ? chip(c.clienteNome, 'status-conectando') : ''}${c.formato ? chip(c.formato) : ''}${c.data ? chip(dateBr(c.data)) : ''}</div>
      <div class="ci-actions"><button class="secondary-button" data-ci-action="export-doc" data-id="${esc(c.id)}" type="button"><i data-lucide="file-text"></i>Baixar .doc</button>
      <button class="secondary-button" data-ci-action="export-pdf" data-id="${esc(c.id)}" type="button"><i data-lucide="file-down"></i>Baixar PDF</button>
      <button class="button" data-ci-action="copy-script" data-id="${esc(c.id)}" type="button"><i data-lucide="copy"></i>Copiar roteiro</button></div></div>
    ${section('Hook', s.hook && `<blockquote class="ci-hook ci-hook-lg">${mdInline(s.hook)}</blockquote>`)}
    ${section('Roteiro', text(s.roteiro))}
    ${section('Cenas', text(s.cenas))}
    ${section('Texto na tela', text(s.textoNaTela))}
    ${section('CTA', text(s.cta))}
    ${section('Antes de publicar', text(s.observacoes))}
    ${section('Referências utilizadas', s.referencias.length ? `<ul class="ci-list">${s.referencias.map((r) => `<li>${mdInline(r)}</li>`).join('')}</ul>` : '')}
  </div>`;
}
