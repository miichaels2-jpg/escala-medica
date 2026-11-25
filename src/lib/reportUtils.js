// Formatação, cálculos de período e catálogo dos relatórios (tela Relatórios).
import { Activity, ArrowLeftRight, Building2, CalendarDays, Contact2, DollarSign, Gift, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import { DEFAULT_REMUNERATION_TYPE, getProfessionalFinancialMeta, getShiftDurationHours } from '@/lib/financialCalculations';
import { getShiftName, isShiftVacant } from '@/lib/shiftLiveStatus';
import { formatCurrency, formatDateOrDash as formatDate, normalize, safeNumber } from '@/lib/format';

export { formatCurrency, formatDate, getShiftName, normalize, safeNumber };
// Mesma regra de vaga usada no Painel e em Escalas: um plantão com
// profissional atribuído não é vaga só porque o status ficou desatualizado.
export { isShiftVacant as isVacant };
export { isCredentialExpired, parseLocalDate } from '@/lib/dates';

export function formatUnitRate(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  }).format(safeNumber(value));
}

export function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(safeNumber(value));
}

// Seções do relatório impresso, no mesmo estilo do modelo único (src/lib/printLayout.js).
export const REPORT_PRINT_CSS = `
  .section-title { margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #94a3b8; font-size: 12px; font-weight: 700; color: #0f172a; break-after: avoid; page-break-after: avoid; }
  .section-title.alert { color: #b45309; border-color: #fcd34d; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 8.8px; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th { padding: 5px 6px; text-align: left; font-size: 7.6px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; color: #334155; background: #f1f5f9; border-bottom: 1px solid #94a3b8; overflow-wrap: anywhere; }
  td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; overflow-wrap: anywhere; }
  .text-center { text-align: center; } .text-right { text-align: right; font-variant-numeric: tabular-nums; } .font-bold { font-weight: 600; }
  .furo { color: #b91c1c; font-weight: 600; } .vago { color: #b45309; font-weight: 600; }
  .grid-4, .grid-cards { display: flex; gap: 8px; margin-bottom: 12px; }
  .grid-card { flex: 1; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; }
  .card-title { font-size: 7.8px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #64748b; margin-bottom: 3px; }
  .card-value { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .card-sub { font-size: 8.5px; margin-top: 2px; color: #475569 !important; }
  .section-title:first-of-type { margin-top: 4px; }
  .break-before { margin-top: 24px; }
  .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
`;

