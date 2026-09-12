import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  BarChart3,
  ClipboardList,
  DollarSign,
  Eye,
  FileSpreadsheet,
  Filter,
  Loader2,
  Printer,
  ShieldCheck,
  AlertTriangle,
  X,
  Leaf,
  Activity,
  Users,
  CheckCircle2,
  Clock,
  Building2,
  Map,
  ChevronRight,
  LayoutDashboard,
  Clock3,
  SlidersHorizontal,
  RefreshCw,
  FileCheck2,
  History,
  Hash,
  Database,
  TrendingDown,
  Menu,
} from 'lucide-react';

/* ============================================================
   CONFIGURAÇÕES
============================================================ */

const SHIFT_STATUS = {
  CONFIRMED: 'confirmado',
  PENDING: 'pendente',
  CANCELLED: 'cancelado',
  OPEN: 'vago',
};

const REMUNERATION_TYPE = {
  HOUR: 'hora',
  DAILY: 'diaria',
  MONTHLY: 'mensal',
};

/* ============================================================
   FUNÇÕES UTILITÁRIAS
============================================================ */

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatCurrency(value = 0) {
  return `R$ ${safeNumber(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeDate(dateValue) {
  if (!dateValue) return '';
  const value = String(dateValue).trim();
  if (!value) return '';
  const datePart = value.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  return '';
}

function formatDateBR(dateValue) {
  const value = normalizeDate(dateValue);
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function escapeCSV(value) {
  return `"${String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

function downloadFile(content, filename, type = 'text/csv;charset=utf-8;') {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error('Erro ao baixar arquivo:', error);
  }
}

function calculatePercentage(value, total) {
  const safeTotal = safeNumber(total);
  if (safeTotal <= 0) return 0;
  return Math.round((safeNumber(value) / safeTotal) * 100);
}

function getRemunerationType(professional) {
  const value = String(
    professional?.remuneration_type ||
      professional?.remunerationType ||
      REMUNERATION_TYPE.HOUR
  ).toLowerCase();

  if (value === REMUNERATION_TYPE.DAILY) return REMUNERATION_TYPE.DAILY;
  if (value === REMUNERATION_TYPE.MONTHLY) return REMUNERATION_TYPE.MONTHLY;
  return REMUNERATION_TYPE.HOUR;
}

function getProfessionalName(professional) {
  return professional?.name || professional?.full_name || professional?.fullName || 'Sem nome';
}

function getSectorName(shift) {
  return shift?.sector_name || shift?.sectorName || shift?.sector?.name || 'Geral';
}

function getProfessionalId(shift) {
  return shift?.professional_id || shift?.professionalId || null;
}

function getSectorId(shift) {
  return shift?.sector_id || shift?.sectorId || null;
}

function getShiftStatus(shift) {
  return String(shift?.status || '').toLowerCase().trim();
}

function getShiftDuration(shift) {
  return safeNumber(shift?.duration_hours ?? shift?.durationHours ?? shift?.hours, 0);
}

function getCoverageLevel(percentage) {
  const value = safeNumber(percentage);
  if (value < 70) return { key: 'critical', label: 'CRÍTICO', description: 'Cobertura operacional baixa' };
  if (value < 90) return { key: 'attention', label: 'ATENÇÃO', description: 'Cobertura operacional requer acompanhamento' };
  return { key: 'adequate', label: 'ADEQUADO', description: 'Cobertura operacional satisfatória' };
}

/* ============================================================
   CONFIGURAÇÃO DOS RELATÓRIOS
============================================================ */

const REPORT_CONFIG = {
  executiva: { label: 'Visão Executiva', description: 'Indicadores consolidados para gestão e conselho', icon: LayoutDashboard },
  produtividade: { label: 'Produtividade & Horas', description: 'Produção, horas e distribuição por profissional', icon: Clock3 },
  cobertura: { label: 'Cobertura & Mapa de Calor', description: 'Cobertura operacional por setor', icon: Building2 },
  risco: { label: 'Risco Assistencial', description: 'Indicadores operacionais de cobertura', icon: ShieldCheck },
  financeiro: { label: 'Financeiro & Custos', description: 'Custos e estimativas com base nos dados disponíveis', icon: BarChart3 },
  turnover: { label: 'Cancelamentos & Absenteísmo', description: 'Ocorrências operacionais e cancelamentos', icon: Users },
  auditoria: { label: 'Governança & Auditoria', description: 'Integridade, rastreabilidade e controle do relatório', icon: ClipboardCheck },
};

const TABS_CONFIG = {
  executiva: { label: 'Visão Executiva', group: 'camada1' },
  produtividade: { label: 'Produtividade & Horas', group: 'camada2' },
  cobertura: { label: 'Cobertura & Mapa de Calor', group: 'camada2' },
  risco: { label: 'Risco Assistencial', group: 'camada2' },
  financeiro: { label: 'Financeiro Avançado', group: 'camada2' },
  turnover: { label: 'Turnover & Absenteísmo', group: 'camada2' },
  auditoria: { label: 'Governança & Auditoria', group: 'camada3' },
};

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'aberto', label: 'Aberto' },
];

