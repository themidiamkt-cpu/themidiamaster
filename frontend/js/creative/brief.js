// Gerador do PDF "Solicitacao de criativo": ficha operacional por criativo + capa, regras gerais, indice e plano de captacao.
// Funcao pura: recebe os roteiros (conceitos com roteiro) e os dados opcionais da solicitacao, devolve o HTML de impressao.
// Nunca inventa dado operacional: o que falta aparece como pendencia.
import { dateBr, norm, plainLinks, scriptSections } from './format.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const clean = (s) => plainLinks(String(s ?? '')).replace(/\*\*/g, '').trim();
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const NI = 'Não informado';

export const BASE_RULES = [
  'Usar somente imagens e vídeos reais e autorizados do cliente.',
  'Não criar promoções, preços ou condições que não foram confirmados.',
  'Não fazer promessa de resultado.',
  'Pessoas identificáveis somente com autorização.',
  'Crianças somente com autorização dos responsáveis.',
  'Respeitar as regras específicas da plataforma de anúncios.',
  'Conferir as informações variáveis (cardápio, horários, condições) antes de publicar.',
];

// ---------- interpretacao do conteudo ja existente ----------
export function creativeKind(formato) {
  const f = norm(formato);
  if (/carrossel|carousel/.test(f)) return 'Carrossel';
  if (/mensagem/.test(f)) return 'Mensagem + imagem';
  if (/imagem ou video/.test(f)) return 'Imagem ou vídeo';
  if (/video|reels/.test(f)) return 'Vídeo';
  if (/imagem|flyer|foto/.test(f)) return 'Imagem';
  return formato ? cap(String(formato)) : '';
}

export function parseDuration(...texts) {
  for (const t of texts) {
    const m = String(t || '').match(/(\d{1,2})\s*s\b/);
    if (m) return `até ${m[1]}s`;
  }
  return '';
}

// "1) 0-3s: descricao. Fala: \"...\"" ou "Card 2 (comida): descricao"
export function parseScenes(cenas) {
  const scenes = [];
  const extras = [];
  for (const raw of String(cenas || '').split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    let m = line.match(/^(\d+)\)\s*(?:(\d+\s*[-–]\s*\d+\s*s):\s*)?(.+)$/);
    if (m) {
      scenes.push({ n: Number(m[1]), tempo: (m[2] || '').replace(/\s+/g, '').replace('-', '–'), ...splitScene(m[3]) });
      continue;
    }
    m = line.match(/^Card\s*(\d+)\s*(?:\(([^)]*)\))?\s*:\s*(.+)$/i);
    if (m) {
      scenes.push({ n: Number(m[1]), tempo: '', label: `Card ${m[1]}${m[2] ? ` (${m[2]})` : ''}`, ...splitScene(m[3]) });
      continue;
    }
    extras.push(line);
  }
  return { scenes, extras };
}

function splitScene(desc) {
  let imagem = clean(desc);
  let fala = '';
  let texto = '';
  const f = imagem.match(/\bFala:\s*([\s\S]*)$/);
  if (f) { fala = f[1].trim(); imagem = imagem.slice(0, f.index).trim(); }
  const t = imagem.match(/\b(?:Texto|T[ií]tulo):\s*([\s\S]*)$/);
  if (t) { texto = t[1].trim(); imagem = imagem.slice(0, t.index).trim(); }
  imagem = imagem.replace(/[.\s]+$/, '');
  return { imagem, fala, texto };
}

export function parseScreens(texto) {
  const byN = new Map();
  const extras = [];
  for (const raw of String(texto || '').split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(?:Tela|Card)\s*(\d+)(?:\s*\([^)]*\))?\s*:\s*(.+)$/i);
    if (m) byN.set(Number(m[1]), [...(byN.get(Number(m[1])) || []), clean(m[2])]);
    else extras.push(clean(line));
  }
  return { byN, extras };
}

