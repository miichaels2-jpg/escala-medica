import React, { Component, useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity, AlertTriangle, Building2, CalendarDays, CheckCircle2,
  Clock3, GripVertical, LayoutGrid, List, Loader2, Lock,
  Maximize2, Minimize2, Moon, Pencil, Plus, Printer,
  RefreshCw, Search, Send, SlidersHorizontal, Sun, Trash2, UserPlus,
  UsersRound, X, FileText, ShieldAlert, ArrowRightLeft, Megaphone, Ban, Check
} from 'lucide-react';
import ShiftFormDialog from '@/components/shifts/ShiftFormDialog';

/* ============================================================
   ERROR BOUNDARY
   ============================================================ */
class SafeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error?.message || 'Instabilidade no layout.' };
  }
  componentDidCatch(err, info) {
    console.error('Crash em Escalas:', err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-xl font-black">Recuperação de Interface</h2>
            <p className="text-xs text-slate-400 mt-2 mb-6">{this.state.errorMsg}</p>
            <Button
              onClick={() => {
                try { window.localStorage.removeItem('escala_setor_fixado_v25'); } catch (e) {}
                window.location.reload();
              }}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold h-11"
            >
              Recarregar Escala
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
const STORAGE_BASE_PREFIX = 'hospital_escala_base_v25';
const STORAGE_SECTOR_KEY = 'escala_setor_fixado_v25';
const STORAGE_PUBLISHED_MAP_KEY = 'hospital_escalas_publicadas_map_v25';
const STORAGE_DISABLED_DAYS_KEY = 'hospital_vagas_inativadas_map_v25';

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

function safeArray(val) { return Array.isArray(val) ? val : []; }
function safeNumber(val, fb = 0) { const n = Number(val); return Number.isFinite(n) ? n : fb; }
function normalizeDate(val) {
  if (!val) return '';
  const t = String(val).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.substring(0, 10) : t;
}
function getLocalDateString(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function normalizeStr(str) {
  return typeof str === 'string' ? str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : '';
}
function toTitleCase(str) {
  return typeof str === 'string' ? str.toLowerCase().split(' ').map(w => ['de','da','do','e'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
}
function getStatusKey(status) { return String(status || '').trim().toLowerCase(); }
function formatDateBR(dateStr) {
  if (!dateStr) return '—';
  const parts = normalizeDate(dateStr).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(dateStr);
}
function fmtDateLong(dateStr) {
  if (!dateStr) return '';
  const parts = normalizeDate(dateStr).split('-');
  if (parts.length < 3) return '';
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return WEEKDAYS_LONG[d.getDay()] || '';
}

function getShiftHours(s) {
  if (s?.duration_hours != null && Number.isFinite(Number(s.duration_hours))) return Number(s.duration_hours);
  if (s?.hours != null && Number.isFinite(Number(s.hours))) return Number(s.hours);
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

function checkTimeOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  let sA = toMin(startA), eA = toMin(endA);
  let sB = toMin(startB), eB = toMin(endB);
  if (eA <= sA) eA += 24 * 60;
  if (eB <= sB) eB += 24 * 60;
  return Math.max(sA, sB) < Math.min(eA, eB);
}

function getProfessionalId(s) { return s?.professional_id || s?.professionalId || s?.professional?.id || null; }
function getProfessionalName(s, m = {}) {
  if (s?.professional_name) return s.professional_name;
  const id = getProfessionalId(s);
  return id && m[id] ? m[id].name || m[id].full_name || 'Profissional' : 'Vaga Aberta';
}
function getSectorName(s, m = {}) {
  if (s?.sector_name) return s.sector_name;
  return s?.sector_id && m[s.sector_id] ? m[s.sector_id].name : 'Setor Geral';
}

function getRealTimeStatus(dateStr, startStr, endStr, currentTime, explicitStatus, isPublished = false) {
  const currentKey = getStatusKey(explicitStatus);
  if (currentKey === 'cancelado' || currentKey === 'falta') return 'cancelado';
  if (currentKey === 'concluido' || currentKey === 'realizado' || currentKey === 'encerrado') return 'encerrado';

  const shiftDate = normalizeDate(dateStr);
  const today = getLocalDateString(currentTime);

  if (shiftDate < today) return 'encerrado';

  if (shiftDate === today && startStr && endStr) {
    const currentHour = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
    if (startStr > endStr) {
      if (currentHour >= startStr || currentHour <= endStr) return 'andamento';
    } else {
      if (currentHour < startStr) return isPublished ? 'publicado' : 'programado';
      if (currentHour >= startStr && currentHour <= endStr) return 'andamento';
      if (currentHour > endStr) return 'encerrado';
    }
  }

  return isPublished ? 'publicado' : 'programado';
}

function getMonthWeeks(monthStr, startDateFilter = '', endDateFilter = '') {
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
    const dateStr = getLocalDateString(new Date(year, month - 1, d));
    
    if ((startDateFilter && dateStr < startDateFilter) || (endDateFilter && dateStr > endDateFilter)) {
      currentWeek.push('disabled');
    } else {
      currentWeek.push(dateStr);
    }

    if (currentWeek.length === 7) { 
      weeks.push(currentWeek); 
      currentWeek = []; 
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }
  return weeks;
}

const escapeHtml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ============================================================
   COMPONENTE PRINCIPAL
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

  const [viewMode, setViewMode] = useState('grade'); 
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalDateString().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState('');
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const [theme, setTheme] = useState('dark');

  const [scaleStartDate, setScaleStartDate] = useState(() => getLocalDateString());
  const [scaleModeScope, setScaleModeScope] = useState('apartir_hoje');

  const [sectorFilter, setSectorFilter] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_SECTOR_KEY);
      return saved && saved !== 'undefined' && saved !== 'null' ? saved : 'todos';
    } catch {
      return 'todos';
    }
  });

  const [profSearchQuery, setProfSearchQuery] = useState('');
  const [selectedCells, setSelectedCells] = useState([]);

  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishRange, setPublishRange] = useState({
    preset: '1_mes',
    start: getLocalDateString(),
    end: (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return getLocalDateString(d);
    })()
  });
  const [publishedMap, setPublishedMap] = useState(() => {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_PUBLISHED_MAP_KEY}:${companyId}`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  const [disabledDaysMap, setDisabledDaysMap] = useState(() => {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_DISABLED_DAYS_KEY}:${companyId}`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  const [newShiftModal, setNewShiftModal] = useState(null); 
  const [selectedProfIdForModal, setSelectedProfIdForModal] = useState(''); 
  const [retroactiveReason, setRetroactiveReason] = useState('');
  const [retroactivePerformed, setRetroactivePerformed] = useState('concluido');
  const [conflictModal, setConflictModal] = useState(null);
  const [vacancyMenuModal, setVacancyMenuModal] = useState(null);
  const [dayScheduleModal, setDayScheduleModal] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tvMode, setTvMode] = useState(false);
  
  const [builderModal, setBuilderModal] = useState(null);
  const [builderShifts, setBuilderShifts] = useState([]);
  const [builderForm, setBuilderForm] = useState({ 
    id: '', 
    name: '', 
    start: '', 
    end: '', 
    qty: 1, 
    color: BUILDER_COLORS[0], 
    days: [1,2,3,4,5],
    startDate: getLocalDateString(),
    endDate: (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return getLocalDateString(d);
    })()
  });
  const [confirmGoToAllocation, setConfirmGoToAllocation] = useState(false);

  const openNewBuilderModal = useCallback(() => {
    setBuilderForm({ 
      id: '', 
      name: '', 
      start: '', 
      end: '', 
      qty: 1, 
      color: BUILDER_COLORS[0], 
      days: [1,2,3,4,5],
      startDate: getLocalDateString(),
      endDate: (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return getLocalDateString(d);
      })()
    });
    setBuilderModal({ isNew: true });
  }, []);

  const openEditBuilderModal = useCallback((shiftObj) => {
    if (!shiftObj) return;
    const selectedColor = BUILDER_COLORS.find(c => c.value === shiftObj.color) || BUILDER_COLORS[0];
    const activeDays = [];
    [0, 1, 2, 3, 4, 5, 6].forEach(d => { if ((shiftObj.cellStates || {})[d]) activeDays.push(d); });
    setBuilderForm({ 
      id: shiftObj.id, 
      name: shiftObj.name, 
      start: shiftObj.start, 
      end: shiftObj.end, 
      qty: shiftObj.qty || 1, 
      color: selectedColor, 
      days: activeDays,
      startDate: shiftObj.startDate || getLocalDateString(),
      endDate: shiftObj.endDate || (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return getLocalDateString(d);
      })()
    });
    setBuilderModal({ isNew: false });
  }, []);

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem('hospital-intelligence-theme') || 'dark';
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } catch { 
      setTheme('dark'); 
      document.documentElement.classList.add('dark');
    }
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    try { window.localStorage.setItem('hospital-intelligence-theme', nextTheme); } catch {}
  };

  const handleSectorChange = (newSectorId) => {
    setSectorFilter(newSectorId);
    try { window.localStorage.setItem(STORAGE_SECTOR_KEY, newSectorId); } catch (e) {}
  };

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const query = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
      const [sRaw, secRaw, pRaw] = await Promise.all([
        base44?.entities?.Shift?.filter ? base44.entities.Shift.filter(query, '-date', 5000).catch(() => []) : [],
        base44?.entities?.Sector?.filter ? base44.entities.Sector.filter(query, '-created_date', 300).catch(() => []) : [],
        base44?.entities?.Professional?.filter ? base44.entities.Professional.filter(query, '-created_date', 2000).catch(() => []) : [],
      ]);

      setShifts(safeArray(Array.isArray(sRaw) ? sRaw : sRaw?.data));
      setSectors(safeArray(Array.isArray(secRaw) ? secRaw : secRaw?.data));
      setProfessionals(safeArray(Array.isArray(pRaw) ? pRaw : pRaw?.data));
    } catch (e) {
      console.warn("Erro ao carregar dados:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, unitId]);

  useEffect(() => { if (!appLoading) loadData(); }, [appLoading, loadData]);
  useEffect(() => { const id = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(id); }, []);

  useEffect(() => {
    if (sectorFilter === 'todos') {
      setBuilderShifts([]);
      return;
    }
    try {
      const key = `${STORAGE_BASE_PREFIX}:${companyId}:${sectorFilter}`;
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setBuilderShifts(parsed);
          return;
        }
      }
    } catch (e) {}
    setBuilderShifts([]);
  }, [companyId, sectorFilter]);

  const persistBuilder = (newShifts) => {
    setBuilderShifts(newShifts);
    if (sectorFilter !== 'todos') {
      try {
        window.localStorage.setItem(`${STORAGE_BASE_PREFIX}:${companyId}:${sectorFilter}`, JSON.stringify(newShifts));
      } catch (e) {}
    }
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

  const activeSectorName = useMemo(() => {
    if (sectorFilter === 'todos') return 'Todos os Setores';
    const s = safeArray(sectors).find(sec => String(sec.id) === String(sectorFilter));
    return s?.name || 'Setor Selecionado';
  }, [sectors, sectorFilter]);

  const monthOptions = useMemo(() => {
    const opts = new Set(safeArray(shifts).map(s => s?.date ? String(s.date).slice(0, 7) : ''));
    if (selectedMonth) opts.add(selectedMonth);
    return [...opts].filter(Boolean).sort().reverse();
  }, [shifts, selectedMonth]);

  const isShiftPublished = useCallback((shiftDate, secId) => {
    const pub = publishedMap[secId];
    if (!pub) return false;
    const date = normalizeDate(shiftDate);
    return date >= normalizeDate(pub.start) && date <= normalizeDate(pub.end);
  }, [publishedMap]);

  const filteredShifts = useMemo(() => {
    const result = safeArray(shifts).filter(s => {
      if (!s || getStatusKey(s.status) === 'cancelado') return false;
      const sDate = normalizeDate(s.date);
      if (!sDate) return false;

      if (viewMode === 'list' && selectedDate) {
        if (sDate !== selectedDate) return false;
      } else {
        if (selectedMonth && !sDate.startsWith(selectedMonth)) return false;
      }

      if (sectorFilter !== 'todos' && String(s.sector_id) !== String(sectorFilter)) return false;
      return true;
    }).map(s => {
      const pName = typeof s.professional_name === 'string' ? s.professional_name.toLowerCase() : '';
      const published = isShiftPublished(s.date, s.sector_id);
      const rTimeStatus = getRealTimeStatus(s.date, s.start_time, s.end_time, currentTime, s.status, published);
      return { 
        ...s, 
        rTimeStatus, 
        isVacant: !s.professional_id || pName.includes('vaga')
      };
    });

    return result.sort((a, b) => {
      if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
      return String(a.start_time || '').localeCompare(String(b.start_time || ''));
    });
  }, [shifts, sectorFilter, selectedMonth, selectedDate, viewMode, currentTime, isShiftPublished]);

  const weeksDataGrid = useMemo(() => {
    const startDateFilter = scaleModeScope === 'apartir_hoje' ? scaleStartDate : '';
    const firstShift = builderShifts[0];
    const sDateFilter = startDateFilter || firstShift?.startDate || '';
    const eDateFilter = firstShift?.endDate || '';
    return getMonthWeeks(selectedMonth, sDateFilter, eDateFilter);
  }, [selectedMonth, scaleModeScope, scaleStartDate, builderShifts]);

  const displayShiftsForSector = useMemo(() => {
    if (sectorFilter === 'todos') return [];
    
    const base = safeArray(builderShifts);
    if (base.length > 0) return base;

    const sectorShiftsInMonth = filteredShifts.filter(s => String(s.sector_id) === String(sectorFilter));
    const timeSlots = new Map();

    sectorShiftsInMonth.forEach(s => {
      if (s.start_time && s.end_time) {
        const key = `${s.start_time}-${s.end_time}`;
        if (!timeSlots.has(key)) {
          let name = 'Turno';
          if (s.start_time >= '06:00' && s.start_time < '13:00') name = 'Manhã';
          else if (s.start_time >= '13:00' && s.start_time < '19:00') name = 'Tarde';
          else name = 'Noite';

          timeSlots.set(key, {
            id: `auto_${key}`,
            name,
            start: s.start_time,
            end: s.end_time,
            qty: 1,
            cellStates: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true }
          });
        }
      }
    });

    if (timeSlots.size > 0) return Array.from(timeSlots.values());
    return [];
  }, [sectorFilter, builderShifts, filteredShifts]);

  const sidebarProfessionals = useMemo(() => {
    const term = normalizeStr(profSearchQuery);
    return safeArray(professionals).filter(p => {
      if (!p?.id) return false;
      const matchesSearch = !term || normalizeStr(p.name || p.full_name).includes(term) || normalizeStr(p.specialty).includes(term);
      const matchesSector = sectorFilter === 'todos' || !p.sector_id || String(p.sector_id) === String(sectorFilter) || (Array.isArray(p.sectors) && p.sectors.includes(sectorFilter));
      return matchesSearch && matchesSector;
    });
  }, [professionals, profSearchQuery, sectorFilter]);

  const isDateRetroactive = (dateStr) => normalizeDate(dateStr) < getLocalDateString(currentTime);

  const handleCellClick = (e, date, shiftObj, sectorIdTarget = null) => {
    if (date === 'disabled') return;
    const secId = sectorIdTarget || sectorFilter;
    setVacancyMenuModal({ date, shiftObj, sectorId: secId });
  };

  const handleDragStart = (e, prof) => { if (prof?.id) e.dataTransfer.setData('profId', prof.id); };
  const handleDragOver = (e) => { e.preventDefault(); };

  const validateProfessionalShiftConflict = (profId, targetDate, targetStart, targetEnd, currentShiftId = null) => {
    const existingShifts = safeArray(shifts).filter(s => {
      if (currentShiftId && s.id === currentShiftId) return false;
      if (getStatusKey(s.status) === 'cancelado') return false;
      return String(getProfessionalId(s)) === String(profId) && normalizeDate(s.date) === normalizeDate(targetDate);
    });

    for (const shift of existingShifts) {
      if (checkTimeOverlap(targetStart, targetEnd, shift.start_time, shift.end_time)) {
        const secName = getSectorName(shift, sectorMap);
        return {
          conflict: true,
          conflictingShift: shift,
          message: `O profissional já possui plantão escalado no setor "${secName}" das ${shift.start_time} às ${shift.end_time} em ${formatDateBR(targetDate)}.`
        };
      }
    }
    return { conflict: false };
  };

  const assignShift = async (date, shiftDef, profId, reasonText = '', explicitStatus = 'confirmado', sectorTarget = null, forceRemapShiftId = null) => {
    const secId = sectorTarget && sectorTarget !== 'todos' ? sectorTarget : sectorFilter;
    if (secId === 'todos') { alert("Selecione uma seção específica no topo para alocar o profissional."); return; }
    
    const prof = professionalMap[profId];
    const sectorObj = safeArray(sectors).find(s => String(s.id) === String(secId));
    if (!prof || !sectorObj) return;

    if (!forceRemapShiftId) {
      const conflictCheck = validateProfessionalShiftConflict(profId, date, shiftDef.start, shiftDef.end);
      if (conflictCheck.conflict) {
        setConflictModal({
          prof,
          date,
          shiftDef,
          sectorTarget: secId,
          reasonText,
          explicitStatus,
          message: conflictCheck.message,
          oldShift: conflictCheck.conflictingShift
        });
        return;
      }
    }

    try {
      const existingShift = safeArray(filteredShifts).find(s => 
        String(s.date || '').startsWith(date) && 
        s.start_time === shiftDef.start && 
        s.end_time === shiftDef.end && 
        String(s.sector_id) === String(secId) &&
        s.isVacant
      );

      const hours = getShiftHours({ start_time: shiftDef.start, end_time: shiftDef.end });
      const remType = String(prof?.remuneration_type || prof?.remunerationType || 'hora').toLowerCase();
      
      let rate = safeNumber(prof?.hourly_rate ?? prof?.hourlyRate, 120);
      let calculatedTotal = 0;

      if (remType === 'diaria') {
        rate = safeNumber(prof?.daily_rate ?? prof?.dailyRate, 1500);
        calculatedTotal = rate;
      } else if (remType === 'mensal') {
        const monthly = safeNumber(prof?.monthly_salary ?? prof?.monthlySalary, 18000);
        const workHours = safeNumber(prof?.monthly_work_hours ?? prof?.monthlyWorkHours, 220);
        rate = workHours > 0 ? monthly / workHours : 80;
        calculatedTotal = rate * hours;
      } else {
        calculatedTotal = rate * hours;
      }

      const notes = [
        `Turno: ${shiftDef.name}`,
        reasonText ? `Justificativa Retroativo: ${reasonText}` : null
      ].filter(Boolean).join(' | ');

      const payload = { 
        company_id: companyId, 
        unit_id: unitId, 
        professional_id: prof.id, 
        professional_name: prof.name || prof.full_name || 'Profissional', 
        sector_id: sectorObj.id, 
        sector_name: sectorObj.name, 
        date: date, 
        start_time: shiftDef.start, 
        end_time: shiftDef.end, 
        duration_hours: hours,
        hours: hours,
        hourly_rate: rate,
        rate: rate,
        valor_hora: rate,
        total_amount: calculatedTotal,
        valor_total: calculatedTotal,
        cost: calculatedTotal,
        status: explicitStatus,
        notes
      };

      if (forceRemapShiftId) {
        await base44.entities.Shift.update(forceRemapShiftId, {
          status: 'cancelado',
          notes: `Remanejado para ${sectorObj.name}`
        });
      }
      
      if (existingShift?.id) await base44.entities.Shift.update(existingShift.id, payload);
      else await base44.entities.Shift.create(payload);
      
      loadData(true);
    } catch (error) {
      alert("Erro ao salvar plantão: " + (error?.message || 'Tente novamente.'));
    }
  };

  const handleSendToOpportunitiesMural = async (date, shiftDef, secId) => {
    const sectorObj = safeArray(sectors).find(s => String(s.id) === String(secId));
    if (!sectorObj) return;

    try {
      const hours = getShiftHours({ start_time: shiftDef.start, end_time: shiftDef.end });
      const payload = {
        company_id: companyId,
        unit_id: unitId,
        professional_id: null,
        professional_name: 'Vaga Aberta',
        sector_id: sectorObj.id,
        sector_name: sectorObj.name,
        date: date,
        start_time: shiftDef.start,
        end_time: shiftDef.end,
        duration_hours: hours,
        status: 'aberto',
        notes: `Disponível no Mural de Oportunidades • Turno: ${shiftDef.name}`
      };

      await base44.entities.Shift.create(payload);
      loadData(true);
      alert('Vaga disponibilizada no Mural de Oportunidades!');
    } catch (e) {
      alert('Erro ao enviar vaga ao mural: ' + e.message);
    }
  };

  const handleToggleDayInactive = (date, shiftId) => {
    const key = `${date}:${shiftId}`;
    const nextMap = { ...disabledDaysMap, [key]: !disabledDaysMap[key] };
    setDisabledDaysMap(nextMap);
    try {
      window.localStorage.setItem(`${STORAGE_DISABLED_DAYS_KEY}:${companyId}`, JSON.stringify(nextMap));
    } catch (e) {}
  };

  const handleDrop = (e, date, shiftDef, sectorTarget = null) => {
    e.preventDefault();
    if (date === 'disabled') return;
    const profId = e.dataTransfer.getData('profId');
    if (!profId) return;

    if (isDateRetroactive(date)) {
      setNewShiftModal({ date, shiftObj: shiftDef, sectorIdTarget: sectorTarget || sectorFilter, preSelectedProfId: profId });
      return;
    }

    assignShift(date, shiftDef, profId, '', 'confirmado', sectorTarget);
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja cancelar este plantão? Ele será removido do faturamento.')) return;
    try {
      await base44.entities.Shift.update(id, { status: 'cancelado' });
      loadData(true);
    } catch (e) {
      alert('Erro ao cancelar.');
    }
  };

  const saveBuilderShiftAndPropagate = async () => {
    if (sectorFilter === 'todos') {
      alert('Selecione um setor específico no topo antes de salvar os turnos da Escala Base.');
      return;
    }
    if (!builderForm.name || !builderForm.start || !builderForm.end) {
      alert('Preencha o nome do turno, horário inicial e final.');
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
      cellStates: activeDays,
      startDate: builderForm.startDate,
      endDate: builderForm.endDate
    };

    const nextShifts = builderModal?.isNew 
      ? [...builderShifts, newObj] 
      : builderShifts.map(s => s.id === newObj.id ? newObj : s);

    persistBuilder(nextShifts);
    setBuilderModal(null);

    if (!builderModal.isNew) {
      const confirmPropagate = confirm(`Deseja propagar a alteração de horário/regras do turno "${newObj.name}" para todos os plantões futuros vinculados no sistema (atualizando escala, painel e faturamento)?`);
      if (confirmPropagate) {
        setLoading(true);
        try {
          const targetShifts = safeArray(shifts).filter(s => 
            String(s.sector_id) === String(sectorFilter) &&
            getStatusKey(s.status) !== 'cancelado' &&
            normalizeDate(s.date) >= getLocalDateString(currentTime)
          );

          const updates = targetShifts.map(async (s) => {
            const hours = getShiftHours({ start_time: newObj.start, end_time: newObj.end });
            const prof = professionalMap[s.professional_id];
            let rate = safeNumber(s.hourly_rate || prof?.hourly_rate, 120);
            let calculatedTotal = rate * hours;

            return base44.entities.Shift.update(s.id, {
              start_time: newObj.start,
              end_time: newObj.end,
              duration_hours: hours,
              hours: hours,
              total_amount: calculatedTotal,
              valor_total: calculatedTotal,
              cost: calculatedTotal,
              notes: `Turno atualizado: ${newObj.name}`
            });
          });

          await Promise.all(updates);
          await loadData(true);
          alert('Alteração propagada com sucesso em todo o sistema!');
        } catch (e) {
          alert('Erro ao propagar alterações: ' + e.message);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const deleteBuilderShift = (shiftId) => {
    if (!confirm('Deseja excluir este turno da grade?')) return;
    persistBuilder(builderShifts.filter(s => s.id !== shiftId));
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

  /* ============================================================
     IMPRESSÃO DO MURAL A4
     ============================================================ */
  const printOfficialHospitalSchedule = () => {
    const targetDate = selectedDate || getLocalDateString(currentTime);
    const dayShifts = safeArray(shifts).filter(s => normalizeDate(s.date) === targetDate && getStatusKey(s.status) !== 'cancelado');

    const groupedBySector = {};
    dayShifts.forEach(s => {
      const secName = s.sector_name || 'Setor Geral';
      if (!groupedBySector[secName]) groupedBySector[secName] = [];
      groupedBySector[secName].push(s);
    });

    const printWin = window.open('', '_blank', 'width=1300,height=900');
    if (!printWin) {
      alert('Permita pop-ups no navegador para emitir a escala de impressão.');
      return;
    }

    let tablesHtml = '';
    Object.keys(groupedBySector).sort().forEach(secName => {
      const sectorShifts = groupedBySector[secName].sort((a,b) => String(a.start_time).localeCompare(String(b.start_time)));
      
      const rows = sectorShifts.map(s => {
        const published = isShiftPublished(s.date, s.sector_id);
        const rStatus = getRealTimeStatus(s.date, s.start_time, s.end_time, currentTime, s.status, published);
        
        const statusLabel = {
          encerrado: '<span style="color:#ef4444; font-weight:bold;">● Encerrado</span>',
          andamento: '<span style="color:#10b981; font-weight:bold;">● Em Atendimento</span>',
          publicado: '<span style="color:#0284c7; font-weight:bold;">● Publicado</span>',
          programado: '<span style="color:#0284c7; font-weight:bold;">● Programado</span>'
        }[rStatus] || '● Programado';

        const isVacant = !s.professional_id || normalizeStr(s.professional_name).includes('vaga');
        const profName = isVacant ? '<span style="color:#f59e0b; font-weight:bold;">[ VAGA DESCOBERTA ]</span>' : escapeHtml(toTitleCase(s.professional_name));
        const profObj = professionalMap[s.professional_id];
        const docReg = profObj?.registration_number ? ` (CRM/COREN: ${profObj.registration_number})` : '';

        return `
          <tr>
            <td style="padding: 8px 10px; border: 1px solid #94a3b8; font-family: monospace; font-size: 11px; font-weight: bold; background: #f8fafc;">
              ${s.start_time} às ${s.end_time}
            </td>
            <td style="padding: 8px 10px; border: 1px solid #94a3b8; font-size: 12px; font-weight: bold;">
              ${profName} <span style="font-size: 10px; font-weight: normal; color: #64748b;">${escapeHtml(docReg)}</span>
            </td>
            <td style="padding: 8px 10px; border: 1px solid #94a3b8; font-size: 11px;">
              ${escapeHtml(profObj?.specialty || 'Clínica')}
            </td>
            <td style="padding: 8px 10px; border: 1px solid #94a3b8; font-size: 11px; text-align: center;">
              ${isVacant ? '<span style="color:#f59e0b; font-weight:bold;">● Aberta</span>' : statusLabel}
            </td>
            <td style="padding: 8px 10px; border: 1px solid #94a3b8; width: 140px;"></td>
          </tr>
        `;
      }).join('');

      tablesHtml += `
        <div style="margin-bottom: 20px; page-break-inside: avoid;">
          <div style="background: #0f172a; color: white; padding: 6px 10px; font-size: 12px; font-weight: bold; text-transform: uppercase; border-radius: 4px 4px 0 0;">
            SETOR: ${escapeHtml(secName)} (${sectorShifts.length} Plantonistas)
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background: #e2e8f0; color: #0f172a; text-transform: uppercase; font-size: 10px;">
                <th style="padding: 6px 10px; border: 1px solid #94a3b8; text-align: left; width: 120px;">Horário</th>
                <th style="padding: 6px 10px; border: 1px solid #94a3b8; text-align: left;">Plantonista Escalado</th>
                <th style="padding: 6px 10px; border: 1px solid #94a3b8; text-align: left; width: 150px;">Especialidade</th>
                <th style="padding: 6px 10px; border: 1px solid #94a3b8; text-align: center; width: 130px;">Status</th>
                <th style="padding: 6px 10px; border: 1px solid #94a3b8; text-align: center; width: 140px;">Assinatura / Visto</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    });

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>Escala Oficial do Dia - ${formatDateBR(targetDate)}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'Arial', sans-serif; color: #0f172a; margin: 0; padding: 0; background: #ffffff; }
            .header-box { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 18px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin: 0; }
            .subtitle { font-size: 12px; color: #475569; font-weight: bold; margin-top: 4px; }
            .meta { text-align: right; font-size: 10px; color: #334155; }
            .signatures-box { display: flex; justify-content: space-between; margin-top: 35px; page-break-inside: avoid; }
            .sig-line { width: 280px; border-top: 1px solid #0f172a; text-align: center; font-size: 10px; font-weight: bold; padding-top: 4px; }
            @media screen {
              body { background: #e2e8f0; padding: 25px; }
              .sheet { background: #ffffff; padding: 30px; max-width: 1300px; margin: 0 auto; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
              .no-print { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 15px; }
              .no-print button { padding: 8px 16px; font-weight: bold; cursor: pointer; border-radius: 6px; border: 0; }
              .btn-p { background: #0284c7; color: white; }
              .btn-c { background: #94a3b8; color: white; }
            }
            @media print {
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="btn-p" onclick="window.print()">Imprimir A4 Mural</button>
            <button class="btn-c" onclick="window.close()">Fechar</button>
          </div>
          <div class="sheet">
            <div class="header-box">
              <div>
                <h1 class="title">ESCALA OPERACIONAL DIÁRIA DE PLANTÕES</h1>
                <div class="subtitle">DATA OFICIAL: ${formatDateBR(targetDate)} (${fmtDateLong(targetDate).toUpperCase()})</div>
              </div>
              <div class="meta">
                <div><strong>Unidade:</strong> ${escapeHtml(company?.name || 'Hospital')}</div>
                <div><strong>Emissão:</strong> ${new Date().toLocaleString('pt-BR')}</div>
              </div>
            </div>

            ${tablesHtml || '<div style="padding: 40px; text-align: center; color: #64748b; font-weight: bold;">Nenhum plantão ativo cadastrado para a data de hoje.</div>'}

            <div class="signatures-box">
              <div class="sig-line">Coordenação Médica / Plantão Controlador</div>
              <div class="sig-line">Diretoria Clínica / Gestão Hospitalar</div>
            </div>
          </div>
          <script>window.onload = function() { setTimeout(function(){ window.print(); }, 400); };</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const todayTarget = selectedDate || getLocalDateString(currentTime);
  const shiftsTodayModal = safeArray(shifts).filter(s => normalizeDate(s.date) === todayTarget && getStatusKey(s.status) !== 'cancelado');

  const groupedModalBySector = useMemo(() => {
    const map = {};
    shiftsTodayModal.forEach(s => {
      const secName = s.sector_name || 'Setor Geral';
      if (!map[secName]) map[secName] = [];
      map[secName].push(s);
    });
    return map;
  }, [shiftsTodayModal]);

  /* ============================================================
     RENDER DO MODO TV
     ============================================================ */
  if (tvMode) {
    const todayStr = getLocalDateString(currentTime);
    const todayShifts = safeArray(shifts).filter(s => normalizeDate(s.date) === todayStr && getStatusKey(s.status) !== 'cancelado');

    return (
      <div className="fixed inset-0 z-[99999] bg-slate-950 text-white flex flex-col p-4 sm:p-6 font-sans overflow-hidden">
        
        {/* CABEÇALHO DO MODO TV COM RELÓGIO CENTRAL E BOTÃO SAIR SEM SOBREPOSIÇÃO */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 mb-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-600/30">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">Escala do Dia (Modo TV)</h1>
              <p className="text-xs text-sky-400 font-semibold">{fmtDateLong(todayStr)} • {formatDateBR(todayStr)}</p>
            </div>
          </div>

          <div className="text-center px-5 py-1.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-inner">
            <div className="text-2xl sm:text-3xl font-mono text-emerald-400 font-black tracking-wider leading-tight">
              {currentTime.toLocaleTimeString('pt-BR')}
            </div>
            <div className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold">Horário Oficial</div>
          </div>

          <button 
            onClick={() => setTvMode(false)}
            className="bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-rose-400 hover:text-rose-300 px-4 py-2 rounded-2xl font-bold text-xs shadow-lg flex items-center gap-2 border border-slate-700 shrink-0"
          >
            <X className="w-4 h-4 text-rose-500" /> Sair do Modo TV
          </button>
        </div>

        {/* CORPO DA TV COM CARDS NEUTROS E BOLINHA DE STATUS COLORIDA */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-8">
           {safeArray(sectors).map(sector => {
             const secShifts = todayShifts.filter(s => String(s.sector_id) === String(sector.id));
             if (secShifts.length === 0) return null;

             return (
               <div key={sector.id} className="p-4 rounded-2xl border bg-slate-900/90 border-slate-800 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
                    <h2 className="text-base font-black text-white flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-sky-400" /> {sector.name}
                    </h2>
                    <span className="text-[10px] bg-slate-800 px-3 py-0.5 rounded-full text-slate-300 font-bold">
                      {secShifts.length} plantonistas
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                     {secShifts.map(s => {
                       const published = isShiftPublished(s.date, s.sector_id);
                       const rStatus = getRealTimeStatus(s.date, s.start_time, s.end_time, currentTime, s.status, published);
                       const isVacant = !s.professional_id || normalizeStr(s.professional_name).includes('vaga');

                       return (
                         <div key={s.id} className="p-3 border rounded-xl flex items-center justify-between gap-2.5 transition-all shadow-md bg-slate-900/90 border-slate-800">
                            <div className="min-w-0 flex-1">
                              {/* BOLINHA COLORIDA INDICADORA COM NOME DO STATUS */}
                              <div className="flex items-center gap-1.5 mb-1 text-[10px] font-black tracking-wider uppercase">
                                {isVacant ? (
                                  <span className="text-amber-400 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
                                    VAGA ABERTA
                                  </span>
                                ) : rStatus === 'andamento' ? (
                                  <span className="text-emerald-400 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                                    EM ATENDIMENTO
                                  </span>
                                ) : rStatus === 'encerrado' ? (
                                  <span className="text-rose-500 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                                    ENCERRADO
                                  </span>
                                ) : (
                                  <span className="text-sky-400 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                                    PROGRAMADO
                                  </span>
                                )}
                              </div>
                              
                              <b className="text-sm font-bold block truncate leading-tight text-slate-100">
                                {isVacant ? 'PLANTÃO DESCOBERTO' : toTitleCase(s.professional_name)}
                              </b>
                            </div>
                            
                            <div className="text-right shrink-0">
                              <span className="text-xs font-mono font-bold text-slate-300 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 block">
                                {s.start_time} - {s.end_time}
                              </span>
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
     LAYOUT PRINCIPAL
     ============================================================ */
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* CABEÇALHO */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center shadow-md">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 dark:text-white">Escala e Plantões</h1>
              <div className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {activeSectorName}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              <span>{fmtDateLong(getLocalDateString(currentTime))} • {formatDateBR(getLocalDateString(currentTime))}</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{currentTime.toLocaleTimeString('pt-BR')}</span>
              
              <button
                type="button"
                onClick={handleToggleTheme}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ml-1 text-slate-600 dark:text-slate-300"
                title={theme === 'dark' ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
              </button>
            </div>
          </div>
        </div>

        {/* ABAS */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setViewMode('grade')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-black rounded-lg transition-all ${
              viewMode === 'grade' ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Builder Visual
          </button>
          
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-black rounded-lg transition-all ${
              viewMode === 'list' ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" /> Lista Diária
          </button>
          
          <button
            onClick={() => setViewMode('base_builder')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-black rounded-lg transition-all ${
              viewMode === 'base_builder' ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Escala Base ({activeSectorName})
          </button>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadData(true)} disabled={refreshing} className="border-slate-200 dark:border-slate-800 text-xs h-9">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
          </Button>

          <Button onClick={() => setDayScheduleModal(true)} variant="outline" className="border-sky-500/40 text-sky-600 dark:text-sky-400 text-xs h-9 font-bold bg-sky-50 dark:bg-sky-950/20">
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Escala do Dia
          </Button>

          <Button onClick={() => setTvMode(true)} className="bg-slate-800 hover:bg-slate-700 text-white text-xs h-9 font-bold">
            <Maximize2 className="w-3.5 h-3.5 mr-1.5" /> Modo TV
          </Button>

          {viewMode === 'grade' && (
            <Button onClick={() => setPublishModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-bold shadow-md">
              <Send className="w-3.5 h-3.5 mr-1.5" /> Publicar Escala
            </Button>
          )}
        </div>
      </header>

      {/* BARRA DE FILTROS E ESCOPO DE DATA */}
      {viewMode !== 'base_builder' && (
        <div className="bg-slate-200/50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 p-2.5 px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Mês:</span>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-8 w-40 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map(m => {
                    const d = new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1);
                    return <SelectItem key={m} value={m}>{d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2 bg-white dark:bg-slate-950 px-3 py-1 rounded-xl border border-slate-300 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400">Início:</span>
              <select 
                value={scaleModeScope} 
                onChange={e => setScaleModeScope(e.target.value)}
                className="bg-transparent text-xs font-bold text-sky-600 dark:text-sky-400 outline-none cursor-pointer"
              >
                <option value="apartir_hoje">A partir de Hoje ({formatDateBR(getLocalDateString())})</option>
                <option value="mes_inteiro">Mês Inteiro</option>
              </select>
            </div>

            {viewMode === 'list' && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Dia:</span>
                <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="h-8 w-36 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800" />
                {selectedDate && <button onClick={() => setSelectedDate('')} className="text-xs text-sky-600 dark:text-sky-400 hover:underline">Ver mês inteiro</button>}
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Seção Ativa:</span>
              <Select value={sectorFilter} onValueChange={handleSectorChange}>
                <SelectTrigger className="h-8 w-56 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 font-bold text-sky-600 dark:text-sky-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os setores</SelectItem>
                  {safeArray(sectors).filter(s => s?.id).map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name || 'Sem nome'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {publishedMap[sectorFilter] && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold">
                ✓ Publicada até {formatDateBR(publishedMap[sectorFilter].end)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MODO GRADE VISUAL (BUILDER) - COM BOLINHAS DE STATUS
          ======================================================== */}
      {viewMode === 'grade' && (
        <div className="flex-1 flex overflow-hidden p-4 sm:px-6 pb-4">
          <Card className="flex-1 border-slate-200 dark:border-slate-800 shadow-sm flex overflow-hidden bg-white dark:bg-slate-900">
            
            {/* Lateral de Profissionais */}
            <div className="w-72 bg-slate-50/70 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <UsersRound className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> Corpo Clínico
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">{sidebarProfessionals.length}</span>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                  <Input placeholder="Buscar profissional..." value={profSearchQuery} onChange={e => setProfSearchQuery(e.target.value)} className="pl-8 h-7 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {sidebarProfessionals.map(prof => (
                  <div key={prof.id} draggable onDragStart={(e) => handleDragStart(e, prof)} className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500 rounded-xl shadow-sm cursor-grab active:cursor-grabbing flex items-center gap-2 group transition-all">
                    <GripVertical className="w-4 h-4 text-slate-400 group-hover:text-sky-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100 break-words leading-tight">{prof.name || prof.full_name || 'Profissional'}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{prof.specialty || 'Clínico Geral'}</div>
                    </div>
                  </div>
                ))}
                {sidebarProfessionals.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-400">Nenhum profissional para {activeSectorName}.</div>
                )}
              </div>
            </div>

            {/* Grade de Calendário */}
            <div className="flex-1 overflow-auto bg-slate-50/30 dark:bg-slate-950 relative">
              {sectorFilter === 'todos' ? (
                <div className="p-4 space-y-6">
                  {safeArray(sectors).map(sec => {
                    const secShifts = filteredShifts.filter(s => String(s.sector_id) === String(sec.id));
                    if (secShifts.length === 0) return null;

                    return (
                      <div key={sec.id} className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                        <div className="bg-slate-100 dark:bg-slate-800/60 p-3 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                          <h3 className="font-black text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-sky-600 dark:text-sky-400" /> {sec.name}
                          </h3>
                          <span className="text-xs text-slate-500 font-bold">{secShifts.length} plantões no mês</span>
                        </div>

                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {secShifts.map(s => (
                            <div key={s.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between shadow-sm">
                              <div>
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                                  <span>{formatDateBR(s.date)}</span>
                                  <span className="font-mono">{s.start_time} - {s.end_time}</span>
                                </div>
                                <div className="font-black text-xs text-slate-900 dark:text-slate-100 break-words">{s.isVacant ? 'Vaga Aberta' : toTitleCase(s.professional_name)}</div>
                              </div>
                              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                                <span className="flex items-center gap-1.5 font-bold uppercase">
                                  {s.isVacant ? (
                                    <span className="text-amber-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Vaga Aberta</span>
                                  ) : s.rTimeStatus === 'encerrado' ? (
                                    <span className="text-rose-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Encerrado</span>
                                  ) : s.rTimeStatus === 'andamento' ? (
                                    <span className="text-emerald-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Em Atendimento</span>
                                  ) : (
                                    <span className="text-sky-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Programado</span>
                                  )}
                                </span>
                                {!s.isVacant && s.rTimeStatus !== 'encerrado' && (
                                  <button onClick={() => handleDelete(s.id)} className="text-rose-500 hover:underline">Cancelar</button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : displayShiftsForSector.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-slate-700">
                    <SlidersHorizontal className="w-8 h-8 text-sky-600 dark:text-sky-400" />
                  </div>
                  <h3 className="font-black text-lg text-slate-800 dark:text-slate-100">
                    Nenhuma escala configurada para {activeSectorName}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-1 mb-5">
                    Esta seção não possui vagas pré-definidas ou turnos cadastrados. Defina os horários operacionais na Escala Base.
                  </p>
                  <Button onClick={() => setViewMode('base_builder')} className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-10 px-6 shadow-md gap-2">
                    <Plus className="w-4 h-4" /> Configurar Escala Base de {activeSectorName}
                  </Button>
                </div>
              ) : (
                <div className="min-w-[900px] pb-8">
                  <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 sticky top-0 z-20 shadow-sm">
                    <div className="p-3 border-r border-slate-200 dark:border-slate-800 flex items-center justify-center font-black text-xs text-slate-500 uppercase tracking-wider bg-slate-200/60 dark:bg-slate-950">Turno</div>
                    {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map(day => (
                      <div key={day} className="p-3 border-r border-slate-200 dark:border-slate-800 text-center font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">{day}</div>
                    ))}
                  </div>

                  {weeksDataGrid.map((week, wIndex) => (
                    <div key={wIndex} className="border-b-[4px] border-slate-200 dark:border-slate-900">
                      <div className="grid grid-cols-8 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
                        <div className="p-1 border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950"></div>
                        {week.map((date, dIndex) => (
                          <div key={dIndex} className={`p-1 border-r border-slate-200 dark:border-slate-800 text-right pr-2 text-[10px] font-black ${date && date !== 'disabled' ? 'text-slate-500 dark:text-slate-400' : 'text-transparent'}`}>
                            {date && date !== 'disabled' ? `${date.split('-')[2]}/${date.split('-')[1]}` : '-'}
                          </div>
                        ))}
                      </div>

                      {displayShiftsForSector.map((period) => (
                        <div key={period.id} className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800/80 last:border-b-0 group">
                          
                          <div className="p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col items-center justify-center text-center relative group/turn">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-200">{period.name}</span>
                            <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono mt-0.5">{period.start} - {period.end}</span>
                            <button 
                              onClick={() => openEditBuilderModal(period)}
                              className="absolute top-1 right-1 p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-300 opacity-0 group-hover/turn:opacity-100 transition-all shadow-sm"
                              title="Editar Nome ou Horário deste Turno"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>

                          {week.map((date, dIndex) => {
                            if (!date || date === 'disabled') return <div key={dIndex} className="bg-slate-100/40 dark:bg-slate-950/40 border-r border-slate-200 dark:border-slate-800"></div>;

                            const slotShifts = filteredShifts.filter(s => 
                              String(s.date || '').startsWith(date) && 
                              s.start_time === period.start && 
                              s.end_time === period.end
                            );

                            const dIndexBase = new Date(`${date}T12:00:00`).getDay();
                            const isActiveInBase = Boolean(period.cellStates && period.cellStates[dIndexBase]);
                            
                            const inDateRange = (!period.startDate || date >= period.startDate) && (!period.endDate || date <= period.endDate);
                            
                            const disabledKey = `${date}:${period.id}`;
                            const isDayManuallyDisabled = Boolean(disabledDaysMap[disabledKey]);
                            const requiredQty = (isActiveInBase && inDateRange && !isDayManuallyDisabled) ? (period.qty || 1) : 0;
                            
                            const renders = [...slotShifts];
                            for (let q = slotShifts.length; q < requiredQty; q++) {
                              renders.push({ isVirtualVacant: true, isVacant: true });
                            }

                            return (
                              <div 
                                key={dIndex} 
                                className="border-r border-slate-200 dark:border-slate-800 p-1.5 min-h-[85px] relative transition-colors cursor-pointer flex flex-col gap-1.5 hover:bg-slate-100/60 dark:hover:bg-slate-900/50"
                                onDragOver={handleDragOver} 
                                onDrop={(e) => handleDrop(e, date, period)} 
                                onClick={(e) => handleCellClick(e, date, period)}
                              >
                                {renders.length === 0 && (!isActiveInBase || !inDateRange || isDayManuallyDisabled) && (
                                  <div className="absolute inset-0 flex items-center justify-center opacity-20 text-xs font-black text-slate-400">
                                    {isDayManuallyDisabled ? 'Inativo' : '-'}
                                  </div>
                                )}

                                {renders.map((s, idx) => {
                                  const rStatus = s.rTimeStatus;

                                  return (
                                    <div key={s.id || `vaga_${idx}`} className="relative p-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between group/item transition-all shadow-sm">
                                      <div className="min-w-0 flex-1 pr-2">
                                        <div className="font-bold text-xs break-words leading-tight text-slate-900 dark:text-slate-100">
                                          {s.isVacant ? 'Vaga Aberta' : toTitleCase(s.professional_name)}
                                        </div>
                                        
                                        {/* STATUS DISCRETO COM BOLINHA INDICADORA */}
                                        <div className="text-[10px] font-bold tracking-wider uppercase mt-1 flex items-center gap-1.5">
                                          {s.isVacant ? (
                                            <span className="text-amber-500 flex items-center gap-1">
                                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Aberta
                                            </span>
                                          ) : rStatus === 'encerrado' ? (
                                            <span className="text-rose-500 flex items-center gap-1">
                                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" /> Encerrado
                                            </span>
                                          ) : rStatus === 'andamento' ? (
                                            <span className="text-emerald-500 flex items-center gap-1">
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" /> Atendimento
                                            </span>
                                          ) : (
                                            <span className="text-sky-500 flex items-center gap-1">
                                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block" /> Programado
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {!s.isVacant && s.id && (
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="opacity-0 group-hover/item:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded transition-opacity">
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
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

      {/* ========================================================
          MODO LISTA DIÁRIA - COM BOLINHAS DE STATUS
          ======================================================== */}
      {viewMode === 'list' && (
        <div className="overflow-y-auto p-4 sm:px-8 space-y-3 flex-1">
           {filteredShifts.length === 0 ? (
              <div className="py-16 text-center text-slate-400">Nenhum plantão localizado para o período filtrado.</div>
            ) : (
              filteredShifts.map(s => (
                <div key={s.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 transition-colors shadow-sm">
                  <div className="min-w-[110px] rounded-xl py-2 text-center text-xs font-black border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
                    {formatDateBR(s.date)} <br/>
                    <span className="font-mono text-xs opacity-90 text-slate-400">{s.start_time || '--'} às {s.end_time || '--'}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <strong className="block text-base break-words text-slate-900 dark:text-white">
                      {toTitleCase(s.professional_name) || 'Vaga Aberta'}
                    </strong>
                    <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3" /> {toTitleCase(s.sector_name)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!s.isVacant && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-950">
                        {s.rTimeStatus === 'encerrado' ? (
                          <span className="text-rose-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Encerrado</span>
                        ) : s.rTimeStatus === 'andamento' ? (
                          <span className="text-emerald-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Em Atendimento</span>
                        ) : (
                          <span className="text-sky-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-500" /> Programado</span>
                        )}
                      </div>
                    )}

                    {!s.isVacant && (
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)} className="h-9 w-9 text-slate-400 hover:text-rose-500 hover:bg-rose-950/20" title="Cancelar plantão">
                        <Trash2 className="w-4 h-4"/>
                      </Button>
                    )}

                    {s.isVacant && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => { setEditing(s); setDialogOpen(true); }} className="h-9 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs">
                          <UserPlus className="w-3.5 h-3.5 mr-1" /> Alocar
                        </Button>
                        {s.id && (
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)} className="h-9 text-slate-400 hover:text-rose-500 hover:bg-rose-950/20 text-xs">
                            Cancelar Vaga
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
        </div>
      )}

      {/* ========================================================
          MODO ESCALA BASE (COM SELETOR OBRIGATÓRIO DE SETOR)
          ======================================================== */}
      {viewMode === 'base_builder' && (
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-6 flex justify-center">
          <div className="w-full max-w-5xl space-y-6">
            
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Selecione a Seção para Configurar:</h3>
                <p className="text-xs text-slate-400">Escolha abaixo qual setor terá sua Escala Base editada.</p>
              </div>
              <Select value={sectorFilter} onValueChange={handleSectorChange}>
                <SelectTrigger className="h-10 w-72 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-sky-600 dark:text-sky-400">
                  <SelectValue placeholder="Selecione um setor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" disabled>Selecione um setor específico...</SelectItem>
                  {safeArray(sectors).filter(s => s?.id).map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name || 'Sem nome'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sectorFilter === 'todos' ? (
              <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
                <Building2 className="w-12 h-12 text-sky-500 mx-auto mb-3 opacity-60" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">Nenhum setor selecionado</h3>
                <p className="text-xs text-slate-400 mt-1">Por favor, selecione uma seção específica no seletor acima para montar ou editar os turnos.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-slate-900 dark:text-white">Escala Base: {activeSectorName}</h2>
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">Modo Edição</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Defina os turnos, o período de vigência e a quantidade de vagas da semana.</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Button onClick={openNewBuilderModal} className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-9 gap-1.5">
                      <Plus className="w-4 h-4" /> Adicionar Turno
                    </Button>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-slate-100 dark:bg-slate-950 text-slate-500 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px] font-bold">
                        <tr>
                          <th className="p-3.5 w-48 text-center border-r border-slate-200 dark:border-slate-800">Turno / Período</th>
                          {WEEK_DAYS_ORDER.map(day => (
                            <th key={day.index} className={`p-3.5 text-center border-r border-slate-200 dark:border-slate-800 ${day.weekend ? 'bg-slate-200/50 dark:bg-slate-900/90' : ''}`}>
                              {day.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {builderShifts.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="p-16 text-center text-slate-400 text-xs">
                              Nenhum turno configurado para <strong>{activeSectorName}</strong>.<br/>
                              Clique no botão acima para adicionar o primeiro horário deste setor.
                            </td>
                          </tr>
                        ) : (
                          builderShifts.map(shift => (
                            <tr key={shift.id}>
                              <td className="p-3.5 font-bold border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 relative group">
                                <div className="flex flex-col items-center justify-center text-center">
                                  <span className="text-xs text-slate-900 dark:text-slate-200">{shift.name}</span>
                                  <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400 mt-0.5">{shift.start} às {shift.end}</span>
                                  <span className="text-[9px] text-slate-400 mt-1">{formatDateBR(shift.startDate)} até {formatDateBR(shift.endDate)}</span>
                                </div>
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                  <button onClick={() => openEditBuilderModal(shift)} className="p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300" title="Editar Turno">
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                              {WEEK_DAYS_ORDER.map(day => {
                                const isActive = Boolean(shift.cellStates && shift.cellStates[day.index]);
                                return (
                                  <td key={day.index} className={`p-0 border-r border-slate-200 dark:border-slate-800 text-center relative ${day.weekend ? 'bg-slate-50/40 dark:bg-slate-950/40' : ''}`}>
                                    <div className="relative w-full h-full min-h-[64px] flex items-center justify-center group/cell cursor-pointer" onClick={() => toggleBuilderCell(shift.id, day.index)}>
                                      <div className={`w-8 h-8 mx-auto rounded-lg font-black text-sm flex items-center justify-center transition-colors ${
                                        isActive ? 'bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-300 dark:border-slate-700 shadow-sm' : 'bg-transparent text-slate-300 dark:text-slate-700'
                                      }`}>
                                        {isActive ? shift.qty : '-'}
                                      </div>
                                      <div className="absolute inset-0 bg-slate-900/90 text-white text-[10px] font-bold flex flex-col items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                        {isActive ? 'Desativar vaga?' : 'Ativar vaga?'}
                                      </div>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Button variant="outline" onClick={() => setViewMode('grade')} className="border-slate-300 dark:border-slate-800 text-xs h-10 px-6">
                    Voltar para a Grade
                  </Button>
                  <Button onClick={() => setConfirmGoToAllocation(true)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-10 px-8 shadow-md">
                    Salvar Escala Base de {activeSectorName}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MODAIS E DIALOGS
          ======================================================== */}

      {/* MODAL HORIZONTAL: ESCALA DO DIA */}
      {dayScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-6xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col">
            
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-sky-600 dark:text-sky-400" /> Pré-visualização da Escala do Dia
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Data: <strong>{formatDateBR(todayTarget)}</strong> ({fmtDateLong(todayTarget)}) • {shiftsTodayModal.length} plantões cadastrados
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={printOfficialHospitalSchedule} className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-9 gap-1.5">
                  <Printer className="w-4 h-4" /> Imprimir A4 Mural
                </Button>
                <button onClick={() => setDayScheduleModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {Object.keys(groupedModalBySector).length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-medium">Nenhum plantão ativo para esta data.</div>
              ) : (
                Object.keys(groupedModalBySector).sort().map(secName => (
                  <div key={secName} className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-950">
                    <div className="bg-slate-100 dark:bg-slate-800/80 p-3 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> {secName}
                      </h3>
                      <span className="text-[11px] font-bold text-slate-500">{groupedModalBySector[secName].length} Plantonistas</span>
                    </div>

                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {groupedModalBySector[secName].map(s => {
                        const rStatus = getRealTimeStatus(s.date, s.start_time, s.end_time, currentTime, s.status);
                        const isVacant = !s.professional_id || normalizeStr(s.professional_name).includes('vaga');
                        return (
                          <div key={s.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-center text-[10px] font-mono text-sky-600 dark:text-sky-400 font-bold mb-1">
                                <span>{s.start_time} - {s.end_time}</span>
                                <span className={`capitalize font-bold flex items-center gap-1 ${rStatus === 'encerrado' ? 'text-rose-500' : rStatus === 'andamento' ? 'text-emerald-500' : 'text-sky-500'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${rStatus === 'encerrado' ? 'bg-rose-500' : rStatus === 'andamento' ? 'bg-emerald-500 animate-ping' : 'bg-sky-500'}`} />
                                  {rStatus}
                                </span>
                              </div>
                              <div className="font-black text-xs text-slate-900 dark:text-slate-100 break-words">{isVacant ? 'Vaga Aberta' : toTitleCase(s.professional_name)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MENU DE AÇÃO DA VAGA */}
      {vacancyMenuModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Opções da Vaga</h3>
                <p className="text-xs text-slate-400">{formatDateBR(vacancyMenuModal.date)} • {vacancyMenuModal.shiftObj.start} às {vacancyMenuModal.shiftObj.end}</p>
              </div>
              <button onClick={() => setVacancyMenuModal(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => {
                  const { date, shiftObj, sectorId } = vacancyMenuModal;
                  setVacancyMenuModal(null);
                  setNewShiftModal({ date, shiftObj, sectorIdTarget: sectorId });
                }}
                className="w-full p-3.5 rounded-2xl border border-sky-500/30 bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-left flex items-center gap-3 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs text-sky-900 dark:text-sky-200">Alocar Plantonista</div>
                  <div className="text-[11px] text-sky-700 dark:text-sky-400">Escolha um médico do corpo clínico</div>
                </div>
              </button>

              <button
                onClick={() => {
                  const { date, shiftObj, sectorId } = vacancyMenuModal;
                  setVacancyMenuModal(null);
                  handleSendToOpportunitiesMural(date, shiftObj, sectorId);
                }}
                className="w-full p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-left flex items-center gap-3 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs text-emerald-900 dark:text-emerald-200">Mural de Oportunidades</div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Disponibilizar vaga para candidatura médica</div>
                </div>
              </button>

              {(() => {
                const isCurrentlyDisabled = Boolean(disabledDaysMap[`${vacancyMenuModal.date}:${vacancyMenuModal.shiftObj.id}`]);
                return (
                  <button
                    onClick={() => {
                      const { date, shiftObj } = vacancyMenuModal;
                      setVacancyMenuModal(null);
                      handleToggleDayInactive(date, shiftObj.id);
                    }}
                    className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 text-left flex items-center gap-3 transition-all"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isCurrentlyDisabled ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'}`}>
                      {isCurrentlyDisabled ? <Check className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        {isCurrentlyDisabled ? 'Ativar vaga neste dia' : 'Inativar neste dia'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {isCurrentlyDisabled ? 'Tornar a vaga visível novamente' : 'Desligar a vaga apenas para esta data'}
                      </div>
                    </div>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ALOCAÇÃO COM TRAVA RETROATIVA */}
      {newShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white">Alocar Plantonista</h3>
              <button onClick={() => setNewShiftModal(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Profissional:</label>
                <Select value={selectedProfIdForModal || newShiftModal.preSelectedProfId || undefined} onValueChange={setSelectedProfIdForModal}>
                  <SelectTrigger className="h-10 text-xs font-semibold">
                    <SelectValue placeholder="Selecione o médico..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sidebarProfessionals.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name || p.full_name || 'Sem nome'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <div><span className="text-slate-500">Data:</span> <strong className="text-slate-800 dark:text-slate-200">{formatDateBR(newShiftModal.date)} ({fmtDateLong(newShiftModal.date)})</strong></div>
                <div><span className="text-slate-500">Horário:</span> <strong className="text-sky-600 dark:text-sky-400 font-mono">{newShiftModal.shiftObj.start} às {newShiftModal.shiftObj.end}</strong></div>
                <div><span className="text-slate-500">Seção:</span> <strong className="text-slate-800 dark:text-slate-200">{activeSectorName}</strong></div>
              </div>

              {isDateRetroactive(newShiftModal.date) && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-3">
                  <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-black text-xs">
                    <ShieldAlert className="w-4 h-4" /> Lançamento Retroativo Detectado
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    A data selecionada já passou. Para fins de auditoria e cálculo de faturamento, informe:
                  </p>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-amber-900 dark:text-amber-300 mb-1 block">O plantão foi realizado?</label>
                    <Select value={retroactivePerformed} onValueChange={setRetroactivePerformed}>
                      <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900 border-amber-300"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="concluido">Sim, Plantão Realizado (Entra no faturamento)</SelectItem>
                        <SelectItem value="cancelado">Não, Houve Falta / Cancelado (Sem custo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-amber-900 dark:text-amber-300 mb-1 block">Justificativa obrigatória *</label>
                    <Input 
                      placeholder="Motivo do preenchimento tardio..." 
                      value={retroactiveReason} 
                      onChange={e => setRetroactiveReason(e.target.value)}
                      className="h-8 text-xs bg-white dark:bg-slate-900 border-amber-300"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setNewShiftModal(null)} className="h-9 text-xs">Cancelar</Button>
                <Button 
                  onClick={() => {
                    const profId = selectedProfIdForModal || newShiftModal.preSelectedProfId;
                    if (!profId) { alert('Selecione um profissional.'); return; }
                    if (isDateRetroactive(newShiftModal.date) && !retroactiveReason.trim()) {
                      alert('A justificativa é obrigatória para plantões retroativos.');
                      return;
                    }
                    const explicitStatus = isDateRetroactive(newShiftModal.date) ? retroactivePerformed : 'confirmado';
                    assignShift(newShiftModal.date, newShiftModal.shiftObj, profId, retroactiveReason, explicitStatus, newShiftModal.sectorIdTarget);
                    setNewShiftModal(null);
                  }}
                  className="h-9 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs"
                >
                  Confirmar Alocação
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFLITO / DUPLICIDADE DE HORÁRIO */}
      {conflictModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 mb-3">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-950/50 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Conflito de Horário</h3>
                <p className="text-[11px] text-slate-500">Duplicidade de plantonista detectada</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 my-4">
              {conflictModal.message}
            </p>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Deseja <strong>remanejar</strong> o Dr(a). <strong>{conflictModal.prof.name}</strong> para esta nova seção cancelando o anterior, ou manter o plantão original?
            </p>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConflictModal(null)} className="flex-1 h-10 text-xs">
                Manter Original
              </Button>
              <Button
                onClick={() => {
                  const { date, shiftDef, prof, reasonText, explicitStatus, sectorTarget, oldShift } = conflictModal;
                  setConflictModal(null);
                  assignShift(date, shiftDef, prof.id, reasonText, explicitStatus, sectorTarget, oldShift.id);
                }}
                className="flex-1 h-10 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-1"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Remanejar Médico
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PUBLICAÇÃO POR INTERVALO */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-500" /> Publicar Escala
              </h2>
              <button onClick={() => setPublishModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-400">
                Selecione o período que deseja publicar para a seção <strong>{activeSectorName}</strong>:
              </p>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Período Predefinido:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: '1_sem', label: '1 Semana', days: 7 },
                    { id: '2_sem', label: '2 Semanas', days: 14 },
                    { id: '1_mes', label: '1 Mês', days: 30 },
                    { id: '2_mes', label: '2 Meses', days: 60 },
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        const start = getLocalDateString();
                        const d = new Date();
                        d.setDate(d.getDate() + p.days);
                        setPublishRange({ preset: p.id, start, end: getLocalDateString(d) });
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                        publishRange.preset === p.id 
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' 
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Início:</label>
                  <Input type="date" value={publishRange.start} onChange={e => setPublishRange({...publishRange, preset: 'custom', start: e.target.value})} className="h-9 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Fim:</label>
                  <Input type="date" value={publishRange.end} onChange={e => setPublishRange({...publishRange, preset: 'custom', end: e.target.value})} className="h-9 text-xs" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex gap-2">
                <Button variant="outline" onClick={() => setPublishModalOpen(false)} className="flex-1 h-10">Cancelar</Button>
                <Button onClick={handleConfirmPublish} className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">Confirmar e Publicar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAÇÃO PÓS-SALVAR ESCALA BASE */}
      {confirmGoToAllocation && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">Escala Base Salva!</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Deseja ir para o Builder Visual e começar a alocar os profissionais nas vagas de {activeSectorName}?
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-xs" onClick={() => setConfirmGoToAllocation(false)}>Depois</Button>
              <Button className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-9" onClick={() => { setConfirmGoToAllocation(false); setViewMode('grade'); }}>Sim, Alocar</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR / EDITAR TURNO */}
      {builderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {builderModal.isNew ? 'Adicionar Linha de Turno' : 'Editar Turno'}
              </h3>
              <div className="flex items-center gap-2">
                {!builderModal.isNew && (
                  <Button variant="ghost" onClick={() => deleteBuilderShift(builderForm.id)} className="h-7 text-xs text-rose-500 hover:bg-rose-950/50 px-2">Excluir</Button>
                )}
                <button onClick={() => setBuilderModal(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Nome do Turno:</label>
                <Input value={builderForm.name} onChange={e => setBuilderForm({...builderForm, name: e.target.value})} placeholder="Ex: Manhã, Tarde, Noturno A" className="h-9" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Início:</label>
                  <Input type="time" value={builderForm.start} onChange={e => setBuilderForm({...builderForm, start: e.target.value})} className="h-9" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Término:</label>
                  <Input type="time" value={builderForm.end} onChange={e => setBuilderForm({...builderForm, end: e.target.value})} className="h-9" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Data Inicial (Vigência):</label>
                  <Input type="date" value={builderForm.startDate} onChange={e => setBuilderForm({...builderForm, startDate: e.target.value})} className="h-9" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Data Final (Vigência):</label>
                  <Input type="date" value={builderForm.endDate} onChange={e => setBuilderForm({...builderForm, endDate: e.target.value})} className="h-9" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Qtd. de Vagas Diárias:</label>
                <Input type="number" min="1" value={builderForm.qty} onChange={e => setBuilderForm({...builderForm, qty: Number(e.target.value)})} className="h-9" />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 mb-2 block">Dias Ativos na Semana:</label>
                <div className="grid grid-cols-7 gap-1">
                  {WEEK_DAYS_ORDER.map(day => {
                    const isSelected = (builderForm.days || []).includes(day.index);
                    return (
                      <button 
                        key={day.index} 
                        type="button"
                        onClick={() => toggleBuilderDay(day.index)}
                        className={`p-2 rounded-lg border text-[10px] font-bold transition-all ${
                          isSelected ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400' : 'border-slate-200 dark:border-slate-800 text-slate-400'
                        }`}
                      >
                        {day.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBuilderModal(null)} className="h-9 text-xs">Cancelar</Button>
                <Button onClick={saveBuilderShiftAndPropagate} className="h-9 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs">Salvar e Propagar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG DE CRIAÇÃO AVULSA */}
      <ShiftFormDialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        onSaved={() => loadData(true)} 
        shift={editing} 
        sectors={sectors} 
        professionals={professionals} 
        companyId={companyId} 
        unitId={unitId} 
      />
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