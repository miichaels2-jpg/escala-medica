import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWelcome, firstName, greetingFor, hourLabel, isBirthday, parseBirthDate, relativeDay, upcomingBirthdays } from '../src/lib/welcome.js';

// Terça, 25/11/2026, 8h
const now = new Date(2026, 10, 25, 8, 0);

test('saudação, nome, hora e dia relativo', () => {
  assert.equal(greetingFor(now), 'Bom dia');
  assert.equal(greetingFor(new Date(2026, 10, 25, 14)), 'Boa tarde');
  assert.equal(greetingFor(new Date(2026, 10, 25, 2)), 'Boa noite');
  assert.equal(firstName('ANA souza lima'), 'Ana');
  assert.equal(hourLabel('07:00'), '7h');
  assert.equal(hourLabel('19:30'), '19h30');
  assert.equal(relativeDay('2026-11-25', now), 'hoje');
  assert.equal(relativeDay('2026-11-26', now), 'amanhã');
  assert.equal(relativeDay('2026-11-28', now), 'no sábado');
  assert.equal(relativeDay('2026-11-27', now), 'na sexta');
  assert.equal(relativeDay('2026-12-12', now), 'em 12/12');
});

test('aniversário aceita AAAA-MM-DD e DD/MM/AAAA', () => {
  assert.deepEqual(parseBirthDate('1990-11-25'), { month: 11, day: 25 });
  assert.deepEqual(parseBirthDate('25/11/1990'), { month: 11, day: 25 });
  assert.equal(parseBirthDate('ontem'), null);
  assert.equal(isBirthday('1990-11-25', now), true);
  assert.equal(isBirthday('1990-11-26', now), false);
});

test('frase de boas-vindas', () => {
  const w = buildWelcome({
    name: 'Ana Souza', now,
    nextShift: { date: '2026-11-26', start_time: '07:00', sectorName: 'UTI' },
    monthName: 'novembro', done: 8, total: 12, amount: 9600
  });
  assert.equal(w.title, 'Bom dia, Ana!');
  assert.equal(w.lines[0], 'Seu próximo plantão é amanhã, às 7h, no setor UTI.');
  assert.match(w.lines[1], /^Em novembro: 8 de 12 plantões feitos e R\$\s9\.600 a receber até agora\.$/);

  const active = buildWelcome({ name: 'Ana', now, activeShift: { end_time: '19:00', sectorName: 'PS' }, monthName: 'novembro', done: 1, total: 1, amount: null });
  assert.deepEqual(active.lines, ['Você está de plantão agora no setor PS, até 19h.', 'Em novembro: 1 de 1 plantão feito.']);

  const paid = buildWelcome({ name: 'Ana', now, monthName: 'outubro', done: 10, total: 10, paid: true });
  assert.equal(paid.lines[1], 'Em outubro: 10 de 10 plantões feitos, pagamento confirmado.');

  const birthday = buildWelcome({ name: 'Ana', now, birthday: true });
  assert.equal(birthday.title, 'Feliz aniversário, Ana!');
  assert.match(birthday.lines.at(-1), /não tem plantão marcado/);
});

test('aniversários da semana', () => {
  const list = upcomingBirthdays([
    { id: 1, name: 'Bruno', data: { birth_date: '1985-11-28' } },
    { id: 2, name: 'Ana', birth_date: '25/11/1990' },
    { id: 3, name: 'Carla', data: { birth_date: '1980-12-10' } },
    { id: 4, name: 'Davi', status: 'inativo', data: { birth_date: '1980-11-25' } }
  ], now, 7);
  assert.deepEqual(list.map(p => [p.name, p.when]), [['Ana', 'hoje'], ['Bruno', 'no sábado']]);
});
