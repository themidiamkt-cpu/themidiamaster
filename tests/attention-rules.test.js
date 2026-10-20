import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAttention, budgetSchedule } from '../supabase/functions/attention-evaluate/rules.js';
import { compareIntervention, interventionRanges } from '../frontend/js/attentionComparison.js';

const client = { id: 'client-a', meta_ads_act: 'act_1', responsavel_interno: 'Gestor A' };
const goal = { id: 'goal-a', cliente_id: client.id, ativo: true, canal: 'meta_ads', objetivo: 'leads', periodo_inicio: '2026-09-01', periodo_fim: '2026-09-30', orcamento_periodo: 3000, meta_custo_resultado: 30, meta_volume: 100, gasto_minimo_analise: 100, resultados_minimos_analise: 5, janela_conversao_dias: 3, cobertura_minima_pct: 95 };
const now = new Date('2026-09-22T15:00:00Z');
const dates = Array.from({ length: 21 }, (_, i) => '2026-09-' + String(i + 1).padStart(2, '0'));
const facts = dates.map((data) => ({ cliente_id: client.id, meta_ads_act: client.meta_ads_act, nivel: 'account', source: 'meta_graph', moeda: 'BRL', data, entrega: 'served', investimento: 200, leads: 2, synced_at: '2026-09-22' }));
const revisions = [
  { meta_id: goal.id, effective_on: '2026-09-01', orcamento_periodo: 3000, changed_at: '2026-09-01' },
  { meta_id: goal.id, effective_on: '2026-09-15', orcamento_periodo: 4500, changed_at: '2026-09-15' },
];

test('missing day yields data issue, never a sales decline or cost conclusion', () => {
  const cards = evaluateAttention({ client, goal, facts: facts.filter((row) => row.data !== '2026-09-10'), revisions, now });
  assert.deepEqual(cards.map((card) => card.rule), ['coverage']);
  assert.equal(cards[0].evidence.missingDays, 1);
  assert.match(cards[0].hypothesis, /não há base/);
});
test('low sample never recommends scaling', () => {
  const rows = facts.map((row) => ({ ...row, investimento: 1, leads: 0 }));
  const cards = evaluateAttention({ client, goal, facts: rows, revisions, now });
  assert.ok(!cards.some((card) => ['cost_result', 'volume'].includes(card.rule)));
  assert.ok(cards.every((card) => !/escala/i.test(card.nextStep)));
});
test('budget change is reflected in calendar projection and formula', () => {
  const schedule = budgetSchedule(goal, revisions, '2026-09-01', '2026-09-30', '2026-09-21');
  assert.equal(schedule.changes, true);
  assert.equal(schedule.plannedThrough, 2450);
  const cards = evaluateAttention({ client, goal, facts, revisions, now });
  const pace = cards.find((card) => card.rule === 'pace');
  assert.ok(pace);
  assert.equal(pace.evidence.budgetChanged, true);
  assert.match(pace.evidence.formula, /gasto_real/);
  assert.ok(pace.impactEstimated > 0);
});
test('confirmed no delivery is distinguished from missing day', () => {
  const rows = facts.map((row) => dates.slice(-3).includes(row.data) ? { ...row, investimento: 0, entrega: 'no_delivery' } : row);
  const cards = evaluateAttention({ client, goal, facts: rows, revisions, now });
  assert.ok(cards.some((card) => card.rule === 'delivery'));
  assert.ok(!cards.some((card) => card.rule === 'coverage'));
});
test('partial sync blocks outcome recommendations despite prior valid facts', () => {
  const syncItems = [{ cliente_id: client.id, meta_ads_act: client.meta_ads_act, period_since: '2026-09-01', period_until: '2026-09-21', status: 'partial', error_code: 'GRAPH_RATE_LIMIT', started_at: '2026-09-22' }];
  const cards = evaluateAttention({ client, goal, facts, revisions, syncItems, now });
  assert.deepEqual(cards.map((card) => card.rule), ['coverage']);
  assert.equal(cards[0].evidence.syncError, 'GRAPH_RATE_LIMIT');
});
test('intervention comparison requires both complete equal windows', () => {
  const ranges = interventionRanges('2026-09-15');
  const entry = { cliente_id: client.id, periodo_antes_inicio: ranges.beforeStart, periodo_antes_fim: ranges.beforeEnd, periodo_depois_inicio: ranges.afterStart, periodo_depois_fim: ranges.afterEnd };
  assert.equal(compareIntervention(entry, facts, 'leads', '2026-09-22').status, 'pending');
  assert.equal(compareIntervention(entry, facts, 'leads', '2026-09-24').status, 'missing');
  const complete = [...facts, { ...facts[0], data: '2026-09-22' }];
  assert.equal(compareIntervention(entry, complete, 'leads', '2026-09-24').status, 'measured');
});
