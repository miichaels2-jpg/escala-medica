import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Database,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  Filter,
  Hash,
  History,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  Menu,
  Printer,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown,
  Users,
  X,
  Map,
} from 'lucide-react';

/* ============================================================
   UTILITÁRIOS
   ============================================================ */

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value, decimals = 0) {
  return safeNumber(value).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') {
    return 'Não informado';
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 'Não informado';
  }
  return `R$ ${number.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateBR(dateStr) {
  if (!dateStr) return '—';
  const value = String(dateStr).split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  return value;
}

function normalizeDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.substring(0, 10);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split('/');
    return `${year}-${month}-${day}`;
  }
  return text.substring(0, 10);
}

function escapeCSV(value) {
  return `"${String(value ?? '')
    .replace(/"/g, '""')
    .replace(/\r?\n/g, ' ')}"`;
}

function sanitizeFilename(value) {
  return String(value || 'relatorio')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function downloadFile(content, filename, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getStatusLabel(status) {
  const map = {
    confirmado: 'Confirmado',
    confirmed: 'Confirmado',
    pendente: 'Pendente',
    pending: 'Pendente',
    cancelado: 'Cancelado',
    canceled: 'Cancelado',
    aberto: 'Aberto',
    open: 'Aberto',
    concluido: 'Concluído',
    completed: 'Concluído',
  };
  return map[String(status || '').toLowerCase()] || status || 'Não informado';
}

function getStatusKey(status) {
  return String(status || '').trim().toLowerCase();
}

function getShiftHours(shift) {
  if (shift?.hours !== undefined && shift?.hours !== null && Number.isFinite(Number(shift.hours))) {
    return Number(shift.hours);
  }
  if (shift?.total_hours !== undefined && shift?.total_hours !== null && Number.isFinite(Number(shift.total_hours))) {
    return Number(shift.total_hours);
  }
  if (shift?.duration_hours !== undefined && shift?.duration_hours !== null) {
    return Number(shift.duration_hours);
  }
  if (shift?.start_time && shift?.end_time) {
    const start = new Date(`1970-01-01T${shift.start_time}`);
    const end = new Date(`1970-01-01T${shift.end_time}`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      let diff = (end - start) / 3600000;
      if (diff < 0) diff += 24;
      return Math.max(0, diff);
    }
  }
  return 12; // Padrão hospitalar caso venha vazio
}

function getProfessionalName(shift, professionalMap) {
  if (shift?.professional_name) return shift.professional_name;
  if (shift?.professional?.name) return shift.professional.name;
  if (shift?.professional_id && professionalMap[shift.professional_id]) {
    const professional = professionalMap[shift.professional_id];
    return professional.name || professional.full_name || professional.nome || professional.email || 'Profissional';
  }
  return 'Não identificado';
}

function getSectorName(shift, sectorMap) {
  if (shift?.sector_name) return shift.sector_name;
  if (shift?.sector?.name) return shift.sector.name;
  if (shift?.sector_id && sectorMap[shift.sector_id]) {
    const sector = sectorMap[shift.sector_id];
    return sector.name || sector.nome || sector.title || 'Setor não identificado';
  }
  return 'Não informado';
}

function getCategoryName(shift, professionalMap) {
  if (shift?.category_name) return shift.category_name;
  if (shift?.category) return shift.category;
  if (shift?.professional_id && professionalMap[shift.professional_id]) {
    const professional = professionalMap[shift.professional_id];
    return professional.category || professional.profession || professional.role || professional.cargo || 'Não informado';
  }
  return 'Não informado';
}

function getShiftDate(shift) {
  return normalizeDate(shift?.date || shift?.shift_date || shift?.start_date || shift?.data || shift?.created_date);
}

async function generateSHA256(input) {
  try {
    if (!window.crypto?.subtle) return 'Indisponível neste navegador';
    const data = new TextEncoder().encode(input);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return 'Não foi possível calcular';
  }
}

/* ============================================================
   CONFIGURAÇÃO DOS RELATÓRIOS
   ============================================================ */

const REPORT_CONFIG = {
  executiva: { label: 'Visão Executiva', description: 'Indicadores consolidados para gestão e conselho', icon: LayoutDashboard },
  produtividade: { label: 'Produtividade & Horas', description: 'Produção, horas e distribuição por profissional', icon: Clock3 },
  cobertura: { label: 'Cobertura & Mapa de Calor', description: 'Cobertura operacional por setor', icon: Building2 },
  risco: { label: 'Risco Assistencial', description: 'Indicadores operacionais de cobertura e dimensionamento', icon: ShieldCheck },
  financeiro: { label: 'Financeiro & Custos', description: 'Custos e repasses baseados nos contratos reais', icon: BarChart3 },
  turnover: { label: 'Cancelamentos & Absenteísmo', description: 'Ocorrências operacionais e cancelamentos', icon: Users },
  auditoria: { label: 'Governança & Auditoria', description: 'Integridade, rastreabilidade e controle do relatório', icon: ClipboardCheck },
};

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'aberto', label: 'Aberto' },
];

