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
  Maximize2, Minimize2, Pencil, Plus, Printer, RefreshCw,
  Search, Send, SlidersHorizontal, Trash2, UserPlus, UsersRound, X, Check
} from 'lucide-react';
import ShiftFormDialog from '@/components/shifts/ShiftFormDialog';

/* ============================================================
   ERROR BOUNDARY
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
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-xl font-black">Recuperação de Interface</h2>
            <p className="text-xs text-slate-400 mt-2 mb-6">
              Ocorreu um problema ao carregar a visualização. Clique abaixo para reiniciar.
            </p>
            <Button
              onClick={() => {
                try {
                  window.localStorage.removeItem('escala_setor_fixado');
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
const STORAGE_BASE_PREFIX = 'hospital-escala-base-v6';
const STORAGE_SECTOR_KEY = 'escala_setor_fixado';
const STORAGE_PUBLISHED_KEY = 'hospital_escala_publicada';

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
function getSectorName(s, m = {}) { if (s?.sector_name) return s.sector_name; return s?.sector_id && m[s.sector_id] ? m[s.sector_id].name : 'Setor'; }
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

/* ============================================================
   COMPONENTE DE CONTEÚDO
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

  // Setor fixado no localStorage
  const [sectorFilter, setSectorFilter] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_SECTOR_KEY) || 'todos';
    } catch {
      return 'todos';
    }
  });

  const [profSearchQuery, setProfSearchQuery] = useState('');
  const [selectedCells, setSelectedCells] = useState([]);
  
  // Publicação persistente
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
    } catch {
      return null;
    }
  });

  const [newShiftModal, setNewShiftModal] = useState(null); 
  const [selectedProfIdForModal, setSelectedProfIdForModal] = useState(''); 
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tvMode, setTvMode] = useState(false);
  
  // Builder Escala Base
  const [builderModal, setBuilderModal] = useState(null);
  const [builderScaleDate, setBuilderScaleDate] = useState(() => getLocalDateString());
  const [builderShifts, setBuilderShifts] = useState([]);
  const [builderForm, setBuilderForm] = useState({ id: '', name: '', start: '', end: '', qty: 1, color: BUILDER_COLORS[0], days: [] });
  const [confirmGoToAllocation, setConfirmGoToAllocation] = useState(false);

  // Persistir escolha de setor
  const handleSectorChange = (newSectorId) => {
    setSectorFilter(newSectorId);
    try {
      window.localStorage.setItem(STORAGE_SECTOR_KEY, newSectorId);
    } catch (e) {}
  };

  // Carregamento de dados
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

      setSectorFilter(prev => {
        if ((prev === 'todos' || !prev) && safeSectors.length > 0) {
          const firstId = String(safeSectors[0].id);
          try { window.localStorage.setItem(STORAGE_SECTOR_KEY, firstId); } catch (e) {}
          return firstId;
        }
        return prev;
      });
    } catch (e) {
      console.warn("Erro ao carregar dados", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, unitId]);

  useEffect(() => { if (!appLoading) loadData(); }, [appLoading, loadData]);
  useEffect(() => { const id = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(id); }, []);

  // Escala Base por Setor (Inicia vazia para preenchimento manual)
  useEffect(() => {
    if (sectorFilter === 'todos') return;
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

  // Cruzamento dos Plantões em Ordem Crescente
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
        isVacant: !s.professional_id || pName.includes('vaga')
      };
    });

    // Ordenação Crescente
    return result.sort((a, b) => {
      if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
      return String(a.start_time || '').localeCompare(String(b.start_time || ''));
    });
  }, [shifts, sectorFilter, selectedMonth, selectedDate, viewMode, currentTime]);

  const weeksDataGrid = useMemo(() => getMonthWeeks(selectedMonth), [selectedMonth]);

  // Profissionais Filtrados por Setor
  const sidebarProfessionals = useMemo(() => {
    const term = normalizeStr(profSearchQuery);
    return safeArray(professionals).filter(p => {
      if (!p?.id) return false;
      const matchesSearch = !term || normalizeStr(p.name || p.full_name).includes(term) || normalizeStr(p.specialty).includes(term);
      const matchesSector = sectorFilter === 'todos' || !p.sector_id || String(p.sector_id) === String(sectorFilter) || (Array.isArray(p.sectors) && p.sectors.includes(sectorFilter));
      return matchesSearch && matchesSector;
    });
  }, [professionals, profSearchQuery, sectorFilter]);

  // Ações da Grade e Alocação
  const handleCellClick = (e, date, shiftObj) => {
    if (e.ctrlKey || e.metaKey) {
      const cellKey = `${date}:${shiftObj.id}`;
      if (selectedCells.includes(cellKey)) {
        setSelectedCells(selectedCells.filter(c => c !== cellKey));
      } else {
        setSelectedCells([...selectedCells, cellKey]);
      }
    } else {
      setSelectedCells([]);
      setSelectedProfIdForModal('');
      setNewShiftModal({ date, shiftObj });
    }
  };

  const handleDragStart = (e, prof) => { if (prof?.id) e.dataTransfer.setData('profId', prof.id); };
  const handleDragOver = (e) => { e.preventDefault(); };

  const assignShift = async (date, shiftDef, profId) => {
    if (sectorFilter === 'todos') { alert("Selecione um setor específico para alocar."); return; }
    
    const prof = professionalMap[profId];
    const sectorObj = safeArray(sectors).find(s => String(s.id) === String(sectorFilter));
    if (!prof || !sectorObj) return;

    try {
      const existingShift = safeArray(filteredShifts).find(s => 
        String(s.date || '').startsWith(date) && 
        s.start_time === shiftDef.start && 
        s.end_time === shiftDef.end && 
        s.isVacant
      );

      // Payload sem builder_id para evitar erro de schema no Supabase/Base44
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
        status: 'confirmado',
        notes: `Turno: ${shiftDef.name}`
      };
      
      if (existingShift?.id) await base44.entities.Shift.update(existingShift.id, payload);
      else await base44.entities.Shift.create(payload);
      loadData(true);
    } catch (error) {
      alert("Erro ao salvar plantão: " + (error?.message || 'Tente novamente.'));
    }
  };

  const handleDrop = (e, date, shiftDef) => {
    e.preventDefault();
    const profId = e.dataTransfer.getData('profId');
    if (!profId) return;

    assignShift(date, shiftDef, profId);
    setSelectedCells([]);
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja cancelar este plantão?')) return;
    try {
      await base44.entities.Shift.update(id, { status: 'cancelado' });
      loadData(true);
    } catch (e) {
      alert('Erro ao cancelar.');
    }
  };

  // Limpar vagas do setor atual
  const handleClearSectorVacancies = async () => {
    if (sectorFilter === 'todos') {
      alert('Selecione um setor específico para limpar as vagas.');
      return;
    }
    const vacantShifts = filteredShifts.filter(s => s.isVacant && s.id);
    if (vacantShifts.length === 0) {
      alert('Nenhuma vaga aberta encontrada para este setor no período.');
      return;
    }
    if (!confirm(`Deseja cancelar ${vacantShifts.length} vaga(s) aberta(s) do setor ${activeSectorName}?`)) return;

    try {
      await Promise.all(vacantShifts.map(s => base44.entities.Shift.update(s.id, { status: 'cancelado' })));
      loadData(true);
      alert('Vagas canceladas com sucesso!');
    } catch (e) {
      alert('Erro ao limpar vagas.');
    }
  };

  // Salvar publicação persistente
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

  // Funções da Escala Base
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
      alert('Preencha o nome da equipe, horário inicial e final.');
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

  if (loading && !shifts.length) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
          <div className="text-slate-400 font-semibold text-sm">Carregando Escalas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      
      {/* ========================================================
          CABEÇALHO NO TOPO
          ======================================================== */}
      <header className="bg-slate-900 border-b border-slate-800 p-3 px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center shadow-md">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white">Escala e Plantões</h1>
              {/* Badge indicando setor fixado */}
              <div className="bg-sky-500/20 text-sky-400 border border-sky-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {activeSectorName}
              </div>
            </div>
            <p className="text-[11px] text-slate-400">Ambiente de Operação e Alocação Médica</p>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS SUPERIORES */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewMode('grade')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-black rounded-lg transition-all ${
              viewMode === 'grade' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Builder Visual
          </button>
          
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-black rounded-lg transition-all ${
              viewMode === 'list' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" /> Lista Diária
          </button>
          
          <button
            onClick={() => setViewMode('base_builder')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-black rounded-lg transition-all ${
              viewMode === 'base_builder' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Escala Base ({activeSectorName})
          </button>
        </div>

        {/* AÇÕES DE CABEÇALHO */}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadData(true)} disabled={refreshing} className="border-slate-800 text-xs h-9 bg-slate-900 text-slate-200">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
          </Button>

          {viewMode === 'list' && (
            <Button onClick={() => window.print()} variant="outline" className="border-slate-800 text-xs h-9 bg-slate-900 text-slate-200 font-bold">
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Imprimir
            </Button>
          )}

          <Button onClick={() => setTvMode(true)} className="bg-slate-800 hover:bg-slate-700 text-white text-xs h-9 font-bold border border-slate-700">
            <Maximize2 className="w-3.5 h-3.5 mr-1.5" /> Modo TV
          </Button>

          {viewMode === 'grade' && (
            <Button onClick={() => setPublishModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-bold shadow-md">
              <Send className="w-3.5 h-3.5 mr-1.5" /> Publicar Escala
            </Button>
          )}
        </div>
      </header>

      {/* ========================================================
          BARRA DE FILTROS SUPERIOR
          ======================================================== */}
      {viewMode !== 'base_builder' && (
        <div className="bg-slate-900/60 border-b border-slate-800 p-2.5 px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-slate-400">Mês:</span>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-8 w-40 text-xs bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
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
                <span className="text-[10px] font-bold uppercase text-slate-400">Dia Específico:</span>
                <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="h-8 w-36 text-xs bg-slate-950 border-slate-800" />
                {selectedDate && <button onClick={() => setSelectedDate('')} className="text-xs text-sky-400 hover:underline">Limpar dia</button>}
              </div>
            )}

            {/* SELETOR DE SETOR COM INDICAÇÃO VISUAL */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-slate-400">Seção Ativa:</span>
              <Select value={sectorFilter} onValueChange={handleSectorChange}>
                <SelectTrigger className="h-8 w-56 text-xs bg-slate-950 border-slate-800 font-bold text-sky-400">
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

          {/* AÇÕES ADICIONAIS DO SETOR */}
          <div className="flex items-center gap-2">
            {publishedInfo && publishedInfo.sectorId === sectorFilter && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                ✓ Publicada até {formatDateBR(publishedInfo.end)}
              </span>
            )}
            <Button variant="ghost" onClick={handleClearSectorVacancies} className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20 h-8">
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Limpar Vagas Abertas
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================
          MODO GRADE VISUAL (BUILDER)
          ======================================================== */}
      {viewMode === 'grade' && (
        <div className="flex-1 flex overflow-hidden p-4 sm:px-6 pb-4">
          <Card className="flex-1 border-slate-800 shadow-sm flex overflow-hidden bg-slate-900">
            
            {/* Lateral de Profissionais Cruzados */}
            <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
              <div className="p-3 border-b border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                    <UsersRound className="w-3.5 h-3.5 text-sky-400" /> Corpo Clínico
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500">{sidebarProfessionals.length}</span>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
                  <Input placeholder="Buscar médico..." value={profSearchQuery} onChange={e => setProfSearchQuery(e.target.value)} className="pl-8 h-7 text-xs bg-slate-900 border-slate-800" />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sidebarProfessionals.map(prof => (
                  <div key={prof.id} draggable onDragStart={(e) => handleDragStart(e, prof)} className="p-2 bg-slate-900 border border-slate-800 hover:border-sky-500 rounded-lg shadow-sm cursor-grab active:cursor-grabbing flex items-center gap-2 group transition-all">
                    <GripVertical className="w-3.5 h-3.5 text-slate-600 group-hover:text-sky-400" />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-200 truncate">{prof.name || prof.full_name || 'Profissional'}</div>
                      <div className="text-[10px] text-slate-500 truncate">{prof.specialty || 'Clínica'}</div>
                    </div>
                  </div>
                ))}
                {sidebarProfessionals.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-500">Nenhum profissional encontrado para {activeSectorName}.</div>
                )}
              </div>
            </div>

            {/* Calendário da Grade */}
            <div className="flex-1 overflow-auto bg-slate-950 relative">
              {sectorFilter === 'todos' ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                  <Building2 className="w-12 h-12 mb-3 text-slate-600" />
                  <p className="font-bold text-slate-300">Selecione uma Seção Específica no Topo</p>
                  <p className="text-xs text-slate-500 mt-1">Para organizar e alocar a grade, escolha a seção de atendimento.</p>
                </div>
              ) : builderShifts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                  <SlidersHorizontal className="w-12 h-12 mb-3 text-slate-600" />
                  <p className="font-bold text-slate-300">Escala Base Vazia para {activeSectorName}</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">Você ainda não configurou os horários dessa seção.</p>
                  <Button onClick={() => setViewMode('base_builder')} className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-9">
                    Configurar Horários da Seção
                  </Button>
                </div>
              ) : (
                <div className="min-w-[900px] pb-8">
                  {/* Cabeçalho dos Dias */}
                  <div className="grid grid-cols-8 border-b border-slate-800 bg-slate-900 sticky top-0 z-20 shadow-sm">
                    <div className="p-2.5 border-r border-slate-800 flex items-center justify-center font-black text-xs text-slate-400 uppercase tracking-wider bg-slate-950">Turno</div>
                    {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map(day => (
                      <div key={day} className="p-2.5 border-r border-slate-800 text-center font-bold text-xs text-slate-300 uppercase tracking-wider">{day}</div>
                    ))}
                  </div>

                  {weeksDataGrid.map((week, wIndex) => (
                    <div key={wIndex} className="border-b-[4px] border-slate-900">
                      {/* Subcabeçalho de datas */}
                      <div className="grid grid-cols-8 bg-slate-950/80 border-b border-slate-800">
                        <div className="p-1 border-r border-slate-800 bg-slate-950"></div>
                        {week.map((date, dIndex) => (
                          <div key={dIndex} className={`p-1 border-r border-slate-800 text-right pr-2 text-[10px] font-black ${date ? 'text-slate-400' : 'text-transparent'}`}>
                            {date ? `${date.split('-')[2]}/${date.split('-')[1]}` : '-'}
                          </div>
                        ))}
                      </div>

                      {/* Linhas de Turnos Cadastrados no Builder */}
                      {builderShifts.map((period) => (
                        <div key={period.id} className="grid grid-cols-8 border-b border-slate-800/80 last:border-b-0 group">
                          
                          <div className="p-2.5 border-r border-slate-800 bg-slate-950/40 flex flex-col items-center justify-center text-center">
                            <span className="font-bold text-xs text-slate-200">{period.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{period.start} - {period.end}</span>
                          </div>

                          {week.map((date, dIndex) => {
                            if (!date) return <div key={dIndex} className="bg-slate-950 border-r border-slate-800"></div>;

                            // Filtra plantões que coincidem com data e horários
                            const slotShifts = filteredShifts.filter(s => 
                              String(s.date || '').startsWith(date) && 
                              s.start_time === period.start && 
                              s.end_time === period.end
                            );

                            const dIndexBase = new Date(`${date}T12:00:00`).getDay();
                            const isActiveInBase = period.cellStates && period.cellStates[dIndexBase];
                            const requiredQty = isActiveInBase ? (period.qty || 1) : 0;
                            
                            const renders = [...slotShifts];
                            for (let q = slotShifts.length; q < requiredQty; q++) {
                              renders.push({ isVirtualVacant: true, isVacant: true });
                            }

                            const cellKey = `${date}:${period.id}`;
                            const isSelected = selectedCells.includes(cellKey);

                            return (
                              <div 
                                key={dIndex} 
                                className={`border-r border-slate-800 p-1.5 min-h-[68px] relative transition-colors cursor-pointer flex flex-col gap-1 ${
                                  isSelected ? 'bg-sky-950/40 ring-1 ring-sky-500' : 'hover:bg-slate-900/50'
                                }`}
                                onDragOver={handleDragOver} 
                                onDrop={(e) => handleDrop(e, date, period)} 
                                onClick={(e) => handleCellClick(e, date, period)}
                              >
                                {renders.length === 0 && !isActiveInBase && (
                                  <div className="absolute inset-0 flex items-center justify-center opacity-20 text-xs font-black text-slate-500">-</div>
                                )}

                                {renders.map((s, idx) => (
                                  <div key={s.id || `vaga_${idx}`} className={`relative p-2 rounded-lg text-[10px] border flex items-center justify-between group/item transition-all ${
                                    s.isVacant 
                                      ? 'bg-amber-950/20 border-amber-500/40 text-amber-300 border-dashed' 
                                      : 'bg-slate-900 border-slate-700 text-slate-100 shadow-sm'
                                  }`}>
                                    <span className="font-bold truncate pr-3">{s.isVacant ? 'Vaga Aberta' : toTitleCase(s.professional_name)}</span>
                                    
                                    {!s.isVacant && s.id && (
                                      <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="opacity-0 group-hover/item:opacity-100 p-0.5 text-red-400 hover:bg-red-950/50 rounded transition-opacity">
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

      {/* ========================================================
          MODO LISTA DIÁRIA (COM STATUS EM TEMPO REAL)
          ======================================================== */}
      {viewMode === 'list' && (
        <div className="overflow-y-auto p-4 sm:px-8 space-y-3 flex-1 bg-slate-950">
           {filteredShifts.length === 0 ? (
              <div className="py-16 text-center text-slate-500">Nenhum plantão localizado com os filtros atuais.</div>
            ) : (
              filteredShifts.map(s => {
                const statusConfig = {
                  finalizado: { bg: 'bg-slate-900/60 border-slate-800 text-slate-500', icon: Lock, label: 'Finalizado' },
                  andamento: { bg: 'bg-emerald-950/30 border-emerald-500/50 text-emerald-400', icon: Activity, label: 'Em Andamento' },
                  planejado: { bg: 'bg-sky-950/30 border-sky-500/50 text-sky-400', icon: CalendarDays, label: 'Planejado' }
                }[s.rTimeStatus] || { bg: 'bg-slate-900 border-slate-800 text-slate-400', icon: CalendarDays, label: 'Planejado' };

                return (
                  <div key={s.id} className={`flex items-center gap-4 rounded-xl border p-3.5 bg-slate-900 transition-colors ${
                    s.isVacant ? 'border-amber-500/50 bg-amber-950/10' : 'border-slate-800'
                  }`}>
                    <div className={`min-w-[100px] rounded-lg py-1.5 text-center text-xs font-black border shrink-0 ${statusConfig.bg}`}>
                      {formatDateBR(s.date)} <br/>
                      <span className="font-mono text-[11px] opacity-80">{s.start_time || '--'} - {s.end_time || '--'}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <strong className={`block text-sm truncate ${s.isVacant ? 'text-amber-400' : 'text-white'}`}>
                        {toTitleCase(s.professional_name) || 'Vaga Aberta'}
                      </strong>
                      <span className="text-xs text-slate-400">{toTitleCase(s.sector_name)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {!s.isVacant && (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${statusConfig.bg}`}>
                          <statusConfig.icon className="w-3.5 h-3.5" /> {statusConfig.label}
                        </div>
                      )}

                      {!s.isVacant && s.rTimeStatus !== 'finalizado' && (
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)} className="h-8 w-8 text-red-400 hover:bg-red-950/20">
                          <Trash2 className="w-4 h-4"/>
                        </Button>
                      )}

                      {s.isVacant && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => { setEditing(s); setDialogOpen(true); }} className="h-8 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs">
                            <UserPlus className="w-3.5 h-3.5 mr-1" /> Alocar
                          </Button>
                          {s.id && (
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)} className="h-8 text-red-400 hover:bg-red-950/20 text-xs">
                              Cancelar Vaga
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
        </div>
      )}

      {/* ========================================================
          MODO ESCALA BASE (CONFIGURADOR DA SEÇÃO)
          ======================================================== */}
      {viewMode === 'base_builder' && (
        <div className="flex-1 overflow-auto bg-slate-950 p-6 flex justify-center">
          <div className="w-full max-w-5xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white">Escala Base: {activeSectorName}</h2>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">Modo Edição</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Crie as linhas de turnos que sua escala precisa. Passe o mouse nos dias para ativar ou desativar vagas.</p>
              </div>
              
              <div className="flex items-center gap-3">
                <Button onClick={openNewBuilderModal} className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-9 gap-1.5">
                  <Plus className="w-4 h-4" /> Adicionar Linha de Turno
                </Button>
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px] font-bold">
                    <tr>
                      <th className="p-3 w-48 text-center border-r border-slate-800">Turno / Horário</th>
                      {WEEK_DAYS_ORDER.map(day => (
                        <th key={day.index} className={`p-3 text-center border-r border-slate-800 ${day.weekend ? 'bg-slate-900/90' : ''}`}>
                          {day.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {builderShifts.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-16 text-center text-slate-500 text-xs">
                          Nenhum turno configurado para <strong>{activeSectorName}</strong>.<br/>
                          Clique no botão acima para adicionar a primeira linha (ex: Manhã, Tarde, etc.).
                        </td>
                      </tr>
                    ) : (
                      builderShifts.map(shift => (
                        <tr key={shift.id}>
                          <td className="p-3 font-bold border-r border-slate-800 bg-slate-950 relative group">
                            <div className="flex flex-col items-center justify-center text-center">
                              <span className="text-xs text-slate-200">{shift.name}</span>
                              <span className="text-[10px] font-mono text-sky-400 mt-0.5">{shift.start} às {shift.end}</span>
                            </div>
                            <button onClick={() => openEditBuilderModal(shift)} className="absolute top-2 right-2 p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 opacity-0 group-hover:opacity-100 transition-all">
                              <Pencil className="w-3 h-3" />
                            </button>
                          </td>
                          {WEEK_DAYS_ORDER.map(day => {
                            const isActive = Boolean(shift.cellStates && shift.cellStates[day.index]);
                            return (
                              <td key={day.index} className={`p-0 border-r border-slate-800 text-center relative ${day.weekend ? 'bg-slate-950/40' : ''}`}>
                                <div className="relative w-full h-full min-h-[64px] flex items-center justify-center group/cell cursor-pointer" onClick={() => toggleBuilderCell(shift.id, day.index)}>
                                  <div className={`w-8 h-8 mx-auto rounded-lg font-black text-sm flex items-center justify-center transition-colors ${
                                    isActive ? 'bg-slate-800 text-sky-400 border border-slate-700 shadow-sm' : 'bg-transparent text-slate-700'
                                  }`}>
                                    {isActive ? shift.qty : '-'}
                                  </div>
                                  <div className="absolute inset-0 bg-slate-950/90 text-white text-[10px] font-bold flex flex-col items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
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

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <Button variant="outline" onClick={() => setViewMode('grade')} className="border-slate-800 text-xs h-10 px-6">
                Voltar para a Grade
              </Button>
              <Button onClick={() => setConfirmGoToAllocation(true)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-10 px-8 shadow-md">
                Salvar Escala Base de {activeSectorName}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL DE PUBLICAÇÃO DE ESCALA POR INTERVALO
          ======================================================== */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-400" /> Publicar Escala
              </h2>
              <button onClick={() => setPublishModalOpen(false)}><X className="w-5 h-5 text-slate-500 hover:text-white" /></button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-400">
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
                          ? 'border-emerald-500 bg-emerald-950/40 text-emerald-400' 
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
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
                  <Input type="date" value={publishRange.start} onChange={e => setPublishRange({...publishRange, preset: 'custom', start: e.target.value})} className="h-9 text-xs bg-slate-950 border-slate-800" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Fim:</label>
                  <Input type="date" value={publishRange.end} onChange={e => setPublishRange({...publishRange, preset: 'custom', end: e.target.value})} className="h-9 text-xs bg-slate-950 border-slate-800" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex gap-2">
                <Button variant="outline" onClick={() => setPublishModalOpen(false)} className="flex-1 h-10 border-slate-800">Cancelar</Button>
                <Button onClick={handleConfirmPublish} className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">Confirmar e Publicar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAIS AUXILIARES
          ======================================================== */}

      {/* Modal: Pergunta pós-salvar Escala Base */}
      {confirmGoToAllocation && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-white mb-1">Escala Base Salva!</h3>
            <p className="text-xs text-slate-400 mb-5">
              Gostaria de ir para a grade e começar a alocar os profissionais nas vagas de {activeSectorName}?
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 border-slate-800 text-xs" onClick={() => setConfirmGoToAllocation(false)}>Depois</Button>
              <Button className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-9" onClick={() => { setConfirmGoToAllocation(false); setViewMode('grade'); }}>Sim, Alocar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Linha de Turno na Escala Base */}
      {builderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-black text-white">
                {builderModal.isNew ? 'Adicionar Turno' : 'Editar Turno'}
              </h3>
              <button onClick={() => setBuilderModal(null)}><X className="w-4 h-4 text-slate-500 hover:text-white" /></button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Nome do Turno:</label>
                <Input value={builderForm.name} onChange={e => setBuilderForm({...builderForm, name: e.target.value})} placeholder="Ex: Manhã, Tarde, Noturno A" className="h-9 bg-slate-950 border-slate-800" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Início:</label>
                  <Input type="time" value={builderForm.start} onChange={e => setBuilderForm({...builderForm, start: e.target.value})} className="h-9 bg-slate-950 border-slate-800" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Término:</label>
                  <Input type="time" value={builderForm.end} onChange={e => setBuilderForm({...builderForm, end: e.target.value})} className="h-9 bg-slate-950 border-slate-800" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Qtd. de Vagas Diárias:</label>
                <Input type="number" min="1" value={builderForm.qty} onChange={e => setBuilderForm({...builderForm, qty: Number(e.target.value)})} className="h-9 bg-slate-950 border-slate-800" />
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
                          isSelected ? 'border-sky-500 bg-sky-950/40 text-sky-400' : 'border-slate-800 bg-slate-950 text-slate-500'
                        }`}
                      >
                        {day.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBuilderModal(null)} className="h-9 text-xs border-slate-800">Cancelar</Button>
                <Button onClick={saveBuilderShift} className="h-9 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs">Salvar Turno</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Alocar Profissional ao Clicar na Vaga */}
      {newShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-black text-white">Alocar Plantonista</h3>
              <button onClick={() => setNewShiftModal(null)}><X className="w-4 h-4 text-slate-500 hover:text-white" /></button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Profissional:</label>
                <Select value={selectedProfIdForModal || undefined} onValueChange={setSelectedProfIdForModal}>
                  <SelectTrigger className="h-9 text-xs bg-slate-950 border-slate-800">
                    <SelectValue placeholder="Selecione o profissional..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sidebarProfessionals.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name || p.full_name || 'Sem nome'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div><span className="text-slate-500">Data:</span> <strong className="text-slate-200">{formatDateBR(newShiftModal.date)} ({fmtDateLong(newShiftModal.date)})</strong></div>
                <div><span className="text-slate-500">Horário:</span> <strong className="text-sky-400 font-mono">{newShiftModal.shiftObj.start} às {newShiftModal.shiftObj.end}</strong></div>
                <div><span className="text-slate-500">Seção:</span> <strong className="text-slate-200">{activeSectorName}</strong></div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setNewShiftModal(null)} className="h-9 text-xs border-slate-800">Cancelar</Button>
                <Button 
                  onClick={() => {
                    if (!selectedProfIdForModal) { alert('Selecione um profissional.'); return; }
                    assignShift(newShiftModal.date, newShiftModal.shiftObj, selectedProfIdForModal);
                    setNewShiftModal(null);
                  }}
                  className="h-9 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs"
                >
                  Alocar na Vaga
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Padrão de Edição */}
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