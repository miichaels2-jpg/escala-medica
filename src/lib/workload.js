// Limite de carga horária: avisa quando uma alocação passaria do máximo semanal
// ou emendaria plantões sem descanso. Os limites podem vir de company.data.workload_rules.
import { getShiftDateTimeRange } from './shiftLiveStatus.js';

export const DEFAULT_WORKLOAD_RULES = { max_weekly_hours: 60, max_continuous_hours: 24 };

export function getWorkloadRules(company) {
  const rules = company?.data?.workload_rules || {};
  return {
    max_weekly_hours: Number(rules.max_weekly_hours) > 0 ? Number(rules.max_weekly_hours) : DEFAULT_WORKLOAD_RULES.max_weekly_hours,
    max_continuous_hours: Number(rules.max_continuous_hours) > 0 ? Number(rules.max_continuous_hours) : DEFAULT_WORKLOAD_RULES.max_continuous_hours
  };
}

// Semana de segunda a domingo que contém a data.
function weekBounds(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

const hours = (a, b) => (b.getTime() - a.getTime()) / 3600000;

// professionalShifts: plantões já atribuídos ao profissional (sem o candidato).
export function checkWorkload(candidate, professionalShifts, rules = DEFAULT_WORKLOAD_RULES) {
  const range = getShiftDateTimeRange(candidate);
  if (!range) return [];
  const others = (professionalShifts || [])
    .filter(s => s && String(s.id) !== String(candidate.id) && !String(s.status || '').toLowerCase().includes('cancel'))
    .map(getShiftDateTimeRange)
    .filter(Boolean);
  const warnings = [];

  const week = weekBounds(range.start);
  const overlapHours = r => Math.max(0, hours(new Date(Math.max(r.start, week.start)), new Date(Math.min(r.end, week.end))));
  const weekTotal = [...others, range].reduce((sum, r) => sum + overlapHours(r), 0);
  if (weekTotal > rules.max_weekly_hours) {
    warnings.push({ type: 'semana', hours: Math.round(weekTotal), message: `passaria de ${rules.max_weekly_hours} h na semana (ficaria com ${Math.round(weekTotal)} h)` });
  }

  // Bloco contínuo: junta os plantões que encostam (sem intervalo) no candidato.
  let blockStart = range.start;
  let blockEnd = range.end;
  let grew = true;
  while (grew) {
    grew = false;
    others.forEach(r => {
      if (r.end >= blockStart && r.start < blockStart) { blockStart = r.start; grew = true; }
      if (r.start <= blockEnd && r.end > blockEnd) { blockEnd = r.end; grew = true; }
    });
  }
  const continuous = hours(blockStart, blockEnd);
  if (continuous > rules.max_continuous_hours) {
    warnings.push({ type: 'continuo', hours: Math.round(continuous), message: `emendaria ${Math.round(continuous)} h seguidas sem descanso (limite ${rules.max_continuous_hours} h)` });
  }
  return warnings;
}
