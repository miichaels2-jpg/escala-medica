// Resumo de um mês (ou período) de escala, para comparar com o anterior:
// Painel ("como estamos indo"), apresentação para a diretoria e custo antes de publicar.
// O custo é a estimativa pela tabela de valores do profissional, a mesma base dos Relatórios:
// mensalista = salário da unidade dividido pelos plantões dele no mês;
// produtividade só tem valor no fechamento (fica contada à parte).
import { getMonthlySalaryForUnit, getProfessionalFinancialMeta, getShiftCostEstimate, getShiftDurationHours, normalizeFinancialText } from './financialCalculations.js';
import { getShiftDateTimeRange, getShiftName, isIdleExtraSlot, isShiftVacant } from './shiftLiveStatus.js';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const pad = n => String(n).padStart(2, '0');

// "1 plantão" / "3 plantões" (com o número formatado).
export function plural(count, one, many) {
  return `${Number(count || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${count === 1 ? one : many}`;
}
const dateOf = shift => String(shift?.date || '').slice(0, 10);

// "2026-11" → "2026-10"
export function previousMonth(month) {
  const [y, m] = String(month).split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
}

export function nextMonth(month) {
  const [y, m] = String(month).split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
}

// "2026-11" → "novembro de 2026" (ou só "novembro")
export function monthLabel(month, { withYear = true } = {}) {
  const [y, m] = String(month).split('-').map(Number);
  const name = MONTHS[m - 1] || '';
  return withYear ? `${name} de ${y}` : name;
}

export function monthRange(month) {
  const [y, m] = String(month).split('-').map(Number);
  return [`${month}-01`, `${month}-${pad(new Date(y, m, 0).getDate())}`];
}

// Período imediatamente anterior: mês inteiro → mês anterior inteiro;
// senão, o mesmo número de dias logo antes.
export function previousRange(start, end) {
  const [, , startDay] = start.split('-').map(Number);
  const month = start.slice(0, 7);
  if (startDay === 1 && end === monthRange(month)[1]) return monthRange(previousMonth(month));
  const toDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const toStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const days = Math.round((toDate(end) - toDate(start)) / 86400000) + 1;
  const prevEnd = toDate(start); prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - days + 1);
  return [toStr(prevStart), toStr(prevEnd)];
}

function remunerationKind(professional) {
  const meta = getProfessionalFinancialMeta(professional);
  const type = normalizeFinancialText(meta.remuneration_type || meta.remunerationType || meta.payment_type || 'plantao');
  if (['mensal', 'monthly', 'salario mensal'].includes(type)) return 'mensal';
  if (['produtividade', 'production'].includes(type)) return 'produtividade';
  return 'tarifa';
}

// Encontra o profissional do plantão pelo id ou, nos plantões antigos, pelo nome.
export function professionalFinder(professionals = []) {
  const byId = new Map();
  const byName = new Map();
  professionals.forEach(p => {
    if (!p) return;
    if (p.id) byId.set(String(p.id), p);
    if (p.name) byName.set(normalizeFinancialText(p.name), p);
  });
  return shift => byId.get(String(shift?.professional_id || '')) || byName.get(normalizeFinancialText(getShiftName(shift))) || null;
}

/**
 * @param {object} options
 * @param {Array} options.shifts plantões já no escopo (unidade/setor); cancelados são ignorados
 * @param {string} options.start "AAAA-MM-DD"
 * @param {string} options.end "AAAA-MM-DD"
 * @param {Function} options.getProf plantão → profissional
 * @param {Function} [options.sectorName] plantão → nome do setor
 * @param {Date} [options.now]
 */
