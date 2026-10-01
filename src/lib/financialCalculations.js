export function normalizeFinancialText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function safeFinancialNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;

  let normalized = String(value).replace(/[R$\s]/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '');
  } else {
    normalized = normalized.replace(',', '.');
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

export function getProfessionalFinancialMeta(professional) {
  if (!professional) return {};
  return Object.assign(
    {},
    professional,
    ...[professional.metadata, professional.data]
      .filter(source => source && typeof source === 'object' && !Array.isArray(source))
  );
}

export function getMonthlySalaryForUnit(professional, unitId) {
  const meta = getProfessionalFinancialMeta(professional);
  const salaries = meta.unit_monthly_salaries || {};
  const unitKey = String(unitId ?? '');
  const unitSalary = salaries[unitKey];
  const hasUnitSalary = Object.prototype.hasOwnProperty.call(salaries, unitKey) &&
    unitSalary !== '' && unitSalary !== null && unitSalary !== undefined;

  if (hasUnitSalary) {
    return { value: safeFinancialNumber(unitSalary), missing: false };
  }

  const primaryUnitId = professional?.unit_id || meta.allowed_unit_ids?.[0] || professional?.unit_ids?.[0];
  const legacySalary = meta.monthly_salary ?? meta.monthlySalary ?? meta.salary ?? meta.salario;
  const canUseLegacySalary = primaryUnitId && String(primaryUnitId) === unitKey;
  if (canUseLegacySalary && legacySalary !== '' && legacySalary !== null && legacySalary !== undefined) {
    return { value: safeFinancialNumber(legacySalary), missing: false };
  }

  return { value: 0, missing: true };
}

export function getShiftDurationHours(shift) {
  const explicit = safeFinancialNumber(shift?.duration_hours ?? shift?.hours ?? shift?.total_hours, 0);
  if (explicit > 0) return explicit;

  const parseTime = value => {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
  };

  const start = parseTime(shift?.start_time);
  const end = parseTime(shift?.end_time);
  if (start === null || end === null) return 0;
  return (end <= start ? end + 24 * 60 - start : end - start) / 60;
}

export function getShiftCostEstimate(professional, shift) {
  if (!professional || !shift) return { amount: 0, missingRate: false };

  const meta = getProfessionalFinancialMeta(professional);
  const remunerationType = normalizeFinancialText(
    meta.remuneration_type || meta.remunerationType || meta.payment_type || 'mensal'
  );

  if (['mensal', 'monthly', 'salario mensal'].includes(remunerationType)) {
    const salary = getMonthlySalaryForUnit(professional, shift.unit_id);
    return { amount: salary.value / 20, missingRate: salary.missing };
  }

  if (['produtividade', 'production'].includes(remunerationType)) {
    return { amount: 0, missingRate: false, requiresProduction: true };
  }

  if (['hora', 'hourly'].includes(remunerationType)) {
    const hourlyRate = meta.hourly_rate ?? meta.hourlyRate ?? meta.valor_hora;
    const missingRate = hourlyRate === '' || hourlyRate === null || hourlyRate === undefined;
    return {
      amount: safeFinancialNumber(hourlyRate) * getShiftDurationHours(shift),
      missingRate
    };
  }

  if (['diaria', 'daily'].includes(remunerationType)) {
    const dailyRate = meta.daily_rate ?? meta.dailyRate ?? meta.valor_plantao;
    const missingRate = dailyRate === '' || dailyRate === null || dailyRate === undefined;
    return { amount: safeFinancialNumber(dailyRate), missingRate };
  }

  if (['plantao', 'shift'].includes(remunerationType)) {
    const rates = meta.unit_rates?.[String(shift.unit_id)] || {};
    const date = String(shift.date || '').split('T')[0];
    const shiftDate = date ? new Date(`${date}T12:00:00`) : null;
    const isWeekend = shiftDate && !Number.isNaN(shiftDate.getTime()) &&
      (shiftDate.getDay() === 0 || shiftDate.getDay() === 6);
    const startTime = String(shift.start_time || '07:00');
    const isNight = normalizeFinancialText(shift.shift_type) === 'noturno' ||
      startTime >= '18:00' || startTime < '06:00';
    const rate = isWeekend ? rates.fds : (isNight ? rates.noturno : rates.diurno);
    const missingRate = rate === '' || rate === null || rate === undefined;
    return { amount: missingRate ? 0 : safeFinancialNumber(rate), missingRate };
  }

  return { amount: 0, missingRate: false };
}
