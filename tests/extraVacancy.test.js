import test from 'node:test';
import assert from 'node:assert/strict';
import { isIdleExtraSlot } from '../src/lib/shiftLiveStatus.js';
import { summarizePeriod } from '../src/lib/monthSummary.js';
import { getShiftUrgency } from '../src/lib/urgentVacancies.js';

const base = { sector_id: 's1', unit_id: 'u1', date: '2026-12-02', start_time: '07:00', end_time: '19:00' };

test('vaga extra vazia é folga: não conta como vaga em aberto; ocupada conta normalmente', () => {
  const vazia = { ...base, id: 'a', status: 'vago', notes: '[ESP:Clínica] [VAGA_EXTRA]' };
  const ocupada = { ...base, id: 'b', status: 'confirmado', professional_id: 'p1', professional_name: 'Ana', notes: '[ESP:Clínica] [VAGA_EXTRA]' };
  const normal = { ...base, id: 'c', status: 'vago', notes: '[ESP:Clínica]' };
  assert.equal(isIdleExtraSlot(vazia), true);
  assert.equal(isIdleExtraSlot(ocupada), false);
  assert.equal(isIdleExtraSlot(normal), false);
  const summary = summarizePeriod({ shifts: [vazia, ocupada, normal], start: '2026-12-01', end: '2026-12-31', now: new Date('2026-11-27T12:00:00') });
  assert.equal(summary.total, 2);
});

test('vaga extra vazia não gera aviso de vaga urgente', () => {
  const now = new Date('2026-12-02T06:00:00');
  assert.equal(getShiftUrgency({ ...base, status: 'vago', notes: '[VAGA_EXTRA]' }, now), null);
  assert.notEqual(getShiftUrgency({ ...base, status: 'vago', notes: '' }, now), null);
});
