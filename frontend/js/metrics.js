// One contract for client metrics consumed by dashboard, saved reports and weekly text.
export const METRIC_CONTEXT = Object.freeze({ timezone: 'America/Sao_Paulo', currency: 'BRL' });
const FIELDS = Object.freeze({ spend: 'investimento', impressions: 'impressoes', clicks: 'cliques', messages: 'mensagens', sales: 'vendas', metaRevenue: 'faturamento' });
const REPORT_FIELDS = Object.freeze({ spend: 'investimento', impressions: 'impressoes', clicks: 'cliques', messages: 'mensagens', sales: 'vendas', metaRevenue: 'faturamento_informado' });
const value = (row, key) => row?.[key] == null ? null : Number(row[key]);
const days = (since, until) => {
  if (!since || !until || since > until) return [];
  const out = [];
  for (let stamp = Date.parse(`${since}T00:00:00Z`); stamp <= Date.parse(`${until}T00:00:00Z`); stamp += 86400000) out.push(new Date(stamp).toISOString().slice(0, 10));
  return out;
};
const later = (a, b) => String(a?.synced_at || a?.updated_at || a?.created_at || '').localeCompare(String(b?.synced_at || b?.updated_at || b?.created_at || ''));
const metric = (amount, source, coverage, extra = {}) => ({ value: amount, source, channel: 'meta_ads', period: coverage.period, timezone: METRIC_CONTEXT.timezone, currency: METRIC_CONTEXT.currency, attributionWindow: extra.attributionWindow ?? 'configuracao_meta_nao_registrada', updatedAt: extra.updatedAt || null, coverage: { observedDays: coverage.observedDays, estimatedDays: coverage.estimatedDays, missingDays: coverage.missingDays, noDeliveryDays: coverage.noDeliveryDays, totalDays: coverage.totalDays }, status: amount == null ? 'missing' : coverage.estimatedDays ? 'estimated' : coverage.missingDays ? 'partial' : 'measured' });

export function aggregateClientMetrics({ range, daily = [], reports = [], sales = [], origin = 'all', goal = 'mensagens' }) {
  const periodDays = days(range.since, range.until);
  const byDay = new Map();
  for (const row of daily) {
    if (!periodDays.includes(row.data)) continue;
    const old = byDay.get(row.data);
    const rank = (item) => item.source === 'meta_graph' ? 2 : item.source === 'legacy' ? 1 : 0;
    if (!old || rank(row) > rank(old) || (rank(row) === rank(old) && later(row, old) > 0)) byDay.set(row.data, row);
  }
  const reportForDay = new Map();
  for (const day of periodDays) {
    if (byDay.has(day)) continue;
    const candidates = reports.filter((r) => r.periodo_inicio <= day && r.periodo_fim >= day && days(r.periodo_inicio, r.periodo_fim).length);
    candidates.sort((a, b) => later(b, a) || String(b.id || '').localeCompare(String(a.id || '')));
    if (candidates.length) reportForDay.set(day, candidates[0]);
  }
  const coverage = { period: range, observedDays: byDay.size, noDeliveryDays: [...byDay.values()].filter((row) => row.entrega === 'no_delivery').length, estimatedDays: reportForDay.size, missingDays: periodDays.length - byDay.size - reportForDay.size, totalDays: periodDays.length };
  const updatedAt = [...byDay.values()].map((r) => r.synced_at).filter(Boolean).sort().at(-1) || null;
  const fields = {};
  for (const [name, dailyField] of Object.entries(FIELDS)) {
    let total = 0;
    let observed = false;
    for (const row of byDay.values()) { const amount = value(row, dailyField); if (amount != null) { total += amount; observed = true; } }
    for (const report of reportForDay.values()) { const amount = value(report, REPORT_FIELDS[name]); if (amount != null) { total += amount / days(report.periodo_inicio, report.periodo_fim).length; observed = true; } }
    fields[name] = metric(observed ? total : null, reportForDay.size ? 'meta_daily_plus_report_estimate' : 'meta_daily', coverage, { updatedAt });
  }
  const filteredSales = sales.filter((s) => s.data_venda >= range.since && s.data_venda <= range.until && (origin === 'all' || s.origem === origin));
  const operational = (key) => ({ value: filteredSales.length ? filteredSales.reduce((sum, row) => sum + (value(row, key) ?? 0), 0) : null, source: 'operational_sales', channel: origin === 'all' ? 'all' : origin, period: range, timezone: METRIC_CONTEXT.timezone, currency: METRIC_CONTEXT.currency, attributionWindow: 'none', updatedAt: null, coverage: { observedRows: filteredSales.length }, status: filteredSales.length ? 'measured' : 'missing' });
  const operationalRevenue = operational('valor_total');
  const operationalSales = operational('quantidade_vendas');
  const products = operational('quantidade_produtos');
  const compatible = origin === 'all' || origin === 'Meta Ads';
  const mediaSpend = compatible ? fields.spend : metric(null, 'incompatible_origin', coverage);
  const attributedRevenue = { ...fields.metaRevenue, source: coverage.estimatedDays ? 'report_revenue_estimate' : 'meta_attributed_revenue', attributionWindow: 'configuracao_meta_nao_registrada' };
  const reconciledRevenue = { value: null, source: 'reconciled_revenue', channel: 'meta_ads', period: range, timezone: METRIC_CONTEXT.timezone, currency: METRIC_CONTEXT.currency, attributionWindow: 'not_reconciled', updatedAt: null, coverage: {}, status: 'missing' };
  const canCompare = compatible && fields.metaRevenue.value != null && fields.spend.value > 0 && !coverage.estimatedDays && !coverage.missingDays;
  const roas = metric(canCompare ? fields.metaRevenue.value / fields.spend.value : null, canCompare ? 'meta_attributed_roas' : 'unavailable', coverage);
  return { period: range, coverage, fields, mediaSpend, operationalRevenue, operationalSales, products, attributedRevenue, reconciledRevenue, roas, origin, goal, spend: mediaSpend.value, impressions: compatible ? fields.impressions.value : null, clicks: compatible ? fields.clicks.value : null, messages: compatible ? fields.messages.value : null, sales: origin === 'all' && goal === 'vendas' ? fields.sales.value : operationalSales.value, revenue: origin === 'all' && goal === 'vendas' ? fields.metaRevenue.value : operationalRevenue.value, salesSource: origin === 'all' && goal === 'vendas' ? 'meta' : 'operational' };
}

