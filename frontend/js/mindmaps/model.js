export const palette = ['#6366f1', '#0d9488', '#db2777', '#d97706', '#2563eb'];
export function newMap() {
  return { title: 'Novo mapa mental', nodes: [{ id: crypto.randomUUID(), parent: null, text: 'Ideia central', color: palette[0], notes: '', collapsed: false }] };
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
    const p = { ...node, x: 50 + depth * 280, y }; positions.push(p); return p;
  }
  visit(map.nodes.find(n => n.parent === null), 0);
  return { positions, width: Math.max(...positions.map(n => n.x)) + 280, height: Math.max(400, row * 90 + 100) };
}