// junta cena + texto na tela por momento quando os numeros batem; senao deixa o texto numa lista a parte
export function mergeMoments(cenas, textoNaTela) {
  const { scenes, extras: sceneExtras } = parseScenes(cenas);
  const { byN, extras: screenExtras } = parseScreens(textoNaTela);
  const isCard = scenes.length > 0 && scenes.every((s) => s.label);
  const aligned = scenes.length > 0 && (isCard || (byN.size === scenes.length && scenes.every((s) => byN.has(s.n))));
  const moments = scenes.map((s) => ({ ...s, texto: ((aligned || isCard) && (byN.get(s.n) || []).join(' · ')) || s.texto }));
  const loose = aligned || isCard ? screenExtras : [...[...byN.entries()].map(([n, t]) => `Tela ${n}: ${t.join(' · ')}`), ...screenExtras];
  return { moments, extras: sceneExtras, loose, isCard };
}

const GENERIC_BASE = [
  /imagens?\s*(e|\/)\s*v[ií]deos?\s*reais?|v[ií]deo real|material real|somente (imagem|material)|s[oó] (usar )?(imagem|material)/i,
  /sem promessa de resultado/i,
  /autoriza[cç][aã]o.*(pais|respons[aá]ve|crian)|(crian|pessoa|rosto|cliente).*autoriza|autoriza.*(imagem|rosto)/i,
  /confirmar com o cliente (o que est[aá] vigente )?antes de publicar$/i,
];
const sentences = (text) => String(text || '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

// separa observacoes gerais (valem para o cliente) das especificas de cada peca
export function splitObservations(list) {
  const per = list.map((c) => sentences((c.roteiro || {}).observacoes).map(clean));
  const count = new Map();
  per.forEach((arr) => new Set(arr.map(norm)).forEach((k) => count.set(k, (count.get(k) || 0) + 1)));
  const general = new Map();
  const specific = per.map((arr) => arr.filter((s) => {
    if (GENERIC_BASE.some((re) => re.test(s))) return false;
    if (list.length >= 3 && count.get(norm(s)) >= 2) { general.set(norm(s), s); return false; }
    return true;
  }));
  return { general: [...general.values()], specific };
}

// itens de captacao: a descricao de imagem de cada cena, sem a fala
const ASSET = /foto|imagem|logo|print|v[ií]deo|arte|avalia[cç]|capa|salão|salao|prato|fachada/i;
export function captureItems(moments) {
  const items = [];
  for (const m of moments) {
    for (const part of m.imagem.split(/;\s*|\s\+\s/)) {
      const p = part.replace(/\s*:?\s*["“][^"”]*["”]/g, '').replace(/^[,\s]+|[,\s:]+$/g, '');
      if (p.length > 3 && !/^fala\b/i.test(p) && (!m.label || ASSET.test(p))) items.push(cap(p));
    }
  }
  return items;
}

const CATS = [
  ['Apresentadora e pessoas', /apresentador|atendente|dono|profissional|equipe|cliente|grupo|fam[ií]lia|casal|pessoas|adultos|crian|dona|cozinheiro|chef|convidados|mãos|mao /i],
  ['Ambiente', /fachada|entrada|sal[aã]o|estacionamento|espa[cç]o|ambiente|mesa|balc[aã]o|torneira|estoque|prateleira|loja|noite/i],
  ['Comida e bebida', /prato|carne|brasa|chapa|torresmo|chope|feijoada|comida|sobremesa|cozinha|parmegiana|abadejo|growler|barril|chopeira/i],
];
const catOf = (item) => (CATS.find(([, re]) => re.test(item)) || ['Outros materiais'])[0];

export function consolidateCapture(list) {
  const groups = new Map([...CATS.map(([n]) => [n, new Map()]), ['Outros materiais', new Map()]]);
  for (const c of list) {
    const { moments } = mergeMoments((c.roteiro || {}).cenas, (c.roteiro || {}).textoNaTela);
    for (const item of captureItems(moments)) groups.get(catOf(item)).set(norm(item).replace(/\([^)]*\)/g, '').replace(/[^\w ]/g, '').trim(), item);
  }
  return [...groups.entries()].map(([name, map]) => [name, [...map.values()]]).filter(([, items]) => items.length);
}

// ---------- operacional: dados informados x pendencias ----------
function operational(c, meta) {
  const r = c.roteiro || {};
  const kind = creativeKind(c.formato);
  const isVideo = /v[ií]deo|reels/i.test(kind) && !/imagem ou/i.test(kind);
  const rows = [
    ['Tipo', kind, true], ['Formato', c.formato, true],
    ['Duração', isVideo ? parseDuration(c.formato, r.titulo) : 'Não se aplica', isVideo],
    ['Proporção', /vertical/i.test(r.completo || '') ? 'Vertical' : '', true],
    ['Destino', meta.destino, true], ['Prioridade', meta.prioridade, true],
    ['Prazo', meta.prazo, true], ['Responsável', meta.responsavelCriacao, true],
  ];
  return rows.map(([label, value, needed]) => ({ label, value: value || '', pending: needed && !value }));
}

const cell = (o) => `<div class="kv ${o.pending ? 'pend' : ''}"><span>${esc(o.label)}</span><b>${o.value ? esc(o.value) : `⚠ ${NI}`}</b></div>`;
const list = (items, cls = '') => `<ul class="${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
const checks = (items, cls = 'checks') => `<ul class="${cls}">${items.map((i) => `<li><i></i>${esc(i)}</li>`).join('')}</ul>`;

function summary(c) {
  const r = c.roteiro || {};
  const sents = sentences(clean(r.completo));
  return sents.slice(0, 2).join(' ') || clean(c.ideiaCentral);
}

function momentHtml(m, isCard) {
  const head = isCard ? esc(m.label) : esc(m.tempo || `Cena ${m.n}`);
  const lines = [
    m.imagem && `<div><em>${isCard ? 'Imagem' : 'Cena'}</em>${esc(m.imagem)}</div>`,
    m.fala && `<div><em>Fala</em>${esc(m.fala.replace(/^"|"$/g, ''))}</div>`,
    m.texto && `<div><em>${isCard ? 'Texto' : 'Texto na tela'}</em>${esc(m.texto)}</div>`,
  ].filter(Boolean).join('');
  return `<div class="moment"><div class="when">${head}</div><div class="what">${lines}</div></div>`;
}

function referencesHtml(c) {
  const det = c.referenciasDetalhe || [];
  const names = c.referencias || [];
  if (!det.length && !names.length) return '<p class="pend-line">⚠ Nenhuma referência vinculada</p>';
  const items = (det.length ? det : names.map((nome) => ({ nome }))).map((r) => `<div class="ref"><b>${esc(r.nome)}</b>${r.observar ? `<span>O que observar: ${esc(r.observar)}</span>` : ''}${r.link ? `<span class="link">${esc(r.link)}</span>` : ''}</div>`).join('');
  return `${items}<p class="note">Não copiar: texto, identidade visual ou composição.</p>`;
}

function creativePage(c, idx, specificObs, meta, dateGen) {
  const r = c.roteiro || {};
  const s = scriptSections(c);
  const { moments, extras, loose, isCard } = mergeMoments(r.cenas, r.textoNaTela);
  const kind = creativeKind(c.formato);
  const noScenes = !moments.length;
  const capItems = captureItems(moments);
  const capTitle = /v[ií]deo|reels/i.test(kind) && !/imagem ou/i.test(kind) ? 'Captação necessária' : 'Materiais necessários';
  const ops = operational(c, meta);
  const pend = ops.filter((o) => o.pending).map((o) => o.label);
  const control = [
    ['Versão', r.versao ? `V${r.versao}` : '', false], ['Data', dateGen, false], ['Última alteração', c.data ? dateBr(c.data) : '', false],
    ['Responsável pela criação', meta.responsavelCriacao, true], ['Aprovação interna', meta.aprovInterna, true], ['Aprovação cliente', meta.aprovCliente, true],
  ].map(([label, value, needed]) => ({ label, value, pending: needed && !value }));
  const altHook = c.hook && clean(c.hook) !== clean(s.hook) ? clean(c.hook) : '';
  return `<section class="creative">
    <div class="top"><span class="num">Criativo ${String(idx + 1).padStart(2, '0')}</span><span class="who">${esc(c.clienteNome || '')} · ${esc(kind || 'Formato não informado')}</span></div>
    <h2>${esc(clean(r.titulo) || c.nome)}</h2>
    <div class="hook"><span>Hook principal</span><p>“${esc(clean(s.hook).replace(/^["“]|["”]$/g, ''))}”</p>${altHook ? `<small>Hook do conceito: ${esc(altHook)}</small>` : ''}</div>
    <div class="grid8">${ops.map(cell).join('')}</div>
    ${pend.length ? `<p class="pend-line">⚠ Pendências: ${esc(pend.join(', '))}</p>` : ''}
    <div class="todo"><h3>O que precisa ser feito</h3><p>${esc(summary(c))}</p></div>
    <div class="two"><div><h4>Objetivo</h4><p>${esc(clean(c.ideiaCentral) || NI)}</p></div><div><h4>Ângulo</h4><p>${esc(clean(c.angulo) || NI)}</p></div></div>
    ${capItems.length ? `<div class="cap"><h3>${capTitle}</h3>${checks(capItems, 'checks cols')}</div>` : ''}
    <div class="script"><h3>Roteiro</h3>${noScenes ? `<p>${esc(clean(r.cenas) || NI)}</p>` : moments.map((m) => momentHtml(m, isCard)).join('')}
      ${[...extras, ...loose].length ? `<p class="note">${esc([...extras, ...loose].join(' · '))}</p>` : ''}</div>
    <div class="cols2"><div class="cta"><h3>CTA</h3><p>${esc(clean(s.cta) || NI)}</p></div>
      <div class="obs"><h3>Observações específicas</h3>${specificObs.length ? list(specificObs) : '<p class="note">Sem observações específicas além das regras gerais.</p>'}</div></div>
    <div class="refs"><h3>Referência visual</h3>${referencesHtml(c)}</div>
    <div class="foot"><div class="ctrl"><h4>Controle</h4><div class="grid3">${control.map(cell).join('')}</div></div>
      <div class="chk"><h4>Checklist</h4>${checks(['Material disponível/autorizado', 'Texto revisado', 'Informações conferidas', 'Compliance conferido', 'Revisão interna', 'Cliente aprovou'], 'checks cols2')}</div></div>
  </section>`;
}

function indexHtml(list, meta) {
  const rows = list.map((c, i) => `<tr><td>${String(i + 1).padStart(2, '0')}</td><td>${esc(clean((c.roteiro || {}).titulo) || c.nome)}</td><td>${esc(creativeKind(c.formato) || NI)}</td><td>${esc(meta.destino || '—')}</td><td>${esc(meta.prioridade || '—')}</td><td>Briefing</td></tr>`).join('');
  return `<section class="index"><h3>Plano de criativos</h3><table><thead><tr><th>#</th><th>Criativo</th><th>Tipo</th><th>Destino</th><th>Prioridade</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function coverHtml(list, meta, general, dateGen) {
  const client = list[0].clienteNome || 'Cliente';
  const kv = (l, v) => `<div class="kv ${v ? '' : 'pend'}"><span>${esc(l)}</span><b>${v ? esc(v) : `⚠ ${NI}`}</b></div>`;
  return `<section class="cover">
    <div class="brand">The Mídia</div><h1>Solicitações de criativos</h1>
    <div class="grid3 coverkv">${kv('Cliente', client)}${kv('Campanha/período', meta.campanha)}${kv('Data de geração', dateGen)}${kv('Quantidade de criativos', String(list.length))}
      ${kv('Responsável pela estratégia', meta.responsavelEstrategia)}${kv('Aprovação interna', meta.aprovInterna)}${kv('Aprovação do cliente', meta.aprovCliente)}</div>
    ${list.length > 5 ? indexHtml(list, meta) : ''}
    <section class="rules"><h3>Regras gerais</h3>${list_(BASE_RULES)}${general.length ? `<h4>Específicas deste cliente</h4>${list_(general)}` : ''}
      <p class="note">Estas regras valem para todos os criativos deste documento e não se repetem nas fichas.</p></section>
  </section>`;
}
const list_ = (items) => list(items, 'rules-list');

function capturePlan(list) {
  const groups = consolidateCapture(list);
  if (!groups.length) return '';
  return `<section class="creative plan"><div class="top"><span class="num">Plano de captação</span><span class="who">${esc(list[0].clienteNome || '')}</span></div>
    <h2>Tudo que precisa ser captado, em uma diária</h2>
    <p class="note">Itens consolidados e sem duplicidade das fichas, agrupados por tipo. Confira com cada ficha antes de gravar.</p>
    <div class="plan-grid">${groups.map(([name, items]) => `<div class="plan-box"><h3>${esc(name)}</h3>${checks(items)}</div>`).join('')}</div></section>`;
}

const CSS = `
@page{size:A4;margin:11mm 13mm}
*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:9pt;line-height:1.32;color:#1b1f1d;margin:0}
h1{font-size:25pt;margin:6px 0 14px;letter-spacing:-.02em}h2{font-size:15.5pt;line-height:1.15;margin:2px 0 6px;letter-spacing:-.01em}
h3{font-size:8.4pt;letter-spacing:.09em;text-transform:uppercase;color:#0f6b5a;margin:0 0 4px}h4{font-size:8pt;letter-spacing:.08em;text-transform:uppercase;color:#6a7873;margin:0 0 3px}
p{margin:2px 0}ul{margin:0;padding:0;list-style:none}li{margin:2px 0}
@media screen{body{width:184mm;margin:0 auto}}
.t1{zoom:.95}.t2{zoom:.9}.t3{zoom:.85}.t4{zoom:.8}
.cover,.creative{break-after:page}.cover:last-child,.creative:last-child{break-after:auto}
.brand{font-size:9pt;letter-spacing:.14em;text-transform:uppercase;color:#0f6b5a;font-weight:700;border-bottom:2px solid #0f6b5a;padding-bottom:5px}
.top{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #d7dfdb;padding-bottom:4px;margin-bottom:6px;font-size:8.6pt;letter-spacing:.08em;text-transform:uppercase}
.num{color:#0f6b5a;font-weight:700}.who{color:#6a7873}
.kv{background:#f4f7f5;border-radius:5px;padding:4px 7px;min-width:0}.kv span{display:block;font-size:7pt;letter-spacing:.07em;text-transform:uppercase;color:#6a7873}.kv b{display:block;font-size:9pt;font-weight:600;word-break:break-word}
.kv.pend{background:#fff6e3}.kv.pend b{color:#8a5a00;font-weight:500}
.grid8{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:5px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
.coverkv{margin:12px 0 16px}
.pend-line{color:#8a5a00;font-size:8.6pt;margin:3px 0 6px}
.hook{background:#0f2f2a;color:#fff;border-radius:8px;padding:7px 12px;margin:0 0 6px}.hook span{font-size:7.4pt;letter-spacing:.12em;text-transform:uppercase;color:#7fe0c3}.hook p{font-size:13.5pt;line-height:1.22;font-weight:700;margin:3px 0 0}.hook small{display:block;margin-top:4px;color:#b9d8cf;font-size:8pt}
.todo{border-left:3px solid #0f6b5a;padding:1px 0 1px 10px;margin:4px 0 6px}.todo p{font-size:9.6pt}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:6px}.two p{font-size:8.6pt}
.cap{background:#f4f7f5;border-radius:7px;padding:6px 10px;margin-bottom:6px;break-inside:avoid}
.checks li{display:flex;gap:6px;align-items:flex-start}.checks i{flex:0 0 9px;height:9px;border:1.2px solid #55645f;border-radius:2px;margin-top:3px}
.cols{columns:2;column-gap:14px}.cols li{break-inside:avoid}
.script{margin-bottom:6px}.moment{display:grid;grid-template-columns:58px 1fr;gap:8px;border-top:1px solid #e3e9e6;padding:3px 0}.moment:first-of-type{border-top:0}
.when{font-weight:700;color:#0f6b5a;font-size:9.2pt}.what div{margin:1px 0}.what em{display:inline-block;min-width:98px;font-style:normal;font-size:7.4pt;letter-spacing:.07em;text-transform:uppercase;color:#6a7873}
.cols2{display:grid;grid-template-columns:1fr 1.5fr;gap:12px;margin-bottom:6px}.cta p{font-size:11pt;font-weight:700}
.obs ul li{padding-left:10px;position:relative}.obs ul li:before{content:'•';position:absolute;left:0;color:#8a5a00}
.refs{margin-bottom:5px}.ref{margin:2px 0}.ref b{margin-right:6px}.ref span{display:block;color:#3c4a45;font-size:8.8pt}.ref .link{color:#0f6b5a;word-break:break-all;font-size:8pt}
.note{color:#6a7873;font-size:8.4pt}
.foot{display:grid;grid-template-columns:1.25fr 1fr;gap:12px;border-top:1px solid #d7dfdb;padding-top:5px;margin-top:4px;break-inside:avoid}.foot .kv{padding:3px 6px}.foot .checks.cols2{columns:2;column-gap:10px;font-size:8.4pt}
.rules{margin-top:14px}.rules-list li{padding-left:12px;position:relative;margin:3px 0}.rules-list li:before{content:'•';position:absolute;left:0;color:#0f6b5a}
.index{margin-top:6px}.index table{width:100%;border-collapse:collapse;font-size:8.8pt}.index th{text-align:left;font-size:7.4pt;letter-spacing:.07em;text-transform:uppercase;color:#6a7873;border-bottom:1px solid #cfd8d4;padding:3px 4px}.index td{padding:3px 4px;border-bottom:1px solid #eef2f0}
.plan-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}.plan-box{background:#f4f7f5;border-radius:7px;padding:8px 10px;break-inside:avoid}
`;

// Ajusta cada ficha para caber em uma pagina A4 (altura util ~275mm): reduz a escala aos poucos, sem cortar conteudo.
const FIT = `(function(){var H=Math.floor(275/25.4*96)-14;document.querySelectorAll('.creative').forEach(function(s){var lv=0;while(s.scrollHeight>H&&lv<4){lv++;s.className=s.className.replace(/\\bt\\d\\b/g,'')+' t'+lv;}});})();`;

const BLANK_META = { campanha: '', prazo: '', responsavelCriacao: '', prioridade: '', destino: '', responsavelEstrategia: '', aprovInterna: '', aprovCliente: '', incluirCaptacao: true };

export function creativeRequestHtml(concepts, title = 'Solicitações de criativos', metaIn = {}, now = new Date()) {
  const meta = { ...BLANK_META, ...metaIn };
  const dateGen = dateBr(now.toISOString().slice(0, 10));
  const byClient = new Map();
  concepts.forEach((c) => byClient.set(c.clienteNome || '', [...(byClient.get(c.clienteNome || '') || []), c]));
  const docs = [...byClient.values()].map((list) => {
    const { general, specific } = splitObservations(list);
    return `${coverHtml(list, meta, general, dateGen)}${list.map((c, i) => creativePage(c, i, specific[i], meta, dateGen)).join('')}${meta.incluirCaptacao ? capturePlan(list) : ''}`;
  });
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${docs.join('')}<script>${FIT}</script></body></html>`;
}
