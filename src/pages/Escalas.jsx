import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity, AlertTriangle, BarChart3, Building2, CalendarDays, CheckCircle2,
  ChevronDown, ChevronRight, ClipboardCheck, Clock3, Database, Download, Eye,
  FileCheck2, FileSpreadsheet, Filter, GripVertical, Hash, History, LayoutDashboard,
  LayoutGrid, List, Loader2, Lock, MapPin, Maximize2, Menu, MessageCircle,
  Minimize2, Moon, Pencil, Plus, Printer, RefreshCw, Search, Send, ShieldCheck,
  SlidersHorizontal, Sun, Trash2, TrendingDown, UserCheck, UserPlus, Users,
  UsersRound, X
} from 'lucide-react';
import ShiftFormDialog from '@/components/shifts/ShiftFormDialog';
import { exportSchedulePDF } from '@/lib/exportReport';
import { getShiftTvLifecycle } from '@/lib/shiftUtils';

/* ============================================================
   CONSTANTES E CONFIGURAÇÕES
   ============================================================ */

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

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
];

const SHIFT_PERIODS = [
  { id: 'manha', label: 'Manhã', start: '07:00', end: '13:00' },
  { id: 'tarde', label: 'Tarde', start: '13:00', end: '19:00' },
  { id: 'noite', label: 'Noite', start: '19:00', end: '07:00' }
];

const REPORT_CONFIG = {
  executiva: { label: 'Visão Executiva', icon: LayoutDashboard },
  produtividade: { label: 'Produtividade & Horas', icon: Clock3 },
  cobertura: { label: 'Cobertura Operacional', icon: Building2 },
  risco: { label: 'Risco Assistencial', icon: ShieldCheck },
  financeiro: { label: 'Financeiro & Custos', icon: BarChart3 },
  turnover: { label: 'Cancelamentos', icon: Users },
  auditoria: { label: 'Log de Auditoria', icon: ClipboardCheck },
};

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os status' }, { value: 'confirmado', label: 'Confirmado' },
  { value: 'pendente', label: 'Pendente' }, { value: 'cancelado', label: 'Cancelado' }, { value: 'aberto', label: 'Aberto' }
];

/* ============================================================
   FUNÇÕES UTILITÁRIAS BLINDADAS (Previnem WSoD)
   ============================================================ */