/* ============================================================
   GERADOR DE PAYLOAD (Cruzando com Faturamento Real)
============================================================ */
function buildReportPayload({
  tab,
  company,
  user,
  filtersLabel,
  overview = {},
  byProfessional = [],
  bySector = [],
  auditLogs = [],
  totalFinancialEstimate = 0,
  criticalAlerts = [],
}) {
  const companyName = company?.name || company?.company_name || 'Instituição Hospitalar';
  const generatedBy = user?.data?.full_name || user?.data?.name || user?.email || 'Usuário do sistema';

  const base = { companyName, generatedBy, generatedAt: new Date(), subtitle: filtersLabel };

  if (tab === 'executiva') {
    const totalHours = byProfessional.reduce((total, p) => total + safeNumber(p?.hours), 0);
    const coverage = calculatePercentage(overview.confirmed, overview.total);

    return {
      ...base,
      key: tab,
      title: 'Sumário Executivo para Diretoria & Conselho',
      kpis: [
        { label: 'Custo Total Estimado', value: formatCurrency(totalFinancialEstimate) },
        { label: 'Cobertura Global', value: `${coverage}%` },
        { label: 'Profissionais Ativos', value: byProfessional.length },
        { label: 'Vagas Abertas', value: overview.open || 0 },
      ],
      criticalAlerts,
      columns: ['Indicador Executivo', 'Resultado Consolidado'],
      rows: [
        ['Total de turnos no período', overview.total || 0],
        ['Turnos confirmados', overview.confirmed || 0],
        ['Turnos pendentes', overview.pending || 0],
        ['Vagas abertas', overview.open || 0],
        ['Turnos cancelados', overview.canceled || 0],
        ['Cobertura global', `${coverage}%`],
        ['Custo financeiro estimado', formatCurrency(totalFinancialEstimate)],
        ['Carga horária total', `${totalHours}h`],
      ],
      emptyMessage: 'Sem dados suficientes para consolidação executiva.',
    };
  }

  if (tab === 'produtividade') {
    const totalHours = byProfessional.reduce((total, p) => total + safeNumber(p?.hours), 0);
    return {
      ...base,
      key: tab,
      title: 'Produtividade e Carga Horária do Corpo Clínico',
      kpis: [
        { label: 'Profissionais ativos', value: byProfessional.length },
        { label: 'Horas totais', value: `${totalHours}h` },
        { label: 'Confirmados', value: overview.confirmed || 0 },
        { label: 'Pendentes', value: overview.pending || 0 },
      ],
      columns: ['Profissional', 'Categoria / Especialidade', 'Confirmados', 'Pendentes', 'Cancelados', 'Horas Totais'],
      rows: byProfessional.map((p) => [
        p?.name || '—',
        p?.category || '—',
        p?.confirmed || 0,
        p?.pending || 0,
        p?.canceled || 0,
        `${safeNumber(p?.hours)}h`,
      ]),
      totalsRow: ['TOTAL', '', overview.confirmed || 0, overview.pending || 0, overview.canceled || 0, `${totalHours}h`],
      emptyMessage: 'Nenhum profissional com plantões no período selecionado.',
    };
  }

  if (tab === 'cobertura') {
    const rows = bySector.map(([name, data]) => {
      const total = safeNumber(data?.total);
      const filled = safeNumber(data?.filled);
      const open = safeNumber(data?.open);
      const canceled = safeNumber(data?.canceled);
      const percentage = calculatePercentage(filled, total);
      return [name || 'Geral', total, filled, open, canceled, `${percentage}%`];
    });

    return {
      ...base,
      key: tab,
      title: 'Cobertura Operacional por Setor',
      kpis: [
        { label: 'Setores mapeados', value: bySector.length },
        { label: 'Vagas abertas', value: overview.open || 0 },
        { label: 'Turnos totais', value: overview.total || 0 },
        { label: 'Cobertura global', value: `${calculatePercentage(overview.confirmed, overview.total)}%` },
      ],
      columns: ['Setor', 'Turnos Totais', 'Confirmados', 'Vagas Abertas', 'Cancelados', '% Cobertura'],
      rows,
      emptyMessage: 'Sem dados de setores para os filtros selecionados.',
    };
  }

  if (tab === 'risco') {
    return {
      ...base,
      key: tab,
      title: 'Painel de Risco Assistencial e Cobertura Operacional',
      kpis: [
        { label: 'Setores monitorados', value: bySector.length },
        { label: 'Alertas identificados', value: criticalAlerts.length },
        { label: 'Vagas abertas', value: overview.open || 0 },
        { label: 'Cancelamentos', value: overview.canceled || 0 },
      ],
      columns: ['Setor / Ala', 'Cobertura', 'Vagas', 'Classificação Operacional'],
      rows: bySector.map(([name, data]) => {
        const total = safeNumber(data?.total);
        const filled = safeNumber(data?.filled);
        const open = safeNumber(data?.open);
        const percentage = calculatePercentage(filled, total);
        const level = getCoverageLevel(percentage);
        return [name || 'Geral', `${percentage}%`, `${open} vaga(s)`, level.label];
      }),
      emptyMessage: 'Nenhum setor encontrado no período selecionado.',
    };
  }

  if (tab === 'financeiro') {
    const totalHours = byProfessional.reduce((total, p) => total + safeNumber(p?.hours), 0);
    return {
      ...base,
      key: tab,
      title: 'Financeiro — Projeção de Custos e Repasse (Faturamento Real)',
      kpis: [
        { label: 'Total estimado', value: formatCurrency(totalFinancialEstimate) },
        { label: 'Profissionais', value: byProfessional.length },
        { label: 'Horas faturáveis', value: `${totalHours}h` },
        { label: 'Registros financeiros', value: byProfessional.filter((p) => safeNumber(p?.estimatedPay) > 0).length },
      ],
      columns: ['Profissional', 'Modelo de Remuneração', 'Quantidade / Horas', 'Total Estimado'],
      rows: byProfessional.map((p) => {
        let label = 'Horista';
        if (p?.remunerationType === REMUNERATION_TYPE.DAILY) label = 'Por Plantão / Diária';
        else if (p?.remunerationType === REMUNERATION_TYPE.MONTHLY) label = 'Fixo Mensal';

        const qty = p?.remunerationType === REMUNERATION_TYPE.HOUR ? `${safeNumber(p?.hours)}h` : `${safeNumber(p?.confirmed)} plantão(ões)`;
        return [p?.name || '—', label, qty, p?.financialDataAvailable ? formatCurrency(p?.estimatedPay) : 'Não informado'];
      }),
      totalsRow: ['TOTAL', '', `${totalHours}h`, formatCurrency(totalFinancialEstimate)],
      emptyMessage: 'Nenhum dado financeiro disponível para os filtros selecionados.',
    };
  }

  if (tab === 'turnover') {
    const totalCanceled = safeNumber(overview.canceled);
    const absenteeismRate = overview.total > 0 ? ((totalCanceled / overview.total) * 100).toFixed(1) : '0.0';
    return {
      ...base,
      key: tab,
      title: 'Turnover, Cancelamentos e Absenteísmo',
      kpis: [
        { label: 'Cancelamentos', value: totalCanceled },
        { label: 'Taxa de cancelamento', value: `${absenteeismRate}%` },
        { label: 'Eventos auditados', value: auditLogs.length },
      ],
      columns: ['Profissional / Evento', 'Setor', 'Data', 'Status', 'Observação'],
      rows: auditLogs.filter((log) => getShiftStatus(log) === SHIFT_STATUS.CANCELLED).map((log) => [
        log?.professional_name || log?.professionalName || 'Profissional',
        getSectorName(log),
        formatDateBR(log?.date),
        'Cancelado',
        log?.notes || 'Cancelado sem justificativa informada',
      ]),
      emptyMessage: 'Nenhum cancelamento registrado no período selecionado.',
    };
  }

  return {
    ...base,
    key: tab,
    title: 'Governança, Compliance e Trilha de Auditoria',
    kpis: [
      { label: 'Eventos auditados', value: auditLogs.length },
      { label: 'Identificação documental', value: 'Gerada no relatório' },
    ],
    columns: ['Data', 'Horário', 'Profissional', 'Setor', 'Status', 'Observação', 'ID de Transação'],
    rows: auditLogs.map((log) => [
      formatDateBR(log?.date),
      `${log?.start_time || '--'} - ${log?.end_time || '--'}`,
      log?.professional_name || log?.professionalName || 'Vago',
      getSectorName(log),
      log?.status || '—',
      log?.notes || '—',
      log?.id || '—',
    ]),
    emptyMessage: 'Nenhum evento de auditoria registrado no período.',
  };
}

