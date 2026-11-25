import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentKey, publishedKey, sanitizeRanges } from '../src/lib/sharedState.js';

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
