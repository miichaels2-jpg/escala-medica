// Informe de rendimentos do ano: o que o profissional recebeu de cada unidade, mês a mês,
// para conferir a declaração do Imposto de Renda. Mesma regra do fechamento (Faturamento):
// entra o plantão realizado (status realizado ou já terminado); mensalista recebe o fixo da
// unidade em cada mês em que trabalhou nela; produtividade só tem valor no fechamento da unidade.
import { getMonthlySalaryForUnit, getProfessionalFinancialMeta, getShiftCostEstimate, getShiftDurationHours, normalizeFinancialText, safeFinancialNumber } from './financialCalculations.js';
import { getShiftDateTimeRange, isShiftVacant } from './shiftLiveStatus.js';

export const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

// A declaração do IR é feita no começo do ano: até maio, o informe padrão é o do ano anterior.
export function defaultIncomeYear(now = new Date()) {
  return now.getMonth() <= 4 ? now.getFullYear() - 1 : now.getFullYear();
}

export function remunerationKindOf(professional) {
  const meta = getProfessionalFinancialMeta(professional);
  const type = normalizeFinancialText(meta.remuneration_type || meta.remunerationType || meta.payment_type || 'plantao');
  if (['mensal', 'monthly', 'salario mensal'].includes(type)) return 'mensal';
  if (['produtividade', 'production'].includes(type)) return 'produtividade';
  return 'plantao';
}

function isDone(shift, now) {
  const status = normalizeFinancialText(shift.status);
  if (['realizado', 'concluido', 'concluida'].includes(status)) return true;
  const end = getShiftDateTimeRange(shift)?.end;
  return Boolean(end && end.getTime() <= now.getTime());
}

/**
 * @param {object} o
 * @param {object} o.professional
 * @param {Array} o.shifts plantões (de qualquer profissional; filtra pelo id deste)
 * @param {Array} [o.units]
 * @param {number} o.year
 * @param {Function} [o.isPaid] (unitId, professionalId, "AAAA-MM") → boolean
 * @param {Date} [o.now]
 */
export function buildIncomeStatement({ professional, shifts = [], units = [], year, isPaid = () => false, now = new Date() }) {
  const profId = String(professional?.id || '');
  const kind = remunerationKindOf(professional);
  const meta = getProfessionalFinancialMeta(professional);
  const taxRate = safeFinancialNumber(meta.coop_tax_rate ?? 0);
  const unitById = new Map(units.map(u => [String(u.id), u]));
  const byUnit = new Map();

  const unitEntry = unitId => {
    const key = String(unitId || '');
    if (!byUnit.has(key)) {
      const unit = unitById.get(key);
      byUnit.set(key, {
        unitId: key,
        name: unit?.name || 'Unidade',
        cnpj: unit?.cnpj || unit?.data?.cnpj || '',
        months: new Map()
      });
    }
    return byUnit.get(key);
  };
  const monthEntry = (unit, month) => {
    if (!unit.months.has(month)) unit.months.set(month, { month, shifts: 0, hours: 0, gross: 0, missingRate: 0, pendingProduction: 0 });
    return unit.months.get(month);
  };

  shifts.forEach(shift => {
    if (!shift || String(shift.professional_id || '') !== profId || isShiftVacant(shift)) return;
    if (normalizeFinancialText(shift.status) === 'cancelado') return;
    const date = String(shift.date || '').slice(0, 10);
    if (!date.startsWith(`${year}-`) || !isDone(shift, now)) return;
    const row = monthEntry(unitEntry(shift.unit_id), date.slice(0, 7));
    const hours = getShiftDurationHours(shift);
    row.shifts += 1;
    row.hours += hours;
    if (kind === 'plantao') {
      const estimate = getShiftCostEstimate(professional, { ...shift, duration_hours: hours });
      row.gross += estimate.amount;
      if (estimate.missingRate) row.missingRate += 1;
    } else if (kind === 'produtividade') {
      row.pendingProduction += 1;
    }
  });

  const unitList = [...byUnit.values()].map(unit => {
    const months = [...unit.months.values()].sort((a, b) => a.month.localeCompare(b.month)).map(row => {
      let gross = row.gross;
      let missingRate = row.missingRate;
      if (kind === 'mensal') {
        const salary = getMonthlySalaryForUnit(professional, unit.unitId);
        gross = salary.value;
        missingRate = salary.missing ? 1 : 0;
      }
      gross = round2(gross);
      const discount = round2((gross * taxRate) / 100);
      return {
        ...row,
        hours: Math.round(row.hours * 10) / 10,
        gross,
        discount,
        net: round2(gross - discount),
        missingRate,
        paid: Boolean(isPaid(unit.unitId, profId, row.month))
      };
    });
    const sum = key => round2(months.reduce((total, m) => total + m[key], 0));
    return {
      unitId: unit.unitId,
      name: unit.name,
      cnpj: unit.cnpj,
      months,
      totals: {
        shifts: months.reduce((t, m) => t + m.shifts, 0),
        hours: Math.round(months.reduce((t, m) => t + m.hours, 0) * 10) / 10,
        gross: sum('gross'),
        discount: sum('discount'),
        net: sum('net'),
        paidNet: round2(months.filter(m => m.paid).reduce((t, m) => t + m.net, 0))
      }
    };
  }).sort((a, b) => b.totals.gross - a.totals.gross || a.name.localeCompare(b.name, 'pt-BR'));

  const total = key => round2(unitList.reduce((t, u) => t + u.totals[key], 0));
  return {
    year,
    kind,
    taxRate,
    units: unitList,
    totals: {
      shifts: unitList.reduce((t, u) => t + u.totals.shifts, 0),
      hours: Math.round(unitList.reduce((t, u) => t + u.totals.hours, 0) * 10) / 10,
      gross: total('gross'),
      discount: total('discount'),
      net: total('net'),
      paidNet: total('paidNet')
    },
    missingRate: unitList.some(u => u.months.some(m => m.missingRate > 0)),
    pendingProduction: unitList.reduce((t, u) => t + u.months.reduce((s, m) => s + m.pendingProduction, 0), 0),
    unpaidMonths: unitList.reduce((t, u) => t + u.months.filter(m => !m.paid).length, 0)
  };
}
