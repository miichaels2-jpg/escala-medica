// Plantões na agenda do celular: arquivo .ics (iPhone, Android, Outlook) com
// alarmes 12 h e 1 h antes — tocam no aparelho mesmo com o app fechado — e
// link direto do Google Agenda para um plantão.
import { getShiftDateTimeRange } from './shiftLiveStatus.js';

function utcStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Texto do iCalendar: escapa vírgula, ponto e vírgula, barra e quebra de linha.
function icsText(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Linhas com mais de 75 caracteres são dobradas (exigência do formato).
function fold(line) {
  const parts = [];
  let rest = line;
  while (rest.length > 75) { parts.push(rest.slice(0, 75)); rest = ` ${rest.slice(75)}`; }
  parts.push(rest);
  return parts.join('\r\n');
}

export function shiftEventInfo(shift, { unitName = '', unitAddress = '', sectorName = '' } = {}) {
  const range = getShiftDateTimeRange(shift);
  if (!range) return null;
  const place = [sectorName, unitName].filter(Boolean).join(' · ');
  return {
    uid: `${shift.id}@scalemedic`,
    start: range.start,
    end: range.end,
    title: `Plantão${place ? ` · ${place}` : ''}`,
    location: unitAddress || unitName || '',
    description: `Plantão ${shift.start_time}–${shift.end_time}${sectorName ? ` no setor ${sectorName}` : ''}${unitName ? `, ${unitName}` : ''}. Gerado pelo ScaleMedic.`
  };
}

export function buildIcs(events, now = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ScaleMedic//Escala//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Meus plantões (ScaleMedic)'
  ];
  (events || []).filter(Boolean).forEach(event => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsText(event.uid)}`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${utcStamp(event.start)}`,
      `DTEND:${utcStamp(event.end)}`,
      `SUMMARY:${icsText(event.title)}`,
      ...(event.location ? [`LOCATION:${icsText(event.location)}`] : []),
      `DESCRIPTION:${icsText(event.description)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(event.title)} em 12 h`, 'TRIGGER:-PT12H', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(event.title)} em 1 h`, 'TRIGGER:-PT1H', 'END:VALARM',
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function googleCalendarUrl(event) {
  if (!event) return '';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${utcStamp(event.start)}/${utcStamp(event.end)}`,
    details: event.description,
    location: event.location || ''
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
