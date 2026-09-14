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
  UsersRound, X, FileText, ShieldAlert
} from 'lucide-react';
import ShiftFormDialog from '@/components/shifts/ShiftFormDialog';

/* ============================================================
   ERROR BOUNDARY NATIVO
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
    console.error('Crash isolado no módulo de Escalas:', err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-xl font-black">Recuperação de Interface</h2>
            <p className="text-xs text-slate-400 mt-2 mb-6">
              Ocorreu um erro no carregamento da tela: <br />
              <span className="text-amber-400 font-mono mt-1 inline-block">{this.state.errorMsg}</span>
            </p>
            <Button
              onClick={() => {
                try {
                  window.localStorage.removeItem('escala_setor_fixado_v8');
                  window.localStorage.removeItem('hospital-escala-base-v8');
                } catch (e) {}
                window.location.reload();
              }}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold h-11"
            >
              Restaurar Padrões e Recarregar
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ============================================================
   CONSTANTES E HELPERS
   ============================================================ */
const STORAGE_BASE_PREFIX = 'hospital_escala_base_v9';
const STORAGE_SECTOR_KEY = 'escala_setor_fixado_v9';
const STORAGE_PUBLISHED_KEY = 'hospital_escala_publicada_v9';

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

const DEFAULT_GENERIC_SHIFTS = [
  { id: 'p_manha', name: 'Manhã', start: '07:00', end: '13:00', qty: 1, cellStates: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true } },
  { id: 'p_tarde', name: 'Tarde', start: '13:00', end: '19:00', qty: 1, cellStates: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true } },
  { id: 'p_noite', name: 'Noite', start: '19:00', end: '07:00', qty: 1, cellStates: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true } }
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
function getProfessionalName(s, m = {}) {
  if (s?.professional_name) return s.professional_name;
  const id = getProfessionalId(s);
  return id && m[id] ? m[id].name || m[id].full_name || 'Profissional' : 'Vaga Aberta';
}
function isAssignedShift(s) { return Boolean(getProfessionalId(s)) && !normalizeStr(s?.professional_name).includes('vaga'); }

