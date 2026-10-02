import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateProductivityPoolAllocations } from '../src/lib/productivityCalculations.js';

test('splits the daily pool proportionally by provider volume and allocates all cents', () => {
  const attendanceCounts = [35, 57, 63, 26, 42];
  const allocations = calculateProductivityPoolAllocations(attendanceCounts.map((count, index) => ({
    id: `2026-09-01:prof-${index + 1}`,
    date: '2026-09-01',
    professional_id: `prof-${index + 1}`,
    attendance_count: count
  })));

  assert.deepEqual(
    [...allocations.allocationsByProfessional.values()],
    [23.54, 38.34, 42.38, 17.49, 28.25]
  );
  assert.equal([...allocations.allocationsByProfessional.values()].reduce((sum, amount) => sum + amount, 0), 150);
  assert.deepEqual(allocations.dailyTotals.get('2026-09-01'), { totalAttendances: 223, poolAmount: 150 });
});

test('applies the full daily pool independently to each date', () => {
  const allocations = calculateProductivityPoolAllocations([
    { id: 'd1:p1', date: '2026-09-01', professional_id: 'p1', attendance_count: 10 },
    { id: 'd1:p2', date: '2026-09-01', professional_id: 'p2', attendance_count: 10 },
    { id: 'd2:p1', date: '2026-09-02', professional_id: 'p1', attendance_count: 5 },
    { id: 'd2:p2', date: '2026-09-02', professional_id: 'p2', attendance_count: 15 }
  ], 150);

  assert.equal(allocations.allocationsByDateAndProfessional.get('2026-09-01:p1'), 75);
  assert.equal(allocations.allocationsByDateAndProfessional.get('2026-09-02:p1'), 37.5);
  assert.equal(allocations.dailyTotals.get('2026-09-01').poolAmount, 150);
  assert.equal(allocations.dailyTotals.get('2026-09-02').poolAmount, 150);
});

test('withholds a daily pool until every scheduled provider has an attendance count', () => {
  const allocations = calculateProductivityPoolAllocations([
    { id: 'd1:p1', date: '2026-09-01', professional_id: 'p1', attendance_count: 20 },
    { id: 'd1:p2', date: '2026-09-01', professional_id: 'p2', attendance_count: null }
  ]);

  assert.equal(allocations.allocationsByProfessional.size, 0);
  assert.equal(allocations.incompleteDates.get('2026-09-01'), 1);
  assert.deepEqual(allocations.dailyTotals.get('2026-09-01'), { totalAttendances: null, poolAmount: null });
});

test('keeps completed daily earnings available while another date is still incomplete', () => {
  const allocations = calculateProductivityPoolAllocations([
    { id: 'complete:p1', date: '2026-09-01', professional_id: 'p1', attendance_count: 30 },
    { id: 'complete:p2', date: '2026-09-01', professional_id: 'p2', attendance_count: 70 },
    { id: 'pending:p1', date: '2026-09-02', professional_id: 'p1', attendance_count: 20 },
    { id: 'pending:p2', date: '2026-09-02', professional_id: 'p2', attendance_count: null }
  ]);

  assert.equal(allocations.allocationsByDateAndProfessional.get('2026-09-01:p1'), 45);
  assert.equal(allocations.allocationsByDateAndProfessional.get('2026-09-01:p2'), 105);
  assert.equal(allocations.allocationsByDateAndProfessional.has('2026-09-02:p1'), false);
  assert.equal(allocations.incompleteDates.has('2026-09-02'), true);
});

test('withholds a daily pool when a stored attendance count is invalid', () => {
  const allocations = calculateProductivityPoolAllocations([
    { id: 'd1:p1', date: '2026-09-01', professional_id: 'p1', attendance_count: 20 },
    { id: 'd1:p2', date: '2026-09-01', professional_id: 'p2', attendance_count: -1 }
  ]);

  assert.equal(allocations.allocationsByProfessional.size, 0);
  assert.equal(allocations.incompleteDates.get('2026-09-01'), 1);
});

test('allocates cents precisely for large safe integer attendance counts', () => {
  const count = 4503599627370495;
  const allocations = calculateProductivityPoolAllocations([
    { id: 'd1:p1', date: '2026-09-01', professional_id: 'p1', attendance_count: count },
    { id: 'd1:p2', date: '2026-09-01', professional_id: 'p2', attendance_count: count }
  ]);

  assert.equal(allocations.allocationsByDateAndProfessional.get('2026-09-01:p1'), 75);
  assert.equal(allocations.allocationsByDateAndProfessional.get('2026-09-01:p2'), 75);
});

test('does not apportion a daily pool when every count is zero', () => {
  const allocations = calculateProductivityPoolAllocations([
    { id: 'd1:p1', date: '2026-09-01', professional_id: 'p1', attendance_count: 0 },
    { id: 'd1:p2', date: '2026-09-01', professional_id: 'p2', attendance_count: 0 }
  ]);

  assert.equal(allocations.allocationsByProfessional.size, 0);
  assert.deepEqual(allocations.dailyTotals.get('2026-09-01'), { totalAttendances: 0, poolAmount: 0 });
});
