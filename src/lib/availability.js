// Indisponibilidade informada pelo próprio profissional (férias, folga, compromisso).
// Fica em professionals.data.unavailability = [{ id, start, end, reason }], datas YYYY-MM-DD.

export const UNAVAILABILITY_REASONS = ['Férias', 'Folga', 'Licença', 'Compromisso pessoal', 'Outro'];

export function getUnavailability(professional) {
  const list = professional?.data?.unavailability;
  if (!Array.isArray(list)) return [];
  return list
    .filter(item => item && /^\d{4}-\d{2}-\d{2}$/.test(String(item.start)) && /^\d{4}-\d{2}-\d{2}$/.test(String(item.end)))
    .map(item => (item.start <= item.end ? item : { ...item, start: item.end, end: item.start }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

// Período que cobre a data (ou null). Um plantão conta pelo dia em que começa.
export function findUnavailability(professional, date) {
  const day = String(date || '').slice(0, 10);
  if (!day) return null;
  return getUnavailability(professional).find(item => day >= item.start && day <= item.end) || null;
}

export function isUnavailableForShift(professional, shift) {
  return Boolean(findUnavailability(professional, shift?.date));
}

export function describeUnavailability(item) {
  if (!item) return '';
  const br = value => value.split('-').reverse().join('/');
  const period = item.start === item.end ? br(item.start) : `${br(item.start)} a ${br(item.end)}`;
  return `${item.reason || 'Indisponível'} (${period})`;
}

// Inclui um período novo; períodos sobrepostos continuam separados (cada um com seu motivo).
export function addUnavailability(list, { start, end, reason }) {
  const [from, to] = start <= end ? [start, end] : [end, start];
  return [...(list || []), { id: `ind_${Date.now().toString(36)}`, start: from, end: to, reason: reason || 'Outro' }];
}
