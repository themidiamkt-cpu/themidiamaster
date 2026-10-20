import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCreativeData } from '../frontend/js/creative/model.js';
import { buildConceptRequest, buildResearchRequest } from '../frontend/js/creative/request.js';
import { formatCategory, mdBlocks, mdInline, scriptToPlainText } from '../frontend/js/creative/format.js';
import { filterReferences } from '../frontend/js/creative/components.js';

const clientes = [
  { id: 'c-zin', nome_empresa: 'Zin Bar', status: 'ativo' },
  { id: 'c-nv', nome_empresa: 'NV Store', status: 'ativo' },
  { id: 'c-old', nome_empresa: 'Lotus', status: 'cancelado' },
];
const rows = {
  nichos: [
    { id: 'n-rest', slug: 'restaurantes', nome: 'Restaurantes', publico: 'B2C', status: 'ativo', resumo: 'r', updated_at: '2026-10-05T10:00:00Z',
      padroes: [{ titulo: 'Experiência no local', anunciantes: 4, descricao: 'detalhe', referencias: ['OUE Sushi'] }],
      recorrencias: [{ titulo: 'Aniversário', anunciantes: null, descricao: '2 registrados', referencias: [] }],
      pouco_explorado: [{ titulo: 'Casal' }], ideias_explorar: [], restricoes: [{ titulo: 'Sem promessa', descricao: 'regra' }] },
    { id: 'n-vazio', slug: 'vazio', nome: 'Vazio', publico: null, status: 'aguardando-cliente', resumo: null, updated_at: '2026-10-05T10:00:00Z', padroes: [], recorrencias: [], pouco_explorado: [], ideias_explorar: [], restricoes: [] },
  ],
  pesquisas: [
    { id: 'p1', cliente_id: 'c-zin', nicho_id: 'n-rest', titulo: 'Primeira coleta', objetivo: 'o', dor_tema: null, fonte: 'meta-ads-library', consultas: [{ termo: 'happy hour', cartoes_lidos: 58 }], territorios: [{ id: 'A', nome: 'Almoço' }], cartoes_observados: 414, anunciantes_observados: 310, candidatos: 18, referencias_salvas: 12, resumo: 'x', status: 'concluida', executado_em: '2026-10-05T03:00:00+00:00', chave: 'k' },
    { id: 'p0', cliente_id: null, nicho_id: 'n-rest', titulo: 'Mercado sem cliente', objetivo: null, fonte: 'meta-ads-library', consultas: null, territorios: null, status: 'em_andamento', executado_em: '2026-09-01T03:00:00+00:00' },
  ],
  referencias: [
    { id: 'r1', pesquisa_id: 'p1', cliente_id: 'c-zin', nicho_id: 'n-rest', fonte: 'meta-ads-library', id_externo: '1', url: 'https://www.facebook.com/ads/library/?id=1', destino_url: 'javascript:alert(1)', anunciante: 'OUE Sushi', formato: 'imagem (cartaz)', hook: 'Hook', angulo: 'ang', oferta: null, cta: 'cta', ativo_desde: '2026-03-11', consultado_em: '2026-10-05', motivo_salvo: ['hook-forte'], fatos: ['fato **um**'], observacoes: [], sinais: ['sinal'], hipoteses: ['h'], transcricao: null, plataformas: null, variacoes_observadas: '6' },
    { id: 'r2', pesquisa_id: null, cliente_id: null, nicho_id: 'n-rest', fonte: 'instagram', id_externo: null, url: null, anunciante: 'Beta', formato: 'vídeo 0:37', hook: null, motivo_salvo: [], fatos: [], observacoes: [], sinais: [], hipoteses: [] },
  ],
  conceitos: [
    { id: 'k1', cliente_id: 'c-zin', nicho_id: 'n-rest', nome: 'Zin - noite com nome', status: 'roteirizado', posicionamento: 'diferenciacao', angulo: 'a', hook: 'h', dor_desejo: 'd', ideia_central: 'i', formato: 'vídeo', observacoes: 'obs', updated_at: '2026-10-06T10:00:00Z' },
    { id: 'k2', cliente_id: 'c-zin', nicho_id: 'n-rest', nome: 'Zin - sem roteiro', status: 'ideia', updated_at: '2026-10-06T10:00:00Z' },
  ],
  conceitoReferencias: [{ conceito_id: 'k1', referencia_id: 'r1' }, { conceito_id: 'k1', referencia_id: 'ghost' }],
  roteiros: [
    { id: 'ro1', conceito_id: 'k1', versao: 1, hook: 'antigo', roteiro: 'v1', updated_at: '2026-10-06T10:00:00Z' },
    { id: 'ro2', conceito_id: 'k1', versao: 2, hook: 'Você já saiu?', roteiro: 'Abertura rápida.', cenas: '1. Mesa', texto_tela: 'NOITE', cta: 'Reserve', updated_at: '2026-10-07T10:00:00Z' },
  ],
};
const data = normalizeCreativeData(rows, clientes);