export function summarizePeriod({ shifts = [], start, end, getProf = () => null, sectorName = s => s?.sector_name || 'Setor', now = new Date(), company = null }) {
  const inPeriod = shifts.filter(s => {
    const d = dateOf(s);
    return s && d && d >= start && d <= end && normalizeFinancialText(s.status) !== 'cancelado' && !isIdleExtraSlot(s);
  });

  // Mensalista: quantos plantões ele tem em cada unidade/mês, para dividir o salário.
  const monthlyCount = new Map();
  inPeriod.forEach(s => {
    if (isShiftVacant(s)) return;
    const prof = getProf(s);
    if (prof && remunerationKind(prof) === 'mensal') {
      const key = `${prof.id}|${s.unit_id}|${dateOf(s).slice(0, 7)}`;
      monthlyCount.set(key, (monthlyCount.get(key) || 0) + 1);
    }
  });

  const summary = {
    start, end, total: 0, filled: 0, vacant: 0, overdue: 0, cost: 0, hours: 0, day: 0, night: 0,
    missingRate: 0, pendingProduction: 0, coverage: null, sectors: [], days: [], professionals: []
  };
  const sectors = new Map();
  const days = new Map();
  const people = new Map();

  inPeriod.forEach(s => {
    const date = dateOf(s);
    const name = sectorName(s) || 'Setor';
    const sector = sectors.get(name) || { name, total: 0, filled: 0, vacant: 0, overdue: 0, cost: 0, hours: 0 };
    const day = days.get(date) || { date, total: 0, filled: 0, vacant: 0, overdue: 0 };
    summary.total += 1; sector.total += 1; day.total += 1;

    if (isShiftVacant(s)) {
      const passed = (getShiftDateTimeRange(s)?.end?.getTime() ?? Infinity) < now.getTime();
      summary.vacant += 1; sector.vacant += 1; day.vacant += 1;
      if (passed) { summary.overdue += 1; sector.overdue += 1; day.overdue += 1; }
    } else {
      const hours = getShiftDurationHours(s);
      const prof = getProf(s);
      let cost = 0;
      if (!prof) summary.missingRate += 1;
      else if (remunerationKind(prof) === 'mensal') {
        const salary = getMonthlySalaryForUnit(prof, s.unit_id);
        if (salary.missing) summary.missingRate += 1;
        else cost = salary.value / (monthlyCount.get(`${prof.id}|${s.unit_id}|${date.slice(0, 7)}`) || 1);
      } else if (remunerationKind(prof) === 'produtividade') summary.pendingProduction += 1;
      else {
        const estimate = getShiftCostEstimate(prof, { ...s, duration_hours: hours }, company);
        cost = estimate.amount;
        if (estimate.missingRate) summary.missingRate += 1;
      }
      const startTime = String(s.start_time || '07:00').padStart(5, '0');
      if (normalizeFinancialText(s.shift_type) === 'noturno' || startTime >= '18:00' || startTime < '06:00') summary.night += 1;
      else summary.day += 1;

      summary.filled += 1; sector.filled += 1; day.filled += 1;
      summary.cost += cost; sector.cost += cost;
      summary.hours += hours; sector.hours += hours;
      const key = prof ? String(prof.id) : normalizeFinancialText(getShiftName(s));
      const person = people.get(key) || { name: prof?.name || getShiftName(s) || 'Profissional', shifts: 0, hours: 0 };
      person.shifts += 1; person.hours += hours;
      people.set(key, person);
    }
    sectors.set(name, sector);
    days.set(date, day);
  });

  summary.cost = Math.round(summary.cost * 100) / 100;
  summary.hours = Math.round(summary.hours * 10) / 10;
  summary.coverage = summary.total ? Math.round((summary.filled / summary.total) * 1000) / 10 : null;
  summary.sectors = [...sectors.values()].sort((a, b) => b.cost - a.cost || b.total - a.total);
  summary.days = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  summary.professionals = [...people.values()].sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  return summary;
}

export function summarizeMonth({ month, ...options }) {
  const [start, end] = monthRange(month);
  return summarizePeriod({ ...options, start, end });
}

// Variação percentual (null quando não dá para comparar).
export function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// Frases curtas com o que mudou de um mês para o outro (último slide da apresentação).
export function buildHighlights(current, previous, { previousName = 'o mês anterior' } = {}) {
  const items = [];
  const fmt = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  if (!current.total) return ['Nenhum plantão lançado no período.'];

  if (current.coverage !== null && previous?.coverage !== null && previous?.total) {
    const diff = Math.round((current.coverage - previous.coverage) * 10) / 10;
    items.push(diff === 0
      ? `Cobertura de ${fmt(current.coverage)}%, igual a ${previousName}.`
      : `Cobertura de ${fmt(current.coverage)}%, ${diff > 0 ? 'subiu' : 'caiu'} ${fmt(Math.abs(diff))} ponto(s) sobre ${previousName}.`);
  } else if (current.coverage !== null) {
    items.push(`Cobertura de ${fmt(current.coverage)}% da escala.`);
  }

  if (current.overdue > 0) items.push(current.overdue === 1 ? '1 plantão passou sem profissional (furo).' : `${current.overdue} plantões passaram sem profissional (furo).`);
  else if (current.vacant === 0) items.push('Nenhuma vaga sem profissional: escala toda preenchida.');
  else items.push(`${plural(current.vacant, 'vaga ainda aberta', 'vagas ainda abertas')}, nenhuma virou furo.`);

  const costChange = percentChange(current.cost, previous?.cost);
  if (current.cost > 0) {
    items.push(costChange === null
      ? `Custo estimado de ${brl(current.cost)}.`
      : `Custo estimado de ${brl(current.cost)}, ${costChange === 0 ? 'igual a' : `${fmt(Math.abs(costChange))}% ${costChange > 0 ? 'acima de' : 'abaixo de'}`} ${previousName}.`);
  }
  const biggest = current.sectors.find(s => s.cost > 0);
  if (biggest && current.cost > 0) {
    items.push(`${biggest.name} responde por ${Math.round((biggest.cost / current.cost) * 100)}% do custo.`);
  }
  if (current.professionals.length) {
    items.push(`${plural(current.professionals.length, 'profissional fez', 'profissionais fizeram')} ${fmt(current.hours)} horas de plantão.`);
  }
  return items;
}
