export function getShiftInterval(shift) {
  if (!shift?.date) return null;
  const start = new Date(`${shift.date}T${shift.start_time || '00:00'}:00`);
  const endDate = shift.end_time && shift.start_time && shift.end_time < shift.start_time
    ? new Date(start.getTime() + 86400000)
    : start;
  const end = new Date(`${endDate.toISOString().slice(0, 10)}T${shift.end_time || '23:59'}:00`);
  return { start, end };
}

export function isShiftActiveOnDate(shift, date = new Date()) {
  const interval = getShiftInterval(shift);
  if (!interval) return false;
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  return interval.start < dayEnd && interval.end > dayStart;
}

export function isShiftCurrentlyActive(shift, now = new Date()) {
  const interval = getShiftInterval(shift);
  return Boolean(interval && interval.start <= now && interval.end > now);
}

export function formatShiftDate(shift) {
  if (!shift?.date) return '';
  const date = new Date(`${shift.date}T00:00:00`);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', weekday: 'short' }).replace('.', '');
}
