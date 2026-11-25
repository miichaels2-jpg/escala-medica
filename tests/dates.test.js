import test from 'node:test';
import assert from 'node:assert/strict';
import { isCredentialExpired, parseLocalDate } from '../src/lib/dates.js';

test('data do banco lida no dia local', () => {
  const d = parseLocalDate('2026-11-25');
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 10, 25]);
  assert.equal(parseLocalDate(''), null);
  assert.equal(parseLocalDate('lixo'), null);
});

test('credencial vale até o fim do último dia', () => {
  const today = new Date(2026, 10, 25, 22, 0);
  assert.equal(isCredentialExpired('2026-11-25', today), false);
  assert.equal(isCredentialExpired('2026-11-24', today), true);
  assert.equal(isCredentialExpired('', today), false);
});
