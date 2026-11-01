import { newMap, validateMap, descendants, reparent, layout } from './model.js';
import { listMaps, loadMap, saveMap } from './service.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let owner, map, record, selected, saved = '', history = [], future = [], message = '', busy = false, generation = 0;
let zoom = 1, pending = false;
const dirty = () => pending || (map && JSON.stringify(map) !== saved);
const button = (action, label, disabled = false) => `<button type="button" class="secondary-button" data-mm="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;
export function resetMindmaps(userId) {
  if (owner === userId) return;
  owner = userId; pending = false; generation++; map = null; record = null; saved = ''; history = []; future = []; message = ''; busy = false;
}
window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
export function canLeaveMindmaps() { return !dirty() || window.confirm('Há alterações não salvas no mapa. Sair sem salvar?'); }
function mutate(fn) {
  const previous = structuredClone(map);
  try { fn(); validateMap(map); history.push(previous); if (history.length > 80) history.shift(); future = []; message = ''; }
  catch (error) { map = previous; message = error.message; }
}
function tree() {
  const { positions, width, height } = layout(map);
  const byId = new Map(positions.map(n => [n.id, n]));
  const paths = positions.filter(n => byId.has(n.parent)).map(n => { const p = byId.get(n.parent); return `<path d="M${p.x + 210},${p.y + 25} C${p.x + 245},${p.y + 25} ${n.x - 35},${n.y + 25} ${n.x},${n.y + 25}" stroke="${n.color}"/>`; }).join('');
  return `<div class="mm-scroll" tabindex="0" aria-label="Mapa mental. Tab cria subtópico; Enter cria irmão; F2 edita."><div class="mm-plane" style="width:${width * zoom}px;height:${height * zoom}px"><div class="mm-world" style="width:${width}px;height:${height}px;transform:scale(${zoom})"><svg width="${width}" height="${height}" aria-hidden="true">${paths}</svg>${positions.map(n => `<button type="button" class="mm-topic ${selected === n.id ? 'selected' : ''}" data-topic="${esc(n.id)}" style="left:${n.x}px;top:${n.y}px;--topic-color:${n.color}" aria-pressed="${selected === n.id}">${esc(n.text)}${n.collapsed ? '<small>Ramo recolhido</small>' : ''}</button>`).join('')}</div></div></div>`;
}
export function renderMindmaps() {
  if (!map) { map = newMap(); saved = JSON.stringify(map); }
  if (!selected || !map.nodes.some(n => n.id === selected)) selected = map.nodes[0].id;
  const node = map.nodes.find(n => n.id === selected);
  const excluded = descendants(map.nodes, selected);
  return `<section class="mm-module"><div class="page-header"><div><h1>Mapas mentais</h1><p>Transforme ideias em planos para a agência.</p></div><div class="mm-actions">${button('library', 'Meus mapas', busy)}${button('new', 'Novo mapa', busy)}<button class="button" data-mm="save" ${busy ? 'disabled' : ''}>${busy ? 'Aguarde…' : 'Salvar mapa'}</button></div></div>
    <div class="mm-notice" role="status">${esc(message || (dirty() ? 'Alterações não salvas' : (record ? 'Mapa salvo' : 'Rascunho — salve para guardar no Master.')))}</div>
    <div class="mm-top"><label>Nome do mapa<input id="mm-title" maxlength="160" value="${esc(map.title)}"></label><div class="mm-actions">${button('undo', 'Desfazer', !history.length)}${button('redo', 'Refazer', !future.length)}${button('export', 'Exportar JSON')}${button('import', 'Importar JSON', busy)}<input type="file" id="mm-file" accept=".json,application/json" hidden></div></div>
    <div class="mm-layout"><div><div class="mm-tools">${button('child', '+ Subtópico')}${button('sibling', '+ Irmão', node.parent === null)}${button('collapse', node.collapsed ? 'Expandir ramo' : 'Recolher ramo')}${button('minus', '−') }<span>${Math.round(zoom * 100)}%</span>${button('plus', '+')}${button('fit', 'Enquadrar')}</div>${tree()}<p class="muted">Clique para selecionar · Duplo clique para editar · Tab: subtópico · Enter: irmão · F2: editar</p></div>
    <aside class="mm-inspector"><h3>Tópico selecionado</h3><label>Texto<textarea id="mm-text" maxlength="500" rows="3">${esc(node.text)}</textarea></label><label>Cor<input type="color" id="mm-color" value="${node.color}"></label><label>Notas<textarea id="mm-notes" maxlength="10000" rows="5">${esc(node.notes)}</textarea></label>${node.parent !== null ? `<label>Mover para outro tópico<select id="mm-parent">${map.nodes.filter(n => !excluded.has(n.id)).map(n => `<option value="${esc(n.id)}" ${n.id === node.parent ? 'selected' : ''}>${esc(n.text)}</option>`).join('')}</select></label>${button('delete', 'Excluir tópico e descendentes')}` : '<p class="muted">Este é o tópico central do mapa.</p>'}</aside></div><div id="mm-library"></div></section>`;
}
export function bindMindmaps({ rerender }) {
  const root = document.querySelector('.mm-module'); if (!root) return;
  const refresh = () => { rerender(); };
  const focusTopic = () => document.querySelector(`[data-topic="${CSS.escape(selected)}"]`)?.focus();
  function edit(action) {
    mutate(() => {
      const node = map.nodes.find(n => n.id === selected);
      if (action === 'child' || action === 'sibling') {
        if (action === 'sibling' && node.parent === null) return;
        const id = crypto.randomUUID(); const parent = action === 'child' ? node.id : node.parent;
        map.nodes.find(n => n.id === parent).collapsed = false;
        map.nodes.push({ id, parent, text: 'Nova ideia', notes: '', color: node.color, collapsed: false }); selected = id;
      }
      if (action === 'collapse') node.collapsed = !node.collapsed;
      if (action === 'delete' && node.parent !== null) {
        const remove = descendants(map.nodes, selected); selected = node.parent; map.nodes = map.nodes.filter(n => !remove.has(n.id));
      }
    }); refresh(); focusTopic();
    if (action === 'child' || action === 'sibling') { document.querySelector('#mm-text')?.focus(); document.querySelector('#mm-text')?.select(); }
  }
  root.querySelectorAll('[data-topic]').forEach(el => {
    el.onclick = () => { selected = el.dataset.topic; refresh(); focusTopic(); };
    el.ondblclick = () => { document.querySelector('#mm-text')?.focus(); document.querySelector('#mm-text')?.select(); };
  });
  root.querySelectorAll('input:not([type=file]),textarea').forEach(el => el.addEventListener('input', () => { pending = true; root.querySelector('.mm-notice').textContent = 'Alterações não salvas'; }));
  function syncFields() {
    pending = false;
    const current = map.nodes.find(n => n.id === selected);
    const topic = root.querySelector(`[data-topic="${CSS.escape(selected)}"]`);
    if (topic) { topic.textContent = current.text; topic.style.setProperty('--topic-color', current.color); }
    root.querySelector('.mm-notice').textContent = message || 'Alterações não salvas';
    root.querySelector('[data-mm=undo]').disabled = !history.length;
    root.querySelector('[data-mm=redo]').disabled = !future.length;
  }
  for (const [id, field] of [['mm-text', 'text'], ['mm-color', 'color'], ['mm-notes', 'notes']]) root.querySelector(`#${id}`).onchange = event => { mutate(() => { map.nodes.find(n => n.id === selected)[field] = event.target.value; }); event.target.value = map.nodes.find(n => n.id === selected)[field]; syncFields(); };
  root.querySelector('#mm-title').onchange = event => { mutate(() => { map.title = event.target.value; }); event.target.value = map.title; syncFields(); };
  root.querySelector('#mm-parent')?.addEventListener('change', event => { mutate(() => reparent(map, selected, event.target.value)); refresh(); });
  root.querySelector('.mm-scroll').onkeydown = event => {
    if (!event.target.matches('[data-topic], .mm-scroll')) return;
    const action = { Tab: 'child', Enter: 'sibling', Delete: 'delete', Backspace: 'delete', ' ': 'collapse' }[event.key];
    if (action) { event.preventDefault(); edit(action); }
    if (event.key === 'F2') { event.preventDefault(); root.querySelector('#mm-text').focus(); }
  };
  root.querySelectorAll('[data-mm]').forEach(el => el.onclick = async () => {
    const action = el.dataset.mm;
    if (['child', 'sibling', 'collapse', 'delete'].includes(action)) return edit(action);
    if (action === 'undo' && history.length) { future.push(structuredClone(map)); map = history.pop(); }
    if (action === 'redo' && future.length) { history.push(structuredClone(map)); map = future.pop(); }
    if (action === 'new') { if (!canLeaveMindmaps()) return; map = newMap(); record = null; saved = JSON.stringify(map); pending = false; history = []; future = []; selected = null; message = ''; }
    if (action === 'plus') zoom = Math.min(2, zoom + .1);
    if (action === 'minus') zoom = Math.max(.2, zoom - .1);
    if (action === 'fit') { const l = layout(map); zoom = Math.max(.2, Math.min(1, root.querySelector('.mm-scroll').clientWidth / l.width)); }
    if (action === 'export') {
      const url = URL.createObjectURL(new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'mapa-mental.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return;
    }
    if (action === 'import') { root.querySelector('#mm-file').click(); return; }
    const token = generation;
    if (action === 'save') {
      if (busy) return; busy = true; const snapshot = structuredClone(map); refresh();
      try { const next = await saveMap(snapshot, record); if (token !== generation) return; record = next; saved = JSON.stringify(snapshot); message = dirty() ? 'Versão salva. Há novas alterações para salvar.' : 'Todas as alterações salvas.'; }
      catch (error) { if (token !== generation) return; message = ['42P01', 'PGRST205'].includes(error.code) ? 'O banco de mapas ainda precisa ser ativado. Exporte o JSON para guardar seu trabalho.' : error.message; }
      finally { if (token === generation) { busy = false; refresh(); } } return;
    }
    if (action === 'library') {
      if (busy) return;
      const panel = root.querySelector('#mm-library'); panel.innerHTML = '<p role="status">Carregando mapas…</p>';
      try {
        const rows = await listMaps(); if (token !== generation || !panel.isConnected) return;
        panel.innerHTML = `<section class="panel"><h3>Meus mapas</h3>${rows.length ? rows.map(r => `<button class="secondary-button" data-open-map="${esc(r.id)}">${esc(r.title)}</button>`).join(' ') : '<p>Nenhum mapa salvo ainda.</p>'}</section>`;
        panel.querySelectorAll('[data-open-map]').forEach(b => b.onclick = async () => {
          if (!canLeaveMindmaps() || busy) return; busy = true;
          try { const row = await loadMap(b.dataset.openMap); if (token !== generation) return; map = { title: row.title, nodes: row.document.nodes }; record = { id: row.id, revision: row.revision }; saved = JSON.stringify(map); selected = null; history = []; future = []; message = ''; }
          catch (error) { if (token === generation) message = error.message; }
          finally { if (token === generation) { busy = false; refresh(); } }
        });
      } catch (error) { panel.innerHTML = `<p role="alert">${esc(['42P01', 'PGRST205'].includes(error.code) ? 'O banco de mapas ainda precisa ser ativado.' : error.message)}</p>`; } return;
    }
    refresh();
  });
  root.querySelector('#mm-file').onchange = async event => {
    const file = event.target.files[0]; if (!file || !canLeaveMindmaps()) return;
    try { if (file.size > 2000000) throw Error('Escolha um JSON de até 2 MB.'); const imported = validateMap(JSON.parse(await file.text())); map = { title: imported.title, nodes: imported.nodes }; record = null; saved = ''; history = []; future = []; selected = null; message = 'Mapa importado. Salve para guardar no Master.'; }
    catch (error) { message = `Não foi possível importar: ${error.message}`; } refresh();
  };
}