function getRealTimeStatus(dateStr, startStr, endStr, currentTime, explicitStatus) {
  const currentKey = getStatusKey(explicitStatus);
  if (currentKey === 'cancelado' || currentKey === 'falta') return 'cancelado';
  if (currentKey === 'concluido' || currentKey === 'realizado') return 'concluido';

  if (!dateStr) return 'programado';
  const shiftDate = normalizeDate(dateStr);
  const today = getLocalDateString(currentTime);

  if (shiftDate < today) return 'concluido';
  if (shiftDate > today) return 'programado';

  if (startStr && endStr) {
    const currentHour = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
    if (startStr > endStr) {
      if (currentHour >= startStr || currentHour <= endStr) return 'andamento';
    } else {
      if (currentHour < startStr) return 'programado';
      if (currentHour >= startStr && currentHour <= endStr) return 'andamento';
      if (currentHour > endStr) return 'concluido';
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

  // Setor fixado de forma segura
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
  const [publishedInfo, setPublishedInfo] = useState(() => {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_PUBLISHED_KEY}:${companyId}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  // Modal Alocação e Retroativo
  const [newShiftModal, setNewShiftModal] = useState(null); 
  const [selectedProfIdForModal, setSelectedProfIdForModal] = useState(''); 
  const [retroactiveReason, setRetroactiveReason] = useState('');
  const [retroactivePerformed, setRetroactivePerformed] = useState('concluido');

  // Modal de Pré-visualização da Escala do Dia
  const [dayScheduleModal, setDayScheduleModal] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tvMode, setTvMode] = useState(false);
  
  // Builder Escala Base
  const [builderModal, setBuilderModal] = useState(null);
  const [builderShifts, setBuilderShifts] = useState([]);
  const [builderForm, setBuilderForm] = useState({ id: '', name: '', start: '', end: '', qty: 1, color: BUILDER_COLORS[0], days: [1,2,3,4,5] });
  const [confirmGoToAllocation, setConfirmGoToAllocation] = useState(false);

  // Inicializa tema no HTML global
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

  // Carregamento de dados com fallback à prova de falhas
  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const query = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
      const [sRaw, secRaw, pRaw] = await Promise.all([
        base44?.entities?.Shift?.filter ? base44.entities.Shift.filter(query, '-date', 3000).catch(() => []) : [],
        base44?.entities?.Sector?.filter ? base44.entities.Sector.filter(query, '-created_date', 300).catch(() => []) : [],
        base44?.entities?.Professional?.filter ? base44.entities.Professional.filter(query, '-created_date', 1500).catch(() => []) : [],
      ]);

      const safeShifts = safeArray(Array.isArray(sRaw) ? sRaw : sRaw?.data);
      const safeSectors = safeArray(Array.isArray(secRaw) ? secRaw : secRaw?.data);
      const safeProfessionals = safeArray(Array.isArray(pRaw) ? pRaw : pRaw?.data);

      setShifts(safeShifts);
      setSectors(safeSectors);
      setProfessionals(safeProfessionals);
    } catch (e) {
      console.warn("Aviso na leitura de dados:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, unitId]);

  useEffect(() => { if (!appLoading) loadData(); }, [appLoading, loadData]);
  useEffect(() => { const id = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(id); }, []);

  // Leitura segura da Escala Base por Setor
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

  // Lista dos Plantões Filtrados e Ordenados Crescente
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
      const rTimeStatus = getRealTimeStatus(s.date, s.start_time, s.end_time, currentTime, s.status);
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
  }, [shifts, sectorFilter, selectedMonth, selectedDate, viewMode, currentTime]);

  const weeksDataGrid = useMemo(() => getMonthWeeks(selectedMonth), [selectedMonth]);

  // Montagem Dinâmica de Linhas (Protegida contra undefined)
  const displayShiftsForSector = useMemo(() => {
    if (sectorFilter === 'todos') return [];
    if (safeArray(builderShifts).length > 0) return builderShifts;

    // Se a Escala Base ainda não foi configurada, extrai horários já cadastrados nos plantões
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
    return DEFAULT_GENERIC_SHIFTS;
  }, [sectorFilter, builderShifts, filteredShifts]);

  // Profissionais da Barra Lateral Cruzados com o Setor
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
    setSelectedCells([]);
    setSelectedProfIdForModal('');
    setRetroactiveReason('');
    setRetroactivePerformed('concluido');
    setNewShiftModal({ date, shiftObj, sectorIdTarget: sectorIdTarget || sectorFilter });
  };

  const handleDragStart = (e, prof) => { if (prof?.id) e.dataTransfer.setData('profId', prof.id); };
  const handleDragOver = (e) => { e.preventDefault(); };

  const assignShift = async (date, shiftDef, profId, reasonText = '', explicitStatus = 'confirmado', sectorTarget = null) => {
    const secId = sectorTarget && sectorTarget !== 'todos' ? sectorTarget : sectorFilter;
    if (secId === 'todos') { alert("Selecione uma seção específica no topo para alocar o profissional."); return; }
    
    const prof = professionalMap[profId];
    const sectorObj = safeArray(sectors).find(s => String(s.id) === String(secId));
    if (!prof || !sectorObj) return;

    try {
      const existingShift = safeArray(filteredShifts).find(s => 
        String(s.date || '').startsWith(date) && 
        s.start_time === shiftDef.start && 
        s.end_time === shiftDef.end && 
        String(s.sector_id) === String(secId) &&
        s.isVacant
      );

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
        duration_hours: getShiftHours({ start_time: shiftDef.start, end_time: shiftDef.end }), 
        status: explicitStatus,
        notes
      };
      
      if (existingShift?.id) await base44.entities.Shift.update(existingShift.id, payload);
      else await base44.entities.Shift.create(payload);
      loadData(true);
    } catch (error) {
      alert("Erro ao salvar plantão: " + (error?.message || 'Tente novamente.'));
    }
  };

  const handleDrop = (e, date, shiftDef, sectorTarget = null) => {
    e.preventDefault();
    const profId = e.dataTransfer.getData('profId');
    if (!profId) return;

    if (isDateRetroactive(date)) {
      setNewShiftModal({ date, shiftObj: shiftDef, sectorIdTarget: sectorTarget || sectorFilter, preSelectedProfId: profId });
      return;
    }

    assignShift(date, shiftDef, profId, '', 'confirmado', sectorTarget);
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja cancelar este plantão? Ele não entrará no pagamento.')) return;
    try {
      await base44.entities.Shift.update(id, { status: 'cancelado' });
      loadData(true);
    } catch (e) {
      alert('Erro ao cancelar.');
    }
  };

  const handleClearSectorVacancies = async () => {
    if (sectorFilter === 'todos') {
      alert('Selecione uma seção específica para limpar as vagas.');
      return;
    }
    const vacantShifts = filteredShifts.filter(s => s.isVacant && s.id);
    if (vacantShifts.length === 0) {
      alert('Nenhuma vaga aberta encontrada para esta seção.');
      return;
    }
    if (!confirm(`Deseja cancelar ${vacantShifts.length} vaga(s) de ${activeSectorName}?`)) return;

    try {
      await Promise.all(vacantShifts.map(s => base44.entities.Shift.update(s.id, { status: 'cancelado' })));
      loadData(true);
      alert('Vagas canceladas com sucesso!');
    } catch (e) {
      alert('Erro ao limpar vagas.');
    }
  };

  const handleConfirmPublish = () => {
    const payload = {
      sectorId: sectorFilter,
      sectorName: activeSectorName,
      start: publishRange.start,
      end: publishRange.end,
      publishedAt: new Date().toISOString()
    };
    try {
      window.localStorage.setItem(`${STORAGE_PUBLISHED_KEY}:${companyId}`, JSON.stringify(payload));
    } catch (e) {}
    setPublishedInfo(payload);
    setPublishModalOpen(false);
    alert(`Escala de ${activeSectorName} publicada de ${formatDateBR(publishRange.start)} até ${formatDateBR(publishRange.end)}!`);
  };

  // Funções Escala Base
  const openNewBuilderModal = () => {
    setBuilderForm({ id: '', name: '', start: '', end: '', qty: 1, color: BUILDER_COLORS[0], days: [1,2,3,4,5] });
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
      alert('Preencha o nome do turno, início e fim.');
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

  /* ============================================================
     IMPRESSÃO OFICIAL DO MURAL (PADRÃO A4 HORIZONTAL BRANCO)
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
        const rStatus = getRealTimeStatus(s.date, s.start_time, s.end_time, currentTime, s.status);
        const statusLabel = {
          concluido: '<span style="color:#059669; font-weight:bold;">Concluído</span>',
          andamento: '<span style="color:#0284c7; font-weight:bold;">Em Atendimento</span>',
          programado: '<span style="color:#475569;">Programado</span>'
        }[rStatus] || 'Programado';

        const isVacant = !s.professional_id || normalizeStr(s.professional_name).includes('vaga');
        const profName = isVacant ? '<span style="color:#dc2626; font-weight:bold;">[ VAGA DESCOBERTA ]</span>' : escapeHtml(toTitleCase(s.professional_name));
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
              ${isVacant ? '<span style="color:#dc2626; font-weight:bold;">Aberta</span>' : statusLabel}
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

  /* ============================================================
     PRÉVIA DA ESCALA DO DIA
     ============================================================ */
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
      <div className="fixed inset-0 z-[99999] bg-slate-950 text-white flex flex-col p-6 font-sans overflow-hidden">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-6">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-sky-600 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-600/30">
               <Activity className="w-7 h-7 text-white" />
             </div>
             <div>
               <h1 className="text-3xl font-black tracking-tight text-white">Escala e Plantões TV</h1>
               <p className="text-sm text-sky-400 font-semibold">{fmtDateLong(todayStr)} • {formatDateBR(todayStr)} (Todos os Setores Ativos)</p>
             </div>
           </div>
           <div className="flex gap-6 items-center">
             <div className="text-right">
                <div className="text-3xl font-mono text-emerald-400 font-black">{currentTime.toLocaleTimeString('pt-BR')}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest">Horário Oficial</div>
             </div>
             <Button onClick={() => setTvMode(false)} className="bg-slate-800 hover:bg-slate-700 p-3 rounded-2xl border border-slate-700"><Minimize2 className="w-5 h-5"/></Button>
           </div>
        </div>

        <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
           {safeArray(sectors).map(sector => {
             const secShifts = todayShifts.filter(s => String(s.sector_id) === String(sector.id));
             if (secShifts.length === 0) return null;

             return (
               <div key={sector.id} className="p-5 rounded-3xl border bg-slate-900 border-slate-800 flex flex-col shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-sky-400" /> {sector.name}
                    </h2>
                    <span className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-300 font-bold">{secShifts.length} plantões</span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                     {secShifts.map(s => {
                       const rStatus = getRealTimeStatus(s.date, s.start_time, s.end_time, currentTime, s.status);
                       const isVacant = !s.professional_id || normalizeStr(s.professional_name).includes('vaga');

                       const cardStyles = {
                         concluido: 'bg-slate-800/60 border-slate-800 opacity-60',
                         andamento: 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/50',
                         programado: 'bg-slate-800 border-slate-700'
                       }[rStatus];

                       return (
                         <div key={s.id} className={`p-4 border rounded-2xl flex items-center justify-between ${isVacant ? 'bg-amber-950/30 border-amber-500/60 animate-pulse' : cardStyles}`}>
                            <div>
                              <div className="flex items-center gap-2">
                                {isVacant ? (
                                  <span className="text-amber-400 text-[11px] font-black tracking-widest uppercase">⚠️ VAGA ABERTA</span>
                                ) : rStatus === 'andamento' ? (
                                  <span className="text-emerald-400 text-[11px] font-black tracking-widest uppercase flex items-center gap-1">● EM ATENDIMENTO</span>
                                ) : rStatus === 'concluido' ? (
                                  <span className="text-slate-400 text-[11px] font-black tracking-widest uppercase">CONCLUÍDO</span>
                                ) : (
                                  <span className="text-sky-400 text-[11px] font-black tracking-widest uppercase">PROGRAMADO</span>
                                )}
                              </div>
                              <b className="text-lg text-white block mt-1 break-words">{isVacant ? 'PLANTÃO DESCOBERTO' : toTitleCase(s.professional_name)}</b>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-mono font-bold text-slate-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">{s.start_time} às {s.end_time}</span>
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
      
      {/* CABEÇALHO SUPERIOR */}
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
              
              {/* BOTÃO TEMA INTEGRADO */}
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

        {/* NAVEGAÇÃO DE ABAS CENTRAIS */}
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

      {/* BARRA DE FILTROS SUPERIOR */}
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
            {publishedInfo && (sectorFilter === 'todos' || publishedInfo.sectorId === sectorFilter) && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold">
                ✓ Publicada até {formatDateBR(publishedInfo.end)}
              </span>
            )}
            {sectorFilter !== 'todos' && (
              <Button variant="ghost" onClick={handleClearSectorVacancies} className="text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 h-8">
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Limpar Vagas Abertas
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MODO GRADE VISUAL (BUILDER)
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

            {/* Calendário da Grade com Suporte a Todos os Setores e Setor Específico */}
            <div className="flex-1 overflow-auto bg-slate-50/30 dark:bg-slate-950 relative">
              {sectorFilter === 'todos' ? (
                /* VISÃO CONSOLIDADA DE TODOS OS SETORES */
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
                          <span className="text-xs text-slate-500">{secShifts.length} plantões no mês</span>
                        </div>

                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {secShifts.map(s => {
                            const statusStyles = {
                              concluido: 'border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-400',
                              andamento: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/50',
                              programado: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                            }[s.rTimeStatus];

                            return (
                              <div key={s.id} className={`p-3 rounded-xl border flex flex-col justify-between ${s.isVacant ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 text-amber-800 dark:text-amber-200 border-dashed' : statusStyles}`}>
                                <div>
                                  <div className="flex items-center justify-between text-[10px] font-bold opacity-70 mb-1">
                                    <span>{formatDateBR(s.date)}</span>
                                    <span className="font-mono">{s.start_time} - {s.end_time}</span>
                                  </div>
                                  <div className="font-black text-xs break-words">{s.isVacant ? 'Vaga Aberta' : toTitleCase(s.professional_name)}</div>
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[10px]">
                                  <span className="capitalize font-bold">{s.rTimeStatus}</span>
                                  {!s.isVacant && s.rTimeStatus !== 'concluido' && (
                                    <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:underline">Cancelar</button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* VISÃO DA GRADE DO SETOR ESPECÍFICO (Com Fallback Dinâmico) */
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
                          <div key={dIndex} className={`p-1 border-r border-slate-200 dark:border-slate-800 text-right pr-2 text-[10px] font-black ${date ? 'text-slate-500 dark:text-slate-400' : 'text-transparent'}`}>
                            {date ? `${date.split('-')[2]}/${date.split('-')[1]}` : '-'}
                          </div>
                        ))}
                      </div>

                      {displayShiftsForSector.map((period) => (
                        <div key={period.id} className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800/80 last:border-b-0 group">
                          
                          <div className="p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col items-center justify-center text-center">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-200">{period.name}</span>
                            <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono mt-0.5">{period.start} - {period.end}</span>
                          </div>

                          {week.map((date, dIndex) => {
                            if (!date) return <div key={dIndex} className="bg-slate-100/40 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800"></div>;

                            const slotShifts = filteredShifts.filter(s => 
                              String(s.date || '').startsWith(date) && 
                              s.start_time === period.start && 
                              s.end_time === period.end
                            );

                            const dIndexBase = new Date(`${date}T12:00:00`).getDay();
                            const isActiveInBase = Boolean(period.cellStates && period.cellStates[dIndexBase]);
                            const requiredQty = isActiveInBase ? (period.qty || 1) : 0;
                            
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
                                {renders.length === 0 && !isActiveInBase && (
                                  <div className="absolute inset-0 flex items-center justify-center opacity-20 text-xs font-black text-slate-400">-</div>
                                )}

                                {renders.map((s, idx) => {
                                  const rStatus = s.rTimeStatus;
                                  return (
                                    <div key={s.id || `vaga_${idx}`} className={`relative p-2 rounded-xl text-xs border flex items-center justify-between group/item transition-all shadow-sm ${
                                      s.isVacant 
                                        ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 border-dashed' 
                                        : rStatus === 'concluido'
                                        ? 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-400 opacity-75'
                                        : rStatus === 'andamento'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                                    }`}>
                                      <div className="min-w-0 flex-1 pr-2">
                                        <div className="font-bold text-xs break-words leading-tight">
                                          {s.isVacant ? 'Vaga Aberta' : toTitleCase(s.professional_name)}
                                        </div>
                                        {!s.isVacant && (
                                          <div className="text-[10px] font-semibold opacity-75 mt-0.5 capitalize flex items-center gap-1">
                                            {rStatus === 'concluido' && <Lock className="w-2.5 h-2.5 inline" />}
                                            {rStatus}
                                          </div>
                                        )}
                                      </div>
                                      
                                      {!s.isVacant && s.id && (
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="opacity-0 group-hover/item:opacity-100 p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded transition-opacity">
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
          MODAL HORIZONTAL: ESCALA DO DIA
          ======================================================== */}
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
                                <span className="capitalize text-slate-500">{rStatus}</span>
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

      {/* ========================================================
          MODAL: ALOCAÇÃO E TRAVA RETROATIVA OBRIGATÓRIA
          ======================================================== */}
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

              {/* TRAVA RETROATIVA OBRIGATÓRIA */}
              {isDateRetroactive(newShiftModal.date) && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-3">
                  <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-black text-xs">
                    <ShieldAlert className="w-4 h-4" /> Lançamento Retroativo Detectado
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    A data selecionada já passou. Para fins de auditoria e cálculo correto de pagamentos, informe:
                  </p>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-amber-900 dark:text-amber-300 mb-1 block">O plantão foi realizado?</label>
                    <Select value={retroactivePerformed} onValueChange={setRetroactivePerformed}>
                      <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900 border-amber-300"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="concluido">Sim, Plantão Realizado (Entra no pagamento)</SelectItem>
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
              Deseja ir para o Builder Visual e começar a preencher os plantonistas nas vagas de {activeSectorName}?
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-xs" onClick={() => setConfirmGoToAllocation(false)}>Depois</Button>
              <Button className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-9" onClick={() => { setConfirmGoToAllocation(false); setViewMode('grade'); }}>Sim, Alocar</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVO TURNO NO BUILDER */}
      {builderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {builderModal.isNew ? 'Adicionar Linha de Turno' : 'Editar Turno'}
              </h3>
              <button onClick={() => setBuilderModal(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
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
                <Button onClick={saveBuilderShift} className="h-9 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs">Salvar Linha</Button>
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