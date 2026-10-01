import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMonthlySalaryForUnit,
  getShiftCostEstimate,
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
