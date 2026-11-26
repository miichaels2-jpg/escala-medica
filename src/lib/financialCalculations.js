export const DEFAULT_REMUNERATION_TYPE = 'plantao';

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

// Tabela de valores do setor (V0.9.1): vale para toda a equipe do setor; o valor do cadastro do
// profissional (unit_rates) é exceção e vence campo a campo. Fica nos dados da empresa, como os turnos padrão.
export const SECTOR_RATE_FIELDS = [
  { key: 'semana_dia', label: 'Dia de semana · diurno', own: 'diurno' },
  { key: 'semana_noite', label: 'Dia de semana · noturno', own: 'noturno' },
  { key: 'fds_dia', label: 'Fim de semana · diurno', own: 'fds' },
  { key: 'fds_noite', label: 'Fim de semana · noturno', own: 'fds' },
  { key: 'meio', label: 'Meio expediente (até 6 h)', own: 'meio' }
];
export const HALF_SHIFT_MAX_HOURS = 6;

const hasValue = value => value !== '' && value !== null && value !== undefined && Number.isFinite(safeFinancialNumber(value, NaN));

export function getSectorRates(company, sectorId) {
  const raw = company?.data?.sector_rates?.[String(sectorId ?? '')];
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(SECTOR_RATE_FIELDS.filter(f => hasValue(raw[f.key])).map(f => [f.key, safeFinancialNumber(raw[f.key])]));
}

// Dados da empresa com a tabela do setor trocada (tabela vazia remove o setor).
export function withSectorRates(companyData, sectorId, rates) {
  const data = { ...(companyData || {}) };
  const all = { ...(data.sector_rates || {}) };
  const clean = Object.fromEntries(SECTOR_RATE_FIELDS.filter(f => hasValue(rates?.[f.key])).map(f => [f.key, safeFinancialNumber(rates[f.key])]));
  if (Object.keys(clean).length) all[String(sectorId)] = clean;
  else delete all[String(sectorId)];
  data.sector_rates = all;
  return data;
}

// Retenção (%): a do cadastro, quando marcada como exceção (ou maior que zero em cadastros antigos);
// senão, o padrão do estabelecimento (Configurações).
export function getRetentionRate(professional, company) {
  const meta = getProfessionalFinancialMeta(professional);
  const own = safeFinancialNumber(meta.coop_tax_rate, 0);
  if (meta.retention_override === true) return own;
  if (meta.retention_override !== false && own > 0) return own;
  return safeFinancialNumber(company?.data?.default_retention_rate, 0);
}

export function getShiftCostEstimate(professional, shift, company) {
  if (!professional || !shift) return { amount: 0, missingRate: false };

  const meta = getProfessionalFinancialMeta(professional);
  // O cadastro (Corpo Clínico) e o fechamento (Faturamento) tratam o regime
  // não informado como "plantão"; todas as telas precisam usar o mesmo padrão.
  const remunerationType = normalizeFinancialText(
    meta.remuneration_type || meta.remunerationType || meta.payment_type || DEFAULT_REMUNERATION_TYPE
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
    const sectorRates = getSectorRates(company, shift.sector_id);
    const pick = (...values) => values.find(hasValue);
    const hours = getShiftDurationHours(shift);
    if (hours > 0 && hours <= HALF_SHIFT_MAX_HOURS) {
      const half = pick(rates.meio, sectorRates.meio);
      if (half !== undefined) return { amount: safeFinancialNumber(half), missingRate: false };
    }
    const date = String(shift.date || '').split('T')[0];
    const shiftDate = date ? new Date(`${date}T12:00:00`) : null;
    const isWeekend = shiftDate && !Number.isNaN(shiftDate.getTime()) &&
      (shiftDate.getDay() === 0 || shiftDate.getDay() === 6);
    const startTime = String(shift.start_time || '07:00').padStart(5, '0');
    const isNight = normalizeFinancialText(shift.shift_type) === 'noturno' ||
      startTime >= '18:00' || startTime < '06:00';
    const rate = isWeekend
      ? pick(rates.fds, isNight ? sectorRates.fds_noite : sectorRates.fds_dia)
      : pick(isNight ? rates.noturno : rates.diurno, isNight ? sectorRates.semana_noite : sectorRates.semana_dia);
    const missingRate = rate === undefined;
    return { amount: missingRate ? 0 : safeFinancialNumber(rate), missingRate };
  }

  return { amount: 0, missingRate: false };
}
