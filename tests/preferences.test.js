import test from 'node:test';
import assert from 'node:assert/strict';
import { avoidedDayMessage, describePreferences, getPreferences, isOfInterest, preferenceScore, sanitizePreferences } from '../src/lib/preferences.js';

const ana = { name: 'Ana Souza', data: { preferences: { turn: 'noite', avoid_weekdays: [0, '6', 9], interest_sector_ids: ['uti'] } } };

test('sanitizePreferences limpa valores inválidos', () => {
  assert.deepEqual(sanitizePreferences({ turn: 'tarde', avoid_weekdays: [3, 3, 'x'], interest_sector_ids: ['a', '', 'a'] }), { turn: 'qualquer', avoid_weekdays: [3], interest_sector_ids: ['a'] });
  assert.deepEqual(getPreferences({}), { turn: 'qualquer', avoid_weekdays: [], interest_sector_ids: [] });
});

test('dia que não faz gera aviso; os outros não', () => {
  assert.equal(avoidedDayMessage(ana, { date: '2026-12-06' }), 'Ana pediu para não fazer plantão no domingo');
  assert.equal(avoidedDayMessage(ana, { date: '2026-12-02' }), '');
  assert.equal(avoidedDayMessage({ name: 'Bia' }, { date: '2026-12-06' }), '');
});

test('pontuação: setor de interesse e turno preferido', () => {
  assert.equal(preferenceScore(ana, { sector_id: 'uti', start_time: '19:00' }), 3);
  assert.equal(preferenceScore(ana, { sector_id: 'pa', start_time: '07:00' }), -1);
  assert.equal(isOfInterest(ana, { sector_id: 'pa', start_time: '19:00' }), true);
  assert.equal(isOfInterest({}, { sector_id: 'pa', start_time: '19:00' }), false);
});

test('resumo em português', () => {
  assert.equal(describePreferences(getPreferences(ana), id => (id === 'uti' ? 'UTI' : id)), 'prefiro noturno · não faz domingo, sábado · interesse em UTI');
});
