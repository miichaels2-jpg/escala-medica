// Quadro de montagem da escala (V0.8.2): o mês em calendário, com as vagas de cada dia, para
// arrastar ou "pintar" o profissional nos dias em vez de escolher vaga por vaga.
// reasonFor(row, profId, draft) devolve '' quando o profissional pode ficar na vaga, ou o motivo.

const DAY_MS = 86400000;

function parseDay(date) {
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

export function weekdayOfDate(date) {
  return parseDay(date).getUTCDay();
}

const byTime = (a, b) => String(a.start_time).localeCompare(String(b.start_time)) || String(a.id).localeCompare(String(b.id));

// Semanas de domingo a sábado cobrindo do primeiro ao último dia com vaga.
export function buildMonthWeeks(rows) {
  const byDate = new Map();
  (rows || []).forEach(row => {
    const key = String(row.date).slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(row);
  });
  if (byDate.size === 0) return [];
  const dates = [...byDate.keys()].sort();
  const first = parseDay(dates[0]);
  const last = parseDay(dates[dates.length - 1]);
  const start = new Date(first.getTime() - first.getUTCDay() * DAY_MS);
  const end = new Date(last.getTime() + (6 - last.getUTCDay()) * DAY_MS);
  const weeks = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 7 * DAY_MS) {
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const date = dayKey(new Date(t + i * DAY_MS));
      days.push({ date, inRange: date >= dates[0] && date <= dates[dates.length - 1], rows: (byDate.get(date) || []).slice().sort(byTime) });
    }
    weeks.push(days);
  }
  return weeks;
}

// Primeira vaga aberta do dia em que o profissional pode ficar.
export function pickSlotForDay(dayRows, profId, draft, reasonFor) {
  const open = (dayRows || []).filter(row => !draft[String(row.id)]).sort(byTime);
  if (open.length === 0) return { reason: 'o dia não tem vaga aberta' };
  let firstReason = '';
  for (const row of open) {
    const reason = reasonFor(row, profId, draft);
    if (!reason) return { row };
    if (!firstReason) firstReason = reason;
  }
  return { reason: firstReason };
}

// Coloca o profissional em todos os dias daquele dia da semana (ex.: toda segunda).
export function fillWeekday(rows, weekday, profId, draft, reasonFor) {
  const next = { ...draft };
  const dates = [...new Set((rows || []).map(row => String(row.date).slice(0, 10)))]
    .filter(date => weekdayOfDate(date) === weekday)
    .sort();
  let filled = 0;
  let already = 0;
  const skipped = [];
  dates.forEach(date => {
    const dayRows = rows.filter(row => String(row.date).slice(0, 10) === date);
    if (dayRows.some(row => String(next[String(row.id)]) === String(profId))) { already += 1; return; }
    const pick = pickSlotForDay(dayRows, profId, next, reasonFor);
    if (pick.row) {
      next[String(pick.row.id)] = String(profId);
      filled += 1;
    } else {
      skipped.push({ date, reason: pick.reason });
    }
  });
  return { draft: next, filled, already, skipped };
}

// "Ana Fatima Rebecca Coutinho Brito" -> "Ana Brito", para caber no quadro.
export function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(' ');
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function countByProfessional(draft) {
  const load = {};
  Object.values(draft || {}).forEach(id => { if (id) load[String(id)] = (load[String(id)] || 0) + 1; });
  return load;
}

// Horários (turnos) das vagas: o gestor escolhe em qual pôr o profissional, nada de encaixe automático.
// Plantão de 10 h ou mais que começa de manhã é "Dia" (ex.: 07–19).
export function turnName(startTime, endTime) {
  const hour = Number(String(startTime || '').slice(0, 2));
  if (!Number.isFinite(hour)) return 'Turno';
  const end = endTime ? Number(String(endTime).slice(0, 2)) : NaN;
  const length = Number.isFinite(end) ? (end - hour + 24) % 24 : 0;
  if (hour >= 5 && hour < 12) return length >= 10 ? 'Dia' : 'Manhã';
  if (hour >= 12 && hour < 18) return 'Tarde';
  return 'Noite';
}

export function horarioKey(row) {
  return `${String(row?.start_time || '').slice(0, 5)}-${String(row?.end_time || '').slice(0, 5)}`;
}

// [{ key, start, end, label, count }] na ordem do dia, ex.: "Manhã · 07:00–13:00".
export function listHorarios(rows) {
  const map = new Map();
  (rows || []).forEach(row => {
    const key = horarioKey(row);
    if (!map.has(key)) {
      const start = String(row.start_time || '').slice(0, 5);
      const end = String(row.end_time || '').slice(0, 5);
      map.set(key, { key, start, end, label: `${turnName(start, end)} · ${start}–${end}`, count: 0 });
    }
    map.get(key).count += 1;
  });
  return [...map.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}
