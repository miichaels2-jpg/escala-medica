import test from 'node:test';
import assert from 'node:assert/strict';
import { mapDateToMonth, nextMonthOf } from '../src/lib/scheduleCopy.js';
import { checkWorkload, getWorkloadRules } from '../src/lib/workload.js';

test('copiar mantendo o dia da semana e a semana do mês', () => {
  // 05/10/2026 é a 1ª segunda de outubro; a 1ª segunda de novembro é 02/11/2026.
  assert.equal(mapDateToMonth('2026-10-05', 2026, 11, 'semana'), '2026-11-02');
  // 12/10 (2ª segunda) → 09/11
  assert.equal(mapDateToMonth('2026-10-12', 2026, 11, 'semana'), '2026-11-09');
  // 29/10 é a 5ª quinta de outubro; novembro só tem 4 quintas → não copia.
  assert.equal(mapDateToMonth('2026-10-29', 2026, 11, 'semana'), null);
});

test('copiar mantendo o número do dia', () => {
  assert.equal(mapDateToMonth('2026-10-15', 2026, 11, 'dia'), '2026-11-15');
  assert.equal(mapDateToMonth('2026-10-31', 2026, 11, 'dia'), null);
  assert.deepEqual(nextMonthOf(2026, 12), { year: 2027, month: 1 });
});

test('carga: avisa acima de 60 h na semana', () => {
  const week = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'].map((date, i) => ({ id: `s${i}`, date, start_time: '07:00', end_time: '19:00' }));
  const candidate = { id: 'c', date: '2026-10-23', start_time: '07:00', end_time: '19:00' };
  assert.equal(checkWorkload(candidate, week).length, 0); // 60 h exatas
  const extra = { id: 'c2', date: '2026-10-24', start_time: '07:00', end_time: '13:00' };
  const warnings = checkWorkload(extra, [...week, candidate]);
  assert.equal(warnings[0].type, 'semana');
  assert.equal(warnings[0].hours, 66);
});

test('carga: avisa ao emendar mais de 24 h seguidas', () => {
  const night = { id: 'n', date: '2026-10-20', start_time: '19:00', end_time: '07:00' };
  const day = { id: 'd', date: '2026-10-20', start_time: '07:00', end_time: '19:00' };
  const next = { id: 'x', date: '2026-10-21', start_time: '07:00', end_time: '13:00' };
  const warnings = checkWorkload(next, [day, night]);
  assert.equal(warnings.find(w => w.type === 'continuo').hours, 30);
  assert.equal(checkWorkload(night, [day]).length, 0); // 24 h exatas: no limite
});

test('limites configuráveis pela empresa', () => {
  assert.deepEqual(getWorkloadRules({ data: { workload_rules: { max_weekly_hours: 44 } } }), { max_weekly_hours: 44, max_continuous_hours: 24 });
});
