// Preferências do plantonista (V0.10.2): turno preferido, dias da semana que não faz e setores de
// interesse. Ficam em professionals.data.preferences e o próprio profissional edita na Minha Escala.
// O "Preencher automaticamente" não escala em dia que a pessoa não faz e dá prioridade a quem prefere
// o turno ou o setor; no Mural e no sino, as vagas do interesse dela aparecem primeiro.

export const PREFERRED_TURNS = [
  { id: 'qualquer', label: 'Tanto faz' },
  { id: 'dia', label: 'Prefiro diurno' },
  { id: 'noite', label: 'Prefiro noturno' }
];
const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const cleanList = (value, valid) => (Array.isArray(value) ? [...new Set(value.map(valid).filter(v => v !== null))] : []);

export function sanitizePreferences(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    turn: PREFERRED_TURNS.some(t => t.id === raw.turn) ? raw.turn : 'qualquer',
    avoid_weekdays: cleanList(raw.avoid_weekdays, d => (Number.isInteger(Number(d)) && Number(d) >= 0 && Number(d) <= 6 ? Number(d) : null)).sort(),
    interest_sector_ids: cleanList(raw.interest_sector_ids, id => (id ? String(id) : null))
  };
}

export function getPreferences(professional) {
  return sanitizePreferences(professional?.data?.preferences);
}

export const hasPreferences = prefs => prefs.turn !== 'qualquer' || prefs.avoid_weekdays.length > 0 || prefs.interest_sector_ids.length > 0;

function shiftWeekday(shift) {
  const date = String(shift?.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return new Date(`${date}T12:00:00`).getDay();
}

export function shiftTurn(shift) {
  const start = String(shift?.start_time || '07:00').padStart(5, '0');
  return start >= '18:00' || start < '06:00' ? 'noite' : 'dia';
}

// "Ana não faz plantão no domingo" quando o dia do plantão está entre os que ela não faz; senão ''.
export function avoidedDayMessage(professional, shift) {
  const day = shiftWeekday(shift);
  if (day === null || !getPreferences(professional).avoid_weekdays.includes(day)) return '';
  const first = String(professional?.name || 'O profissional').trim().split(/\s+/)[0];
  return `${first} pediu para não fazer plantão ${day === 0 || day === 6 ? 'no' : 'na'} ${WEEKDAY_NAMES[day]}`;
}

// Quanto o plantão combina com as preferências: setor de interesse vale 2, turno preferido 1,
// turno contrário -1. Usado para dar prioridade no preenchimento automático e no Mural.
export function preferenceScore(professional, shift) {
  const prefs = getPreferences(professional);
  let score = 0;
  if (prefs.interest_sector_ids.includes(String(shift?.sector_id))) score += 2;
  if (prefs.turn !== 'qualquer') score += shiftTurn(shift) === prefs.turn ? 1 : -1;
  return score;
}

export const isOfInterest = (professional, shift) => preferenceScore(professional, shift) > 0;

export function describePreferences(prefs, sectorName = id => id) {
  const parts = [];
  if (prefs.turn !== 'qualquer') parts.push(PREFERRED_TURNS.find(t => t.id === prefs.turn).label.toLowerCase());
  if (prefs.avoid_weekdays.length) parts.push(`não faz ${prefs.avoid_weekdays.map(d => WEEKDAY_NAMES[d]).join(', ')}`);
  if (prefs.interest_sector_ids.length) parts.push(`interesse em ${prefs.interest_sector_ids.map(sectorName).join(', ')}`);
  return parts.join(' · ');
}
