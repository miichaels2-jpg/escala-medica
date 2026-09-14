import React, { Component, useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity, AlertTriangle, Building2, CalendarDays, CheckCircle2,
  Clock3, Download, GripVertical, LayoutGrid, List, Loader2, Lock,
  Maximize2, MessageCircle, Minimize2, Moon, Pencil, Plus, Printer,
  RefreshCw, Search, Send, SlidersHorizontal, Sun, Trash2, UserPlus,
  UsersRound, X
} from 'lucide-react';
import ShiftFormDialog from '@/components/shifts/ShiftFormDialog';

/* ============================================================
   ERROR BOUNDARY NATIVO (BLINDAGEM TOTAL)
   ============================================================ */
class SafeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorInfo: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorInfo: error?.message || 'Erro inesperado.' };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Erro na renderização de Escalas:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-6 text-slate-900 dark:text-slate-100">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-xl font-black">Recuperação de Interface</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-6">
              Recarregando o ambiente operacional de escalas.
            </p>
            <Button
              onClick={() => {
                try {
                  window.localStorage.removeItem('hospital-escala-base-stable-v5');
                } catch (e) {}
                window.location.reload();
              }}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold h-11"
            >
              Recarregar Escalas
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ============================================================
   CONSTANTES E UTILITÁRIOS
   ============================================================ */
const STORAGE_KEY = 'hospital-escala-base-stable-v5';

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

const DEFAULT_BASE_SHIFTS = [
  { id: 'shift_manha', name: 'Manhã', start: '07:00', end: '13:00', color: BUILDER_COLORS[0].value, qty: 1, cellStates: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true } },
  { id: 'shift_tarde', name: 'Tarde', start: '13:00', end: '19:00', color: BUILDER_COLORS[1].value, qty: 1, cellStates: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true } },
  { id: 'shift_noite', name: 'Noite', start: '19:00', end: '07:00', color: BUILDER_COLORS[2].value, qty: 1, cellStates: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true } }
];

function safeArray(val) { return Array.isArray(val) ? val : []; }
function safeNumber(val, fb = 0) { const n = Number(val); return Number.isFinite(n) ? n : fb; }
function normalizeDate(val) { if (!val) return ''; const t = String(val).trim(); return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.substring(0, 10) : t; }
function getLocalDateString(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function normalizeStr(str) { return typeof str === 'string' ? str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : ''; }
function toTitleCase(str) { return typeof str === 'string' ? str.toLowerCase().split(' ').map(w => ['de','da','do','e'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''; }
function getStatusKey(status) { return String(status || '').trim().toLowerCase(); }
function formatDateBR(dateStr) { if (!dateStr) return '—'; const parts = normalizeDate(dateStr).split('-'); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(dateStr); }
function fmtDateLong(dateStr) { if (!dateStr) return ''; const parts = normalizeDate(dateStr).split('-'); if (parts.length < 3) return ''; const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])); return WEEKDAYS_LONG[d.getDay()] || ''; }

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

function getProfessionalId(s) { return s?.professional_id || s?.professionalId || s?.professional?.id || null; }
function getProfessionalName(s, m = {}) { if (s?.professional_name) return s.professional_name; const id = getProfessionalId(s); return id && m[id] ? m[id].name || m[id].full_name || 'Profissional' : 'Vaga Aberta'; }
function getSectorName(s, m = {}) { if (s?.sector_name) return s.sector_name; return s?.sector_id && m[s.sector_id] ? m[s.sector_id].name : 'Setor Geral'; }
function isAssignedShift(s) { return Boolean(getProfessionalId(s)) && !normalizeStr(s?.professional_name).includes('vaga'); }

