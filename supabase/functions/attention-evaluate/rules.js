const iso = (stamp) => new Date(stamp).toISOString().slice(0, 10);
const saoPauloDate = (stamp) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(stamp);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const dayMs = 86400000;
const dates = (since, until) => {
  const out = [];
  for (let stamp = Date.parse(since + 'T00:00:00Z'); stamp <= Date.parse(until + 'T00:00:00Z'); stamp += dayMs) out.push(iso(stamp));
  return out;
};
const number = (value) => Number(value || 0);
const round = (value) => Math.round(value * 100) / 100;
const latest = (a, b) => String(a?.synced_at || '').localeCompare(String(b?.synced_at || ''));

export function budgetSchedule(goal, revisions, periodStart, periodEnd, through) {
  const matching = revisions.filter((r) => r.meta_id === goal.id).sort((a, b) => String(a.effective_on).localeCompare(String(b.effective_on)) || String(a.changed_at).localeCompare(String(b.changed_at)));
  const periodDays = dates(periodStart, periodEnd);
  const budgetAt = (date) => {
    const revision = matching.filter((r) => r.effective_on <= date).at(-1);
    return revision ? number(revision.orcamento_periodo) : matching.length ? null : goal.orcamento_periodo == null ? null : number(goal.orcamento_periodo);
  };
  const daily = periodDays.map((date) => ({ date, planned: budgetAt(date) == null ? null : budgetAt(date) / periodDays.length }));
  if (daily.some((row) => row.planned == null)) return { available: false, changes: matching.length > 1 };
  return { available: true, plannedThrough: round(daily.filter((row) => row.date <= through).reduce((sum, row) => sum + row.planned, 0)), plannedRemaining: round(daily.filter((row) => row.date > through).reduce((sum, row) => sum + row.planned, 0)), revisedBudget: round(daily.reduce((sum, row) => sum + row.planned, 0)), changes: matching.filter((r) => r.effective_on >= periodStart && r.effective_on <= periodEnd).length > 1 };
}

