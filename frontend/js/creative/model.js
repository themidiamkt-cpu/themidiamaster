// Transforma as linhas do Supabase (ci_*) no modelo que a interface consome. Funcao pura.
// Cliente = tabela existente `clientes`. O nicho do cliente e DERIVADO dos dados (pesquisas, referencias, conceitos).
import { formatCategory } from './format.js';

const SOURCE_LABELS = { 'meta-ads-library': 'Meta Ads Library', instagram: 'Instagram', tiktok: 'TikTok', sites: 'Sites' };
// marcadores internos de ausencia de dado viram texto legivel (ou somem, quando sao o valor inteiro)
const txt = (v) => {
  const s = String(v ?? '').trim();
  if (!s || /^nao-(lido|identificado|verificado|aplicavel)$/i.test(s)) return '';
  return s.replace(/\bnao-identificado\b/gi, 'não identificado').replace(/\bnao-lido\b/gi, 'não lido')
    .replace(/\bnao-verificado\b/gi, 'não verificado').replace(/\bnao-aplicavel\b/gi, 'não aplicável');
};
const day = (value) => String(value || '').slice(0, 10);
const bullets = (list) => (Array.isArray(list) ? list : []).map((s) => `- ${txt(s)}`).join('\n');
const items = (list) => (Array.isArray(list) ? list : []).map((i) => ({
  title: i.titulo || '', detail: i.descricao || '', count: i.anunciantes ?? null, links: Array.isArray(i.referencias) ? i.referencias : [],
}));