export function summarizeMetaRows(rows, aggregate = null) {
  const total = { investimento: 0, impressoes: 0, alcance: aggregate?.reach == null ? null : Number(aggregate.reach), cliques: 0, leads: 0, mensagens: 0, vendas: 0, faturamento: 0, resultados: 0 };
  for (const row of rows) for (const [target, source] of [['investimento', 'spend'], ['impressoes', 'impressions'], ['cliques', 'clicks'], ['leads', 'leads'], ['mensagens', 'mensagens'], ['vendas', 'vendas'], ['faturamento', 'faturamento'], ['resultados', 'resultados']]) total[target] += Number(row[source] || 0);
  total.ctr = total.impressoes ? total.cliques / total.impressoes * 100 : 0;
  total.cpc = total.cliques ? total.investimento / total.cliques : 0;
  total.cpm = total.impressoes ? total.investimento / total.impressoes * 1000 : 0;
  for (const [field, count] of [['custo_por_lead', 'leads'], ['custo_por_mensagem', 'mensagens'], ['custo_por_venda', 'vendas'], ['custo_por_resultado', 'resultados']]) total[field] = total[count] ? total.investimento / total[count] : null;
  total.provenance = { source: 'meta_graph', channel: 'meta_ads', reachSource: aggregate?.reach == null ? 'unavailable' : 'account_insights', attributionWindow: 'configuracao_meta_nao_registrada', timezone: METRIC_CONTEXT.timezone, currency: METRIC_CONTEXT.currency };
  return total;
}

export function deriveReportMetrics(report, operationalSales = []) {
  const period = { since: report.since, until: report.until };
  const make = (amount, source, channel, attributionWindow) => ({ value: amount, source, channel, period, timezone: METRIC_CONTEXT.timezone, currency: METRIC_CONTEXT.currency, attributionWindow, updatedAt: report.updatedAt || null, coverage: { source: 'live_graph_range' }, status: amount == null ? 'missing' : 'measured' });
  const revenue = make(report.totals.faturamento ?? null, 'meta_attributed_revenue', 'meta_ads', 'configuracao_meta_nao_registrada');
  const operational = make(operationalSales.length ? operationalSales.reduce((sum, sale) => sum + Number(sale.valor_total || 0), 0) : null, 'operational_sales', 'all', 'none');
  const spend = make(report.totals.investimento ?? null, 'meta_graph_spend', 'meta_ads', 'none');
  const roas = make(spend.value > 0 && revenue.value != null ? revenue.value / spend.value : null, 'meta_attributed_roas', 'meta_ads', 'configuracao_meta_nao_registrada');
  const reconciled = make(null, 'reconciled_revenue', 'meta_ads', 'not_reconciled');
  return { revenue, operational, spend, roas, reconciled };
}
