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
  Moon,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  TrendingDown,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

/* ============================================================
   UTILITÁRIOS E FORMATAÇÃO
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
  if (value === null || value === undefined || value === '') return 'Não informado';
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Não informado';
  return `R$ ${number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.substring(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split('/');
    return `${year}-${month}-${day}`;
  }
  return text.substring(0, 10);
}

function escapeCSV(value) {
  return `"${String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

function sanitizeFilename(value) {
  return String(value || 'relatorio').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
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

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatPrintValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return formatNumber(value, Number.isInteger(value) ? 0 : 2);
  return String(value);
}

function getCompanyLabel(companyId) {
  return companyId || 'Não informado';
}

function getUnitLabel(unitId) {
  return unitId || 'Todas as unidades';
}

function buildPrintTable(columns = [], rows = [], totalsRow = null) {
  const headerHtml = columns.map((col) => `<th>${escapeHtml(col)}</th>`).join('');
  const bodyHtml = rows.length > 0
    ? rows.map((row) => `<tr>${columns.map((_, i) => `<td>${escapeHtml(formatPrintValue(row[i]))}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${Math.max(columns.length, 1)}" class="empty-cell">Nenhum registro encontrado.</td></tr>`;
  const footerHtml = totalsRow ? `<tfoot><tr>${columns.map((_, i) => `<th>${escapeHtml(formatPrintValue(totalsRow[i]))}</th>`).join('')}</tr></tfoot>` : '';

  return `<table class="print-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody>${footerHtml}</table>`;
}

function getStatusKey(status) {
  return String(status || '').trim().toLowerCase();
}

function getShiftHours(shift) {
  if (shift?.hours !== undefined && shift?.hours !== null && Number.isFinite(Number(shift.hours))) return Number(shift.hours);
  if (shift?.total_hours !== undefined && shift?.total_hours !== null && Number.isFinite(Number(shift.total_hours))) return Number(shift.total_hours);
  if (shift?.start_time && shift?.end_time) {
    const start = new Date(`1970-01-01T${shift.start_time}`);
    const end = new Date(`1970-01-01T${shift.end_time}`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      let diff = (end - start) / 3600000;
      if (diff < 0) diff += 24;
      return Math.max(0, diff);
    }
  }
  return 0;
}

function getProfessionalId(shift) {
  return shift?.professional_id || shift?.professionalId || shift?.professional?.id || null;
}

function getProfessionalName(shift, professionalMap) {
  if (shift?.professional_name) return shift.professional_name;
  if (shift?.professional?.name) return shift.professional.name;
  if (shift?.professional_id && professionalMap[shift.professional_id]) {
    const p = professionalMap[shift.professional_id];
    return p.name || p.full_name || p.nome || p.email || 'Profissional';
  }
  return 'Não identificado';
}

function getSectorName(shift, sectorMap) {
  if (shift?.sector_name) return shift.sector_name;
  if (shift?.sector?.name) return shift.sector.name;
  if (shift?.sector_id && sectorMap[shift.sector_id]) {
    const s = sectorMap[shift.sector_id];
    return s.name || s.nome || s.title || 'Setor não identificado';
  }
  return 'Não informado';
}

function getCategoryName(shift, professionalMap) {
  if (shift?.category_name) return shift.category_name;
  if (shift?.category) return shift.category;
  if (shift?.professional_id && professionalMap[shift.professional_id]) {
    const p = professionalMap[shift.professional_id];
    return p.category || p.profession || p.role || p.cargo || 'Não informado';
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
    return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
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
  cobertura: { label: 'Cobertura Operacional', description: 'Cobertura operacional por setor', icon: Building2 },
  risco: { label: 'Risco Assistencial', description: 'Indicadores operacionais de cobertura e déficit', icon: ShieldCheck },
  financeiro: { label: 'Financeiro & Custos', description: 'Custos consolidados baseados no modelo de contratação', icon: BarChart3 },
  turnover: { label: 'Absenteísmo', description: 'Ocorrências operacionais e cancelamentos', icon: Users },
  auditoria: { label: 'Auditoria & LGPD', description: 'Integridade, rastreabilidade e controle do relatório', icon: ClipboardCheck },
};

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
  const [theme, setTheme] = useState('light');

  // Tema
  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem('hospital-intelligence-theme');
      const preferredTheme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      setTheme(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : preferredTheme);
    } catch { setTheme('light'); }
  }, []);

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    try { window.localStorage.setItem('hospital-intelligence-theme', theme); } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));

  // Carregamento de Dados
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
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
      setError('Não foi possível carregar os dados. Verifique a conexão com a base.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Mapas
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
    return Array.from(values).sort();
  }, [shifts, professionals, professionalMap]);

  // Aplicação dos Filtros
  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      const date = getShiftDate(shift);
      if (filters.startDate && date < filters.startDate) return false;
      if (filters.endDate && date > filters.endDate) return false;
      if (filters.sectorId !== 'todos') {
        if (String(shift?.sector_id || '') !== String(filters.sectorId) && String(shift?.sector_name || '') !== String(filters.sectorId)) return false;
      }
      if (filters.status !== 'todos') {
        if (getStatusKey(shift?.status) !== filters.status) return false;
      }
      if (filters.professionalId !== 'todos') {
        if (String(getProfessionalId(shift) || '') !== String(filters.professionalId)) return false;
      }
      if (filters.category !== 'todos') {
        if (String(getCategoryName(shift, professionalMap)) !== String(filters.category)) return false;
      }
      return true;
    });
  }, [shifts, filters, professionalMap]);

  // Indicadores Base
  const baseMetrics = useMemo(() => {
    let confirmed = 0, pending = 0, canceled = 0, open = 0, confirmedHours = 0, totalHours = 0;
    filteredShifts.forEach((shift) => {
      const status = getStatusKey(shift?.status);
      const hours = getShiftHours(shift);
      totalHours += hours;
      if (['confirmado', 'confirmed', 'concluido', 'completed'].includes(status)) { confirmed++; confirmedHours += hours; }
      else if (['pendente', 'pending'].includes(status)) pending++;
      else if (['cancelado', 'canceled'].includes(status)) canceled++;
      else if (['aberto', 'open'].includes(status)) open++;
    });
    const total = filteredShifts.length;
    return { total, confirmed, pending, canceled, open, totalHours, confirmedHours, coverage: total > 0 ? (confirmed / total) * 100 : 0 };
  }, [filteredShifts]);

  // Cruzamento Financeiro e Produtividade
  const { professionalsData, totalFinancialEstimate } = useMemo(() => {
    const map = {};
    let totalCusto = 0;

    // Inicializa todos os profissionais reais
    professionals.forEach((p) => {
      if (!p?.id) return;
      const remType = String(p.remuneration_type || p.remunerationType || 'hora').toLowerCase();
      let rate = 0;
      if (remType === 'hora') rate = Number(p.hourly_rate ?? 120);
      else if (remType === 'diaria') rate = Number(p.daily_rate ?? 1500);
      else if (remType === 'mensal') rate = Number(p.monthly_salary ?? 18000);

      map[p.id] = {
        id: p.id,
        name: getProfessionalName(p, professionalMap),
        category: p.specialty || p.category || 'Geral',
        remType,
        rate: Number.isFinite(rate) ? rate : 0,
        totalShifts: 0, confirmedShifts: 0, pendingShifts: 0, canceledShifts: 0,
        confirmedHours: 0, totalCost: 0,
        sectors: new Set()
      };
    });

    // Processa os turnos
    filteredShifts.forEach((shift) => {
      const pId = getProfessionalId(shift);
      if (!pId) return;

      if (!map[pId]) {
        map[pId] = {
          id: pId, name: getProfessionalName(shift, professionalMap), category: getCategoryName(shift, professionalMap),
          remType: 'hora', rate: 120, totalShifts: 0, confirmedShifts: 0, pendingShifts: 0, canceledShifts: 0, confirmedHours: 0, totalCost: 0, sectors: new Set()
        };
      }

      const p = map[pId];
      const status = getStatusKey(shift?.status);
      const hours = getShiftHours(shift);

      p.totalShifts++;
      p.sectors.add(getSectorName(shift, sectorMap));

      if (['confirmado', 'confirmed', 'concluido', 'completed'].includes(status)) {
        p.confirmedShifts++;
        p.confirmedHours += hours;
      } else if (['pendente', 'pending'].includes(status)) {
        p.pendingShifts++;
      } else if (['cancelado', 'canceled'].includes(status)) {
        p.canceledShifts++;
      }
    });

    // Calcula os custos finais por profissional (Apenas 1 linha por profissional)
    const resultList = Object.values(map).filter(p => p.totalShifts > 0);
    resultList.forEach(p => {
      if (p.remType === 'mensal') {
        p.totalCost = p.confirmedShifts > 0 ? p.rate : 0; // Salário fixo se trabalhou
      } else if (p.remType === 'diaria') {
        p.totalCost = p.confirmedShifts * p.rate; // Multiplica pelos turnos confirmados
      } else {
        p.totalCost = p.confirmedHours * p.rate; // Multiplica pelas horas confirmadas
      }
      totalCusto += p.totalCost;
    });

    return { professionalsData: resultList.sort((a, b) => b.confirmedHours - a.confirmedHours), totalFinancialEstimate: totalCusto };
  }, [filteredShifts, professionals, professionalMap, sectorMap]);

  // Setores (Cobertura e Risco)
  const bySector = useMemo(() => {
    const map = {};
    filteredShifts.forEach((shift) => {
      const name = getSectorName(shift, sectorMap);
      if (!map[name]) map[name] = { name, total: 0, confirmed: 0, pending: 0, canceled: 0, open: 0, coverage: 0 };
      const row = map[name];
      const status = getStatusKey(shift?.status);
      row.total++;
      if (['confirmado', 'confirmed', 'concluido', 'completed'].includes(status)) row.confirmed++;
      else if (['pendente', 'pending'].includes(status)) row.pending++;
      else if (['cancelado', 'canceled'].includes(status)) row.canceled++;
      else if (['aberto', 'open'].includes(status)) row.open++;
    });

    return Object.values(map)
      .map((row) => ({ ...row, coverage: row.total > 0 ? (row.confirmed / row.total) * 100 : 0 }))
      .sort((a, b) => a.coverage - b.coverage);
  }, [filteredShifts, sectorMap]);

  // Cancelamentos
  const cancellationRows = useMemo(() => {
    return filteredShifts.filter((s) => ['cancelado', 'canceled'].includes(getStatusKey(s?.status))).map((s) => ({
      date: getShiftDate(s), professional: getProfessionalName(s, professionalMap), sector: getSectorName(s, sectorMap), reason: s?.cancellation_reason || s?.reason || 'Não informado',
    })).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [filteredShifts, professionalMap, sectorMap]);

  // Utilidades e IDs
  const reportId = useMemo(() => {
    const d = new Date();
    return `CIH-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
  }, []);

  const filtersLabel = useMemo(() => {
    const vals = [];
    if (filters.startDate) vals.push(`Início: ${formatDateBR(filters.startDate)}`);
    if (filters.endDate) vals.push(`Fim: ${formatDateBR(filters.endDate)}`);
    if (filters.sectorId !== 'todos') vals.push(`Setor Específico`);
    if (filters.status !== 'todos') vals.push(`Status: ${filters.status}`);
    if (filters.professionalId !== 'todos') vals.push(`Profissional Filtrado`);
    if (filters.category !== 'todos') vals.push(`Cat: ${filters.category}`);
    return vals.length ? vals.join(' • ') : 'Visão Geral (Sem filtros)';
  }, [filters]);

  // Geração Unificada do Relatório Oficial
  const reportPayload = useMemo(() => {
    const config = REPORT_CONFIG[activeTab];
    let columns = [], rows = [], totalsRow = null;

    if (activeTab === 'executiva') {
      columns = ['Indicador Gerencial', 'Resultado Apurado'];
      rows = [
        ['Total de turnos na competência', baseMetrics.total],
        ['Turnos confirmados (Guarnecidos)', baseMetrics.confirmed],
        ['Turnos pendentes de validação', baseMetrics.pending],
        ['Turnos cancelados / Ocorrências', baseMetrics.canceled],
        ['Vagas em aberto (Déficit)', baseMetrics.open],
        ['Carga horária total confirmada', `${Number(baseMetrics.confirmedHours.toFixed(2))}h`],
        ['Cobertura operacional global', `${Number(baseMetrics.coverage.toFixed(2))}%`],
        ['Custo Financeiro Estimado', formatCurrency(totalFinancialEstimate)],
      ];
    } else if (activeTab === 'produtividade') {
      columns = ['Profissional', 'Categoria', 'Turnos Totais', 'Confirmados', 'Cancelados', 'Horas Realizadas'];
      rows = professionalsData.map((p) => [p.name, p.category, p.totalShifts, p.confirmedShifts, p.canceledShifts, `${Number(p.confirmedHours.toFixed(2))}h`]);
      totalsRow = ['TOTAL CONSOLIDADO', '', baseMetrics.total, baseMetrics.confirmed, baseMetrics.canceled, `${Number(baseMetrics.confirmedHours.toFixed(2))}h`];
    } else if (activeTab === 'cobertura' || activeTab === 'risco') {
      columns = ['Setor', 'Turnos', 'Confirmados', 'Pendentes', 'Cancelados', 'Abertos', 'Cobertura %'];
      rows = bySector.map((s) => [s.name, s.total, s.confirmed, s.pending, s.canceled, s.open, `${Number(s.coverage.toFixed(2))}%`]);
      totalsRow = ['TOTAL CONSOLIDADO', baseMetrics.total, baseMetrics.confirmed, baseMetrics.pending, baseMetrics.canceled, baseMetrics.open, `${Number(baseMetrics.coverage.toFixed(2))}%`];
    } else if (activeTab === 'financeiro') {
      columns = ['Profissional', 'Área(s) de Atuação', 'Modelo de Contrato', 'Volumetria (Horas/Plantões)', 'Custo Estimado a Liquidar'];
      rows = professionalsData.map((p) => [
        p.name, 
        Array.from(p.sectors).join(', ') || 'Geral', 
        p.remType === 'mensal' ? 'Fixo Mensal' : p.remType === 'diaria' ? 'Diarista' : 'Horista',
        p.remType === 'hora' ? `${Number(p.confirmedHours.toFixed(2))}h` : `${p.confirmedShifts} plantões`,
        formatCurrency(p.totalCost)
      ]);
      totalsRow = ['TOTAL GERAL A LIQUIDAR', '', '', '', formatCurrency(totalFinancialEstimate)];
    } else if (activeTab === 'turnover') {
      columns = ['Data', 'Profissional', 'Setor', 'Motivo / Observação'];
      rows = cancellationRows.map((c) => [formatDateBR(c.date), c.professional, c.sector, c.reason]);
    } else if (activeTab === 'auditoria') {
      columns = ['Evento', 'Descrição', 'Data/Hora'];
      rows = auditEvents.map((e) => [e.type, e.description, e.timestamp]);
    }

    return {
      reportId, title: config?.label || 'Relatório', companyId, unitId, filtersLabel, status: reportStatus, version: reportVersion, kpis: baseMetrics, columns, rows, totalsRow,
    };
  }, [activeTab, reportId, companyId, unitId, filtersLabel, reportStatus, reportVersion, baseMetrics, professionalsData, bySector, cancellationRows, auditEvents, totalFinancialEstimate]);

  const addAuditEvent = useCallback((type, description) => {
    const event = { id: Math.random().toString(36).substr(2), type, description, timestamp: new Date().toLocaleString('pt-BR') };
    setAuditEvents((current) => [event, ...current]);
  }, []);

  const openReportPreview = async () => {
    addAuditEvent('VISUALIZAÇÃO', `Geração oficial do relatório "${REPORT_CONFIG[activeTab]?.label}".`);
    setReportModalOpen(true);
    setHashLoading(true);
    const hash = await generateSHA256(JSON.stringify({ id: reportPayload.reportId, rows: reportPayload.rows }));
    setReportHash(hash);
    setHashLoading(false);
  };

  /* IMPRESSÃO CORRIGIDA: Usa Window.open com @media print limpo */
  const printReport = useCallback(() => {
    addAuditEvent('IMPRESSÃO', `Impressão autorizada: "${REPORT_CONFIG[activeTab]?.label}".`);
    const payload = reportPayload;
    const printWindow = window.open('', '_blank', 'width=1000,height=800,scrollbars=yes,resizable=yes');
    if (!printWindow) { alert('A impressão foi bloqueada pelo navegador. Permita pop-ups.'); return; }

    const tableHtml = buildPrintTable(payload.columns, payload.rows, payload.totalsRow);

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <title>${escapeHtml(payload.title)}</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            * { box-sizing: border-box; font-family: 'Inter', 'Segoe UI', sans-serif; }
            html, body { margin: 0; padding: 0; background: #ffffff; color: #0f172a; font-size: 11px; }
            body { padding: 0; }
            .print-header { display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
            .print-title { font-size: 22px; font-weight: 900; margin: 0 0 4px; text-transform: uppercase; letter-spacing: -0.5px; }
            .print-subtitle { font-size: 13px; color: #475569; margin: 0; }
            .print-meta { text-align: right; font-size: 10px; color: #64748b; line-height: 1.5; }
            .print-meta strong { color: #0f172a; }
            .filter-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 20px; font-size: 10px; }
            .print-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .print-table thead { display: table-header-group; }
            .print-table tr { page-break-inside: avoid; }
            .print-table th { background: #f1f5f9; font-size: 10px; font-weight: 700; text-align: left; padding: 10px 8px; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; color: #475569; }
            .print-table td { font-size: 11px; padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
            .print-table tfoot th { background: #f8fafc; border-top: 2px solid #0f172a; border-bottom: none; font-size: 11px; color: #0f172a; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; margin-top: 50px; page-break-inside: avoid; }
            .signature-line { border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center; font-size: 10px; font-weight: bold; color: #475569; }
            @media screen {
              body { background: #e2e8f0; padding: 30px; }
              main { background: #fff; padding: 40px; max-width: 1100px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border-radius: 8px; }
              .no-print { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 20px; }
              .no-print button { padding: 8px 16px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
              .btn-print { background: #0284c7; color: white; }
              .btn-close { background: #e2e8f0; color: #0f172a; }
            }
            @media print { .no-print { display: none !important; } }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="btn-print" onclick="window.print()">Imprimir Oficial</button>
            <button class="btn-close" onclick="window.close()">Fechar</button>
          </div>
          <main>
            <header class="print-header">
              <div>
                <h1 class="print-title">${escapeHtml(payload.title)}</h1>
                <p class="print-subtitle">Central de Inteligência Hospitalar</p>
              </div>
              <div class="print-meta">
                <div><strong>ID:</strong> ${escapeHtml(payload.reportId)}</div>
                <div><strong>Emissão:</strong> ${new Date().toLocaleString('pt-BR')}</div>
                <div><strong>Emitido por:</strong> ${escapeHtml(payload.generatedBy)}</div>
              </div>
            </header>
            <div class="filter-box"><strong>Parâmetros aplicados:</strong> ${escapeHtml(payload.filtersLabel)}</div>
            ${tableHtml}
            <section class="signatures">
              <div class="signature-line">Coordenação Administrativa / RH</div>
              <div class="signature-line">Diretoria Executiva / Conselho</div>
            </section>
          </main>
          <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };</script>
        </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }, [addAuditEvent, activeTab, reportPayload]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-sky-600 animate-spin" />
          <div className="text-slate-500 text-sm font-semibold">Carregando Inteligência Hospitalar...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* SIDEBAR */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-slate-950 text-slate-400 flex flex-col transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center"><Activity className="w-5 h-5 text-white" /></div>
          <div><div className="font-black text-sm text-white tracking-widest">CENTRAL</div><div className="text-[10px] font-bold text-sky-400">INTELIGÊNCIA</div></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2 opacity-50">Diretoria</div>
            <SidebarItem active={activeTab === 'executiva'} icon={LayoutDashboard} label="Visão Executiva" onClick={() => { setActiveTab('executiva'); setMobileMenuOpen(false); }} />
            <SidebarItem active={activeTab === 'conselho'} icon={ClipboardCheck} label="Consolidado" onClick={() => { setActiveTab('conselho'); setMobileMenuOpen(false); }} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2 opacity-50">Operação</div>
            {['produtividade', 'cobertura', 'risco', 'financeiro', 'turnover'].map(k => (
              <SidebarItem key={k} active={activeTab === k} icon={REPORT_CONFIG[k].icon} label={REPORT_CONFIG[k].label} onClick={() => { setActiveTab(k); setMobileMenuOpen(false); }} />
            ))}
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2 opacity-50">Compliance</div>
            <SidebarItem active={activeTab === 'auditoria'} icon={ShieldCheck} label="Auditoria" onClick={() => { setActiveTab('auditoria'); setMobileMenuOpen(false); }} />
          </div>
        </div>
      </aside>

      {mobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-5 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 bg-slate-100 dark:bg-slate-800 rounded-lg" onClick={() => setMobileMenuOpen(true)}><Menu className="w-5 h-5" /></button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">{REPORT_CONFIG[activeTab]?.label || 'Relatório'}</h1>
              <p className="text-xs text-slate-500">{REPORT_CONFIG[activeTab]?.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={toggleTheme} className="dark:border-slate-700"><Sun className="w-4 h-4 hidden dark:block" /><Moon className="w-4 h-4 block dark:hidden" /></Button>
            <Button onClick={openReportPreview} className="bg-slate-900 dark:bg-sky-600 text-white font-bold gap-2"><Eye className="w-4 h-4" /> Relatório Oficial</Button>
          </div>
        </header>

        <div className="p-5 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          
          {/* Barra de Filtros Minimalista */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-wrap lg:flex-nowrap items-end gap-4">
            <div className="flex flex-col gap-1.5 w-full sm:w-auto">
              <label className="text-[10px] font-bold uppercase text-slate-400">Data Inicial</label>
              <Input type="date" value={filters.startDate} onChange={(e) => setFilters(c => ({...c, startDate: e.target.value}))} className="h-9 text-xs dark:bg-slate-800 dark:border-slate-700" />
            </div>
            <div className="flex flex-col gap-1.5 w-full sm:w-auto">
              <label className="text-[10px] font-bold uppercase text-slate-400">Data Final</label>
              <Input type="date" value={filters.endDate} onChange={(e) => setFilters(c => ({...c, endDate: e.target.value}))} className="h-9 text-xs dark:bg-slate-800 dark:border-slate-700" />
            </div>
            <div className="flex flex-col gap-1.5 w-full sm:w-auto flex-1 min-w-[150px]">
              <label className="text-[10px] font-bold uppercase text-slate-400">Setor</label>
              <Select value={filters.sectorId} onValueChange={(v) => setFilters(c => ({...c, sectorId: v}))}>
                <SelectTrigger className="h-9 text-xs dark:bg-slate-800 dark:border-slate-700"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os setores</SelectItem>
                  {sectors.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 w-full sm:w-auto flex-1 min-w-[150px]">
              <label className="text-[10px] font-bold uppercase text-slate-400">Status</label>
              <Select value={filters.status} onValueChange={(v) => setFilters(c => ({...c, status: v}))}>
                <SelectTrigger className="h-9 text-xs dark:bg-slate-800 dark:border-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(filters.startDate || filters.endDate || filters.sectorId !== 'todos' || filters.status !== 'todos') && (
              <Button variant="ghost" onClick={() => setFilters({startDate: '', endDate: '', sectorId: 'todos', status: 'todos', professionalId: 'todos', category: 'todos'})} className="h-9 text-xs text-red-500">
                Limpar
              </Button>
            )}
          </div>

          {/* KPIs Globais */}
          {activeTab !== 'auditoria' && activeTab !== 'conselho' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title="Total Registros" value={baseMetrics.total} />
              <KpiCard title="Confirmados" value={baseMetrics.confirmed} highlight="text-emerald-600 dark:text-emerald-400" />
              <KpiCard title="Horas Executadas" value={`${formatNumber(baseMetrics.confirmedHours, 1)}h`} />
              <KpiCard title="Cobertura Global" value={`${formatNumber(baseMetrics.coverage, 1)}%`} highlight={baseMetrics.coverage < 70 ? 'text-red-600' : 'text-sky-600'} />
            </div>
          )}

          {/* Tabelas de Conteúdo */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-800">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">{reportPayload.title}</h3>
              <span className="text-xs text-slate-500">{reportPayload.rows.length} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase">
                  <tr>{reportPayload.columns.map((c, i) => <th key={i} className="px-6 py-3 font-bold">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reportPayload.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      {row.map((cell, j) => <td key={j} className="px-6 py-3 text-slate-700 dark:text-slate-300">{cell}</td>)}
                    </tr>
                  ))}
                  {reportPayload.rows.length === 0 && (
                    <tr><td colSpan={reportPayload.columns.length} className="px-6 py-12 text-center text-slate-400">Nenhum dado encontrado para os filtros atuais.</td></tr>
                  )}
                </tbody>
                {reportPayload.totalsRow && (
                  <tfoot className="bg-slate-50 dark:bg-slate-800 font-black text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700">
                    <tr>{reportPayload.totalsRow.map((c, i) => <td key={i} className="px-6 py-4">{c}</td>)}</tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>

        </div>
      </main>

      {/* Modal de Ações / Preview Simples */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/50 text-sky-600 rounded-full flex items-center justify-center mx-auto mb-3"><FileCheck2 className="w-6 h-6" /></div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Gerar Relatório Oficial</h2>
              <p className="text-xs text-slate-500 mt-2">O documento será formatado em A4 com as tabelas completas e logs de auditoria.</p>
            </div>
            
            <div className="space-y-3">
              <Button onClick={() => { setReportModalOpen(false); printReport(); }} className="w-full h-12 bg-sky-600 hover:bg-sky-700 text-white font-bold gap-2">
                <Printer className="w-4 h-4" /> Visualizar e Imprimir (PDF)
              </Button>
              <Button onClick={() => { setReportModalOpen(false); exportCSV(); }} variant="outline" className="w-full h-12 gap-2 dark:border-slate-700 dark:text-slate-200">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar para Planilha (CSV)
              </Button>
              <Button variant="ghost" onClick={() => setReportModalOpen(false)} className="w-full text-slate-500">Cancelar</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ============================================================
   COMPONENTES MENORES
============================================================ */
function SidebarItem({ active, icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-1 transition-all ${active ? 'bg-white/10 text-white font-bold' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
      <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-sky-400' : ''}`} />
      <span className="text-sm flex-1 text-left">{label}</span>
      {active && <ChevronRight className="w-4 h-4 opacity-50" />}
    </button>
  );
}

function KpiCard({ title, value, highlight }) {
  return (
    <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{title}</div>
      <div className={`text-2xl font-black ${highlight || 'text-slate-900 dark:text-white'}`}>{value}</div>
    </Card>
  );
}