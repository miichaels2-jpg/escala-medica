import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHighlights, monthLabel, monthRange, nextMonth, percentChange, previousMonth, previousRange,
  professionalFinder, summarizeMonth, summarizePeriod
} from '../src/lib/monthSummary.js';

const plantonista = { id: 'p1', name: 'Ana Souza', data: { remuneration_type: 'plantao', unit_rates: { u1: { diurno: 1000, noturno: 1200, fds: 1500 } } } };
const mensalista = { id: 'p2', name: 'Bruno Lima', data: { remuneration_type: 'mensal', unit_monthly_salaries: { u1: 9000 } } };
const producao = { id: 'p3', name: 'Carla Dias', data: { remuneration_type: 'produtividade' } };
const getProf = professionalFinder([plantonista, mensalista, producao]);
const shift = (id, date, extra = {}) => ({ id, date, unit_id: 'u1', sector_name: 'UTI', start_time: '07:00', end_time: '19:00', ...extra });

test('meses e períodos', () => {
  assert.equal(previousMonth('2026-01'), '2025-12');
  assert.equal(nextMonth('2026-12'), '2027-01');
  assert.equal(monthLabel('2026-11'), 'novembro de 2026');
  assert.deepEqual(monthRange('2026-02'), ['2026-02-01', '2026-02-28']);
  assert.deepEqual(previousRange('2026-03-01', '2026-03-31'), ['2026-02-01', '2026-02-28']);
  assert.deepEqual(previousRange('2026-03-10', '2026-03-16'), ['2026-03-03', '2026-03-09']);
  assert.equal(percentChange(110, 100), 10);
  assert.equal(percentChange(5, 0), null);
});

test('resumo do mês: cobertura, furos, custo por regime', () => {
  const now = new Date(2026, 10, 15, 12);
  const shifts = [
    shift('a', '2026-11-02', { professional_id: 'p1' }),                       // segunda, diurno: 1000
    shift('b', '2026-11-07', { professional_id: 'p1' }),                       // sábado: 1500
    shift('c', '2026-11-03', { professional_id: 'p2' }),                       // mensal: 9000 / 3
    shift('d', '2026-11-04', { professional_id: 'p2', start_time: '19:00', end_time: '07:00' }),
    shift('e', '2026-11-05', { professional_id: 'p2', sector_name: 'PS' }),
    shift('f', '2026-11-06', { professional_id: 'p3' }),                       // produtividade
    shift('g', '2026-11-08', { professional_name: 'VAGA' }),                   // furo (passou)
    shift('h', '2026-11-20', { professional_name: 'VAGA' }),                   // vaga futura
    shift('i', '2026-11-21', { professional_id: 'p1', status: 'cancelado' }),  // ignorado
    shift('j', '2026-10-30', { professional_id: 'p1' })                        // outro mês
  ];
  const s = summarizeMonth({ shifts, month: '2026-11', getProf, now });
  assert.equal(s.total, 8);
  assert.equal(s.filled, 6);
  assert.equal(s.vacant, 2);
  assert.equal(s.overdue, 1);
  assert.equal(s.coverage, 75);
  assert.equal(s.cost, 1000 + 1500 + 9000);
  assert.equal(s.pendingProduction, 1);
  assert.equal(s.night, 1);
  assert.equal(s.day, 5);
  assert.equal(s.hours, 72);
  assert.equal(s.sectors[0].name, 'UTI');
  assert.equal(s.sectors.find(x => x.name === 'PS').cost, 3000);
  assert.equal(s.professionals[0].name, 'Bruno Lima');
  assert.equal(s.days.length, 8);
});

test('período vazio e destaques', () => {
  const empty = summarizePeriod({ shifts: [], start: '2026-11-01', end: '2026-11-30' });
  assert.equal(empty.coverage, null);
  assert.deepEqual(buildHighlights(empty, empty), ['Nenhum plantão lançado no período.']);

  const cur = { total: 10, filled: 10, vacant: 0, overdue: 0, coverage: 100, cost: 11000, hours: 120, sectors: [{ name: 'UTI', cost: 8800 }], professionals: [{}, {}] };
  const prev = { total: 10, filled: 9, vacant: 1, overdue: 1, coverage: 90, cost: 10000 };
  const text = buildHighlights(cur, prev, { previousName: 'outubro' }).join(' | ');
  assert.match(text, /subiu 10 ponto\(s\) sobre outubro/);
  assert.match(text, /escala toda preenchida/);
  assert.match(text, /10% acima de outubro/);
  assert.match(text, /UTI responde por 80%/);
});
