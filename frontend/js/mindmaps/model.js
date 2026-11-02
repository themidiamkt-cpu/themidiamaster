export const palette = ['#6366f1', '#0d9488', '#db2777', '#d97706', '#2563eb'];
export function newMap() {
  return { title: 'Novo mapa mental', connections: [], nodes: [{ id: crypto.randomUUID(), parent: null, text: 'Ideia central', color: palette[0], notes: '', collapsed: false }] };
}
export function validateMap(map) {
  if (!map || typeof map.title !== 'string' || !map.title.trim() || map.title.length > 160 || !Array.isArray(map.nodes) || !map.nodes.length || map.nodes.length > 300) throw Error('Use um título e entre 1 e 300 tópicos.');
  const ids = new Set(map.nodes.map(n => n.id));
  if (ids.size !== map.nodes.length || map.nodes.filter(n => n.parent === null).length !== 1) throw Error('Estrutura de mapa inválida.');
  const byId = new Map(map.nodes.map(n => [n.id, n]));
  for (const n of map.nodes) {
    if (typeof n.id !== 'string' || !n.id || typeof n.text !== 'string' || !n.text.trim() || n.text.length > 500 || typeof n.notes !== 'string' || n.notes.length > 10000 || !/^#[0-9a-f]{6}$/i.test(n.color) || typeof n.collapsed !== 'boolean') throw Error('Tópico inválido.');
    const seen = new Set([n.id]); let parent = n.parent;
    while (parent !== null) {
      if (!ids.has(parent) || seen.has(parent)) throw Error('Não é possível criar ciclos ou tópicos sem pai.');
      seen.add(parent); parent = byId.get(parent).parent;
    }
  }
  for (const n of map.nodes) if (n.position !== undefined && (!Number.isFinite(n.position?.x) || !Number.isFinite(n.position?.y) || n.position.x < 0 || n.position.y < 0 || n.position.x > 10000 || n.position.y > 10000)) throw Error('Posição inválida.');
  if (map.connections !== undefined && (!Array.isArray(map.connections) || map.connections.length > 600)) throw Error('Conexões inválidas.');
  const pairs = new Set();
  for (const c of map.connections || []) {
    const key = JSON.stringify([c.from, c.to].sort());
    if (!ids.has(c.from) || !ids.has(c.to) || c.from === c.to || pairs.has(key)) throw Error('Conexão inválida ou repetida.');
    pairs.add(key);
  }
  return map;
}
export function descendants(nodes, id) {
  const result = new Set([id]);
  for (let changed = true; changed;) { changed = false; for (const n of nodes) if (result.has(n.parent) && !result.has(n.id)) { result.add(n.id); changed = true; } }
  return result;
}
export function reparent(map, id, parent) {
  const node = map.nodes.find(n => n.id === id);
  if (!node || node.parent === null || descendants(map.nodes, id).has(parent) || !map.nodes.some(n => n.id === parent)) throw Error('Escolha um tópico de outro ramo.');
  node.parent = parent; return validateMap(map);
}
export function layout(map) {
  let row = 0; const positions = [];
  function visit(node, depth) {
    const children = node.collapsed ? [] : map.nodes.filter(n => n.parent === node.id);
    const childPositions = children.map(n => visit(n, depth + 1));
    const y = children.length ? (childPositions[0].y + childPositions.at(-1).y) / 2 : 70 + row++ * 90;
    const p = { ...node, x: node.position?.x ?? 50 + depth * 280, y: node.position?.y ?? y }; positions.push(p); return p;
  }
  visit(map.nodes.find(n => n.parent === null), 0);
  return { positions, width: Math.max(...positions.map(n => n.x)) + 280, height: Math.max(400, ...positions.map(n => n.y + 120)) };
}

export function connectTopics(map, from, to) {
  const connection = { from, to };
  const next = { ...map, connections: [...(map.connections || []), connection] };
  validateMap(next); map.connections = next.connections; return map;
}
export const templates = [
  { id: 'planejamento', title: 'Planejamento estratégico', description: 'Objetivos, público, ações e indicadores.', branches: [ ['Objetivos', 'Meta principal', 'Prazo', 'Responsável'], ['Público', 'Perfil ideal', 'Dores e desejos'], ['Plano de ação', 'Prioridades', 'Recursos', 'Cronograma'], ['Indicadores', 'Resultados esperados', 'Acompanhamento'] ] },
  { id: 'campanha', title: 'Campanha de marketing', description: 'Da oferta ao acompanhamento dos resultados.', branches: [ ['Oferta', 'Produto ou serviço', 'Diferencial', 'Condição comercial'], ['Público', 'Segmentos', 'Objeções'], ['Canais', 'Meta Ads', 'Google Ads', 'Orgânico'], ['Criativos', 'Mensagem', 'Formatos', 'Página de destino'], ['Medição', 'Conversões', 'Custo por resultado'] ] },
  { id: 'conteudo', title: 'Plano de conteúdo', description: 'Pilares, formatos e calendário editorial.', branches: [ ['Pilares', 'Educação', 'Autoridade', 'Prova social'], ['Formatos', 'Reels', 'Carrossel', 'Stories'], ['Calendário', 'Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'], ['Produção', 'Roteiro', 'Design', 'Revisão', 'Publicação'] ] },
  { id: 'projeto', title: 'Organização de projeto', description: 'Escopo, entregas, equipe e riscos.', branches: [ ['Escopo', 'Problema', 'Solução', 'Fora do escopo'], ['Entregas', 'Etapa 1', 'Etapa 2', 'Validação'], ['Equipe', 'Responsáveis', 'Aprovações'], ['Riscos', 'Dependências', 'Plano alternativo'] ] }
];
export function fromTemplate(id) {
  const t = templates.find(t => t.id === id); if (!t) throw Error('Modelo não encontrado.');
  const map = newMap(); map.title = t.title; const root = map.nodes[0]; root.text = t.title;
  t.branches.forEach(([text, ...children], i) => {
    const branch = { ...root, id: crypto.randomUUID(), parent: root.id, text, color: palette[i % palette.length] }; map.nodes.push(branch);
    children.forEach(text => map.nodes.push({ ...branch, id: crypto.randomUUID(), parent: branch.id, text }));
  }); return validateMap(map);
}