test('contagens vem dos dados e clientes cancelados nao aparecem', () => {
  assert.deepEqual(data.counts, { referencias: 2, nichos: 2, conceitos: 2, roteiros: 1, pesquisas: 2 });
  assert.deepEqual(data.clients.map((c) => c.nome).sort(), ['NV Store', 'Zin Bar']);
});

test('nicho do cliente e derivado dos dados e cliente sem dados fica vazio (sem inventar)', () => {
  const zin = data.clients.find((c) => c.id === 'c-zin');
  assert.equal(zin.nicho, 'Restaurantes');
  assert.equal(zin.ultimaPesquisa.titulo, 'Primeira coleta');
  assert.deepEqual(zin.counts, { referencias: 1, pesquisas: 1, conceitos: 2, roteiros: 1 });
  const nv = data.clients.find((c) => c.id === 'c-nv');
  assert.equal(nv.nicho, '');
  assert.deepEqual(nv.counts, { referencias: 0, pesquisas: 0, conceitos: 0, roteiros: 0 });
  assert.equal(data.clients[0].id, 'c-zin', 'clientes com dados vem primeiro');
});

test('inteligencia do nicho: jsonb vira itens da interface', () => {
  const n = data.niches.find((x) => x.nome === 'Restaurantes');
  assert.deepEqual(n.padroes[0], { title: 'Experiência no local', detail: 'detalhe', count: 4, links: ['OUE Sushi'] });
  assert.equal(n.recorrencias[0].count, null);
  assert.equal(n.poucoExplorado[0].title, 'Casal');
  assert.equal(n.restricoes[0].detail, 'regra');
  assert.equal(n.referencias, 2);
  assert.equal(n.pesquisas, 2);
  assert.deepEqual(n.clientes.map((c) => c.nome), ['Zin Bar']);
  assert.equal(data.niches.find((x) => x.nome === 'Vazio').padroes.length, 0);
});

test('referencia: campos vazios somem, url insegura e descartada, secoes viram markdown', () => {
  const r = data.references.find((x) => x.id === 'r1');
  assert.equal(r.oferta, '');
  assert.equal(r.destinoUrl, '');
  assert.equal(r.fonteLabel, 'Meta Ads Library');
  assert.equal(r.formatoCategoria, 'Imagem');
  assert.equal(r.secoes.fatos, '- fato **um**');
  assert.equal(r.secoes.observacoes, '');
  assert.deepEqual(r.clientes, [{ id: 'c-zin', nome: 'Zin Bar' }]);
  const b = data.references.find((x) => x.id === 'r2');
  assert.equal(b.url, '');
  assert.equal(b.fonteLabel, 'Instagram');
  assert.deepEqual(b.motivos, []);
});

