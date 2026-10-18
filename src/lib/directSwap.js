// Troca direta entre colegas: quais plantões de colegas podem ser trocados por um meu.
import { getShiftDateTimeRange, isShiftVacant } from './shiftLiveStatus.js';
import { getProfessionalUnitIds } from './sectorAccess.js';
import { findUnavailability } from './availability.js';

export const SWAP_TYPE = 'troca_direta';

export const SWAP_STATUS = {
  aguardando_colega: { label: 'Aguardando o colega', tone: 'amber' },
  aguardando_gestor: { label: 'Aguardando a coordenação', tone: 'sky' },
  aprovada: { label: 'Troca feita', tone: 'emerald' },
  recusada_colega: { label: 'Recusada pelo colega', tone: 'rose' },
  recusada_gestor: { label: 'Recusada pela coordenação', tone: 'rose' },
  cancelada: { label: 'Cancelada', tone: 'slate' }
};

export const OPEN_SWAP_STATUSES = ['aguardando_colega', 'aguardando_gestor'];

function overlaps(a, b) {
  return a && b && a.start < b.end && b.start < a.end;
}

// A pessoa pode ficar com `shift` se: atua na unidade, setor/especialidade compatíveis
// (isRelevant), não marcou indisponibilidade e não tem outro plantão no horário
// (ignorando o plantão que ela vai entregar na troca).
function canTake(person, shift, personShifts, givingAwayId, isRelevant) {
  const units = getProfessionalUnitIds(person);
  if (units.length && !units.includes(String(shift.unit_id))) return false;
  if (isRelevant && !isRelevant(shift, person)) return false;
  if (findUnavailability(person, shift.date)) return false;
  const range = getShiftDateTimeRange(shift);
  return !personShifts.some(s => String(s.id) !== String(givingAwayId) && overlaps(getShiftDateTimeRange(s), range));
}

export function findSwapOptions({ myShift, me, professionals, shifts, isRelevant, now = new Date(), blockedShiftIds = [] }) {
  const myRange = getShiftDateTimeRange(myShift);
  if (!myShift || !me?.id || !myRange || myRange.start <= now) return [];
  const active = (shifts || []).filter(s => s && !isShiftVacant(s) && !String(s.status || '').toLowerCase().includes('cancel'));
  const byProfessional = new Map();
  active.forEach(s => {
    const list = byProfessional.get(String(s.professional_id)) || [];
    list.push(s);
    byProfessional.set(String(s.professional_id), list);
  });
  const myShifts = byProfessional.get(String(me.id)) || [];
  const blocked = new Set((blockedShiftIds || []).map(String));

  const options = [];
  (professionals || []).forEach(colleague => {
    if (!colleague?.id || String(colleague.id) === String(me.id) || String(colleague.status || 'ativo') !== 'ativo') return;
    const theirShifts = byProfessional.get(String(colleague.id)) || [];
    // A checagem é por plantão: o choque do colega pode ser justamente com o plantão que ele entregaria.
    theirShifts.forEach(theirShift => {
      if (blocked.has(String(theirShift.id)) || String(theirShift.id) === String(myShift.id)) return;
      const range = getShiftDateTimeRange(theirShift);
      if (!range || range.start <= now) return;
      if (!canTake(colleague, myShift, theirShifts, theirShift.id, isRelevant)) return;
      if (!canTake(me, theirShift, myShifts, myShift.id, isRelevant)) return;
      options.push({ shift: theirShift, colleague });
    });
  });
  return options.sort((a, b) => getShiftDateTimeRange(a.shift).start - getShiftDateTimeRange(b.shift).start);
}
