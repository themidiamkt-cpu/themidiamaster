// Helpers puros de formatacao do Creative Intelligence (sem DOM, sem estado).
import { escapeHtml } from '../components/ui.js';

export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const plainLinks = (s) => String(s ?? '')
  .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
  .replace(/\[\[([^\]]+)\]\]/g, '$1');

// Markdown minimo e seguro: escapa primeiro, depois aplica **negrito** e `codigo`.
export function mdInline(text) {
  return escapeHtml(plainLinks(text))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

export function mdBlocks(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let listTag = '';
  const closeList = () => { if (listTag) { html.push(`</${listTag}>`); listTag = ''; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    const heading = line.match(/^#{3,4}\s+(.*)$/);
    if (bullet || numbered) {
      const tag = bullet ? 'ul' : 'ol';
      if (listTag !== tag) { closeList(); html.push(`<${tag} class="ci-list">`); listTag = tag; }
      html.push(`<li>${mdInline((bullet || numbered)[1])}</li>`);
    } else if (heading) {
      closeList();
      html.push(`<h4>${mdInline(heading[1])}</h4>`);
    } else if (line.trim()) {
      closeList();
      html.push(`<p>${mdInline(line.trim())}</p>`);
    } else {
      closeList();
    }
  }
  closeList();
  return html.join('');
}

export const MOTIVO_LABELS = {
  'hook-forte': 'Hook forte',
  angulo: 'Ângulo',
  'oferta-diferente': 'Oferta diferente',
  'formato-criativo': 'Formato criativo',
  argumento: 'Argumento',
  'objecao-trabalhada': 'Objeção trabalhada',
  mecanismo: 'Mecanismo',
  posicionamento: 'Posicionamento',
};
export const motivoLabel = (m) => MOTIVO_LABELS[m] || m;

export const STATUS_LABELS = { ideia: 'Ideia', selecionado: 'Selecionado', roteirizado: 'Roteirizado', descartado: 'Descartado' };
export const POSICIONAMENTO_LABELS = { paridade: 'Paridade', diferenciacao: 'Diferenciação', 'mecanismo-proprio': 'Mecanismo próprio' };

export function dateBr(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value || '');
}

export function formatCategory(formato) {
  const s = norm(formato);
  if (!s) return '';
  if (/video|reels|\d:\d\d/.test(s)) return 'Vídeo';
  if (/carrossel|carousel/.test(s)) return 'Carrossel';
  if (/imagem|flyer|cartaz|estatic|foto/.test(s)) return 'Imagem';
  return 'Outro';
}

export const distinct = (values) => [...new Set(values.filter(Boolean))];

export function shorten(text, max = 70) {
  const t = String(text || '').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

// Texto simples de um roteiro (para copiar). Usa so as secoes que existirem.
export function scriptSections(concept) {
  const r = concept.roteiro || {};
  return {
    hook: r.hook || concept.hook || '',
    roteiro: String(r.completo || '').trim(),
    cenas: r.cenas || '',
    textoNaTela: r.textoNaTela || '',
    cta: r.cta || '',
    observacoes: r.observacoes || '',
    referencias: concept.referencias || [],
  };
}

export function scriptToPlainText(concept) {
  const s = scriptSections(concept);
  const parts = [];
  const add = (title, body) => { if (body && String(body).trim()) parts.push(`${title}\n${plainLinks(body).replace(/\*\*/g, '').trim()}`); };
  add('HOOK', s.hook);
  add('ROTEIRO', s.roteiro);
  add('CENAS', s.cenas);
  add('TEXTO NA TELA', s.textoNaTela);
  add('CTA', s.cta);
  if (s.referencias.length) parts.push(`REFERÊNCIAS UTILIZADAS\n${s.referencias.map(plainLinks).join('\n')}`);
  return `${concept.nome}\n${concept.clienteNome ? `Cliente: ${concept.clienteNome}\n` : ''}\n${parts.join('\n\n')}`.trim();
}

// ---------- exportacao em documento (.doc, abre no Word e no Google Docs) ----------
const wEsc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const wBlock = (text) => String(text || '').replace(/\*\*/g, '').split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => `<p>${wEsc(plainLinks(l))}</p>`).join('');

function wordSection(concept) {
  const s = scriptSections(concept);
  const r = concept.roteiro || {};
  const part = (title, body) => (body && String(body).trim() ? `<h3>${wEsc(title)}</h3>${wBlock(body)}` : '');
  return `<h2>${wEsc(r.titulo || concept.nome)}</h2>
    <p class="meta">${[concept.clienteNome && `Cliente: ${concept.clienteNome}`, concept.formato && `Formato: ${concept.formato}`, r.versao && `Versão ${r.versao}`].filter(Boolean).map(wEsc).join(' · ')}</p>
    ${part('Hook', s.hook)}${part('Roteiro', s.roteiro)}${part('Cenas', s.cenas)}${part('Texto na tela', s.textoNaTela)}${part('CTA', s.cta)}
    ${s.observacoes ? `<h3>Antes de publicar</h3>${wBlock(s.observacoes)}` : ''}
    ${s.referencias.length ? `<h3>Referências utilizadas</h3>${s.referencias.map((x) => `<p>${wEsc(plainLinks(x))}</p>`).join('')}` : ''}`;
}

// Documento HTML com cabecalho Word: o Word e o Google Docs abrem como .doc.
export function scriptsToWordHtml(concepts, title = 'Roteiros') {
  const body = concepts.map(wordSection).join('<br clear="all" style="page-break-before:always">');
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${wEsc(title)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1a1a1a}h1{font-size:20pt}h2{font-size:16pt;margin-bottom:2pt}h3{font-size:12pt;margin:12pt 0 2pt;color:#0f6b5a}p{margin:2pt 0}.meta{color:#666;font-size:10pt}</style></head><body>
<h1>${wEsc(title)}</h1>${body}</body></html>`;
}

export function wordFileName(concepts, fallback = 'roteiros') {
  const base = concepts.length === 1 ? concepts[0].nome : concepts.length && concepts.every((c) => c.clienteNome === concepts[0].clienteNome) && concepts[0].clienteNome ? `Roteiros - ${concepts[0].clienteNome}` : fallback;
  return `${base.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-') || fallback}.doc`;
}
