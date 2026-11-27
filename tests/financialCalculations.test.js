import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMonthlySalaryForUnit,
  getShiftCostEstimate,
  getRetentionRate,
  getSectorRates,
  withSectorRates,
  getShiftDurationHours,
  safeFinancialNumber
} from '../src/lib/financialCalculations.js';
import { inferUnassignedShiftUnitId } from '../src/lib/unitAssignment.js';

test('uses the salary configured for the shift unit and does not borrow another unit salary', () => {
  const professional = {
    id: 'prof-1',
    unit_id: 'unit-1',
    data: { unit_monthly_salaries: { 'unit-1': 'R$ 8.000,00', 'unit-2': '9000' } }
  };

  assert.deepEqual(getMonthlySalaryForUnit(professional, 'unit-1'), { value: 8000, missing: false });
  assert.deepEqual(getMonthlySalaryForUnit(professional, 'unit-2'), { value: 9000, missing: false });
  assert.deepEqual(getMonthlySalaryForUnit(professional, 'unit-3'), { value: 0, missing: true });
});

test('applies the legacy monthly salary only to the primary unit', () => {
  const professional = { unit_id: 'unit-1', monthly_salary: '7.500,00' };
  const withoutUnit = { monthly_salary: '7.500,00' };

  assert.deepEqual(getMonthlySalaryForUnit(professional, 'unit-1'), { value: 7500, missing: false });
  assert.deepEqual(getMonthlySalaryForUnit(professional, 'unit-2'), { value: 0, missing: true });
  assert.deepEqual(getMonthlySalaryForUnit(withoutUnit, 'unit-1'), { value: 0, missing: true });
});

test('parses Brazilian-formatted thousands and decimal separators correctly', () => {
  assert.equal(safeFinancialNumber('1.000'), 1000);
  assert.equal(safeFinancialNumber('1.000,50'), 1000.5);
  assert.equal(safeFinancialNumber('1,000.50'), 1000.5);
});

test('calculates monthly operational cost at one twentieth of the unit salary', () => {
  const estimate = getShiftCostEstimate({
    unit_id: 'unit-1',
    data: { remuneration_type: 'mensal', unit_monthly_salaries: { 'unit-1': 8000 } }
  }, { unit_id: 'unit-1' });

  assert.deepEqual(estimate, { amount: 400, missingRate: false });
});

test('calculates hourly and daily rates without inventing fallback rates', () => {
  const hourly = getShiftCostEstimate(
    { data: { remuneration_type: 'hora', hourly_rate: 150 } },
    { start_time: '19:00', end_time: '07:00' }
  );
  const missingHourly = getShiftCostEstimate(
    { data: { remuneration_type: 'hora' } },
    { start_time: '07:00', end_time: '19:00' }
  );
  const daily = getShiftCostEstimate(
    { data: { remuneration_type: 'diaria', daily_rate: '1.200,50' } },
    { start_time: '07:00', end_time: '19:00' }
  );

  assert.deepEqual(hourly, { amount: 1800, missingRate: false });
  assert.deepEqual(missingHourly, { amount: 0, missingRate: true });
  assert.deepEqual(daily, { amount: 1200.5, missingRate: false });
});

test('marks productivity-based shifts as awaiting production entry', () => {
  assert.deepEqual(
    getShiftCostEstimate(
      { data: { remuneration_type: 'produtividade' } },
      { unit_id: 'unit-1', start_time: '07:00', end_time: '19:00' }
    ),
    { amount: 0, missingRate: false, requiresProduction: true }
  );
});

test('selects the weekend shift tariff before considering day or night tariff', () => {
  const professional = {
    data: {
      remuneration_type: 'plantao',
      unit_rates: { 'unit-1': { diurno: 500, noturno: 700, fds: 900 } }
    }
  };

  assert.deepEqual(
    getShiftCostEstimate(professional, {
      unit_id: 'unit-1', date: '2025-01-04', start_time: '19:00', shift_type: 'noturno'
    }),
    { amount: 900, missingRate: false }
  );
  assert.deepEqual(
    getShiftCostEstimate(professional, {
      unit_id: 'unit-1', date: '2025-01-06', start_time: '19:00', shift_type: 'noturno'
    }),
    { amount: 700, missingRate: false }
  );
});

test('returns zero hours for an invalid time range instead of assuming a twelve-hour shift', () => {
  assert.equal(getShiftDurationHours({ start_time: 'not-a-time', end_time: '19:00' }), 0);
  assert.equal(getShiftDurationHours({ start_time: '19:00', end_time: '07:00' }), 12);
});

test('infers an unassigned shift unit only from unique, valid evidence', () => {
  const units = [{ id: 'unit-1' }, { id: 'unit-2' }];

  assert.equal(inferUnassignedShiftUnitId({ units, sectorUnitId: 'unit-2' }), 'unit-2');
  assert.equal(inferUnassignedShiftUnitId({ units, professionalUnitIds: ['unit-1'] }), 'unit-1');
  assert.equal(inferUnassignedShiftUnitId({ units, professionalUnitIds: ['unit-1', 'unit-2'] }), null);
  assert.equal(inferUnassignedShiftUnitId({ units }), null);
  assert.equal(inferUnassignedShiftUnitId({ units: [{ id: 'unit-1' }] }), 'unit-1');
});

test('treats a professional without remuneration type as per-shift, like the registration and billing screens', () => {
  const professional = { data: { unit_rates: { 'unit-1': { diurno: 900, noturno: 1100, fds: 1300 } } } };
  assert.deepEqual(
    getShiftCostEstimate(professional, { unit_id: 'unit-1', date: '2026-10-14', start_time: '07:00', end_time: '19:00' }),
    { amount: 900, missingRate: false }
  );
});

