import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIncomeStatement, defaultIncomeYear } from '../src/lib/incomeStatement.js';
import { buildIncomeStatementHtml } from '../src/lib/incomePrint.js';

const units = [{ id: 'u1', name: 'Hospital Norte', cnpj: '11.111.111/0001-11' }, { id: 'u2', name: 'Hospital Sul' }];
const now = new Date(2026, 10, 25, 12);
const shift = (id, date, extra = {}) => ({ id, date, unit_id: 'u1', professional_id: 'p1', start_time: '07:00', end_time: '19:00', status: 'confirmado', ...extra });

test('ano padrão do informe', () => {
  assert.equal(defaultIncomeYear(new Date(2026, 2, 10)), 2025);
  assert.equal(defaultIncomeYear(new Date(2026, 10, 25)), 2026);
});

test('plantonista: por unidade e mês, retenção, pago e futuro fora', () => {
  const professional = { id: 'p1', name: 'Ana', data: { remuneration_type: 'plantao', coop_tax_rate: 10, unit_rates: { u1: { diurno: 1000, noturno: 1200, fds: 1500 }, u2: { diurno: 800, noturno: 900, fds: 1000 } } } };
  const shifts = [
    shift('a', '2026-03-02'),                                  // segunda: 1000
    shift('b', '2026-03-03'),                                  // terça: 1000
    shift('c', '2026-04-06', { unit_id: 'u2' }),               // 800
    shift('d', '2026-12-01'),                                  // futuro: fora
    shift('e', '2025-12-01'),                                  // outro ano: fora
    shift('f', '2026-05-04', { status: 'cancelado' }),         // cancelado: fora
    shift('g', '2026-05-05', { professional_id: 'p2' })        // outro profissional
  ];
  const s = buildIncomeStatement({ professional, shifts, units, year: 2026, now, isPaid: (u, p, m) => u === 'u1' && m === '2026-03' });
  assert.equal(s.units.length, 2);
  const norte = s.units[0];
  assert.equal(norte.name, 'Hospital Norte');
  assert.deepEqual(norte.months.map(m => [m.month, m.shifts, m.gross, m.discount, m.net, m.paid]), [['2026-03', 2, 2000, 200, 1800, true]]);
  assert.equal(s.totals.gross, 2800);
  assert.equal(s.totals.net, 2520);
  assert.equal(s.totals.paidNet, 1800);
  assert.equal(s.unpaidMonths, 1);

  const html = buildIncomeStatementHtml({ statement: s, professional, company: { name: 'Grupo Saúde' }, issuedAt: now });
  assert.match(html, /Informe de rendimentos · 2026/);
  assert.match(html, /CNPJ 11\.111\.111\/0001-11/);
  assert.match(html, /comprovante oficial/);
});

test('mensalista recebe o fixo em cada mês trabalhado; produtividade fica para o fechamento', () => {
  const mensal = { id: 'p1', name: 'Bruno', data: { remuneration_type: 'mensal', unit_monthly_salaries: { u1: 9000 } } };
  const shifts = [shift('a', '2026-01-05'), shift('b', '2026-01-06'), shift('c', '2026-02-02')];
  const s = buildIncomeStatement({ professional: mensal, shifts, units, year: 2026, now });
  assert.deepEqual(s.units[0].months.map(m => [m.month, m.gross]), [['2026-01', 9000], ['2026-02', 9000]]);

  const prod = buildIncomeStatement({ professional: { id: 'p1', name: 'Carla', data: { remuneration_type: 'produtividade' } }, shifts, units, year: 2026, now });
  assert.equal(prod.totals.gross, 0);
  assert.equal(prod.pendingProduction, 3);
});
