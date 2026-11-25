// Funções puras da tela Escala (datas, nomes, ciclo do plantão) e o salvamento do plantão.
import { getShiftDateTimeRange, isShiftVacant } from '@/lib/shiftLiveStatus';
import { saveRow } from '@/lib/saveRow';
import { formatDateBR, getLocalDateString, normalize } from '@/lib/format';
import { escapeHtml } from '@/lib/printBranding';

export { escapeHtml, formatDateBR, getLocalDateString, normalize };

export const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const WEEKDAYS = [{ short: 'Dom', weekend: true }, { short: 'Seg', weekend: false }, { short: 'Ter', weekend: false }, { short: 'Qua', weekend: false }, { short: 'Qui', weekend: false }, { short: 'Sex', weekend: false }, { short: 'Sáb', weekend: true }];

// Intervalo real (data + hora) do plantão. Plantões que viram a noite
// (ex.: 19:00–07:00) terminam no dia seguinte.
export function getShiftRangeFor(date, startTime, endTime) {
  return getShiftDateTimeRange({ date, start_time: startTime, end_time: endTime });
}

export function shiftRangesOverlap(a, b) {
  return Boolean(a && b && a.start < b.end && b.start < a.end);
}

export function isShiftPast(shift, liveNowDate) {
  const range = getShiftDateTimeRange(shift);
  return Boolean(range && range.end < liveNowDate);
}

// Marcadores de publicação gravados nas observações do plantão.
export function stripPublicationTags(notes) {
  return String(notes || '')
    .replace(/\[ESCALA_PUBLICADA\]/gi, '')
    .replace(/\[NOTIFICACAO_ESCALA_PUBLICADA\]/gi, '')
    .replace(/\[VIGENCIA:[^\]]*\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function getShiftName(shift) {
  return shift.professional_name || shift.professional?.name || shift.professionalName || '';
}

export function isVacant(shift) {
  return isShiftVacant(shift);
}

// Os status vêm em maiúsculas (o Modo TV usa assim); na tela normal aparecem como frase.
export function sentenceCase(label) {
  const t = String(label || '').toLocaleLowerCase('pt-BR');
  return t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1);
}

// Siglas da Grade sem repetição: "CS" vira "CSi" e "CSo" quando há Carlos Silva e Carlos Souza.
export function buildShortLabels(people) {
  const parts = (name) => String(name || '').trim().split(/\s+/).filter(w => w.length > 2 || /^[A-ZÀ-Ú]/.test(w));
  const base = (p, n) => {
    const w = parts(p.name);
    if (!w.length) return '?';
    const first = w[0][0].toUpperCase();
    const last = w.length > 1 ? w[w.length - 1] : w[0].slice(1);
    return first + (last.slice(0, n).charAt(0).toUpperCase() + last.slice(1, n).toLowerCase());
  };
  const labels = {};
  let pending = people.filter(p => p?.id);
  for (let n = 1; n <= 3 && pending.length; n++) {
    const groups = {};
    pending.forEach(p => { const k = base(p, n); (groups[k] = groups[k] || []).push(p); });
    pending = [];
    Object.entries(groups).forEach(([k, list]) => {
      if (list.length === 1 || n === 3) list.forEach((p, i) => { labels[String(p.id)] = list.length > 1 ? `${k.slice(0, 2)}${i + 1}` : k; });
      else pending.push(...list);
    });
  }
  return labels;
}

// Duração do plantão em horas (o noturno que vira o dia conta certo).
export function shiftHours(shift) {
  const [sh, sm] = String(shift.start_time || '07:00').split(':').map(Number);
  const [eh, em] = String(shift.end_time || '19:00').split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return mins / 60;
}

export function computeShiftHospitalLifecycle(shift, liveNowDate) {
  if (!shift || !shift.date) {
    return { isLive: false, isConcluded: false, isProgrammed: true, isHandover: false, statusText: 'PROGRAMADO', detail: '' };
  }

  const range = getShiftDateTimeRange(shift);
  if (!range) {
    return { isLive: false, isConcluded: false, isProgrammed: true, isHandover: false, statusText: 'PROGRAMADO', detail: '' };
  }
  const { start: startExact, end: endExact } = range;

  const nowMs = liveNowDate.getTime();
  const startMs = startExact.getTime();
  const endMs = endExact.getTime();

  if (nowMs >= endMs) {
    return {
      isLive: false,
      isConcluded: true,
      isProgrammed: false,
      isHandover: false,
      statusText: 'CONCLUÍDO',
      detail: `Finalizado às ${shift.end_time}`
    };
  }

  if (nowMs >= startMs && nowMs < endMs) {
    const remainingMs = endMs - nowMs;
    const remainingMin = Math.max(1, Math.round(remainingMs / 60000));
    const isHandover = remainingMin <= 60;

    return {
      isLive: true,
      isConcluded: false,
      isProgrammed: false,
      isHandover,
      statusText: isHandover ? 'PASSAGEM DE PLANTÃO' : 'EM ANDAMENTO',
      remainingMinutes: remainingMin,
      detail: isHandover ? `Passagem: resta ${remainingMin}m` : `Resta ${Math.floor(remainingMin / 60)}h ${remainingMin % 60}m`
    };
  }

  const toStartMin = Math.round((startMs - nowMs) / 60000);
  const isIncomingHandover = toStartMin <= 60 && toStartMin > 0;

  return {
    isLive: false,
    isConcluded: false,
    isProgrammed: true,
    isHandover: isIncomingHandover,
    statusText: isIncomingHandover ? 'ASSUMINDO POSTO' : 'PROGRAMADO',
    startsInMinutes: toStartMin,
    detail: isIncomingHandover ? `Assume em ${toStartMin}m` : `Inicia às ${shift.start_time}`
  };
}

export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatFullName(name) {
  if (!name) return 'Vago';
  const parts = name.trim().split(' ');
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function extractSpecialty(shift, prof) {
  if (shift.target_specialty) return shift.target_specialty;
  const match = String(shift.notes || '').match(/\[ESP:(.*?)\]/i);
  if (match && match[1]) return match[1].trim();
  return prof?.specialty || 'Geral';
}

export function extractRetroactiveJustification(notes) {
  if (!notes) return '';
  const match = String(notes).match(/\[AJUSTE_RETROATIVO:(.*?)\]/i);
  return match && match[1] ? match[1].trim() : '';
}

// Divide um período em trechos por mês (cada mês guarda a sua publicação).
export function splitRangeByMonth(startDate, endDate) {
  const parts = [];
  if (!startDate || !endDate || startDate > endDate) return parts;
  let [year, month] = startDate.split('-').map(Number);
  const [endYear, endMonth] = endDate.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    parts.push({
      year,
      month,
      start_date: startDate > monthStart ? startDate : monthStart,
      end_date: endDate < monthEnd ? endDate : monthEnd
    });
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return parts;
}

export const autoHealingSaveShift = (id, payload) => saveRow('shifts', id, payload);
