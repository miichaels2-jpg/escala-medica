// Turnos padrão de cada setor (ex.: UTI — 2 de dia 07–19 e 1 de noite 19–07).
// Ficam em company.data.sector_shift_templates = { [sectorId]: [{ specialty, start_time, end_time, quantity,
// extra_quantity, extra_weekdays }] } e preenchem o "Montar turnos do mês" da Escala.
// Vagas extras (V0.9.2): folga para encaixar alguém, só nos dias da semana escolhidos (0 = domingo).
// Ficam marcadas com EXTRA_VACANCY_TAG e continuam na escala depois de publicar (V0.9.3); vazias,
// não vão para o Mural nem contam como vaga em aberto, furo ou aviso.

export const EXTRA_VACANCY_TAG = '[VAGA_EXTRA]';
export const isExtraVacancy = shift => String(shift?.notes || '').includes(EXTRA_VACANCY_TAG);
export const WEEKDAY_INITIALS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const cleanWeekdays = value => (Array.isArray(value) ? [...new Set(value.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : []);

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
      quantity: Math.min(50, Math.max(1, parseInt(t.quantity, 10) || 1)),
      extra_quantity: cleanWeekdays(t.extra_weekdays).length ? Math.min(50, Math.max(0, parseInt(t.extra_quantity, 10) || 0)) : 0,
      extra_weekdays: (parseInt(t.extra_quantity, 10) || 0) > 0 ? cleanWeekdays(t.extra_weekdays) : []
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
  return sanitizeTemplates(list).map(t => `${t.quantity} × ${hh(t.start_time)}–${hh(t.end_time)}${t.extra_quantity ? ` (+${t.extra_quantity} extra ${extraDaysLabel(t.extra_weekdays)})` : ''}`).join(' · ');
}

// "seg, ter" · "todo dia" · "seg a sex"
export function extraDaysLabel(days) {
  const list = cleanWeekdays(days);
  if (list.length === 7) return 'todo dia';
  if (list.join() === '1,2,3,4,5') return 'seg a sex';
  if (list.join() === '0,6') return 'fim de semana';
  return list.map(d => WEEKDAY_INITIALS[d].toLowerCase()).join(', ');
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
    extra_quantity: t.extra_quantity,
    extra_weekdays: t.extra_weekdays,
    shift_type: shiftTypeFor(t.start_time)
  }));
}
