import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateClientMetrics, deriveReportMetrics, summarizeMetaRows } from '../frontend/js/metrics.js';
const range = { since: '2026-09-01', until: '2026-09-03' };
const daily = (data, investimento = 10, faturamento = 0) => ({ data, objetivo: 'vendas', investimento, faturamento, impressoes: 100, cliques: 10, mensagens: 2, vendas: 0, synced_at: `${data}T12:00:00Z` });
const sale = (data_venda, origem, valor_total) => ({ data_venda, origem, valor_total, quantidade_vendas: 1, quantidade_produtos: 1 });

test('incompatible store origin never creates Meta ROAS or acquisition cost', () => {
  const m = aggregateClientMetrics({ range, daily: [daily('2026-09-01'), daily('2026-09-02'), daily('2026-09-03')], sales: [sale('2026-09-01', 'Loja física', 300)], origin: 'Loja física', goal: 'vendas' });
  assert.equal(m.operationalRevenue.value, 300);
  assert.equal(m.mediaSpend.value, null);
  assert.equal(m.roas.value, null);
});

test('confirmed zero Meta revenue stays zero and does not fall back to operational revenue', () => {
  const m = aggregateClientMetrics({ range, daily: [daily('2026-09-01'), daily('2026-09-02'), daily('2026-09-03')], sales: [sale('2026-09-01', 'Loja física', 300)], goal: 'vendas' });
  assert.equal(m.attributedRevenue.value, 0);
  assert.equal(m.revenue, 0);
  assert.equal(m.roas.value, 0);
  assert.equal(m.operationalRevenue.value, 300);
});

test('missing day is explicit and prevents full-period ROAS', () => {
  const m = aggregateClientMetrics({ range, daily: [daily('2026-09-01', 10, 20), daily('2026-09-03', 10, 20)], goal: 'vendas' });
  assert.equal(m.coverage.missingDays, 1);
  assert.equal(m.fields.spend.status, 'partial');
  assert.equal(m.roas.value, null);
});

test('overlapping reports estimate only uncovered day once', () => {
  const reports = [
    { id: 'old', periodo_inicio: '2026-09-01', periodo_fim: '2026-09-03', investimento: 90, updated_at: '2026-09-04' },
    { id: 'new', periodo_inicio: '2026-09-02', periodo_fim: '2026-09-03', investimento: 40, updated_at: '2026-09-05' },
  ];
  const m = aggregateClientMetrics({ range, daily: [daily('2026-09-01', 10), daily('2026-09-03', 10)], reports });
  assert.equal(m.spend, 40);
  assert.equal(m.coverage.estimatedDays, 1);
  assert.equal(m.fields.spend.status, 'estimated');
});

test('saved report and weekly text derive Meta and operational revenue from the same contract', () => {
  const report = { since: '2026-09-01', until: '2026-09-03', totals: { investimento: 100, faturamento: 0 } };
  const m = deriveReportMetrics(report, [sale('2026-09-01', 'Loja física', 300)]);
  assert.equal(m.revenue.value, 0);
  assert.equal(m.operational.value, 300);
  assert.equal(m.roas.value, 0);
  assert.equal(m.reconciled.value, null);
});

test('paused ad with period results counts, while reach requires account aggregate', () => {
  const rows = [{ status: 'PAUSED', spend: 10, reach: 100, impressions: 100, clicks: 5, resultados: 2 }];
  assert.equal(summarizeMetaRows(rows).resultados, 2);
  assert.equal(summarizeMetaRows(rows).alcance, null);
  assert.equal(summarizeMetaRows(rows, { reach: 80 }).alcance, 80);
});

test('different periods and different sources are not merged', () => {
  const first = aggregateClientMetrics({ range: { since: '2026-09-01', until: '2026-09-01' }, daily: [daily('2026-09-01', 10, 20), daily('2026-09-02', 40, 80)] });
  const second = aggregateClientMetrics({ range: { since: '2026-09-02', until: '2026-09-02' }, reports: [{ periodo_inicio: '2026-09-02', periodo_fim: '2026-09-02', investimento: 40, faturamento_informado: 80 }] });
  assert.equal(first.spend, 10);
  assert.equal(second.spend, 40);
  assert.equal(first.fields.spend.source, 'meta_daily');
  assert.equal(second.fields.spend.status, 'estimated');
});
