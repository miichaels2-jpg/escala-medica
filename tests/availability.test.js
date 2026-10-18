import test from 'node:test';
import assert from 'node:assert/strict';
import { getUnavailability, findUnavailability, isUnavailableForShift, describeUnavailability, addUnavailability } from '../src/lib/availability.js';

const prof = { data: { unavailability: [
  { id: 'a', start: '2026-11-10', end: '2026-11-20', reason: 'Férias' },
  { id: 'b', start: '2026-10-25', end: '2026-10-25', reason: 'Folga' },
  { id: 'x', start: 'inválida', end: '2026-10-01' }
] } };

test('ignora períodos inválidos e ordena por data', () => {
  assert.deepEqual(getUnavailability(prof).map(item => item.id), ['b', 'a']);
  assert.deepEqual(getUnavailability({}), []);
});

test('encontra o período que cobre a data, incluindo as pontas', () => {
  assert.equal(findUnavailability(prof, '2026-11-10')?.id, 'a');
  assert.equal(findUnavailability(prof, '2026-11-20T00:00:00')?.id, 'a');
  assert.equal(findUnavailability(prof, '2026-11-21'), null);
  assert.equal(isUnavailableForShift(prof, { date: '2026-10-25', start_time: '19:00' }), true);
  assert.equal(isUnavailableForShift(prof, { date: '2026-10-24', start_time: '19:00', end_time: '07:00' }), false);
});

test('descreve e inclui períodos (datas invertidas são corrigidas)', () => {
  assert.equal(describeUnavailability(prof.data.unavailability[0]), 'Férias (10/11/2026 a 20/11/2026)');
  assert.equal(describeUnavailability(prof.data.unavailability[1]), 'Folga (25/10/2026)');
  const list = addUnavailability([], { start: '2026-12-05', end: '2026-12-01', reason: 'Licença' });
  assert.equal(list[0].start, '2026-12-01');
  assert.equal(list[0].end, '2026-12-05');
});
