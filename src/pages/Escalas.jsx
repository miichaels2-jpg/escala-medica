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
  Moon,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  SlidersHorizontal,
  TrendingDown,
  UserCheck,
  Users,
  X,
  Plus,
  Pencil,
  Trash2,
  Maximize2,
  Minimize2,
  MessageCircle,
  UserPlus,
  LayoutGrid,
  List,
  ChevronDown,
  Lock,
  GripVertical,
  Send,
} from 'lucide-react';
import ShiftFormDialog from '@/components/shifts/ShiftFormDialog';
import { exportSchedulePDF } from '@/lib/exportReport';
import { getShiftTvLifecycle } from '@/lib/shiftUtils';

/* ============================================================
   UTILITÁRIOS E CONSTANTES
   ============================================================ */

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

// Ordem dos dias da semana (Segunda a Domingo)
const WEEK_DAYS_ORDER = [
  { label: 'Segunda', index: 1, short: 'SEG' },
  { label: 'Terça', index: 2, short: 'TER' },
  { label: 'Quarta', index: 3, short: 'QUA' },
  { label: 'Quinta', index: 4, short: 'QUI' },
  { label: 'Sexta', index: 5, short: 'SEX' },
  { label: 'Sábado', index: 6, short: 'SAB', weekend: true },
  { label: 'Domingo', index: 0, short: 'DOM', weekend: true },
];