/* ============================================================
   COMPONENTE PRINCIPAL (Modo Diurno e Noturno Otimizado)
============================================================ */
export default function CentralInteligenciaHospitalar() {
  const { companyId, unitId } = useAppData();

  const [activeTab, setActiveTab] = useState('executiva');
  const [shifts, setShifts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    sectorId: 'todos',
    status: 'todos',
    professionalId: 'todos',
    category: 'todos',
  });

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportStatus, setReportStatus] = useState('Rascunho');
  const [reportVersion, setReportVersion] = useState(1);
  const [reportHash, setReportHash] = useState('');
  const [hashLoading, setHashLoading] = useState(false);
  const [auditEvents, setAuditEvents] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sectorDetail, setSectorDetail] = useState(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');

    try {
      const [shiftsResp, profsResp, sectorsResp] = await Promise.all([
        base44.entities.Shift?.list?.().catch(() => []),
        base44.entities.Professional?.list?.().catch(() => []),
        base44.entities.Sector?.list?.().catch(() => []),
      ]);

      setShifts(Array.isArray(shiftsResp) ? shiftsResp : []);
      setProfessionals(Array.isArray(profsResp) ? profsResp : []);
      setSectors(Array.isArray(sectorsResp) ? sectorsResp : []);
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar os dados. Verifique a conexão com a base de dados.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const professionalMap = useMemo(() => {
    const map = {};
    professionals.forEach((p) => { if (p?.id) map[p.id] = p; });
    return map;
  }, [professionals]);

  const sectorMap = useMemo(() => {
    const map = {};
    sectors.forEach((s) => { if (s?.id) map[s.id] = s; });
    return map;
  }, [sectors]);

  const categories = useMemo(() => {
    const values = new Set();
    shifts.forEach((s) => {
      const cat = getCategoryName(s, professionalMap);
      if (cat && cat !== 'Não informado') values.add(cat);
    });
    professionals.forEach((p) => {
      const cat = p?.category || p?.profession || p?.role || p?.cargo;
      if (cat) values.add(cat);
    });
    return Array.from(values).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
  }, [shifts, professionals, professionalMap]);

  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      const date = getShiftDate(shift);
      if (filters.startDate && date < filters.startDate) return false;
      if (filters.endDate && date > filters.endDate) return false;

      if (filters.sectorId !== 'todos') {
        const sectorMatches =
          String(shift?.sector_id || '') === String(filters.sectorId) ||
          String(shift?.sector_name || '') === String(filters.sectorId);
        if (!sectorMatches) return false;
      }

      if (filters.status !== 'todos') {
        if (getStatusKey(shift?.status) !== filters.status) return false;
      }

      if (filters.professionalId !== 'todos') {
        if (String(getProfessionalId(shift) || '') !== String(filters.professionalId)) return false;
      }

      if (filters.category !== 'todos') {
        const category = getCategoryName(shift, professionalMap);
        if (String(category) !== String(filters.category)) return false;
      }

      return true;
    });
  }, [shifts, filters, professionalMap]);

  const baseMetrics = useMemo(() => {
    let confirmed = 0, pending = 0, canceled = 0, open = 0;
    let confirmedHours = 0, totalHours = 0;

    filteredShifts.forEach((shift) => {
      const status = getStatusKey(shift?.status);
      const hours = getShiftHours(shift);
      totalHours += hours;

      if (['confirmado', 'confirmed', 'concluido', 'completed'].includes(status)) {
        confirmed++;
        confirmedHours += hours;
      } else if (['pendente', 'pending'].includes(status)) {
        pending++;
      } else if (['cancelado', 'canceled'].includes(status)) {
        canceled++;
      } else if (['aberto', 'open'].includes(status)) {
        open++;
      }
    });

    const total = filteredShifts.length;
    const coverage = total > 0 ? (confirmed / total) * 100 : 0;

    return { total, confirmed, pending, canceled, open, totalHours, confirmedHours, coverage };
  }, [filteredShifts]);

  const byProfessional = useMemo(() => {
    const map = {};
    filteredShifts.forEach((shift) => {
      const id = getProfessionalId(shift) || `name:${getProfessionalName(shift, professionalMap)}`;
      if (!map[id]) {
        map[id] = {
          id,
          name: getProfessionalName(shift, professionalMap),
          category: getCategoryName(shift, professionalMap),
          total: 0, confirmed: 0, pending: 0, canceled: 0, open: 0, hours: 0,
        };
      }
      const row = map[id];
      const status = getStatusKey(shift?.status);
      row.total++;
      row.hours += getShiftHours(shift);

      if (['confirmado', 'confirmed', 'concluido', 'completed'].includes(status)) row.confirmed++;
      else if (['pendente', 'pending'].includes(status)) row.pending++;
      else if (['cancelado', 'canceled'].includes(status)) row.canceled++;
      else if (['aberto', 'open'].includes(status)) row.open++;
    });

    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [filteredShifts, professionalMap]);

  const bySector = useMemo(() => {
    const map = {};
    filteredShifts.forEach((shift) => {
      const name = getSectorName(shift, sectorMap);
      if (!map[name]) {
        map[name] = { name, total: 0, confirmed: 0, pending: 0, canceled: 0, open: 0, coverage: 0 };
      }
      const row = map[name];
      const status = getStatusKey(shift?.status);
      row.total++;

      if (['confirmado', 'confirmed', 'concluido', 'completed'].includes(status)) row.confirmed++;
      else if (['pendente', 'pending'].includes(status)) row.pending++;
      else if (['cancelado', 'canceled'].includes(status)) row.canceled++;
      else if (['aberto', 'open'].includes(status)) row.open++;
    });

    return Object.values(map)
      .map((row) => ({
        ...row,
        coverage: row.total > 0 ? (row.confirmed / row.total) * 100 : 0,
      }))
      .sort((a, b) => a.coverage - b.coverage);
  }, [filteredShifts, sectorMap]);

  const riskRows = useMemo(() => {
    return bySector.map((sector) => {
      let level = 'regular';
      if (sector.coverage < 70) level = 'critico';
      else if (sector.coverage < 90) level = 'atencao';
      return { ...sector, level };
    });
  }, [bySector]);

  /* ============================================================
     CRUZAMENTO COM O MÓDULO DE FATURAMENTO (Fidelidade Financeira)
     ============================================================ */
  const financialData = useMemo(() => {
    let estimatedCost = 0;
    let knownRates = 0;
    let missingRates = 0;
    const rows = [];

    filteredShifts.forEach((shift) => {
      const hours = getShiftHours(shift);
      const profId = getProfessionalId(shift);
      const prof = profId ? professionalMap[profId] : null;

      const remType = getRemunerationType(prof);
      let rate = null;

      if (remType === REMUNERATION_TYPE.HOUR) {
        rate = prof?.hourly_rate ?? prof?.hourlyRate ?? 120;
      } else if (remType === REMUNERATION_TYPE.DAILY) {
        rate = prof?.daily_rate ?? prof?.dailyRate ?? 1500;
      } else if (remType === REMUNERATION_TYPE.MONTHLY) {
        const monthly = Number(prof?.monthly_salary ?? prof?.monthlySalary ?? 18000);
        rate = monthly / 30 / 12; // Base horária proporcional estimada
      }

      const numericRate = Number(rate);
      if (Number.isFinite(numericRate) && numericRate >= 0) {
        const cost = remType === REMUNERATION_TYPE.MONTHLY ? numericRate * hours : hours * numericRate;
        estimatedCost += cost;
        knownRates++;
        rows.push({
          professional: getProfessionalName(shift, professionalMap),
          sector: getSectorName(shift, sectorMap),
          hours,
          rate: numericRate,
          cost,
        });
      } else {
        missingRates++;
        rows.push({
          professional: getProfessionalName(shift, professionalMap),
          sector: getSectorName(shift, sectorMap),
          hours,
          rate: null,
          cost: null,
        });
      }
    });

    return { estimatedCost, knownRates, missingRates, rows };
  }, [filteredShifts, professionalMap, sectorMap]);

  const cancellationRows = useMemo(() => {
    return filteredShifts
      .filter((shift) => ['cancelado', 'canceled'].includes(getStatusKey(shift?.status)))
      .map((shift) => ({
        date: getShiftDate(shift),
        professional: getProfessionalName(shift, professionalMap),
        sector: getSectorName(shift, sectorMap),
        reason: shift?.cancellation_reason || shift?.cancel_reason || shift?.reason || 'Não informado',
      }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [filteredShifts, professionalMap, sectorMap]);

  const criticalAlerts = useMemo(() => {
    const alerts = [];
    riskRows.forEach((row) => {
      if (row.level === 'critico') {
        alerts.push({
          type: 'critical',
          title: 'Cobertura operacional baixa',
          description: `${row.name}: ${formatNumber(row.coverage, 1)}% dos registros estão confirmados.`,
        });
      }
    });
    if (baseMetrics.canceled > 0) {
      alerts.push({
        type: 'warning',
        title: 'Cancelamentos registrados',
        description: `${formatNumber(baseMetrics.canceled)} registro(s) de cancelamento no período.`,
      });
    }
    return alerts;
  }, [riskRows, baseMetrics]);

  const reportId = useMemo(() => {
    const date = new Date();
    const datePart = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('');
    return `CIH-${datePart}-${Math.floor(Math.random() * 90000 + 10000)}`;
  }, []);

  const filtersLabel = useMemo(() => {
    const values = [];
    if (filters.startDate) values.push(`Início: ${formatDateBR(filters.startDate)}`);
    if (filters.endDate) values.push(`Fim: ${formatDateBR(filters.endDate)}`);
    if (filters.sectorId !== 'todos') {
      const s = sectors.find((item) => String(item?.id) === String(filters.sectorId));
      values.push(`Setor: ${s?.name || s?.nome || filters.sectorId}`);
    }
    if (filters.status !== 'todos') values.push(`Status: ${getStatusLabel(filters.status)}`);
    return values.length ? values.join(' • ') : 'Todos os registros disponíveis';
  }, [filters, sectors]);

  const reportPayload = useMemo(() => {
    const config = REPORT_CONFIG[activeTab];
    let columns = [], rows = [], totalsRow = null;

    if (activeTab === 'executiva') {
      columns = ['Indicador', 'Valor'];
      rows = [
        ['Registros', baseMetrics.total],
        ['Confirmados', baseMetrics.confirmed],
        ['Pendentes', baseMetrics.pending],
        ['Cancelados', baseMetrics.canceled],
        ['Abertos', baseMetrics.open],
        ['Horas confirmadas', Number(baseMetrics.confirmedHours.toFixed(2))],
        ['Cobertura operacional', `${Number(baseMetrics.coverage.toFixed(2))}%`],
        ['Custo Financeiro Estimado', formatCurrency(financialData.estimatedCost)],
      ];
    } else if (activeTab === 'produtividade') {
      columns = ['Profissional', 'Categoria', 'Total', 'Confirmados', 'Pendentes', 'Cancelados', 'Horas'];
      rows = byProfessional.map((r) => [r.name, r.category, r.total, r.confirmed, r.pending, r.canceled, Number(r.hours.toFixed(2))]);
      totalsRow = ['TOTAL', '', baseMetrics.total, baseMetrics.confirmed, baseMetrics.pending, baseMetrics.canceled, Number(baseMetrics.totalHours.toFixed(2))];
    } else if (activeTab === 'cobertura' || activeTab === 'risco') {
      columns = ['Setor', 'Total', 'Confirmados', 'Pendentes', 'Cancelados', 'Abertos', 'Cobertura %'];
      rows = bySector.map((r) => [r.name, r.total, r.confirmed, r.pending, r.canceled, r.open, Number(r.coverage.toFixed(2))]);
    } else if (activeTab === 'financeiro') {
      columns = ['Profissional', 'Setor', 'Horas', 'Valor/Hora', 'Custo estimado'];
      rows = financialData.rows.map((r) => [r.professional, r.sector, Number(r.hours.toFixed(2)), r.rate === null ? 'Não informado' : Number(r.rate.toFixed(2)), r.cost === null ? 'Não informado' : Number(r.cost.toFixed(2))]);
    } else if (activeTab === 'turnover') {
      columns = ['Data', 'Profissional', 'Setor', 'Motivo'];
      rows = cancellationRows.map((r) => [formatDateBR(r.date), r.professional, r.sector, r.reason]);
    } else if (activeTab === 'auditoria') {
      columns = ['Evento', 'Descrição', 'Data/Hora'];
      rows = auditEvents.map((e) => [e.type, e.description, e.timestamp]);
    }

    return {
      reportId,
      title: config?.label || 'Relatório',
      companyId: companyId || null,
      unitId: unitId || null,
      filters,
      filtersLabel,
      status: reportStatus,
      version: reportVersion,
      kpis: baseMetrics,
      columns,
      rows,
      totalsRow,
    };
  }, [activeTab, reportId, companyId, unitId, filters, filtersLabel, reportStatus, reportVersion, baseMetrics, byProfessional, bySector, financialData, cancellationRows, auditEvents]);

  const calculateReportHash = useCallback(async () => {
    setHashLoading(true);
    try {
      const stablePayload = {
        reportId: reportPayload.reportId,
        title: reportPayload.title,
        kpis: reportPayload.kpis,
        rows: reportPayload.rows,
      };
      const hash = await generateSHA256(JSON.stringify(stablePayload));
      setReportHash(hash);
      return hash;
    } finally {
      setHashLoading(false);
    }
  }, [reportPayload]);

  const addAuditEvent = useCallback((type, description) => {
    const event = {
      id: Math.random().toString(36).substring(2),
      type,
      description,
      timestamp: new Date().toLocaleString('pt-BR'),
    };
    setAuditEvents((current) => [event, ...current]);
  }, []);

  const openReportPreview = async () => {
    addAuditEvent('VISUALIZAÇÃO', `Relatório oficial "${REPORT_CONFIG[activeTab]?.label}" aberto.`);
    setReportModalOpen(true);
    await calculateReportHash();
  };

  const exportCSV = () => {
    const lines = [];
    lines.push([escapeCSV('CENTRAL DE INTELIGÊNCIA HOSPITALAR')]);
    lines.push([escapeCSV('Relatório'), escapeCSV(reportPayload.title)].join(';'));
    lines.push([escapeCSV('Filtros'), escapeCSV(reportPayload.filtersLabel)].join(';'));
    lines.push('');
    reportPayload.kpis?.forEach((k) => lines.push([k.label, k.value].map(escapeCSV).join(';')));
    lines.push('');
    lines.push(reportPayload.columns.map(escapeCSV).join(';'));
    reportPayload.rows.forEach((row) => lines.push(row.map(escapeCSV).join(';')));
    if (reportPayload.totalsRow) lines.push(reportPayload.totalsRow.map(escapeCSV).join(';'));

    const content = '\uFEFF' + lines.join('\r\n');
    downloadFile(content, `${sanitizeFilename(reportPayload.title)}-${reportPayload.reportId}.csv`);
    addAuditEvent('EXPORTAÇÃO', 'Exportação de arquivo CSV concluída.');
  };

  const resetFilters = () => {
    setFilters({ startDate: '', endDate: '', sectorId: 'todos', status: 'todos', professionalId: 'todos', category: 'todos' });
  };

  const activeConfig = REPORT_CONFIG[activeTab];
  const ActiveIcon = activeConfig?.icon || Activity;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-sky-600 flex items-center justify-center shadow-xl">
            <Loader2 className="w-7 h-7 text-white animate-spin" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Carregando Central de Inteligência</h2>
            <p className="text-sm text-slate-500 mt-1">Sincronizando dados hospitalares...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
          body * { visibility: hidden !important; }
          #report-print-area, #report-print-area * { visibility: visible !important; }
          #report-print-area {
            position: absolute !important; left: 0 !important; top: 0 !important;
            width: 100% !important; margin: 0 !important; padding: 12mm !important;
            background: #ffffff !important; color: #0f172a !important; box-shadow: none !important; border: 0 !important;
          }
          .report-no-print { display: none !important; }
        }
      `}</style>

      {/* Menu mobile */}
      <div className="lg:hidden sticky top-0 z-40 bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-sky-400" />
          <span className="font-bold text-sm">Inteligência Hospitalar</span>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex min-h-screen">
        {/* SIDEBAR CORPORATIVA (Otimizada Diurno e Noturno) */}
        <aside className={`
          fixed lg:sticky top-0 left-0 z-50 h-screen w-[280px]
          bg-slate-950 dark:bg-slate-900 border-r border-slate-800 dark:border-slate-800 text-slate-100
          flex flex-col shadow-2xl transition-transform duration-300
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="px-6 py-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-sky-600 flex items-center justify-center shadow-lg shadow-sky-900/50">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-black text-sm tracking-wider text-white">CENTRAL DE</div>
                <div className="text-xs font-semibold text-sky-400">INTELIGÊNCIA HOSPITALAR</div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
            <div>
              <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Visão Executiva</div>
              <SidebarItem active={activeTab === 'executiva'} icon={LayoutDashboard} label="Visão Executiva" onClick={() => { setActiveTab('executiva'); setMobileMenuOpen(false); }} />
            </div>

            <div>
              <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Operacional</div>
              {['produtividade', 'cobertura', 'risco', 'financeiro', 'turnover'].map((key) => {
                const conf = REPORT_CONFIG[key];
                const Icon = conf.icon;
                return (
                  <SidebarItem key={key} active={activeTab === key} icon={Icon} label={conf.label} onClick={() => { setActiveTab(key); setMobileMenuOpen(false); }} />
                );
              })}
            </div>

            <div>
              <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Governança</div>
              <SidebarItem active={activeTab === 'auditoria'} icon={ClipboardCheck} label="Governança & Auditoria" onClick={() => { setActiveTab('auditoria'); setMobileMenuOpen(false); }} />
            </div>
          </div>

          <div className="border-t border-slate-800 p-4 bg-slate-900/50">
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
              <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold">
                <ShieldCheck className="w-4 h-4" /> Ambiente Corporativo
              </div>
              <div className="mt-1 text-[10px] text-slate-400 leading-relaxed">Cruzamento financeiro ativo com faturamento real.</div>
            </div>
          </div>
        </aside>

        {mobileMenuOpen && <button type="button" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-black/60 lg:hidden" />}

        {/* CONTEÚDO PRINCIPAL */}
        <main className="flex-1 min-w-0">
          <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">
            <div className="px-5 sm:px-8 py-5">
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-sky-600 dark:bg-sky-500 items-center justify-center shrink-0 shadow-md shadow-sky-500/20">
                    <ActiveIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Módulo Ativo</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">SINCRONIZADO</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white mt-1">{activeConfig.label}</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{activeConfig.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => loadData(true)} disabled={refreshing} className="gap-2 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
                  </Button>
                  <Button type="button" variant="outline" onClick={exportCSV} className="gap-2 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar CSV
                  </Button>
                  <Button type="button" onClick={openReportPreview} className="gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-md shadow-sky-600/20">
                    <Eye className="w-4 h-4" /> Visualizar Relatório Oficial
                  </Button>
                </div>
              </div>
            </div>
          </header>

          {/* FILTROS AVANÇADOS */}
          <section className="px-5 sm:px-8 pt-6">
            <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-slate-800 flex items-center justify-center">
                    <SlidersHorizontal className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white text-sm">Filtros Operacionais</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Refine o escopo de análise em tempo real.</p>
                  </div>
                </div>
                <Button type="button" variant="ghost" onClick={resetFilters} className="gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white text-xs">
                  <RefreshCw className="w-3.5 h-3.5" /> Limpar filtros
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                <FilterField label="Data inicial" icon={CalendarDays}>
                  <Input type="date" value={filters.startDate} onChange={(e) => setFilters(c => ({ ...c, startDate: e.target.value }))} className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700" />
                </FilterField>

                <FilterField label="Data final" icon={CalendarDays}>
                  <Input type="date" value={filters.endDate} onChange={(e) => setFilters(c => ({ ...c, endDate: e.target.value }))} className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700" />
                </FilterField>

                <FilterField label="Setor" icon={Building2}>
                  <Select value={filters.sectorId} onValueChange={(v) => setFilters(c => ({ ...c, sectorId: v }))}>
                    <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os setores</SelectItem>
                      {sectors.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name || s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>

                <FilterField label="Status" icon={CheckCircle2}>
                  <Select value={filters.status} onValueChange={(v) => setFilters(c => ({ ...c, status: v }))}>
                    <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>

                <FilterField label="Profissional" icon={Users}>
                  <Select value={filters.professionalId} onValueChange={(v) => setFilters(c => ({ ...c, professionalId: v }))}>
                    <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os profissionais</SelectItem>
                      {professionals.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{getProfessionalName(p, {})}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-sky-600" /> <span><strong>Filtro ativo:</strong> {filtersLabel}</span>
              </div>
            </Card>
          </section>

          {error && (
            <section className="px-5 sm:px-8 pt-5">
              <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/40 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-900 dark:text-red-200">Atenção ao carregar base</div>
                  <div className="text-sm text-red-700 dark:text-red-300 mt-0.5">{error}</div>
                </div>
              </div>
            </section>
          )}

          {/* RENDERIZAÇÃO DAS ABAS DA CENTRAL */}
          <section className="px-5 sm:px-8 py-6">
            {activeTab === 'executiva' && (
              <ExecutiveView baseMetrics={baseMetrics} riskRows={riskRows} byProfessional={byProfessional} criticalAlerts={criticalAlerts} />
            )}
            {activeTab === 'produtividade' && (
              <ProductivityView rows={byProfessional} baseMetrics={baseMetrics} />
            )}
            {activeTab === 'cobertura' && (
              <CoverageDashboard coverageSummary={baseMetrics} coverageMap={coverageMap} onSelectSector={setSectorDetail} />
            )}
            {activeTab === 'risco' && <RiskView rows={riskRows} />}
            {activeTab === 'financeiro' && <FinancialView data={financialData} />}
            {activeTab === 'turnover' && <CancellationView rows={cancellationRows} />}
            {activeTab === 'auditoria' && (
              <GovernanceView reportId={reportId} version={reportVersion} status={reportStatus} hash={reportHash} hashLoading={hashLoading} auditEvents={auditEvents} onGenerateHash={calculateReportHash} onStatusChange={setReportStatus} onNewVersion={() => setReportVersion(v => v + 1)} />
            )}
          </section>
        </main>
      </div>

      {reportModalOpen && (
        <ReportPreviewModal
          reportPayload={reportPayload}
          reportHash={reportHash}
          hashLoading={hashLoading}
          reportStatus={reportStatus}
          reportVersion={reportVersion}
          onClose={() => setReportModalOpen(false)}
          onPrint={() => window.print()}
          onExport={exportCSV}
          onStatusChange={setReportStatus}
          onNewVersion={() => setReportVersion(v => v + 1)}
        />
      )}

      {sectorDetail && (
        <SectorDetailModal
          sectorName={sectorDetail}
          shifts={filteredShifts}
          onClose={() => setSectorDetail(null)}
        />
      )}
    </div>
  );
}

/* ============================================================
   SUBCOMPONENTES VISUAIS REUTILIZÁVEIS
   ============================================================ */

function SidebarItem({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3.5 py-3 rounded-xl mb-1 text-left transition-all group
        ${active ? 'bg-sky-600 text-white font-bold shadow-lg shadow-sky-900/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}
      `}
    >
      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
      <span className="text-xs flex-1">{label}</span>
      {active && <ChevronRight className="w-3.5 h-3.5" />}
    </button>
  );
}

function FilterField({ label, icon: Icon, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-sky-600" />} {label}
      </label>
      {children}
    </div>
  );
}

function ExecutiveView({ baseMetrics, riskRows, byProfessional, criticalAlerts }) {
  const topProfessionals = byProfessional.slice(0, 6);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2 p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Resumo executivo</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Indicadores consolidados da operação</p>
            </div>
            <Activity className="w-5 h-5 text-slate-400" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ExecutiveMetric label="Cobertura" value={`${formatNumber(baseMetrics.coverage, 1)}%`} />
            <ExecutiveMetric label="Horas" value={formatNumber(baseMetrics.confirmedHours, 1)} />
            <ExecutiveMetric label="Pendências" value={formatNumber(baseMetrics.pending)} />
            <ExecutiveMetric label="Cancelamentos" value={formatNumber(baseMetrics.canceled)} />
          </div>
        </Card>

        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <h2 className="font-bold text-slate-900 dark:text-white">Situação operacional</h2>
          </div>

          <div className="space-y-4">
            <StatusLine label="Regular" value={riskRows.filter((row) => row.level === 'regular').length} type="success" />
            <StatusLine label="Atenção" value={riskRows.filter((row) => row.level === 'atencao').length} type="warning" />
            <StatusLine label="Crítico" value={riskRows.filter((row) => row.level === 'critico').length} type="danger" />
          </div>

          <p className="text-[11px] text-slate-400 mt-5 leading-relaxed">
            Classificação operacional baseada no percentual de registros confirmados. Não substitui avaliação técnica regulatória.
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Cobertura por setor</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Menores percentuais aparecem primeiro</p>
            </div>
          </div>
          <div className="space-y-4">
            {riskRows.slice(0, 8).map((row) => (
              <CoverageBar key={row.name} label={row.name} value={row.coverage} />
            ))}
          </div>
        </Card>

        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Profissionais por horas</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Maior volume de horas no período</p>
            </div>
          </div>
          <div className="space-y-3">
            {topProfessionals.map((row, index) => (
              <div key={row.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-900 dark:text-white truncate">{row.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">{row.category}</div>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{formatNumber(row.hours, 1)}h</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {criticalAlerts.length > 0 && (
        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="font-bold text-slate-900 dark:text-white">Alertas de gestão</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {criticalAlerts.map((alert, index) => (
              <div key={index} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="font-semibold text-sm text-slate-900 dark:text-white">{alert.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{alert.description}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ExecutiveMetric({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{value}</div>
    </div>
  );
}

function StatusLine({ label, value, type }) {
  const styles = {
    success: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    warning: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    danger: 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  };
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${styles[type]}`}>{formatNumber(value)}</span>
    </div>
  );
}

function CoverageBar({ label, value }) {
  const numeric = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate pr-3">{label}</span>
        <span className="font-bold text-slate-600 dark:text-slate-300">{formatNumber(numeric, 1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${numeric}%` }} />
      </div>
    </div>
  );
}

function ProductivityView({ rows, baseMetrics }) {
  return (
    <ReportCard title="Produtividade por profissional" description="Carga horária e volume de plantões confirmados.">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
              <th className="py-3 pr-4">Profissional</th>
              <th className="py-3 px-4">Categoria</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-right">Confirmados</th>
              <th className="py-3 px-4 text-right">Pendentes</th>
              <th className="py-3 px-4 text-right">Cancelados</th>
              <th className="py-3 pl-4 text-right">Horas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                <td className="py-3 pr-4 font-medium">{row.name}</td>
                <td className="py-3 px-4 text-slate-500">{row.category}</td>
                <td className="py-3 px-4 text-right">{formatNumber(row.total)}</td>
                <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{formatNumber(row.confirmed)}</td>
                <td className="py-3 px-4 text-right text-amber-600">{formatNumber(row.pending)}</td>
                <td className="py-3 px-4 text-right text-red-600">{formatNumber(row.canceled)}</td>
                <td className="py-3 pl-4 text-right font-bold">{formatNumber(row.hours, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportCard>
  );
}

function RiskView({ rows }) {
  return (
    <ReportCard title="Painel de risco operacional" description="Indicadores internos de cobertura e pendência.">
      <div className="space-y-3">
        {rows.map((row) => {
          const levelConfig = {
            regular: { label: 'Regular', className: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
            atencao: { label: 'Atenção', className: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
            critico: { label: 'Crítico', className: 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' },
          }[row.level];

          return (
            <div key={row.name} className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex-1">
                <div className="font-semibold text-slate-900 dark:text-white">{row.name}</div>
                <div className="text-xs text-slate-500 mt-1">{row.confirmed} confirmados de {row.total} registros</div>
              </div>
              <div className="w-full md:w-64"><CoverageBar label="" value={row.coverage} /></div>
              <div className={`px-3 py-2 rounded-lg border text-xs font-bold text-center ${levelConfig.className}`}>{levelConfig.label}</div>
            </div>
          );
        })}
      </div>
    </ReportCard>
  );
}

function FinancialView({ data }) {
  return (
    <div className="space-y-5">
      {data.missingRates > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 p-4 text-xs text-amber-900 dark:text-amber-200">
          <strong>Atenção financeira:</strong> {formatNumber(data.missingRates)} registro(s) sem valor de remuneração cadastrado.
        </div>
      )}
      <ReportCard title="Detalhamento financeiro" description="Custos estimados por hora e contrato cruzados com Faturamento.">
        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mb-4">{formatCurrency(data.estimatedCost)}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                <th className="py-3">Profissional</th>
                <th className="py-3">Setor</th>
                <th className="py-3 text-right">Horas</th>
                <th className="py-3 text-right">Valor/Hora</th>
                <th className="py-3 text-right">Custo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {data.rows.map((row, index) => (
                <tr key={`${row.professional}-${index}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                  <td className="py-3 font-medium">{row.professional}</td>
                  <td className="py-3 text-slate-500">{row.sector}</td>
                  <td className="py-3 text-right">{formatNumber(row.hours, 1)}h</td>
                  <td className="py-3 text-right">{row.rate === null ? '—' : formatCurrency(row.rate)}</td>
                  <td className="py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{row.cost === null ? '—' : formatCurrency(row.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportCard>
    </div>
  );
}

function CancellationView({ rows }) {
  return (
    <ReportCard title="Cancelamentos registrados" description="Visão operacional dos registros classificados como cancelados.">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
              <th className="py-3">Data</th>
              <th className="py-3">Profissional</th>
              <th className="py-3">Setor</th>
              <th className="py-3">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
            {rows.map((row, index) => (
              <tr key={`${row.date}-${index}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                <td className="py-3">{formatDateBR(row.date)}</td>
                <td className="py-3 font-medium">{row.professional}</td>
                <td className="py-3 text-slate-500">{row.sector}</td>
                <td className="py-3 text-red-600">{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportCard>
  );
}

function GovernanceView({ reportId, version, status, hash, hashLoading, auditEvents, onGenerateHash, onStatusChange, onNewVersion }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <GovernanceCard icon={FileCheck2} title="Status" value={status} description="Estado atual do documento" />
        <GovernanceCard icon={History} title="Versão" value={`v${version}`} description="Controle de versão" />
        <GovernanceCard icon={Hash} title="Integridade" value={hash ? 'Verificado' : 'Não calculado'} description="SHA-256 do conteúdo" />
        <GovernanceCard icon={ShieldCheck} title="Auditoria" value={formatNumber(auditEvents.length)} description="Eventos na sessão" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <h2 className="font-bold text-slate-900 dark:text-white text-base mb-1">Governança do documento</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Controle do ciclo de vida do relatório.</p>
          <div className="space-y-3">
            {['Rascunho', 'Em revisão', 'Aprovado'].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onStatusChange(option)}
                className={`
                  w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all
                  ${status === option ? 'border-sky-600 bg-sky-600 text-white font-bold shadow-md' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'}
                `}
              >
                <span>{option}</span>
                {status === option && <CheckCircle2 className="w-5 h-5" />}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" className="w-full mt-4 gap-2 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" onClick={onNewVersion}>
            <History className="w-4 h-4" /> Criar nova versão
          </Button>
        </Card>

        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <h2 className="font-bold text-slate-900 dark:text-white text-base mb-1">Integridade do relatório</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Identificador criptográfico do conteúdo.</p>
          <div className="rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-200">
            <div className="text-[10px] uppercase text-slate-500 font-bold">ID</div>
            <div className="mt-0.5">{reportId}</div>
            <div className="text-[10px] uppercase text-slate-500 font-bold mt-3">SHA-256</div>
            <div className="mt-0.5 break-all text-sky-400">{hash || 'Hash ainda não calculado'}</div>
          </div>
          <Button type="button" className="w-full mt-4 gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold" onClick={onGenerateHash} disabled={hashLoading}>
            {hashLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />} Calcular SHA-256
          </Button>
        </Card>
      </div>
    </div>
  );
}

function GovernanceCard({ icon: Icon, title, value, description }) {
  return (
    <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">{title}</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-2">{value}</div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-slate-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-3">{description}</div>
    </Card>
  );
}

function ReportCard({ title, description, children }) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-colors">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
        <h2 className="font-bold text-base text-slate-900 dark:text-white">{title}</h2>
        {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </Card>
  );
}

function SectorDetailModal({ sectorName, shifts, onClose }) {
  if (!sectorName) return null;
  const sectorShifts = (shifts || []).filter((shift) => getSectorName(shift) === sectorName);
  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Detalhes do Setor: {sectorName}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase">
                <th className="p-2.5">Data</th>
                <th className="p-2.5">Horário</th>
                <th className="p-2.5">Profissional</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {sectorShifts.map((s, idx) => {
                const status = getShiftStatus(s);
                return (
                  <tr key={s.id || idx}>
                    <td className="p-2.5">{formatDateBR(s.date)}</td>
                    <td className="p-2.5">{s.start_time} - {s.end_time}</td>
                    <td className="p-2.5 font-bold">{s.professional_name || 'Vago'}</td>
                    <td className="p-2.5 uppercase font-bold text-[10px]">{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-right">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
}

function ReportPreviewModal({ reportPayload, reportHash, hashLoading, reportStatus, reportVersion, onClose, onPrint, onExport, onStatusChange }) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-sky-400 uppercase tracking-widest">Visualização Oficial A4</div>
            <h2 className="text-xl font-black mt-0.5">{reportPayload.title}</h2>
            <p className="text-xs text-slate-300 mt-1">{reportPayload.companyName} · {reportPayload.filtersLabel}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10"><X className="w-5 h-5" /></Button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-slate-800 dark:text-slate-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {reportPayload.kpis && Object.entries(reportPayload.kpis).slice(0, 4).map(([k, v], i) => (
              <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] uppercase font-bold text-slate-400">{k}</div>
                <div className="text-base font-black text-sky-600 dark:text-sky-400 mt-1">{String(v)}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-slate-100 dark:bg-slate-800 uppercase text-[10px] text-slate-500">
                <tr>
                  {reportPayload.columns.map((col, idx) => (
                    <th key={idx} className="p-3 font-bold">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {reportPayload.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-3">{String(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div className="text-xs text-slate-500 font-mono">Hash SHA-256: {reportHash || 'Pendente'}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onExport} className="gap-2 text-xs"><FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar CSV</Button>
            <Button onClick={onPrint} className="gap-2 bg-sky-600 text-white text-xs font-bold"><Printer className="w-4 h-4" /> Imprimir A4 / PDF</Button>
          </div>
        </div>
      </div>
    </div>
  );
}