test('marcadores internos de ausencia de dado ficam legiveis', () => {
  const rr = { ...rows, referencias: [{ ...rows.referencias[0], cta: 'nao-lido', oferta: 'nao-identificado', angulo: 'nao-lido (cartão agrupado); texto traz horário', fatos: ['Região: nao-identificado.'] }] };
  const out = normalizeCreativeData(rr, clientes).references[0];
  assert.equal(out.cta, '');
  assert.equal(out.oferta, '');
  assert.equal(out.angulo, 'não lido (cartão agrupado); texto traz horário');
  assert.equal(out.secoes.fatos, '- Região: não identificado.');
});

test('pesquisas: mais recente primeiro; listas nulas viram vazias', () => {
  assert.deepEqual(data.pesquisas.map((p) => p.id), ['p1', 'p0']);
  assert.deepEqual(data.pesquisas[1].consultas, []);
  assert.equal(data.pesquisas[0].cartoes, 414);
  assert.equal(data.pesquisas[1].cliente, null);
});

test('conceito e roteiro: usa a ultima versao, ignora referencia inexistente, so conta quem tem roteiro', () => {
  const k1 = data.concepts.find((c) => c.id === 'k1');
  assert.equal(k1.hasRoteiro, true);
  assert.equal(k1.roteiro.versao, 2);
  assert.equal(k1.roteiro.hook, 'Você já saiu?');
  assert.deepEqual(k1.referencias, ['OUE Sushi']);
  assert.equal(k1.data, '2026-10-07');
  assert.equal(data.concepts.find((c) => c.id === 'k2').hasRoteiro, false);
  const text = scriptToPlainText(k1);
  assert.match(text, /HOOK\nVocê já saiu\?/);
  assert.match(text, /CENAS\n1\. Mesa/);
  assert.match(text, /TEXTO NA TELA\nNOITE/);
  assert.match(text, /REFERÊNCIAS UTILIZADAS\nOUE Sushi/);
});

test('filtros de referencia: cliente, formato e busca de texto', () => {
  const f = (over) => filterReferences(data.references, { q: '', cliente: 'all', nicho: 'all', angulo: 'all', formato: 'all', anunciante: 'all', ...over }, data.clients).map((r) => r.id);
  assert.deepEqual(f({}), ['r1', 'r2']);
  assert.deepEqual(f({ cliente: 'c-zin' }), ['r1']);
  assert.deepEqual(f({ formato: 'Vídeo' }), ['r2']);
  assert.deepEqual(f({ q: 'hook forte' }), ['r1']);
  assert.deepEqual(f({ q: 'nada disso' }), []);
});

test('pedido de pesquisa: valida, estrutura e bloqueia fonte indisponivel', () => {
  const client = { id: 'c-zin', nome: 'Zin Bar' };
  const ok = buildResearchRequest({ client, niche: 'Restaurantes', objective: 'almoço durante a semana', now: new Date('2026-10-05T12:00:00Z') });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.request.cliente, { id: 'c-zin', nome: 'Zin Bar' });
  assert.equal(ok.request.status, 'preparado');
  assert.deepEqual(ok.request.motor.memoria, ['supabase', 'obsidian']);
  assert.match(ok.prompt, /para Zin Bar, nicho Restaurantes/);
  assert.match(ok.prompt, /Supabase e no Obsidian/);
  assert.equal(buildResearchRequest({ niche: 'R', objective: 'o' }).request.cliente, null);
  assert.equal(buildResearchRequest({ client }).errors.length, 2);
  assert.match(buildResearchRequest({ client, niche: 'R', objective: 'o', source: 'tiktok' }).errors[0], /ainda não está disponível/);
});