test('classifies an unpadded night start time as night shift', () => {
  const professional = { data: { remuneration_type: 'plantao', unit_rates: { 'unit-1': { diurno: 900, noturno: 1100 } } } };
  assert.equal(
    getShiftCostEstimate(professional, { unit_id: 'unit-1', date: '2026-10-14', start_time: '7:00', end_time: '19:00' }).amount,
    900
  );
});

test('tabela do setor vale para quem não tem valor próprio; o valor do cadastro vence campo a campo', () => {
  const company = { data: { sector_rates: { 'sec-1': { semana_dia: 800, semana_noite: 1000, fds_dia: 1100, fds_noite: 1300, meio: 450 } } } };
  const semValor = { data: { remuneration_type: 'plantao' } };
  const comExcecao = { data: { remuneration_type: 'plantao', unit_rates: { 'unit-1': { diurno: 950 } } } };
  const base = { unit_id: 'unit-1', sector_id: 'sec-1' };
  // quarta-feira diurno e noturno, sábado diurno e noturno
  assert.deepEqual(getShiftCostEstimate(semValor, { ...base, date: '2026-12-02', start_time: '07:00', end_time: '19:00' }, company), { amount: 800, missingRate: false });
  assert.equal(getShiftCostEstimate(semValor, { ...base, date: '2026-12-02', start_time: '19:00', end_time: '07:00' }, company).amount, 1000);
  assert.equal(getShiftCostEstimate(semValor, { ...base, date: '2026-12-05', start_time: '07:00', end_time: '19:00' }, company).amount, 1100);
  assert.equal(getShiftCostEstimate(semValor, { ...base, date: '2026-12-05', start_time: '19:00', end_time: '07:00' }, company).amount, 1300);
  // exceção do profissional só no diurno de semana
  assert.equal(getShiftCostEstimate(comExcecao, { ...base, date: '2026-12-02', start_time: '07:00', end_time: '19:00' }, company).amount, 950);
  assert.equal(getShiftCostEstimate(comExcecao, { ...base, date: '2026-12-02', start_time: '19:00', end_time: '07:00' }, company).amount, 1000);
  // sem tabela nem valor próprio: falta valor
  assert.deepEqual(getShiftCostEstimate(semValor, { ...base, sector_id: 'outro', date: '2026-12-02', start_time: '07:00', end_time: '19:00' }, company), { amount: 0, missingRate: true });
});

test('meio expediente (até 6 h) usa o valor próprio; sem ele, segue a tabela normal', () => {
  const company = { data: { sector_rates: { 'sec-1': { semana_dia: 800, meio: 450 }, 'sec-2': { semana_dia: 800 } } } };
  const prof = { data: { remuneration_type: 'plantao' } };
  assert.equal(getShiftCostEstimate(prof, { unit_id: 'u', sector_id: 'sec-1', date: '2026-12-02', start_time: '07:00', end_time: '13:00' }, company).amount, 450);
  assert.equal(getShiftCostEstimate(prof, { unit_id: 'u', sector_id: 'sec-1', date: '2026-12-02', start_time: '07:00', end_time: '19:00' }, company).amount, 800);
  assert.equal(getShiftCostEstimate(prof, { unit_id: 'u', sector_id: 'sec-2', date: '2026-12-02', start_time: '07:00', end_time: '13:00' }, company).amount, 800);
});

test('retenção: exceção do cadastro, valor antigo maior que zero ou padrão do estabelecimento', () => {
  const company = { data: { default_retention_rate: 11 } };
  assert.equal(getRetentionRate({ data: {} }, company), 11);
  assert.equal(getRetentionRate({ data: { coop_tax_rate: 0 } }, company), 11);
  assert.equal(getRetentionRate({ data: { coop_tax_rate: 5 } }, company), 5);
  assert.equal(getRetentionRate({ data: { coop_tax_rate: 0, retention_override: true } }, company), 0);
  assert.equal(getRetentionRate({ data: { coop_tax_rate: 5, retention_override: false } }, company), 11);
  assert.equal(getRetentionRate({ data: {} }, null), 0);
});

test('withSectorRates guarda só números e remove a tabela vazia', () => {
  const data = withSectorRates({ outra: 1 }, 'sec-1', { semana_dia: '800', meio: '', fds_dia: 'x' });
  assert.deepEqual(data.sector_rates, { 'sec-1': { semana_dia: 800 } });
  assert.equal(data.outra, 1);
  assert.deepEqual(withSectorRates(data, 'sec-1', {}).sector_rates, {});
  assert.deepEqual(getSectorRates({ data }, 'sec-1'), { semana_dia: 800 });
});

test('meio expediente tem dia/noite de semana e de fim de semana; chave antiga "meio" fica de reserva', () => {
  const company = { data: { sector_rates: {
    novo: { semana_dia: 800, meio_semana_dia: 400, meio_semana_noite: 500, meio_fds_dia: 600, meio_fds_noite: 700 },
    antigo: { semana_dia: 800, meio: 450 }
  } } };
  const prof = { data: { remuneration_type: 'plantao' } };
  const half = (sector, date, start, end) => getShiftCostEstimate(prof, { unit_id: 'u', sector_id: sector, date, start_time: start, end_time: end }, company).amount;
  assert.equal(half('novo', '2026-12-02', '07:00', '13:00'), 400);
  assert.equal(half('novo', '2026-12-02', '19:00', '01:00'), 500);
  assert.equal(half('novo', '2026-12-05', '07:00', '13:00'), 600);
  assert.equal(half('novo', '2026-12-05', '19:00', '01:00'), 700);
  assert.equal(half('antigo', '2026-12-05', '19:00', '01:00'), 450);
});