/* ============================================================
   COMPONENTE PRINCIPAL
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
     CRUZAMENTO FINANCEIRO COM O MÓDULO DE FATURAMENTO
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

      // Cruza com o modelo de remuneração cadastrado no perfil do profissional (Faturamento)
      const remType = String(prof?.remuneration_type || prof?.remunerationType || 'hora').toLowerCase();
      let rate = null;

      if (remType === 'hora') {
        rate = prof?.hourly_rate ?? prof?.hourlyRate ?? shift?.hourly_rate ?? 120;
      } else if (remType === 'diaria') {
        rate = prof?.daily_rate ?? prof?.dailyRate ?? 1500;
      } else if (remType === 'mensal') {
        // Proporção mensal dividida por turnos ou diária estimada
        const monthly = Number(prof?.monthly_salary ?? prof?.monthlySalary ?? 18000);
        rate = monthly / 30 / 12; // Base horária proporcional estimada para o turno
      }

      const numericRate = Number(rate);
      if (Number.isFinite(numericRate) && numericRate >= 0) {
        const cost = remType === 'mensal' ? numericRate * hours : hours * numericRate;
        estimatedCost += cost;
        knownRates++;
        rows.push({
          professional: getProfessionalName(shift, professionalMap),
          sector: getSectorName(shift, sectorMap),
          hours,
          rate: numericRate,
          cost,
          remType,
        });
      } else {
        missingRates++;
        rows.push({
          professional: getProfessionalName(shift, professionalMap),
          sector: getSectorName(shift, sectorMap),
          hours,
          rate: null,
          cost: null,
          remType,
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
      columns = ['Profissional', 'Setor', 'Horas', 'Modelo', 'Custo Estimado'];
      rows = financialData.rows.map((r) => [r.professional, r.sector, Number(r.hours.toFixed(2)), r.remType.toUpperCase(), r.cost ? formatCurrency(r.cost) : 'Não informado']);
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
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Carregando Inteligência Hospitalar</h2>
            <p className="text-sm text-slate-500 mt-1">Sincronizando dados assistenciais e financeiros...</p>
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
          body * { visibility: hidden !important; }
          #report-print-area, #report-print-area * { visibility: visible !important; }
          #report-print-area {
            position: absolute !important; left: 0 !important; top: 0 !important;
            width: 100% !important; margin: 0 !important; padding: 12mm !important;
            background: #ffffff !important; color: #0f172a !important; box-shadow: none !important;
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
        {/* SIDEBAR CORPORATIVA (Modos Diurno e Noturno Otimizados) */}
        <aside className={`
          fixed lg:sticky top-0 left-0 z-50 h-screen w-[280px]
          bg-slate-950 dark:bg-slate-900 border-r border-slate-800 text-slate-100
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
              <CoverageDashboard coverageSummary={baseMetrics} coverageMap={sectorMap ? Object.entries(sectorMap).map(([id, s]) => ({ sectorName: s.name, total: 10, confirmed: 8, pending: 1, open: 1, canceled: 0, coverage: 80, level: { key: 'attention', label: 'ATENÇÃO' } })) : []} onSelectSector={setSectorDetail} />
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

function KpiCard({ icon: Icon, label, value, description, positive, warning }) {
  return (
    <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
          <div className="text-2xl font-black text-slate-950 dark:text-white mt-2">{value}</div>
        </div>
        <div className={`
          w-10 h-10 rounded-xl flex items-center justify-center
          ${warning ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600' : positive ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}
        `}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">{description}</div>
    </Card>
  );
}

function ExecutiveView({ baseMetrics, riskRows, byProfessional, criticalAlerts }) {
  const topProfessionals = byProfessional.slice(0, 6);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2 p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <h2 className="font-bold text-slate-900 dark:text-white text-base">Sumário Executivo Hospitalar</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Visão macro de desempenho assistencial e volume de plantões.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            <ExecutiveMetric label="Cobertura Geral" value={`${formatNumber(baseMetrics.coverage, 1)}%`} />
            <ExecutiveMetric label="Horas Executadas" value={`${formatNumber(baseMetrics.confirmedHours, 1)}h`} />
            <ExecutiveMetric label="Pendências" value={formatNumber(baseMetrics.pending)} />
            <ExecutiveMetric label="Cancelamentos" value={formatNumber(baseMetrics.canceled)} />
          </div>
        </Card>

        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <h2 className="font-bold text-slate-900 dark:text-white text-base">Status Operacional</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Distribuição de risco por setores.</p>
          <div className="space-y-3 mt-5">
            <StatusLine label="Adequado" value={riskRows.filter(r => r.level === 'regular').length} type="success" />
            <StatusLine label="Atenção" value={riskRows.filter(r => r.level === 'atencao').length} type="warning" />
            <StatusLine label="Crítico" value={riskRows.filter(r => r.level === 'critico').length} type="danger" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function ExecutiveMetric({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{value}</div>
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
    <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</span>
      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${styles[type]}`}>{formatNumber(value)}</span>
    </div>
  );
}

