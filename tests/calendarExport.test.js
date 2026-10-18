import test from 'node:test';
import assert from 'node:assert/strict';
import { shiftEventInfo, buildIcs, googleCalendarUrl } from '../src/lib/calendarExport.js';

const shift = { id: 'shift_1', date: '2026-10-20', start_time: '19:00', end_time: '07:00' };
const info = shiftEventInfo(shift, { unitName: 'Hospital Santa Clara', unitAddress: 'Rua das Flores, 120', sectorName: 'UTI Adulto' });

test('evento do plantão: noturno termina no dia seguinte', () => {
  assert.equal(info.title, 'Plantão · UTI Adulto · Hospital Santa Clara');
  assert.equal(info.location, 'Rua das Flores, 120');
  assert.equal(info.end.getTime() - info.start.getTime(), 12 * 3600000);
});

test('arquivo .ics com alarmes de 12 h e 1 h e texto escapado', () => {
  const ics = buildIcs([info], new Date('2026-10-18T12:00:00Z'));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /UID:shift_1@scalemedic/);
  assert.match(ics, /LOCATION:Rua das Flores\\, 120/);
  assert.match(ics, /TRIGGER:-PT12H/);
  assert.match(ics, /TRIGGER:-PT1H/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.ok(ics.split('\r\n').every(line => line.length <= 75));
});

test('link do Google Agenda com início e fim', () => {
  const url = googleCalendarUrl(info);
  assert.match(url, /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/);
  assert.match(url, /dates=\d{8}T\d{6}Z%2F\d{8}T\d{6}Z/);
});
