export function calculateProductivityPoolAllocations(rows, dailyPoolAmount = 150) {
  const poolCents = Math.round(Number(dailyPoolAmount) * 100);
  if (!Number.isSafeInteger(poolCents) || poolCents < 0) {
    throw new Error('O valor diário da produtividade deve ser um valor monetário válido.');
  }

  const byDate = new Map();
  rows.forEach(row => {
    const hasCount = row.attendance_count !== null && row.attendance_count !== undefined && row.attendance_count !== '';
    const parsedCount = hasCount ? Number(row.attendance_count) : null;
    if (!row.date || !row.id || !row.professional_id) return;
    const attendanceCount = hasCount && Number.isSafeInteger(parsedCount) && parsedCount >= 0
      ? parsedCount
      : null;
    const dateRows = byDate.get(String(row.date)) || [];
    dateRows.push({ ...row, attendanceCount });
    byDate.set(String(row.date), dateRows);
  });

  const allocationsByShift = new Map();
  const allocationsByProfessional = new Map();
  const allocationsByDateAndProfessional = new Map();
  const dailyTotals = new Map();
  const incompleteDates = new Map();

  byDate.forEach((dateRows, date) => {
    const missingCount = dateRows.filter(row => row.attendanceCount === null).length;
    const totalAttendances = dateRows.reduce((total, row) => total + (row.attendanceCount ?? 0), 0);
    if (missingCount > 0) {
      incompleteDates.set(date, missingCount);
      dailyTotals.set(date, { totalAttendances: null, poolAmount: null });
      return;
    }
    if (!Number.isSafeInteger(totalAttendances)) {
      incompleteDates.set(date, 1);
      dailyTotals.set(date, { totalAttendances: null, poolAmount: null });
      return;
    }
    dailyTotals.set(date, { totalAttendances, poolAmount: totalAttendances > 0 ? poolCents / 100 : 0 });
    if (totalAttendances === 0) return;

    const allocations = dateRows.map(row => {
      const numerator = BigInt(poolCents) * BigInt(row.attendanceCount);
      const denominator = BigInt(totalAttendances);
      return {
        row,
        cents: Number(numerator / denominator),
        remainder: numerator % denominator
      };
    });
    let remainingCents = poolCents - allocations.reduce((total, allocation) => total + allocation.cents, 0);
    [...allocations]
      .sort((a, b) => (
        a.remainder === b.remainder
          ? String(a.row.id).localeCompare(String(b.row.id))
          : a.remainder > b.remainder ? -1 : 1
      ))
      .slice(0, remainingCents)
      .forEach(allocation => { allocation.cents += 1; });

    allocations.forEach(({ row, cents }) => {
      const amount = cents / 100;
      allocationsByShift.set(String(row.id), amount);
      const professionalId = String(row.professional_id);
      allocationsByProfessional.set(
        professionalId,
        (allocationsByProfessional.get(professionalId) || 0) + amount
      );
      const dailyProfessionalKey = `${date}:${professionalId}`;
      allocationsByDateAndProfessional.set(
        dailyProfessionalKey,
        (allocationsByDateAndProfessional.get(dailyProfessionalKey) || 0) + amount
      );
    });
  });

  return {
    allocationsByShift,
    allocationsByProfessional,
    allocationsByDateAndProfessional,
    dailyTotals,
    incompleteDates
  };
}