export function evaluateAttention({ client, goal, facts = [], syncItems = [], revisions = [], now = new Date() }) {
  if (!goal?.ativo || goal.canal !== 'meta_ads' || !client?.meta_ads_act) return [];
  const today = saoPauloDate(now);
  const yesterday = iso(Date.parse(today + 'T00:00:00Z') - dayMs);
  const monthStart = yesterday.slice(0, 7) + '-01';
  const monthEnd = iso(new Date(Date.UTC(Number(yesterday.slice(0, 4)), Number(yesterday.slice(5, 7)), 0)));
  const since = goal.periodo_inicio || monthStart;
  const until = goal.periodo_fim || monthEnd;
  const through = yesterday < until ? yesterday : until;
  if (since > through) return [];
  const coveredDates = dates(since, through);
  const unsupportedCurrencies = [...new Set(facts.filter((row) => row.cliente_id === client.id && row.meta_ads_act === client.meta_ads_act && row.nivel === 'account' && row.source === 'meta_graph' && row.data >= since && row.data <= through && row.moeda !== 'BRL').map((row) => row.moeda))];
  const byDate = new Map();
  for (const row of facts) {
    if (row.cliente_id !== client.id || row.meta_ads_act !== client.meta_ads_act || row.moeda !== 'BRL' || row.nivel !== 'account' || row.source !== 'meta_graph' || row.data < since || row.data > through) continue;
    const old = byDate.get(row.data);
    if (!old || latest(row, old) > 0) byDate.set(row.data, row);
  }
  const observed = coveredDates.filter((day) => byDate.has(day));
  const missing = coveredDates.filter((day) => !byDate.has(day));
  const coverage = coveredDates.length ? observed.length / coveredDates.length * 100 : 0;
  const spend = round(observed.reduce((sum, day) => sum + number(byDate.get(day).investimento), 0));
  const latestSync = syncItems.filter((item) => item.cliente_id === client.id && item.meta_ads_act === client.meta_ads_act && item.period_since <= through && item.period_until >= since).sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0];
  const common = { clienteId: client.id, metaId: goal.id, periodStart: since, periodEnd: until, objective: goal.objetivo, owner: goal.responsavel || client.responsavel_interno || 'Não atribuído', coveredThrough: through };
  const card = (rule, category, severity, confidence, metric, hypothesis, nextStep, evidence, impact = null) => ({ ...common, rule, category, severity, confidence, metric, hypothesis, nextStep, evidence: { ...evidence, source: 'meta_ads_facts', observedDays: observed.length, expectedDays: coveredDates.length, missingDays: missing.length, coveragePct: round(coverage), coveredThrough: through, timezone: 'America/Sao_Paulo', currency: 'BRL' }, impactEstimated: impact });
  const out = [];
  const minCoverage = number(goal.cobertura_minima_pct ?? 95);
  if (missing.length || coverage < minCoverage || latestSync?.status === 'failed' || latestSync?.status === 'partial') {
    out.push(card('coverage', 'dados', missing.length > 3 || latestSync?.status === 'failed' ? 'alta' : 'media', 'alta', 'coverage', unsupportedCurrencies.length ? 'Moeda dos fatos incompatível com a meta em BRL; não há base para comparar valores.' : 'Histórico incompleto ou sincronização parcial; não há base para afirmar queda de resultados.', 'Reprocessar os dias ausentes e verificar a conta e a moeda.', { missingDates: missing.slice(0, 14), unsupportedCurrencies, syncStatus: latestSync?.status || 'unknown', syncError: latestSync?.error_code || null, requiredCoveragePct: minCoverage }));
  }
  // Result rules require confirmed daily coverage. Missing data never becomes zero.
  if (coverage < minCoverage || missing.length || ['failed', 'partial'].includes(latestSync?.status)) return out;
  const recent = coveredDates.slice(-3);
  const zeroDays = recent.filter((day) => byDate.get(day)?.entrega === 'no_delivery').length;
  if (recent.length === 3 && zeroDays === 3 && number(goal.orcamento_periodo) > 0)
    out.push(card('delivery', 'entrega_midia', 'alta', 'alta', 'delivery', 'A API confirmou três dias sem veiculação; a causa ainda precisa ser verificada.', 'Conferir status da conta, anúncios, orçamento e políticas.', { noDeliveryDates: recent, budget: number(goal.orcamento_periodo) }));
  const schedule = budgetSchedule(goal, revisions, since, until, through);
  if (schedule.available && observed.length >= 3 && schedule.plannedThrough > 0) {
    const paceRatio = spend / schedule.plannedThrough;
    const projected = round(spend + paceRatio * schedule.plannedRemaining);
    if (paceRatio > 1.15 || paceRatio < 0.6) {
      const excess = paceRatio > 1.15 ? Math.max(0, projected - schedule.revisedBudget) : null;
      out.push(card('pace', 'entrega_midia', paceRatio > 1.3 ? 'alta' : 'media', 'media', 'pace',
        paceRatio > 1.15 ? 'Gasto acima do ritmo do orçamento vigente.' : 'Gasto abaixo do ritmo do orçamento vigente.',
        'Revisar a programação e confirmar alterações de verba antes de qualquer decisão.',
        { actualSpend: spend, plannedThrough: schedule.plannedThrough, plannedRemaining: schedule.plannedRemaining, revisedBudget: schedule.revisedBudget, projectedSpend: projected, formula: 'gasto_real + (gasto_real / planejado_ate_hoje) × planejado_restante', budgetChanged: schedule.changes, paceRatio: round(paceRatio) }, excess == null ? null : round(excess)));
    }
  }
  const lag = Math.max(0, Math.min(30, number(goal.janela_conversao_dias ?? 3)));
  const maturedThrough = iso(Date.parse(through + 'T00:00:00Z') - lag * dayMs);
  const matureDates = observed.filter((day) => day <= maturedThrough);
  const matureSpend = round(matureDates.reduce((sum, day) => sum + number(byDate.get(day).investimento), 0));
  const resultField = { mensagens: 'mensagens', leads: 'leads', vendas: 'vendas', seguidores: null }[goal.objetivo];
  if (!resultField || !matureDates.length) return out;
  const results = round(matureDates.reduce((sum, day) => sum + number(byDate.get(day)[resultField]), 0));
  const minSpend = number(goal.gasto_minimo_analise ?? 100), minResults = number(goal.resultados_minimos_analise ?? 5);
  if (matureSpend < minSpend || results < minResults) return out;
  const cost = matureSpend / results;
  const target = goal.meta_custo_resultado;
  if (target != null && cost > number(target) * 1.2)
    out.push(card('cost_result', 'conversao_meta', 'media', 'media', 'cost_result', 'Custo por conversão Meta acima da meta cadastrada; a qualidade comercial ainda não foi conciliada.', 'Revisar campanhas e conferir a qualidade dos resultados com o atendimento.', { matureThrough: maturedThrough, matureSpend, results, resultField, costPerResult: round(cost), targetCost: number(target), minimumSpend: minSpend, minimumResults: minResults, attributionWindow: 'configuração Meta não registrada' }, round(Math.max(0, cost - number(target)) * results)));
  if (goal.meta_volume != null && matureDates.length >= 7) {
    const projectedVolume = round(results / matureDates.length * dates(since, until).length);
    if (projectedVolume < number(goal.meta_volume) * 0.8)
      out.push(card('volume', 'conversao_meta', 'media', 'media', 'volume', 'Volume de conversões Meta projetado abaixo da meta, com amostra mínima atingida.', 'Analisar entrega, conversão e atendimento antes de propor escala.', { matureThrough: maturedThrough, results, targetVolume: number(goal.meta_volume), projectedVolume, formula: 'resultados_maduros / dias_maduros × dias_do_periodo', minimumResults: minResults }));
  }
  return out;
}
