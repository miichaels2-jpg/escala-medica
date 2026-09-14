import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity, AlertTriangle, BarChart3, Building2, CalendarDays, Check, CheckCircle2,
  ChevronRight, ClipboardCheck, Clock3, Database, Download, Eye, FileCheck2,
  FileSpreadsheet, Filter, GripVertical, Hash, History, LayoutDashboard,
  LayoutGrid, List, Loader2, Lock, MapPin, Maximize2, Menu, MessageCircle,
  Minimize2, Moon, Pencil, Plus, Printer, RefreshCw, Search, Send, ShieldCheck,
  SlidersHorizontal, Sun, Trash2, TrendingDown, UserPlus, Users, UsersRound, X
} from 'lucide-react';
import ShiftFormDialog from '@/components/shifts/ShiftFormDialog';
import { exportSchedulePDF } from '@/lib/exportReport';

/* ============================================================
   CONSTANTES E CONFIGURAÇÕES SEGURAS
   ============================================================ */

const STORAGE_KEY = 'escala-base-config-v2';

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
  { id: 'rose', value: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200', bg: 'bg-rose-400' }
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

/* ============================================================
   FUNÇÕES DE BLINDAGEM E UTILITÁRIOS
   ============================================================ */

function safeArray(val) { return Array.isArray(val) ? val : []; }
function safeNumber(val) { const n = Number(val); return Number.isFinite(n) ? n : 0; }
function formatNumber(val, dec = 0) { return safeNumber(val).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function formatCurrency(val) { if (val == null || val === '') return 'Não informado'; const n = Number(val); return Number.isFinite(n) ? `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Não informado'; }
function normalizeDate(val) { if (!val) return ''; const t = String(val).trim(); return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.substring(0, 10) : t; }
function getLocalDateString(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function normalizeStr(str) { return typeof str === 'string' ? str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : ''; }
function toTitleCase(str) { return typeof str === 'string' ? str.toLowerCase().split(' ').map(w => ['de','da','do','e'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''; }
function getStatusKey(status) { return String(status || '').trim().toLowerCase(); }

function getShiftHours(s) {
  if (s?.duration_hours != null) return safeNumber(s.duration_hours);
  if (s?.hours != null) return safeNumber(s.hours);
  if (s?.start_time && s?.end_time) {
    const st = new Date(`1970-01-01T${s.start_time}`);
    const et = new Date(`1970-01-01T${s.end_time}`);
    if (!Number.isNaN(st.getTime()) && !Number.isNaN(et.getTime())) {
      let diff = (et - st) / 3600000;
      if (diff < 0) diff += 24;
      return Math.max(0, diff);
    }
  }
  return 12;
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
    currentWeek.push(getLocalDateString(new Date(year, month - 1, d)));
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }
  return weeks;
}

// CÁLCULO INTELIGENTE DO STATUS DO PLANTÃO (Realizado, Em andamento, Planejado)
function getRealTimeStatus(dateStr, startStr, endStr, currentTime) {
  if (!dateStr) return 'planejado';
  const shiftDate = normalizeDate(dateStr);
  const today = getLocalDateString(currentTime);

  if (shiftDate < today) return 'finalizado';
  if (shiftDate > today) return 'planejado';

  // É hoje. Verifica as horas.
  if (startStr && endStr) {
    const currentHour = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
    if (startStr > endStr) {
      // Madrugada (cruza o dia)
      if (currentHour >= startStr || currentHour <= endStr) return 'andamento';
    } else {
      if (currentHour < startStr) return 'planejado';
      if (currentHour >= startStr && currentHour <= endStr) return 'andamento';
      if (currentHour > endStr) return 'finalizado';
    }
  }
  return 'andamento'; // Default para o dia atual sem hora válida
}

function escapeCSV(val) { return `"${String(val ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`; }
function downloadFile(content, filename) { const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function generateSHA256(input) { try { if (!window.crypto?.subtle) return 'Indisponível'; const data = new TextEncoder().encode(input); const hashBuffer = await window.crypto.subtle.digest('SHA-256', data); return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join(''); } catch { return 'Erro'; } }

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */

export default function Escalas() {
  const { user, company, loading: appLoading } = useAppData() || {};
  
  const [shifts, setShifts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [viewMode, setViewMode] = useState('grade'); 
  const [activeTab, setActiveTab] = useState('executiva');
  
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ startDate: '', endDate: '', sectorId: 'todos', professionalId: 'todos' });
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalDateString().slice(0,7));
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState('light');

  // Controle da Grade Mensal
  const [profSearchQuery, setProfSearchQuery] = useState('');
  const [inlineEditingCell, setInlineEditingCell] = useState(null);
  const [inlineSearchText, setInlineSearchText] = useState('');
  const [selectedCells, setSelectedCells] = useState([]);
  const [isPublished, setIsPublished] = useState(false);
  
  // Modais de Criação
  const [newShiftModal, setNewShiftModal] = useState(null); 
  const [selectedProfIdForModal, setSelectedProfIdForModal] = useState(''); 
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tvMode, setTvMode] = useState(false);
  
  // Builder da Escala Base
  const [builderModal, setBuilderModal] = useState(null);
  const [builderScaleDate, setBuilderScaleDate] = useState(() => getLocalDateString());
  const [builderShifts, setBuilderShifts] = useState([]);
  const [builderForm, setBuilderForm] = useState({ id: '', name: '', start: '', end: '', qty: 1, color: BUILDER_COLORS[0], days: [] });

  // Relatórios
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportStatus, setReportStatus] = useState('Aprovado');
  const [reportVersion, setReportVersion] = useState(1);
  const [reportHash, setReportHash] = useState('');
  const [hashLoading, setHashLoading] = useState(false);
  const [auditEvents, setAuditEvents] = useState([]);

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_h1';

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

  // Loader Master
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError('');
    try {
      const queryFilter = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
      const [s, sec, p] = await Promise.all([
        base44.entities.Shift?.filter ? base44.entities.Shift.filter(queryFilter, '-date', 2000).catch(() => []) : base44.entities.Shift?.list?.().catch(() => []),
        base44.entities.Sector?.filter ? base44.entities.Sector.filter(queryFilter, '-created_date', 200).catch(() => []) : base44.entities.Sector?.list?.().catch(() => []),
        base44.entities.Professional?.filter ? base44.entities.Professional.filter(queryFilter, '-created_date', 1000).catch(() => []) : base44.entities.Professional?.list?.().catch(() => []),
      ]);
      const safeShifts = safeArray(Array.isArray(s) ? s : s?.data);
      const safeSectors = safeArray(Array.isArray(sec) ? sec : sec?.data);
      const safeProfessionals = safeArray(Array.isArray(p) ? p : p?.data);

      setShifts(safeShifts); setSectors(safeSectors); setProfessionals(safeProfessionals);
      
      setFilters(current => {
        if (current.sectorId === 'todos' && safeSectors.length > 0) {
          return { ...current, sectorId: String(safeSectors[0].id) };
        }
        return current;
      });
    } catch (err) { setError('Falha na sincronização.'); } finally { setLoading(false); setRefreshing(false); }
  }, [companyId, unitId]);

  useEffect(() => { if (!appLoading) loadData(); }, [appLoading, loadData]);
  useEffect(() => { const id = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(id); }, []);

  // Persistência da Escala Base
  useEffect(() => {
    try {
      const key = `${STORAGE_KEY}:${companyId}:${unitId}`;
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setBuilderShifts(parsed);
      } else {
        // Fallback Padrão para não deixar a tela vazia
        setBuilderShifts([
          { id: 'manha', name: 'Manhã', start: '07:00', end: '13:00', color: BUILDER_COLORS[0].value, qty: 1, cellStates: {1:true,2:true,3:true,4:true,5:true,6:true,0:true} },
          { id: 'tarde', name: 'Tarde', start: '13:00', end: '19:00', color: BUILDER_COLORS[1].value, qty: 1, cellStates: {1:true,2:true,3:true,4:true,5:true,6:true,0:true} },
          { id: 'noite', name: 'Noite', start: '19:00', end: '07:00', color: BUILDER_COLORS[2].value, qty: 1, cellStates: {1:true,2:true,3:true,4:true,5:true,6:true,0:true} }
        ]);
      }
    } catch (e) {}
  }, [companyId, unitId]);

  const persistBuilder = (newShifts) => {
    setBuilderShifts(newShifts);
    try { window.localStorage.setItem(`${STORAGE_KEY}:${companyId}:${unitId}`, JSON.stringify(newShifts)); } catch (e) {}
  };

  // Mapas e Memoizations
  const professionalMap = useMemo(() => { const m = {}; safeArray(professionals).forEach(p => { if (p?.id) m[p.id] = p; }); return m; }, [professionals]);
  const sectorMap = useMemo(() => { const m = {}; safeArray(sectors).forEach(s => { if (s?.id) m[s.id] = s; }); return m; }, [sectors]);
  const monthOptions = useMemo(() => {
    const opts = new Set(safeArray(shifts).map(s => s?.date ? String(s.date).slice(0, 7) : ''));
    if (selectedMonth) opts.add(selectedMonth);
    return [...opts].filter(Boolean).sort().reverse();
  }, [shifts, selectedMonth]);

  // Filtro Universal e Cruzamento Financeiro
  const filteredShifts = useMemo(() => {
    const term = normalizeStr(search);
    const result = safeArray(shifts).filter(s => {
      if (!s || getStatusKey(s.status) === 'cancelado') return false;
      const sDate = normalizeDate(s.date);
      if (!sDate) return false;
      if (selectedMonth && viewMode === 'grade' && !sDate.startsWith(selectedMonth)) return false;
      if (filters.startDate && sDate < filters.startDate) return false;
      if (filters.endDate && sDate > filters.endDate) return false;
      if (filters.sectorId !== 'todos' && String(s.sector_id) !== String(filters.sectorId)) return false;
      if (filters.professionalId !== 'todos' && String(s.professional_id) !== String(filters.professionalId)) return false;
      return true;
    }).map(s => {
      const pName = typeof s.professional_name === 'string' ? s.professional_name.toLowerCase() : '';
      const rTimeStatus = getRealTimeStatus(s.date, s.start_time, s.end_time, currentTime);
      
      // Mapeamento financeiro cruzado
      const prof = professionalMap[s.professional_id];
      const remType = String(prof?.remuneration_type || prof?.remunerationType || 'hora').toLowerCase();
      const hours = getShiftHours(s);
      
      let rate = null;
      if (remType === 'hora') rate = prof?.hourly_rate ?? s?.hourly_rate ?? 120;
      else if (remType === 'diaria') rate = prof?.daily_rate ?? 1500;
      else if (remType === 'mensal') {
        const monthly = Number(prof?.monthly_salary ?? 18000);
        const workHours = Number(prof?.monthly_work_hours ?? 220);
        rate = workHours > 0 ? monthly / workHours : null;
      }
      const cost = rate !== null ? (remType === 'mensal' ? rate * hours : (remType === 'diaria' ? rate : hours * rate)) : null;

      return { 
        ...s, 
        rTimeStatus, 
        builderId: s.builder_id || 'manha', 
        isVacant: !s.professional_id || pName.includes('vaga'),
        financial: { rate, cost, remType }
      };
    });

    // Ordenação Crescente (Para a Lista Diária)
    return result.sort((a, b) => {
      if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
      return String(a.start_time || '').localeCompare(String(b.start_time || ''));
    });
  }, [shifts, search, filters, selectedMonth, viewMode, currentTime, professionalMap]);

  const baseMetrics = useMemo(() => {
    let confirmed = 0, pending = 0, canceled = 0, open = 0, confirmedHours = 0, totalHours = 0;
    safeArray(filteredShifts).forEach(s => {
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

  const financialMetrics = useMemo(() => {
    let totalCost = 0, missingRates = 0;
    const rows = [];
    safeArray(filteredShifts).forEach(s => {
      if (s.financial.cost !== null) totalCost += s.financial.cost;
      else missingRates++;
      
      rows.push({
        professional: getProfessionalName(s, professionalMap),
        sector: getSectorName(s, sectorMap),
        hours: getShiftHours(s),
        rate: s.financial.rate,
        cost: s.financial.cost,
        status: getStatusKey(s.status)
      });
    });
    return { totalCost, missingRates, rows };
  }, [filteredShifts, professionalMap, sectorMap]);

  // Auditoria Rápida
  const addAuditEvent = useCallback((type, desc) => setAuditEvents((cur) => [{ id: Math.random().toString(36).substring(2), type, description: desc, timestamp: new Date().toLocaleString('pt-BR') }, ...cur]), []);

  /* ============================================================
     AÇÕES DA GRADE (DRAG & DROP, CLIQUES E PUBLICAÇÃO)
     ============================================================ */
  const weeksDataGrid = useMemo(() => getMonthWeeks(selectedMonth), [selectedMonth]);
  const sidebarProfessionals = useMemo(() => { const term = normalizeStr(profSearchQuery); return safeArray(professionals).filter(p => p?.id && (!term || normalizeStr(p.name || p.full_name).includes(term) || normalizeStr(p.specialty || '').includes(term))); }, [professionals, profSearchQuery]);

  const handleCellClick = (e, date, builderId) => {
    if (e.ctrlKey || e.metaKey) {
      const exists = selectedCells.find(c => c.date === date && c.builderId === builderId);
      if (exists) setSelectedCells(selectedCells.filter(c => !(c.date === date && c.builderId === builderId)));
      else setSelectedCells([...selectedCells, { date, builderId }]);
    } else {
      setSelectedCells([]); setSelectedProfIdForModal(''); setNewShiftModal({ date, builderId });
    }
  };

  const handleDragStart = (e, prof) => { if (prof?.id) { e.dataTransfer.setData('profId', prof.id); } };
  const handleDragOver = (e) => { e.preventDefault(); };

  const assignShift = async (date, builderId, profId) => {
    if (filters.sectorId === 'todos') { alert("Selecione um setor na barra superior para alocar."); return; }
    
    const prof = professionalMap[profId];
    const sectorObj = safeArray(sectors).find(s => String(s.id) === String(filters.sectorId));
    if (!prof || !sectorObj) return;

    let periodDef = builderShifts.find(p => p.id === builderId);
    if (!periodDef) return; // Segurança

    try {
      const existingShift = safeArray(filteredShifts).find(s => String(s.date || '').startsWith(date) && s.builderId === builderId && s.isVacant);
      const payload = { company_id: companyId, unit_id: unitId, professional_id: prof.id, professional_name: prof.name || prof.full_name || 'Profissional', sector_id: sectorObj.id, sector_name: sectorObj.name, date: date, start_time: periodDef.start, end_time: periodDef.end, duration_hours: getShiftHours({start_time: periodDef.start, end_time: periodDef.end}), builder_id: builderId, status: 'confirmado' };
      
      if (existingShift) await base44.entities.Shift.update(existingShift.id, payload);
      else await base44.entities.Shift.create(payload);
      loadData(true);
    } catch (error) { alert("Erro ao salvar plantão: " + error.message); }
  };

  const handleDrop = (e, date, builderId) => {
    e.preventDefault();
    const profId = e.dataTransfer.getData('profId');
    if (!profId) return;
    const isSelected = selectedCells.some(c => c.date === date && c.builderId === builderId);
    if (isSelected && selectedCells.length > 0) {
      selectedCells.forEach(cell => assignShift(cell.date, cell.builderId, profId));
      setSelectedCells([]);
    } else { assignShift(date, builderId, profId); setSelectedCells([]); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja cancelar este plantão? Ele ficará salvo no log de auditoria.')) return;
    try { await base44.entities.Shift.update(id, { status: 'cancelado', notes: 'Cancelado pela gestão.' }); loadData(true); } catch (e) { alert('Erro ao cancelar.'); }
  };

  const handlePublish = () => {
    if (confirm('Publicar escala? Isso ativará os alertas e ficará visível aos profissionais.')) {
      setIsPublished(true);
      setTimeout(() => alert('Escala publicada com sucesso!'), 500);
    }
  };

  const printDaySchedule = () => {
    if (!selectedDate && viewMode === 'list') { alert('Selecione um dia específico no filtro de Datas.'); return; }
    window.print();
  };

  const openTvMode = async () => { setTvMode(true); try { await document.documentElement.requestFullscreen?.(); } catch {} };
  const closeTvMode = async () => { setTvMode(false); if (document.fullscreenElement) await document.exitFullscreen?.(); };

  /* ============================================================
     AÇÕES DO BUILDER DE ESCALA BASE
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
    const newObj = { id: builderModal.isNew ? `bld_${Date.now()}` : builderForm.id, name: builderForm.name, start: builderForm.start, end: builderForm.end, color: builderForm.color.value, qty: Math.max(1, Number(builderForm.qty) || 1), cellStates: builderModal.isNew ? { ...activeDays } : ((builderShifts || []).find(s => s.id === builderForm.id)?.cellStates || { ...activeDays }) };
    if (builderModal.isNew) persistBuilder([...builderShifts, newObj]); else persistBuilder(builderShifts.map(s => s.id === newObj.id ? newObj : s));
    setBuilderModal(null);
  };
  const toggleBuilderCell = (shiftId, dayIndex) => {
    persistBuilder(builderShifts.map(s => s.id === shiftId ? { ...s, cellStates: { ...s.cellStates, [dayIndex]: !s.cellStates[dayIndex] } } : s));
  };
  const downloadBackupBase = () => {
    downloadFile(JSON.stringify(builderShifts, null, 2), 'backup_escala_base.json');
  };

  /* ============================================================
     TV E MODO VISÃO FOCO
     ============================================================ */
  if (tvMode) {
    const activeTvShifts = safeArray(filteredShifts).filter(s => s.rTimeStatus !== 'finalizado');
    return (
      <div className="fixed inset-0 z-[99999] bg-slate-950 text-white flex flex-col p-6 font-sans">
        <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
           <div><h1 className="text-3xl font-black text-sky-400">Escala e Plantões TV</h1><p className="text-sm text-slate-400">{fmtDateLong(getLocalDateString(currentTime))} · {sectors.find(s=>String(s.id)===String(filters.sectorId))?.name || 'Visão Geral'}</p></div>
           <div className="flex gap-4 items-center"><div className="text-right"><div className="text-2xl font-mono text-emerald-400 font-black">{currentTime.toLocaleTimeString('pt-BR')}</div><div className="text-[10px] text-slate-400 uppercase">Horário Oficial</div></div><button onClick={closeTvMode} className="p-3 bg-white/10 rounded-xl hover:bg-white/20"><Minimize2 className="w-5 h-5"/></button></div>
        </div>
        <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
           {builderShifts.map(b => {
             const slotShifts = activeTvShifts.filter(s => s.builderId === b.id);
             if(slotShifts.length === 0) return null;
             return (
               <div key={b.id} className="p-5 rounded-3xl border bg-slate-900 border-white/10">
                  <h2 className="text-xl font-bold mb-4">{b.name} <span className="text-xs text-slate-500 font-normal">({b.start} às {b.end})</span></h2>
                  <div className="space-y-3">
                     {slotShifts.map(s => (
                       <div key={s.id} className={`p-3 border rounded-xl flex justify-between ${s.isVacant ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse' : s.rTimeStatus === 'andamento' ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-slate-800 border-slate-700'}`}>
                          <div>
                            {!s.isVacant && s.rTimeStatus === 'andamento' && <div className="text-emerald-400 text-[10px] font-bold">● EM ANDAMENTO</div>}
                            {!s.isVacant && s.rTimeStatus === 'planejado' && <div className="text-sky-400 text-[10px] font-bold">AGENDADO</div>}
                            <b className={!s.isVacant ? 'text-white' : ''}>{s.isVacant ? 'VAGA ABERTA' : toTitleCase(s.professional_name)}</b>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
             );
           })}
        </div>
      </div>
    );
  }

  /* ============================================================
     RENDERIZAÇÃO DA TELA (ANTI-WSOD)
     ============================================================ */
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* SIDEBAR */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-slate-950 text-slate-400 flex flex-col transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center"><Activity className="w-5 h-5 text-white" /></div>
          <div><div className="font-black text-sm text-white tracking-widest">ESCALA E</div><div className="text-[10px] font-bold text-sky-400">PLANTÕES</div></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2 opacity-50">Gestão Visual</div>
            <SidebarItem active={viewMode === 'grade'} icon={LayoutGrid} label="Builder Visual da Escala" onClick={() => { setViewMode('grade'); setMobileMenuOpen(false); }} />
            <SidebarItem active={viewMode === 'list'} icon={List} label="Lista Diária" onClick={() => { setViewMode('list'); setMobileMenuOpen(false); }} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2 opacity-50">Planejamento</div>
            <SidebarItem active={viewMode === 'base_builder'} icon={SlidersHorizontal} label="Configurar Escala Base" onClick={() => { setViewMode('base_builder'); setMobileMenuOpen(false); }} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2 opacity-50">Painel Executivo</div>
            {[['executiva', LayoutDashboard], ['produtividade', Clock3], ['cobertura', Building2], ['risco', ShieldCheck], ['financeiro', BarChart3], ['turnover', Users], ['auditoria', ClipboardCheck]].map(([key, IconComponent]) => (
              <SidebarItem key={key} active={activeTab === key && viewMode === 'relatorios'} icon={IconComponent} label={REPORT_CONFIG[key]?.label || ''} onClick={() => { setViewMode('relatorios'); setActiveTab(key); setMobileMenuOpen(false); }} />
            ))}
          </div>
        </div>
      </aside>

      {mobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* HEADER TOP */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-5 lg:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 bg-slate-100 dark:bg-slate-800 rounded-lg" onClick={() => setMobileMenuOpen(true)}><Menu className="w-5 h-5" /></button>
            <div><h1 className="text-2xl font-black text-slate-900 dark:text-white">Escala e Plantões</h1><p className="text-xs text-slate-500">Alocação e gestão médica.</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={toggleTheme} className="dark:border-slate-700"><Sun className="w-4 h-4 hidden dark:block" /><Moon className="w-4 h-4 block dark:hidden" /></Button>
            <Button variant="outline" onClick={() => loadData(true)} disabled={refreshing} className="dark:border-slate-700 hidden sm:flex"><RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar</Button>
            {viewMode === 'list' && <Button onClick={printDaySchedule} variant="outline" className="dark:border-slate-700 font-bold hidden sm:flex"><Printer className="w-4 h-4 mr-2" /> Imprimir Dia</Button>}
            {viewMode === 'grade' && <Button onClick={openTvMode} className="bg-slate-900 text-white font-bold hidden md:flex"><Maximize2 className="w-4 h-4 mr-2" /> Modo TV</Button>}
            {viewMode === 'grade' && <Button onClick={handlePublish} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md"><Send className="w-4 h-4 mr-2" /> Publicar Escala</Button>}
          </div>
        </header>

        {/* FILTROS UNIVERSAIS (Exceto no Base Builder) */}
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
              <Select value={filters.sectorId || undefined} onValueChange={(v) => { setFilters(c => ({...c, sectorId: v}))}}>
                <SelectTrigger className="h-9 text-xs dark:bg-slate-800 dark:border-slate-700"><SelectValue placeholder="Selecione o Setor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os setores</SelectItem>
                  {safeArray(sectors).filter(s => s && s.id).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name || 'Sem nome'}</SelectItem>)}
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

        {/* ===================== MODO GRADE VISUAL (BUILDER DRAG&DROP) ===================== */}
        {viewMode === 'grade' && (
          <div className="flex-1 flex overflow-hidden p-5 sm:px-8 pb-8">
            <Card className="flex-1 border-slate-200 dark:border-slate-800 shadow-sm flex overflow-hidden bg-white dark:bg-slate-900">
              
              <div className="w-64 bg-slate-50/50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-black text-sm text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2"><UsersRound className="w-4 h-4 text-sky-600" /> Corpo Clínico</h3>
                  <div className="relative"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><Input placeholder="Buscar profissional..." value={profSearchQuery} onChange={e => setProfSearchQuery(e.target.value)} className="pl-9 h-9 text-xs bg-white dark:bg-slate-800" /></div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 text-center font-medium">Arraste o nome para a escala ➔</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {sidebarProfessionals.map(prof => (
                    <div key={prof.id} draggable onDragStart={(e) => handleDragStart(e, prof)} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-sky-400 active:cursor-grabbing flex items-center gap-2 group transition-all">
                      <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-sky-500" />
                      <div className="min-w-0"><div className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">{prof.name || prof.full_name || 'Profissional'}</div><div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{prof.specialty || 'Geral'}</div></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-slate-100/30 dark:bg-slate-950 relative custom-scrollbar">
                {filters.sectorId === 'todos' ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center"><Building2 className="w-12 h-12 mb-4 opacity-50 text-slate-300" /><p className="font-bold">Selecione um Setor Específico</p><p className="text-sm mt-1">O modo Grade exige um setor selecionado para permitir alocação nas vagas.</p></div>
                ) : (
                  <div className="min-w-[900px] pb-10">
                    <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 sticky top-0 z-20 shadow-sm">
                      <div className="p-3 border-r border-slate-200 dark:border-slate-800 flex items-center justify-center font-black text-xs text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-800/80">Turno</div>
                      {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map(day => <div key={day} className="p-3 border-r border-slate-200 dark:border-slate-800 text-center font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">{day}</div>)}
                    </div>

                    {safeArray(weeksDataGrid).map((week, wIndex) => (
                      <div key={wIndex} className="border-b-[6px] border-slate-200 dark:border-slate-800/50">
                        <div className="grid grid-cols-8 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                          <div className="p-2 border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80"></div>
                          {safeArray(week).map((date, dIndex) => (
                            <div key={dIndex} className={`p-1 border-r border-slate-200 dark:border-slate-800 text-right pr-2 text-[10px] font-black ${date ? 'text-slate-500 dark:text-slate-400' : 'text-transparent'}`}>
                              {date ? `${date.split('-')[2]}/${date.split('-')[1]}` : '-'}
                            </div>
                          ))}
                        </div>

                        {safeArray(builderShifts).map((period) => (
                          <div key={period.id} className="grid grid-cols-8 border-b border-slate-100 dark:border-slate-800/50 last:border-b-0 group">
                            <div className="p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex flex-col items-center justify-center text-center">
                              <span className="font-black text-[11px] uppercase text-slate-700 dark:text-slate-300">{period.name}</span>
                              <span className="text-[9px] font-bold text-slate-400">{period.start} - {period.end}</span>
                            </div>

                            {safeArray(week).map((date, dIndex) => {
                              if (!date) return <div key={dIndex} className="bg-slate-50 dark:bg-slate-900/20 border-r border-slate-200 dark:border-slate-800 p-2"></div>;

                              const slotShifts = safeArray(filteredShifts).filter(s => String(s.date || '').startsWith(date) && s.builderId === period.id);
                              const isSelected = selectedCells.some(c => c.date === date && c.builderId === period.id);
                              
                              const dIndexBase = new Date(`${date}T12:00:00`).getDay();
                              const isActiveInBase = period.cellStates && period.cellStates[dIndexBase];
                              const requiredQty = isActiveInBase ? (period.qty || 1) : 0;
                              
                              const renders = [...slotShifts];
                              for(let q = slotShifts.length; q < requiredQty; q++) renders.push({ isVirtualVacant: true, isVacant: true });

                              return (
                                <div 
                                  key={dIndex} 
                                  className={`border-r border-slate-200 dark:border-slate-800/50 p-1.5 min-h-[70px] relative transition-colors cursor-pointer flex flex-col gap-1 ${isSelected ? 'bg-sky-50 dark:bg-sky-900/20 ring-inset ring-2 ring-sky-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                                  onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, date, period.id)} onClick={(e) => handleCellClick(e, date, period.id)}
                                >
                                  {renders.length === 0 && !isActiveInBase && <div className="absolute inset-0 flex items-center justify-center opacity-30 text-xs font-black text-slate-400">-</div>}

                                  {renders.map((s, idx) => (
                                    <div key={s.id || `vaga_${idx}`} className={`relative p-2 rounded-lg text-[10px] border flex items-center justify-between group/item transition-all hover:scale-[1.02] shadow-sm ${s.isVacant ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 text-amber-800 dark:text-amber-200 border-dashed' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100'}`}>
                                      <span className="font-bold truncate pr-4">{s.isVacant ? 'Vaga Aberta' : toTitleCase(s.professional_name)}</span>
                                      {!s.isVacant && isPublished && <div className="absolute -top-2 left-2 opacity-0 group-hover/item:opacity-100 transition-opacity bg-emerald-500 text-white text-[8px] font-black px-1.5 rounded uppercase shadow-sm z-10 pointer-events-none">Publicado</div>}
                                      {!s.isVacant && s.id && <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="opacity-0 group-hover/item:opacity-100 p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded transition-opacity absolute right-1"><X className="w-3 h-3" /></button>}
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
                                        {safeArray(professionals).filter(p => !inlineSearchText || normalizeStr(p.name || p.full_name).includes(normalizeStr(inlineSearchText))).slice(0, 5).map(p => (
                                          <button key={p.id} className="w-full text-left px-2 py-1 text-[10px] hover:bg-sky-50 dark:hover:bg-slate-800 rounded truncate text-slate-700 dark:text-slate-300 font-medium" onClick={() => { assignShift(date, period.id, p.id); setInlineEditingCell(null); setInlineSearchText(''); }}>
                                            {p.name || p.full_name || 'Sem nome'}
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
                  const statusStyles = {
                    finalizado: { bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 text-slate-500', icon: CheckCircle2, lbl: 'Finalizado' },
                    andamento: { bg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 text-emerald-600', icon: Activity, lbl: 'Em Andamento' },
                    planejado: { bg: 'bg-sky-50 dark:bg-sky-900/30 border-sky-200 text-sky-600', icon: CalendarDays, lbl: 'Planejado' }
                  }[s.rTimeStatus] || { bg: 'bg-slate-50 border-slate-100', icon: CalendarDays, lbl: 'Planejado' };

                  return (
                    <div key={s.id} className={`flex items-center gap-3 rounded-2xl border p-3 bg-white dark:bg-slate-900 transition-colors shadow-sm ${s.isVacant ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                      <div className={`min-w-[95px] rounded-xl py-2 text-center text-xs font-black border shrink-0 ${statusStyles.bg}`}>
                        {fmtDate(s.date)} <br/>
                        <span className="font-bold opacity-80">{s.start_time || '--'} - {s.end_time || '--'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <strong className={`block text-sm truncate ${s.isVacant ? 'text-amber-800 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`}>
                          {toTitleCase(s.professional_name) || 'Vaga Aberta'}
                        </strong>
                        <span className="text-xs text-slate-400">{toTitleCase(s.sector_name)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!s.isVacant && (
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${statusStyles.bg}`}>
                            <statusStyles.icon className="w-3.5 h-3.5" /> {statusStyles.lbl}
                          </div>
                        )}
                        {!s.isVacant && s.rTimeStatus !== 'finalizado' && <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)} className="h-8 w-8 text-red-500"><Trash2 className="w-4 h-4"/></Button>}
                        {s.isVacant && <Button size="sm" onClick={() => { setEditing(s); setDialogOpen(true); }} className="h-8 bg-amber-500 hover:bg-amber-600 text-white"><UserPlus className="w-3.5 h-3.5 mr-1" /> Alocar</Button>}
                      </div>
                    </div>
                  );
                })
              )}
          </div>
        )}

        {/* ===================== MODO BASE BUILDER (CRIAÇÃO DE ESCALA BASE) ===================== */}
        {viewMode === 'base_builder' && (
          <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-6 flex justify-center">
            <div className="w-full max-w-5xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-sky-700 dark:text-sky-400">Escala Base (Modo Edição)</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Configure os padrões de horário e a quantidade de vagas ativas na semana.</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Data de Início da Aplicação</label>
                  <Input type="date" value={builderScaleDate} onChange={e => setBuilderScaleDate(e.target.value)} className="h-10 w-40 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                  <Button variant="outline" onClick={downloadBackupBase} className="h-10 gap-2"><Download className="w-4 h-4" /> Backup Local</Button>
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
                      {safeArray(builderShifts).length === 0 ? (
                        <tr><td colSpan="8" className="p-12 text-center text-slate-400 text-sm">Nenhum horário configurado. Adicione um novo abaixo para moldar a grade.</td></tr>
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
                                    <div className="relative w-full h-full min-h-[70px] flex items-center justify-center group/cell cursor-pointer" onClick={() => toggleBuilderCell(shift.id, day.index)}>
                                      <div className={`w-8 h-8 mx-auto rounded-lg font-black text-sm flex items-center justify-center transition-colors ${isActive ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'bg-transparent text-slate-300 dark:text-slate-600'}`}>
                                        {isActive ? shift.qty : '-'}
                                      </div>
                                      <div className="absolute inset-0 bg-slate-900/80 text-white text-[9px] font-bold flex flex-col items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                        {isActive ? 'Desativar Vaga?' : 'Ativar Vaga?'}
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
                    <Plus className="w-4 h-4" /> Adicionar Horário / Turno na Grade
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
                <Button variant="outline" onClick={() => setViewMode('grade')} className="font-bold border-slate-300 dark:border-slate-700 h-11 px-8">Cancelar</Button>
                <Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-11 px-8 shadow-md" onClick={() => { alert('Escala Base salva com sucesso no sistema!'); setViewMode('grade'); }}>Salvar Escala Base</Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          MODAIS E DIALOGS DE SOBREPOSIÇÃO
          ======================================================== */}

      {/* Modal: Adicionar Escala Inicial (Passo 1 do Builder) */}
      {createScaleState === 1 && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
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
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" onClick={() => setCreateScaleState(0)} className="h-11 px-6 border-slate-300 dark:border-slate-700">Cancelar</Button>
                <Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-11 px-8 shadow-md" onClick={() => setCreateScaleState(2)}>Salvar e Continuar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmação e Direcionamento (Passo 2 do Builder) */}
      {createScaleState === 2 && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
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

      {/* Modal: Configurar Horário Específico no Builder (Passo 3) */}
      {builderModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-black text-sky-600 dark:text-sky-400">
                {builderModal.isNew ? 'Novo Horário na Escala' : 'Editar Horário'}
              </h2>
              <button onClick={() => setBuilderModal(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Nome do Turno</label>
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Nº de Vagas por Dia</label>
                  <Input type="number" min="1" value={builderForm.qty} onChange={e => setBuilderForm({...builderForm, qty: Number(e.target.value)})} className="h-11 font-bold text-lg bg-white dark:bg-slate-950 text-center" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Cor de Fundo</label>
                  <div className="flex gap-2 p-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/50">
                    {BUILDER_COLORS.map(c => (
                      <button key={c.id} onClick={() => setBuilderForm({...builderForm, color: c})} className={`w-6 h-6 rounded-md ${c.bg} shadow-sm transition-transform ${builderForm.color?.id === c.id ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 block">Dias Ativos Iniciais</label>
                <div className="flex justify-between gap-1">
                  {WEEK_DAYS_ORDER.map(day => {
                    const isSelected = (builderForm.days || []).includes(day.index);
                    return (
                      <button key={day.index} onClick={() => toggleBuilderDay(day.index)} className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${isSelected ? 'bg-sky-50 border-sky-300 text-sky-700 dark:bg-sky-900/40 dark:border-sky-700 dark:text-sky-300 shadow-sm' : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
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
                  <Button variant="ghost" className="text-red-500 hover:bg-red-50 font-bold text-xs" onClick={() => { setBuilderShifts(prev => prev.filter(s => s.id !== builderForm.id)); persistBuilder(builderShifts.filter(s => s.id !== builderForm.id)); setBuilderModal(null); }}>
                    <Trash2 className="w-4 h-4 mr-1.5" /> Excluir Turno
                  </Button>
                ) : <div/>}
                <Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-11 px-8 shadow-md" onClick={saveBuilderShift}>Aplicar na Grade</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Plantão Individual (Clique Simples na Célula na Grade) */}
      {newShiftModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-black text-sky-600 dark:text-sky-400">Novo Plantão</h2>
              <button onClick={() => { setNewShiftModal(null); setSelectedProfIdForModal(''); }}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="p-6 space-y-4 text-sm font-medium text-slate-700 dark:text-slate-300">
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-right text-xs font-bold text-slate-500">Plantonista:</label>
                <Select value={selectedProfIdForModal || undefined} onValueChange={setSelectedProfIdForModal}>
                  <SelectTrigger className="col-span-2 h-10 text-xs bg-white dark:bg-slate-950"><SelectValue placeholder="Busque um profissional..." /></SelectTrigger>
                  <SelectContent>
                    {(professionals || []).filter(p => p && p.id).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name || p.full_name || 'Sem nome'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-right text-xs font-bold text-slate-500">Equipe / Turno:</label>
                <div className="col-span-2 font-bold text-slate-900 dark:text-white capitalize px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                  {builderShifts.find(p => p.id === newShiftModal.builderId)?.name || newShiftModal.builderId}
                </div>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-right text-xs font-bold text-slate-500">Dia / Data:</label>
                <div className="col-span-2 font-bold text-slate-900 dark:text-white">{fmtDateLong(newShiftModal.date)} - {formatDateBR(newShiftModal.date)}</div>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 my-5" />
              <div className="flex justify-end pt-2">
                <Button onClick={() => { if (!selectedProfIdForModal) { alert('Selecione um profissional da lista.'); return; } assignShift(newShiftModal.date, newShiftModal.builderId, selectedProfIdForModal); setNewShiftModal(null); setSelectedProfIdForModal(''); alert('Plantão alocado e salvo com sucesso!'); }} className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-11 px-8 shadow-md">
                  Alocar Profissional
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Padrão */}
      <ShiftFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={loadData} shift={editing} sectors={sectors} professionals={professionals} companyId={companyId} unitId={unitId} />
    </div>
  );
}