function getRealTimeStatus(dateStr, startStr, endStr, currentTime) {
  if (!dateStr) return 'planejado';
  const shiftDate = normalizeDate(dateStr);
  const today = getLocalDateString(currentTime);

  if (shiftDate < today) return 'finalizado';
  if (shiftDate > today) return 'planejado';

  if (startStr && endStr) {
    const currentHour = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
    if (startStr > endStr) {
      if (currentHour >= startStr || currentHour <= endStr) return 'andamento';
    } else {
      if (currentHour < startStr) return 'planejado';
      if (currentHour >= startStr && currentHour <= endStr) return 'andamento';
      if (currentHour > endStr) return 'finalizado';
    }
  }
  return 'andamento';
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

function downloadFile(content, filename, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================================================
   MÓDULO DE ESCALA E PLANTÕES
   ============================================================ */
function EscalasContent() {
  const { user, company, loading: appLoading } = useAppData() || {};
  
  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_h1';

  const [shifts, setShifts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [viewMode, setViewMode] = useState('grade'); // grade, list, base_builder
  const [sectorFilter, setSectorFilter] = useState('todos');
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalDateString().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState('');
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [theme, setTheme] = useState('light');

  // Interação da Grade
  const [profSearchQuery, setProfSearchQuery] = useState('');
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
  const [confirmGoToAllocation, setConfirmGoToAllocation] = useState(false);

  // Temas
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

  // Leitura Segura de Dados
  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const query = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
      const [sRaw, secRaw, pRaw] = await Promise.all([
        base44?.entities?.Shift?.filter ? base44.entities.Shift.filter(query, '-date', 2000).catch(() => []) : [],
        base44?.entities?.Sector?.filter ? base44.entities.Sector.filter(query, '-created_date', 200).catch(() => []) : [],
        base44?.entities?.Professional?.filter ? base44.entities.Professional.filter(query, '-created_date', 1000).catch(() => []) : [],
      ]);

      const safeShifts = safeArray(Array.isArray(sRaw) ? sRaw : sRaw?.data);
      const safeSectors = safeArray(Array.isArray(secRaw) ? secRaw : secRaw?.data);
      const safeProfessionals = safeArray(Array.isArray(pRaw) ? pRaw : pRaw?.data);

      setShifts(safeShifts);
      setSectors(safeSectors);
      setProfessionals(safeProfessionals);

      setSectorFilter(prev => (prev === 'todos' && safeSectors.length > 0 ? String(safeSectors[0].id) : prev));
    } catch (e) {
      console.warn("Erro ao carregar dados", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, unitId]);

  useEffect(() => { if (!appLoading) loadData(); }, [appLoading, loadData]);
  useEffect(() => { const id = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(id); }, []);

  // Leitura Segura da Escala Base
  useEffect(() => {
    try {
      const key = `${STORAGE_KEY}:${companyId}:${unitId}`;
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBuilderShifts(parsed);
          return;
        }
      }
    } catch (e) {}
    setBuilderShifts(DEFAULT_BASE_SHIFTS);
  }, [companyId, unitId]);

  const persistBuilder = (newShifts) => {
    setBuilderShifts(newShifts);
    try {
      window.localStorage.setItem(`${STORAGE_KEY}:${companyId}:${unitId}`, JSON.stringify(newShifts));
    } catch (e) {}
  };

  const professionalMap = useMemo(() => {
    const m = {};
    safeArray(professionals).forEach(p => { if (p?.id) m[p.id] = p; });
    return m;
  }, [professionals]);

  const sectorMap = useMemo(() => {
    const m = {};
    safeArray(sectors).forEach(s => { if (s?.id) m[s.id] = s; });
    return m;
  }, [sectors]);

  const monthOptions = useMemo(() => {
    const opts = new Set(safeArray(shifts).map(s => s?.date ? String(s.date).slice(0, 7) : ''));
    if (selectedMonth) opts.add(selectedMonth);
    return [...opts].filter(Boolean).sort().reverse();
  }, [shifts, selectedMonth]);

  // Cruzamento em Tempo Real de Status e Setores
  const filteredShifts = useMemo(() => {
    const result = safeArray(shifts).filter(s => {
      if (!s || getStatusKey(s.status) === 'cancelado') return false;
      const sDate = normalizeDate(s.date);
      if (!sDate) return false;
      if (selectedMonth && viewMode === 'grade' && !sDate.startsWith(selectedMonth)) return false;
      if (selectedDate && viewMode === 'list' && sDate !== selectedDate) return false;
      if (sectorFilter !== 'todos' && String(s.sector_id) !== String(sectorFilter)) return false;
      return true;
    }).map(s => {
      const pName = typeof s.professional_name === 'string' ? s.professional_name.toLowerCase() : '';
      const rTimeStatus = getRealTimeStatus(s.date, s.start_time, s.end_time, currentTime);

      return { 
        ...s, 
        rTimeStatus, 
        builderId: s.builder_id || 'shift_manha', 
        isVacant: !s.professional_id || pName.includes('vaga')
      };
    });

    // Ordenação Crescente (Mais Antigos Primeiro até os Futuros)
    return result.sort((a, b) => {
      if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
      return String(a.start_time || '').localeCompare(String(b.start_time || ''));
    });
  }, [shifts, sectorFilter, selectedMonth, selectedDate, viewMode, currentTime]);

  const weeksDataGrid = useMemo(() => getMonthWeeks(selectedMonth), [selectedMonth]);

  // Profissionais cruzados com o Setor selecionado
  const sidebarProfessionals = useMemo(() => {
    const term = normalizeStr(profSearchQuery);
    return safeArray(professionals).filter(p => {
      if (!p?.id) return false;
      const matchesSearch = !term || normalizeStr(p.name || p.full_name).includes(term) || normalizeStr(p.specialty).includes(term);
      
      // Cruzamento Setor x Profissional (se tiver sector_id ou sectors habilitados)
      const matchesSector = sectorFilter === 'todos' || !p.sector_id || String(p.sector_id) === String(sectorFilter) || (Array.isArray(p.sectors) && p.sectors.includes(sectorFilter));
      
      return matchesSearch && matchesSector;
    });
  }, [professionals, profSearchQuery, sectorFilter]);

  // Alocação e Ações
  const handleCellClick = (e, date, builderId) => {
    if (e.ctrlKey || e.metaKey) {
      const exists = selectedCells.find(c => c.date === date && c.builderId === builderId);
      if (exists) setSelectedCells(selectedCells.filter(c => !(c.date === date && c.builderId === builderId)));
      else setSelectedCells([...selectedCells, { date, builderId }]);
    } else {
      setSelectedCells([]);
      setSelectedProfIdForModal('');
      setNewShiftModal({ date, builderId });
    }
  };

  const handleDragStart = (e, prof) => { if (prof?.id) e.dataTransfer.setData('profId', prof.id); };
  const handleDragOver = (e) => { e.preventDefault(); };

  const assignShift = async (date, builderId, profId) => {
    if (sectorFilter === 'todos') { alert("Selecione um setor para alocar."); return; }
    
    const prof = professionalMap[profId];
    const sectorObj = safeArray(sectors).find(s => String(s.id) === String(sectorFilter));
    if (!prof || !sectorObj) return;

    let periodDef = builderShifts.find(p => p.id === builderId);
    if (!periodDef) periodDef = { name: 'Turno', start: '07:00', end: '13:00' };

    try {
      const existingShift = safeArray(filteredShifts).find(s => String(s.date || '').startsWith(date) && s.builderId === builderId && s.isVacant);
      const payload = { 
        company_id: companyId, 
        unit_id: unitId, 
        professional_id: prof.id, 
        professional_name: prof.name || prof.full_name || 'Profissional', 
        sector_id: sectorObj.id, 
        sector_name: sectorObj.name, 
        date: date, 
        start_time: periodDef.start, 
        end_time: periodDef.end, 
        duration_hours: getShiftHours({ start_time: periodDef.start, end_time: periodDef.end }), 
        builder_id: builderId, 
        status: 'confirmado' 
      };
      
      if (existingShift?.id) await base44.entities.Shift.update(existingShift.id, payload);
      else await base44.entities.Shift.create(payload);
      loadData(true);
    } catch (error) {
      alert("Erro ao salvar plantão: " + (error?.message || 'Tente novamente.'));
    }
  };

  const handleDrop = (e, date, builderId) => {
    e.preventDefault();
    const profId = e.dataTransfer.getData('profId');
    if (!profId) return;

    const isSelected = selectedCells.some(c => c.date === date && c.builderId === builderId);
    if (isSelected && selectedCells.length > 0) {
      selectedCells.forEach(cell => assignShift(cell.date, cell.builderId, profId));
      setSelectedCells([]);
    } else {
      assignShift(date, builderId, profId);
      setSelectedCells([]);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja cancelar este plantão? Ele ficará salvo para auditoria.')) return;
    try {
      await base44.entities.Shift.update(id, { status: 'cancelado' });
      loadData(true);
    } catch (e) {
      alert('Erro ao cancelar.');
    }
  };

  const handlePublish = () => {
    if (confirm('Publicar escala? O status de publicado será ativado para visualização dos médicos.')) {
      setIsPublished(true);
      setTimeout(() => alert('Escala publicada com sucesso!'), 300);
    }
  };

  // Funções da Escala Base
  const openNewBuilderModal = () => {
    setBuilderForm({ id: '', name: '', start: '', end: '', qty: 1, color: BUILDER_COLORS[0], days: [] });
    setBuilderModal({ isNew: true });
  };

  const openEditBuilderModal = (shiftObj) => {
    const selectedColor = BUILDER_COLORS.find(c => c.value === shiftObj.color) || BUILDER_COLORS[0];
    const activeDays = [];
    [0, 1, 2, 3, 4, 5, 6].forEach(d => { if ((shiftObj.cellStates || {})[d]) activeDays.push(d); });
    setBuilderForm({ id: shiftObj.id, name: shiftObj.name, start: shiftObj.start, end: shiftObj.end, qty: shiftObj.qty, color: selectedColor, days: activeDays });
    setBuilderModal({ isNew: false });
  };

  const toggleBuilderDay = (dayIndex) => {
    setBuilderForm(prev => ({
      ...prev,
      days: (prev.days || []).includes(dayIndex) ? (prev.days || []).filter(d => d !== dayIndex) : [...(prev.days || []), dayIndex]
    }));
  };

  const saveBuilderShift = () => {
    if (!builderForm.name || !builderForm.start || !builderForm.end) {
      alert('Preencha o nome, horário de início e fim.');
      return;
    }
    const activeDays = {};
    [0, 1, 2, 3, 4, 5, 6].forEach(d => { activeDays[d] = (builderForm.days || []).includes(d); });
    
    const newObj = {
      id: builderModal?.isNew ? `bld_${Date.now()}` : builderForm.id,
      name: builderForm.name,
      start: builderForm.start,
      end: builderForm.end,
      color: builderForm.color.value,
      qty: Math.max(1, Number(builderForm.qty) || 1),
      cellStates: activeDays
    };

    if (builderModal?.isNew) persistBuilder([...builderShifts, newObj]);
    else persistBuilder(builderShifts.map(s => s.id === newObj.id ? newObj : s));
    setBuilderModal(null);
  };

  const toggleBuilderCell = (shiftId, dayIndex) => {
    persistBuilder(builderShifts.map(s => {
      if (s.id === shiftId) {
        const nextState = { ...(s.cellStates || {}) };
        nextState[dayIndex] = !nextState[dayIndex];
        return { ...s, cellStates: nextState };
      }
      return s;
    }));
  };

  const downloadBackupBase = () => {
    downloadFile(JSON.stringify(builderShifts, null, 2), 'backup_escala_base.json', 'application/json');
  };

  /* ============================================================
     MODO TV: ESCALA DO DIA DE TODOS OS SETORES ATIVOS
     ============================================================ */
  if (tvMode) {
    const todayStr = getLocalDateString(currentTime);
    const todayShifts = safeArray(shifts).filter(s => normalizeDate(s.date) === todayStr && getStatusKey(s.status) !== 'cancelado');

    return (
      <div className="fixed inset-0 z-[99999] bg-slate-950 text-white flex flex-col p-6 font-sans">
        <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-sky-600 rounded-2xl flex items-center justify-center">
               <Activity className="w-6 h-6 text-white" />
             </div>
             <div>
               <h1 className="text-3xl font-black text-white">Escala e Plantões TV</h1>
               <p className="text-sm text-sky-400 font-semibold">{fmtDateLong(todayStr)} • {formatDateBR(todayStr)} (Todos os Setores)</p>
             </div>
           </div>
           <div className="flex gap-6 items-center">
             <div className="text-right">
                <div className="text-3xl font-mono text-emerald-400 font-black">{currentTime.toLocaleTimeString('pt-BR')}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest">Horário Operacional</div>
             </div>
             <Button onClick={closeTvMode} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl"><Minimize2 className="w-5 h-5"/></Button>
           </div>
        </div>

        <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
           {safeArray(sectors).map(sector => {
             const secShifts = todayShifts.filter(s => String(s.sector_id) === String(sector.id));
             if (secShifts.length === 0) return null;

             return (
               <div key={sector.id} className="p-5 rounded-3xl border bg-slate-900 border-white/10 flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-sky-400" /> {sector.name}
                    </h2>
                    <span className="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-300 font-bold">{secShifts.length} plantões</span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                     {secShifts.map(s => {
                       const rStatus = getRealTimeStatus(s.date, s.start_time, s.end_time, currentTime);
                       const isVacant = !s.professional_id || normalizeStr(s.professional_name).includes('vaga');

                       const cardStyles = {
                         finalizado: 'bg-slate-800/60 border-slate-800 opacity-60',
                         andamento: 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/50',
                         planejado: 'bg-slate-800 border-slate-700'
                       }[rStatus];

                       return (
                         <div key={s.id} className={`p-4 border rounded-2xl flex items-center justify-between ${isVacant ? 'bg-amber-950/30 border-amber-500/60 animate-pulse' : cardStyles}`}>
                            <div>
                              <div className="flex items-center gap-2">
                                {isVacant ? (
                                  <span className="text-amber-400 text-[10px] font-black tracking-widest uppercase">⚠️ VAGA ABERTA</span>
                                ) : rStatus === 'andamento' ? (
                                  <span className="text-emerald-400 text-[10px] font-black tracking-widest uppercase flex items-center gap-1">● EM ATENDIMENTO</span>
                                ) : rStatus === 'finalizado' ? (
                                  <span className="text-slate-400 text-[10px] font-black tracking-widest uppercase">CONCLUÍDO</span>
                                ) : (
                                  <span className="text-sky-400 text-[10px] font-black tracking-widest uppercase">AGENDADO</span>
                                )}
                              </div>
                              <b className="text-base text-white block mt-0.5">{isVacant ? 'PLANTÃO DESCOBERTO' : toTitleCase(s.professional_name)}</b>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-mono font-bold text-slate-300">{s.start_time} às {s.end_time}</span>
                            </div>
                         </div>
                       );
                     })}
                  </div>
               </div>
             );
           })}
        </div>
      </div>
    );
  }

  /* ============================================================
     TELA PRINCIPAL (NAVEGAÇÃO 100% NO TOPO)
     ============================================================ */
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* CABEÇALHO INTEGRADO (SEM BARRA LATERAL PRETA) */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center shadow-md">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Escala e Plantões</h1>
            <p className="text-[11px] text-slate-400 font-medium">Painel unificado de gestão de plantões médicos</p>
          </div>
        </div>

        {/* ABAS SUPERIORES DE NAVEGAÇÃO */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setViewMode('grade')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all ${
              viewMode === 'grade'
                ? 'bg-white dark:bg-slate-900 shadow-sm text-sky-600 dark:text-sky-400'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> Builder Visual
          </button>
          
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-900 shadow-sm text-sky-600 dark:text-sky-400'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <List className="w-4 h-4" /> Lista Diária
          </button>
          
          <button
            onClick={() => setViewMode('base_builder')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all ${
              viewMode === 'base_builder'
                ? 'bg-white dark:bg-slate-900 shadow-sm text-sky-600 dark:text-sky-400'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" /> Configurar Escala Base
          </button>
        </div>

        {/* AÇÕES NO TOPO */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={toggleTheme} className="dark:border-slate-700">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          
          <Button variant="outline" onClick={() => loadData(true)} disabled={refreshing} className="dark:border-slate-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
          </Button>

          {viewMode === 'list' && (
            <Button onClick={() => window.print()} variant="outline" className="dark:border-slate-700 font-bold">
              <Printer className="w-4 h-4 mr-2" /> Imprimir Dia
            </Button>
          )}

          <Button onClick={() => setTvMode(true)} className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold">
            <Maximize2 className="w-4 h-4 mr-2" /> Modo TV
          </Button>

          {viewMode === 'grade' && (
            <Button onClick={handlePublish} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md">
              <Send className="w-4 h-4 mr-2" /> Publicar Escala
            </Button>
          )}
        </div>
      </header>

      {/* BARRA DE FILTROS SUPERIOR */}
      {viewMode !== 'base_builder' && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 px-8 flex flex-wrap lg:flex-nowrap items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-400">Mês:</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-9 w-44 text-xs dark:bg-slate-800 dark:border-slate-700"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.map(m => {
                  const d = new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1);
                  return <SelectItem key={m} value={m}>{d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          
          {viewMode === 'list' && (
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold uppercase text-slate-400">Dia:</label>
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="h-9 w-40 text-xs dark:bg-slate-800 dark:border-slate-700" />
            </div>
          )}

          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold uppercase text-slate-400">Setor Ativo:</label>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="h-9 text-xs dark:bg-slate-800 dark:border-slate-700"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os setores</SelectItem>
                {safeArray(sectors).filter(s => s?.id).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name || 'Sem nome'}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedCells.length > 0 && (
            <div className="bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 px-4 py-1.5 rounded-xl text-xs font-bold border border-sky-200 dark:border-sky-800 animate-pulse">
              {selectedCells.length} dias selecionados (Arraste o profissional para preencher)
            </div>
          )}
        </div>
      )}

      {/* ===================== MODO GRADE VISUAL ===================== */}
      {viewMode === 'grade' && (
        <div className="flex-1 flex overflow-hidden p-4 sm:px-8 pb-6">
          <Card className="flex-1 border-slate-200 dark:border-slate-800 shadow-sm flex overflow-hidden bg-white dark:bg-slate-900">
            
            {/* Lateral de Profissionais Cruzados por Setor */}
            <div className="w-64 bg-slate-50/50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-black text-sm text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                  <UsersRound className="w-4 h-4 text-sky-600" /> Corpo Clínico ({sidebarProfessionals.length})
                </h3>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input placeholder="Buscar profissional..." value={profSearchQuery} onChange={e => setProfSearchQuery(e.target.value)} className="pl-9 h-9 text-xs bg-white dark:bg-slate-800" />
                </div>
                <p className="text-[10px] text-slate-400 mt-2 text-center font-medium">Arraste para uma vaga na grade ➔</p>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sidebarProfessionals.map(prof => (
                  <div key={prof.id} draggable onDragStart={(e) => handleDragStart(e, prof)} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-sky-400 active:cursor-grabbing flex items-center gap-2 group transition-all">
                    <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-sky-500" />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">{prof.name || prof.full_name || 'Profissional'}</div>
                      <div className="text-[10px] text-slate-400 truncate">{prof.specialty || 'Geral'}</div>
                    </div>
                  </div>
                ))}
                {sidebarProfessionals.length === 0 && <div className="p-4 text-center text-xs text-slate-400">Nenhum profissional associado.</div>}
              </div>
            </div>

            {/* Grade de Calendário */}
            <div className="flex-1 overflow-auto bg-slate-100/30 dark:bg-slate-950 relative">
              {sectorFilter === 'todos' ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                  <Building2 className="w-12 h-12 mb-4 opacity-50 text-slate-300" />
                  <p className="font-bold text-slate-600 dark:text-slate-300">Selecione um Setor Específico</p>
                  <p className="text-sm mt-1">O modo Grade exige um setor selecionado para permitir alocação nas vagas.</p>
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

                      {builderShifts.map((period) => (
                        <div key={period.id} className="grid grid-cols-8 border-b border-slate-100 dark:border-slate-800/50 last:border-b-0 group">
                          
                          <div className="p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex flex-col items-center justify-center text-center">
                            <span className="font-black text-[11px] uppercase text-slate-700 dark:text-slate-300">{period.name}</span>
                            <span className="text-[9px] font-bold text-slate-400">{period.start} - {period.end}</span>
                          </div>

                          {week.map((date, dIndex) => {
                            if (!date) return <div key={dIndex} className="bg-slate-50 dark:bg-slate-900/20 border-r border-slate-200 dark:border-slate-800 p-2"></div>;

                            const slotShifts = filteredShifts.filter(s => String(s.date || '').startsWith(date) && s.builderId === period.id);
                            const isSelected = selectedCells.some(c => c.date === date && c.builderId === period.id);
                            
                            const dIndexBase = new Date(`${date}T12:00:00`).getDay();
                            const isActiveInBase = period.cellStates && period.cellStates[dIndexBase];
                            const requiredQty = isActiveInBase ? (period.qty || 1) : 0;
                            
                            const renders = [...slotShifts];
                            for (let q = slotShifts.length; q < requiredQty; q++) renders.push({ isVirtualVacant: true, isVacant: true });

                            return (
                              <div 
                                key={dIndex} 
                                className={`border-r border-slate-200 dark:border-slate-800/50 p-1.5 min-h-[70px] relative transition-colors cursor-pointer flex flex-col gap-1 ${isSelected ? 'bg-sky-50 dark:bg-sky-900/20 ring-inset ring-2 ring-sky-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                                onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, date, period.id)} onClick={(e) => handleCellClick(e, date, period.id)}
                                title="Ctrl+Click para multi-seleção. Clique simples para abrir modal de novo plantão."
                              >
                                {renders.length === 0 && !isActiveInBase && <div className="absolute inset-0 flex items-center justify-center opacity-30 text-xs font-black text-slate-400">-</div>}

                                {renders.map((s, idx) => (
                                  <div key={s.id || `vaga_${idx}`} className={`relative p-2 rounded-lg text-[10px] border flex items-center justify-between group/item transition-all hover:scale-[1.02] shadow-sm ${s.isVacant ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 text-amber-800 dark:text-amber-200 border-dashed' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100'}`}>
                                    <span className="font-bold truncate pr-4">{s.isVacant ? 'Vaga Aberta' : toTitleCase(s.professional_name)}</span>
                                    
                                    {!s.isVacant && isPublished && (
                                      <div className="absolute -top-2 left-2 opacity-0 group-hover/item:opacity-100 transition-opacity bg-emerald-500 text-white text-[8px] font-black px-1.5 rounded uppercase shadow-sm z-10 pointer-events-none">Publicado</div>
                                    )}

                                    {!s.isVacant && s.id && (
                                      <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="opacity-0 group-hover/item:opacity-100 p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded transition-opacity absolute right-1">
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}
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
        <div className="overflow-y-auto p-5 sm:p-8 space-y-4 bg-slate-50 dark:bg-slate-950 flex-1">
           {filteredShifts.length === 0 ? (
              <div className="py-16 text-center text-slate-400">Nenhum plantão localizado neste período.</div>
            ) : (
              filteredShifts.map(s => {
                const statusStyles = {
                  finalizado: { bg: 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-400', icon: Lock, lbl: 'Finalizado' },
                  andamento: { bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-600', icon: Activity, lbl: 'Em Andamento' },
                  planejado: { bg: 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 text-sky-600', icon: CalendarDays, lbl: 'Planejado' }
                }[s.rTimeStatus] || { bg: 'bg-slate-50 border-slate-100', icon: CalendarDays, lbl: 'Planejado' };

                return (
                  <div key={s.id} className={`flex items-center gap-4 rounded-2xl border p-4 bg-white dark:bg-slate-900 transition-colors shadow-sm ${s.isVacant ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                    <div className={`min-w-[105px] rounded-xl py-2 text-center text-xs font-black border shrink-0 ${statusStyles.bg}`}>
                      {formatDateBR(s.date)} <br/>
                      <span className="font-bold opacity-80">{s.start_time || '--'} - {s.end_time || '--'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <strong className={`block text-base truncate ${s.isVacant ? 'text-amber-800 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`}>
                        {toTitleCase(s.professional_name) || 'Vaga Aberta'}
                      </strong>
                      <span className="text-xs text-slate-400">{toTitleCase(s.sector_name)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!s.isVacant && (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${statusStyles.bg}`}>
                          <statusStyles.icon className="w-3.5 h-3.5" /> {statusStyles.lbl}
                        </div>
                      )}
                      {!s.isVacant && s.rTimeStatus !== 'finalizado' && (
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)} className="h-8 w-8 text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4"/></Button>
                      )}
                      {s.isVacant && (
                        <Button size="sm" onClick={() => { setEditing(s); setDialogOpen(true); }} className="h-9 bg-amber-500 hover:bg-amber-600 text-white font-bold"><UserPlus className="w-3.5 h-3.5 mr-1" /> Alocar</Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
        </div>
      )}

      {/* ===================== MODO BASE BUILDER ===================== */}
      {viewMode === 'base_builder' && (
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-6 flex justify-center">
          <div className="w-full max-w-5xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-sky-700 dark:text-sky-400">Escala Base (Modo Edição)</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Configure os padrões de horários e a quantidade de vagas ativas na semana.</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Data de Início da Aplicação:</label>
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
                                    <div className="absolute inset-0 bg-slate-900/80 text-white text-[10px] font-bold flex flex-col items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
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
              <Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-11 px-8 shadow-md" onClick={() => setConfirmGoToAllocation(true)}>Salvar Escala Base</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PERGUNTA PÓS-SALVAR ESCALA BASE */}
      {confirmGoToAllocation && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">Escala Base Salva!</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Gostaria de ir para a grade e começar a alocar os profissionais nas vagas agora?
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 font-bold h-11" onClick={() => setConfirmGoToAllocation(false)}>Depois</Button>
              <Button className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold h-11" onClick={() => { setConfirmGoToAllocation(false); setViewMode('grade'); }}>Sim, Alocar</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HORÁRIO DO BUILDER */}
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
                <Input value={builderForm.name} onChange={e => setBuilderForm({...builderForm, name: e.target.value})} placeholder="Ex: Manhã, Tarde, Noturno" className="h-11 font-medium bg-white dark:bg-slate-950" />
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Cor de Identificação</label>
                  <div className="flex gap-2 p-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/50">
                    {BUILDER_COLORS.map(c => (
                      <button key={c.id} onClick={() => setBuilderForm({...builderForm, color: c})} className={`w-6 h-6 rounded-md ${c.bg} shadow-sm transition-transform ${builderForm.color?.id === c.id ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 block">Dias da Semana com Plantão Ativo</label>
                <div className="flex justify-between gap-1">
                  {WEEK_DAYS_ORDER.map(day => {
                    const isSelected = (builderForm.days || []).includes(day.index);
                    return (
                      <button key={day.index} onClick={() => toggleBuilderDay(day.index)} className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${isSelected ? 'bg-sky-50 border-sky-300 text-sky-700 dark:bg-sky-900/40 dark:border-sky-700 dark:text-sky-300 shadow-sm' : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                        <span className="text-[9px] font-black uppercase mb-1">{day.short}</span>
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${isSelected ? 'bg-sky-500 border-sky-600 text-white' : 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-700'}`}>
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex justify-between items-center pt-5 mt-2">
                {!builderModal.isNew ? (
                  <Button variant="ghost" className="text-red-500 hover:bg-red-50 font-bold text-xs" onClick={() => { setBuilderShifts(prev => prev.filter(s => s.id !== builderForm.id)); persistBuilder(builderShifts.filter(s => s.id !== builderForm.id)); setBuilderModal(null); }}>
                    <Trash2 className="w-4 h-4 mr-1.5" /> Excluir
                  </Button>
                ) : <div/>}
                <Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-11 px-8 shadow-md" onClick={saveBuilderShift}>Salvar Turno</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO PLANTÃO NA GRADE (CRUZADO POR SETOR) */}
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
                    {sidebarProfessionals.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name || p.full_name || 'Sem nome'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-right text-xs font-bold text-slate-500">Equipe / Turno:</label>
                <div className="col-span-2 font-bold text-slate-900 dark:text-white capitalize px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                  {builderShifts.find(p => p.id === newShiftModal.builderId)?.name || 'Turno'}
                </div>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-right text-xs font-bold text-slate-500">Dia / Data:</label>
                <div className="col-span-2 font-bold text-slate-900 dark:text-white">{fmtDateLong(newShiftModal.date)} - {formatDateBR(newShiftModal.date)}</div>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 my-4" />
              <div className="flex justify-end">
                <Button onClick={() => { if (!selectedProfIdForModal) { alert('Selecione um profissional da lista.'); return; } assignShift(newShiftModal.date, newShiftModal.builderId, selectedProfIdForModal); setNewShiftModal(null); setSelectedProfIdForModal(''); }} className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-11 px-8 shadow-md">
                  Alocar Profissional
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG DE CRIAÇÃO AVULSA */}
      <ShiftFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={() => loadData(true)} shift={editing} sectors={sectors} professionals={professionals} companyId={companyId} unitId={unitId} />
    </div>
  );
}

export default function Escalas() {
  return (
    <SafeErrorBoundary>
      <EscalasContent />
    </SafeErrorBoundary>
  );
}