const BUILDER_COLORS = [
  { id: 'sky', value: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200', bg: 'bg-sky-400' },
  { id: 'amber', value: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200', bg: 'bg-amber-400' },
  { id: 'indigo', value: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200', bg: 'bg-indigo-400' },
  { id: 'emerald', value: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200', bg: 'bg-emerald-400' },
  { id: 'rose', value: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200', bg: 'bg-rose-400' },
  { id: 'purple', value: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200', bg: 'bg-purple-400' },
];

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

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeStr(str) {
  if (typeof str !== 'string') return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function toTitleCase(str) {
  if (typeof str !== 'string' || !str.trim()) return '';
  const acr = ['UTI', 'UCO', 'PA', 'PS', 'CRM', 'COREN'];
  return str.toLowerCase().split(' ').map(w => acr.includes(w.toUpperCase()) ? w.toUpperCase() : (['de', 'da', 'do', 'e'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

function getMonthWeeks(monthStr) {
  if (!monthStr || typeof monthStr !== 'string') return [];
  const parts = monthStr.split('-');
  if (parts.length < 2) return [];
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const weeks = [];
  let currentWeek = [];
  
  let startDay = firstDay.getDay(); 
  let emptyDays = startDay === 0 ? 6 : startDay - 1; 
  
  for (let i = 0; i < emptyDays; i++) currentWeek.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateObj = new Date(year, month - 1, d);
    currentWeek.push(getLocalDateString(dateObj));
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }
  return weeks;
}

function getStatusLabel(status) {
  const map = { confirmado: 'Confirmado', confirmed: 'Confirmado', pendente: 'Pendente', pending: 'Pendente', cancelado: 'Cancelado', canceled: 'Cancelado', aberto: 'Aberto', open: 'Aberto', concluido: 'Concluído', completed: 'Concluído' };
  return map[String(status || '').toLowerCase()] || status || 'Não informado';
}

function getStatusKey(status) {
  return String(status || '').trim().toLowerCase();
}

function getShiftHours(shift) {
  if (shift?.hours !== undefined && shift?.hours !== null && Number.isFinite(Number(shift.hours))) return Number(shift.hours);
  if (shift?.total_hours !== undefined && shift?.total_hours !== null && Number.isFinite(Number(shift.total_hours))) return Number(shift.total_hours);
  if (shift?.duration_hours !== undefined && shift?.duration_hours !== null) return Number(shift.duration_hours);
  if (shift?.start_time && shift?.end_time) {
    const start = new Date(`1970-01-01T${shift.start_time}`);
    const end = new Date(`1970-01-01T${shift.end_time}`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      let diff = (end - start) / 3600000;
      if (diff < 0) diff += 24;
      return Math.max(0, diff);
    }
  }
  return 12;
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

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatPrintValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return formatNumber(value, Number.isInteger(value) ? 0 : 2);
  return String(value);
}

function getCompanyLabel(companyId) { return companyId || 'Não informado'; }
function getUnitLabel(unitId) { return unitId || 'Todas as unidades'; }

function buildPrintTable(columns = [], rows = [], totalsRow = null) {
  const headerHtml = columns.map((col) => `<th>${escapeHtml(col)}</th>`).join('');
  const bodyHtml = rows.length > 0
    ? rows.map((row) => `<tr>${columns.map((_, idx) => `<td>${escapeHtml(formatPrintValue(row[idx]))}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${Math.max(columns.length, 1)}" class="empty-cell">Nenhum registro encontrado.</td></tr>`;
  const footerHtml = totalsRow ? `<tfoot><tr>${columns.map((_, idx) => `<th>${escapeHtml(formatPrintValue(totalsRow[idx]))}</th>`).join('')}</tr></tfoot>` : '';
  return `<table class="print-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody>${footerHtml}</table>`;
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

const REPORT_CONFIG = {
  executiva: { label: 'Visão Executiva', description: 'Indicadores consolidados para gestão e conselho', icon: LayoutDashboard },
  produtividade: { label: 'Produtividade & Horas', description: 'Produção, horas e distribuição por profissional', icon: Clock3 },
  cobertura: { label: 'Cobertura Operacional', description: 'Cobertura operacional por setor', icon: Building2 },
  risco: { label: 'Risco Assistencial', description: 'Indicadores operacionais de cobertura e déficit', icon: ShieldCheck },
  financeiro: { label: 'Financeiro & Custos', description: 'Custos consolidados baseados no modelo de contratação', icon: BarChart3 },
  turnover: { label: 'Absenteísmo', description: 'Ocorrências operacionais e cancelamentos', icon: Users },
  auditoria: { label: 'Auditoria & LGPD', description: 'Integridade, rastreabilidade e controle do relatório', icon: ClipboardCheck },
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
  const { user, company, loading: appLoading } = useAppData();
  
  const [shifts, setShifts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('executiva');
  const [viewMode, setViewMode] = useState('grade'); // 'grade', 'list', 'base_builder'
  
  const [filters, setFilters] = useState({ startDate: '', endDate: '', sectorId: 'todos', status: 'todos', professionalId: 'todos', category: 'todos' });
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalDateString().slice(0,7));
  const [selectedDate, setSelectedDate] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Interação da Grade Mensal
  const [profSearchQuery, setProfSearchQuery] = useState('');
  const [selectedCells, setSelectedCells] = useState([]);
  const [inlineEditingCell, setInlineEditingCell] = useState(null); 
  const [inlineSearchText, setInlineSearchText] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [newShiftModal, setNewShiftModal] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tvMode, setTvMode] = useState(false);

  // Estados do Builder de Escala Base
  const [createScaleState, setCreateScaleState] = useState(0); // 0: off, 1: setup, 2: success
  const [builderModal, setBuilderModal] = useState(null); // Modal de Padrão de Horário
  const [builderShifts, setBuilderShifts] = useState([]); // Armazena os horários da escala base
  const [builderForm, setBuilderForm] = useState({ id: '', name: '', start: '', end: '', qty: 1, color: BUILDER_COLORS[0], days: [] });

  // Estados de Relatórios
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportStatus, setReportStatus] = useState('Rascunho');
  const [reportVersion, setReportVersion] = useState(1);
  const [reportHash, setReportHash] = useState('');
  const [hashLoading, setHashLoading] = useState(false);
  const [auditEvents, setAuditEvents] = useState([]);

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_h1';
  const isManager = user?.role === 'admin' || user?.data?.app_role === 'manager' || user?.data?.app_role === 'gestor';

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

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError('');
    try {
      const queryFilter = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
      const [shiftsResp, profsResp, sectorsResp] = await Promise.all([
        base44.entities.Shift?.filter ? base44.entities.Shift.filter(queryFilter, '-date', 2000).catch(() => []) : base44.entities.Shift?.list?.().catch(() => []),
        base44.entities.Professional?.filter ? base44.entities.Professional.filter(queryFilter, '-created_date', 1000).catch(() => []) : base44.entities.Professional?.list?.().catch(() => []),
        base44.entities.Sector?.filter ? base44.entities.Sector.filter(queryFilter, '-created_date', 200).catch(() => []) : base44.entities.Sector?.list?.().catch(() => []),
      ]);

      const safeShifts = Array.isArray(shiftsResp) ? shiftsResp : (shiftsResp?.data || []);
      const safeSectors = Array.isArray(sectorsResp) ? sectorsResp : (sectorsResp?.data || []);
      const safeProfessionals = Array.isArray(profsResp) ? profsResp : (profsResp?.data || []);

      setShifts(safeShifts);
      setSectors(safeSectors);
      setProfessionals(safeProfessionals);
      
      if (filters.sectorId === 'todos' && safeSectors.length > 0) {
        setFilters(c => ({...c, sectorId: String(safeSectors[0].id)}));
      }
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar os dados. Verifique a conexão com a base.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, unitId, filters.sectorId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const id = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(id); }, []);

  const professionalMap = useMemo(() => {
    const map = {};
    (professionals || []).forEach(p => { if (p?.id) map[p.id] = p; });
    return map;
  }, [professionals]);

  const sectorMap = useMemo(() => {
    const map = {};
    (sectors || []).forEach(s => { if (s?.id) map[s.id] = s; });
    return map;
  }, [sectors]);

  const categories = useMemo(() => {
    const values = new Set();
    (shifts || []).forEach((s) => {
      const cat = getCategoryName(s, professionalMap);
      if (cat && cat !== 'Não informado') values.add(cat);
    });
    (professionals || []).forEach((p) => {
      const cat = p?.category || p?.profession || p?.role || p?.cargo;
      if (cat) values.add(cat);
    });
    return Array.from(values).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
  }, [shifts, professionals, professionalMap]);

  const filteredShifts = useMemo(() => {
    const term = normalizeStr(search);
    return (shifts || [])
      .filter((s) => {
        if (!s || s.status === 'cancelado') return false;
        const sDate = typeof s.date === 'string' ? s.date.split('T')[0] : '';
        if (!sDate) return false;
        if (selectedMonth && !sDate.startsWith(selectedMonth)) return false;
        if (filters.startDate && sDate < filters.startDate) return false;
        if (filters.endDate && sDate > filters.endDate) return false;
        if (filters.sectorId !== 'todos' && String(s.sector_id) !== String(filters.sectorId)) return false;
        if (filters.status !== 'todos' && getStatusKey(s.status) !== filters.status) return false;
        if (filters.professionalId !== 'todos' && String(getProfessionalId(s)) !== String(filters.professionalId)) return false;
        if (filters.category !== 'todos' && String(getCategoryName(s, professionalMap)) !== String(filters.category)) return false;
        return true;
      })
      .map((s) => {
        let lifecycle = { state: 'upcoming', detail: '' };
        try {
          const safeShift = { ...s, date: s.date || '', start_time: s.start_time || '', end_time: s.end_time || '' };
          lifecycle = getShiftTvLifecycle(safeShift, currentTime) || lifecycle;
        } catch (e) {}

        const pName = typeof s.professional_name === 'string' ? s.professional_name.toLowerCase() : '';
        const sTime = typeof s.start_time === 'string' ? s.start_time : '00:00';
        let periodId = 'manha';
        if (sTime >= '13:00' && sTime < '19:00') periodId = 'tarde';
        if (sTime >= '19:00' || sTime < '06:00') periodId = 'noite';

        return { ...s, lifecycle, periodId, isVacant: !s.professional_id || pName.includes('vaga') };
      });
  }, [shifts, search, filters, selectedMonth, professionalMap, currentTime]);

  const baseMetrics = useMemo(() => {
    let confirmed = 0, pending = 0, canceled = 0, open = 0, confirmedHours = 0, totalHours = 0;
    (filteredShifts || []).forEach((s) => {
      const status = getStatusKey(s.status);
      const hours = getShiftHours(s);
      totalHours += hours;
      if (['confirmado', 'confirmed', 'concluido', 'completed'].includes(status)) { confirmed++; confirmedHours += hours; }
      else if (['pendente', 'pending'].includes(status)) pending++;
      else if (['cancelado', 'canceled'].includes(status)) canceled++;
      else if (['aberto', 'open'].includes(status)) open++;
    });
    const total = filteredShifts.length;
    return { total, confirmed, pending, canceled, open, totalHours, confirmedHours, coverage: total > 0 ? (confirmed / total) * 100 : 0 };
  }, [filteredShifts]);

  const byProfessional = useMemo(() => {
    const map = {};
    (filteredShifts || []).forEach((s) => {
      const id = getProfessionalId(s) || `name:${getProfessionalName(s, professionalMap)}`;
      if (!map[id]) {
        map[id] = { id, name: getProfessionalName(s, professionalMap), category: getCategoryName(s, professionalMap), total: 0, confirmed: 0, pending: 0, canceled: 0, open: 0, hours: 0 };
      }
      const row = map[id];
      const status = getStatusKey(s.status);
      row.total++;
      row.hours += getShiftHours(s);
      if (['confirmado', 'confirmed', 'concluido', 'completed'].includes(status)) row.confirmed++;
      else if (['pendente', 'pending'].includes(status)) row.pending++;
      else if (['cancelado', 'canceled'].includes(status)) row.canceled++;
      else if (['aberto', 'open'].includes(status)) row.open++;
    });
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [filteredShifts, professionalMap]);

  const bySector = useMemo(() => {
    const map = {};
    (filteredShifts || []).forEach((s) => {
      const name = getSectorName(s, sectorMap);
      if (!map[name]) map[name] = { name, total: 0, confirmed: 0, pending: 0, canceled: 0, open: 0, coverage: 0 };
      const row = map[name];
      const status = getStatusKey(s.status);
      row.total++;
      if (['confirmado', 'confirmed', 'concluido', 'completed'].includes(status)) row.confirmed++;
      else if (['pendente', 'pending'].includes(status)) row.pending++;
      else if (['cancelado', 'canceled'].includes(status)) row.canceled++;
      else if (['aberto', 'open'].includes(status)) row.open++;
    });
    return Object.values(map).map((row) => ({ ...row, coverage: row.total > 0 ? (row.confirmed / row.total) * 100 : 0 })).sort((a, b) => a.coverage - b.coverage);
  }, [filteredShifts, sectorMap]);

  const riskRows = useMemo(() => {
    return bySector.map((sector) => {
      let level = 'regular';
      if (sector.coverage < 70) level = 'critico';
      else if (sector.coverage < 90) level = 'atencao';
      return { ...sector, level };
    });
  }, [bySector]);

  const financialData = useMemo(() => {
    let estimatedCost = 0, canceledCost = 0, knownRates = 0, missingRates = 0;
    const rows = [];

    (filteredShifts || []).forEach((s) => {
      const hours = getShiftHours(s);
      const profId = getProfessionalId(s);
      const prof = profId ? professionalMap[profId] : null;
      const status = getStatusKey(s.status);
      const remType = String(prof?.remuneration_type || prof?.remunerationType || 'hora').toLowerCase();

      let rate = null;
      if (remType === 'hora') rate = prof?.hourly_rate ?? prof?.hourlyRate ?? s?.hourly_rate ?? s?.valor_hora ?? 120;
      else if (remType === 'diaria') rate = prof?.daily_rate ?? prof?.dailyRate ?? 1500;
      else if (remType === 'mensal') {
        const monthly = Number(prof?.monthly_salary ?? prof?.monthlySalary ?? 18000);
        const monthlyWorkHours = Number(prof?.monthly_work_hours ?? prof?.monthlyWorkHours ?? 220);
        rate = monthlyWorkHours > 0 ? monthly / monthlyWorkHours : null;
      }

      const numericRate = Number(rate);
      if (Number.isFinite(numericRate) && numericRate >= 0 && rate !== null) {
        const cost = remType === 'mensal' ? numericRate * hours : (remType === 'diaria' ? numericRate : hours * numericRate);
        if (status === 'cancelado' || status === 'canceled') canceledCost += cost;
        else estimatedCost += cost;
        knownRates++;
        rows.push({ professional: getProfessionalName(s, professionalMap), sector: getSectorName(s, sectorMap), hours, rate: numericRate, cost, status });
      } else {
        missingRates++;
        rows.push({ professional: getProfessionalName(s, professionalMap), sector: getSectorName(s, sectorMap), hours, rate: null, cost: null, status });
      }
    });

    rows.sort((a, b) => {
      const aCanc = a.status === 'cancelado' || a.status === 'canceled';
      const bCanc = b.status === 'cancelado' || b.status === 'canceled';
      if (aCanc && !bCanc) return 1;
      if (!aCanc && bCanc) return -1;
      return 0;
    });

    return { estimatedCost, canceledCost, knownRates, missingRates, rows };
  }, [filteredShifts, professionalMap, sectorMap]);

  const cancellationRows = useMemo(() => {
    return (filteredShifts || []).filter(s => ['cancelado', 'canceled'].includes(getStatusKey(s.status))).map((s) => ({
      date: getShiftDate(s), professional: getProfessionalName(s, professionalMap), sector: getSectorName(s, sectorMap), reason: s?.cancellation_reason || s?.reason || 'Não informado',
    })).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [filteredShifts, professionalMap, sectorMap]);

  const reportId = useMemo(() => {
    const d = new Date();
    return `CIH-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  }, []);

  const filtersLabel = useMemo(() => {
    const v = [];
    if (filters.startDate) v.push(`Início: ${formatDateBR(filters.startDate)}`);
    if (filters.endDate) v.push(`Fim: ${formatDateBR(filters.endDate)}`);
    if (filters.sectorId !== 'todos') {
      const s = sectors.find(item => String(item?.id) === String(filters.sectorId));
      v.push(`Setor: ${s?.name || s?.nome || filters.sectorId}`);
    }
    if (filters.status !== 'todos') v.push(`Status: ${getStatusLabel(filters.status)}`);
    if (filters.professionalId !== 'todos') {
      const p = professionals.find(item => String(item?.id) === String(filters.professionalId));
      v.push(`Prof: ${p?.name || filters.professionalId}`);
    }
    if (filters.category !== 'todos') v.push(`Cat: ${filters.category}`);
    return v.length ? v.join(' • ') : 'Visão Geral (Sem filtros ativos)';
  }, [filters, sectors, professionals]);

  const reportPayload = useMemo(() => {
    const config = REPORT_CONFIG[activeTab];
    let columns = [], rows = [], totalsRow = null;

    if (activeTab === 'executiva') {
      columns = ['Indicador', 'Valor'];
      rows = [
        ['Registros Totais', baseMetrics.total],
        ['Turnos Confirmados', baseMetrics.confirmed],
        ['Turnos Pendentes', baseMetrics.pending],
        ['Turnos Cancelados', baseMetrics.canceled],
        ['Vagas em Aberto', baseMetrics.open],
        ['Carga Horária Confirmada', `${Number(baseMetrics.confirmedHours.toFixed(2))}h`],
        ['Cobertura Operacional', `${Number(baseMetrics.coverage.toFixed(2))}%`],
        ['Custo Financeiro Estimado', formatCurrency(financialData.estimatedCost)],
      ];
    } else if (activeTab === 'produtividade') {
      columns = ['Profissional', 'Categoria', 'Total', 'Confirmados', 'Pendentes', 'Cancelados', 'Horas'];
      rows = byProfessional.map(r => [r.name, r.category, r.total, r.confirmed, r.pending, r.canceled, `${Number(r.hours.toFixed(2))}h`]);
      totalsRow = ['TOTAL', '', baseMetrics.total, baseMetrics.confirmed, baseMetrics.pending, baseMetrics.canceled, `${Number(baseMetrics.totalHours.toFixed(2))}h`];
    } else if (activeTab === 'cobertura' || activeTab === 'risco') {
      columns = ['Setor', 'Total', 'Confirmados', 'Pendentes', 'Cancelados', 'Abertos', 'Cobertura %'];
      rows = bySector.map(r => [r.name, r.total, r.confirmed, r.pending, r.canceled, r.open, `${Number(r.coverage.toFixed(2))}%`]);
      totalsRow = ['TOTAL', baseMetrics.total, baseMetrics.confirmed, baseMetrics.pending, baseMetrics.canceled, baseMetrics.open, `${Number(baseMetrics.coverage.toFixed(2))}%`];
    } else if (activeTab === 'financeiro') {
      columns = ['Profissional', 'Setor', 'Horas', 'Valor Base', 'Custo Projetado'];
      rows = financialData.rows.map(r => {
        const isCanceled = r.status === 'cancelado' || r.status === 'canceled';
        return [
          isCanceled ? `${r.professional} (CANCELADO)` : r.professional,
          r.sector,
          `${Number(r.hours.toFixed(2))}h`,
          r.rate === null ? 'Não informado' : formatCurrency(r.rate),
          isCanceled ? 'Cancelado' : (r.cost === null ? 'Não informado' : formatCurrency(r.cost)),
        ];
      });
      totalsRow = ['TOTAL PROJETADO (Exclui cancelamentos)', '', '', '', formatCurrency(financialData.estimatedCost)];
    } else if (activeTab === 'turnover') {
      columns = ['Data', 'Profissional', 'Setor', 'Motivo da Ocorrência'];
      rows = cancellationRows.map(r => [formatDateBR(r.date), r.professional, r.sector, r.reason]);
    } else if (activeTab === 'auditoria') {
      columns = ['Evento Operacional', 'Descrição', 'Data/Hora do Registro'];
      rows = auditEvents.map(e => [e.type, e.description, e.timestamp]);
    }

    return {
      reportId, title: config?.label || 'Relatório', companyId, unitId, filters, filtersLabel, status: reportStatus, version: reportVersion, kpis: baseMetrics, columns, rows, totalsRow,
    };
  }, [activeTab, reportId, companyId, unitId, filters, filtersLabel, reportStatus, reportVersion, baseMetrics, byProfessional, bySector, financialData, cancellationRows, auditEvents]);

  const addAuditEvent = useCallback((type, description) => {
    const event = { id: Math.random().toString(36).substring(2), type, description, timestamp: new Date().toLocaleString('pt-BR') };
    setAuditEvents((current) => [event, ...current]);
  }, []);

  const calculateReportHash = useCallback(async () => {
    setHashLoading(true);
    try {
      const stablePayload = { id: reportPayload.reportId, title: reportPayload.title, status: reportPayload.status, version: reportPayload.version, rows: reportPayload.rows };
      const hash = await generateSHA256(JSON.stringify(stablePayload));
      setReportHash(hash);
      return hash;
    } finally { setHashLoading(false); }
  }, [reportPayload]);

  /* ============================================================
     EVENTOS E FUNÇÕES DA GRADE MENSAL (DRAG & DROP E CTRL+CLICK)
     ============================================================ */
  const weeksDataGrid = useMemo(() => getMonthWeeks(selectedMonth), [selectedMonth]);

  const sidebarProfessionals = useMemo(() => {
    const term = normalizeStr(profSearchQuery);
    return (professionals || []).filter(p => p?.id && (!term || normalizeStr(p.name).includes(term) || normalizeStr(p.specialty || '').includes(term)));
  }, [professionals, profSearchQuery]);

  const handleCellClick = (e, date, periodId) => {
    if (e.ctrlKey || e.metaKey) {
      const exists = selectedCells.find(c => c.date === date && c.periodId === periodId);
      if (exists) {
        setSelectedCells(selectedCells.filter(c => !(c.date === date && c.periodId === periodId)));
      } else {
        setSelectedCells([...selectedCells, { date, periodId }]);
      }
    } else {
      setSelectedCells([]);
      setNewShiftModal({ date, periodId });
    }
  };

  const handleDragStart = (e, prof) => {
    if (!prof?.id) return;
    e.dataTransfer.setData('profId', prof.id);
  };

  const handleDragOver = (e) => { e.preventDefault(); };

  const assignShift = async (date, periodId, profId) => {
    if (filters.sectorId === 'todos') { alert("Selecione um setor na barra superior para alocar."); return; }
    const periodDef = SHIFT_PERIODS.find(p => p.id === periodId);
    const prof = professionalMap[profId];
    const sectorObj = (sectors || []).find(s => String(s.id) === String(filters.sectorId));
    if (!prof || !sectorObj) return;

    try {
      const existingShift = (filteredShifts || []).find(s => s.date && s.date.startsWith(date) && s.periodId === periodId && s.isVacant);
      const payload = {
        company_id: companyId, unit_id: unitId, professional_id: prof.id, professional_name: prof.name,
        sector_id: sectorObj.id, sector_name: sectorObj.name, date: date, start_time: periodDef.start, end_time: periodDef.end,
        duration_hours: periodId === 'noite' ? 12 : 6, status: 'confirmado' 
      };

      if (existingShift) await base44.entities.Shift.update(existingShift.id, payload);
      else await base44.entities.Shift.create(payload);
      
      load();
    } catch (error) { alert("Erro ao salvar plantão: " + error.message); }
  };

  const handleDrop = (e, date, periodId) => {
    e.preventDefault();
    const profId = e.dataTransfer.getData('profId');
    if (!profId) return;

    const isSelected = selectedCells.some(c => c.date === date && c.periodId === periodId);
    if (isSelected && selectedCells.length > 0) {
      selectedCells.forEach(cell => assignShift(cell.date, cell.periodId, profId));
      setSelectedCells([]);
    } else {
      assignShift(date, periodId, profId);
      setSelectedCells([]);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja cancelar este plantão? Ele ficará salvo no log de auditoria.')) return;
    try {
        await base44.entities.Shift.update(id, { status: 'cancelado', notes: 'Cancelado pela gestão.' });
        load();
    } catch (e) { alert('Erro ao cancelar.'); }
  };

  const handlePublish = () => {
    if (confirm('Publicar escala? Isso fixará a visualização para os profissionais e emitirá os alertas.')) {
      setIsPublished(true);
      setTimeout(() => alert('Escala publicada com sucesso! Notificações enviadas aos profissionais.'), 500);
    }
  };

  /* ============================================================
     FUNÇÕES DO BUILDER DE ESCALA BASE
     ============================================================ */
  
  const openNewBuilderModal = () => {
    setBuilderForm({ id: '', name: '', start: '', end: '', qty: 1, color: BUILDER_COLORS[0], days: [] });
    setBuilderModal({ isNew: true });
  };

  const openEditBuilderModal = (shiftObj) => {
    const selectedColor = BUILDER_COLORS.find(c => c.value === shiftObj.color) || BUILDER_COLORS[0];
    const activeDays = [];
    [1,2,3,4,5,6,0].forEach(d => { if(shiftObj.activeDays[d]) activeDays.push(d); });
    setBuilderForm({ id: shiftObj.id, name: shiftObj.name, start: shiftObj.start, end: shiftObj.end, qty: shiftObj.qty, color: selectedColor, days: activeDays });
    setBuilderModal({ isNew: false });
  };

  const toggleBuilderDay = (dayIndex) => {
    setBuilderForm(prev => {
      const newDays = prev.days.includes(dayIndex) ? prev.days.filter(d => d !== dayIndex) : [...prev.days, dayIndex];
      return { ...prev, days: newDays };
    });
  };

  const saveBuilderShift = () => {
    if (!builderForm.name || !builderForm.start || !builderForm.end) { alert('Preencha os campos obrigatórios.'); return; }
    const activeDays = {};
    [1,2,3,4,5,6,0].forEach(d => { activeDays[d] = builderForm.days.includes(d); });

    const newObj = {
      id: builderModal.isNew ? Date.now().toString() : builderForm.id,
      name: builderForm.name, start: builderForm.start, end: builderForm.end,
      color: builderForm.color.value, qty: builderForm.qty, activeDays,
      cellStates: builderModal.isNew ? { ...activeDays } : (builderShifts.find(s => s.id === builderForm.id)?.cellStates || { ...activeDays })
    };

    if (builderModal.isNew) {
      setBuilderShifts(prev => [...prev, newObj]);
    } else {
      setBuilderShifts(prev => prev.map(s => s.id === newObj.id ? newObj : s));
    }
    setBuilderModal(null);
  };

  const toggleBuilderCell = (shiftId, dayIndex) => {
    setBuilderShifts(prev => prev.map(s => {
      if (s.id === shiftId) {
        return { ...s, cellStates: { ...s.cellStates, [dayIndex]: !s.cellStates[dayIndex] } };
      }
      return s;
    }));
  };

  const openReportPreview = async () => {
    addAuditEvent('VISUALIZAÇÃO', `Geração oficial do relatório "${REPORT_CONFIG[activeTab]?.label}".`);
    setReportModalOpen(true);
    await calculateReportHash();
  };

  const printReport = useCallback(() => {
    addAuditEvent('IMPRESSÃO', `Solicitação de impressão do relatório "${REPORT_CONFIG[activeTab]?.label}".`);
    const payload = reportPayload;
    const printWindow = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes,resizable=yes');
    if (!printWindow) { alert('A impressão foi bloqueada pelo navegador. Permita pop-ups para este sistema.'); return; }
    
    const kpisHtml = payload.kpis ? `
      <div class="kpi-grid">
        <div class="kpi-box"><div class="kpi-label">Registros</div><div class="kpi-value">${formatNumber(payload.kpis.total)}</div></div>
        <div class="kpi-box"><div class="kpi-label">Confirmados</div><div class="kpi-value">${formatNumber(payload.kpis.confirmed)}</div></div>
        <div class="kpi-box"><div class="kpi-label">Pendentes</div><div class="kpi-value">${formatNumber(payload.kpis.pending)}</div></div>
        <div class="kpi-box"><div class="kpi-label">Cancelados</div><div class="kpi-value">${formatNumber(payload.kpis.canceled)}</div></div>
        <div class="kpi-box"><div class="kpi-label">Horas</div><div class="kpi-value">${formatNumber(payload.kpis.confirmedHours, 1)}h</div></div>
        <div class="kpi-box"><div class="kpi-label">Cobertura</div><div class="kpi-value">${formatNumber(payload.kpis.coverage, 1)}%</div></div>
      </div>
    ` : '';

    const tableHtml = buildPrintTable(payload.columns, payload.rows, payload.totalsRow);

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <title>${escapeHtml(payload.title)}</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            * { box-sizing: border-box; font-family: 'Arial', sans-serif; }
            body { margin: 0; padding: 0; color: #0f172a; font-size: 10px; background: #ffffff; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-start; }
            .title { font-size: 20px; font-weight: bold; margin: 0 0 5px; color: #0f172a; text-transform: uppercase; }
            .subtitle { font-size: 12px; color: #475569; margin: 0; }
            .meta { text-align: right; font-size: 9px; color: #334155; line-height: 1.5; }
            .section-title { font-size: 13px; font-weight: bold; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin: 15px 0 8px; }
            .filter-box { border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 5px; padding: 10px; margin-bottom: 12px; }
            .kpi-grid { display: flex; gap: 10px; margin-bottom: 15px; }
            .kpi-box { flex: 1; border: 1px solid #cbd5e1; border-radius: 5px; padding: 10px; background: #ffffff; }
            .kpi-label { font-size: 8px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; font-weight: bold; }
            .kpi-value { font-size: 16px; font-weight: bold; color: #0f172a; }
            .print-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            .print-table thead { display: table-header-group; }
            .print-table tr { page-break-inside: avoid; }
            .print-table th { background: #e2e8f0; color: #0f172a; font-size: 9px; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #94a3b8; }
            .print-table td { font-size: 9px; padding: 7px; border: 1px solid #cbd5e1; vertical-align: middle; }
            .print-table tbody tr:nth-child(even) td { background: #f8fafc; }
            .print-table tfoot th { background: #cbd5e1; border: 1px solid #94a3b8; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 50px; page-break-inside: avoid; }
            .signature-line { border-top: 1px solid #334155; padding-top: 6px; text-align: center; font-size: 9px; font-weight: bold; }
            .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 8px; color: #64748b; }
            @media screen {
              body { background: #e2e8f0; padding: 25px; }
              main { background: #ffffff; padding: 30px; max-width: 1400px; margin: 0 auto; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
              .no-print { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 20px; }
              .no-print button { padding: 8px 16px; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; }
              .btn-print { background: #0284c7; color: white; }
              .btn-close { background: #cbd5e1; color: #0f172a; }
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
            <header class="header">
              <div>
                <h1 class="title">CENTRAL DE INTELIGÊNCIA HOSPITALAR</h1>
                <p class="subtitle">${escapeHtml(payload.title)}</p>
              </div>
              <div class="meta">
                <div><strong>ID:</strong> ${escapeHtml(payload.reportId)}</div>
                <div><strong>Versão:</strong> ${escapeHtml(payload.version)}</div>
                <div><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}</div>
              </div>
            </header>
            <div class="filter-box"><strong>Filtros aplicados:</strong> ${escapeHtml(payload.filtersLabel)}</div>
            ${kpisHtml}
            ${tableHtml}
            <section class="signatures">
              <div class="signature-line">Responsável pela emissão</div>
              <div class="signature-line">Responsável pela aprovação</div>
            </section>
            <footer class="footer">
              <span>Documento gerado eletronicamente.</span>
              <span>${escapeHtml(payload.reportId)}</span>
            </footer>
          </main>
          <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };</script>
        </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }, [addAuditEvent, activeTab, reportPayload]);

  const exportCSV = () => {
    const payload = reportPayload;
    const lines = [`${escapeCSV('CENTRAL DE INTELIGÊNCIA HOSPITALAR')}`, `${escapeCSV('Relatório')};${escapeCSV(payload.title)}`, `${escapeCSV('ID do relatório')};${escapeCSV(payload.reportId)}`, `${escapeCSV('Filtros')};${escapeCSV(payload.filtersLabel)}`, `${escapeCSV('Gerado em')};${escapeCSV(new Date().toLocaleString('pt-BR'))}`, ''];
    lines.push(payload.columns.map(escapeCSV).join(';'));
    payload.rows.forEach(row => lines.push(row.map(escapeCSV).join(';')));
    if (payload.totalsRow) lines.push(payload.totalsRow.map(escapeCSV).join(';'));
    const content = '\uFEFF' + lines.join('\r\n');
    downloadFile(content, `${sanitizeFilename(payload.title)}-${payload.reportId}.csv`, 'text/csv;charset=utf-8;');
  };

  const resetFilters = () => {
    setFilters({ startDate: '', endDate: '', sectorId: 'todos', status: 'todos', professionalId: 'todos', category: 'todos' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 dark:bg-slate-800 flex items-center justify-center shadow-xl">
            <Loader2 className="w-7 h-7 text-white animate-spin" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Carregando Central</h2>
            <p className="text-sm text-slate-500 mt-1">Sincronizando dados...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* MOBILE HEADER */}
      <div className="lg:hidden sticky top-0 z-40 bg-slate-950 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <button onClick={() => setMobileMenuOpen(c => !c)} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-sky-400" />
          <span className="font-semibold text-sm">Inteligência Hospitalar</span>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-white hover:bg-white/10">
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>
      </div>

      <div className="flex min-h-screen">
        
        {/* SIDEBAR CORPORATIVA */}
        <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[280px] bg-slate-950 dark:bg-slate-900 border-r border-slate-800 text-white flex flex-col shadow-2xl transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="px-6 py-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-sky-600 flex items-center justify-center shadow-lg shadow-sky-900/40">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-black text-sm tracking-wider text-white">CENTRAL DE</div>
                <div className="text-xs font-semibold text-sky-400">INTELIGÊNCIA HOSPITALAR</div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-5">
            <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Planejamento & Escalas</div>
            <SidebarItem active={viewMode === 'grade'} icon={LayoutGrid} label="Builder Visual da Escala" onClick={() => { setViewMode('grade'); setActiveTab('operacional'); setMobileMenuOpen(false); }} />
            <SidebarItem active={viewMode === 'list'} icon={List} label="Lista Diária" onClick={() => { setViewMode('list'); setActiveTab('operacional'); setMobileMenuOpen(false); }} />
            
            <div className="mt-4 mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Base Estrutural</div>
            <SidebarItem active={viewMode === 'base_builder'} icon={Plus} label="Nova Escala Base" onClick={() => { setCreateScaleState(1); setMobileMenuOpen(false); }} />

            <div className="mt-7 mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Painel Executivo (Relatórios)</div>
            <SidebarItem active={activeTab === 'executiva' && viewMode === 'relatorios'} icon={LayoutDashboard} label="Visão Executiva" onClick={() => { setViewMode('relatorios'); setActiveTab('executiva'); setMobileMenuOpen(false); }} />
            {[
              ['produtividade', Clock3],
              ['cobertura', Building2],
              ['risco', ShieldCheck],
              ['financeiro', BarChart3],
              ['turnover', Users],
            ].map(([key, Icon]) => (
              <SidebarItem key={key} active={activeTab === key && viewMode === 'relatorios'} icon={Icon} label={REPORT_CONFIG[key].label} onClick={() => { setViewMode('relatorios'); setActiveTab(key); setMobileMenuOpen(false); }} />
            ))}

            <div className="mt-7 mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Governança</div>
            <SidebarItem active={activeTab === 'auditoria' && viewMode === 'relatorios'} icon={ClipboardCheck} label="Log de Auditoria" onClick={() => { setViewMode('relatorios'); setActiveTab('auditoria'); setMobileMenuOpen(false); }} />
          </div>
        </aside>

        {mobileMenuOpen && <button type="button" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-black/60 lg:hidden" />}

        {/* CONTEÚDO PRINCIPAL */}
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors shrink-0">
            <div className="px-5 sm:px-8 py-5">
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-sky-600 dark:bg-sky-500 items-center justify-center shrink-0 shadow-md">
                    {viewMode === 'grade' || viewMode === 'list' ? <CalendarDays className="w-6 h-6 text-white" /> : viewMode === 'base_builder' ? <SlidersHorizontal className="w-6 h-6 text-white" /> : <BarChart3 className="w-6 h-6 text-white" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Módulo Ativo</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">ONLINE</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50 mt-1">
                      {viewMode === 'grade' ? 'Builder Visual (Grade)' : viewMode === 'list' ? 'Lista Diária de Plantões' : viewMode === 'base_builder' ? 'Editor de Escala Base' : REPORT_CONFIG[activeTab]?.label}
                    </h1>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="icon" onClick={toggleTheme} className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><Sun className="w-4 h-4 hidden dark:block" /><Moon className="w-4 h-4 block dark:hidden" /></Button>
                  <Button variant="outline" onClick={() => loadData(true)} disabled={refreshing} className="gap-2 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar</Button>
                  
                  {viewMode === 'relatorios' && (
                    <>
                      <Button variant="outline" onClick={exportCSV} className="gap-2 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"><FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> CSV</Button>
                      <Button onClick={openReportPreview} className="gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold"><Eye className="w-4 h-4" /> Prévia Oficial</Button>
                    </>
                  )}

                  {viewMode === 'grade' && (
                    <Button onClick={handlePublish} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-5 shadow-md shadow-emerald-600/20 gap-2">
                      <Send className="w-4 h-4" /> Publicar Escala
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* ===================== FILTROS GERAIS ===================== */}
          {viewMode !== 'base_builder' && (
            <section className="px-5 sm:px-8 pt-6 shrink-0">
              <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row items-center gap-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-fit">
                  <Filter className="w-4 h-4 text-sky-600" /> Filtros:
                </div>
                
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                  {viewMode !== 'grade' && (
                    <>
                      <Input type="date" value={filters.startDate} onChange={e => setFilters(c => ({...c, startDate: e.target.value}))} className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700" title="Data Inicial" />
                      <Input type="date" value={filters.endDate} onChange={e => setFilters(c => ({...c, endDate: e.target.value}))} className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700" title="Data Final" />
                    </>
                  )}
                  {viewMode === 'grade' && (
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700 col-span-2"><SelectValue placeholder="Mês Corrente" /></SelectTrigger>
                      <SelectContent>
                        {monthOptions.map(m => {
                          const d = new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1);
                          return <SelectItem key={m} value={m}>{d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  )}

                  <Select value={String(filters.sectorId)} onValueChange={v => setFilters(c => ({...c, sectorId: v}))}>
                    <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700 col-span-2"><SelectValue placeholder="Todos os Setores" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os setores</SelectItem>
                      {(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedCells.length > 0 && viewMode === 'grade' && (
                  <div className="bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 px-3 py-1.5 rounded-xl text-[10px] font-bold border border-sky-200 dark:border-sky-800 animate-pulse text-center">
                    {selectedCells.length} dias<br/>selecionados
                  </div>
                )}
                <Button variant="ghost" onClick={resetFilters} className="text-xs text-red-500 h-9">Limpar</Button>
              </Card>
            </section>
          )}

          {/* ===================== MODO GRADE VISUAL ===================== */}
          {viewMode === 'grade' && (
            <div className="flex-1 flex overflow-hidden p-5 sm:px-8 pb-8">
              <Card className="flex-1 border-slate-200 dark:border-slate-800 shadow-sm flex overflow-hidden bg-white dark:bg-slate-900">
                {/* BARRA LATERAL DRAG AND DROP */}
                <div className="w-64 bg-slate-50/50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="font-black text-sm text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2"><UsersRound className="w-4 h-4 text-sky-600" /> Corpo Clínico</h3>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <Input placeholder="Buscar profissional..." value={profSearchQuery} onChange={e => setProfSearchQuery(e.target.value)} className="pl-9 h-9 text-xs bg-white dark:bg-slate-800" />
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 text-center font-medium">Arraste o nome para a escala ➔</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {sidebarProfessionals.map(prof => (
                      <div key={prof.id} draggable onDragStart={(e) => handleDragStart(e, prof)} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-sky-400 active:cursor-grabbing flex items-center gap-2 group transition-all">
                        <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-sky-500" />
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">{prof.name}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{prof.specialty || 'Geral'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ÁREA CALENDÁRIO */}
                <div className="flex-1 overflow-auto relative custom-scrollbar bg-slate-100/30 dark:bg-slate-950">
                  {filters.sectorId === 'todos' ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                      <Building2 className="w-12 h-12 mb-4 opacity-50 text-slate-300" />
                      <p className="font-bold text-slate-600 dark:text-slate-300">Selecione um Setor Específico</p>
                      <p className="text-sm mt-1">O modo Grade exige um setor selecionado para permitir alocação de nomes nas vagas.</p>
                    </div>
                  ) : (
                    <div className="min-w-[900px] pb-10">
                      <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 sticky top-0 z-20 shadow-sm">
                        <div className="p-3 border-r border-slate-200 dark:border-slate-800 flex items-center justify-center font-black text-xs text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-800/80">Turno</div>
                        {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map(day => (
                          <div key={day} className="p-3 border-r border-slate-200 dark:border-slate-800 text-center font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">{day}</div>
                        ))}
                      </div>

                      {weeksDataGrid.map((week, wIndex) => (
                        <div key={wIndex} className="border-b-[6px] border-slate-200 dark:border-slate-800/50">
                          <div className="grid grid-cols-8 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                            <div className="p-2 border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80"></div>
                            {week.map((date, dIndex) => (
                              <div key={dIndex} className={`p-1 border-r border-slate-200 dark:border-slate-800 text-right pr-2 text-[10px] font-black ${date ? 'text-slate-500 dark:text-slate-400' : 'text-transparent'}`}>
                                {date ? `${date.split('-')[2]}/${date.split('-')[1]}` : '-'}
                              </div>
                            ))}
                          </div>

                          {SHIFT_PERIODS.map((period) => (
                            <div key={period.id} className="grid grid-cols-8 border-b border-slate-100 dark:border-slate-800/50 last:border-b-0 group">
                              <div className="p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex flex-col items-center justify-center">
                                <span className="font-black text-[11px] uppercase text-slate-700 dark:text-slate-300">{period.label}</span>
                                <span className="text-[9px] font-bold text-slate-400">{period.start} - {period.end}</span>
                              </div>

                              {week.map((date, dIndex) => {
                                if (!date) return <div key={dIndex} className="bg-slate-50 dark:bg-slate-900/20 border-r border-slate-200 dark:border-slate-800 p-2"></div>;

                                const slotShifts = (filteredShifts || []).filter(s => s.date && s.date.startsWith(date) && s.periodId === period.id);
                                const isSelected = selectedCells.some(c => c.date === date && c.periodId === period.id);

                                return (
                                  <div 
                                    key={dIndex} 
                                    className={`border-r border-slate-200 dark:border-slate-800/50 p-1.5 min-h-[70px] relative transition-colors cursor-pointer flex flex-col gap-1 ${isSelected ? 'bg-sky-50 dark:bg-sky-900/20 ring-inset ring-2 ring-sky-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, date, period.id)}
                                    onClick={(e) => handleCellClick(e, date, period.id)}
                                    title="Ctrl+Click para selecionar múltiplos. Clique simples para Novo Plantão."
                                  >
                                    {slotShifts.map(s => (
                                      <div key={s.id} className={`relative p-2 rounded-lg text-[10px] border flex items-center justify-between group/item transition-all hover:scale-[1.02] shadow-sm ${s.isVacant ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 text-amber-800 dark:text-amber-200 border-dashed' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100'}`}>
                                        <span className="font-bold truncate pr-4">{s.isVacant ? 'Vaga Aberta' : toTitleCase(s.professional_name)}</span>
                                        {!s.isVacant && isPublished && <div className="absolute -top-2 left-2 opacity-0 group-hover/item:opacity-100 transition-opacity bg-emerald-500 text-white text-[8px] font-black px-1.5 rounded uppercase shadow-sm">Publicado</div>}
                                        {!s.isVacant && (
                                          <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="opacity-0 group-hover/item:opacity-100 p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded transition-opacity absolute right-1"><X className="w-3 h-3" /></button>
                                        )}
                                      </div>
                                    ))}
                                    {inlineEditingCell?.date === date && inlineEditingCell?.periodId === period.id && (
                                      <div className="absolute inset-0 z-30 bg-white dark:bg-slate-900 border-2 border-sky-500 rounded-lg p-1 shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center gap-1 border-b dark:border-slate-700 pb-1 mb-1">
                                          <Search className="w-3 h-3 text-slate-400" />
                                          <input autoFocus type="text" placeholder="Buscar..." className="w-full text-[10px] outline-none bg-transparent font-medium dark:text-white" value={inlineSearchText} onChange={e => setInlineSearchText(e.target.value)} onKeyDown={(e) => { if(e.key === 'Escape') setInlineEditingCell(null); }} />
                                          <button onClick={() => setInlineEditingCell(null)}><X className="w-3 h-3 text-slate-400 hover:text-red-500"/></button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar">
                                          {(professionals || []).filter(p => !inlineSearchText || normalizeStr(p.name).includes(normalizeStr(inlineSearchText))).slice(0, 5).map(p => (
                                            <button key={p.id} className="w-full text-left px-2 py-1 text-[10px] hover:bg-sky-50 dark:hover:bg-slate-800 rounded truncate text-slate-700 dark:text-slate-300 font-medium" onClick={() => { assignShift(date, period.id, p.id); setInlineEditingCell(null); setInlineSearchText(''); }}>{p.name}</button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
        )}

        {/* ===================== MODO EDITOR DE ESCALA BASE (NOVO COMPONENTE INTEGRADO) ===================== */}
        {viewMode === 'base_builder' && (
          <div className="flex-1 overflow-auto p-5 sm:p-8 bg-slate-50 dark:bg-slate-950 flex flex-col items-center">
            <div className="w-full max-w-5xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-sky-700 dark:text-sky-400">Escala Base (Modo Edição)</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Configure os padrões de horário e distribuição de vagas antes de preencher os nomes da equipe.</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Data de Início das Alterações</label>
                  <Input type="date" className="h-10 w-40 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[10px] font-bold">
                      <tr>
                        <th className="p-4 w-48 text-center border-r border-slate-200 dark:border-slate-700">Padrão Operacional</th>
                        {WEEK_DAYS_ORDER.map(day => (
                          <th key={day.index} className={`p-4 text-center border-r border-slate-200 dark:border-slate-700 ${day.weekend ? 'bg-slate-200/50 dark:bg-slate-700/50' : ''}`}>
                            {day.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {builderShifts.length === 0 ? (
                        <tr><td colSpan="8" className="p-12 text-center text-slate-400 text-sm">Nenhum horário configurado. Adicione um novo abaixo.</td></tr>
                      ) : (
                        builderShifts.map(shift => {
                          const shiftColorClass = shift.color || BUILDER_COLORS[0].value;
                          return (
                            <tr key={shift.id}>
                              <td className={`p-4 font-bold border-r border-slate-200 dark:border-slate-800 ${shiftColorClass} relative group/header`}>
                                <div className="flex flex-col items-center justify-center text-center">
                                  <span className="text-sm">{shift.name}</span>
                                  <span className="text-[10px] opacity-70 mt-0.5">{shift.start} às {shift.end}</span>
                                </div>
                                <button onClick={() => openEditBuilderModal(shift)} className="absolute top-2 right-2 p-1.5 bg-white/50 hover:bg-white rounded-lg text-slate-700 opacity-0 group-hover/header:opacity-100 transition-all shadow-sm">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </td>
                              {WEEK_DAYS_ORDER.map(day => {
                                const isActive = shift.cellStates[day.index];
                                return (
                                  <td key={day.index} className={`p-0 border-r border-slate-100 dark:border-slate-800 text-center relative ${day.weekend ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''}`}>
                                    <div className="relative w-full h-full min-h-[60px] flex items-center justify-center group/cell cursor-pointer" onClick={() => toggleBuilderCell(shift.id, day.index)}>
                                      <div className={`w-8 h-8 mx-auto rounded-lg font-black text-sm flex items-center justify-center transition-colors ${isActive ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'bg-transparent text-slate-300 dark:text-slate-600'}`}>
                                        {isActive ? shift.qty : '-'}
                                      </div>
                                      {/* OVERLAY DE ATIVAR/DESATIVAR NO HOVER */}
                                      <div className="absolute inset-0 bg-slate-900/80 text-white text-[9px] font-bold flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                        {isActive ? 'Desativar vaga?' : 'Ativar vaga?'}
                                      </div>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center bg-slate-50 dark:bg-slate-900/50">
                  <Button variant="ghost" onClick={openNewBuilderModal} className="text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-900/30 font-bold text-xs gap-1.5 h-9">
                    <Plus className="w-4 h-4" /> Adicionar Horário Especial
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
                <Button variant="outline" onClick={() => setViewMode('grade')} className="font-bold border-slate-300 dark:border-slate-700 h-11 px-8">Cancelar</Button>
                <Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-11 px-8 shadow-md" onClick={() => { alert('Escala Base salva com sucesso! O calendário de vagas foi gerado.'); setViewMode('grade'); }}>Salvar Escala Base</Button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== RELATÓRIOS (MANTIDO INTACTO) ===================== */}
        {viewMode === 'relatorios' && (
          <div className="flex-1 overflow-auto p-5 sm:p-8 space-y-6">
            {activeTab === 'executiva' && <ExecutiveView baseMetrics={baseMetrics} riskRows={riskRows} byProfessional={byProfessional} criticalAlerts={criticalAlerts} financialData={financialData} />}
            {activeTab === 'produtividade' && <ProductivityView rows={byProfessional} baseMetrics={baseMetrics} />}
            {activeTab === 'cobertura' && <CoverageView rows={bySector} />}
            {activeTab === 'risco' && <RiskView rows={riskRows} />}
            {activeTab === 'financeiro' && <FinancialView data={financialData} />}
            {activeTab === 'turnover' && <CancellationView rows={cancellationRows} />}
            {activeTab === 'auditoria' && <GovernanceView reportId={reportId} version={reportVersion} status={reportStatus} hash={reportHash} hashLoading={hashLoading} auditEvents={auditEvents} onGenerateHash={calculateReportHash} onStatusChange={changeReportStatus} onNewVersion={createNewVersion} />}
          </div>
        )}
      </main>

      {/* ========================================================
          MODAIS E DIALOGS DE SOBREPOSIÇÃO
          ======================================================== */}

      {/* Modal 1: Adicionar Escala Inicial (Passo 1 do Builder) */}
      {createScaleState === 1 && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-black text-sky-600 dark:text-sky-400">Adicionar Escala</h2>
              <button onClick={() => setCreateScaleState(0)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Nome do Setor / Escala <span className="text-red-500">*</span></label>
                <Input placeholder="Ex: UTI Adulto" className="h-11 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" />
                <p className="text-[10px] text-slate-400 mt-1.5">Este é o nome que será apresentado aos profissionais na grade de plantões.</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Endereço da Unidade (Opcional)</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                  <Input placeholder="Rua, Número, Bairro..." className="pl-9 h-11 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Cidade</label>
                  <Input className="h-11 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" placeholder="Ex: São Paulo" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Estado</label>
                  <Select>
                    <SelectTrigger className="h-11 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent><SelectItem value="SP">SP</SelectItem><SelectItem value="RJ">RJ</SelectItem><SelectItem value="MG">MG</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" onClick={() => setCreateScaleState(0)} className="h-11 px-6 border-slate-300 dark:border-slate-700">Cancelar</Button>
                <Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-11 px-8 shadow-md" onClick={() => setCreateScaleState(2)}>Salvar e Continuar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Confirmação e Direcionamento (Passo 2 do Builder) */}
      {createScaleState === 2 && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">Escala criada com sucesso!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">Gostaria de configurar os padrões de horário e a quantidade de vagas da equipe agora?</p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" className="flex-1 font-bold h-11 border-slate-300 dark:border-slate-700" onClick={() => setCreateScaleState(0)}>Não, depois</Button>
              <Button className="flex-1 bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white font-bold h-11 shadow-md" onClick={() => { setCreateScaleState(0); setViewMode('base_builder'); }}>Sim, configurar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Configurar Horário Específico no Builder (Passo 3) */}
      {builderModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-black text-sky-600 dark:text-sky-400">
                {builderModal.isNew ? 'Novo Padrão de Horário' : 'Editar Padrão de Horário'}
              </h2>
              <button onClick={() => setBuilderModal(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Nome da Equipe / Turno</label>
                <Input value={builderForm.name} onChange={e => setBuilderForm({...builderForm, name: e.target.value})} placeholder="Ex: Plantão Diurno, UTI Noturna" className="h-11 font-medium bg-white dark:bg-slate-950" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Início</label>
                  <Input type="time" value={builderForm.start} onChange={e => setBuilderForm({...builderForm, start: e.target.value})} className="h-11 font-medium bg-white dark:bg-slate-950" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Término</label>
                  <Input type="time" value={builderForm.end} onChange={e => setBuilderForm({...builderForm, end: e.target.value})} className="h-11 font-medium bg-white dark:bg-slate-950" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Nº Plantonistas / Vagas</label>
                  <Input type="number" min="1" value={builderForm.qty} onChange={e => setBuilderForm({...builderForm, qty: Number(e.target.value)})} className="h-11 font-bold text-lg bg-white dark:bg-slate-950 text-center" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Cor do Turno</label>
                  <div className="flex gap-2 p-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/50">
                    {BUILDER_COLORS.map(c => (
                      <button 
                        key={c.id} 
                        onClick={() => setBuilderForm({...builderForm, color: c})}
                        className={`w-6 h-6 rounded-md ${c.bg} shadow-sm transition-transform ${builderForm.color?.id === c.id ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 block">Repetir Horários na Semana</label>
                <div className="flex justify-between gap-1">
                  {WEEK_DAYS_ORDER.map(day => {
                    const isSelected = builderForm.days.includes(day.index);
                    return (
                      <button 
                        key={day.index}
                        onClick={() => toggleBuilderDay(day.index)}
                        className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${isSelected ? 'bg-sky-50 border-sky-300 text-sky-700 dark:bg-sky-900/40 dark:border-sky-700 dark:text-sky-300 shadow-sm' : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <span className="text-[9px] font-black uppercase mb-1">{day.short}</span>
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${isSelected ? 'bg-sky-500 border-sky-600 text-white' : 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-700'}`}>
                          {isSelected && <CheckCircle2 className="w-2.5 h-2.5" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-between items-center pt-5 mt-2">
                {!builderModal.isNew ? (
                  <Button variant="ghost" className="text-red-500 hover:bg-red-50 font-bold text-xs" onClick={() => { setBuilderShifts(prev => prev.filter(s => s.id !== builderForm.id)); setBuilderModal(null); }}>
                    <Trash2 className="w-4 h-4 mr-1.5" /> Excluir Turno
                  </Button>
                ) : <div/>}
                
                <Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-11 px-8 shadow-md" onClick={saveBuilderShift}>
                  Salvar Turno
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: NOVO PLANTÃO INDIVIDUAL (Click na Célula - Referência 1) */}
      {newShiftModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-black text-sky-600 dark:text-sky-400">Novo Plantão</h2>
              <button onClick={() => setNewShiftModal(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            
            <div className="p-6 space-y-4 text-sm font-medium text-slate-700 dark:text-slate-300">
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-right text-xs font-bold text-slate-500">Plantonista:</label>
                <Select>
                  <SelectTrigger className="col-span-2 h-10 text-xs bg-white dark:bg-slate-950"><SelectValue placeholder="Busque um profissional..." /></SelectTrigger>
                  <SelectContent>
                    {(professionals || []).filter(p => p?.id).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-right text-xs font-bold text-slate-500">Equipe (Turno):</label>
                <div className="col-span-2 font-bold text-slate-900 dark:text-white capitalize px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                  {SHIFT_PERIODS.find(p => p.id === newShiftModal.periodId)?.label || newShiftModal.periodId}
                </div>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-right text-xs font-bold text-slate-500">Dia da Semana:</label>
                <div className="col-span-2 font-semibold text-slate-600 dark:text-slate-400">{fmtDateLong(newShiftModal.date)}</div>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-right text-xs font-bold text-slate-500">Data Selecionada:</label>
                <div className="col-span-2 font-bold text-slate-900 dark:text-white">{formatDateBR(newShiftModal.date)}</div>
              </div>
              
              <div className="border-t border-slate-100 dark:border-slate-800 my-5" />
              
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-right text-xs font-bold text-slate-500">Repetir a cada:</label>
                <Select defaultValue="1">
                  <SelectTrigger className="col-span-2 h-10 text-xs bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="0">Não Repetir</SelectItem><SelectItem value="1">1 Semana</SelectItem><SelectItem value="2">2 Semanas</SelectItem></SelectContent>
                </Select>
              </div>

              <div className="flex justify-end pt-5">
                <Button onClick={() => { alert('Plantão salvo com sucesso!'); setNewShiftModal(null); }} className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-11 px-8 shadow-md">
                  Alocar Profissional
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ShiftFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={load} shift={editing} sectors={sectors} professionals={professionals} companyId={companyId} unitId={unitId} />

      {/* ========================================================
          MODAL DE RELATÓRIOS (PDF / CSV / AUDITORIA)
          ======================================================== */}
      {reportModalOpen && (
        <ReportPreviewModal
          reportPayload={reportPayload}
          reportHash={reportHash}
          hashLoading={hashLoading}
          reportStatus={reportStatus}
          reportVersion={reportVersion}
          onClose={() => setReportModalOpen(false)}
          onPrint={printReport}
          onExport={exportCSV}
          onStatusChange={changeReportStatus}
          onNewVersion={createNewVersion}
        />
      )}
    </div>
  );
}

/* ============================================================
   SUB-COMPONENTES DA TELA DE RELATÓRIO
   ============================================================ */

function ExecutiveView({ baseMetrics, riskRows, byProfessional, criticalAlerts, financialData }) {
  const topProfessionals = byProfessional.slice(0, 8);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2 p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 transition-colors">
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
            <ExecutiveMetric label="Custo Estimado" value={formatCurrency(financialData.estimatedCost)} />
            <ExecutiveMetric label="Cancelamentos" value={formatNumber(baseMetrics.canceled)} />
          </div>
        </Card>

        <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 transition-colors">
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <h2 className="font-bold text-slate-900 dark:text-white">Situação operacional</h2>
          </div>
          <div className="space-y-4">
            <StatusLine label="Regular" value={riskRows.filter((r) => r.level === 'regular').length} type="success" />
            <StatusLine label="Atenção" value={riskRows.filter((r) => r.level === 'atencao').length} type="warning" />
            <StatusLine label="Crítico" value={riskRows.filter((r) => r.level === 'critico').length} type="danger" />
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-5 leading-relaxed">
            Classificação operacional baseada no percentual de registros confirmados. Não representa, por si só, uma conclusão de conformidade regulatória.
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 transition-colors">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Cobertura por setor</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Menores percentuais aparecem primeiro</p>
            </div>
          </div>
          <div className="space-y-4">
            {riskRows.slice(0, 8).map((row) => <CoverageBar key={row.name} label={row.name} value={row.coverage} />)}
            {riskRows.length === 0 && <EmptyState title="Sem dados de cobertura" description="Não existem registros para os filtros atuais." />}
          </div>
        </Card>

        <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 transition-colors">
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
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{row.category}</div>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{formatNumber(row.hours, 1)}h</div>
              </div>
            ))}
            {topProfessionals.length === 0 && <EmptyState title="Sem profissionais" description="Não existem registros para os filtros atuais." />}
          </div>
        </Card>
      </div>

      {criticalAlerts.length > 0 && (
        <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 transition-colors">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500" />
            <h2 className="font-bold text-slate-900 dark:text-white">Alertas de gestão</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {criticalAlerts.map((alert, index) => (
              <div key={index} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{alert.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{alert.description}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ProductivityView({ rows, baseMetrics }) {
  return (
    <ReportCard title="Produtividade por profissional" description="Carga horária e volume de plantões.">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
              <th className="py-3 pr-4">Profissional</th>
              <th className="py-3 px-4">Categoria</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-right">Confirmados</th>
              <th className="py-3 px-4 text-right">Pendentes</th>
              <th className="py-3 px-4 text-right">Cancelados</th>
              <th className="py-3 pl-4 text-right">Horas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-800 dark:text-slate-200">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">{row.name}</td>
                <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{row.category}</td>
                <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">{formatNumber(row.total)}</td>
                <td className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-400 font-semibold">{formatNumber(row.confirmed)}</td>
                <td className="py-3 px-4 text-right text-amber-700 dark:text-amber-400">{formatNumber(row.pending)}</td>
                <td className="py-3 px-4 text-right text-red-700 dark:text-red-400">{formatNumber(row.canceled)}</td>
                <td className="py-3 pl-4 text-right font-bold text-slate-900 dark:text-slate-100">{formatNumber(row.hours, 1)}h</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold text-slate-900 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700">
                <td className="py-4 pr-4">TOTAL CONSOLIDADO</td><td /><td className="py-4 px-4 text-right">{formatNumber(baseMetrics.total)}</td><td className="py-4 px-4 text-right text-emerald-600">{formatNumber(baseMetrics.confirmed)}</td><td className="py-4 px-4 text-right text-amber-600">{formatNumber(baseMetrics.pending)}</td><td className="py-4 px-4 text-right text-red-600">{formatNumber(baseMetrics.canceled)}</td><td className="py-4 pl-4 text-right">{formatNumber(baseMetrics.totalHours, 1)}h</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {rows.length === 0 && <EmptyState title="Nenhum registro" description="Ajuste os filtros para visualizar os dados." />}
    </ReportCard>
  );
}

function CoverageView({ rows }) {
  return (
    <div className="space-y-5">
      <ReportCard title="Cobertura operacional por setor">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
          {rows.map((row) => <CoverageBar key={row.name} label={row.name} value={row.coverage} />)}
        </div>
        {rows.length === 0 && <EmptyState title="Sem dados" description="Nenhum setor possui registros nos filtros selecionados." />}
      </ReportCard>

      <ReportCard title="Detalhamento por setor">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-4">Setor</th><th className="py-3 px-4 text-right">Total</th><th className="py-3 px-4 text-right">Confirmados</th><th className="py-3 px-4 text-right">Pendentes</th><th className="py-3 px-4 text-right">Cancelados</th><th className="py-3 px-4 text-right">Abertos</th><th className="py-3 pl-4 text-right">Cobertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-800 dark:text-slate-200">
              {rows.map((row) => (
                <tr key={row.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">{row.name}</td>
                  <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">{formatNumber(row.total)}</td>
                  <td className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-400 font-medium">{formatNumber(row.confirmed)}</td>
                  <td className="py-3 px-4 text-right text-amber-700 dark:text-amber-400 font-medium">{formatNumber(row.pending)}</td>
                  <td className="py-3 px-4 text-right text-red-700 dark:text-red-400 font-medium">{formatNumber(row.canceled)}</td>
                  <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">{formatNumber(row.open)}</td>
                  <td className="py-3 pl-4 text-right font-bold text-slate-900 dark:text-slate-100">{formatNumber(row.coverage, 1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportCard>
    </div>
  );
}

function RiskView({ rows }) {
  return (
    <ReportCard title="Painel de risco operacional" description="Indicadores internos de cobertura e pendência.">
      <div className="space-y-3 mt-4">
        {rows.map((row) => {
          const levelConfig = {
            regular: { label: 'Regular', className: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
            atencao: { label: 'Atenção', className: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
            critico: { label: 'Crítico', className: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' },
          }[row.level];
          return (
            <div key={row.name} className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
              <div className="flex-1">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{row.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{row.confirmed} confirmados de {row.total} registros</div>
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
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-sm text-amber-900 dark:text-amber-200">
            <strong>Dados financeiros incompletos.</strong> {formatNumber(data.missingRates)} registro(s) não possuem remuneração compatível. Esses registros foram desconsiderados do custo estimado.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard icon={BarChart3} label="Custo estimado" value={formatCurrency(data.estimatedCost)} description="Soma dos registros válidos" />
        <KpiCard icon={TrendingDown} label="Custo evitado" value={formatCurrency(data.canceledCost)} description="Valor de plantões cancelados" warning />
        <KpiCard icon={CheckCircle2} label="Com valor" value={formatNumber(data.knownRates)} description="Registros utilizados no cálculo" positive />
        <KpiCard icon={AlertTriangle} label="Sem valor" value={formatNumber(data.missingRates)} description="Não incluídos no cálculo" warning={data.missingRates > 0} />
      </div>

      <ReportCard title="Detalhamento financeiro">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-4">Profissional</th><th className="py-3 px-4">Setor</th><th className="py-3 px-4 text-right">Horas</th><th className="py-3 px-4 text-right">Valor Base</th><th className="py-3 pl-4 text-right">Custo Projetado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-800 dark:text-slate-200">
              {data.rows.map((row, index) => {
                const isCanceled = row.status === 'cancelado' || row.status === 'canceled';
                return (
                  <tr key={`${row.professional}-${index}`} className={`transition-colors ${isCanceled ? 'bg-red-50/30 hover:bg-red-50/50 dark:bg-red-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'}`}>
                    <td className={`py-3 pr-4 font-medium ${isCanceled ? 'text-red-700 dark:text-red-400 line-through opacity-70' : 'text-slate-900 dark:text-slate-100'}`}>
                      {row.professional}
                      {isCanceled && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 uppercase">Cancelado</span>}
                    </td>
                    <td className={`py-3 px-4 ${isCanceled ? 'text-red-400 line-through opacity-70' : 'text-slate-500 dark:text-slate-400'}`}>{row.sector}</td>
                    <td className={`py-3 px-4 text-right ${isCanceled ? 'text-red-400 line-through opacity-70' : ''}`}>{formatNumber(row.hours, 1)}h</td>
                    <td className={`py-3 px-4 text-right ${isCanceled ? 'text-red-400 line-through opacity-70' : ''}`}>{row.rate === null ? '—' : formatCurrency(row.rate)}</td>
                    <td className={`py-3 pl-4 text-right font-semibold ${isCanceled ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{isCanceled ? 'Cancelado' : (row.cost === null ? '—' : formatCurrency(row.cost))}</td>
                  </tr>
                );
              })}
            </tbody>
            {data.rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-800/50 font-black text-slate-900 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700">
                  <td className="py-4 pr-4">TOTAL ESTIMADO (EXCLUI CANCELADOS)</td><td /><td /><td /><td className="py-4 pl-4 text-right text-emerald-600">{formatCurrency(data.estimatedCost)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </ReportCard>
    </div>
  );
}

function CancellationView({ rows }) {
  return (
    <ReportCard title="Cancelamentos registrados">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
              <th className="py-3 pr-4">Data</th><th className="py-3 px-4">Profissional</th><th className="py-3 px-4">Setor</th><th className="py-3 pl-4">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-800 dark:text-slate-200">
            {rows.map((row, index) => (
              <tr key={`${row.date}-${index}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="py-3 pr-4">{formatDateBR(row.date)}</td><td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{row.professional}</td><td className="py-3 px-4 text-slate-500 dark:text-slate-400">{row.sector}</td><td className="py-3 pl-4 text-red-600 dark:text-red-400 font-medium">{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportCard>
  );
}

/* ============================================================
   UI AUXILIARES
   ============================================================ */

function ExecutiveMetric({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-xl font-bold mt-1 text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

function StatusLine({ label, value, type }) {
  const styles = {
    success: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    warning: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    danger: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
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
        <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-3">{label}</span>
        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{formatNumber(numeric, 1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${numeric}%` }} />
      </div>
    </div>
  );
}

function ReportPreviewModal({ reportPayload, reportHash, hashLoading, reportStatus, reportVersion, onClose, onPrint, onExport, onStatusChange }) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5">
      <div className="w-full h-full max-w-[1500px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="h-auto min-h-[68px] bg-slate-950 text-white px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center"><FileCheck2 className="w-5 h-5" /></div>
            <div>
              <div className="font-semibold text-sm">Pré-visualização oficial</div>
              <div className="text-[11px] text-slate-400">{reportPayload.reportId} • v{reportVersion}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={reportStatus} onValueChange={onStatusChange}>
              <SelectTrigger className="w-[145px] bg-white/10 border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Rascunho">Rascunho</SelectItem>
                <SelectItem value="Em revisão">Em revisão</SelectItem>
                <SelectItem value="Aprovado">Aprovado</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={onExport} className="gap-2 bg-transparent text-white border-white/20 hover:bg-white/10"><Download className="w-4 h-4" /> CSV</Button>
            <Button type="button" onClick={onPrint} className="gap-2 bg-sky-600 hover:bg-sky-500 border-0"><Printer className="w-4 h-4" /> Imprimir A4 / PDF</Button>
            <Button type="button" variant="ghost" onClick={onClose} className="text-white hover:bg-white/10"><X className="w-5 h-5" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}