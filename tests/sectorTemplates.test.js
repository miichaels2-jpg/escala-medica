import test from 'node:test';
import assert from 'node:assert/strict';
import { getSectorTemplates, withSectorTemplates, templateSummary, vacanciesPerDay, templatesToSlots, sanitizeTemplates } from '../src/lib/sectorTemplates.js';

const uti = [
  { specialty: 'Medicina Intensiva', start_time: '19:00', end_time: '07:00', quantity: 1 },
  { specialty: 'Medicina Intensiva', start_time: '07:00', end_time: '19:00', quantity: '2' }
];

test('turnos inválidos ou sem especialidade são descartados; quantidade vira número', () => {
  const clean = sanitizeTemplates([...uti, { specialty: '', start_time: '07:00', end_time: '13:00' }, { specialty: 'X', start_time: '7h', end_time: '13:00' }]);
  assert.equal(clean.length, 2);
  assert.equal(clean[0].start_time, '07:00');
  assert.equal(clean[0].quantity, 2);
});

test('gravar e ler os turnos de um setor sem mexer no resto da empresa', () => {
  const data = withSectorTemplates({ workload_rules: { max_weekly_hours: 60 } }, 'sec_uti', uti);
  assert.deepEqual(data.workload_rules, { max_weekly_hours: 60 });
  assert.equal(getSectorTemplates({ data }, 'sec_uti').length, 2);
  assert.equal(getSectorTemplates({ data }, 'outro').length, 0);
  const cleared = withSectorTemplates(data, 'sec_uti', []);
  assert.equal('sec_uti' in cleared.sector_shift_templates, false);
});

test('resumo, vagas por dia e slots do gerador', () => {
  assert.equal(templateSummary(uti), '2 × 07–19 · 1 × 19–07');
  assert.equal(vacanciesPerDay(uti), 3);
  const slots = templatesToSlots(uti);
  assert.equal(slots[0].shift_type, 'diurno');
  assert.equal(slots[1].shift_type, 'noturno');
});
