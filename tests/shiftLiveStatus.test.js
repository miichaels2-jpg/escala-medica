import test from 'node:test';
import assert from 'node:assert/strict';
import { getShiftDateTimeRange, isShiftActiveAt, isShiftVacant } from '../src/lib/shiftLiveStatus.js';

test('recognizes active shifts when the date is an ISO timestamp', () => {
  const shift = {
    date: '2026-10-01T00:00:00.000Z',
    start_time: '07:00',
    end_time: '19:00'
  };

  assert.equal(isShiftActiveAt(shift, new Date(2026, 9, 1, 12, 0)), true);
  assert.equal(isShiftActiveAt(shift, new Date(2026, 9, 1, 19, 0)), false);
});

test('recognizes active overnight shifts on the following date', () => {
  const shift = {
    date: '2026-10-01',
    start_time: '19:00',
    end_time: '07:00'
  };

  assert.equal(isShiftActiveAt(shift, new Date(2026, 9, 2, 1, 0)), true);
  assert.equal(getShiftDateTimeRange(shift).end.getDate(), 2);
});

test('does not treat a shift with an assigned professional as vacant because of stale status', () => {
  assert.equal(isShiftVacant({
    status: 'vago',
    professional_id: 'professional-1',
    professional_name: 'Dra. Ana'
  }), false);
});

test('still recognizes unassigned vacancy placeholders', () => {
  assert.equal(isShiftVacant({ status: 'vago', professional_id: null, professional_name: null }), true);
  assert.equal(isShiftVacant({ professional_name: 'Vaga descoberta' }), true);
});
