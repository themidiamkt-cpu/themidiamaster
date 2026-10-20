// Camada "pedido": transforma uma acao da interface em um pedido estruturado
// para o motor local (Claude Code: ci-pesquisar / ci-coletor / Jev) que escreve no Obsidian.
// A interface NAO executa nada: ela PREPARA o pedido. Funcoes puras, sem DOM e sem rede.

export const SOURCES = [
  { id: 'meta-ads-library', label: 'Meta Ads Library', enabled: true },
  { id: 'instagram', label: 'Instagram', enabled: false },
  { id: 'tiktok', label: 'TikTok', enabled: false },
  { id: 'sites', label: 'Sites', enabled: false },
];

const ENGINE = {
  camada: 'motor-local',
  executor: 'claude-code',
  ferramentas: ['ci-pesquisar', 'ci-coletor', 'jev'],
  memoria: ['supabase', 'obsidian'],
};

const clientRef = (client) => (client ? { id: client.id, nome: client.nome } : null);

export function buildResearchRequest({ client = null, niche = '', objective = '', source = 'meta-ads-library', now = new Date() } = {}) {
  const errors = [];
  const nicho = String(niche || '').trim();
  const objetivo = String(objective || '').trim();
  const src = SOURCES.find((s) => s.id === source);
  if (!nicho) errors.push('Informe o nicho.');
  if (!objetivo) errors.push('Descreva o objetivo da pesquisa.');
  if (!src) errors.push('Fonte desconhecida.');
  else if (!src.enabled) errors.push(`${src.label} ainda não está disponível.`);
  if (errors.length) return { ok: false, errors };

  const subject = client ? `para ${client.nome}, nicho ${nicho}` : `no nicho ${nicho}`;
  const prompt = `Pesquise anúncios ${subject}. Objetivo: ${objetivo}. Fonte: ${src.label}. `
    + 'Use o ci-pesquisar: resolva cliente e nicho, leia a memória existente, use o ci-coletor/Jev só para o que faltar '
    + 'e salve o resultado no Supabase e no Obsidian (somente referências úteis, sem duplicar).';
  return {
    ok: true,
    errors: [],
    prompt,
    request: {
      tipo: 'pesquisa_referencias',
      status: 'preparado',
      cliente: clientRef(client),
      nicho,
      objetivo,
      fonte: src.id,
      motor: ENGINE,
      criadoEm: new Date(now).toISOString(),
    },
  };
}

const ACTIONS = {
  'criar-conceitos': { skill: 'ci-conceitos', verbo: 'Crie conceitos' },
  selecionar: { skill: 'ci-conceitos', verbo: 'Marque como selecionado o conceito' },
  descartar: { skill: 'ci-conceitos', verbo: 'Marque como descartado o conceito' },
  'criar-roteiro': { skill: 'ci-roteiros', verbo: 'Crie o roteiro do conceito' },
};

export function buildConceptRequest({ action, client = null, niche = '', concept = null, quantity = 5, now = new Date() } = {}) {
  const meta = ACTIONS[action];
  if (!meta) return { ok: false, errors: ['Ação desconhecida.'] };
  if (action === 'criar-conceitos') {
    if (!client) return { ok: false, errors: ['Escolha um cliente para criar conceitos.'] };
    const prompt = `Crie ${quantity} conceitos para ${client.nome}${niche ? `, nicho ${niche}` : ''}. `
      + 'Use o ci-conceitos: leia a memória do cliente e a inteligência do nicho, não repita hooks, ângulos ou ideias já criadas, '
      + 'passe pelo checklist de compliance e só grave no Obsidian depois da minha aprovação.';
    return {
      ok: true, errors: [], prompt,
      request: { tipo: 'criar_conceitos', status: 'preparado', skill: meta.skill, cliente: clientRef(client), nicho: niche, quantidade: quantity, motor: ENGINE, criadoEm: new Date(now).toISOString() },
    };
  }
  if (!concept) return { ok: false, errors: ['Conceito não informado.'] };
  const prompt = `${meta.verbo} "${concept.nome}"${concept.clienteNome ? ` (cliente ${concept.clienteNome})` : ''}. `
    + (action === 'criar-roteiro'
      ? 'Use o ci-roteiros: o roteiro fica dentro da nota do conceito, passa pelo checklist de compliance e só é gravado depois da minha aprovação.'
      : 'Altere apenas o campo status do conceito no Obsidian.');
  return {
    ok: true, errors: [], prompt,
    request: { tipo: action.replace('-', '_'), status: 'preparado', skill: meta.skill, conceito: concept.nome, cliente: concept.cliente || null, motor: ENGINE, criadoEm: new Date(now).toISOString() },
  };
}
