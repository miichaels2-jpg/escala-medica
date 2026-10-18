import test from 'node:test';
import assert from 'node:assert/strict';
import { getShiftUrgency, findUrgentAlerts, urgentAlertKey, findShiftReminders } from '../src/lib/urgentVacancies.js';

const now = new Date(2026, 9, 18, 10, 0); // 18/10/2026 10:00
const vaga = (id, date, start, end, extra = {}) => ({ id, date, start_time: start, end_time: end, status: 'vago', professional_id: null, unit_id: 'A', sector_id: 's1', ...extra });

test('urgente: começa em até 24 h ou já começou e não terminou', () => {
  assert.equal(getShiftUrgency(vaga('1', '2026-10-18', '19:00', '07:00'), now).label, 'começa em 9 h');
  assert.equal(getShiftUrgency(vaga('2', '2026-10-18', '10:30', '19:00'), now).label, 'começa em 30 min');
  assert.equal(getShiftUrgency(vaga('3', '2026-10-18', '07:00', '19:00'), now).label, 'já começou');
  assert.equal(getShiftUrgency(vaga('4', '2026-10-19', '11:00', '19:00'), now), null); // 25 h
  assert.equal(getShiftUrgency(vaga('5', '2026-10-17', '19:00', '07:00'), now), null); // já terminou
  assert.equal(getShiftUrgency({ ...vaga('6', '2026-10-18', '19:00', '07:00'), professional_id: 'p1', status: 'confirmado' }, now), null);
});

test('avisa só quem atua na unidade, é compatível, está livre e disponível', () => {
  const shifts = [
    vaga('v1', '2026-10-18', '19:00', '07:00'),
    { id: 'm1', date: '2026-10-18', start_time: '13:00', end_time: '23:00', status: 'confirmado', professional_id: 'ocupado', unit_id: 'B' }
  ];
  const professionals = [
    { id: 'livre', status: 'ativo', data: { allowed_unit_ids: ['A'] } },
    { id: 'ocupado', status: 'ativo', data: { allowed_unit_ids: ['A', 'B'] } },
    { id: 'outra_unidade', status: 'ativo', data: { allowed_unit_ids: ['B'] } },
    { id: 'ferias', status: 'ativo', data: { allowed_unit_ids: ['A'], unavailability: [{ start: '2026-10-18', end: '2026-10-20', reason: 'Férias' }] } },
    { id: 'inativo', status: 'inativo', data: { allowed_unit_ids: ['A'] } },
    { id: 'outra_esp', status: 'ativo', specialty: 'Cardiologia', data: { allowed_unit_ids: ['A'] } }
  ];
  const isRelevant = (shift, prof) => prof.specialty !== 'Cardiologia';
  const alerts = findUrgentAlerts({ shifts, professionals, isRelevant, now });
  assert.deepEqual(alerts.map(a => a.professional.id), ['livre']);
  assert.equal(urgentAlertKey(alerts[0].shift, alerts[0].professional), 'vaga_urgente:v1:livre');
});

test('lembretes do próprio plantão: 12 h e 1 h antes, só escala publicada', () => {
  const shifts = [
    { id: 'a', date: '2026-10-18', start_time: '19:00', end_time: '07:00', status: 'confirmado', professional_id: 'p1', unit_id: 'A' },
    { id: 'b', date: '2026-10-18', start_time: '10:40', end_time: '19:00', status: 'confirmado', professional_id: 'p2', unit_id: 'A' },
    { id: 'c', date: '2026-10-19', start_time: '07:00', end_time: '19:00', status: 'confirmado', professional_id: 'p3', unit_id: 'A' },
    { id: 'd', date: '2026-10-18', start_time: '15:00', end_time: '19:00', status: 'confirmado', professional_id: 'p4', unit_id: 'A' },
    { id: 'e', date: '2026-10-18', start_time: '15:00', end_time: '19:00', status: 'vago', professional_id: null, unit_id: 'A' }
  ];
  const isPublished = s => s.id !== 'd';
  const list = findShiftReminders({ shifts, isPublished, now });
  assert.deepEqual(list.map(r => `${r.shift.id}:${r.kind}`), ['a:12h', 'b:1h']);
  assert.equal(list[0].key, 'lembrete_12h:a:p1');
});