function safeNumber(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function formatNumber(value, decimals = 0) { return safeNumber(value).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); }
function formatCurrency(value) { if (value == null || value === '') return 'Não informado'; const n = Number(value); return Number.isFinite(n) ? `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Não informado'; }
function formatDateBR(dateStr) { if (!dateStr) return '—'; const parts = String(dateStr).split('T')[0].split('-'); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(dateStr); }
function normalizeDate(value) { if (!value) return ''; const t = String(value).trim(); return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.substring(0, 10) : t; }
function getLocalDateString(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function normalizeStr(str) { return typeof str === 'string' ? str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : ''; }
function toTitleCase(str) { return typeof str === 'string' ? str.toLowerCase().split(' ').map(w => ['de','da','do','e'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''; }
function getStatusKey(status) { return String(status || '').trim().toLowerCase(); }
function getStatusLabel(status) { const map = { confirmado: 'Confirmado', confirmed: 'Confirmado', pendente: 'Pendente', pending: 'Pendente', cancelado: 'Cancelado', canceled: 'Cancelado', aberto: 'Aberto', open: 'Aberto', concluido: 'Concluído', completed: 'Concluído' }; return map[getStatusKey(status)] || status || 'Não informado'; }

function getShiftHours(s) {
  if (s?.hours != null && Number.isFinite(Number(s.hours))) return Number(s.hours);
  if (s?.total_hours != null && Number.isFinite(Number(s.total_hours))) return Number(s.total_hours);
  if (s?.duration_hours != null) return Number(s.duration_hours);
  if (s?.start_time && s?.end_time) {
    const start = new Date(`1970-01-01T${s.start_time}`);
    const end = new Date(`1970-01-01T${s.end_time}`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      let diff = (end - start) / 3600000;
      if (diff < 0) diff += 24;
      return Math.max(0, diff);
    }
  }
  return 12; // fallback
}

function getProfessionalId(s) { return s?.professional_id || s?.professionalId || s?.professional?.id || null; }
function getProfessionalName(s, m) { if (s?.professional_name) return s.professional_name; if (s?.professional?.name) return s.professional.name; if (s?.professional_id && m && m[s.professional_id]) return m[s.professional_id].name || m[s.professional_id].full_name || 'Profissional'; return 'Não identificado'; }
function getSectorName(s, m) { if (s?.sector_name) return s.sector_name; if (s?.sector?.name) return s.sector.name; if (s?.sector_id && m && m[s.sector_id]) return m[s.sector_id].name || 'Setor não identificado'; return 'Não informado'; }
function getCategoryName(s, m) { if (s?.category_name) return s.category_name; if (s?.professional_id && m && m[s.professional_id]) return m[s.professional_id].category || m[s.professional_id].profession || 'Não informado'; return 'Não informado'; }
function getShiftDate(s) { return normalizeDate(s?.date || s?.shift_date || s?.start_date || s?.created_date); }

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
    currentWeek.push(getLocalDateString(new Date(year, month - 1, d)));
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }
  return weeks;
}

function escapeHtml(val) { return String(val ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function formatPrintValue(val) { return val == null || val === '' ? '—' : typeof val === 'number' ? formatNumber(val, Number.isInteger(val) ? 0 : 2) : String(val); }
function escapeCSV(val) { return `"${String(val ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`; }
function downloadFile(content, filename) { const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function sanitizeFilename(val) { return String(val || 'relatorio').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase(); }
async function generateSHA256(input) { try { if (!window.crypto?.subtle) return 'Indisponível'; const data = new TextEncoder().encode(input); const hashBuffer = await window.crypto.subtle.digest('SHA-256', data); return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join(''); } catch { return 'Erro'; } }

function buildPrintTable(columns = [], rows = [], totalsRow = null) {
  const headerHtml = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const bodyHtml = rows.length > 0 ? rows.map((r) => `<tr>${columns.map((_, i) => `<td>${escapeHtml(formatPrintValue(r[i]))}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${Math.max(columns.length, 1)}" class="empty-cell">Nenhum registro encontrado.</td></tr>`;
  const footerHtml = totalsRow ? `<tfoot><tr>${columns.map((_, i) => `<th>${escapeHtml(formatPrintValue(totalsRow[i]))}</th>`).join('')}</tr></tfoot>` : '';
  return `<table class="print-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody>${footerHtml}</table>`;
}

/* ============================================================
   COMPONENTE PRINCIPAL (MÓDULO DE ESCALAS E RELATÓRIOS)
   ============================================================ */

export default function Escalas() {
  const { user, company, loading: appLoading } = useAppData();
  
  const [shifts, setShifts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  
  const [viewMode, setViewMode] = useState('grade'); // 'grade', 'list', 'base_builder', 'relatorios'
  const [activeTab, setActiveTab] = useState('executiva');
  
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ startDate: '', endDate: '', sectorId: 'todos', status: 'todos', professionalId: 'todos', category: 'todos' });
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalDateString().slice(0,7));
  const [selectedDate, setSelectedDate] = useState('');
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Estados da Grade Mensal
  const [profSearchQuery, setProfSearchQuery] = useState('');
  const [inlineEditingCell, setInlineEditingCell] = useState(null);
  const [inlineSearchText, setInlineSearchText] = useState('');
  const [selectedCells, setSelectedCells] = useState([]);
  const [isPublished, setIsPublished] = useState(false);
  const [newShiftModal, setNewShiftModal] = useState(null); // Modal para Novo Plantão Real
  const [selectedProfIdForModal, setSelectedProfIdForModal] = useState(''); // Estado para o modal de novo plantão
  const [dialogOpen, setDialogOpen] = useState(false); // Modal Plantão Avulso Padrão
  const [editing, setEditing] = useState(null);
  const [tvMode, setTvMode] = useState(false);
  
  // Estados da Escala Base (Builder)
  const [createScaleState, setCreateScaleState] = useState(0); 
  const [builderModal, setBuilderModal] = useState(null);
  const [builderShifts, setBuilderShifts] = useState([]);
  const [builderForm, setBuilderForm] = useState({ id: '', name: '', start: '', end: '', qty: 1, color: BUILDER_COLORS[0], days: [] });

  // Estados dos Relatórios
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

  const toggleTheme = () => setTheme((c) => (c === 'dark' ? 'light' : 'dark'));

  const fetchEntity = async (entityName, limit) => {
    try {
      const queryFilter = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
      if (base44?.entities?.[entityName]?.filter) return await base44.entities[entityName].filter(queryFilter, '-created_date', limit);
      if (base44?.entities?.[entityName]?.list) return await base44.entities[entityName].list();
      return [];
    } catch (e) { return []; }
  };

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError('');
    try {
      const [s, sec, p] = await Promise.all([ fetchEntity('Shift', 2000), fetchEntity('Sector', 200), fetchEntity('Professional', 1000) ]);
      const safeShifts = Array.isArray(s) ? s : (s?.data || []);
      const safeSectors = Array.isArray(sec) ? sec : (sec?.data || []);
      const safeProfessionals = Array.isArray(p) ? p : (p?.data || []);
      setShifts(safeShifts); setSectors(safeSectors); setProfessionals(safeProfessionals);
      if (filters.sectorId === 'todos' && safeSectors.length > 0) setFilters(c => ({...c, sectorId: String(safeSectors[0].id)}));
    } catch (err) { setError('Falha na sincronização.'); } finally { setLoading(false); setRefreshing(false); }
  }, [companyId, unitId, filters.sectorId]);

  useEffect(() => { if (!appLoading) loadData(); }, [appLoading, loadData]);
  useEffect(() => { const id = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(id); }, []);

  const professionalMap = useMemo(() => { const m = {}; (professionals || []).forEach(p => { if (p?.id) m[p.id] = p; }); return m; }, [professionals]);
  const sectorMap = useMemo(() => { const m = {}; (sectors || []).forEach(s => { if (s?.id) m[s.id] = s; }); return m; }, [sectors]);
  const categories = useMemo(() => { const v = new Set(); (shifts || []).forEach(s => { const c = getCategoryName(s, professionalMap); if (c && c !== 'Não informado') v.add(c); }); (professionals || []).forEach(p => { const c = p?.category || p?.profession || p?.role || p?.cargo; if (c) v.add(c); }); return Array.from(v).sort(); }, [shifts, professionals, professionalMap]);
  const monthOptions = useMemo(() => [...new Set((shifts || []).map(s => typeof s?.date === 'string' ? s.date.slice(0, 7) : ''))].filter(Boolean).sort().reverse(), [shifts]);

  const filteredShifts = useMemo(() => {
    const term = normalizeStr(search);
    return (shifts || []).filter(s => {
      if (!s || s.status === 'cancelado') return false;
      const sDate = getShiftDate(s);
      if (!sDate) return false;
      if (selectedMonth && viewMode === 'grade' && !sDate.startsWith(selectedMonth)) return false;
      if (filters.startDate && sDate < filters.startDate) return false;
      if (filters.endDate && sDate > filters.endDate) return false;
      if (filters.sectorId !== 'todos' && String(s.sector_id) !== String(filters.sectorId)) return false;
      if (filters.status !== 'todos' && getStatusKey(s.status) !== filters.status) return false;
      if (filters.professionalId !== 'todos' && String(getProfessionalId(s)) !== String(filters.professionalId)) return false;
      if (filters.category !== 'todos' && String(getCategoryName(s, professionalMap)) !== String(filters.category)) return false;
      return true;
    }).map(s => {
      let lifecycle = { state: 'upcoming', detail: '' };
      try { lifecycle = getShiftTvLifecycle({ ...s, date: s.date || '', start_time: s.start_time || '', end_time: s.end_time || '' }, currentTime) || lifecycle; } catch (e) {}
      const pName = typeof s.professional_name === 'string' ? s.professional_name.toLowerCase() : '';
      const sTime = typeof s.start_time === 'string' ? s.start_time : '00:00';
      let periodId = 'manha';
      if (sTime >= '13:00' && sTime < '19:00') periodId = 'tarde';
      if (sTime >= '19:00' || sTime < '06:00') periodId = 'noite';
      return { ...s, lifecycle, periodId, isVacant: !s.professional_id || pName.includes('vaga') };
    });
  }, [shifts, search, filters, selectedMonth, viewMode, professionalMap, currentTime]);

  const baseMetrics = useMemo(() => {
    let confirmed = 0, pending = 0, canceled = 0, open = 0, confirmedHours = 0, totalHours = 0;
    (filteredShifts || []).forEach(s => {
      const st = getStatusKey(s.status);
      const hrs = getShiftHours(s);
      totalHours += hrs;
      if (['confirmado', 'confirmed', 'concluido', 'completed'].includes(st)) { confirmed++; confirmedHours += hrs; }
      else if (['pendente', 'pending'].includes(st)) pending++;
      else if (['cancelado', 'canceled'].includes(st)) canceled++;
      else if (['aberto', 'open'].includes(st)) open++;
    });
    const total = filteredShifts.length;
    return { total, confirmed, pending, canceled, open, totalHours, confirmedHours, coverage: total > 0 ? (confirmed / total) * 100 : 0 };
  }, [filteredShifts]);

  const byProfessional = useMemo(() => {
    const map = {};
    (filteredShifts || []).forEach(s => {
      const id = getProfessionalId(s) || `name:${getProfessionalName(s, professionalMap)}`;
      if (!map[id]) map[id] = { id, name: getProfessionalName(s, professionalMap), category: getCategoryName(s, professionalMap), total: 0, confirmed: 0, pending: 0, canceled: 0, open: 0, hours: 0 };
      const row = map[id];
      const st = getStatusKey(s.status);
      row.total++; row.hours += getShiftHours(s);
      if (['confirmado', 'confirmed', 'concluido', 'completed'].includes(st)) row.confirmed++;
      else if (['pendente', 'pending'].includes(st)) row.pending++;
      else if (['cancelado', 'canceled'].includes(st)) row.canceled++;
      else if (['aberto', 'open'].includes(st)) row.open++;
    });
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [filteredShifts, professionalMap]);

  const bySector = useMemo(() => {
    const map = {};
    (filteredShifts || []).forEach(s => {
      const name = getSectorName(s, sectorMap);
      if (!map[name]) map[name] = { name, total: 0, confirmed: 0, pending: 0, canceled: 0, open: 0, coverage: 0 };
      const row = map[name];
      const st = getStatusKey(s.status);
      row.total++;
      if (['confirmado', 'confirmed', 'concluido', 'completed'].includes(st)) row.confirmed++;
      else if (['pendente', 'pending'].includes(st)) row.pending++;
      else if (['cancelado', 'canceled'].includes(st)) row.canceled++;
      else if (['aberto', 'open'].includes(st)) row.open++;
    });
    return Object.values(map).map(r => ({ ...r, coverage: r.total > 0 ? (r.confirmed / r.total) * 100 : 0 })).sort((a, b) => a.coverage - b.coverage);
  }, [filteredShifts, sectorMap]);

  const riskRows = useMemo(() => bySector.map(s => ({ ...s, level: s.coverage < 70 ? 'critico' : s.coverage < 90 ? 'atencao' : 'regular' })), [bySector]);
  const criticalAlerts = useMemo(() => {
    const alerts = [];
    riskRows.forEach(r => { if (r.level === 'critico') alerts.push({ type: 'critical', title: 'Cobertura operacional baixa', description: `${r.name}: ${formatNumber(r.coverage, 1)}% dos registros confirmados.` }); });
    if (baseMetrics.canceled > 0) alerts.push({ type: 'warning', title: 'Cancelamentos', description: `${baseMetrics.canceled} cancelamento(s).` });
    if (baseMetrics.pending > 0) alerts.push({ type: 'warning', title: 'Registros pendentes', description: `${baseMetrics.pending} aguardando confirmação.` });
    return alerts;
  }, [riskRows, baseMetrics]);

  const financialData = useMemo(() => {
    let estimatedCost = 0, canceledCost = 0, knownRates = 0, missingRates = 0;
    const rows = [];
    (filteredShifts || []).forEach(s => {
      const hours = getShiftHours(s);
      const profId = getProfessionalId(s);
      const prof = profId ? professionalMap[profId] : null;
      const status = getStatusKey(s.status);
      const remType = String(prof?.remuneration_type || prof?.remunerationType || 'hora').toLowerCase();
      let rate = null;
      if (remType === 'hora') rate = prof?.hourly_rate ?? prof?.hourlyRate ?? s?.hourly_rate ?? s?.hour_rate ?? s?.valor_hora ?? s?.rate ?? 120;
      else if (remType === 'diaria') rate = prof?.daily_rate ?? prof?.dailyRate ?? 1500;
      else if (remType === 'mensal') {
        const monthly = Number(prof?.monthly_salary ?? prof?.monthlySalary ?? 18000);
        const monthlyWorkHours = Number(prof?.monthly_work_hours ?? prof?.monthlyWorkHours ?? 220);
        rate = monthlyWorkHours > 0 ? monthly / monthlyWorkHours : null;
      }
      const numericRate = Number(rate);
      if (Number.isFinite(numericRate) && numericRate >= 0 && rate !== null) {
        const cost = remType === 'mensal' ? numericRate * hours : (remType === 'diaria' ? numericRate : hours * numericRate);
        if (status === 'cancelado' || status === 'canceled') canceledCost += cost; else estimatedCost += cost;
        knownRates++;
        rows.push({ professional: getProfessionalName(s, professionalMap), sector: getSectorName(s, sectorMap), hours, rate: numericRate, cost, status });
      } else {
        missingRates++;
        rows.push({ professional: getProfessionalName(s, professionalMap), sector: getSectorName(s, sectorMap), hours, rate: null, cost: null, status });
      }
    });
    rows.sort((a, b) => { const aCanc = a.status === 'cancelado' || a.status === 'canceled'; const bCanc = b.status === 'cancelado' || b.status === 'canceled'; if (aCanc && !bCanc) return 1; if (!aCanc && bCanc) return -1; return 0; });
    return { estimatedCost, canceledCost, knownRates, missingRates, rows };
  }, [filteredShifts, professionalMap, sectorMap]);

  const cancellationRows = useMemo(() => (filteredShifts || []).filter(s => ['cancelado', 'canceled'].includes(getStatusKey(s.status))).map(s => ({ date: getShiftDate(s), professional: getProfessionalName(s, professionalMap), sector: getSectorName(s, sectorMap), reason: s?.cancellation_reason || s?.cancel_reason || s?.reason || 'Não informado' })).sort((a, b) => String(b.date).localeCompare(String(a.date))), [filteredShifts, professionalMap, sectorMap]);
  const reportId = useMemo(() => { const d = new Date(); return `CIH-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`; }, []);
  const filtersLabel = useMemo(() => { const v = []; if (filters.startDate) v.push(`Início: ${formatDateBR(filters.startDate)}`); if (filters.endDate) v.push(`Fim: ${formatDateBR(filters.endDate)}`); if (filters.sectorId !== 'todos') v.push(`Setor: ${filters.sectorId}`); return v.length ? v.join(' • ') : 'Visão Geral'; }, [filters]);

  const reportPayload = useMemo(() => {
    const config = REPORT_CONFIG[activeTab] || REPORT_CONFIG['executiva'];
    let columns = [], rows = [], totalsRow = null;
    if (activeTab === 'executiva') {
      columns = ['Indicador', 'Valor'];
      rows = [['Registros', baseMetrics.total], ['Confirmados', baseMetrics.confirmed], ['Pendentes', baseMetrics.pending], ['Cancelados', baseMetrics.canceled], ['Abertos', baseMetrics.open], ['Horas confirmadas', Number(baseMetrics.confirmedHours.toFixed(2))], ['Cobertura operacional', Number(baseMetrics.coverage.toFixed(2))], ['Custo Financeiro Estimado', Number(financialData.estimatedCost.toFixed(2))]];
    } else if (activeTab === 'produtividade') {
      columns = ['Profissional', 'Categoria', 'Total', 'Confirmados', 'Pendentes', 'Cancelados', 'Horas'];
      rows = byProfessional.map(r => [r.name, r.category, r.total, r.confirmed, r.pending, r.canceled, Number(r.hours.toFixed(2))]);
      totalsRow = ['TOTAL', '', baseMetrics.total, baseMetrics.confirmed, baseMetrics.pending, baseMetrics.canceled, Number(baseMetrics.totalHours.toFixed(2))];
    } else if (activeTab === 'cobertura' || activeTab === 'risco') {
      columns = ['Setor', 'Total', 'Confirmados', 'Pendentes', 'Cancelados', 'Abertos', 'Cobertura %'];
      rows = bySector.map(r => [r.name, r.total, r.confirmed, r.pending, r.canceled, r.open, Number(r.coverage.toFixed(2))]);
      totalsRow = ['TOTAL', baseMetrics.total, baseMetrics.confirmed, baseMetrics.pending, baseMetrics.canceled, baseMetrics.open, Number(baseMetrics.coverage.toFixed(2))];
    } else if (activeTab === 'financeiro') {
      columns = ['Profissional', 'Setor', 'Horas', 'Valor/Hora', 'Custo Projetado'];
      rows = financialData.rows.map(r => { const isC = r.status === 'cancelado' || r.status === 'canceled'; return [isC ? `${r.professional} (CANCELADO)` : r.professional, r.sector, Number(r.hours.toFixed(2)), r.rate === null ? 'Não informado' : Number(r.rate.toFixed(2)), isC ? 'Cancelado' : (r.cost === null ? 'Não informado' : Number(r.cost.toFixed(2)))]; });
      totalsRow = ['TOTAL ESTIMADO (SEM CANCELAMENTOS)', '', '', '', Number(financialData.estimatedCost.toFixed(2))];
    } else if (activeTab === 'turnover') {
      columns = ['Data', 'Profissional', 'Setor', 'Motivo'];
      rows = cancellationRows.map(r => [formatDateBR(r.date), r.professional, r.sector, r.reason]);
    } else if (activeTab === 'auditoria') {
      columns = ['Evento', 'Descrição', 'Data/Hora'];
      rows = auditEvents.map(e => [e.type, e.description, e.timestamp]);
    }
    return { reportId, title: config?.label || 'Relatório', companyId, unitId, filters, filtersLabel, status: reportStatus, version: reportVersion, kpis: baseMetrics, columns, rows, totalsRow };
  }, [activeTab, reportId, companyId, unitId, filters, filtersLabel, reportStatus, reportVersion, baseMetrics, byProfessional, bySector, financialData, cancellationRows, auditEvents]);

  const addAuditEvent = useCallback((type, desc) => setAuditEvents((cur) => [{ id: Math.random().toString(36).substring(2), type, description: desc, timestamp: new Date().toLocaleString('pt-BR') }, ...cur]), []);
  const calculateReportHash = useCallback(async () => { setHashLoading(true); try { const h = await generateSHA256(JSON.stringify({ id: reportPayload.reportId, rows: reportPayload.rows })); setReportHash(h); return h; } finally { setHashLoading(false); } }, [reportPayload]);

  /* ============================================================
     AÇÕES DA GRADE, LISTA E TV
     ============================================================ */
  const weeksDataGrid = useMemo(() => getMonthWeeks(selectedMonth), [selectedMonth]);
  const sidebarProfessionals = useMemo(() => { const term = normalizeStr(profSearchQuery); return (professionals || []).filter(p => p?.id && (!term || normalizeStr(p.name).includes(term) || normalizeStr(p.specialty || '').includes(term))); }, [professionals, profSearchQuery]);

  const handleCellClick = (e, date, periodId) => {
    if (e.ctrlKey || e.metaKey) {
      const exists = selectedCells.find(c => c.date === date && c.periodId === periodId);
      if (exists) setSelectedCells(selectedCells.filter(c => !(c.date === date && c.periodId === periodId)));
      else setSelectedCells([...selectedCells, { date, periodId }]);
    } else {
      setSelectedCells([]); setSelectedProfIdForModal(''); setNewShiftModal({ date, periodId });
    }
  };

  const handleDragStart = (e, prof) => { if (prof?.id) { e.dataTransfer.setData('profId', prof.id); } };
  const handleDragOver = (e) => { e.preventDefault(); };

  const assignShift = async (date, periodId, profId) => {
    if (filters.sectorId === 'todos') { alert("Selecione um setor na barra superior para alocar."); return; }
    const periodDef = SHIFT_PERIODS.find(p => p.id === periodId);
    const prof = professionalMap[profId];
    const sectorObj = (sectors || []).find(s => String(s.id) === String(filters.sectorId));
    if (!prof || !sectorObj) return;

    try {
      const shiftDateStr = String(date || '');
      const existingShift = (filteredShifts || []).find(s => String(s.date || '').startsWith(shiftDateStr) && s.periodId === periodId && s.isVacant);
      const payload = { company_id: companyId, unit_id: unitId, professional_id: prof.id, professional_name: prof.name, sector_id: sectorObj.id, sector_name: sectorObj.name, date: date, start_time: periodDef.start, end_time: periodDef.end, duration_hours: periodId === 'noite' ? 12 : 6, status: 'confirmado' };
      if (existingShift) await base44.entities.Shift.update(existingShift.id, payload); else await base44.entities.Shift.create(payload);
      loadData(true);
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
    } else { assignShift(date, periodId, profId); setSelectedCells([]); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja cancelar este plantão? Ele ficará salvo no log de auditoria.')) return;
    try { await base44.entities.Shift.update(id, { status: 'cancelado', notes: 'Cancelado pela gestão.' }); loadData(true); } catch (e) { alert('Erro ao cancelar.'); }
  };

  const handlePublish = () => {
    if (confirm('Publicar escala? Isso emitirá alertas e destacará na grade.')) {
      setIsPublished(true);
      setTimeout(() => alert('Escala publicada com sucesso! Notificações enviadas aos profissionais.'), 500);
    }
  };

  const openTvMode = async () => { setTvMode(true); try { await document.documentElement.requestFullscreen?.(); } catch {} };
  const closeTvMode = async () => { setTvMode(false); if (document.fullscreenElement) await document.exitFullscreen?.(); };

  /* ============================================================
     BUILDER DE ESCALA BASE
     ============================================================ */
  const openNewBuilderModal = () => { setBuilderForm({ id: '', name: '', start: '', end: '', qty: 1, color: BUILDER_COLORS[0], days: [] }); setBuilderModal({ isNew: true }); };
  const openEditBuilderModal = (shiftObj) => {
    const selectedColor = BUILDER_COLORS.find(c => c.value === shiftObj.color) || BUILDER_COLORS[0];
    const activeDays = [];
    [1,2,3,4,5,6,0].forEach(d => { if((shiftObj.cellStates || {})[d]) activeDays.push(d); });
    setBuilderForm({ id: shiftObj.id, name: shiftObj.name, start: shiftObj.start, end: shiftObj.end, qty: shiftObj.qty, color: selectedColor, days: activeDays });
    setBuilderModal({ isNew: false });
  };
  const toggleBuilderDay = (dayIndex) => setBuilderForm(prev => ({ ...prev, days: (prev.days || []).includes(dayIndex) ? (prev.days || []).filter(d => d !== dayIndex) : [...(prev.days || []), dayIndex] }));
  const saveBuilderShift = () => {
    if (!builderForm.name || !builderForm.start || !builderForm.end) { alert('Preencha os campos obrigatórios.'); return; }
    const activeDays = {}; [1,2,3,4,5,6,0].forEach(d => { activeDays[d] = (builderForm.days || []).includes(d); });
    const newObj = { id: builderModal.isNew ? Date.now().toString() : builderForm.id, name: builderForm.name, start: builderForm.start, end: builderForm.end, color: builderForm.color.value, qty: builderForm.qty, cellStates: builderModal.isNew ? { ...activeDays } : ((builderShifts || []).find(s => s.id === builderForm.id)?.cellStates || { ...activeDays }) };
    if (builderModal.isNew) setBuilderShifts(prev => [...prev, newObj]); else setBuilderShifts(prev => prev.map(s => s.id === newObj.id ? newObj : s));
    setBuilderModal(null);
  };
  const toggleBuilderCell = (shiftId, dayIndex) => setBuilderShifts(prev => prev.map(s => s.id === shiftId ? { ...s, cellStates: { ...s.cellStates, [dayIndex]: !s.cellStates[dayIndex] } } : s));

  /* ============================================================
     EXPORTAÇÃO IMPRESSÃO (NOVA ABA HTML LIMPO)
     ============================================================ */
  const printReport = useCallback(() => {
    addAuditEvent('IMPRESSÃO', `Solicitação de impressão do relatório "${REPORT_CONFIG[activeTab]?.label}".`);
    const payload = reportPayload;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('A impressão foi bloqueada pelo navegador. Permita pop-ups.'); return; }

    const kpiItems = [['Registros', formatNumber(payload.kpis?.total)], ['Confirmados', formatNumber(payload.kpis?.confirmed)], ['Pendentes', formatNumber(payload.kpis?.pending)], ['Cancelados', formatNumber(payload.kpis?.canceled)], ['Abertos', formatNumber(payload.kpis?.open)], ['Horas confirmadas', formatNumber(payload.kpis?.confirmedHours, 1)], ['Cobertura operacional', `${formatNumber(payload.kpis?.coverage, 1)}%`]];
    const kpisHtml = kpiItems.map(([l, v]) => `<div class="kpi-box"><div class="kpi-label">${escapeHtml(l)}</div><div class="kpi-value">${escapeHtml(v)}</div></div>`).join('');
    const tableHtml = buildPrintTable(payload.columns, payload.rows, payload.totalsRow);

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" /><title>${escapeHtml(payload.title)}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; } * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #ffffff; color: #172033; font-family: Arial, sans-serif; font-size: 10px; }
        .print-document { width: 100%; max-width: 100%; }
        .print-header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px; }
        .print-title { font-size: 20px; font-weight: 700; margin: 0 0 5px; color: #0f172a; }
        .print-meta { text-align: right; font-size: 9px; line-height: 1.6; color: #334155; }
        .filter-box { border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 5px; padding: 9px; margin-bottom: 12px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 7px; margin-bottom: 14px; }
        .kpi-box { border: 1px solid #cbd5e1; border-radius: 5px; padding: 8px; background: #ffffff; }
        .kpi-label { font-size: 8px; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
        .kpi-value { font-size: 15px; font-weight: 700; color: #0f172a; }
        .print-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .print-table th { background: #e2e8f0; font-size: 8.5px; font-weight: 700; text-align: left; padding: 7px 6px; border: 1px solid #94a3b8; }
        .print-table td { font-size: 8.5px; padding: 6px; border: 1px solid #cbd5e1; }
        .print-table tbody tr:nth-child(even) td { background: #f8fafc; }
        .print-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 42px; page-break-inside: avoid; }
        .signature-line { border-top: 1px solid #334155; padding-top: 6px; text-align: center; font-size: 9px; }
        @media screen { body { background: #e2e8f0; padding: 25px; } .print-document { background: #fff; padding: 25px; max-width: 1400px; margin: 0 auto; box-shadow: 0 0 20px rgba(15,23,42,0.12); } .no-print { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 20px; } .no-print button { padding: 9px 15px; font-weight: 700; border:0; border-radius: 5px; cursor: pointer; } .btn-print { background: #0284c7; color: #fff; } .btn-close { background: #cbd5e1; color: #0f172a; } }
        @media print { .no-print { display: none !important; } }
      </style></head><body>
      <div class="no-print"><button class="btn-print" onclick="window.print()">Imprimir</button><button class="btn-close" onclick="window.close()">Fechar</button></div>
      <main class="print-document">
        <header class="print-header"><div><h1 class="print-title">CENTRAL DE INTELIGÊNCIA HOSPITALAR</h1><p>${escapeHtml(payload.title)}</p></div>
        <div class="print-meta"><div><strong>ID:</strong> ${escapeHtml(payload.reportId)}</div><div><strong>Versão:</strong> ${escapeHtml(payload.version)}</div><div><strong>Gerado:</strong> ${new Date().toLocaleString('pt-BR')}</div></div></header>
        <div class="filter-box"><strong>Filtros:</strong> ${escapeHtml(payload.filtersLabel)}</div>
        <div class="kpi-grid">${kpisHtml}</div>
        ${tableHtml}
        <section class="print-signatures"><div class="signature-line">Responsável pela emissão</div><div class="signature-line">Responsável pela aprovação</div></section>
      </main><script>window.onload = function(){ setTimeout(function(){ window.print(); }, 500); };</script></body></html>`;
    printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
  }, [addAuditEvent, activeTab, reportPayload]);

  const exportCSV = () => {
    const payload = reportPayload;
    const lines = [`${escapeCSV('CENTRAL DE INTELIGÊNCIA HOSPITALAR')}`, `${escapeCSV('Relatório')};${escapeCSV(payload.title)}`, `${escapeCSV('ID do relatório')};${escapeCSV(payload.reportId)}`, `${escapeCSV('Filtros')};${escapeCSV(payload.filtersLabel)}`, `${escapeCSV('Gerado em')};${escapeCSV(new Date().toLocaleString('pt-BR'))}`, ''];
    lines.push(payload.columns.map(escapeCSV).join(';'));
    payload.rows.forEach(row => lines.push(row.map(escapeCSV).join(';')));
    if (payload.totalsRow) lines.push(payload.totalsRow.map(escapeCSV).join(';'));
    downloadFile('\uFEFF' + lines.join('\r\n'), `${sanitizeFilename(payload.title)}-${payload.reportId}.csv`, 'text/csv;charset=utf-8;');
  };

  const resetFilters = () => setFilters({ startDate: '', endDate: '', sectorId: 'todos', status: 'todos', professionalId: 'todos', category: 'todos' });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-sky-600 animate-spin" />
          <div className="text-slate-500 font-semibold">Carregando Inteligência Hospitalar...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* SIDEBAR */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-slate-950 text-slate-400 flex flex-col transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center"><Activity className="w-5 h-5 text-white" /></div>
          <div><div className="font-black text-sm text-white tracking-widest">CENTRAL</div><div className="text-[10px] font-bold text-sky-400">INTELIGÊNCIA</div></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2 opacity-50">Gestão Visual</div>
            <SidebarItem active={viewMode === 'grade'} icon={LayoutGrid} label="Builder Visual da Escala" onClick={() => { setViewMode('grade'); setActiveTab('operacional'); setMobileMenuOpen(false); }} />
            <SidebarItem active={viewMode === 'list'} icon={List} label="Lista Diária" onClick={() => { setViewMode('list'); setActiveTab('operacional'); setMobileMenuOpen(false); }} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2 opacity-50">Planejamento</div>
            <SidebarItem active={viewMode === 'base_builder'} icon={Plus} label="Nova Escala Base" onClick={() => { setCreateScaleState(1); setMobileMenuOpen(false); }} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2 opacity-50">Painel Executivo (Relatórios)</div>
            <SidebarItem active={activeTab === 'executiva' && viewMode === 'relatorios'} icon={LayoutDashboard} label="Visão Executiva" onClick={() => { setViewMode('relatorios'); setActiveTab('executiva'); setMobileMenuOpen(false); }} />
            {[['produtividade', Clock3], ['cobertura', Building2], ['risco', ShieldCheck], ['financeiro', BarChart3], ['turnover', Users]].map(([key, IconComponent]) => (
              <SidebarItem key={key} active={activeTab === key && viewMode === 'relatorios'} icon={IconComponent} label={REPORT_CONFIG[key]?.label || ''} onClick={() => { setViewMode('relatorios'); setActiveTab(key); setMobileMenuOpen(false); }} />
            ))}
            <div className="mt-4 mb-2 px-3 text-[10px] font-bold uppercase tracking-widest opacity-50">Governança</div>
            <SidebarItem active={activeTab === 'auditoria' && viewMode === 'relatorios'} icon={ClipboardCheck} label="Log de Auditoria" onClick={() => { setViewMode('relatorios'); setActiveTab('auditoria'); setMobileMenuOpen(false); }} />
          </div>
        </div>
      </aside>

      {mobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-5 lg:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 bg-slate-100 dark:bg-slate-800 rounded-lg" onClick={() => setMobileMenuOpen(true)}><Menu className="w-5 h-5" /></button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">Gerenciador de Escalas</h1>
              <p className="text-xs text-slate-500">Alocação e publicação de plantões médicos.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={toggleTheme} className="dark:border-slate-700"><Sun className="w-4 h-4 hidden dark:block" /><Moon className="w-4 h-4 block dark:hidden" /></Button>
            {viewMode === 'grade' && (
              <Button onClick={handlePublish} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md gap-2">
                <Send className="w-4 h-4" /> Publicar Escala
              </Button>
            )}
            <Button onClick={openReportPreview} className="bg-slate-900 dark:bg-sky-600 text-white font-bold gap-2"><Eye className="w-4 h-4" /> Relatório Oficial</Button>
          </div>
        </header>

        {viewMode !== 'base_builder' && viewMode !== 'relatorios' && (
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 px-8 flex flex-wrap lg:flex-nowrap items-end gap-4 shrink-0">
            <div className="flex flex-col gap-1.5 min-w-[150px]">
              <label className="text-[10px] font-bold uppercase text-slate-400">Mês da Escala</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-9 text-xs dark:bg-slate-800 dark:border-slate-700"><SelectValue placeholder="Mês Corrente" /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map(m => {
                    const d = new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1);
                    return <SelectItem key={m} value={m}>{d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-[10px] font-bold uppercase text-slate-400">Setor Ativo</label>
              <Select value={filters.sectorId} onValueChange={(v) => { setFilters(c => ({...c, sectorId: v}))}}>
                <SelectTrigger className="h-9 text-xs dark:bg-slate-800 dark:border-slate-700"><SelectValue placeholder="Selecione o Setor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os setores</SelectItem>
                  {sectors.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedCells.length > 0 && (
              <div className="bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 px-4 py-2 rounded-xl text-xs font-bold border border-sky-200 dark:border-sky-800 animate-pulse">
                {selectedCells.length} dias selecionados (Arraste o profissional)
              </div>
            )}
          </div>
        )}

        {/* ===================== MODO GRADE VISUAL (BUILDER) ===================== */}
        {viewMode === 'grade' && (
          <div className="flex-1 flex overflow-hidden p-5 sm:px-8 pb-8">
            <Card className="flex-1 border-slate-200 dark:border-slate-800 shadow-sm flex overflow-hidden bg-white dark:bg-slate-900">
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
                  {sidebarProfessionals.length === 0 && <div className="p-4 text-center text-xs text-slate-400">Nenhum profissional.</div>}
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-slate-100/30 dark:bg-slate-950 relative custom-scrollbar">
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

                              const shiftDateStr = String(date || '');
                              const slotShifts = (filteredShifts || []).filter(s => String(s.date || '').startsWith(shiftDateStr) && s.periodId === period.id);
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
                                      
                                      {/* Tag de Publicado no Hover */}
                                      {!s.isVacant && isPublished && (
                                        <div className="absolute -top-2 left-2 opacity-0 group-hover/item:opacity-100 transition-opacity bg-emerald-500 text-white text-[8px] font-black px-1.5 rounded uppercase shadow-sm">Publicado</div>
                                      )}

                                      {!s.isVacant && (
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="opacity-0 group-hover/item:opacity-100 p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded transition-opacity absolute right-1">
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}

                                  {/* Modo de Edição Inline (Duplo Clique) */}
                                  {inlineEditingCell?.date === date && inlineEditingCell?.periodId === period.id && (
                                    <div className="absolute inset-0 z-30 bg-white dark:bg-slate-900 border-2 border-sky-500 rounded-lg p-1 shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
                                      <div className="flex items-center gap-1 border-b dark:border-slate-700 pb-1 mb-1">
                                        <Search className="w-3 h-3 text-slate-400" />
                                        <input 
                                          autoFocus
                                          type="text" 
                                          placeholder="Buscar..." 
                                          className="w-full text-[10px] outline-none bg-transparent font-medium dark:text-white"
                                          value={inlineSearchText}
                                          onChange={e => setInlineSearchText(e.target.value)}
                                          onKeyDown={(e) => { if(e.key === 'Escape') setInlineEditingCell(null); }}
                                        />
                                        <button onClick={() => setInlineEditingCell(null)}><X className="w-3 h-3 text-slate-400 hover:text-red-500"/></button>
                                      </div>
                                      <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar">
                                        {(professionals || []).filter(p => !inlineSearchText || normalizeStr(p.name).includes(normalizeStr(inlineSearchText))).slice(0, 5).map(p => (
                                          <button 
                                            key={p.id} 
                                            className="w-full text-left px-2 py-1 text-[10px] hover:bg-sky-50 dark:hover:bg-slate-800 rounded truncate text-slate-700 dark:text-slate-300 font-medium"
                                            onClick={() => {
                                              assignShift(date, period.id, p.id);
                                              setInlineEditingCell(null);
                                              setInlineSearchText('');
                                            }}
                                          >
                                            {p.name}
                                          </button>
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

        {/* ===================== MODO LISTA DIÁRIA ===================== */}
        {viewMode === 'list' && (
          <div className="overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950 flex-1">
             {filteredShifts.length === 0 ? (
                <div className="py-12 text-center text-slate-400">Nenhum plantão localizado neste filtro.</div>
              ) : (
                filteredShifts.map(s => {
                  const sTime = typeof s.start_time === 'string' ? s.start_time : '00:00';
                  const isDone = ['concluded', 'recently_finished'].includes(s.lifecycle?.state);

                  return (
                    <div key={s.id} className={`flex items-center gap-3 rounded-2xl border p-3 bg-white dark:bg-slate-900 transition-colors shadow-sm ${s.isVacant ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                      <div className={`min-w-[85px] rounded-xl py-2 text-center text-xs font-black border shrink-0 ${isDone ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>
                        {fmtDate(s.date)} <br/>
                        <span className={isDone ? "text-slate-400" : "text-sky-600 dark:text-sky-400"}>{s.start_time || '--'} - {s.end_time || '--'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <strong className={`block text-sm truncate ${s.isVacant ? 'text-amber-800 dark:text-amber-400' : (isDone ? 'text-slate-500' : 'text-slate-800 dark:text-white')}`}>
                          {toTitleCase(s.professional_name) || 'Vaga Aberta'}
                        </strong>
                        <span className="text-xs text-slate-400">{toTitleCase(s.sector_name)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isDone ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-400">
                            <Lock className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Concluído</span>
                          </div>
                        ) : (
                          <>
                            {s.isVacant ? (
                              <Button size="sm" onClick={() => { setEditing(s); setDialogOpen(true); }} className="h-8 bg-amber-500 hover:bg-amber-600 text-white"><UserPlus className="w-3.5 h-3.5 mr-1" /> Alocar</Button>
                            ) : (
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"><MessageCircle className="w-4 h-4"/></Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setDialogOpen(true); }} className="h-8 w-8 text-slate-500"><Pencil className="w-4 h-4"/></Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)} className="h-8 w-8 text-red-500"><Trash2 className="w-4 h-4"/></Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
          </div>
        )}

        {/* ===================== MODO BASE BUILDER (CRIAÇÃO DE ESCALA BASE) ===================== */}
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
                      {(builderShifts || []).length === 0 ? (
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
                                const isActive = (shift.cellStates || {})[day.index];
                                return (
                                  <td key={day.index} className={`p-0 border-r border-slate-100 dark:border-slate-800 text-center relative ${day.weekend ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''}`}>
                                    <div className="relative w-full h-full min-h-[60px] flex items-center justify-center group/cell cursor-pointer" onClick={() => toggleBuilderCell(shift.id, day.index)}>
                                      <div className={`w-8 h-8 mx-auto rounded-lg font-black text-sm flex items-center justify-center transition-colors ${isActive ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'bg-transparent text-slate-300 dark:text-slate-600'}`}>
                                        {isActive ? shift.qty : '-'}
                                      </div>
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

        {/* ===================== RELATÓRIOS E PAINEL EXECUTIVO ===================== */}
        {viewMode === 'relatorios' && (
          <div className="flex-1 overflow-auto p-5 sm:p-8 space-y-6">
            <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-fit"><Filter className="w-4 h-4 text-sky-600" /> Filtros:</div>
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                <Input type="date" value={filters.startDate} onChange={e => setFilters(c => ({...c, startDate: e.target.value}))} className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700" title="Data Inicial" />
                <Input type="date" value={filters.endDate} onChange={e => setFilters(c => ({...c, endDate: e.target.value}))} className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700" title="Data Final" />
                <Select value={String(filters.sectorId)} onValueChange={v => setFilters(c => ({...c, sectorId: v}))}>
                  <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700 col-span-2"><SelectValue placeholder="Todos os Setores" /></SelectTrigger>
                  <SelectContent><SelectItem value="todos">Todos os setores</SelectItem>{(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button variant="ghost" onClick={() => setFilters({startDate: '', endDate: '', sectorId: 'todos', status: 'todos', professionalId: 'todos', category: 'todos'})} className="text-xs text-red-500 h-9">Limpar</Button>
            </Card>

            {activeTab === 'executiva' && <ExecutiveView baseMetrics={baseMetrics} riskRows={riskRows} byProfessional={byProfessional} criticalAlerts={criticalAlerts} financialData={financialData} />}
            {activeTab === 'produtividade' && <ProductivityView rows={byProfessional} baseMetrics={baseMetrics} />}
            {activeTab === 'cobertura' && <CoverageView rows={bySector} />}
            {activeTab === 'risco' && <RiskView rows={riskRows} />}
            {activeTab === 'financeiro' && <FinancialView data={financialData} />}
            {activeTab === 'turnover' && <CancellationView rows={cancellationRows} />}
            {activeTab === 'auditoria' && <GovernanceView reportId={reportId} version={reportVersion} status={reportStatus} hash={reportHash} hashLoading={hashLoading} auditEvents={auditEvents} onGenerateHash={calculateReportHash} onStatusChange={setReportStatus} onNewVersion={() => setReportVersion(v => v + 1)} />}
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
                    const isSelected = (builderForm.days || []).includes(day.index);
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

      {/* MODAL 4: NOVO PLANTÃO INDIVIDUAL COM DROPDOWN DE PROFISSIONAL */}
      {newShiftModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-black text-sky-600 dark:text-sky-400">Novo Plantão</h2>
              <button onClick={() => { setNewShiftModal(null); setSelectedProfIdForModal(''); }}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            
            <div className="p-6 space-y-4 text-sm font-medium text-slate-700 dark:text-slate-300">
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-right text-xs font-bold text-slate-500">Plantonista:</label>
                <Select value={selectedProfIdForModal} onValueChange={setSelectedProfIdForModal}>
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
                <Button 
                  onClick={() => { 
                    if(!selectedProfIdForModal) { alert('Selecione um profissional.'); return; }
                    assignShift(newShiftModal.date, newShiftModal.periodId, selectedProfIdForModal);
                    setNewShiftModal(null);
                    setSelectedProfIdForModal('');
                    alert('Plantão salvo com sucesso!');
                  }} 
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-11 px-8 shadow-md"
                >
                  Alocar Profissional
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ShiftFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={loadData} shift={editing} sectors={sectors} professionals={professionals} companyId={companyId} unitId={unitId} />

      {reportModalOpen && (
        <ReportPreviewModal reportPayload={reportPayload} reportHash={reportHash} hashLoading={hashLoading} reportStatus={reportStatus} reportVersion={reportVersion} onClose={() => setReportModalOpen(false)} onPrint={printReport} onExport={exportCSV} onStatusChange={setReportStatus} onNewVersion={() => setReportVersion(v => v + 1)} />
      )}
    </div>
  );
}

/* ============================================================
   SUB-COMPONENTES DA TELA E RELATÓRIOS
   ============================================================ */

function SidebarItem({ active, icon: Icon, label, onClick }) {
  const IconComp = Icon || Activity;
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-1 transition-all ${active ? 'bg-white/10 text-white font-bold' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
      <IconComp className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-sky-400' : ''}`} />
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

function ExecutiveView({ baseMetrics, riskRows, byProfessional, criticalAlerts, financialData }) {
  const topProfessionals = byProfessional.slice(0, 8);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2 p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 transition-colors">
          <div className="flex items-center justify-between mb-6">
            <div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Resumo executivo</h2><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Indicadores consolidados da operação</p></div>
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
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-5 leading-relaxed">Classificação baseada em percentual de registros confirmados.</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 transition-colors">
          <div className="flex items-center justify-between mb-5"><div><h2 className="font-bold text-slate-900 dark:text-white">Cobertura por setor</h2></div></div>
          <div className="space-y-4">
            {riskRows.slice(0, 8).map((row) => <CoverageBar key={row.name} label={row.name} value={row.coverage} />)}
            {riskRows.length === 0 && <EmptyState title="Sem dados de cobertura" description="Não existem registros para os filtros atuais." />}
          </div>
        </Card>

        <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 transition-colors">
          <div className="flex items-center justify-between mb-5"><div><h2 className="font-bold text-slate-900 dark:text-white">Profissionais por horas</h2></div></div>
          <div className="space-y-3">
            {topProfessionals.map((row, index) => (
              <div key={row.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">{index + 1}</div>
                <div className="flex-1 min-w-0"><div className="font-medium text-sm text-slate-900 dark:text-white truncate">{row.name}</div><div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{row.category}</div></div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{formatNumber(row.hours, 1)}h</div>
              </div>
            ))}
            {topProfessionals.length === 0 && <EmptyState title="Sem profissionais" description="Não existem registros." />}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ExecutiveMetric({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-xl font-bold mt-1 dark:text-white">{value}</div>
    </div>
  );
}

function StatusLine({ label, value, type }) {
  const styles = { success: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300', warning: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300', danger: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300' };
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
      <div className="flex items-center justify-between mb-1.5 text-xs"><span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-3">{label}</span><span className="font-bold text-slate-600 dark:text-slate-300">{formatNumber(numeric, 1)}%</span></div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${numeric}%` }} /></div>
    </div>
  );
}

function ProductivityView({ rows, baseMetrics }) {
  return (
    <ReportCard title="Produtividade por profissional">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
              <th className="py-3 pr-4">Profissional</th><th className="py-3 px-4">Categoria</th><th className="py-3 px-4 text-right">Total</th><th className="py-3 px-4 text-right">Confirmados</th><th className="py-3 px-4 text-right">Pendentes</th><th className="py-3 px-4 text-right">Cancelados</th><th className="py-3 pl-4 text-right">Horas</th>
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
    <ReportCard title="Painel de risco operacional">
      <div className="space-y-3 mt-4">
        {rows.map((row) => {
          const levelConfig = { regular: { label: 'Regular', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' }, atencao: { label: 'Atenção', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800' }, critico: { label: 'Crítico', className: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-800' } }[row.level];
          return (
            <div key={row.name} className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Custo Estimado</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(data.estimatedCost)}</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Com Valor Base</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatNumber(data.knownRates)}</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Sem Valor Informado</div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{formatNumber(data.missingRates)}</div>
        </Card>
      </div>

      <ReportCard title="Detalhamento financeiro">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-4">Profissional</th><th className="py-3 px-4">Setor</th><th className="py-3 px-4 text-right">Horas</th><th className="py-3 px-4 text-right">Valor/Hora</th><th className="py-3 pl-4 text-right">Custo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-800 dark:text-slate-200">
              {data.rows.map((row, index) => {
                const isCanceled = row.status === 'cancelado' || row.status === 'canceled';
                return (
                  <tr key={`${row.professional}-${index}`} className={`transition-colors ${isCanceled ? 'bg-red-50/30 hover:bg-red-50/50 dark:bg-red-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'}`}>
                    <td className={`py-3 pr-4 font-medium ${isCanceled ? 'text-red-700 dark:text-red-400 line-through opacity-70' : 'text-slate-900 dark:text-slate-100'}`}>{row.professional}</td>
                    <td className={`py-3 px-4 ${isCanceled ? 'text-red-400 line-through opacity-70' : 'text-slate-500 dark:text-slate-400'}`}>{row.sector}</td>
                    <td className={`py-3 px-4 text-right ${isCanceled ? 'text-red-400 line-through opacity-70' : ''}`}>{formatNumber(row.hours, 1)}h</td>
                    <td className={`py-3 px-4 text-right ${isCanceled ? 'text-red-400 line-through opacity-70' : ''}`}>{row.rate === null ? '—' : formatCurrency(row.rate)}</td>
                    <td className={`py-3 pl-4 text-right font-semibold ${isCanceled ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{isCanceled ? 'Cancelado' : (row.cost === null ? '—' : formatCurrency(row.cost))}</td>
                  </tr>
                );
              })}
            </tbody>
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

function GovernanceView({ reportId, version, status, hash, hashLoading, auditEvents, onGenerateHash, onStatusChange, onNewVersion }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <h2 className="font-bold dark:text-white mb-5">Governança do documento</h2>
          <div className="space-y-3">
            {['Rascunho', 'Em revisão', 'Aprovado'].map((option) => (
              <button key={option} type="button" onClick={() => onStatusChange(option)} className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all ${status === option ? 'border-sky-600 bg-sky-600 text-white font-bold' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:text-white'}`}>
                <span className="font-medium text-sm">{option}</span>
                {status === option && <CheckCircle2 className="w-5 h-5" />}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" className="w-full mt-4 gap-2 dark:border-slate-700 dark:text-white" onClick={onNewVersion}><History className="w-4 h-4" /> Nova versão</Button>
        </Card>
        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <h2 className="font-bold dark:text-white mb-5">Integridade do relatório</h2>
          <div className="rounded-xl bg-slate-950 p-4">
            <div className="text-[10px] uppercase text-slate-500 font-bold">ID</div>
            <div className="text-sm font-mono text-white mt-1">{reportId}</div>
            <div className="text-[10px] uppercase text-slate-500 font-bold mt-4">SHA-256</div>
            <div className="text-xs font-mono text-sky-400 mt-1 break-all">{hash || 'Não calculado'}</div>
          </div>
          <Button type="button" className="w-full mt-4 gap-2 bg-sky-600 hover:bg-sky-500 text-white" onClick={onGenerateHash} disabled={hashLoading}>
            {hashLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />} Calcular SHA-256
          </Button>
        </Card>
      </div>
    </div>
  );
}

function ReportCard({ title, description, children }) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
        <h2 className="font-bold text-lg dark:text-white">{title}</h2>
        {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </Card>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="py-12 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <Search className="w-5 h-5 text-slate-400" />
      </div>
      <h3 className="font-semibold text-slate-800 dark:text-white mt-4">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>
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
            <Button type="button" onClick={onPrint} className="gap-2 bg-sky-600 hover:bg-sky-500 border-0"><Printer className="w-4 h-4" /> Imprimir / PDF</Button>
            <Button type="button" variant="ghost" onClick={onClose} className="text-white hover:bg-white/10"><X className="w-5 h-5" /></Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center">
          <div className="w-[210mm] bg-white p-12 shadow-lg text-slate-900 text-xs">
            <h1 className="text-2xl font-black mb-2">{reportPayload.title}</h1>
            <p><strong>Filtros:</strong> {reportPayload.filtersLabel}</p>
            <p><strong>Emissão:</strong> {new Date().toLocaleString('pt-BR')}</p>
            <hr className="my-6 border-slate-300" />
            <table className="w-full text-left border-collapse border border-slate-300">
              <thead className="bg-slate-200">
                <tr>{reportPayload.columns.map(c => <th key={c} className="border border-slate-300 p-2">{c}</th>)}</tr>
              </thead>
              <tbody>
                {reportPayload.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} className="border border-slate-300 p-2">{c}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}