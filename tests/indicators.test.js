import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSuggestions, collectMovements, computeIndicators, findSafetyCases, shiftTurn, weekdayOf } from '../src/lib/indicators.js';

const profs = [
  { id: 'p1', name: 'Ana', specialty: 'Clínica Médica', status: 'ativo' },
  { id: 'p2', name: 'Bruno', specialty: 'Clínica Médica', status: 'ativo' },
  { id: 'p3', name: 'Carla', specialty: 'Pediatria', status: 'ativo' },
  { id: 'p4', name: 'Davi', specialty: 'Clínica Médica', status: 'inativo' }
];
const shift = (id, date, extra = {}) => ({ id, date, unit_id: 'u1', sector_id: 's1', start_time: '07:00', end_time: '19:00', status: 'confirmado', target_specialty: 'Clínica Médica', ...extra });

test('turno e dia da semana', () => {
  assert.equal(shiftTurn({ start_time: '07:00' }), 'manha');
  assert.equal(shiftTurn({ start_time: '13:00' }), 'tarde');
  assert.equal(shiftTurn({ start_time: '19:00' }), 'noite');
  assert.equal(shiftTurn({ start_time: '01:00' }), 'noite');
  assert.equal(weekdayOf('2026-11-01'), 0);
});

test('trocas, repasses, vagas assumidas e pendências', () => {
  const shifts = [
    shift('a', '2026-11-01', { professional_id: 'p2', notes: '[TRANSFERENCIA: Ana -> Bruno] [TRANSFER_TO: Bruno]' }),
    shift('b', '2026-11-02', { professional_id: 'p1', notes: '[ASSUNCAO_DIRETA: Ana]' }),
    shift('c', '2026-11-03', { professional_id: 'p1', notes: '[SOLICITADO_POR: Ana] [AGUARDANDO_GESTOR]' }),
    shift('d', '2026-11-04', { status: 'vago', notes: '[ORIGEM_MURAL: Bruno] [DISPONIVEL_MURAL]' }),
    shift('e', '2026-12-01', { professional_id: 'p1', notes: '[ASSUNCAO_DIRETA: Ana]' })
  ];
  const swaps = [
    { swap_type: 'troca_direta', status: 'aprovada', shift_date: '2026-11-07', requester_name: 'Ana', target_name: 'Bruno', shift_time: '07:00 às 19:00' },
    { swap_type: 'troca_direta', status: 'aguardando_colega', shift_date: '2026-11-08', requester_name: 'Bruno', target_name: 'Ana' },
    { swap_type: 'troca_direta', status: 'recusada_colega', shift_date: '2026-11-09', requester_name: 'Bruno', target_name: 'Ana' }
  ];
  const list = collectMovements({ shifts, swaps, start: '2026-11-01', end: '2026-11-30' });
  assert.deepEqual(list.map(m => [m.date, m.kind, m.status]), [
    ['2026-11-01', 'repasse', 'feita'],
    ['2026-11-02', 'vaga', 'feita'],
    ['2026-11-03', 'repasse', 'aberta'],
    ['2026-11-04', 'repasse', 'aberta'],
    ['2026-11-07', 'troca', 'feita'],
    ['2026-11-08', 'troca', 'aberta']
  ]);

  const ind = computeIndicators({ shifts, professionals: profs, swaps, start: '2026-11-01', end: '2026-11-30' });
  assert.equal(ind.movements.done, 3);
  assert.equal(ind.movements.open, 3);
  assert.equal(ind.movements.byWeekday[0], 2); // 01/11 e 08/11 são domingos
  assert.deepEqual(ind.rankings.took, [{ name: 'Ana', count: 1 }, { name: 'Bruno', count: 1 }]);
  assert.deepEqual(ind.rankings.released, [{ name: 'Ana', count: 2 }, { name: 'Bruno', count: 1 }]);
  assert.deepEqual(ind.rankings.swapped, [{ name: 'Ana', count: 1 }, { name: 'Bruno', count: 1 }]);
  assert.equal(ind.pending.length, 3);
});

test('retrato, distribuição e filtros', () => {
  const shifts = [
    shift('a', '2026-11-02', { professional_id: 'p1' }),
    shift('b', '2026-11-03', { professional_id: 'p1' }),
    shift('c', '2026-11-04', { professional_id: 'p1', start_time: '19:00', end_time: '07:00' }),
    shift('d', '2026-11-05', { professional_id: 'p2' }),
    shift('e', '2026-11-06', { status: 'vago' }),
    shift('f', '2026-11-07', { professional_id: 'p3', target_specialty: 'Pediatria', sector_id: 's2' }),
    shift('g', '2026-11-08', { professional_id: 'p1', status: 'cancelado' })
  ];
  const ind = computeIndicators({ shifts, professionals: profs, start: '2026-11-01', end: '2026-11-30', isPublished: s => s.date < '2026-11-05' });
  assert.equal(ind.portrait.total, 6);
  assert.equal(ind.portrait.vacant, 1);
  assert.equal(ind.portrait.published, 3);
  assert.equal(ind.portrait.draft, 3);
  assert.equal(ind.portrait.professionals, 3);
  assert.deepEqual(ind.portrait.turns, { manha: 5, tarde: 0, noite: 1 });
  assert.equal(ind.distribution.reference, 12);
  assert.deepEqual(ind.distribution.people.map(p => [p.name, p.hours]), [['Ana', 36], ['Bruno', 12], ['Carla', 12]]);
  assert.equal(ind.distribution.above, 1);

  const ped = computeIndicators({ shifts, professionals: profs, start: '2026-11-01', end: '2026-11-30', specialty: 'Pediatria' });
  assert.equal(ped.portrait.total, 1);
  assert.equal(ped.portrait.professionals, 1);

  const tips = buildSuggestions(ind);
  assert.match(tips.portrait, /3 plantões ainda estão em rascunho/);
  assert.match(tips.distribution, /bem acima das horas do grupo/);
});

test('segurança: plantões emendados e semana acima do limite', () => {
  const shifts = [
    shift('a', '2026-11-02', { professional_id: 'p1', start_time: '07:00', end_time: '19:00' }),
    shift('b', '2026-11-02', { professional_id: 'p1', start_time: '19:00', end_time: '07:00' }),
    shift('c', '2026-11-03', { professional_id: 'p1', start_time: '07:00', end_time: '19:00' }),
    shift('d', '2026-11-05', { professional_id: 'p1', start_time: '07:00', end_time: '19:00' }),
    shift('e', '2026-11-06', { professional_id: 'p1', start_time: '07:00', end_time: '19:00' }),
    shift('f', '2026-11-07', { professional_id: 'p1', start_time: '07:00', end_time: '19:00' })
  ];
  const cases = findSafetyCases({ shifts, start: '2026-11-01', end: '2026-11-30', rules: { max_continuous_hours: 24, max_weekly_hours: 60 }, nameOf: () => 'Ana' });
  assert.deepEqual(cases.map(c => [c.kind, c.date, c.hours]), [['semana', '2026-11-02', 72], ['emendado', '2026-11-02', 36]]);
});
