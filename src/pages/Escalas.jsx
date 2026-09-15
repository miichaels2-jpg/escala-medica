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
  Maximize2, Moon, Pencil, Plus, Printer, RefreshCw, Search,
  Send, SlidersHorizontal, Sun, Trash2, UserPlus, UsersRound,
  X, FileText, ShieldAlert, ArrowRightLeft, Megaphone, Ban,
  Check, Copy, ChevronLeft, ChevronRight
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
                try { window.localStorage.removeItem('escala_setor_fixado_v28'); } catch (e) {}
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
const STORAGE_BASE_PREFIX = 'hospital_escala_base_v28';
const STORAGE_SECTOR_KEY = 'escala_setor_fixado_v28';
const STORAGE_PUBLISHED_MAP_KEY = 'hospital_escalas_publicadas_map_v28';
const STORAGE_DISABLED_DAYS_KEY = 'hospital_vagas_inativadas_map_v28';

// Tempo máximo de exibição de plantões encerrados no modo TV (em minutos)
const PREVIOUS_SHIFT_DISPLAY_MINUTES = 60;

const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

// Mapeamento correto dos dias da semana (0 = Domingo, 1 = Segunda, ..., 6 = Sábado)
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

// Resolução sem desvio de fuso para finais de semana
function getDayOfWeekIndex(dateStr) {
  if (!dateStr || dateStr === 'disabled') return -1;
  const parts = dateStr.split('-');
  if (parts.length < 3) return -1;
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0).getDay();
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
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
  return WEEKDAYS_LONG[d.getDay()] || '';
}

