import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveUnitId } from '../src/lib/unitAssignment.js';

test('keeps an already selected UUID unit id', () => {
  const units = [
    { id: 'uuid-hospital-1', legacy_id: 'unit_h1' },
    { id: 'uuid-hospital-2', legacy_id: 'unit_h2' }
  ];

  assert.equal(resolveUnitId(units, 'uuid-hospital-2'), 'uuid-hospital-2');
});

test('resolves a saved legacy unit id to the migrated UUID', () => {
  const units = [
    { id: 'uuid-hospital-1', legacy_id: 'unit_h1' },
    { id: 'uuid-hospital-2', legacy_id: 'unit_h2' }
  ];

  assert.equal(resolveUnitId(units, 'unit_h2'), 'uuid-hospital-2');
});

test('falls back to the first known unit when the saved id is no longer valid', () => {
  const units = [
    { id: 'uuid-hospital-1', legacy_id: 'unit_h1' },
    { id: 'uuid-hospital-2', legacy_id: 'unit_h2' }
  ];

  assert.equal(resolveUnitId(units, 'deleted-unit'), 'uuid-hospital-1');
  assert.equal(resolveUnitId([], 'deleted-unit'), '');
});
