const iso = (stamp) => new Date(stamp).toISOString().slice(0, 10);
const days = (start, end) => {
  const list = [];
  for (let stamp = Date.parse(start + 'T00:00:00Z'); stamp <= Date.parse(end + 'T00:00:00Z'); stamp += 86400000) list.push(iso(stamp));
  return list;
};
export function interventionRanges(executedOn) {
  const stamp = Date.parse(executedOn + 'T00:00:00Z');
  return {
    beforeStart: iso(stamp - 7 * 86400000), beforeEnd: iso(stamp - 86400000),
    afterStart: iso(stamp + 86400000), afterEnd: iso(stamp + 7 * 86400000),
  };
}
export function compareIntervention(intervention, facts, metric = 'leads', today = iso(new Date()), accountId = null) {
  const beforeDays = days(intervention.periodo_antes_inicio, intervention.periodo_antes_fim);
  const afterDays = days(intervention.periodo_depois_inicio, intervention.periodo_depois_fim);
  if (beforeDays.length !== afterDays.length || afterDays.at(-1) >= today) return { status: 'pending', reason: 'Aguardando fim do período posterior.' };
  const from = (list) => {
    const rows = list.map((day) => facts.filter((row) => row.cliente_id === intervention.cliente_id && (!accountId || row.meta_ads_act === accountId) && row.data === day && row.nivel === 'account' && row.source === 'meta_graph' && row.moeda === 'BRL').sort((a, b) => String(b.synced_at).localeCompare(String(a.synced_at)))[0]);
    if (rows.some((row) => !row)) return null;
    return { spend: rows.reduce((sum, row) => sum + Number(row.investimento || 0), 0), results: rows.reduce((sum, row) => sum + Number(row[metric] || 0), 0), days: rows.length };
  };
  const before = from(beforeDays), after = from(afterDays);
  if (!before || !after) return { status: 'missing', reason: 'Cobertura diária incompleta; comparação indisponível.' };
  return { status: 'measured', before, after, source: 'meta_ads_facts', caveat: 'Comparação antes/depois não prova causalidade.' };
}
