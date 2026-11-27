import test from 'node:test';
import assert from 'node:assert/strict';
import { findSwapOptions } from '../src/lib/directSwap.js';

const now = new Date(2026, 9, 18, 12, 0);
const unit = 'A';
const s = (id, prof, date, start, end, extra = {}) => ({ id, professional_id: prof, date, start_time: start, end_time: end, status: 'confirmado', unit_id: unit, sector_id: 'uti', ...extra });
const me = { id: 'me', status: 'ativo', specialty: 'Clínica', data: { allowed_unit_ids: [unit] } };
const ana = { id: 'ana', status: 'ativo', specialty: 'Clínica', data: { allowed_unit_ids: [unit] } };
const bia = { id: 'bia', status: 'ativo', specialty: 'Cardiologia', data: { allowed_unit_ids: [unit] } };
const isRelevant = (shift, prof) => !shift.spec || shift.spec === prof.specialty;

test('lista plantões de colegas que dá para trocar nos dois sentidos', () => {
  const myShift = s('m1', 'me', '2026-10-20', '07:00', '19:00');
  const shifts = [myShift, s('a1', 'ana', '2026-10-22', '07:00', '19:00'), s('b1', 'bia', '2026-10-23', '07:00', '19:00', { spec: 'Cardiologia' })];
  const options = findSwapOptions({ myShift, me, professionals: [me, ana, bia], shifts, isRelevant, now });
  // Bia não serve: eu não sou cardiologista para ficar com o plantão dela.
  assert.deepEqual(options.map(o => o.shift.id), ['a1']);
});

test('trocar o mesmo horário entre setores não é choque; outro plantão no horário é', () => {
  const myShift = s('m1', 'me', '2026-10-20', '07:00', '19:00');
  const sameTime = s('a1', 'ana', '2026-10-20', '07:00', '19:00', { sector_id: 'emergencia' });
  const anaBusy = s('a2', 'ana', '2026-10-21', '07:00', '19:00');
  const meBusy = s('m2', 'me', '2026-10-21', '10:00', '16:00');
  const options = findSwapOptions({ myShift, me, professionals: [me, ana], shifts: [myShift, sameTime, anaBusy, meBusy], isRelevant, now });
  // a1: troca simples no mesmo horário → ok. a2: eu já estou ocupado nesse horário (m2) → fora.
  assert.deepEqual(options.map(o => o.shift.id), ['a1']);
});

test('respeita férias, plantões já passados e pedidos em aberto', () => {
  const myShift = s('m1', 'me', '2026-10-20', '07:00', '19:00');
  const anaFerias = { ...ana, data: { ...ana.data, unavailability: [{ start: '2026-10-20', end: '2026-10-20', reason: 'Férias' }] } };
  const shifts = [myShift, s('a1', 'ana', '2026-10-25', '07:00', '19:00'), s('a0', 'ana', '2026-10-17', '07:00', '19:00')];
  assert.equal(findSwapOptions({ myShift, me, professionals: [me, anaFerias], shifts, isRelevant, now }).length, 0);
  assert.deepEqual(findSwapOptions({ myShift, me, professionals: [me, ana], shifts, isRelevant, now }).map(o => o.shift.id), ['a1']);
  assert.equal(findSwapOptions({ myShift, me, professionals: [me, ana], shifts, isRelevant, now, blockedShiftIds: ['a1'] }).length, 0);
});

test('explainNoSwapOptions diz por que cada colega não serve', async () => {
  const { explainNoSwapOptions } = await import('../src/lib/directSwap.js');
  const now = new Date('2026-11-27T12:00:00');
  const me = { id: 'm', name: 'Michael Silva', status: 'ativo', data: { allowed_unit_ids: ['u'], authorized_sectors: ['emerg'] } };
  const ana = { id: 'a', name: 'Ana Souza', status: 'ativo', data: { allowed_unit_ids: ['u'], authorized_sectors: ['emerg', 'enf'] } };
  const myShift = { id: 's1', unit_id: 'u', sector_id: 'emerg', date: '2026-12-02', start_time: '07:00', end_time: '19:00', professional_id: 'm', status: 'confirmado' };
  const hers = { id: 's2', unit_id: 'u', sector_id: 'enf', date: '2026-12-03', start_time: '07:00', end_time: '19:00', professional_id: 'a', status: 'confirmado' };
  const auth = (p, sector) => (p.data.authorized_sectors || []).includes(sector);
  const lines = explainNoSwapOptions({ myShift, me, professionals: [me, ana], shifts: [myShift, hers], isAuthorized: auth, isRelevant: (s, p) => auth(p, s.sector_id), sectorName: id => ({ enf: 'Enfermaria', emerg: 'Emergência' }[id]), now });
  assert.deepEqual(lines, ['Ana: os plantões dele são em Enfermaria, onde você não está liberado.']);
  assert.match(explainNoSwapOptions({ myShift, me, professionals: [me], shifts: [myShift], now })[0], /Nenhum colega/);
});
