// Alerta de furo iminente: vaga sem profissional que começa em menos de 24 h
// (ou que já começou e ainda não terminou).
import { getShiftDateTimeRange, isShiftVacant } from './shiftLiveStatus.js';
import { getProfessionalUnitIds } from './sectorAccess.js';
import { findUnavailability } from './availability.js';

export const URGENT_WINDOW_HOURS = 24;

export function getShiftUrgency(shift, now = new Date()) {
  if (!shift || String(shift.status || '').toLowerCase().includes('cancel') || !isShiftVacant(shift)) return null;
  const range = getShiftDateTimeRange(shift);
  if (!range || range.end <= now) return null;
  const minutesLeft = Math.round((range.start.getTime() - now.getTime()) / 60000);
  if (minutesLeft > URGENT_WINDOW_HOURS * 60) return null;
  const label = minutesLeft <= 0
    ? 'já começou'
    : minutesLeft < 60 ? `começa em ${minutesLeft} min` : `começa em ${Math.round(minutesLeft / 60)} h`;
  return { minutesLeft, label };
}

// Quem deve receber o aviso: ativo, atua na unidade, setor/especialidade compatíveis
// (isRelevant), não marcou indisponibilidade e não tem plantão no mesmo horário.
export function findUrgentAlerts({ shifts, professionals, isRelevant, now = new Date() }) {
  const busyByProfessional = new Map();
  (shifts || []).forEach(s => {
    if (!s?.professional_id || isShiftVacant(s) || String(s.status || '').toLowerCase().includes('cancel')) return;
    const range = getShiftDateTimeRange(s);
    if (!range) return;
    const list = busyByProfessional.get(String(s.professional_id)) || [];
    list.push(range);
    busyByProfessional.set(String(s.professional_id), list);
  });

  const alerts = [];
  (shifts || []).forEach(shift => {
    const urgency = getShiftUrgency(shift, now);
    if (!urgency) return;
    const range = getShiftDateTimeRange(shift);
    (professionals || []).forEach(prof => {
      if (!prof?.id || String(prof.status || 'ativo') !== 'ativo') return;
      const units = getProfessionalUnitIds(prof);
      if (units.length && !units.includes(String(shift.unit_id))) return;
      if (isRelevant && !isRelevant(shift, prof)) return;
      if (findUnavailability(prof, shift.date)) return;
      const busy = busyByProfessional.get(String(prof.id)) || [];
      if (busy.some(b => b.start < range.end && range.start < b.end)) return;
      alerts.push({ shift, professional: prof, urgency });
    });
  });
  return alerts;
}

export function urgentAlertKey(shift, professional) {
  return `vaga_urgente:${shift.id}:${professional.id}`;
}