test('pedidos de conceito/roteiro so preparam, nao executam', () => {
  const client = { id: 'c-zin', nome: 'Zin Bar' };
  assert.equal(buildConceptRequest({ action: 'criar-conceitos' }).ok, false);
  const c = buildConceptRequest({ action: 'criar-conceitos', client, niche: 'Restaurantes', quantity: 10 });
  assert.equal(c.request.skill, 'ci-conceitos');
  assert.equal(c.request.quantidade, 10);
  const r = buildConceptRequest({ action: 'criar-roteiro', concept: { nome: 'Zin - noite', cliente: 'c-zin', clienteNome: 'Zin Bar' } });
  assert.equal(r.request.skill, 'ci-roteiros');
  assert.equal(r.request.status, 'preparado');
});

test('formatadores escapam HTML', () => {
  assert.equal(mdInline('<b>x</b> **ok** [[A|Alfa]]'), '&lt;b&gt;x&lt;/b&gt; <strong>ok</strong> Alfa');
  assert.ok(!mdBlocks('texto <img src=x onerror=1>').includes('<img'));
  assert.equal(formatCategory('imagem estática'), 'Imagem');
  assert.equal(formatCategory(''), '');
});

test('filtros de pesquisas e conceitos: cliente, nicho, status e formato', async () => {
  const { filterConcepts, filterPesquisas } = await import('../frontend/js/creative/components.js');
  const all = { cliente: 'all', nicho: 'all', status: 'all', formato: 'all' };
  const concepts = [
    { cliente: 'a', nicho: 'Restaurantes', status: 'roteirizado', formato: 'vídeo 25s' },
    { cliente: 'a', nicho: 'Restaurantes', status: 'ideia', formato: 'carrossel' },
    { cliente: 'b', nicho: 'Clínicas', status: 'ideia', formato: 'imagem' },
  ];
  assert.equal(filterConcepts(concepts, all).length, 3);
  assert.equal(filterConcepts(concepts, { ...all, cliente: 'a' }).length, 2);
  assert.equal(filterConcepts(concepts, { ...all, nicho: 'Clínicas' }).length, 1);
  assert.equal(filterConcepts(concepts, { ...all, formato: 'Vídeo' }).length, 1);
  assert.equal(filterConcepts(concepts, { ...all, status: 'ideia' }).length, 2);
  const ps = [{ cliente: { id: 'a' }, nicho: 'X', status: 'concluida' }, { cliente: null, nicho: 'Y', status: 'erro' }];
  assert.equal(filterPesquisas(ps, { ...all, cliente: 'a' }).length, 1);
  assert.equal(filterPesquisas(ps, { ...all, status: 'erro' }).length, 1);
});

test('exportacao em .doc: escapa HTML, inclui observacoes e nome de arquivo', async () => {
  const { scriptsToWordHtml, wordFileName } = await import('../frontend/js/creative/format.js');
  const c = { nome: 'Zin Bar - A <b>teste</b>', clienteNome: 'Zin Bar', formato: 'vídeo 25s', hook: 'Oi & tchau',
    roteiro: { versao: 1, titulo: 'Título "X"', completo: 'Texto', hook: 'Oi & tchau', cenas: '1) cena\\n2) cena', textoNaTela: 'Tela 1', cta: 'Chame', observacoes: 'Confirmar frete' }, referencias: [] };
  const html = scriptsToWordHtml([c], 'Roteiros - Zin Bar');
  assert.ok(html.includes('Oi &amp; tchau') && html.includes('Antes de publicar') && html.includes('Confirmar frete'));
  assert.ok(!html.includes('<b>teste</b>'));
  assert.equal(wordFileName([c]), 'Zin-Bar-A-btesteb.doc');
  assert.equal(wordFileName([c, { ...c, nome: 'Outro' }]), 'Roteiros-Zin-Bar.doc');
});

