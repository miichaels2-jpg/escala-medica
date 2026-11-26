import test from 'node:test';
import assert from 'node:assert/strict';
import { isShiftPublished, paymentKey, publishedKey, sanitizeRanges } from '../src/lib/sharedState.js';

test('chaves de publicação e pagamento', () => {
  assert.equal(publishedKey('u1', 's1', '2026', '11'), 'u1|s1|2026|11');
  assert.equal(paymentKey('u1', 'p1', '2026-11'), 'u1|p1|2026-11');
});

test('keeps only well-formed publication ranges', () => {
  assert.deepEqual(
    sanitizeRanges([{ start_date: '2026-10-01', end_date: '2026-10-31', published_at: 'x' }, { start_date: 'ontem' }, null]),
    [{ start_date: '2026-10-01', end_date: '2026-10-31', published_at: 'x' }]
  );
});

test('isShiftPublished só aceita o dia dentro de um período publicado do setor', () => {
  const store = { [publishedKey('u1', 's1', 2026, 12)]: [{ start_date: '2026-12-01', end_date: '2026-12-15' }] };
  const get = (u, s, y, m) => store[publishedKey(u, s, y, m)] || [];
  assert.equal(isShiftPublished({ unit_id: 'u1', sector_id: 's1', date: '2026-12-10' }, get), true);
  assert.equal(isShiftPublished({ unit_id: 'u1', sector_id: 's1', date: '2026-12-16' }, get), false);
  assert.equal(isShiftPublished({ unit_id: 'u1', sector_id: 's2', date: '2026-12-10' }, get), false);
  assert.equal(isShiftPublished({ sector_id: 's1', date: '2026-12-01T00:00:00' }, get, 'u1'), true);
  assert.equal(isShiftPublished({ unit_id: 'u1', sector_id: 's1', date: '' }, get), false);
});
