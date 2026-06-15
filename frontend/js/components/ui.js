export const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const number = (value) => Number(value || 0).toLocaleString('pt-BR');
export const date = (value) => {
  if (!value) return '-';
  const d = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
};

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function statusBadge(value) {
  const key = String(value || 'neutro');
  return `<span class="status-badge status-${escapeHtml(key)}">${label(key)}</span>`;
}

export function label(value) {
  const labels = {
    ativo: 'Ativo',
    pausado: 'Pausado',
    cancelado: 'Cancelado',
    prospect: 'Prospect',
    starter: 'Starter',
    growth: 'Growth',
    premium: 'Premium',
    personalizado: 'Personalizado',
    lead_novo: 'Lead novo',
    contato_feito: 'Contato feito',
    respondeu: 'Respondeu',
    reuniao_marcada: 'Reuniao marcada',
    proposta_enviada: 'Proposta enviada',
    follow_up: 'Follow-up',
    fechado: 'Fechado',
    perdido: 'Perdido',
    meta_ads: 'Meta Ads',
    google_ads: 'Google Ads',
    tiktok_ads: 'TikTok Ads',
    linkedin_ads: 'LinkedIn Ads',
    outro: 'Outro',
    ativa: 'Ativa',
    pausada: 'Pausada',
    encerrada: 'Encerrada',
    teste: 'Teste',
    baixa: 'Baixa',
    media: 'Media',
    alta: 'Alta',
    urgente: 'Urgente',
    pendente: 'Pendente',
    conectando: 'Conectando',
    em_andamento: 'Em andamento',
    concluida: 'Concluida',
    cancelada: 'Cancelada',
    baixo: 'Baixo',
    medio: 'Medio',
    alto: 'Alto',
    inativo: 'Inativo',
  };
  return labels[value] || value || '-';
}

export function loadingState(text = 'Carregando dados...') {
  return `<div class="state state-loading"><span class="spinner"></span>${escapeHtml(text)}</div>`;
}

export function emptyState(title = 'Nada encontrado', text = 'Crie o primeiro registro para comecar.') {
  return `<div class="state"><i data-lucide="inbox"></i><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
}

export function pageHeader(title, subtitle, action = '') {
  return `
    <div class="page-header">
      <div>
        <p class="eyebrow">The Midia Master</p>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
      </div>
      <div class="header-actions">${action}</div>
    </div>
  `;
}

export function statCard(labelText, value, icon, tone = 'blue') {
  return `
    <article class="stat-card tone-${tone}">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(labelText)}</span>
    </article>
  `;
}

export function confirmDelete(labelText) {
  return window.confirm(`Excluir ${labelText}? Esta acao nao pode ser desfeita.`);
}

export function toast(message, type = 'success') {
  const node = document.createElement('div');
  node.className = `toast toast-${type}`;
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

export function renderLucide() {
  if (window.lucide) window.lucide.createIcons();
}
