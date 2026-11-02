import { newMap, validateMap, descendants, reparent, layout, templates, fromTemplate, connectTopics } from './model.js';
import { listMaps, loadMap, saveMap } from './service.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let owner, map, record, selected, saved = '', history = [], future = [], message = '', busy = false, generation = 0;
let zoom = 1, pending = false, connecting = null, showTemplates = false, suppressClickUntil = 0;
const dirty = () => pending || (map && JSON.stringify(map) !== saved);
const button = (action, label, disabled = false) => `<button type="button" class="secondary-button" data-mm="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;
export function resetMindmaps(userId) {
  if (owner === userId) return;
  owner = userId; pending = false; connecting = null; showTemplates = false; generation++; map = null; record = null; saved = ''; history = []; future = []; message = ''; busy = false;
}
window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
export function canLeaveMindmaps() { return !dirty() || window.confirm('Há alterações não salvas no mapa. Sair sem salvar?'); }
function mutate(fn) {
  const previous = structuredClone(map);
  try { fn(); validateMap(map); history.push(previous); if (history.length > 80) history.shift(); future = []; message = ''; }
  catch (error) { map = previous; message = error.message; }
}
function connectionPaths(positions) {
  const byId = new Map(positions.map(n => [n.id, n]));
  const curve = (a, b) => {
    const forward = b.x >= a.x;
    const x1 = a.x + (forward ? 210 : 0), x2 = b.x + (forward ? 0 : 210);
    const bend = Math.max(50, Math.abs(x2 - x1) / 2) * (forward ? 1 : -1);
    return `M${x1},${a.y + 25} C${x1 + bend},${a.y + 25} ${x2 - bend},${b.y + 25} ${x2},${b.y + 25}`;
  };
  return positions.filter(n => byId.has(n.parent)).map(n => `<path d="${curve(byId.get(n.parent), n)}" stroke="${n.color}"/>`).join('') +
    (map.connections || []).filter(c => byId.has(c.from) && byId.has(c.to)).map(c => `<path class="mm-crosslink" d="${curve(byId.get(c.from), byId.get(c.to))}" stroke="#db2777" marker-end="url(#mm-arrow)"/>`).join('');
}
function tree() {
  const { positions, width: mapWidth, height: mapHeight } = layout(map);
  const width = Math.max(2400, mapWidth + 1200), height = Math.max(1800, mapHeight + 1200);
  return `<div class="mm-scroll ${connecting ? 'mm-connecting' : ''}" tabindex="0" aria-label="Mapa mental. Arraste os cards para organizar. Tab cria subtópico; Enter cria irmão; F2 edita."><div class="mm-plane" style="width:${width * zoom}px;height:${height * zoom}px"><div class="mm-world" style="width:${width}px;height:${height}px;transform:scale(${zoom})"><div class="mm-scene" style="position:absolute;transform:translate(600px,600px)"><svg width="${width}" height="${height}" aria-hidden="true"><defs><marker id="mm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#db2777" stroke="none"/></marker></defs><g class="mm-lines">${connectionPaths(positions)}</g></svg>${positions.map(n => `<button type="button" class="mm-topic ${selected === n.id ? 'selected' : ''}" data-topic="${esc(n.id)}" style="left:${n.x}px;top:${n.y}px;--topic-color:${n.color}" aria-pressed="${selected === n.id}">${esc(n.text)}${n.collapsed ? '<small>Ramo recolhido</small>' : ''}</button>`).join('')}</div></div></div></div>`;
}
export function renderMindmaps() {
  if (!map) { map = newMap(); saved = JSON.stringify(map); }
  if (!selected || !map.nodes.some(n => n.id === selected)) selected = map.nodes[0].id;
  const node = map.nodes.find(n => n.id === selected);
  const excluded = descendants(map.nodes, selected);
  return `<section class="mm-module"><div class="page-header"><div><h1>Mapas mentais</h1><p>Transforme ideias em planos para a agência.</p></div><div class="mm-actions">${button('library', 'Meus mapas', busy)}${button('templates', 'Modelos prontos', busy)}${button('new', 'Novo mapa', busy)}<button class="button" data-mm="save" ${busy ? 'disabled' : ''}>${busy ? 'Aguarde…' : 'Salvar mapa'}</button></div></div>
    <div class="mm-notice" role="status">${esc(message || (dirty() ? 'Alterações não salvas' : (record ? 'Mapa salvo' : 'Rascunho — salve para guardar no Master.')))}</div>
    ${showTemplates ? `<div class="mm-templates">${templates.map(t => `<button type="button" data-template="${t.id}"><strong>${esc(t.title)}</strong><span>${esc(t.description)}</span><small>Usar modelo →</small></button>`).join('')}</div>` : ''}
    <div class="mm-top"><label>Nome do mapa<input id="mm-title" maxlength="160" value="${esc(map.title)}"></label><div class="mm-actions">${button('undo', 'Desfazer', !history.length)}${button('redo', 'Refazer', !future.length)}${button('export', 'Exportar JSON')}${button('import', 'Importar JSON', busy)}<input type="file" id="mm-file" accept=".json,application/json" hidden></div></div>
    <div class="mm-layout"><div><div class="mm-tools">${button('child', '+ Subtópico')}${button('sibling', '+ Irmão', node.parent === null)}${button('collapse', node.collapsed ? 'Expandir ramo' : 'Recolher ramo')}${button('connect', connecting ? 'Cancelar conexão' : 'Interligar cards')}${button('arrange', 'Organizar automaticamente')}${button('minus', '−') }<span data-mm-zoom>${Math.round(zoom * 100)}%</span>${button('plus', '+')}${button('fit', 'Enquadrar')}</div>${tree()}<p class="muted">Arraste o fundo para navegar · Roda do mouse: zoom · Arraste os cards para organizar · Interligar cards: selecione a origem e clique no destino · Tab: subtópico · Enter: irmão</p></div>
    <aside class="mm-inspector"><h3>Tópico selecionado</h3><label>Texto<textarea id="mm-text" maxlength="500" rows="3">${esc(node.text)}</textarea></label><label>Cor<input type="color" id="mm-color" value="${node.color}"></label><label>Notas<textarea id="mm-notes" maxlength="10000" rows="5">${esc(node.notes)}</textarea></label>${node.parent !== null ? `<label>Mover para outro tópico<select id="mm-parent">${map.nodes.filter(n => !excluded.has(n.id)).map(n => `<option value="${esc(n.id)}" ${n.id === node.parent ? 'selected' : ''}>${esc(n.text)}</option>`).join('')}</select></label>${button('delete', 'Excluir tópico e descendentes')}` : '<p class="muted">Este é o tópico central do mapa.</p>'}<div class="mm-connections"><h3>Conexões extras</h3>${(map.connections || []).map((c, i) => [c, i]).filter(([c]) => c.from === selected || c.to === selected).map(([c, i]) => `<div><span>${esc(map.nodes.find(n => n.id === (c.from === selected ? c.to : c.from))?.text)}</span><button type="button" class="secondary-button" data-remove-link="${i}" aria-label="Remover conexão">×</button></div>`).join('') || '<p class="muted">Use Interligar cards para conectar este tópico a outro.</p>'}</div></aside></div><div id="mm-library"></div></section>`;
}
export function bindMindmaps({ rerender }) {
  const root = document.querySelector('.mm-module'); if (!root) return;
  const refresh = () => {
    const viewport = document.querySelector('.mm-scroll'); const position = viewport ? [viewport.scrollLeft, viewport.scrollTop] : [0, 0];
    rerender(); const next = document.querySelector('.mm-scroll'); if (next) { next.scrollLeft = position[0]; next.scrollTop = position[1]; }
  };
  root.querySelectorAll('[data-template]').forEach(el => el.onclick = () => {
    if (busy || !canLeaveMindmaps()) return;
    map = fromTemplate(el.dataset.template); record = null; saved = ''; pending = false; selected = null; history = []; future = []; connecting = null; showTemplates = false; zoom = .65; message = 'Modelo pronto para personalizar. Salve para guardar no Master.'; refresh(); const view = document.querySelector('.mm-scroll'); view.scrollLeft = 600 * zoom; view.scrollTop = 600 * zoom;
  });
  root.querySelectorAll('[data-remove-link]').forEach(el => el.onclick = () => { mutate(() => { map.connections.splice(Number(el.dataset.removeLink), 1); }); refresh(); });
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
        const remove = descendants(map.nodes, selected); selected = node.parent; map.nodes = map.nodes.filter(n => !remove.has(n.id)); map.connections = (map.connections || []).filter(c => !remove.has(c.from) && !remove.has(c.to));
      }
    }); refresh(); focusTopic();
    if (action === 'child' || action === 'sibling') { document.querySelector('#mm-text')?.focus(); document.querySelector('#mm-text')?.select(); }
  }
  root.querySelectorAll('[data-topic]').forEach(el => {
    el.onclick = () => {
      if (Date.now() < suppressClickUntil) return;
      if (connecting) { const from = connecting; connecting = null; mutate(() => connectTopics(map, from, el.dataset.topic)); }
      selected = el.dataset.topic; refresh(); focusTopic();
    };
    el.onpointerdown = event => {
      if (event.button !== 0 || connecting) return;
      const start = { x: event.clientX, y: event.clientY, scrollX: root.querySelector('.mm-scroll').scrollLeft, scrollY: root.querySelector('.mm-scroll').scrollTop };
      const positions = layout(map).positions; const initial = positions.find(n => n.id === el.dataset.topic);
      let moved = false, final = null;
      el.setPointerCapture(event.pointerId);
      el.onpointermove = e => {
        const viewport = root.querySelector('.mm-scroll');
        const dx = (e.clientX - start.x + viewport.scrollLeft - start.scrollX) / zoom, dy = (e.clientY - start.y + viewport.scrollTop - start.scrollY) / zoom;
        if (!moved && Math.hypot(dx, dy) < 5) return; moved = true;
        final = { x: Math.max(10, Math.min(10000, initial.x + dx)), y: Math.max(10, Math.min(10000, initial.y + dy)) };
        el.style.left = `${final.x}px`; el.style.top = `${final.y}px`;
        const preview = positions.map(n => n.id === initial.id ? { ...n, ...final } : n);
        root.querySelector('.mm-lines').innerHTML = connectionPaths(preview);
      };
      const finish = (cancelled = false) => {
        el.onpointermove = null; el.onpointerup = null; el.onpointercancel = null;
        if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
        if (!moved) return;
        suppressClickUntil = Date.now() + 300;
        if (!cancelled) { mutate(() => { map.nodes.find(n => n.id === initial.id).position = final; }); selected = initial.id; }
        refresh(); focusTopic();
      };
      el.onpointerup = () => finish(); el.onpointercancel = () => finish(true);
    };
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
  const viewport = root.querySelector('.mm-scroll');
  viewport.scrollLeft = 600 * zoom; viewport.scrollTop = 600 * zoom;
  viewport.onpointerdown = event => {
    if (event.button !== 0 || event.target.closest('.mm-topic')) return;
    event.preventDefault();
    const origin = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture(event.pointerId); viewport.classList.add('mm-panning');
    viewport.onpointermove = e => { viewport.scrollLeft = origin.left - (e.clientX - origin.x); viewport.scrollTop = origin.top - (e.clientY - origin.y); };
    const finish = () => {
      viewport.onpointermove = null; viewport.onpointerup = null; viewport.onpointercancel = null; viewport.classList.remove('mm-panning');
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    };
    viewport.onpointerup = finish; viewport.onpointercancel = finish;
  };
  viewport.addEventListener('wheel', event => {
    event.preventDefault();
    const bounds = viewport.getBoundingClientRect();
    const x = event.clientX - bounds.left - viewport.clientLeft, y = event.clientY - bounds.top - viewport.clientTop;
    const oldZoom = zoom;
    const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
    zoom = Math.max(.2, Math.min(2, zoom * Math.exp(-event.deltaY * units * .0015)));
    const anchor = { x: (viewport.scrollLeft + x) / oldZoom, y: (viewport.scrollTop + y) / oldZoom };
    const world = root.querySelector('.mm-world'), plane = root.querySelector('.mm-plane');
    world.style.transform = `scale(${zoom})`; plane.style.width = `${parseFloat(world.style.width) * zoom}px`; plane.style.height = `${parseFloat(world.style.height) * zoom}px`;
    viewport.scrollLeft = anchor.x * zoom - x; viewport.scrollTop = anchor.y * zoom - y;
    root.querySelector('[data-mm-zoom]').textContent = `${Math.round(zoom * 100)}%`;
  }, { passive: false });
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
    if (action === 'templates') showTemplates = !showTemplates;
    if (action === 'connect') { connecting = connecting ? null : selected; message = connecting ? 'Clique no card de destino para criar a conexão.' : ''; }
    if (action === 'arrange') { mutate(() => { map.nodes.forEach(n => { delete n.position; }); }); }
    if (action === 'new') { if (!canLeaveMindmaps()) return; map = newMap(); record = null; saved = JSON.stringify(map); pending = false; history = []; future = []; selected = null; connecting = null; message = ''; }
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
          try { const row = await loadMap(b.dataset.openMap); if (token !== generation) return; map = { title: row.title, nodes: row.document.nodes, connections: row.document.connections || [] }; record = { id: row.id, revision: row.revision }; saved = JSON.stringify(map); selected = null; history = []; future = []; message = ''; }
          catch (error) { if (token === generation) message = error.message; }
          finally { if (token === generation) { busy = false; refresh(); } }
        });
      } catch (error) { panel.innerHTML = `<p role="alert">${esc(['42P01', 'PGRST205'].includes(error.code) ? 'O banco de mapas ainda precisa ser ativado.' : error.message)}</p>`; } return;
    }
    refresh();
    if (action === 'fit' || action === 'new') { const view = document.querySelector('.mm-scroll'); view.scrollLeft = 600 * zoom; view.scrollTop = 600 * zoom; }
  });
  root.querySelector('#mm-file').onchange = async event => {
    const file = event.target.files[0]; if (!file || !canLeaveMindmaps()) return;
    try { if (file.size > 2000000) throw Error('Escolha um JSON de até 2 MB.'); const imported = validateMap(JSON.parse(await file.text())); map = { title: imported.title, nodes: imported.nodes, connections: imported.connections || [] }; record = null; saved = ''; history = []; future = []; selected = null; message = 'Mapa importado. Salve para guardar no Master.'; }
    catch (error) { message = `Não foi possível importar: ${error.message}`; } refresh();
  };
}
