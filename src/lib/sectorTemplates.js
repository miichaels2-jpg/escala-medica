// Turnos padrão de cada setor (ex.: UTI — 2 de dia 07–19 e 1 de noite 19–07).
// Ficam em company.data.sector_shift_templates = { [sectorId]: [{ specialty, start_time, end_time, quantity }] }
// e preenchem o "Montar turnos do mês" da Escala.

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function shiftTypeFor(startTime) {
  return startTime >= '18:00' || startTime < '06:00' ? 'noturno' : 'diurno';
}

export function sanitizeTemplates(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(t => t && TIME.test(String(t.start_time)) && TIME.test(String(t.end_time)))
    .map(t => ({
      specialty: String(t.specialty || '').trim(),
      start_time: String(t.start_time),
      end_time: String(t.end_time),
      quantity: Math.min(50, Math.max(1, parseInt(t.quantity, 10) || 1))
    }))
    .filter(t => t.specialty)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function getSectorTemplates(company, sectorId) {
  const all = company?.data?.sector_shift_templates;
  if (!sectorId || !all || typeof all !== 'object') return [];
  return sanitizeTemplates(all[String(sectorId)]);
}

// Dados da empresa com os turnos do setor trocados (lista vazia remove o setor).
export function withSectorTemplates(companyData, sectorId, list) {
  const data = { ...(companyData || {}) };
  const all = { ...(data.sector_shift_templates || {}) };
  const clean = sanitizeTemplates(list);
  if (clean.length) all[String(sectorId)] = clean;
  else delete all[String(sectorId)];
  data.sector_shift_templates = all;
  return data;
}

const hh = time => String(time).replace(/:00$/, '');

// "2 × 07–19 · 1 × 19–07"
export function templateSummary(list) {
  return sanitizeTemplates(list).map(t => `${t.quantity} × ${hh(t.start_time)}–${hh(t.end_time)}`).join(' · ');
}

export function vacanciesPerDay(list) {
  return sanitizeTemplates(list).reduce((sum, t) => sum + t.quantity, 0);
}

// Slots no formato do gerador da Escala.
export function templatesToSlots(list) {
  return sanitizeTemplates(list).map((t, i) => ({
    id: `slot_tpl_${i + 1}`,
    specialty: t.specialty,
    start_time: t.start_time,
    end_time: t.end_time,
    quantity: t.quantity,
    shift_type: shiftTypeFor(t.start_time)
  }));
}