function getShiftHours(s) {
  if (s?.duration_hours != null && Number.isFinite(Number(s.duration_hours))) return Number(s.duration_hours);
  if (s?.hours != null && Number.isFinite(Number(s.hours))) return Number(s.hours);
  if (s?.start_time && s?.end_time) {
    const [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    return Math.max(0, diff / 60);
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

/* ============================================================
   MOTOR DE TEMPO REAL PRECISO (CROSS-MIDNIGHT & TRACKS DA TV)
   ============================================================ */
function getDetailedShiftStatus(dateStr, startStr, endStr, now, explicitStatus, isPublished = false) {
  const currentKey = getStatusKey(explicitStatus);
  if (currentKey === 'cancelado' || currentKey === 'falta') return { code: 'cancelado', isFinishedRecent: false };
  if (currentKey === 'concluido' || currentKey === 'realizado') return { code: 'encerrado', isFinishedRecent: false };

  const normDate = normalizeDate(dateStr);
  if (!normDate || !startStr || !endStr) {
    return { code: isPublished ? 'publicado' : 'programado', isFinishedRecent: false };
  }

  const [y, m, d] = normDate.split('-').map(Number);
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);

  const shiftStart = new Date(y, m - 1, d, sh, sm, 0);
  const shiftEnd = new Date(y, m - 1, d, eh, em, 0);

  // Plantão noturno que ultrapassa meia-noite
  if (shiftEnd <= shiftStart) {
    shiftEnd.setDate(shiftEnd.getDate() + 1);
  }

  const nowMs = now.getTime();
  const startMs = shiftStart.getTime();
  const endMs = shiftEnd.getTime();

  if (nowMs >= startMs && nowMs <= endMs) {
    return { code: 'andamento', isFinishedRecent: false };
  }

  if (nowMs < startMs) {
    return { code: isPublished ? 'publicado' : 'programado', isFinishedRecent: false };
  }

  // Plantão ultrapassou o horário de término
  const minutesSinceEnd = (nowMs - endMs) / (1000 * 60);
  const isFinishedRecent = minutesSinceEnd >= 0 && minutesSinceEnd <= PREVIOUS_SHIFT_DISPLAY_MINUTES;

  return { code: 'encerrado', isFinishedRecent, minutesSinceEnd };
}

function getMonthWeeks(monthStr, startDateFilter = '', endDateFilter = '') {
  if (!monthStr || typeof monthStr !== 'string') return [];
  const parts = monthStr.split('-');
  if (parts.length < 2) return [];
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  
  const firstDay = new Date(year, month - 1, 1, 12, 0, 0);
  const lastDay = new Date(year, month, 0, 12, 0, 0);
  
  const weeks = [];
  let currentWeek = [];
  let startDay = firstDay.getDay(); 
  let emptyDays = startDay === 0 ? 6 : startDay - 1; 
  
  for (let i = 0; i < emptyDays; i++) currentWeek.push(null);
  
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = getLocalDateString(new Date(year, month - 1, d, 12, 0, 0));
    
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

// Gerador contínuo de navegação mensal (3 meses passados e até 21 meses futuros)
function generateMonthOptions(pivotDate = new Date()) {
  const options = [];
  const base = new Date(pivotDate.getFullYear(), pivotDate.getMonth() - 3, 1);
  for (let i = 0; i < 24; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
    options.push({ value, label });
  }
  return options;
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

  // Publicação
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

  // Vagas inativadas manualmente por dia
  const [disabledDaysMap, setDisabledDaysMap] = useState(() => {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_DISABLED_DAYS_KEY}:${companyId}`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  // Modal de Duplicação Mensal
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateConfig, setDuplicateConfig] = useState({
    sourceMonth: getLocalDateString().slice(0, 7),
    targetMonth: (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return getLocalDateString(d).slice(0, 7);
    })(),
    includeProfessionals: false
  });
  const [duplicating, setDuplicating] = useState(false);

  // Modais de Ação Operacional
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
  
  // Builder da Escala Base (Molde)
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

  // Sincronização de Tema
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

  // Carregamento de dados
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

  // Leitura da Escala Base (Molde) por Setor
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

  // Lista dinâmica de meses para navegação contínua
  const monthOptions = useMemo(() => generateMonthOptions(new Date()), []);

  const isShiftPublished = useCallback((shiftDate, secId) => {
    const pub = publishedMap[secId];
    if (!pub) return false;
    const date = normalizeDate(shiftDate);
    return date >= normalizeDate(pub.start) && date <= normalizeDate(pub.end);
  }, [publishedMap]);

  // Plantões Mensais Filtrados
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
      const timeInfo = getDetailedShiftStatus(s.date, s.start_time, s.end_time, currentTime, s.status, published);
      return { 
        ...s, 
        rTimeStatus: timeInfo.code,
        isFinishedRecent: timeInfo.isFinishedRecent,
        isVacant: !s.professional_id || pName.includes('vaga') || getStatusKey(s.status) === 'disponivel' || getStatusKey(s.status) === 'aberto'
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

  // Linhas da grade mensal (turnos operacionais)
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
            cellStates: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false }
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
      if (!p?.id || p.status === 'inativo') return false;
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

  // Validação de Conflito de Horário
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

  // Persistência com eliminação defensiva de colunas ausentes no schema
  const saveShiftResilient = async (payload, shiftId = null) => {
    const payloadToSend = { ...payload };
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        if (shiftId) {
          return await base44.entities.Shift.update(shiftId, payloadToSend);
        } else {
          return await base44.entities.Shift.create(payloadToSend);
        }
      } catch (err) {
        const colMatch = err.message?.match(/Could not find the '(\w+)' column/i);
        if (colMatch && colMatch[1]) {
          delete payloadToSend[colMatch[1]];
        } else {
          throw err;
        }
      }
    }
    throw new Error('Falha ao persistir plantão no banco.');
  };

  // Alocação de médico
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
        prof?.registration_code ? `Matrícula: ${prof.registration_code}` : null,
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
        total_amount: calculatedTotal,
        status: explicitStatus,
        notes
      };

      if (forceRemapShiftId) {
        await base44.entities.Shift.update(forceRemapShiftId, {
          status: 'cancelado',
          notes: `Remanejado para ${sectorObj.name}`
        });
      }
      
      await saveShiftResilient(payload, existingShift?.id);
      loadData(true);
    } catch (error) {
      alert("Erro ao salvar plantão: " + (error?.message || 'Tente novamente.'));
    }
  };

  // Envio ao Mural de Oportunidades
  const handleSendToOpportunitiesMural = async (date, shiftDef, secId) => {
    const targetSecId = secId && secId !== 'todos' ? secId : sectorFilter;
    if (targetSecId === 'todos') {
      alert('Selecione uma seção específica no topo para disponibilizar esta vaga.');
      return;
    }

    const sectorObj = safeArray(sectors).find(s => String(s.id) === String(targetSecId));
    if (!sectorObj) return;

    try {
      const hours = getShiftHours({ start_time: shiftDef.start, end_time: shiftDef.end });
      const defaultHourlyRate = 120;
      const estimatedTotal = defaultHourlyRate * hours;

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
        hours: hours,
        hourly_rate: defaultHourlyRate,
        rate: defaultHourlyRate,
        total_amount: estimatedTotal,
        status: 'disponivel',
        notes: `Disponível no Mural de Oportunidades • Turno: ${shiftDef.name}`
      };

      const existingShift = safeArray(filteredShifts).find(s => 
        String(s.date || '').startsWith(date) && 
        s.start_time === shiftDef.start && 
        s.end_time === shiftDef.end && 
        String(s.sector_id) === String(sectorObj.id)
      );

      await saveShiftResilient(payload, existingShift?.id);
      await loadData(true);
      alert('Vaga disponibilizada com sucesso no Mural de Oportunidades!');
    } catch (e) {
      alert('Erro ao enviar vaga ao mural: ' + (e?.message || 'Verifique o banco.'));
    }
  };

  // Inativação manual de vaga do dia
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

  const handleConfirmPublish = () => {
    if (sectorFilter === 'todos') {
      alert('Selecione um setor específico para publicar a escala.');
      return;
    }

    const payload = {
      sectorId: sectorFilter,
      sectorName: activeSectorName,
      start: publishRange.start,
      end: publishRange.end,
      publishedAt: new Date().toISOString()
    };

    const nextMap = { ...publishedMap, [sectorFilter]: payload };
    setPublishedMap(nextMap);
    try {
      window.localStorage.setItem(`${STORAGE_PUBLISHED_MAP_KEY}:${companyId}`, JSON.stringify(nextMap));
    } catch (e) {}

    setPublishModalOpen(false);
    loadData(true);
    alert(`Escala de ${activeSectorName} publicada de ${formatDateBR(publishRange.start)} até ${formatDateBR(publishRange.end)}!`);
  };

  /* ============================================================
     GERAÇÃO MENSAL A PARTIR DA BASE (PREENCHIMENTO DE VAGAS)
     ============================================================ */
  const handleGenerateMonthFromBase = async () => {
    if (sectorFilter === 'todos') {
      alert('Selecione um setor específico para gerar a escala mensal.');
      return;
    }
    if (builderShifts.length === 0) {
      alert(`A Escala Base de ${activeSectorName} não possui turnos cadastrados.`);
      return;
    }

    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0, 12, 0, 0).getDate();

    if (!confirm(`Deseja gerar a estrutura de vagas para ${selectedMonth} em ${activeSectorName}? Plantões com médicos já alocados serão preservados.`)) {
      return;
    }

    setLoading(true);
    try {
      const createdPayloads = [];

      for (let day = 1; day <= lastDay; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayOfWeek = getDayOfWeekIndex(dateStr);

        for (const period of builderShifts) {
          const isActiveOnDay = Boolean(period.cellStates && period.cellStates[dayOfWeek]);
          if (!isActiveOnDay) continue;

          // Valida período de vigência
          if (period.startDate && dateStr < period.startDate) continue;
          if (period.endDate && dateStr > period.endDate) continue;

          // Verifica se já existem plantões criados no slot
          const existingInSlot = safeArray(shifts).filter(s => 
            normalizeDate(s.date) === dateStr &&
            s.start_time === period.start &&
            s.end_time === period.end &&
            String(s.sector_id) === String(sectorFilter) &&
            getStatusKey(s.status) !== 'cancelado'
          );

          const neededQty = Math.max(1, Number(period.qty) || 1);
          const toCreateQty = Math.max(0, neededQty - existingInSlot.length);
          const hours = getShiftHours({ start_time: period.start, end_time: period.end });
          const defaultRate = 120;

          for (let q = 0; q < toCreateQty; q++) {
            createdPayloads.push({
              company_id: companyId,
              unit_id: unitId,
              professional_id: null,
              professional_name: 'Vaga Aberta',
              sector_id: sectorFilter,
              sector_name: activeSectorName,
              date: dateStr,
              start_time: period.start,
              end_time: period.end,
              duration_hours: hours,
              hours: hours,
              hourly_rate: defaultRate,
              rate: defaultRate,
              total_amount: defaultRate * hours,
              status: 'aberto',
              notes: `Turno: ${period.name}`
            });
          }
        }
      }

      for (const payload of createdPayloads) {
        await saveShiftResilient(payload);
      }

      await loadData(true);
      alert(`Escala mensal gerada com sucesso! (${createdPayloads.length} vagas inseridas)`);
    } catch (e) {
      alert('Erro ao gerar escala mensal: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     DUPLICAÇÃO MENSAL REAL NO BASE44
     ============================================================ */
  const handleExecuteDuplication = async () => {
    if (duplicateConfig.sourceMonth === duplicateConfig.targetMonth) {
      alert('O mês de destino deve ser diferente do mês de origem.');
      return;
    }

    setDuplicating(true);
    try {
      const sourceShifts = safeArray(shifts).filter(s => 
        s.date && 
        String(s.date).startsWith(duplicateConfig.sourceMonth) &&
        getStatusKey(s.status) !== 'cancelado' &&
        (sectorFilter === 'todos' || String(s.sector_id) === String(sectorFilter))
      );

      if (sourceShifts.length === 0) {
        alert(`Não há plantões no mês de origem (${duplicateConfig.sourceMonth}) para duplicar.`);
        setDuplicating(false);
        return;
      }

      const [sYear, sMonth] = duplicateConfig.sourceMonth.split('-').map(Number);
      const [tYear, tMonth] = duplicateConfig.targetMonth.split('-').map(Number);
      const targetLastDay = new Date(tYear, tMonth, 0, 12, 0, 0).getDate();

      const payloadsToCreate = [];

      for (const src of sourceShifts) {
        const srcDay = Number(src.date.split('-')[2]);
        // Ajusta se o mês de destino tiver menos dias (ex: 31 para 30 ou 28)
        if (srcDay > targetLastDay) continue;

        const targetDate = `${tYear}-${String(tMonth).padStart(2, '0')}-${String(srcDay).padStart(2, '0')}`;
        const profId = duplicateConfig.includeProfessionals ? src.professional_id : null;
        const profName = duplicateConfig.includeProfessionals ? src.professional_name : 'Vaga Aberta';
        const hours = getShiftHours({ start_time: src.start_time, end_time: src.end_time });

        payloadsToCreate.push({
          company_id: src.company_id || companyId,
          unit_id: src.unit_id || unitId,
          sector_id: src.sector_id,
          sector_name: src.sector_name,
          date: targetDate,
          start_time: src.start_time,
          end_time: src.end_time,
          duration_hours: hours,
          hours: hours,
          hourly_rate: src.hourly_rate || 120,
          rate: src.rate || 120,
          total_amount: src.total_amount || 0,
          professional_id: profId,
          professional_name: profName,
          status: profId ? 'confirmado' : 'aberto',
          notes: src.notes || ''
        });
      }

      for (const item of payloadsToCreate) {
        await saveShiftResilient(item);
      }

      setSelectedMonth(duplicateConfig.targetMonth);
      setDuplicateModalOpen(false);
      await loadData(true);
      alert(`Escala de ${duplicateConfig.targetMonth} criada com sucesso! (${payloadsToCreate.length} plantões duplicados)`);
    } catch (e) {
      alert('Erro durante a duplicação: ' + e.message);
    } finally {
      setDuplicating(false);
    }
  };

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

  const toggleBuilderDay = (dayIndex) => {
    setBuilderForm(prev => ({
      ...prev,
      days: (prev.days || []).includes(dayIndex) ? (prev.days || []).filter(d => d !== dayIndex) : [...(prev.days || []), dayIndex]
    }));
  };

  // Salva a Escala Base como modelo estrito (sem sobrescrever escalas mensais manuais)
  const saveBuilderShiftModel = () => {
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
  };

  const deleteBuilderShift = (shiftId) => {
    if (!confirm('Deseja excluir este turno do modelo da Escala Base?')) return;
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

  // Segregação de plantões diários para o Modo TV e Escala do Dia
  const todayTarget = selectedDate || getLocalDateString(currentTime);
  const shiftsForDayModal = useMemo(() => {
    return safeArray(shifts).filter(s => normalizeDate(s.date) === todayTarget && getStatusKey(s.status) !== 'cancelado');
  }, [shifts, todayTarget]);

  const tvTracks = useMemo(() => {
    const active = [];
    const upcoming = [];
    const vacancies = [];
    const previous = [];

    shiftsForDayModal.forEach(s => {
      const published = isShiftPublished(s.date, s.sector_id);
      const timeInfo = getDetailedShiftStatus(s.date, s.start_time, s.end_time, currentTime, s.status, published);
      const isVacant = !s.professional_id || normalizeStr(s.professional_name).includes('vaga') || getStatusKey(s.status) === 'disponivel';

      if (isVacant) {
        vacancies.push({ ...s, rTimeStatus: timeInfo.code });
      } else if (timeInfo.code === 'andamento') {
        active.push({ ...s, rTimeStatus: timeInfo.code });
      } else if (timeInfo.code === 'programado' || timeInfo.code === 'publicado') {
        upcoming.push({ ...s, rTimeStatus: timeInfo.code });
      } else if (timeInfo.code === 'encerrado' && timeInfo.isFinishedRecent) {
        previous.push({ ...s, rTimeStatus: timeInfo.code });
      }
    });

    return { active, upcoming, vacancies, previous };
  }, [shiftsForDayModal, currentTime, isShiftPublished]);

  /* ============================================================
     RENDER DO MODO TV (ORGANIZAÇÃO EM 4 RAIAS DE STATUS)
     ============================================================ */
  if (tvMode) {
    return (
      <div className="fixed inset-0 z-[99999] bg-slate-950 text-white flex flex-col p-4 sm:p-6 font-sans overflow-hidden">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 mb-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-600/30">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">Escala Operacional (Modo TV)</h1>
              <p className="text-xs text-sky-400 font-semibold">{fmtDateLong(todayTarget)} • {formatDateBR(todayTarget)}</p>
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

        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-4 gap-4 pr-1 pb-8">
          
          {/* RAIÃO 1: EM ATENDIMENTO */}
          <div className="flex flex-col bg-slate-900/60 border border-emerald-500/30 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2 mb-3">
              <h2 className="text-sm font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                Plantões Ativos ({tvTracks.active.length})
              </h2>
            </div>
            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
              {tvTracks.active.map(s => (
                <div key={s.id} className="p-3 bg-emerald-950/20 border border-emerald-500/50 rounded-xl flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-emerald-300 font-bold block">{getSectorName(s, sectorMap)}</span>
                    <strong className="text-sm text-white block truncate">{toTitleCase(s.professional_name)}</strong>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-slate-950 px-2 py-1 rounded border border-emerald-900">
                    {s.start_time} - {s.end_time}
                  </span>
                </div>
              ))}
              {tvTracks.active.length === 0 && <p className="text-xs text-slate-500 italic py-6 text-center">Nenhum plantão ativo neste momento.</p>}
            </div>
          </div>

          {/* RAIÃO 2: PRÓXIMOS PLANTÕES */}
          <div className="flex flex-col bg-slate-900/60 border border-sky-500/30 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-sky-500/20 pb-2 mb-3">
              <h2 className="text-sm font-black text-sky-400 uppercase tracking-wider flex items-center gap-2">
                <Clock3 className="w-4 h-4 text-sky-400" />
                Próximos Plantões ({tvTracks.upcoming.length})
              </h2>
            </div>
            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
              {tvTracks.upcoming.map(s => (
                <div key={s.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-slate-400 font-semibold block">{getSectorName(s, sectorMap)}</span>
                    <strong className="text-sm text-slate-200 block truncate">{toTitleCase(s.professional_name)}</strong>
                  </div>
                  <span className="text-xs font-mono font-bold text-sky-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                    {s.start_time} - {s.end_time}
                  </span>
                </div>
              ))}
              {tvTracks.upcoming.length === 0 && <p className="text-xs text-slate-500 italic py-6 text-center">Sem próximos plantões agendados para hoje.</p>}
            </div>
          </div>

          {/* RAIÃO 3: VAGAS ABERTAS */}
          <div className="flex flex-col bg-slate-900/60 border border-amber-500/30 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2 mb-3">
              <h2 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Vagas Abertas ({tvTracks.vacancies.length})
              </h2>
            </div>
            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
              {tvTracks.vacancies.map(s => (
                <div key={s.id} className="p-3 bg-amber-950/20 border border-amber-500/50 rounded-xl flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-amber-300 font-bold block">{getSectorName(s, sectorMap)}</span>
                    <strong className="text-sm text-amber-200 block truncate">Vaga Descoberta</strong>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-slate-950 px-2 py-1 rounded border border-amber-900">
                    {s.start_time} - {s.end_time}
                  </span>
                </div>
              ))}
              {tvTracks.vacancies.length === 0 && <p className="text-xs text-slate-500 italic py-6 text-center">Todas as vagas preenchidas.</p>}
            </div>
          </div>

          {/* RAIÃO 4: PLANTÕES ANTERIORES (ENCERRADOS RECENTEMENTE) */}
          <div className="flex flex-col bg-slate-900/40 border border-slate-800 rounded-2xl p-4 shadow-xl opacity-80">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" />
                Plantão Anterior ({tvTracks.previous.length})
              </h2>
              <span className="text-[9px] text-slate-500 font-bold">&lt; {PREVIOUS_SHIFT_DISPLAY_MINUTES}min</span>
            </div>
            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
              {tvTracks.previous.map(s => (
                <div key={s.id} className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-slate-500 font-semibold block">{getSectorName(s, sectorMap)}</span>
                    <strong className="text-xs text-slate-400 block truncate">{toTitleCase(s.professional_name)}</strong>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-rose-400/80 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {s.start_time} - {s.end_time}
                  </span>
                </div>
              ))}
              {tvTracks.previous.length === 0 && <p className="text-xs text-slate-600 italic py-6 text-center">Nenhum plantão recente.</p>}
            </div>
          </div>

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
              <h1 className="text-lg font-black text-slate-900 dark:text-white">Escala Hospitalar</h1>
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
            <LayoutGrid className="w-3.5 h-3.5" /> Grade Mensal
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
            <SlidersHorizontal className="w-3.5 h-3.5" /> Modelo Base ({activeSectorName})
          </button>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadData(true)} disabled={refreshing} className="border-slate-200 dark:border-slate-800 text-xs h-9">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
          </Button>

          <Button onClick={() => setDuplicateModalOpen(true)} variant="outline" className="border-sky-500/40 text-sky-600 dark:text-sky-400 text-xs h-9 font-bold bg-sky-50 dark:bg-sky-950/20 gap-1.5">
            <Copy className="w-3.5 h-3.5" /> Duplicar Escala
          </Button>

          <Button onClick={() => setDayScheduleModal(true)} variant="outline" className="border-slate-300 dark:border-slate-700 text-xs h-9 font-bold">
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

      {/* BARRA DE FILTROS E NAVEGAÇÃO TEMPORAL (ATÉ 24 MESES) */}
      {viewMode !== 'base_builder' && (
        <div className="bg-slate-200/50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 p-2.5 px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            
            {/* Navegador Mensal com botões de avanço rápido */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-950 p-0.5 rounded-xl border border-slate-300 dark:border-slate-800">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  const [y, m] = selectedMonth.split('-').map(Number);
                  const prev = new Date(y, m - 2, 1);
                  setSelectedMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
                }}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>

              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-7 w-44 text-xs font-bold border-0 bg-transparent shadow-none"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs font-bold">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  const [y, m] = selectedMonth.split('-').map(Number);
                  const next = new Date(y, m, 1);
                  setSelectedMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
                }}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Seção:</span>
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

            {viewMode === 'grade' && sectorFilter !== 'todos' && (
              <Button onClick={handleGenerateMonthFromBase} variant="outline" className="h-8 text-xs font-bold bg-white dark:bg-slate-950 border-sky-400 text-sky-600 gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Preencher Mês com a Base
              </Button>
            )}
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
          MODO GRADE MENSAL (SÁBADOS E DOMINGOS INDEPENDENTES)
          ======================================================== */}
      {viewMode === 'grade' && (
        <div className="flex-1 flex overflow-hidden p-4 sm:px-6 pb-4">
          <Card className="flex-1 border-slate-200 dark:border-slate-800 shadow-sm flex overflow-hidden bg-white dark:bg-slate-900">
            
            {/* Lateral de Profissionais */}
            <div className="w-72 bg-slate-50/70 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <UsersRound className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> Corpo Clínico Ativo
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">{sidebarProfessionals.length}</span>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                  <Input placeholder="Buscar médico ativo..." value={profSearchQuery} onChange={e => setProfSearchQuery(e.target.value)} className="pl-8 h-7 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
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
                  <div className="p-6 text-center text-xs text-slate-400">Nenhum profissional ativo disponível.</div>
                )}
              </div>
            </div>

            {/* Calendário da Grade Mensal */}
            <div className="flex-1 overflow-auto bg-slate-50/30 dark:bg-slate-950 relative">
              {displayShiftsForSector.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-slate-700">
                    <SlidersHorizontal className="w-8 h-8 text-sky-600 dark:text-sky-400" />
                  </div>
                  <h3 className="font-black text-lg text-slate-800 dark:text-slate-100">
                    Nenhum turno configurado para {activeSectorName}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-1 mb-5">
                    Configure os horários no Modelo Base ou clique em "Duplicar Escala" para importar de outro mês.
                  </p>
                  <Button onClick={() => setViewMode('base_builder')} className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-10 px-6 shadow-md gap-2">
                    <Plus className="w-4 h-4" /> Configurar Modelo Base
                  </Button>
                </div>
              ) : (
                <div className="min-w-[900px] pb-8">
                  <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 sticky top-0 z-20 shadow-sm">
                    <div className="p-3 border-r border-slate-200 dark:border-slate-800 flex items-center justify-center font-black text-xs text-slate-500 uppercase tracking-wider bg-slate-200/60 dark:bg-slate-950">Turno</div>
                    {WEEK_DAYS_ORDER.map(day => (
                      <div key={day.index} className={`p-3 border-r border-slate-200 dark:border-slate-800 text-center font-bold text-xs uppercase tracking-wider ${day.weekend ? 'text-amber-600 dark:text-amber-400 bg-slate-100/60 dark:bg-slate-900/80' : 'text-slate-700 dark:text-slate-300'}`}>
                        {day.label}
                      </div>
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
                              title="Editar Turno"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>

                          {week.map((date, dIndex) => {
                            if (!date || date === 'disabled') return <div key={dIndex} className="bg-slate-100/40 dark:bg-slate-950/40 border-r border-slate-200 dark:border-slate-800"></div>;

                            // Plantões reais gravados no banco para esta célula
                            const slotShifts = filteredShifts.filter(s => 
                              String(s.date || '').startsWith(date) && 
                              s.start_time === period.start && 
                              s.end_time === period.end
                            );

                            const dayIndex = getDayOfWeekIndex(date);
                            const isActiveInBase = Boolean(period.cellStates && period.cellStates[dayIndex]);
                            const inDateRange = (!period.startDate || date >= period.startDate) && (!period.endDate || date <= period.endDate);
                            const disabledKey = `${date}:${period.id}`;
                            const isDayManuallyDisabled = Boolean(disabledDaysMap[disabledKey]);

                            // Quantidade requerida respeitando sábados e domingos
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
                                {renders.length === 0 && (
                                  <div className="absolute inset-0 flex items-center justify-center opacity-20 text-xs font-black text-slate-400">
                                    -
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
          MODO MODELO BASE (BLUEPRINT ISOLADO)
          ======================================================== */}
      {viewMode === 'base_builder' && (
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-6 flex justify-center">
          <div className="w-full max-w-5xl space-y-6">
            
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Selecione o Setor do Modelo Base:</h3>
                <p className="text-xs text-slate-400">Ajuste os horários e quantidade de vagas padrão por dia da semana.</p>
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
                <p className="text-xs text-slate-400 mt-1">Por favor, selecione um setor no menu acima para configurar a Escala Base.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-slate-900 dark:text-white">Modelo Base: {activeSectorName}</h2>
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">Molde Semanal</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Defina o molde de vagas para Segunda a Domingo.</p>
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
                          <th className="p-3.5 w-48 text-center border-r border-slate-200 dark:border-slate-800">Turno</th>
                          {WEEK_DAYS_ORDER.map(day => (
                            <th key={day.index} className={`p-3.5 text-center border-r border-slate-200 dark:border-slate-800 ${day.weekend ? 'bg-amber-500/10 text-amber-500' : ''}`}>
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
                                  <td key={day.index} className={`p-0 border-r border-slate-200 dark:border-slate-800 text-center relative ${day.weekend ? 'bg-amber-500/5' : ''}`}>
                                    <div className="relative w-full h-full min-h-[64px] flex items-center justify-center group/cell cursor-pointer" onClick={() => toggleBuilderCell(shift.id, day.index)}>
                                      <div className={`w-8 h-8 mx-auto rounded-lg font-black text-sm flex items-center justify-center transition-colors ${
                                        isActive ? 'bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-300 dark:border-slate-700 shadow-sm' : 'bg-transparent text-slate-300 dark:text-slate-700'
                                      }`}>
                                        {isActive ? shift.qty : '-'}
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
                    Voltar para a Grade Mensal
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

      {/* MODAL DE DUPLICAÇÃO MENSAL (BASE44) */}
      {duplicateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Copy className="w-4 h-4 text-sky-500" /> Duplicar Escala Mensal
              </h2>
              <button onClick={() => setDuplicateModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Mês de Origem (Copiar de):</label>
                <Select value={duplicateConfig.sourceMonth} onValueChange={(val) => setDuplicateConfig({ ...duplicateConfig, sourceMonth: val })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-52">
                    {monthOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Mês de Destino (Aplicar em):</label>
                <Select value={duplicateConfig.targetMonth} onValueChange={(val) => setDuplicateConfig({ ...duplicateConfig, targetMonth: val })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-52">
                    {monthOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-400 block">Modo de Cópia:</label>
                
                <div 
                  onClick={() => setDuplicateConfig({ ...duplicateConfig, includeProfessionals: false })}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    !duplicateConfig.includeProfessionals 
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40' 
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <strong className="block text-slate-900 dark:text-white">Duplicar Somente Estrutura (Recomendado)</strong>
                  <p className="text-[11px] text-slate-500 mt-0.5">Cria as vagas em aberto com os mesmos horários para alocação posterior.</p>
                </div>

                <div 
                  onClick={() => setDuplicateConfig({ ...duplicateConfig, includeProfessionals: true })}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    duplicateConfig.includeProfessionals 
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40' 
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <strong className="block text-slate-900 dark:text-white">Duplicar com os Médicos Alocados</strong>
                  <p className="text-[11px] text-slate-500 mt-0.5">Copia a escala idêntica, incluindo os profissionais já escalados.</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex gap-2">
                <Button variant="outline" onClick={() => setDuplicateModalOpen(false)} className="flex-1 h-10">Cancelar</Button>
                <Button onClick={handleExecuteDuplication} disabled={duplicating} className="flex-1 h-10 bg-sky-600 hover:bg-sky-700 text-white font-bold">
                  {duplicating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Duplicando...</> : 'Confirmar Duplicação'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ESCALA DO DIA E IMPRESSÃO A4 */}
      {dayScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-6xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-sky-600 dark:text-sky-400" /> Pré-visualização da Escala do Dia
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Data: <strong>{formatDateBR(todayTarget)}</strong> ({fmtDateLong(todayTarget)}) • {shiftsForDayModal.length} plantões cadastrados
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {shiftsForDayModal.map(s => {
                  const published = isShiftPublished(s.date, s.sector_id);
                  const timeInfo = getDetailedShiftStatus(s.date, s.start_time, s.end_time, currentTime, s.status, published);
                  const isVacant = !s.professional_id || normalizeStr(s.professional_name).includes('vaga') || getStatusKey(s.status) === 'disponivel';

                  return (
                    <div key={s.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center text-[10px] font-mono text-sky-600 dark:text-sky-400 font-bold mb-1">
                          <span>{s.start_time} - {s.end_time}</span>
                          <span className={`capitalize font-bold flex items-center gap-1 ${timeInfo.code === 'encerrado' ? 'text-rose-500' : timeInfo.code === 'andamento' ? 'text-emerald-500' : 'text-sky-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${timeInfo.code === 'encerrado' ? 'bg-rose-500' : timeInfo.code === 'andamento' ? 'bg-emerald-500 animate-ping' : 'bg-sky-500'}`} />
                            {timeInfo.code}
                          </span>
                        </div>
                        <div className="font-black text-xs text-slate-900 dark:text-slate-100 break-words">{isVacant ? 'Vaga Aberta' : toTitleCase(s.professional_name)}</div>
                        <div className="text-[10px] text-slate-400 mt-1">{getSectorName(s, sectorMap)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                  <div className="text-[11px] text-sky-700 dark:text-sky-400">Escolha um médico do corpo clínico ativo</div>
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
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Publicar vaga com remuneração calculada</div>
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
                        {isCurrentlyDisabled ? 'Ativar vaga neste dia' : 'Inativar vaga neste dia'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {isCurrentlyDisabled ? 'Restabelece a vaga no dia selecionado' : 'Oculta a vaga nesta data'}
                      </div>
                    </div>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ALOCAÇÃO DE MÉDICO */}
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

      {/* MODAL: CONFLITO DE HORÁRIO */}
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

      {/* MODAL: ADICIONAR / EDITAR TURNO NA ESCALA BASE */}
      {builderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {builderModal.isNew ? 'Adicionar Turno ao Modelo' : 'Editar Turno do Modelo'}
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
                <Input value={builderForm.name} onChange={e => setBuilderForm({...builderForm, name: e.target.value})} placeholder="Ex: Diurno 12h, Noturno 12h" className="h-9" />
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

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Quantidade de Vagas:</label>
                <Input type="number" min="1" value={builderForm.qty} onChange={e => setBuilderForm({...builderForm, qty: Number(e.target.value)})} className="h-9" />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 mb-2 block">Dias da Semana Ativos:</label>
                <div className="grid grid-cols-7 gap-1">
                  {WEEK_DAYS_ORDER.map(day => {
                    const isSelected = (builderForm.days || []).includes(day.index);
                    return (
                      <button 
                        key={day.index} 
                        type="button"
                        onClick={() => toggleBuilderDay(day.index)}
                        className={`p-2 rounded-lg border text-[10px] font-bold transition-all ${
                          isSelected 
                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400' 
                            : 'border-slate-200 dark:border-slate-800 text-slate-400'
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
                <Button onClick={saveBuilderShiftModel} className="h-9 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs">Salvar Turno</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG DE EDIÇÃO AVULSA */}
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