export function normalizeCreativeData(rows, clientes = []) {
  const nichoById = new Map(rows.nichos.map((n) => [n.id, n]));
  const clienteById = new Map(clientes.map((c) => [c.id, c]));
  const nicheName = (id) => nichoById.get(id)?.nome || '';
  const clientRef = (id) => (id && clienteById.has(id) ? { id, nome: clienteById.get(id).nome_empresa } : null);

  const refs = rows.referencias.map((r) => {
    const cliente = clientRef(r.cliente_id);
    return {
      id: r.id, anunciante: r.anunciante, nicho: nicheName(r.nicho_id), nichoId: r.nicho_id, pesquisaId: r.pesquisa_id,
      formato: txt(r.formato), formatoCategoria: formatCategory(r.formato), hook: txt(r.hook), angulo: txt(r.angulo),
      oferta: txt(r.oferta), cta: txt(r.cta), motivos: r.motivo_salvo || [], ativoDesde: r.ativo_desde || '',
      consultadoEm: r.consultado_em || '', fonte: r.fonte, fonteLabel: SOURCE_LABELS[r.fonte] || r.fonte || '',
      url: /^https?:\/\//.test(r.url || '') ? r.url : '', destinoUrl: /^https?:\/\//.test(r.destino_url || '') ? r.destino_url : '',
      idExterno: r.id_externo || '', plataformas: txt(r.plataformas), variacoes: txt(r.variacoes_observadas),
      secoes: {
        fatos: bullets(r.fatos), observacoes: bullets(r.observacoes), sinais: bullets(r.sinais),
        hipoteses: bullets(r.hipoteses), transcricao: r.transcricao || '',
      },
      clientes: cliente ? [cliente] : [],
    };
  });
  const refById = new Map(refs.map((r) => [r.id, r]));

  const pesquisas = rows.pesquisas.map((p) => ({
    id: p.id, titulo: p.titulo, objetivo: p.objetivo || '', dorTema: p.dor_tema || '', nicho: nicheName(p.nicho_id), nichoId: p.nicho_id,
    cliente: clientRef(p.cliente_id), fonte: p.fonte, fonteLabel: SOURCE_LABELS[p.fonte] || p.fonte || '',
    consultas: Array.isArray(p.consultas) ? p.consultas : [], territorios: Array.isArray(p.territorios) ? p.territorios : [],
    cartoes: p.cartoes_observados, anunciantes: p.anunciantes_observados, candidatos: p.candidatos, salvas: p.referencias_salvas,
    resumo: p.resumo || '', status: p.status, executadoEm: p.executado_em || '', chave: p.chave || '',
  })).sort((a, b) => String(b.executadoEm).localeCompare(String(a.executadoEm)));

  const latestScript = new Map();
  for (const ro of rows.roteiros) {
    const cur = latestScript.get(ro.conceito_id);
    if (!cur || ro.versao > cur.versao) latestScript.set(ro.conceito_id, ro);
  }
  const refsByConcept = new Map();
  const refsDetailByConcept = new Map();
  for (const link of rows.conceitoReferencias) {
    const ref = refById.get(link.referencia_id);
    if (!ref) continue;
    refsByConcept.set(link.conceito_id, [...(refsByConcept.get(link.conceito_id) || []), ref.anunciante]);
    refsDetailByConcept.set(link.conceito_id, [...(refsDetailByConcept.get(link.conceito_id) || []), { nome: ref.anunciante, observar: ref.angulo, link: ref.url }]);
  }
  const concepts = rows.conceitos.map((c) => {
    const ro = latestScript.get(c.id);
    const cliente = clientRef(c.cliente_id);
    return {
      id: c.id, nome: c.nome, cliente: c.cliente_id, clienteNome: cliente?.nome || '', nicho: nicheName(c.nicho_id),
      status: c.status, angulo: c.angulo || '', hook: c.hook || '', dorDesejo: c.dor_desejo || '', ideiaCentral: c.ideia_central || '',
      formato: c.formato || '', posicionamento: c.posicionamento || '', referencias: refsByConcept.get(c.id) || [], referenciasDetalhe: refsDetailByConcept.get(c.id) || [],
      data: day(ro?.updated_at || c.updated_at), racional: c.observacoes || '',
      hasRoteiro: Boolean(ro),
      roteiro: ro ? { versao: ro.versao, titulo: ro.titulo || '', completo: ro.roteiro || '', hook: ro.hook || '', cenas: ro.cenas || '', textoNaTela: ro.texto_tela || '', cta: ro.cta || '', observacoes: ro.observacoes || '' } : null,
    };
  });

  const niches = rows.nichos.map((n) => ({
    id: n.id, nome: n.nome, slug: n.slug, publico: n.publico || '', status: n.status, resumo: n.resumo || '', atualizado: day(n.updated_at),
    padroes: items(n.padroes), recorrencias: items(n.recorrencias), poucoExplorado: items(n.pouco_explorado), ideias: items(n.ideias_explorar),
    restricoes: items(n.restricoes),
    referencias: refs.filter((r) => r.nichoId === n.id).length,
    pesquisas: pesquisas.filter((p) => p.nichoId === n.id).length,
    clientes: [...new Map(pesquisas.filter((p) => p.nichoId === n.id && p.cliente).map((p) => [p.cliente.id, p.cliente])).values()],
  }));

  const clients = clientes
    .filter((c) => c.status !== 'cancelado')
    .map((c) => {
      const nicheIds = [
        ...pesquisas.filter((p) => p.cliente?.id === c.id).map((p) => p.nichoId),
        ...rows.conceitos.filter((x) => x.cliente_id === c.id).map((x) => x.nicho_id),
        ...rows.referencias.filter((r) => r.cliente_id === c.id).map((r) => r.nicho_id),
      ];
      const nichos = [...new Set(nicheIds)].map(nicheName).filter(Boolean);
      const nichoRefs = refs.filter((r) => r.clientes.some((x) => x.id === c.id));
      const mine = concepts.filter((x) => x.cliente === c.id);
      return {
        id: c.id, nome: c.nome_empresa, status: c.status || 'ativo', nichos, nicho: nichos[0] || '',
        ultimaPesquisa: pesquisas.find((p) => p.cliente?.id === c.id) || null,
        counts: { referencias: nichoRefs.length, pesquisas: pesquisas.filter((p) => p.cliente?.id === c.id).length, conceitos: mine.length, roteiros: mine.filter((x) => x.hasRoteiro).length },
      };
    })
    .sort((a, b) => (b.counts.referencias + b.counts.conceitos) - (a.counts.referencias + a.counts.conceitos) || a.nome.localeCompare(b.nome, 'pt-BR'));

  return {
    connected: true,
    counts: { referencias: refs.length, nichos: niches.length, conceitos: concepts.length, roteiros: concepts.filter((c) => c.hasRoteiro).length, pesquisas: pesquisas.length },
    clients, niches, references: refs, pesquisas, concepts,
  };
}
