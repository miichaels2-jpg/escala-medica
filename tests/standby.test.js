import test from 'node:test';
import assert from 'node:assert/strict';
import { getStandby, isOnStandby, standbyDaysFor, withStandby } from '../src/lib/standby.js';

test('withStandby grava, remove lista vazia e apaga listas antigas', () => {
  let data = withStandby({ outra: 1, standby: { 'u|s|2026-01-01': ['velho'] } }, 'u', 's', '2026-12-05', ['p1', 'p2', 'p1'], '2026-11-27');
  assert.deepEqual(data.standby, { 'u|s|2026-12-05': ['p1', 'p2'] });
  assert.equal(data.outra, 1);
  data = withStandby(data, 'u', 's', '2026-12-05', [], '2026-11-27');
  assert.deepEqual(data.standby, {});
});

test('leitura por plantão e próximos dias do profissional', () => {
  const company = { data: { standby: { 'u|s|2026-12-05': ['p1'], 'u|t|2026-12-01': ['p1', 'p2'], 'u|s|2026-11-20': ['p1'] } } };
  assert.deepEqual(getStandby(company, 'u', 's', '2026-12-05T00:00:00'), ['p1']);
  assert.equal(isOnStandby(company, 'p1', { unit_id: 'u', sector_id: 's', date: '2026-12-05' }), true);
  assert.equal(isOnStandby(company, 'p2', { unit_id: 'u', sector_id: 's', date: '2026-12-05' }), false);
  assert.deepEqual(standbyDaysFor(company, 'p1', '2026-11-27').map(d => d.date), ['2026-12-01', '2026-12-05']);
});
