import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthWeeks, countByProfessional, fillWeekday, pickSlotForDay, shortName, weekdayOfDate } from '../src/lib/allocationBoard.js';

const rows = [
  { id: 'a', date: '2026-12-01', start_time: '19:00' },
  { id: 'b', date: '2026-12-01', start_time: '07:00' },
  { id: 'c', date: '2026-12-08', start_time: '07:00' },
  { id: 'd', date: '2026-12-15', start_time: '07:00' },
  { id: 'e', date: '2026-12-02', start_time: '07:00' }
];
const anyone = () => '';

test('semanas de domingo a sábado', () => {
  const weeks = buildMonthWeeks(rows);
  assert.equal(weeks.length, 3);
  assert.equal(weeks[0][0].date, '2026-11-29');
  assert.equal(weeks[0][0].inRange, false);
  assert.deepEqual(weeks[0][2].rows.map(r => r.id), ['b', 'a']); // terça 01/12, por horário
  assert.equal(weeks[2][6].date, '2026-12-19');
  assert.deepEqual(buildMonthWeeks([]), []);
  assert.equal(weekdayOfDate('2026-12-01'), 2);
});

test('primeira vaga aberta em que o profissional pode ficar', () => {
  const day = rows.filter(r => r.date === '2026-12-01');
  assert.equal(pickSlotForDay(day, 'p1', {}, anyone).row.id, 'b');
  assert.equal(pickSlotForDay(day, 'p1', { b: 'p2' }, anyone).row.id, 'a');
  const noNight = row => (row.start_time === '07:00' ? 'só faz noite' : '');
  assert.equal(pickSlotForDay(day, 'p1', {}, noNight).row.id, 'a');
  assert.deepEqual(pickSlotForDay(day, 'p1', { b: 'x', a: 'y' }, anyone), { reason: 'o dia não tem vaga aberta' });
  assert.deepEqual(pickSlotForDay(day, 'p1', { a: 'y' }, noNight), { reason: 'só faz noite' });
});

test('toda terça de uma vez, sem repetir no mesmo dia', () => {
  const { draft, filled, skipped } = fillWeekday(rows, 2, 'p1', { a: 'p1' }, (row) => (row.id === 'd' ? 'indisponível' : ''));
  assert.equal(filled, 1); // 01/12 já tinha p1; 08/12 entra; 15/12 recusado
  assert.equal(fillWeekday(rows, 2, 'p1', { a: 'p1' }, (row) => (row.id === 'd' ? 'indisponível' : '')).already, 1);
  assert.equal(draft.c, 'p1');
  assert.equal(draft.b, undefined);
  assert.deepEqual(skipped, [{ date: '2026-12-15', reason: 'indisponível' }]);
});

test('nome curto e contagem', () => {
  assert.equal(shortName('Antonia Fatima Rebecca Coutinho Brito'), 'Antonia Brito');
  assert.equal(shortName('Ana Souza'), 'Ana Souza');
  assert.deepEqual(countByProfessional({ a: 'p1', b: 'p1', c: '', d: 'p2' }), { p1: 2, p2: 1 });
});

test('turnos pelo horário de entrada', async () => {
  const { listHorarios, turnName, horarioKey } = await import('../src/lib/allocationBoard.js');
  assert.equal(turnName('07:00'), 'Manhã');
  assert.equal(turnName('07:00', '13:00'), 'Manhã');
  assert.equal(turnName('07:00', '19:00'), 'Dia');
  assert.equal(turnName('13:00'), 'Tarde');
  assert.equal(turnName('19:00'), 'Noite');
  assert.equal(turnName('01:00'), 'Noite');
  assert.equal(horarioKey({ start_time: '07:00:00', end_time: '13:00:00' }), '07:00-13:00');
  const list = listHorarios([{ start_time: '19:00', end_time: '07:00' }, { start_time: '07:00', end_time: '13:00' }, { start_time: '07:00', end_time: '13:00' }]);
  assert.deepEqual(list.map(h => [h.label, h.count]), [['Manhã · 07:00–13:00', 2], ['Noite · 19:00–07:00', 1]]);
});