export const countLabel = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const LOWER_WORDS = new Set(['e', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'a', 'o']);
export function titleCase(str) {
  if (!str) return '';
  return String(str).split(' ').map((w, i) => {
    if (/^[A-ZÀ-Ý]{2,4}$/.test(w)) return w; // siglas: UTI, UCO, RJ
    const lower = w.toLowerCase();
    if (i > 0 && LOWER_WORDS.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
}

export function getSectorName(shift, sectors) {
  if (shift.sector_name && normalize(shift.sector_name) !== 'setor geral' && normalize(shift.sector_name) !== 'setor') return shift.sector_name;
  const sector = sectors.find(item => String(item.id) === String(shift.sector_id));
  return sector?.name || 'Setor Não Informado';
}

export function roundHours(value) {
  return Math.round(safeNumber(value) * 10) / 10;
}

export function isShiftPast(shift) {
  if (!shift || !shift.date) return false;
  const dateStr = String(shift.date).split('T')[0];
  const startTime = shift.start_time || '00:00';
  const endTime = shift.end_time || '23:59';
  const shiftStart = new Date(`${dateStr}T${startTime}:00`);
  const shiftEnd = new Date(`${dateStr}T${endTime}:00`);
  if (Number.isNaN(shiftStart.getTime()) || Number.isNaN(shiftEnd.getTime())) return false;
  if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);
  return shiftEnd < new Date();
}

export function getShiftHours(shift) {
  return getShiftDurationHours(shift);
}

export function getProfessionalMeta(professional) {
  return getProfessionalFinancialMeta(professional);
}

export function getStoredProductivityAttendance(professional, unitId, date) {
  const stored = getProfessionalMeta(professional)
    .daily_productivity_attendance?.[String(unitId)]?.[String(date)];
  const rawCount = typeof stored === 'object' && stored !== null ? stored.count : stored;
  if (rawCount === null || rawCount === undefined || rawCount === '') return null;
  const count = Number(rawCount);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

export function getProductivityDayStatus(day) {
  if (day.complete) return day.totalAttendance > 0 ? 'Fechado' : 'Fechado · sem atendimentos';
  if (day.missingCount > 0) return `${day.missingCount} contagem(ns) pendente(s)`;
  if (day.unfinishedShift) return 'Plantão em andamento';
  return 'Total de atendimentos inválido';
}

export function getProfessionalRemuneration(professional, unitId) {
  if (!professional) return 'Não cadastrado';
  const meta = getProfessionalMeta(professional);
  const type = normalize(meta.remuneration_type || meta.remunerationType || meta.payment_type || DEFAULT_REMUNERATION_TYPE);
  const unitKey = String(unitId ?? '');
  const monthlySalaries = meta.unit_monthly_salaries || {};
  const unitMonthlySalary = monthlySalaries[unitKey];
  const hasUnitMonthlySalary = Object.prototype.hasOwnProperty.call(monthlySalaries, unitKey) &&
    unitMonthlySalary !== '' && unitMonthlySalary !== null && unitMonthlySalary !== undefined;
  const primaryUnitId = professional.unit_id || meta.allowed_unit_ids?.[0] || professional.unit_ids?.[0];
  const legacyMonthlySalary = meta.monthly_salary ?? meta.monthlySalary ?? meta.salary ?? meta.salario;
  const allowedUnitIds = Array.isArray(meta.allowed_unit_ids)
    ? meta.allowed_unit_ids
    : Array.isArray(professional.unit_ids) ? professional.unit_ids : (professional.unit_id ? [professional.unit_id] : []);

  if (allowedUnitIds.length > 0 && !allowedUnitIds.some(allowedUnitId => String(allowedUnitId) === unitKey)) {
    return 'Não vinculada à unidade';
  }

  if (['mensal', 'monthly', 'salario mensal'].includes(type)) {
    if (hasUnitMonthlySalary) return `${formatCurrency(unitMonthlySalary)} / mês`;
    const hasLegacySalary = legacyMonthlySalary !== '' && legacyMonthlySalary !== null && legacyMonthlySalary !== undefined;
    const canUseLegacySalary = !Object.keys(monthlySalaries).length || String(primaryUnitId) === unitKey;
    return hasLegacySalary && canUseLegacySalary
      ? `${formatCurrency(legacyMonthlySalary)} / mês`
      : 'Sem valor mensal nesta unidade';
  }

  if (['hora', 'hourly'].includes(type)) {
    const hourlyRate = meta.hourly_rate ?? meta.hourlyRate ?? meta.valor_hora;
    return hourlyRate !== '' && hourlyRate !== null && hourlyRate !== undefined
      ? `${formatCurrency(hourlyRate)} / hora`
      : 'Sem valor por hora';
  }

  const unitRates = meta.unit_rates?.[unitKey] || {};
  if (['plantao', 'shift'].includes(type) && ['diurno', 'noturno', 'fds'].some(rateType =>
    unitRates[rateType] !== '' && unitRates[rateType] !== null && unitRates[rateType] !== undefined
  )) {
    return ['diurno', 'noturno', 'fds']
      .filter(rateType => unitRates[rateType] !== '' && unitRates[rateType] !== null && unitRates[rateType] !== undefined)
      .map(rateType => `${{ diurno: 'Dia', noturno: 'Noite', fds: 'FDS' }[rateType]} ${formatCurrency(unitRates[rateType])}`)
      .join(' · ');
  }

  const dailyRate = meta.daily_rate ?? meta.dailyRate ?? meta.valor_plantao;
  if (['diaria', 'daily', 'plantao', 'shift'].includes(type) && dailyRate !== '' && dailyRate !== null && dailyRate !== undefined) {
    return `${formatCurrency(dailyRate)} / plantão`;
  }

  return 'Não cadastrado';
}

export function isMonthlyType(type) {
  return ['mensal', 'monthly', 'salario mensal'].includes(type);
}

export function isProductivityType(type) {
  return ['produtividade', 'production'].includes(type);
}

export function getRemunerationType(professional) {
  const meta = getProfessionalMeta(professional);
  return normalize(meta.remuneration_type || meta.remunerationType || meta.payment_type || DEFAULT_REMUNERATION_TYPE);
}

// Dias de um mês (AAAA-MM) que caem dentro do período filtrado.
export function monthDaysInPeriod(month, start, end) {
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, '0')}`;
  const from = start && start > monthStart ? start : monthStart;
  const to = end && end < monthEnd ? end : monthEnd;
  if (from > to) return { days: 0, daysInMonth };
  const days = Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86_400_000) + 1;
  return { days, daysInMonth };
}

export function monthsInPeriod(start, end) {
  if (!start || !end || start > end) return [];
  const months = [];
  let [year, month] = start.slice(0, 7).split('-').map(Number);
  const [endYear, endMonth] = end.slice(0, 7).split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return months;
}

export function getLocalDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const REPORT_TITLES = {
  bi: 'Painel BI de gestão',
  executivo: 'Resumo executivo',
  escalas: 'Extrato de plantões',
  trocas: 'Trocas e repasses',
  base_setores: 'Estrutura de setores',
  base_profissionais: 'Corpo clínico',
  aniversariantes: 'Aniversariantes',
  profissionais: 'Produtividade profissional',
  confiabilidade: 'Ranking de confiabilidade',
  produtividade_diaria: 'Apuração diária de produtividade',
  produtividade_profissional: 'Extrato de produtividade por profissional',
  financeiro: 'Análise financeira'
};

export const REPORT_NAVIGATION = [
  { id: 'bi', label: 'Visão geral', description: 'Apresentação para gestão', icon: Presentation },
  { id: 'escalas', label: 'Plantões', description: 'Escalas e ocupação', icon: CalendarDays },
  { id: 'trocas', label: 'Trocas e repasses', description: 'Histórico de alterações', icon: ArrowLeftRight },
  { id: 'base_setores', label: 'Setores', description: 'Estrutura e custos', icon: Building2 },
  { id: 'base_profissionais', label: 'Cadastro', description: 'Cadastro e situação', icon: Contact2 },
  { id: 'aniversariantes', label: 'Aniversariantes', description: 'Datas comemorativas', icon: Gift },
  { id: 'profissionais', label: 'Produtividade', description: 'Atuação profissional', icon: Users },
  { id: 'confiabilidade', label: 'Confiabilidade', description: 'Cumprimento, coberturas e repasses', icon: ShieldCheck, managerOnly: true },
  { id: 'produtividade_diaria', label: 'Apuração diária', description: 'Atendimentos e rateio', icon: Activity },
  { id: 'produtividade_profissional', label: 'Extrato individual', description: 'Atendimentos e saldo', icon: Stethoscope },
  { id: 'financeiro', label: 'Custos', description: 'Custos e orçamento', icon: DollarSign }
];

// As 4 abas do alto; cada uma junta relatórios parecidos (o "Resumo executivo" entrou na Visão geral).
export const REPORT_GROUPS = [
  { id: 'geral', label: 'Visão geral', reports: ['bi'] },
  { id: 'escalas', label: 'Escalas', reports: ['escalas', 'trocas', 'base_setores'] },
  { id: 'equipe', label: 'Equipe', reports: ['base_profissionais', 'profissionais', 'confiabilidade', 'aniversariantes'] },
  { id: 'financeiro', label: 'Financeiro', reports: ['financeiro', 'produtividade_diaria', 'produtividade_profissional'] }
];
export const REPORTS_WITH_STATUS_FILTER = ['base_profissionais', 'profissionais', 'aniversariantes'];

export const PERIODS = [
  { id: 'mes', label: 'Este mês' },
  { id: 'mes_passado', label: 'Mês passado' },
  { id: 'tres_meses', label: 'Últimos 3 meses' },
  { id: 'ano', label: 'Este ano' },
  { id: 'personalizado', label: 'Escolher datas' }
];

export function periodRange(id, today = new Date()) {
  const y = today.getFullYear(); const m = today.getMonth();
  const d = (yy, mm, dd) => getLocalDateInputValue(new Date(yy, mm, dd));
  if (id === 'mes_passado') return [d(y, m - 1, 1), d(y, m, 0)];
  if (id === 'tres_meses') return [d(y, m - 2, 1), d(y, m + 1, 0)];
  if (id === 'ano') return [d(y, 0, 1), d(y, 11, 31)];
  return [d(y, m, 1), d(y, m + 1, 0)];
}
