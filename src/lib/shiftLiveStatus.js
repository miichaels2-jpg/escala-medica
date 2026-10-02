export function getShiftDateTimeRange(shift) {
  const date = String(shift?.date || '').slice(0, 10);
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!dateMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const parseTime = (value, fallback) => {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value || fallback));
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours <= 23 && minutes <= 59 ? { hours, minutes } : null;
  };
  const startTime = parseTime(shift.start_time, '07:00');
  const endTime = parseTime(shift.end_time, '19:00');
  if (!startTime || !endTime) return null;

  const start = new Date(year, month - 1, day, startTime.hours, startTime.minutes);
  const end = new Date(year, month - 1, day, endTime.hours, endTime.minutes);
  if (end <= start) end.setDate(end.getDate() + 1);
  if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) return null;

  return { start, end };
}

export function isShiftActiveAt(shift, now) {
  const range = getShiftDateTimeRange(shift);
  return Boolean(range && now >= range.start && now < range.end);
}

export function isShiftVacant(shift) {
  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  const name = normalize(shift?.professional_name || shift?.professional?.name || shift?.professionalName);
  const vacancyName = ['vaga', 'aberto', 'descoberto', 'sem profissional', 'plantao sem profissional']
    .some(marker => name.includes(marker));
  if (vacancyName) return true;

  const professionalId = normalize(shift?.professional_id);
  const hasProfessionalId = Boolean(professionalId) && !['vago', 'vaga', 'null', 'undefined'].includes(professionalId);
  if (hasProfessionalId || name) return false;

  const status = normalize(shift?.status);
  return ['vago', 'vaga'].includes(status) || !hasProfessionalId;
}