test('briefing PDF: cena e texto na tela juntos por momento, captacao derivada das cenas', async () => {
  const { mergeMoments, captureItems, parseDuration, creativeKind } = await import('../frontend/js/creative/brief.js');
  const cenas = '1) 0-3s: prato do dia pronto na cozinha, close. Fala: "Oi"\n2) 3-9s: apresentadora na entrada; fachada. Fala: "Aqui"';
  const m = mergeMoments(cenas, 'Tela 1: A\nTela 2: B');
  assert.equal(m.moments.length, 2);
  assert.equal(m.moments[0].tempo, '0–3s');
  assert.equal(m.moments[0].fala, '"Oi"');
  assert.equal(m.moments[1].texto, 'B');
  assert.equal(m.loose.length, 0);
  assert.deepEqual(captureItems(m.moments), ['Prato do dia pronto na cozinha, close', 'Apresentadora na entrada', 'Fachada']);
  assert.equal(mergeMoments(cenas, 'Tela 1: A').loose.length, 1);
  assert.equal(parseDuration('vídeo 25s (Victoria)'), 'até 25s');
  assert.equal(parseDuration('carrossel'), '');
  assert.equal(creativeKind('Reels 20s'), 'Vídeo');
  const cards = mergeMoments('Card 1 (capa): foto real do salão. Título: "X"\nCard 2: trecho real', 'Card 1: O que dizem\nCard 2: "Y"');
  assert.equal(cards.isCard, true);
  assert.equal(cards.moments[0].texto, 'O que dizem');
});

test('briefing PDF: regras gerais nao se repetem, pendencias aparecem e nada e inventado', async () => {
  const { creativeRequestHtml, splitObservations, BASE_RULES } = await import('../frontend/js/creative/brief.js');
  const mk = (nome, obs) => ({ nome, clienteNome: 'Zin Bar', nicho: 'Restaurantes', formato: 'vídeo 20s', angulo: 'kids', ideiaCentral: 'Ideia', hook: 'Hook <x>', data: '2026-10-06',
    referencias: ['MaH'], referenciasDetalhe: [{ nome: 'MaH', observar: 'benefício ao adulto', link: 'https://ex.com/1' }],
    roteiro: { versao: 1, titulo: nome, completo: 'Vídeo vertical de 20s. Mostra o prato.', hook: 'Hook <x>', cenas: '1) 0-3s: prato; fachada. Fala: "Oi"', textoNaTela: 'Tela 1: A', cta: 'Reservar', observacoes: obs } });
  const common = 'Material real do Zin. Sem promessa de resultado. Estacionamento e kids confirmados em 06/10/2026.';
  const list = [mk('A', `${common} Trocar o prato do dia.`), mk('B', `${common} Sem drink em destaque.`), mk('C', common)];
  const { general, specific } = splitObservations(list);
  assert.deepEqual(general, ['Estacionamento e kids confirmados em 06/10/2026.']);
  assert.deepEqual(specific, [['Trocar o prato do dia.'], ['Sem drink em destaque.'], []]);
  const html = creativeRequestHtml(list, 'T', { prazo: '10/10', responsavelCriacao: 'Nicolas' }, new Date('2026-10-06T12:00:00Z'));
  assert.equal((html.match(/class="creative"/g) || []).length, 3);
  assert.ok(html.includes('Solicitações de criativos') && html.includes('Regras gerais') && html.includes(BASE_RULES[0].slice(0, 20)));
  assert.ok(html.includes('Hook principal') && html.includes('O que precisa ser feito') && html.includes('Captação necessária') && html.includes('Controle') && html.includes('Checklist'));
  assert.ok(html.includes('Hook &lt;x&gt;') && !html.includes('Hook <x>'));
  assert.ok(html.includes('⚠ Não informado'), 'campos sem dado viram pendencia');
  assert.ok(html.includes('Nicolas') && html.includes('10/10'));
  assert.ok(html.includes('Plano de captação'));
  assert.ok(!html.includes('Plano de criativos'), 'indice so com mais de 5 criativos');
  assert.ok(creativeRequestHtml(Array.from({ length: 6 }, (_, i) => mk(`N${i}`, '')), 'T').includes('Plano de criativos'));
  assert.ok(!creativeRequestHtml(list, 'T', { incluirCaptacao: false }).includes('Tudo que precisa ser captado'));
});
