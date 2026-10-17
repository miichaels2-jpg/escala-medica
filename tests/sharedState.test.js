import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLegacyPaymentKey, parseLegacyPublishedKey, readLegacySharedState, sanitizeRanges
} from '../src/lib/sharedState.js';

const units = [
  { id: '489b6232-e315-4108-9dcb-392c1075ac9b', legacy_id: 'unit_h1' },
  { id: '2464d00d-bbbf-421e-a416-7bf8fd5f5cb3', legacy_id: 'unit_h2' }
];

function fakeStorage(entries) {
  const keys = Object.keys(entries);
  return { length: keys.length, key: i => keys[i], getItem: k => entries[k] ?? null };
}

test('reads a published range saved with the legacy unit id and maps it to the UUID', () => {
  assert.deepEqual(
    parseLegacyPublishedKey('scale_published_ranges_unit_h1_sec_abc-1_2026_10', units),
    { unitId: units[0].id, sectorId: 'sec_abc-1', year: 2026, month: 10 }
  );
  assert.deepEqual(
    parseLegacyPublishedKey(`scale_published_ranges_${units[1].id}_sec_x_2026_1`, units),
    { unitId: units[1].id, sectorId: 'sec_x', year: 2026, month: 1 }
  );
  assert.equal(parseLegacyPublishedKey('scale_published_ranges_unit_h9_sec_x_2026_1', units), null);
});

test('reads paid statuses saved with unit prefix and with the oldest per-professional format', () => {
  assert.deepEqual(
    parseLegacyPaymentKey('unit_h2_prof_1_2026-09', units),
    { unitId: units[1].id, professionalId: 'prof_1', month: '2026-09' }
  );
  const storage = fakeStorage({
    scale_faturamento_pagos: JSON.stringify({
      'unit_h1_prof_a_2026-08': true,
      'unit_h1_prof_b_2026-08': false,
      'prof_c_2026-07': true
    })
  });
  const professionals = [{ id: 'prof_c', unit_id: 'unit_h2' }];
  assert.deepEqual(readLegacySharedState(storage, units, professionals).payments, [
    { unitId: units[0].id, professionalId: 'prof_a', month: '2026-08' },
    { unitId: units[1].id, professionalId: 'prof_c', month: '2026-07' }
  ]);
});

test('keeps only well-formed publication ranges', () => {
  assert.deepEqual(
    sanitizeRanges([{ start_date: '2026-10-01', end_date: '2026-10-31', published_at: 'x' }, { start_date: 'ontem' }, null]),
    [{ start_date: '2026-10-01', end_date: '2026-10-31', published_at: 'x' }]
  );
});
