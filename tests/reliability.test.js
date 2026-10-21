import test from 'node:test';
import assert from 'node:assert/strict';
import { computeReliability } from '../src/lib/reliability.js';

const now = new Date(2026, 9, 21, 12, 0);
const s = (id, prof, date, extra = {}) => ({ id, professional_id: prof, professional_name: prof, date, start_time: '07:00', end_time: '19:00', status: 'confirmado', ...extra });
const ana = { id: 'ana', name: 'Ana Souza' };
const bia = { id: 'bia', name: 'Bia Lima' };

test('cobertura, repasse e índice de confiabilidade', () => {
  const shifts = [
    s('1', 'ana', '2026-10-05'),
    s('2', 'ana', '2026-10-06'),
    // Ana repassou este plantão e a Bia assumiu pelo Mural.
    s('3', 'bia', '2026-10-07', { notes: '[ORIGEM_MURAL: Ana Souza] [TRANSFERENCIA: Ana Souza -> Bia Lima] [TRANSFER_TO: Bia Lima]' }),
    // Vaga aberta assumida pela Bia.
    s('4', 'bia', '2026-10-08', { notes: '[ASSUNCAO_DIRETA: Bia Lima]' }),
    s('5', 'bia', '2026-10-30'),
    // Ana pediu para repassar e ainda aguarda a coordenação (continua dela, conta como repasse).
    s('6', 'ana', '2026-10-28', { notes: '[SOLICITADO_POR: Ana Souza] [SOLICITADO_ID: ana] [AGUARDANDO_GESTOR]' })
  ];
  const swaps = [{ swap_type: 'troca_direta', status: 'aprovada', requester_professional_id: 'bia', target_professional_id: 'ana', shift_date: '2026-10-10', target_shift_date: '2026-10-12' }];
  const rows = computeReliability({ shifts, professionals: [ana, bia], swaps, start: '2026-10-01', end: '2026-10-31', now });
  const byId = Object.fromEntries(rows.map(r => [r.id, r]));

  assert.equal(byId.bia.covered, 2);
  assert.equal(byId.bia.released, 0);
  assert.equal(byId.bia.index, 100);
  assert.equal(byId.bia.done, 2); // 07/10 e 08/10 (30/10 ainda não aconteceu)
  assert.equal(byId.ana.released, 2); // 07/10 (já assumido) e 28/10 (aguardando)
  assert.equal(byId.ana.index, 50); // manteve 2 (05 e 06) de 4 compromissos; o de 28/10 está em repasse
  assert.equal(byId.ana.directSwaps, 1);
  assert.deepEqual(rows.map(r => r.id), ['bia', 'ana']);
});

test('quem não teve plantão no período não entra', () => {
  assert.deepEqual(computeReliability({ shifts: [], professionals: [ana], now }), []);
});