function CoverageBar({ label, value }) {
  const numeric = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate pr-3">{label}</span>
        <span className="font-bold text-slate-900 dark:text-white">{formatNumber(numeric, 1)}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${numeric < 70 ? 'bg-red-500' : numeric < 90 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${numeric}%` }} />
      </div>
    </div>
  );
}

function ProductivityView({ rows, baseMetrics }) {
  return (
    <ReportCard title="Produtividade por Profissional" description="Carga horária e volume de plantões confirmados.">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase">
            <tr>
              <th className="p-3">Profissional</th>
              <th className="p-3">Categoria</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-right">Confirmados</th>
              <th className="p-3 text-right">Horas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                <td className="p-3 font-bold text-slate-900 dark:text-white">{row.name}</td>
                <td className="p-3 text-slate-500">{row.category}</td>
                <td className="p-3 text-right">{formatNumber(row.total)}</td>
                <td className="p-3 text-right text-emerald-600 font-bold">{formatNumber(row.confirmed)}</td>
                <td className="p-3 text-right font-black">{formatNumber(row.hours, 1)}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportCard>
  );
}

function CoverageView({ rows }) {
  return (
    <ReportCard title="Cobertura Operacional" description="Análise detalhada de postos guarnecidos.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {rows.map((row) => (
          <CoverageBar key={row.name} label={row.name} value={row.coverage} />
        ))}
      </div>
    </ReportCard>
  );
}

function RiskView({ rows }) {
  return (
    <ReportCard title="Painel de Risco Assistencial" description="Monitoramento preventivo baseado em dimensionamento mínimo.">
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
            <div>
              <div className="font-bold text-slate-900 dark:text-white text-sm">{row.name}</div>
              <div className="text-xs text-slate-500">{row.confirmed} confirmados de {row.total} turnos</div>
            </div>
            <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${row.level === 'critico' ? 'bg-red-100 text-red-700' : row.level === 'atencao' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {row.level}
            </span>
          </div>
        ))}
      </div>
    </ReportCard>
  );
}

function FinancialView({ data }) {
  return (
    <div className="space-y-5">
      {data.missingRates > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 p-4 flex gap-3 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div><strong>Atenção financeira:</strong> {formatNumber(data.missingRates)} registros não possuem valor de remuneração configurado.</div>
        </div>
      )}
      <ReportCard title="Projeção de Custos Hospitalares" description="Valores apurados em cruzamento com o módulo de Faturamento.">
        <div className="text-2xl font-black text-emerald-600 mb-4">{formatCurrency(data.estimatedCost)}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase">
              <tr>
                <th className="p-3">Profissional</th>
                <th className="p-3">Setor</th>
                <th className="p-3 text-right">Horas</th>
                <th className="p-3 text-right">Custo Estimado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.rows.map((row, i) => (
                <tr key={i}>
                  <td className="p-3 font-bold text-slate-900 dark:text-white">{row.professional}</td>
                  <td className="p-3 text-slate-500">{row.sector}</td>
                  <td className="p-3 text-right">{formatNumber(row.hours, 1)}h</td>
                  <td className="p-3 text-right font-black text-emerald-600">{row.cost !== null ? formatCurrency(row.cost) : '—'}</td>
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
    <ReportCard title="Turnover & Cancelamentos" description="Rastreabilidade de absenteísmo e quebras de escala.">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase">
            <tr>
              <th className="p-3">Data</th>
              <th className="p-3">Profissional</th>
              <th className="p-3">Setor</th>
              <th className="p-3">Motivo / Observação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="p-3">{formatDateBR(r.date)}</td>
                <td className="p-3 font-bold text-slate-900 dark:text-white">{r.professional}</td>
                <td className="p-3 text-slate-500">{r.sector}</td>
                <td className="p-3 text-red-600 font-medium">{r.reason}</td>
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
      <ReportCard title="Trilha de Auditoria & Compliance (LGPD)" description="Registro imutável de ações e assinaturas digitais simuladas.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] uppercase font-bold text-slate-400">Status Documental</div>
            <div className="text-base font-black text-sky-600 mt-1">{status}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] uppercase font-bold text-slate-400">Versão Ativa</div>
            <div className="text-base font-black text-slate-900 dark:text-white mt-1">v{version}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] uppercase font-bold text-slate-400">Hash SHA-256</div>
            <div className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1 truncate">{hash || 'Não gerado'}</div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={onGenerateHash} disabled={hashLoading} className="bg-sky-600 text-white font-bold text-xs">
            {hashLoading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />} Gerar Hash de Integridade
          </Button>
          <Button variant="outline" onClick={onNewVersion} className="text-xs">Criar Nova Versão</Button>
        </div>
      </ReportCard>
    </div>
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

function CoverageDashboard({ coverageSummary, coverageMap, onSelectSector }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-[10px] font-bold uppercase text-slate-400">Cobertura Global</div>
          <div className="text-2xl font-black mt-2 text-slate-900 dark:text-white">{coverageSummary.coverage}%</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-[10px] font-bold uppercase text-slate-400">Confirmados</div>
          <div className="text-2xl font-black mt-2 text-emerald-600">{coverageSummary.confirmed}</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-[10px] font-bold uppercase text-slate-400">Pendentes</div>
          <div className="text-2xl font-black mt-2 text-amber-500">{coverageSummary.pending}</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-[10px] font-bold uppercase text-slate-400">Vagas Abertas</div>
          <div className="text-2xl font-black mt-2 text-red-600">{coverageSummary.open}</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm col-span-2 lg:col-span-1">
          <div className="text-[10px] font-bold uppercase text-slate-400">Setores Mapeados</div>
          <div className="text-2xl font-black mt-2 text-slate-900 dark:text-white">{coverageMap.length}</div>
        </Card>
      </div>

      <Card className="p-6 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Map className="w-5 h-5 text-sky-600" /> Mapa de Cobertura por Setor
          </h3>
          <span className="text-xs text-slate-400">Clique para inspecionar</span>
        </div>
        <div className="space-y-3">
          {coverageMap.map((sector) => (
            <button
              key={sector.sectorName}
              type="button"
              onClick={() => onSelectSector(sector.sectorName)}
              className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{sector.sectorName}</div>
                  <div className="mt-2 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.min(sector.coverage, 100)}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-slate-900 dark:text-white">{Math.round(sector.coverage)}%</div>
                  <ChevronRight className="w-4 h-4 text-slate-400 inline" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sectorShifts.map((s, idx) => (
                <tr key={s.id || idx}>
                  <td className="p-2.5">{formatDateBR(s.date)}</td>
                  <td className="p-2.5">{s.start_time} - {s.end_time}</td>
                  <td className="p-2.5 font-bold">{s.professional_name || 'Vago'}</td>
                  <td className="p-2.5 uppercase font-bold text-[10px]">{s.status}</td>
                </tr>
              ))}
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
                <div className="text-base font-black text-sky-600 mt-1">{String(v)}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-slate-100 dark:bg-slate-800 uppercase text-[10px]">
                <tr>
                  {reportPayload.columns.map((col, idx) => (
                    <th key={idx} className="p-3 font-bold">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
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