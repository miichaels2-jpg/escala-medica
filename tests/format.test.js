import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrency, formatDateBR, getLocalDateString, normalize, safeNumber } from '../src/lib/format.js';

test('texto para comparar', () => {
  assert.equal(normalize(' Clínica Médica '), 'clinica medica');
  assert.equal(normalize(null), '');
});

test('datas', () => {
  assert.equal(getLocalDateString(new Date(2026, 10, 5, 23, 59)), '2026-11-05');
  assert.equal(formatDateBR('2026-11-25'), '25/11/2026');
  assert.equal(formatDateBR('2026-11-25T10:00:00'), '25/11/2026');
  assert.equal(formatDateBR(''), '');
  assert.equal(formatDateBR(null, '—'), '—');
});

test('valores: ponto de milhar não vira centavo', () => {
  assert.equal(safeNumber('12.500'), 12500);
  assert.equal(safeNumber('R$ 1.234,56'), 1234.56);
  assert.equal(safeNumber('1200,5'), 1200.5);
  assert.equal(safeNumber('', 7), 7);
  assert.equal(formatCurrency(1234.5).replace(/\s/g, ' '), 'R$ 1.234,50');
});
